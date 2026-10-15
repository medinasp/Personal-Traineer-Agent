const WEEKDAYS_LONG = [
  "Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado",
];
const MONTHS_SHORT = [
  "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez",
];

/** Date -> "Quinta, 29 ago" */
export function formatLongDay(d: Date): string {
  return `${WEEKDAYS_LONG[d.getDay()]}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

/** "há N dias" / "hoje" / "ontem" a partir de um ISO */
export function relativeDay(iso: string): string {
  const then = new Date(iso);
  const a = new Date(then.getFullYear(), then.getMonth(), then.getDate());
  const now = new Date();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((b.getTime() - a.getTime()) / 86400000);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  return `há ${days} dias`;
}

/** ISO -> "dd/mm/aaaa" */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/** true se o ISO cai no mesmo dia-calendario (local) que `ref` (default = hoje) */
export function isSameLocalDay(iso: string, ref: Date = new Date()): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

/** Date -> ISO no inicio do dia (00:00) */
export function startOfDayISO(d: Date): string {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString();
}

/** Date -> ISO no fim do dia (23:59:59) */
export function endOfDayISO(d: Date): string {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x.toISOString();
}
