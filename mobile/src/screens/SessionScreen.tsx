import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useSession } from "../hooks/useSessions";
import { useWorkout } from "../hooks/useWorkouts";
import type { TodayScreenProps } from "../navigation/types";
import { radius, useTheme } from "../theme";
import { ExerciseIcon } from "../ui/ExerciseIcon";

export function SessionScreen({ route, navigation }: TodayScreenProps<"Session">) {
  const { c } = useTheme();
  const { sessionId, workoutId, title, resumed } = route.params;
  const workout = useWorkout(workoutId);
  const session = useSession(sessionId);

  if (workout.isLoading || session.isLoading)
    return <ActivityIndicator style={styles.center} size="large" color={c.primary} />;

  const logged = new Set((session.data?.set_logs ?? []).map((s) => s.exercise_id));

  return (
    <FlatList
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={styles.list}
      data={workout.data?.exercises ?? []}
      keyExtractor={(we) => String(we.id)}
      ListHeaderComponent={
        <Text style={[styles.hint, { color: c.textMuted }]}>
          Toque num exercício para registrar
        </Text>
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
  hint: { fontSize: 14, marginBottom: 6 },
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
