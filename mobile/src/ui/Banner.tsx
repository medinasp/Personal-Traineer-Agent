import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View } from "react-native";

import { radius, useTheme } from "../theme";

interface BannerProps {
  emoji: string;
  title: string;
  subtitle?: string;
  /** par de cores do gradiente; usa o tema por padrao */
  colors?: [string, string];
}

/** faixa discreta no topo de cada aba: gradiente + emoji + titulo + frase */
export function Banner({ emoji, title, subtitle, colors }: BannerProps) {
  const { c, isDark } = useTheme();
  const pair: [string, string] = colors ?? [c.primary, c.primarySoft];
  // texto legivel sobre o gradiente (claro por cima de cor forte a esquerda)
  const onGrad = "#FFFFFF";

  return (
    <LinearGradient
      colors={pair}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.wrap}
    >
      <View style={[styles.emojiWrap, { backgroundColor: isDark ? "rgba(0,0,0,0.22)" : "rgba(255,255,255,0.22)" }]}>
        <Text style={styles.emoji}>{emoji}</Text>
      </View>
      <View style={styles.textWrap}>
        <Text style={[styles.title, { color: onGrad }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: onGrad }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </LinearGradient>
  );
}

/** copy + gradiente de cada aba (identidade visual propria por aba) */
export const TAB_BANNERS = {
  exercicios: {
    emoji: "🏋️",
    title: "Exercícios",
    subtitle: "Seu catálogo de movimentos",
    colors: ["#4F46E5", "#7C3AED"] as [string, string],
  },
  treinos: {
    emoji: "💪",
    title: "Treinos",
    subtitle: "Monte e edite suas rotinas",
    colors: ["#7C3AED", "#DB2777"] as [string, string],
  },
  hoje: {
    emoji: "🔥",
    title: "Bora treinar",
    subtitle: "Escolha o treino de hoje",
    colors: ["#F97316", "#EF4444"] as [string, string],
  },
  historico: {
    emoji: "📈",
    title: "Histórico",
    subtitle: "Sua evolução por exercício",
    colors: ["#0EA5E9", "#14B8A6"] as [string, string],
  },
  ajustes: {
    emoji: "⚙️",
    title: "Ajustes",
    subtitle: "Tema e preferências",
    colors: ["#0EA5E9", "#2563EB"] as [string, string],
  },
} as const;

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  emojiWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: { fontSize: 24 },
  textWrap: { flex: 1 },
  title: { fontSize: 17, fontWeight: "800", letterSpacing: 0.2 },
  subtitle: { fontSize: 13, fontWeight: "500", opacity: 0.9, marginTop: 2 },
});
