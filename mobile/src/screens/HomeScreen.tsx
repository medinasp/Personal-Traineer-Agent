import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSessionsList } from "../hooks/useSessions";
import { useWorkouts } from "../hooks/useWorkouts";
import { useOutbox } from "../offline/useOutbox";
import type { RootTabProps } from "../navigation/types";
import { PersonalDataModal } from "../ui/PersonalDataModal";
import { radius, useTheme } from "../theme";
import { useUser } from "../user";
import { formatLongDay, relativeDay } from "../utils/date";

type Period = {
  greeting: string;
  emoji: string;
  colors: [string, string];
};

function periodFor(hour: number): Period {
  if (hour < 12) return { greeting: "Bom dia", emoji: "☀️", colors: ["#F59E0B", "#EF4444"] };
  if (hour < 18) return { greeting: "Boa tarde", emoji: "🌤️", colors: ["#0EA5E9", "#6366F1"] };
  return { greeting: "Boa noite", emoji: "🌙", colors: ["#4F46E5", "#1E293B"] };
}

/** segunda-feira 00:00 desta semana */
function weekStart(): Date {
  const n = new Date();
  const back = (n.getDay() + 6) % 7; // 0 = segunda
  return new Date(n.getFullYear(), n.getMonth(), n.getDate() - back);
}

export function HomeScreen({ navigation }: RootTabProps<"Inicio">) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { name } = useUser();
  const workouts = useWorkouts(true);
  const sessions = useSessionsList();
  const { pending, online } = useOutbox();
  const [showData, setShowData] = useState(false);

  const now = new Date();
  const period = periodFor(now.getHours());
  const hello = name.trim() ? `${period.greeting}, ${name.trim()}` : `${period.greeting}!`;

  const all = workouts.data ?? [];
  const active = all.filter((w) => !w.archived);
  const byId = new Map(all.map((w) => [w.id, w]));

  const sess = sessions.data ?? [];
  const ws = weekStart().getTime();
  const weekCount = sess.filter((s) => new Date(s.performed_at).getTime() >= ws).length;
  const last =
    sess.length > 0
      ? sess.reduce((a, b) => (new Date(a.performed_at) > new Date(b.performed_at) ? a : b))
      : null;
  const lastName = last ? byId.get(last.workout_id)?.name ?? "Treino" : null;

  const hasActive = active.length > 0;

  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 12 }]}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={period.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <Text style={styles.heroEmoji}>{period.emoji}</Text>
        <Text style={styles.heroGreeting}>{hello}</Text>
        <Text style={styles.heroDate}>{formatLongDay(now)}</Text>

        <Pressable
          onPress={() => navigation.navigate(hasActive ? "HojeTab" : "Treinos")}
          style={({ pressed }) => [styles.cta, { opacity: pressed ? 0.9 : 1 }]}
        >
          <Ionicons
            name={hasActive ? "play" : "add"}
            size={18}
            color="#111827"
          />
          <Text style={styles.ctaText}>{hasActive ? "Treinar agora" : "Montar um treino"}</Text>
        </Pressable>
      </LinearGradient>

      {pending > 0 || !online ? (
        <View
          style={[
            styles.syncBanner,
            { backgroundColor: online ? c.primarySoft : c.cardAlt, borderColor: c.border },
          ]}
        >
          <Ionicons
            name={online ? "sync" : "cloud-offline-outline"}
            size={16}
            color={online ? c.primary : c.textMuted}
          />
          <Text style={[styles.syncText, { color: c.text }]}>
            {pending > 0
              ? online
                ? `Sincronizando ${pending} ${pending === 1 ? "alteração" : "alterações"}…`
                : `Offline · ${pending} ${pending === 1 ? "alteração aguardando" : "alterações aguardando"} sincronização`
              : "Offline · trabalhando com dados salvos no aparelho"}
          </Text>
        </View>
      ) : null}

      <Text style={[styles.section, { color: c.textMuted }]}>ESTA SEMANA</Text>
      <View style={styles.statsRow}>
        <View style={[styles.stat, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.statNum, { color: c.primary }]}>{weekCount}</Text>
          <Text style={[styles.statLabel, { color: c.textMuted }]}>
            {weekCount === 1 ? "treino" : "treinos"}
          </Text>
        </View>
        <View style={[styles.stat, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.statNum, { color: c.text }]} numberOfLines={1}>
            {last ? relativeDay(last.performed_at) : "—"}
          </Text>
          <Text style={[styles.statLabel, { color: c.textMuted }]} numberOfLines={1}>
            {lastName ? `último · ${lastName}` : "sem treinos ainda"}
          </Text>
        </View>
      </View>

      <Text style={[styles.section, { color: c.textMuted }]}>VOCÊ</Text>
      <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
        <Shortcut icon="body-outline" label="Dados pessoais" onPress={() => setShowData(true)} />
      </View>

      <PersonalDataModal visible={showData} onClose={() => setShowData(false)} />
    </ScrollView>
  );
}

function Shortcut({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      style={({ pressed }) => [styles.shortcut, { opacity: pressed ? 0.6 : 1 }]}
      onPress={onPress}
    >
      <View style={[styles.shortcutIcon, { backgroundColor: c.primarySoft }]}>
        <Ionicons name={icon} size={20} color={c.primary} />
      </View>
      <Text style={[styles.shortcutLabel, { color: c.text }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={20} color={c.textMuted} />
    </Pressable>
  );
}

function Divider() {
  const { c } = useTheme();
  return <View style={[styles.divider, { backgroundColor: c.border }]} />;
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 10, paddingBottom: 32 },
  hero: {
    borderRadius: radius.lg,
    padding: 22,
    gap: 4,
  },
  heroEmoji: { fontSize: 30 },
  heroGreeting: { color: "#FFFFFF", fontSize: 26, fontWeight: "800", marginTop: 6 },
  heroDate: { color: "rgba(255,255,255,0.9)", fontSize: 15, fontWeight: "500" },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: radius.md,
    paddingVertical: 13,
    marginTop: 18,
  },
  ctaText: { color: "#111827", fontSize: 16, fontWeight: "800" },
  syncBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 10,
  },
  syncText: { flex: 1, fontSize: 13, fontWeight: "600" },
  section: { fontSize: 12, fontWeight: "800", letterSpacing: 0.6, marginTop: 14, marginLeft: 2 },
  statsRow: { flexDirection: "row", gap: 10 },
  stat: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: 16,
    gap: 2,
  },
  statNum: { fontSize: 24, fontWeight: "800" },
  statLabel: { fontSize: 13 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, overflow: "hidden" },
  shortcut: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  shortcutIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  shortcutLabel: { flex: 1, fontSize: 16, fontWeight: "500" },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 64 },
});
