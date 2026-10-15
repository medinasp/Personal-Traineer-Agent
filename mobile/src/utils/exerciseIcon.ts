import type { Exercise } from "../types";

/** normaliza: minusculo, sem acento — pra casar palavra-chave */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// grupo muscular -> glifo MaterialCommunityIcons (checado primeiro)
const BY_MUSCLE: [RegExp, string][] = [
  [/peito|peitoral|chest/, "dumbbell"],
  [/costa|dorsal|back|lombar/, "rowing"],
  [/perna|quadr|posterior|gluteo|panturr|leg/, "weight-lifter"],
  [/ombro|deltoid|shoulder|trapezio/, "human-handsup"],
  [/biceps|triceps|braco|antebra|arm/, "arm-flex"],
  [/abdom|core|abs/, "yoga"],
  [/cardio|aerob/, "run"],
];

// palavra-chave no nome (fallback quando nao ha grupo)
const BY_NAME: [RegExp, string][] = [
  [/corrid|esteira|run|eliptic/, "run"],
  [/bike|bicicleta|spinning|ciclism/, "bike"],
  [/agachament|leg press|afundo|avanco|squat/, "weight-lifter"],
  [/panturr/, "walk"],
  [/rosca|biceps/, "arm-flex"],
  [/triceps|frances|testa/, "arm-flex"],
  [/supino|crucifixo|peck|chest|peito|flexao/, "dumbbell"],
  [/puxad|remada|remo|barra fixa|pull/, "rowing"],
  [/desenvolvimento|elevacao|ombro|militar|arnold|encolhimento/, "human-handsup"],
  [/abdomin|prancha|abd/, "yoga"],
  [/terra|deadlift|levantamento/, "weight"],
];

const FALLBACK = "dumbbell";

/** glifo do exercicio: escolha manual (icon) tem prioridade, senao deduz por grupo/nome */
export function resolveExerciseIcon(
  ex: Pick<Exercise, "name" | "muscle_group" | "icon">,
): string {
  if (ex.icon) return ex.icon;
  const mg = ex.muscle_group ? norm(ex.muscle_group) : "";
  for (const [re, g] of BY_MUSCLE) if (re.test(mg)) return g;
  const nm = norm(ex.name);
  for (const [re, g] of BY_NAME) if (re.test(nm)) return g;
  return FALLBACK;
}

/** opcoes do seletor de icone na criacao/edicao (glifo + rotulo em pt) */
export const EXERCISE_ICON_OPTIONS: { glyph: string; label: string }[] = [
  { glyph: "dumbbell", label: "Halter" },
  { glyph: "weight-lifter", label: "Levantamento" },
  { glyph: "kettlebell", label: "Kettlebell" },
  { glyph: "weight", label: "Anilha" },
  { glyph: "arm-flex", label: "Bíceps" },
  { glyph: "rowing", label: "Remada" },
  { glyph: "human-handsup", label: "Braços acima" },
  { glyph: "run", label: "Corrida" },
  { glyph: "run-fast", label: "Corrida rápida" },
  { glyph: "walk", label: "Caminhada" },
  { glyph: "bike", label: "Bike" },
  { glyph: "yoga", label: "Yoga / core" },
  { glyph: "gymnastics", label: "Ginástica" },
  { glyph: "meditation", label: "Alongar" },
  { glyph: "karate", label: "Luta" },
  { glyph: "boxing-glove", label: "Boxe" },
  { glyph: "jump-rope", label: "Corda" },
  { glyph: "stretch-to-page", label: "Mobilidade" },
];
