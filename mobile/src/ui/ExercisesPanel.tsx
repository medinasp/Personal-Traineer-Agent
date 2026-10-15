import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  useCreateExercise,
  useDeleteExercise,
  useExercises,
  useUpdateExercise,
} from "../hooks/useExercises";
import { radius, useTheme } from "../theme";
import { Button } from "./Button";
import { ExerciseIcon, IconChip } from "./ExerciseIcon";
import { IconPicker } from "./IconPicker";
import { confirmDelete } from "./confirm";
import { resolveExerciseIcon } from "../utils/exerciseIcon";
import type { Exercise } from "../types";

/** estado do form: fechado (null), criando (exercise=null) ou editando (exercise) */
type FormState = { exercise: Exercise | null } | null;

/** normaliza para busca: minusculo e sem acento */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Gestao de exercicios (lista + busca + criar/editar/excluir) sem FlatList, p/ aninhar em ScrollView. */
export function ExercisesPanel() {
  const { c } = useTheme();
  const { data, isLoading, isError, error, refetch } = useExercises();
  const [form, setForm] = useState<FormState>(null);
  const [query, setQuery] = useState("");

  const list = data ?? [];
  const q = norm(query.trim());
  const filtered = q ? list.filter((e) => norm(e.name).includes(q)) : list;

  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => setForm({ exercise: null })}
        style={({ pressed }) => [
          styles.addRow,
          { backgroundColor: c.primarySoft, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <Ionicons name="add-circle" size={22} color={c.primary} />
        <Text style={[styles.addText, { color: c.primary }]}>Novo exercício</Text>
      </Pressable>

      {list.length > 0 ? (
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
            returnKeyType="search"
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
      ) : isError ? (
        <View style={styles.center}>
          <Text style={{ color: c.danger, textAlign: "center" }}>
            Falha ao carregar: {String(error)}
          </Text>
          <Button label="Tentar de novo" icon="refresh" onPress={() => refetch()} />
        </View>
      ) : list.length === 0 ? (
        <Text style={[styles.empty, { color: c.textMuted }]}>
          Nenhum exercício ainda. Toque em "Novo exercício".
        </Text>
      ) : filtered.length === 0 ? (
        <Text style={[styles.empty, { color: c.textMuted }]}>
          Nenhum exercício encontrado para “{query.trim()}”.
        </Text>
      ) : (
        filtered.map((item) => (
          <Pressable
            key={item.id}
            style={({ pressed }) => [
              styles.row,
              { borderBottomColor: c.border, opacity: pressed ? 0.6 : 1 },
            ]}
            onPress={() => setForm({ exercise: item })}
          >
            <ExerciseIcon exercise={item} size={40} />
            <Text style={[styles.rowName, { color: c.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Ionicons name="chevron-forward" size={20} color={c.textMuted} />
          </Pressable>
        ))
      )}

      <ExerciseFormModal state={form} onClose={() => setForm(null)} />
    </View>
  );
}

/**
 * Form com salvamento automatico:
 * - editar: cada campo faz PATCH ao perder o foco / ao trocar o icone.
 * - criar: o 1o blur do nome CRIA o exercicio; dai os campos viram PATCH.
 */
function ExerciseFormModal({ state, onClose }: { state: FormState; onClose: () => void }) {
  const { c } = useTheme();
  const createExercise = useCreateExercise();
  const updateExercise = useUpdateExercise();
  const deleteExercise = useDeleteExercise();

  const [id, setId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [muscle, setMuscle] = useState("");
  const [icon, setIcon] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!state) return;
    const ex = state.exercise;
    setId(ex?.id ?? null);
    setName(ex?.name ?? "");
    setMuscle(ex?.muscle_group ?? "");
    setIcon(ex?.icon ?? null);
    setSavedAt(null);
  }, [state]);

  useEffect(() => {
    if (savedAt == null) return;
    const t = setTimeout(() => setSavedAt(null), 2000);
    return () => clearTimeout(t);
  }, [savedAt]);

  const busy = createExercise.isPending || updateExercise.isPending;
  const flash = () => setSavedAt(Date.now());
  const onErr = (e: unknown) => Alert.alert("Erro ao salvar", String(e));

  function patch(partial: { name?: string; muscle_group?: string | null; icon?: string | null }) {
    if (id == null) return;
    updateExercise.mutate({ id, data: partial }, { onSuccess: flash, onError: onErr });
  }

  function onNameBlur() {
    const nm = name.trim();
    if (!nm) return;
    if (id == null) {
      createExercise.mutate(
        { name: nm, muscle_group: muscle.trim() || null, icon },
        { onSuccess: (ex) => { setId(ex.id); flash(); }, onError: onErr },
      );
    } else {
      patch({ name: nm });
    }
  }

  function onMuscleBlur() {
    if (id != null) patch({ muscle_group: muscle.trim() || null });
  }

  function onIconChange(glyph: string | null) {
    setIcon(glyph);
    if (id != null) patch({ icon: glyph });
  }

  function handleDelete() {
    if (id == null) {
      onClose();
      return;
    }
    confirmDelete(
      "Excluir exercício",
      `Excluir "${name.trim() || "este exercício"}"? Isso remove também o histórico dele em todos os treinos.`,
      () =>
        deleteExercise.mutate(id, {
          onSuccess: onClose,
          onError: (e) => Alert.alert("Erro ao excluir", String(e)),
        }),
    );
  }

  const previewGlyph = resolveExerciseIcon({ name: name || "?", muscle_group: muscle || null, icon });

  return (
    <Modal visible={!!state} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.flex, { backgroundColor: c.bg }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.modalHeader, { borderBottomColor: c.border }]}>
          <Text style={[styles.modalTitle, { color: c.text }]}>
            {id != null ? "Editar exercício" : "Novo exercício"}
          </Text>
          <IconChip glyph={previewGlyph} size={40} />
        </View>

        <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
          <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Nome</Text>
          <TextInput
            style={[styles.input, { backgroundColor: c.inputBg, borderColor: c.border, color: c.text }]}
            placeholder="Ex: Supino reto"
            placeholderTextColor={c.textMuted}
            value={name}
            onChangeText={setName}
            onBlur={onNameBlur}
            autoFocus={state?.exercise == null}
          />

          <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Grupo muscular (opcional)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: c.inputBg, borderColor: c.border, color: c.text }]}
            placeholder="Ex: Peito"
            placeholderTextColor={c.textMuted}
            value={muscle}
            onChangeText={setMuscle}
            onBlur={onMuscleBlur}
          />

          <Text style={[styles.fieldLabel, { color: c.textMuted }]}>
            Ícone {icon == null ? "(automático pelo nome/grupo)" : ""}
          </Text>
          <IconPicker value={icon} onChange={onIconChange} />

          <Text style={[styles.autosaveHint, { color: busy ? c.textMuted : c.primary }]}>
            {busy ? "Salvando…" : savedAt != null ? "Salvo ✓" : "Salva sozinho ao sair de cada campo"}
          </Text>
        </ScrollView>

        <View style={[styles.modalFooter, { borderTopColor: c.border }]}>
          {id != null ? (
            <Button
              label="Excluir exercício"
              icon="trash-outline"
              variant="danger"
              loading={deleteExercise.isPending}
              onPress={handleDelete}
            />
          ) : null}
          <Button label="Voltar" icon="arrow-back" variant="secondary" onPress={onClose} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { gap: 4 },
  flex: { flex: 1 },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  addText: { fontSize: 15, fontWeight: "700" },
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
  center: { justifyContent: "center", alignItems: "center", gap: 12, marginTop: 16 },
  empty: { textAlign: "center", marginTop: 16 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowName: { flex: 1, fontSize: 17, fontWeight: "500" },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { fontSize: 20, fontWeight: "800" },
  modalBody: { padding: 20, gap: 8 },
  fieldLabel: { fontSize: 13, fontWeight: "600", marginTop: 8 },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  autosaveHint: { fontSize: 13, fontWeight: "600", textAlign: "center", marginTop: 16 },
  modalFooter: { padding: 16, gap: 10, borderTopWidth: StyleSheet.hairlineWidth },
});
