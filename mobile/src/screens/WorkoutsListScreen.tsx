import { Ionicons } from "@expo/vector-icons";
import { useLayoutEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useSetWorkoutActive, useWorkouts } from "../hooks/useWorkouts";
import type { WorkoutsScreenProps } from "../navigation/types";
import { radius, useTheme } from "../theme";
import { Banner, TAB_BANNERS } from "../ui/Banner";
import { Collapsible } from "../ui/Collapsible";
import { ExercisesPanel } from "../ui/ExercisesPanel";
import { HistoryPanel } from "../ui/HistoryPanel";
import { IconButton } from "../ui/IconButton";
import type { Workout } from "../types";

export function WorkoutsListScreen({ navigation }: WorkoutsScreenProps<"WorkoutsList">) {
  const { c } = useTheme();
  const { data, isLoading, isError, error, refetch, isRefetching } = useWorkouts(true);
  const setActive = useSetWorkoutActive();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <IconButton icon="add" tone="primary" onPress={() => navigation.navigate("WorkoutForm")} />
      ),
    });
  }, [navigation]);

  function toggle(w: Workout) {
    setActive.mutate(
      { id: w.id, active: w.archived },
      { onError: (e) => Alert.alert("Erro", String(e)) },
    );
  }

  if (isLoading)
    return <ActivityIndicator style={styles.center} size="large" color={c.primary} />;
  if (isError)
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <Text style={{ color: c.danger, textAlign: "center" }}>
          Falha ao carregar: {String(error)}
        </Text>
      </View>
    );

  const all = data ?? [];
  const active = all.filter((w) => !w.archived);
  const inactive = all.filter((w) => w.archived);

  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={c.primary} />
      }
    >
      <Banner {...TAB_BANNERS.treinos} />

      <Collapsible title={`Ativos${active.length ? ` (${active.length})` : ""}`} icon="checkmark-circle" defaultOpen>
        {active.length === 0 ? (
          <Text style={[styles.empty, { color: c.textMuted }]}>
            Nenhum treino ativo. Toque em ＋ para criar ou ative um abaixo.
          </Text>
        ) : (
          <View style={styles.group}>
            {active.map((w) => (
              <WorkoutCard
                key={w.id}
                workout={w}
                onEdit={() => navigation.navigate("WorkoutForm", { workoutId: w.id })}
                onToggle={() => toggle(w)}
                busy={setActive.isPending}
              />
            ))}
          </View>
        )}
      </Collapsible>

      {inactive.length > 0 ? (
        <Collapsible title={`Inativos (${inactive.length})`} icon="archive" defaultOpen={false}>
          <View style={styles.group}>
            {inactive.map((w) => (
              <WorkoutCard
                key={w.id}
                workout={w}
                onEdit={() => navigation.navigate("WorkoutForm", { workoutId: w.id })}
                onToggle={() => toggle(w)}
                busy={setActive.isPending}
              />
            ))}
          </View>
        </Collapsible>
      ) : null}

      <Collapsible title="Exercícios" icon="list">
        <ExercisesPanel />
      </Collapsible>

      <Collapsible title="Histórico" icon="trending-up">
        <HistoryPanel
          onPick={(exerciseId, exerciseName) =>
            navigation.navigate("ExerciseHistory", { exerciseId, exerciseName })
          }
        />
      </Collapsible>
    </ScrollView>
  );
}

function WorkoutCard({
  workout,
  onEdit,
  onToggle,
  busy,
}: {
  workout: Workout;
  onEdit: () => void;
  onToggle: () => void;
  busy: boolean;
}) {
  const { c } = useTheme();
  const isActive = !workout.archived;
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: c.card,
          borderColor: isActive ? c.border : "transparent",
          opacity: isActive ? 1 : 0.72,
        },
      ]}
    >
      <Pressable style={styles.cardMain} onPress={onEdit}>
        <View style={styles.cardTitleRow}>
          {isActive ? <View style={[styles.dot, { backgroundColor: c.success }]} /> : null}
          <Text style={[styles.cardName, { color: c.text }]} numberOfLines={1}>
            {workout.name}
          </Text>
        </View>
        <Text style={[styles.cardEdit, { color: c.textMuted }]}>Toque para editar</Text>
      </Pressable>

      <Pressable
        onPress={onToggle}
        disabled={busy}
        style={({ pressed }) => [
          styles.toggle,
          {
            backgroundColor: isActive ? c.cardAlt : c.primary,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
        hitSlop={6}
      >
        <Ionicons
          name={isActive ? "archive-outline" : "checkmark-circle"}
          size={16}
          color={isActive ? c.textMuted : c.primaryText}
        />
        <Text
          style={[styles.toggleText, { color: isActive ? c.textMuted : c.primaryText }]}
        >
          {isActive ? "Desativar" : "Ativar"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 10, paddingBottom: 32 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  empty: { textAlign: "center", marginVertical: 4 },
  group: { gap: 10 },
  sectionRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 14, marginBottom: 2 },
  sectionText: { fontSize: 12, fontWeight: "800", letterSpacing: 0.6 },
  sectionHint: { fontSize: 12 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: 16,
  },
  cardMain: { flex: 1 },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  cardName: { flex: 1, fontSize: 17, fontWeight: "600" },
  cardEdit: { fontSize: 12, marginTop: 3 },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  toggleText: { fontSize: 13, fontWeight: "700" },
});
