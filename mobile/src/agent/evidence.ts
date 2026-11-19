/**
 * Base de evidencia cientifica embarcada no app (corpus curado, pequeno).
 * No PC o RAG usa embeddings; aqui o corpus e minusculo, entao uma busca por
 * sobreposicao de termos (normalizada) resolve sem precisar de modelo ONNX.
 */
export interface Evidence {
  topic: string;
  title: string;
  year: number;
  url: string;
  text: string;
}

const CORPUS: Evidence[] = [
  {
    topic: "hipertrofia",
    title: "Volume semanal e hipertrofia",
    year: 2017,
    url: "https://pubmed.ncbi.nlm.nih.gov/27433992/",
    text: "Para hipertrofia, o volume (numero de series efetivas por grupo muscular por semana) e um dos principais determinantes. Meta-analises indicam relacao dose-resposta: ~10+ series semanais por grupo tendem a superar volumes baixos, com ganhos ate faixas altas (20+) para treinados, respeitando recuperacao. Base: Schoenfeld et al., 2017 (meta-analise de volume).",
  },
  {
    topic: "hipertrofia",
    title: "Frequencia de treino",
    year: 2016,
    url: "https://pubmed.ncbi.nlm.nih.gov/27102172/",
    text: "Treinar cada grupo muscular 2x/semana tende a gerar mais hipertrofia do que 1x/semana quando o volume total e igualado; o fator que mais importa e o volume semanal total, e distribuir ajuda a acomoda-lo. Base: Schoenfeld, Ogborn & Krieger, 2016.",
  },
  {
    topic: "hipertrofia",
    title: "Proximidade da falha (RIR)",
    year: 2021,
    url: "https://pubmed.ncbi.nlm.nih.gov/33497853/",
    text: "Treinar proximo da falha (ex.: 0-3 repeticoes em reserva) estimula hipertrofia; nao e preciso ir sempre a falha total para maximizar ganhos, e levar tudo a falha aumenta a fadiga e o tempo de recuperacao. Faixas de 5-30 repeticoes geram hipertrofia similar quando o esforco e alto. Base: revisoes de carga e falha, ~2021.",
  },
  {
    topic: "hipertrofia",
    title: "Descanso entre series",
    year: 2016,
    url: "https://pubmed.ncbi.nlm.nih.gov/26605807/",
    text: "Descansos mais longos (2-3 min) entre series em exercicios multiarticulares tendem a favorecer forca e hipertrofia por permitirem mais volume com boa carga, versus descansos muito curtos (<1 min). Base: Schoenfeld et al., 2016.",
  },
  {
    topic: "nutricao",
    title: "Proteina para hipertrofia",
    year: 2018,
    url: "https://pubmed.ncbi.nlm.nih.gov/28698222/",
    text: "Para maximizar ganhos de massa, ~1.6 g de proteina por kg de peso por dia costuma ser suficiente, com possivel beneficio ate ~2.2 g/kg em deficit calorico ou atletas. Distribuir em 3-5 refeicoes com ~0.3-0.4 g/kg cada ajuda a estimular a sintese proteica. Base: Morton et al., 2018 (meta-analise).",
  },
  {
    topic: "emagrecimento",
    title: "Deficit calorico e ritmo de perda",
    year: 2014,
    url: "https://pubmed.ncbi.nlm.nih.gov/24092765/",
    text: "Emagrecimento depende de deficit energetico. Ritmo moderado (~0.5-1% do peso por semana) preserva melhor a massa magra do que deficits agressivos. Manter proteina alta e treino de forca durante o deficit protege a massa muscular. Base: Helms et al., 2014 (revisao para atletas de fisico).",
  },
  {
    topic: "nutricao",
    title: "Creatina",
    year: 2017,
    url: "https://pubmed.ncbi.nlm.nih.gov/28615996/",
    text: "Creatina monoidratada (~3-5 g/dia) e um dos suplementos mais seguros e eficazes para forca e massa; nao exige fase de saturacao (apenas antecipa o efeito). Base: Position Stand da ISSN sobre creatina, 2017.",
  },
  {
    topic: "hipertrofia",
    title: "Cardio e ganho de massa (efeito interferencia)",
    year: 2012,
    url: "https://pubmed.ncbi.nlm.nih.gov/22002517/",
    text: "Combinar muito cardio de alta duracao/frequencia com musculacao pode atenuar ganhos de forca/massa (efeito interferencia), sobretudo quando proximos na mesma sessao. Volumes moderados de cardio, separados do treino de forca, minimizam o conflito. Base: Wilson et al., 2012 (meta-analise).",
  },
];

const STOP = new Set([
  "a", "o", "os", "as", "de", "da", "do", "das", "dos", "e", "para", "por", "com",
  "em", "um", "uma", "que", "qual", "quais", "como", "mais", "meu", "minha", "no", "na",
  "the", "to", "of", "and", "for",
]);

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function tokens(s: string): string[] {
  return norm(s)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

/** Top-k trechos do corpus por sobreposicao de termos com a query. */
export function searchEvidence(query: string, k = 4): Evidence[] {
  const q = tokens(query);
  if (q.length === 0) return CORPUS.slice(0, k);
  const scored = CORPUS.map((e) => {
    const hay = tokens(`${e.title} ${e.topic} ${e.text}`);
    const set = new Set(hay);
    let score = 0;
    for (const t of q) if (set.has(t)) score += 1;
    return { e, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const hits = scored.filter((s) => s.score > 0).slice(0, k);
  // nada casou -> devolve os mais gerais (volume, frequencia) pra nao ficar vazio
  return (hits.length ? hits.map((s) => s.e) : CORPUS.slice(0, 2));
}
