"""Ingestao da base de conhecimento (RAG).

- seed_curated: resumos proprios, baseados em evidencia, com citacao (sem texto protegido).
- ingest_pubmed: abstracts via E-utilities (dominio publico/aberto), dedup por PMID.

Uso:  docker compose exec -T api python -m app.agent.ingest
"""
from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agent import rag
from app.database import SessionLocal
from app.models import KbChunk

EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"

# ---- curadoria inicial (sintese propria + citacao) ----
CURATED: list[dict[str, Any]] = [
    {
        "external_id": "curated_hyper_volume",
        "topic": "hipertrofia",
        "title": "Volume semanal e hipertrofia",
        "year": 2017,
        "url": "https://pubmed.ncbi.nlm.nih.gov/27433992/",
        "text": "Para hipertrofia, o volume (numero de series efetivas por grupo muscular por semana) e um dos principais determinantes. Meta-analises indicam relacao dose-resposta: ~10+ series semanais por grupo tendem a superar volumes baixos, com ganhos ate faixas altas (20+) para treinados, respeitando recuperacao. Base: Schoenfeld et al., 2017 (meta-analise de volume).",
    },
    {
        "external_id": "curated_hyper_frequency",
        "topic": "hipertrofia",
        "title": "Frequencia de treino",
        "year": 2016,
        "url": "https://pubmed.ncbi.nlm.nih.gov/27102172/",
        "text": "Treinar cada grupo muscular 2x/semana tende a gerar mais hipertrofia do que 1x/semana quando o volume total e igualado; o fator que mais importa e o volume semanal total, e distribuir ajuda a acomoda-lo. Base: Schoenfeld, Ogborn & Krieger, 2016.",
    },
    {
        "external_id": "curated_hyper_rir",
        "topic": "hipertrofia",
        "title": "Proximidade da falha (RIR)",
        "year": 2021,
        "url": "https://pubmed.ncbi.nlm.nih.gov/33497853/",
        "text": "Treinar proximo da falha (ex.: 0-3 repeticoes em reserva) estimula hipertrofia; nao e preciso ir sempre a falha total para maximizar ganhos, e levar tudo a falha aumenta a fadiga e o tempo de recuperacao. Faixas de 5-30 repeticoes geram hipertrofia similar quando o esforco e alto. Base: revisoes de carga e falha, ~2021.",
    },
    {
        "external_id": "curated_hyper_rest",
        "topic": "hipertrofia",
        "title": "Descanso entre series",
        "year": 2016,
        "url": "https://pubmed.ncbi.nlm.nih.gov/26605807/",
        "text": "Descansos mais longos (2-3 min) entre series em exercicios multiarticulares tendem a favorecer forca e hipertrofia por permitirem mais volume com boa carga, versus descansos muito curtos (<1 min). Base: Schoenfeld et al., 2016.",
    },
    {
        "external_id": "curated_protein_intake",
        "topic": "nutricao",
        "title": "Proteina para hipertrofia",
        "year": 2018,
        "url": "https://pubmed.ncbi.nlm.nih.gov/28698222/",
        "text": "Para maximizar ganhos de massa, ~1.6 g de proteina por kg de peso por dia costuma ser suficiente, com possivel beneficio ate ~2.2 g/kg em deficit calorico ou atletas. Distribuir em 3-5 refeicoes com ~0.3-0.4 g/kg cada ajuda a estimular a sintese proteica. Base: Morton et al., 2018 (meta-analise).",
    },
    {
        "external_id": "curated_fatloss_balance",
        "topic": "emagrecimento",
        "title": "Deficit calorico e ritmo de perda",
        "year": 2014,
        "url": "https://pubmed.ncbi.nlm.nih.gov/24092765/",
        "text": "Emagrecimento depende de deficit energetico. Ritmo moderado (~0.5-1% do peso por semana) preserva melhor a massa magra do que deficits agressivos. Manter proteina alta e treino de forca durante o deficit protege a massa muscular. Base: Helms et al., 2014 (revisao para atletas de fisico).",
    },
    {
        "external_id": "curated_creatine",
        "topic": "nutricao",
        "title": "Creatina",
        "year": 2017,
        "url": "https://pubmed.ncbi.nlm.nih.gov/28615996/",
        "text": "Creatina monoidratada (~3-5 g/dia) e um dos suplementos mais seguros e eficazes para forca e massa; nao exige fase de saturacao (apenas antecipa o efeito). Base: Position Stand da ISSN sobre creatina, 2017.",
    },
    {
        "external_id": "curated_cardio_interference",
        "topic": "hipertrofia",
        "title": "Cardio e ganho de massa (efeito interferencia)",
        "year": 2012,
        "url": "https://pubmed.ncbi.nlm.nih.gov/22002517/",
        "text": "Combinar muito cardio de alta duracao/frequencia com musculacao pode atenuar ganhos de forca/massa (efeito interferencia), sobretudo quando proximos na mesma sessao. Volumes moderados de cardio, separados do treino de forca, minimizam o conflito. Base: Wilson et al., 2012 (meta-analise).",
    },
]


def _store(db: Session, items: list[dict[str, Any]], source: str) -> int:
    novos = [
        it for it in items
        if it.get("external_id") is None
        or db.execute(select(KbChunk.id).where(KbChunk.external_id == it["external_id"])).first() is None
    ]
    if not novos:
        return 0
    vecs = rag.embed([it["text"] for it in novos])
    for it, v in zip(novos, vecs):
        db.add(
            KbChunk(
                source=source,
                external_id=it.get("external_id"),
                title=it.get("title"),
                url=it.get("url"),
                year=it.get("year"),
                topic=it.get("topic"),
                text=it["text"],
                embedding=json.dumps(v),
            )
        )
    db.commit()
    return len(novos)


def seed_curated(db: Session) -> int:
    n = _store(db, CURATED, source="curated")
    print(f"curated: +{n}")
    return n


def _http_get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "meu-treino-rag/1.0"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read()


def ingest_pubmed(db: Session, term: str, topic: str, retmax: int = 15) -> int:
    q = urllib.parse.urlencode({"db": "pubmed", "term": term, "retmax": retmax, "retmode": "json", "sort": "date"})
    ids = json.loads(_http_get(f"{EUTILS}/esearch.fcgi?{q}")).get("esearchresult", {}).get("idlist", [])
    if not ids:
        return 0
    q2 = urllib.parse.urlencode({"db": "pubmed", "id": ",".join(ids), "retmode": "xml"})
    root = ET.fromstring(_http_get(f"{EUTILS}/efetch.fcgi?{q2}"))
    items: list[dict[str, Any]] = []
    for art in root.findall(".//PubmedArticle"):
        pmid = art.findtext(".//PMID")
        title = art.findtext(".//ArticleTitle") or ""
        abstract = " ".join(t.text or "" for t in art.findall(".//AbstractText")).strip()
        year = art.findtext(".//PubDate/Year")
        if not abstract:
            continue
        items.append(
            {
                "external_id": f"pmid_{pmid}",
                "title": title,
                "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
                "year": int(year) if year and year.isdigit() else None,
                "topic": topic,
                "text": f"{title}. {abstract}",
            }
        )
    n = _store(db, items, source="pubmed")
    print(f"pubmed '{term}': +{n}")
    return n


PUBMED_QUERIES = [
    ("resistance training hypertrophy meta-analysis", "hipertrofia"),
    ("protein intake muscle hypertrophy", "nutricao"),
    ("weight loss energy deficit resistance training", "emagrecimento"),
    ("training volume muscle growth", "hipertrofia"),
]


def main() -> None:
    db = SessionLocal()
    try:
        seed_curated(db)
        for term, topic in PUBMED_QUERIES:
            try:
                ingest_pubmed(db, term, topic, retmax=12)
                time.sleep(0.4)  # educado com a API
            except Exception as e:  # noqa: BLE001
                print(f"pubmed '{term}' falhou: {e}")
        total = db.query(KbChunk).count()
        print(f"total na base: {total}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
