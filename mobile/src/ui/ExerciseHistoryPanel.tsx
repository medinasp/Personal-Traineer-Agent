import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { useExerciseHistory } from "../hooks/useExerciseHistory";
import { radius, useTheme } from "../theme";
import type { HistorySession } from "../types";
import { endOfDayISO, formatDate, startOfDayISO } from "../utils/date";
import { Button } from "./Button";
import { WeightChart, type WeightPoint } from "./WeightChart";

type ViewMode = "list" | "chart";
const VIEWS: { key: ViewMode; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "list", icon: "list" },
  { key: "chart", icon: "stats-chart" },
];

type Preset = "2m" | "6m" | "all" | "range";
const PRESETS: { key: Preset; label: string }[] = [
  { key: "2m", label: "2 meses" },
  { key: "6m", label: "6 meses" },
  { key: "all", label: "Tudo" },
  { key: "range", label: "Intervalo" },
];
const LIMIT = 50;
const DAY = 86400000;

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function dayLabel(iso: string): string {
  const d = new Date(iso);
  return `${WEEKDAYS[d.getDay()]} · ${formatDate(iso)}`;
}

/** Controles + lista/grafico do historico de um exercicio (sem cabecalho). */
export function ExerciseHistoryPanel({ exerciseId }: { exerciseId: number }) {
  const { c } = useTheme();

  const [view, setView] = useState<ViewMode>("list");
  const [preset, setPreset] = useState<Preset>("2m");
  const [start, setStart] = useState<Date | null>(null);
  const [end, setEnd] = useState<Date | null>(null);
  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);
  const [applied, setApplied] = useState<{ start: string; end: string } | null>(null);

  const query = useMemo(() => {
    const now = Date.now();
    if (preset === "2m")
      return { limit: LIMIT, start: new Date(now - 60 * DAY).toISOString(), end: new Date(now).toISOString() };
    if (preset === "6m")
      return { limit: LIMIT, start: new Date(now - 180 * DAY).toISOString(), end: new Date(now).toISOString() };
    if (preset === "all") return { limit: LIMIT };
    return { limit: LIMIT, start: applied?.start, end: applied?.end };
  }, [preset, applied]);

  const enabled = preset !== "range" || applied != null;
  const history = useExerciseHistory(exerciseId, query, enabled);
  const sessions = history.data ?? [];

  const points = useMemo<WeightPoint[]>(() => {
    return sessions
      .map((s) => {
        const ws = s.sets.map((x) => x.weight_kg).filter((v): v is number => v != null);
        return ws.length ? { date: s.performed_at, weight: Math.max(...ws) } : null;
      })
      .filter((p): p is WeightPoint => p != null)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [sessions]);

  function onPickStart(_: DateTimePickerEvent, d?: Date) {
    setShowStart(false);
    if (d) setStart(d);
  }
  function onPickEnd(_: DateTimePickerEvent, d?: Date) {
    setShowEnd(false);
    if (d) setEnd(d);
  }
  function applyRange() {
    if (start && end) setApplied({ start: startOfDayISO(start), end: endOfDayISO(end) });
  }

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Text style={[styles.count, { color: c.textMuted }]}>
          {sessions.length > 0 ? `${sessions.length} dia(s) de treino` : ""}
        </Text>
        <View style={[styles.viewToggle, { backgroundColor: c.chip }]}>
          {VIEWS.map((v) => {
            const active = view === v.key;
            return (
              <Pressable
                key={v.key}
                onPress={() => setView(v.key)}
                style={[styles.viewBtn, active && { backgroundColor: c.primary }]}
                hitSlop={6}
              >
                <Ionicons name={v.icon} size={17} color={active ? c.primaryText : c.textMuted} />
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.segment}>
        {PRESETS.map((p) => {
          const active = preset === p.key;
          return (
            <Pressable
              key={p.key}
              onPress={() => setPreset(p.key)}
              style={[styles.seg, { backgroundColor: active ? c.primary : c.chip }]}
            >
              <Text style={[styles.segText, { color: active ? c.primaryText : c.textMuted }]}>
                {p.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {preset === "range" ? (
        <View style={[styles.rangeBox, { backgroundColor: c.cardAlt, borderColor: c.border }]}>
          <View style={styles.rangeRow}>
            <DateField label="Início" date={start} onPress={() => setShowStart(true)} />
            <DateField label="Fim" date={end} onPress={() => setShowEnd(true)} />
          </View>
          <Button label="Aplicar" icon="search" onPress={applyRange} disabled={!(start && end)} />
          {applied ? (
            <Text style={[styles.confirm, { color: c.text }]}>
              {formatDate(applied.start)} — {formatDate(applied.end)}
            </Text>
          ) : null}
          {showStart ? (
            <DateTimePicker value={start ?? new Date()} mode="date" onChange={onPickStart} />
          ) : null}
          {showEnd ? (
            <DateTimePicker value={end ?? new Date()} mode="date" onChange={onPickEnd} />
          ) : null}
        </View>
      ) : null}

      {preset === "range" && !applied ? (
        <Text style={[styles.hint, { color: c.textMuted }]}>
          Escolha o intervalo e toque em Aplicar.
        </Text>
      ) : history.isLoading ? (
        <ActivityIndicator style={{ marginTop: 16 }} color={c.primary} />
      ) : sessions.length === 0 ? (
        <Text style={[styles.hint, { color: c.textMuted }]}>
          Nenhum treino registrado nesse período.
        </Text>
      ) : view === "chart" ? (
        points.length === 0 ? (
          <Text style={[styles.hint, { color: c.textMuted }]}>
            Sem peso registrado pra montar o gráfico.
          </Text>
        ) : (
          <View style={[styles.chartCard, { backgroundColor: c.cardAlt, borderColor: c.border }]}>
            <WeightChart points={points} />
            <Text style={[styles.chartHint, { color: c.textMuted }]}>Peso máximo por treino (kg)</Text>
          </View>
        )
      ) : (
        <View style={{ gap: 10 }}>
          {sessions.map((s) => (
            <DayRow key={s.session_id} session={s} />
          ))}
        </View>
      )}

      {sessions.length >= LIMIT ? (
        <Text style={[styles.capHint, { color: c.textMuted }]}>
          Mostrando os {LIMIT} dias mais recentes.
        </Text>
      ) : null}
    </View>
  );
}

function DayRow({ session }: { session: HistorySession }) {
  const { c } = useTheme();
  const sets = [...session.sets].sort((a, b) => a.set_number - b.set_number);
  const weights = sets.map((s) => s.weight_kg).filter((w): w is number => w != null);
  const top = weights.length ? Math.max(...weights) : null;

  return (
    <View style={[styles.dayCard, { backgroundColor: c.cardAlt, borderColor: c.border }]}>
      <View style={styles.dayHead}>
        <Text style={[styles.dayDate, { color: c.text }]}>{dayLabel(session.performed_at)}</Text>
        {top != null ? (
          <View style={[styles.topBadge, { backgroundColor: c.primarySoft }]}>
            <Text style={[styles.topText, { color: c.primary }]}>top {top}kg</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.chips}>
        {sets.map((s) => (
          <View key={s.set_number} style={[styles.chip, { backgroundColor: c.card }]}>
            <Text style={[styles.chipText, { color: c.text }]}>
              {s.reps ?? "-"} × {s.weight_kg ?? "-"}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function DateField({
  label,
  date,
  onPress,
}: {
  label: string;
  date: Date | null;
  onPress: () => void;
}) {
  const { c } = useTheme();
  return (
    <View style={styles.flex}>
      <Text style={[styles.dateLabel, { color: c.textMuted }]}>{label}</Text>
      <Pressable
        style={[styles.dateBtn, { backgroundColor: c.inputBg, borderColor: c.border }]}
        onPress={onPress}
      >
        <Text style={{ color: date ? c.text : c.textMuted, fontSize: 15 }}>
          {date ? formatDate(date.toISOString()) : "escolher"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  flex: { flex: 1 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  count: { fontSize: 13 },
  viewToggle: { flexDirection: "row", borderRadius: radius.sm, padding: 3, gap: 3 },
  viewBtn: { width: 34, height: 30, borderRadius: radius.sm - 2, alignItems: "center", justifyContent: "center" },
  chartCard: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    paddingBottom: 8,
    gap: 4,
  },
  chartHint: { fontSize: 12, textAlign: "center" },
  segment: { flexDirection: "row", gap: 6 },
  seg: { flex: 1, paddingVertical: 9, borderRadius: radius.sm, alignItems: "center" },
  segText: { fontWeight: "700", fontSize: 13 },
  rangeBox: { gap: 10, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: 12 },
  rangeRow: { flexDirection: "row", gap: 12 },
  dateLabel: { fontSize: 12, marginBottom: 4 },
  dateBtn: { borderWidth: 1, borderRadius: radius.sm, paddingVertical: 11, alignItems: "center" },
  confirm: { fontSize: 13, textAlign: "center" },
  hint: { textAlign: "center", marginTop: 16 },
  capHint: { textAlign: "center", fontSize: 12, marginTop: 4 },
  dayCard: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 10 },
  dayHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dayDate: { fontSize: 15, fontWeight: "700" },
  topBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  topText: { fontSize: 12, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.sm },
  chipText: { fontSize: 14, fontWeight: "600", fontVariant: ["tabular-nums"] },
});
