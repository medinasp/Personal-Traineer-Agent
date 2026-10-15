"""RAG: embeddings (fastembed/ONNX) + busca por similaridade de cosseno.

Corpus pequeno -> brute-force em numpy (dispensa pgvector).
"""
from __future__ import annotations

import json
from functools import lru_cache
from typing import Any

import numpy as np
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import KbChunk


@lru_cache(maxsize=1)
def _model():
    # import tardio: so carrega o modelo ONNX quando o RAG e usado
    from fastembed import TextEmbedding

    return TextEmbedding(model_name=settings.embed_model)


def embed(texts: list[str]) -> list[list[float]]:
    vecs = list(_model().embed(texts))
    return [v.tolist() for v in vecs]


def embed_one(text: str) -> list[float]:
    return embed([text])[0]


def _cosine_topk(query: np.ndarray, mat: np.ndarray, k: int) -> list[int]:
    # vetores ja podem nao estar normalizados
    qn = query / (np.linalg.norm(query) + 1e-9)
    mn = mat / (np.linalg.norm(mat, axis=1, keepdims=True) + 1e-9)
    sims = mn @ qn
    idx = np.argsort(-sims)[:k]
    return [(int(i), float(sims[i])) for i in idx]


def search(db: Session, query: str, k: int = 4) -> list[dict[str, Any]]:
    rows = db.execute(select(KbChunk)).scalars().all()
    if not rows:
        return []
    mat = np.array([json.loads(r.embedding) for r in rows], dtype=np.float32)
    qv = np.array(embed_one(query), dtype=np.float32)
    out: list[dict[str, Any]] = []
    for i, score in _cosine_topk(qv, mat, k):
        r = rows[i]
        out.append(
            {
                "titulo": r.title,
                "texto": r.text,
                "fonte": r.source,
                "url": r.url,
                "ano": r.year,
                "topico": r.topic,
                "score": round(score, 3),
            }
        )
    return out
