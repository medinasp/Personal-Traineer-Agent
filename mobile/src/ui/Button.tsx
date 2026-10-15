import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type ViewStyle,
} from "react-native";

import { radius, useTheme } from "../theme";

type Variant = "primary" | "danger" | "secondary" | "ghost";

interface Props {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export function Button({
  label,
  onPress,
  icon,
  variant = "primary",
  disabled,
  loading,
  style,
}: Props) {
  const { c } = useTheme();
  const bg = {
    primary: c.primary,
    danger: c.danger,
    secondary: c.cardAlt,
    ghost: "transparent",
  }[variant];
  const fg =
    variant === "secondary" ? c.text : variant === "ghost" ? c.primary : "#FFFFFF";
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
          <Text style={[styles.label, { color: fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radius.md,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  label: { fontSize: 16, fontWeight: "600" },
});
