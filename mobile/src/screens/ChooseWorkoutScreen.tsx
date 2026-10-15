import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useSessionsList } from "../hooks/useSessions";
import { useWorkouts } from "../hooks/useWorkouts";
import type { TodayScreenProps } from "../navigation/types";
import { createLocalSession } from "../offline/outbox";
import { radius, useTheme } from "../theme";
import { Banner, TAB_BANNERS } from "../ui/Banner";
import { isSameLocalDay } from "../utils/date";

export function ChooseWorkoutScreen({ navigation }: TodayScreenProps<"ChooseWorkout">) {
  const { c } = useTheme();
  const { data, isLoading, isError, error, refetch, isRefetching } = useWorkouts();
  const sessions = useSessionsList();

  async function start(workoutId: number, title: string) {
    // se ja existe uma sessao HOJE pra este treino, reabre ela (nao duplica)
    const todays = (sessions.data ?? []).find(
      (s) => s.workout_id === workoutId && isSameLocalDay(s.performed_at),
    );
    if (todays) {
      navigation.navigate("Session", { sessionId: todays.id, workoutId, title, resumed: true });
      return;
    }
    try {
      // cria sessao local na hora (funciona offline); sincroniza depois
      const s = await createLocalSession(workoutId);
      navigation.navigate("Session", { sessionId: s.id, workoutId, title });
    } catch (e) {
      Alert.alert("Erro ao iniciar treino", String(e));
    }
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

  return (
    <FlatList
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={styles.list}
      data={data}
      keyExtractor={(w) => String(w.id)}
      onRefresh={refetch}
      refreshing={isRefetching}
      ListHeaderComponent={<Banner {...TAB_BANNERS.hoje} />}
      ListEmptyComponent={
        <Text style={[styles.empty, { color: c.textMuted }]}>
          Nenhum treino ativo. Ative ou crie um na aba "Treinos".
        </Text>
      }
      renderItem={({ item }) => (
        <Pressable
          style={({ pressed }) => [
            styles.card,
            { backgroundColor: c.card, borderColor: c.border, opacity: pressed ? 0.85 : 1 },
          ]}
          onPress={() => start(item.id, item.name)}
          disabled={sessions.isLoading}
        >
          <View style={[styles.iconWrap, { backgroundColor: c.primarySoft }]}>
            <Ionicons name="barbell-outline" size={22} color={c.primary} />
          </View>
          <Text style={[styles.cardName, { color: c.text }]}>{item.name}</Text>
          <Ionicons name="chevron-forward" size={20} color={c.textMuted} />
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 10 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  hint: { fontSize: 14, marginBottom: 6 },
  empty: { textAlign: "center", marginTop: 32 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: 16,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  cardName: { flex: 1, fontSize: 17, fontWeight: "600" },
});
