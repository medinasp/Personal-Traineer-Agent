import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useSession } from "../hooks/useSessions";
import { useWorkout } from "../hooks/useWorkouts";
import type { TodayScreenProps } from "../navigation/types";
import { saveLocalSessionNotes } from "../offline/outbox";
import { radius, useTheme } from "../theme";
import { ExerciseIcon } from "../ui/ExerciseIcon";

export function SessionScreen({ route, navigation }: TodayScreenProps<"Session">) {
  const { c } = useTheme();
  const { sessionId, workoutId, title, resumed } = route.params;
  const workout = useWorkout(workoutId);
  const session = useSession(sessionId);

  // observacao do dia (campo livre). Semeia do banco uma vez; salva com debounce.
  const [notes, setNotes] = useState("");
  const seeded = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (seeded.current || session.isLoading) return;
    setNotes(session.data?.notes ?? "");
    seeded.current = true;
  }, [session.isLoading, session.data]);
  function onNotes(v: string) {
    setNotes(v);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void saveLocalSessionNotes(sessionId, v), 500);
  }
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  if (workout.isLoading || session.isLoading)
    return <ActivityIndicator style={styles.center} size="large" color={c.primary} />;

  const logged = new Set((session.data?.set_logs ?? []).map((s) => s.exercise_id));

  return (
    <FlatList
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={styles.list}
      data={workout.data?.exercises ?? []}
      keyExtractor={(we) => String(we.id)}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={[styles.obsLabel, { color: c.textMuted }]}>OBSERVAÇÃO DO DIA</Text>
          <TextInput
            style={[styles.obsInput, { backgroundColor: c.inputBg, borderColor: c.border, color: c.text }]}
            value={notes}
            onChangeText={onNotes}
            onBlur={() => void saveLocalSessionNotes(sessionId, notes)}
            placeholder="Como foi o treino, dores, energia, qualquer coisa útil…"
            placeholderTextColor={c.textMuted}
            multiline
          />
          <Text style={[styles.hint, { color: c.textMuted }]}>Toque num exercício para registrar</Text>
        </View>
      }
      renderItem={({ item }) => {
        const done = logged.has(item.exercise_id);
        return (
          <Pressable
            style={({ pressed }) => [
              styles.card,
              { backgroundColor: c.card, borderColor: done ? c.success : c.border, opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={() =>
              navigation.navigate("ExerciseLog", {
                sessionId,
                exerciseId: item.exercise_id,
                exerciseName: item.exercise.name,
                targetSets: item.target_sets,
                workoutId,
                title,
                resumed,
              })
            }
          >
            <ExerciseIcon exercise={item.exercise} size={40} />
            <View style={styles.flex}>
              <Text style={[styles.name, { color: c.text }]}>{item.exercise.name}</Text>
              {item.exercise.muscle_group ? (
                <Text style={[styles.sub, { color: c.textMuted }]}>
                  {item.exercise.muscle_group}
                </Text>
              ) : null}
            </View>
            {done ? (
              <View style={styles.doneWrap}>
                <Ionicons name="checkmark-circle" size={20} color={c.success} />
                <Text style={[styles.doneText, { color: c.success }]}>registrado</Text>
              </View>
            ) : (
              <Ionicons name="chevron-forward" size={20} color={c.textMuted} />
            )}
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 10 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  flex: { flex: 1 },
  header: { gap: 8, marginBottom: 4 },
  obsLabel: { fontSize: 12, fontWeight: "800", letterSpacing: 0.6 },
  obsInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: 12,
    fontSize: 15,
    minHeight: 64,
    textAlignVertical: "top",
  },
  hint: { fontSize: 14, marginTop: 2 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 16,
  },
  name: { fontSize: 17, fontWeight: "500" },
  sub: { fontSize: 13, marginTop: 2 },
  doneWrap: { flexDirection: "row", alignItems: "center", gap: 4 },
  doneText: { fontWeight: "600", fontSize: 13 },
});
