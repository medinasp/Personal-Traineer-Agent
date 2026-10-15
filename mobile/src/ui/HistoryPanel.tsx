import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useExercisesWithHistory } from "../hooks/useExercises";
import { radius, useTheme } from "../theme";
import { ExerciseIcon } from "./ExerciseIcon";

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Lista exercicios que tem historico; ao tocar, chama onPick. Sem FlatList (aninha em ScrollView). */
export function HistoryPanel({
  onPick,
}: {
  onPick: (exerciseId: number, exerciseName: string) => void;
}) {
  const { c } = useTheme();
  const { data, isLoading } = useExercisesWithHistory();
  const [query, setQuery] = useState("");

  const q = norm(query.trim());
  const list = q ? (data ?? []).filter((e) => norm(e.name).includes(q)) : data ?? [];

  return (
    <View style={styles.container}>
      {(data ?? []).length > 0 ? (
        <View style={[styles.searchWrap, { backgroundColor: c.inputBg, borderColor: c.border }]}>
          <Ionicons name="search" size={18} color={c.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: c.text }]}
            placeholder="Buscar exercício…"
            placeholderTextColor={c.textMuted}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery("")} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={c.textMuted} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 16 }} color={c.primary} />
      ) : (data ?? []).length === 0 ? (
        <Text style={[styles.empty, { color: c.textMuted }]}>
          Ainda sem histórico. Registre séries no diário para aparecer aqui.
        </Text>
      ) : list.length === 0 ? (
        <Text style={[styles.empty, { color: c.textMuted }]}>Nenhum exercício encontrado.</Text>
      ) : (
        list.map((item) => (
          <Pressable
            key={item.id}
            style={({ pressed }) => [
              styles.row,
              { borderBottomColor: c.border, opacity: pressed ? 0.6 : 1 },
            ]}
            onPress={() => onPick(item.id, item.name)}
          >
            <ExerciseIcon exercise={item} size={40} />
            <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Ionicons name="chevron-forward" size={20} color={c.textMuted} />
          </Pressable>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 4 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 2,
    marginBottom: 6,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 8 },
  empty: { textAlign: "center", marginTop: 16 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  name: { flex: 1, fontSize: 17, fontWeight: "500" },
});
