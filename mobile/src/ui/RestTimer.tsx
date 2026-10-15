import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useRestTimer } from "../restTimer";
import { radius, useTheme } from "../theme";

function fmt(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Cronometro de descanso (global, nao para ao sair da tela). */
export function RestTimer() {
  const { c } = useTheme();
  const { elapsed, running, toggle, stop } = useRestTimer();

  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={styles.left}>
        <Ionicons name="timer-outline" size={18} color={c.textMuted} />
        <Text style={[styles.label, { color: c.textMuted }]}>Descanso</Text>
      </View>
      <Text style={[styles.time, { color: running ? c.primary : c.text }]}>{fmt(elapsed)}</Text>
      <View style={styles.btns}>
        <Pressable
          onPress={toggle}
          hitSlop={8}
          style={({ pressed }) => [styles.btn, { backgroundColor: c.primary, opacity: pressed ? 0.8 : 1 }]}
        >
          <Ionicons name={running ? "pause" : "play"} size={20} color={c.primaryText} />
        </Pressable>
        <Pressable
          onPress={stop}
          hitSlop={8}
          style={({ pressed }) => [styles.btn, { backgroundColor: c.chip, opacity: pressed ? 0.8 : 1 }]}
        >
          <Ionicons name="stop" size={18} color={c.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  left: { flexDirection: "row", alignItems: "center", gap: 6 },
  label: { fontSize: 13, fontWeight: "600" },
  time: { flex: 1, fontSize: 30, fontWeight: "800", textAlign: "center", fontVariant: ["tabular-nums"] },
  btns: { flexDirection: "row", gap: 8 },
  btn: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
});
