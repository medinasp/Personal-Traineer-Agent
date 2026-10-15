import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";

import { useTheme } from "../theme";
import { resolveExerciseIcon } from "../utils/exerciseIcon";
import type { Exercise } from "../types";

type Glyph = keyof typeof MaterialCommunityIcons.glyphMap;

/** chip arredondado com um glifo dentro (base visual do icone de exercicio) */
export function IconChip({
  glyph,
  size = 44,
  active = false,
}: {
  glyph: string;
  size?: number;
  active?: boolean;
}) {
  const { c } = useTheme();
  const icon = Math.round(size * 0.56);
  return (
    <View
      style={[
        styles.chip,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: active ? c.primary : c.primarySoft,
        },
      ]}
    >
      <MaterialCommunityIcons
        name={(glyph as Glyph) ?? "dumbbell"}
        size={icon}
        color={active ? c.primaryText : c.primary}
      />
    </View>
  );
}

/** icone do exercicio: resolve o glifo (escolha manual ou deducao) e mostra no chip */
export function ExerciseIcon({
  exercise,
  size = 44,
}: {
  exercise: Pick<Exercise, "name" | "muscle_group" | "icon">;
  size?: number;
}) {
  return <IconChip glyph={resolveExerciseIcon(exercise)} size={size} />;
}

const styles = StyleSheet.create({
  chip: { alignItems: "center", justifyContent: "center" },
});
