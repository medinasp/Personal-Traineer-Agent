import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useExerciseHistory } from "../hooks/useExerciseHistory";
import { useSession } from "../hooks/useSessions";
import type { TodayScreenProps } from "../navigation/types";
import { createLocalSession, enqueueSaveSets } from "../offline/outbox";
import type { SetLogIn } from "../types";
import { radius, useTheme } from "../theme";
import { Button } from "../ui/Button";
import { Collapsible } from "../ui/Collapsible";
import { ExerciseHistoryPanel } from "../ui/ExerciseHistoryPanel";
import { RestTimer } from "../ui/RestTimer";
import { formatDate, isSameLocalDay } from "../utils/date";

interface Row {
  reps: string;
  weight: string;
}

export function ExerciseLogScreen({ route, navigation }: TodayScreenProps<"ExerciseLog">) {
  const { c } = useTheme();
  const { sessionId, exerciseId, targetSets, workoutId, title, resumed } = route.params;

  // altura do teclado -> espaco no fim da lista p/ rolar as ultimas series acima dele
  const [kbHeight, setKbHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (e) => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKbHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  function newSession() {
    Alert.alert(
      "Nova sessão",
      "Deseja iniciar uma nova sessão? A sessão atual será mantida no histórico.",
      [
        { text: "Não", style: "cancel" },
        {
          text: "Sim",
          onPress: async () => {
            try {
              const s = await createLocalSession(workoutId);
              navigation.navigate("Session", { sessionId: s.id, workoutId, title, resumed: false });
            } catch (e) {
              Alert.alert("Erro", String(e));
            }
          },
        },
      ],
    );
  }

  const session = useSession(sessionId);

  // "ultima vez" derivado do historico (local-first): sessao mais recente que nao e hoje
  const history = useExerciseHistory(exerciseId, { limit: 50 });
  const prior = (history.data ?? []).find((h) => !isSameLocalDay(h.performed_at));
  const lastDate = prior?.performed_at ?? null;
  const lastMap = new Map((prior?.sets ?? []).map((l) => [l.set_number, l]));

  const [rows, setRows] = useState<Row[]>([]);
  const [ready, setReady] = useState(false);
  const [dirty, setDirty] = useState(false);

  // refs sempre com o valor mais recente (pra salvar em debounce e ao sair da tela)
  const rowsRef = useRef<Row[]>([]);
  rowsRef.current = rows;
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (ready || session.isLoading || history.isLoading) return;
    const existing = (session.data?.set_logs ?? [])
      .filter((s) => s.exercise_id === exerciseId)
      .sort((a, b) => a.set_number - b.set_number);
    // ja registrou hoje? mostra exatamente o que tem. Senao, abre com a MESMA quantidade
    // de series do ultimo treino deste exercicio. Se nunca fez, cai no alvo do treino.
    const lastCount = prior?.sets.length ?? 0;
    const count = existing.length > 0 ? existing.length : lastCount > 0 ? lastCount : targetSets;
    setRows(
      Array.from({ length: count }, (_, i) => {
        const found = existing.find((s) => s.set_number === i + 1);
        return {
          reps: found?.reps != null ? String(found.reps) : "",
          weight: found?.weight_kg != null ? String(found.weight_kg) : "",
        };
      }),
    );
    setReady(true);
  }, [ready, session.isLoading, history.isLoading, session.data, exerciseId, targetSets, prior]);

  // detecta o treino mais recente em que o peso maximo MUDOU vs. o anterior (subiu ou caiu)
  const change = useMemo(() => {
    const tops = (history.data ?? [])
      .map((h) => {
        const ws = h.sets
          .map((s) => s.weight_kg)
          .filter((w): w is number => w != null);
        return ws.length ? { date: h.performed_at, top: Math.max(...ws) } : null;
      })
      .filter((x): x is { date: string; top: number } => x != null);
    // tops ja vem em ordem decrescente (mais recente primeiro)
    for (let i = 0; i < tops.length - 1; i++) {
      if (tops[i].top !== tops[i + 1].top) {
        return {
          date: tops[i].date,
          ago: i + 1,
          dir: tops[i].top > tops[i + 1].top ? ("up" as const) : ("down" as const),
        };
      }
    }
    return null;
  }, [history.data]);

  function buildSets(rs: Row[]): SetLogIn[] {
    return rs
      .map((r, i) => {
        const reps = r.reps.trim() === "" ? null : parseInt(r.reps, 10);
        const weight =
          r.weight.trim() === "" ? null : parseFloat(r.weight.replace(",", "."));
        return {
          set_number: i + 1,
          reps: Number.isNaN(reps as number) ? null : reps,
          weight_kg: Number.isNaN(weight as number) ? null : weight,
        };
      })
      .filter((s) => s.reps !== null || s.weight_kg !== null);
  }

  // grava agora (local via outbox; sincroniza quando o back estiver disponivel)
  function save() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    void enqueueSaveSets(sessionId, exerciseId, buildSets(rowsRef.current));
    setDirty(false);
  }
  // agenda gravacao logo apos digitar (debounce curto)
  function scheduleSave() {
    setDirty(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, 400);
  }

  function update(i: number, field: keyof Row, value: string) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
    scheduleSave();
  }
  function addRow() {
    setRows((prev) => [...prev, { reps: "", weight: "" }]);
  }
  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
    scheduleSave();
  }

  // ao sair da tela: garante que o ultimo valor foi salvo
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (timer.current || dirtyRef.current) {
        void enqueueSaveSets(sessionId, exerciseId, buildSets(rowsRef.current));
      }
    };
  }, []);

  if (!ready) return <ActivityIndicator style={styles.center} size="large" color={c.primary} />;

  return (
    <View style={[styles.flex, { backgroundColor: c.bg }]}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.container, { paddingBottom: 24 + kbHeight }]}
        keyboardShouldPersistTaps="handled"
      >
        <RestTimer />

        <Collapsible title="Séries e pesos" icon="barbell-outline" defaultOpen>
          <View style={[styles.headerRow, { borderBottomColor: c.border }]}>
            <Text style={[styles.h, styles.colSet, { color: c.textMuted }]}>Série</Text>
            <View style={styles.colLast}>
              <Text style={[styles.h, { color: c.textMuted, textAlign: "center" }]}>Última vez</Text>
              <Text style={[styles.hDate, { color: c.textMuted }]}>
                {lastDate ? formatDate(lastDate) : "—"}
              </Text>
            </View>
            <Text style={[styles.h, styles.colIn, { color: c.textMuted }]}>Reps</Text>
            <Text style={[styles.h, styles.colIn, { color: c.textMuted }]}>Peso</Text>
          </View>

          {rows.map((row, i) => {
            const prev = lastMap.get(i + 1);
            return (
              <View style={[styles.row, { borderBottomColor: c.border }]} key={i}>
                <Text style={[styles.set, styles.colSet, { color: c.text }]}>{i + 1}</Text>
                <Text style={[styles.last, styles.colLast, { color: c.textMuted }]}>
                  {prev && (prev.reps != null || prev.weight_kg != null)
                    ? `${prev.reps ?? "-"} × ${prev.weight_kg ?? "-"}`
                    : "—"}
                </Text>
                <TextInput
                  style={[styles.input, styles.colIn, { backgroundColor: c.inputBg, borderColor: c.border, color: c.text }]}
                  value={row.reps}
                  onChangeText={(v) => update(i, "reps", v)}
                  onBlur={save}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={c.textMuted}
                />
                <TextInput
                  style={[styles.input, styles.colIn, { backgroundColor: c.inputBg, borderColor: c.border, color: c.text }]}
                  value={row.weight}
                  onChangeText={(v) => update(i, "weight", v)}
                  onBlur={save}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={c.textMuted}
                />
                <Pressable onPress={() => removeRow(i)} hitSlop={8} style={styles.removeBtn}>
                  <Ionicons name="close-circle" size={22} color={c.danger} />
                </Pressable>
              </View>
            );
          })}

          <Button label="Adicionar série" icon="add" variant="ghost" onPress={addRow} />
        </Collapsible>

        {change && (
          <View style={[styles.change, { backgroundColor: c.primarySoft }]}>
            <Ionicons
              name={change.dir === "up" ? "trending-up" : "trending-down"}
              size={16}
              color={change.dir === "up" ? c.success : c.danger}
            />
            <Text style={[styles.changeText, { color: c.text }]}>
              {change.ago === 1
                ? `Peso ${change.dir === "up" ? "subiu" : "caiu"} no último treino`
                : `Peso ${change.dir === "up" ? "subiu" : "caiu"} há ${change.ago} treinos`}
              <Text style={{ color: c.textMuted }}>
                {"  ·  "}
                {formatDate(change.date)}
              </Text>
            </Text>
          </View>
        )}

        <Collapsible title="Histórico do exercício" icon="stats-chart" defaultOpen={false}>
          <ExerciseHistoryPanel exerciseId={exerciseId} />
        </Collapsible>

        {resumed && (session.data?.set_logs?.length ?? 0) > 0 ? (
          <Button
            label="Deseja iniciar uma nova sessão?"
            icon="add"
            variant="secondary"
            onPress={newSession}
          />
        ) : null}
      </ScrollView>

      {kbHeight === 0 ? (
        <View style={styles.footer}>
          <Text style={[styles.saved, { color: dirty ? c.textMuted : c.primary }]}>
            {dirty ? "Salvando…" : "Salvo ✓"}
          </Text>
          <Button
            label="Voltar"
            icon="arrow-back"
            variant="secondary"
            onPress={() => navigation.goBack()}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  container: { padding: 16, gap: 12, paddingBottom: 48 },
  change: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  changeText: { flex: 1, fontSize: 13, fontWeight: "600" },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  h: { fontSize: 13, fontWeight: "700" },
  hDate: { fontSize: 11, textAlign: "center", marginTop: 2 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  colSet: { width: 32, textAlign: "center" },
  colLast: { flex: 1, alignItems: "center" },
  colIn: { width: 62, marginLeft: 6 },
  removeBtn: { width: 30, alignItems: "center", justifyContent: "center", marginLeft: 2 },
  set: { fontSize: 16, fontWeight: "600" },
  last: { fontSize: 15, textAlign: "center" },
  input: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontSize: 16,
    textAlign: "center",
  },
  footer: { padding: 16 },
  saved: { fontSize: 14, fontWeight: "700", textAlign: "center", marginBottom: 8 },
});
