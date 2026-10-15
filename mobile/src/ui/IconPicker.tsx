import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "../theme";
import { EXERCISE_ICON_OPTIONS } from "../utils/exerciseIcon";

type Glyph = keyof typeof MaterialCommunityIcons.glyphMap;

interface Props {
  /** glifo escolhido, ou null = automatico (deduz do grupo/nome) */
  value: string | null;
  onChange: (glyph: string | null) => void;
}

/** grade de icones pra escolher na criacao/edicao do exercicio (+ opcao Automatico) */
export function IconPicker({ value, onChange }: Props) {
  const { c } = useTheme();

  const cell = (
    key: string,
    glyph: string,
    label: string,
    selected: boolean,
    onPress: () => void,
  ) => (
    <Pressable key={key} style={styles.cell} onPress={onPress} hitSlop={4}>
      <View
        style={[
          styles.chip,
          {
            backgroundColor: selected ? c.primary : c.primarySoft,
            borderColor: selected ? c.primary : "transparent",
          },
        ]}
      >
        <MaterialCommunityIcons
          name={glyph as Glyph}
          size={24}
          color={selected ? c.primaryText : c.primary}
        />
      </View>
      <Text
        style={[styles.label, { color: selected ? c.text : c.textMuted }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View style={styles.grid}>
      {cell("__auto__", "auto-fix", "Auto", value == null, () => onChange(null))}
      {EXERCISE_ICON_OPTIONS.map((o) =>
        cell(o.glyph, o.glyph, o.label, value === o.glyph, () => onChange(o.glyph)),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  cell: { width: 64, alignItems: "center", gap: 4 },
  chip: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontSize: 11, textAlign: "center" },
});
