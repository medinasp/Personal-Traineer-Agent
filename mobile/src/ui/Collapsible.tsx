import { Ionicons } from "@expo/vector-icons";
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { radius, useTheme } from "../theme";

/** Dropdown/accordion. Controlado (open+onToggle) ou nao (defaultOpen). */
export function Collapsible({
  title,
  icon,
  defaultOpen = false,
  open: openProp,
  onToggle,
  right,
  children,
}: {
  title: string;
  icon?: keyof typeof Ionicons.glyphMap;
  defaultOpen?: boolean;
  open?: boolean;
  onToggle?: (next: boolean) => void;
  right?: ReactNode;
  children: ReactNode;
}) {
  const { c } = useTheme();
  const [internal, setInternal] = useState(defaultOpen);
  const open = openProp ?? internal;
  const toggle = () => (onToggle ? onToggle(!open) : setInternal(!open));

  return (
    <View style={[styles.wrap, { borderColor: c.border, backgroundColor: c.card }]}>
      <Pressable
        onPress={toggle}
        style={({ pressed }) => [styles.header, { opacity: pressed ? 0.7 : 1 }]}
      >
        {icon ? <Ionicons name={icon} size={18} color={c.primary} /> : null}
        <Text style={[styles.title, { color: c.text }]}>{title}</Text>
        {right}
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={20} color={c.textMuted} />
      </Pressable>
      {open ? <View style={[styles.body, { borderTopColor: c.border }]}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, overflow: "hidden" },
  header: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  title: { flex: 1, fontSize: 15, fontWeight: "700" },
  body: { padding: 14, borderTopWidth: StyleSheet.hairlineWidth },
});
