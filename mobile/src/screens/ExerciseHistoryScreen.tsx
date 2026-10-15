import { ScrollView, StyleSheet, Text, View } from "react-native";

import type { WorkoutsScreenProps } from "../navigation/types";
import { useTheme } from "../theme";
import { ExerciseHistoryPanel } from "../ui/ExerciseHistoryPanel";
import { IconChip } from "../ui/ExerciseIcon";
import { resolveExerciseIcon } from "../utils/exerciseIcon";

export function ExerciseHistoryScreen({ route }: WorkoutsScreenProps<"ExerciseHistory">) {
  const { c } = useTheme();
  const { exerciseId, exerciseName } = route.params;
  const glyph = resolveExerciseIcon({ name: exerciseName, muscle_group: null, icon: null });

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.container}>
      <View style={styles.head}>
        <IconChip glyph={glyph} size={46} />
        <View style={styles.flex}>
          <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>
            {exerciseName}
          </Text>
          <Text style={[styles.subtitle, { color: c.textMuted }]}>Histórico</Text>
        </View>
      </View>

      <ExerciseHistoryPanel exerciseId={exerciseId} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  flex: { flex: 1 },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { fontSize: 20, fontWeight: "800" },
  subtitle: { fontSize: 13, marginTop: 2 },
});
