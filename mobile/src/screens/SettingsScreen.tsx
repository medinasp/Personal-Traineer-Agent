import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { radius, useTheme, type ThemeMode } from "../theme";
import { Banner, TAB_BANNERS } from "../ui/Banner";
import { useUser } from "../user";

const OPTIONS: { mode: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { mode: "system", label: "Padrão do celular", icon: "phone-portrait-outline" },
  { mode: "light", label: "Claro", icon: "sunny-outline" },
  { mode: "dark", label: "Escuro", icon: "moon-outline" },
];

export function SettingsScreen() {
  const { c, mode, setMode } = useTheme();
  const { name, setName } = useUser();
  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <Banner {...TAB_BANNERS.ajustes} />

      <Text style={[styles.section, { color: c.textMuted }]}>SEU NOME</Text>
      <TextInput
        style={[styles.input, { backgroundColor: c.card, borderColor: c.border, color: c.text }]}
        placeholder="Como quer ser chamado(a)"
        placeholderTextColor={c.textMuted}
        value={name}
        onChangeText={setName}
        returnKeyType="done"
      />
      <Text style={[styles.note, { color: c.textMuted }]}>
        Usado na saudação da tela inicial.
      </Text>

      <Text style={[styles.section, { color: c.textMuted }]}>TEMA</Text>
      <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
        {OPTIONS.map((opt, i) => {
          const active = mode === opt.mode;
          return (
            <Pressable
              key={opt.mode}
              style={[
                styles.row,
                i < OPTIONS.length - 1 && { borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth },
              ]}
              onPress={() => setMode(opt.mode)}
            >
              <Ionicons name={opt.icon} size={20} color={active ? c.primary : c.textMuted} />
              <Text style={[styles.label, { color: c.text }]}>{opt.label}</Text>
              {active ? (
                <Ionicons name="checkmark-circle" size={22} color={c.primary} />
              ) : (
                <View style={styles.placeholder} />
              )}
            </Pressable>
          );
        })}
      </View>
      <Text style={[styles.note, { color: c.textMuted }]}>
        "Padrão do celular" segue o tema claro/escuro do seu sistema.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8 },
  section: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5, marginLeft: 4, marginTop: 8 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  card: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  label: { flex: 1, fontSize: 16, fontWeight: "500" },
  placeholder: { width: 22 },
  note: { fontSize: 13, marginTop: 8, marginLeft: 4 },
});
