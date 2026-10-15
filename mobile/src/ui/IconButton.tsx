import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet } from "react-native";

import { radius, useTheme } from "../theme";

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  color?: string;
  tone?: "default" | "danger" | "primary";
  size?: number;
}

export function IconButton({ icon, onPress, color, tone = "default", size = 20 }: Props) {
  const { c } = useTheme();
  const tint =
    color ?? (tone === "danger" ? c.danger : tone === "primary" ? c.primary : c.textMuted);
  const bg =
    tone === "danger" ? c.dangerSoft : tone === "primary" ? c.primarySoft : c.cardAlt;

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.btn, { backgroundColor: bg, opacity: pressed ? 0.7 : 1 }]}
    >
      <Ionicons name={icon} size={size} color={tint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
});
