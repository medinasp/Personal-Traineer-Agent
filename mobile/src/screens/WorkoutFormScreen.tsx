import { Ionicons } from "@expo/vector-icons";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useExercises } from "../hooks/useExercises";
import {
  useCreateWorkout,
  useSetWorkoutActive,
  useUpdateWorkout,
  useWorkout,
} from "../hooks/useWorkouts";
import type { WorkoutsScreenProps } from "../navigation/types";
import { radius, useTheme } from "../theme";
import { Button } from "../ui/Button";
import { ExerciseIcon, IconChip } from "../ui/ExerciseIcon";
import { IconButton } from "../ui/IconButton";
import type { Exercise } from "../types";

interface Picked {
  exercise_id: number;
  target_sets: number;
}

/** normaliza para busca: minusculo e sem acento */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function WorkoutFormScreen({ route, navigation }: WorkoutsScreenProps<"WorkoutForm">) {
  const { c } = useTheme();
  const workoutId = route.params?.workoutId;
  const isEdit = workoutId != null;

  const { data: exercises, isLoading } = useExercises();
  const detail = useWorkout(workoutId ?? -1);
  const createWorkout = useCreateWorkout();
  const updateWorkout = useUpdateWorkout();
  const setActive = useSetWorkoutActive();

  const isArchived = detail.data?.archived ?? false;

  const [name, setName] = useState("");
  const [picked, setPicked] = useState<Picked[]>([]);
  const [prefilled, setPrefilled] = useState(false);
  const [query, setQuery] = useState("");
  const [id, setId] = useState<number | null>(workoutId ?? null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // refs com o valor mais recente (autosave em debounce / ao sair da tela)
  const idRef = useRef(id);
  idRef.current = id;
  const nameRef = useRef(name);
  nameRef.current = name;
  const pickedRef = useRef(picked);
  pickedRef.current = picked;
  const creatingRef = useRef(false);
  const pendingRef = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: isEdit ? "Editar treino" : "Novo treino" });
  }, [navigation, isEdit]);

  // prefill no modo edicao
  useEffect(() => {
    if (isEdit && !prefilled && detail.data) {
      setName(detail.data.name);
      setPicked(
        detail.data.exercises.map((we) => ({
          exercise_id: we.exercise_id,
          target_sets: we.target_sets,
        })),
      );
      setPrefilled(true);
    }
  }, [isEdit, prefilled, detail.data]);

  const byId = useMemo(
    () => new Map((exercises ?? []).map((e) => [e.id, e])),
    [exercises],
  );
  const pickedIds = new Set(picked.map((p) => p.exercise_id));
  const availableAll = (exercises ?? []).filter((e) => !pickedIds.has(e.id));
  const q = norm(query.trim());
  const available = q
    ? availableAll.filter((e) => norm(e.name).includes(q))
    : availableAll;

  const saving = createWorkout.isPending || updateWorkout.isPending;
  const incomplete = name.trim().length === 0 || picked.length === 0;
  const flash = () => setSavedAt(Date.now());
  const onErr = (e: unknown) => Alert.alert("Erro ao salvar", String(e));

  // grava agora (le o estado mais recente via ref). Cria na 1a vez; depois atualiza.
  function doSave() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const nm = nameRef.current.trim();
    const picks = pickedRef.current;
    if (!nm || picks.length === 0) return; // sem nome ou sem exercicio: nada a salvar ainda
    const payload = picks.map((p) => ({ exercise_id: p.exercise_id, target_sets: p.target_sets }));
    if (idRef.current == null) {
      if (creatingRef.current) {
        pendingRef.current = true;
        return;
      }
      creatingRef.current = true;
      createWorkout.mutate(
        { name: nm, exercises: payload },
        {
          onSuccess: (w) => {
            creatingRef.current = false;
            idRef.current = w.id;
            setId(w.id);
            flash();
            if (pendingRef.current) {
              pendingRef.current = false;
              doSave(); // reconcilia mudancas feitas durante a criacao
            }
          },
          onError: (e) => {
            creatingRef.current = false;
            onErr(e);
          },
        },
      );
    } else {
      updateWorkout.mutate(
        { id: idRef.current, name: nm, exercises: payload },
        { onSuccess: flash, onError: onErr },
      );
    }
  }

  function scheduleSave() {
    if (creatingRef.current) {
      pendingRef.current = true;
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(doSave, 500);
  }

  function add(e: Exercise) {
    setPicked((prev) => [...prev, { exercise_id: e.id, target_sets: 6 }]);
    scheduleSave();
  }
  function remove(exId: number) {
    setPicked((prev) => prev.filter((p) => p.exercise_id !== exId));
    scheduleSave();
  }
  function move(i: number, dir: -1 | 1) {
    setPicked((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    scheduleSave();
  }

  // some o "Salvo ✓"
  useEffect(() => {
    if (savedAt == null) return;
    const t = setTimeout(() => setSavedAt(null), 2000);
    return () => clearTimeout(t);
  }, [savedAt]);

  // ao sair da tela: garante que a ultima mudanca foi salva
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      doSave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleActive() {
    if (!isEdit) return;
    setActive.mutate(
      { id: workoutId, active: isArchived }, // se arquivado, ativar; senao desativar
      {
        onSuccess: () => navigation.goBack(),
        onError: (e) => Alert.alert("Erro", String(e)),
      },
    );
  }

  if (isLoading || (isEdit && detail.isLoading)) {
    return <ActivityIndicator style={styles.center} size="large" color={c.primary} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <TextInput
        style={[styles.input, { backgroundColor: c.inputBg, borderColor: c.border, color: c.text }]}
        placeholder="Nome do treino (ex: Treino A — Peito)"
        placeholderTextColor={c.textMuted}
        value={name}
        onChangeText={(v) => {
          setName(v);
          scheduleSave();
        }}
        onBlur={doSave}
      />

      <FlatList
        data={available}
        keyExtractor={(e) => String(e.id)}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        ListHeaderComponent={
          <>
            {/* selecionados, em ordem */}
            <Text style={[styles.label, { color: c.text }]}>
              No treino {picked.length > 0 ? `(${picked.length})` : ""}
            </Text>
            {picked.length === 0 ? (
              <Text style={[styles.hint, { color: c.textMuted }]}>
                Adicione exercícios da lista abaixo.
              </Text>
            ) : (
              picked.map((p, i) => {
                const ex = byId.get(p.exercise_id);
                return (
                  <View
                    key={p.exercise_id}
                    style={[styles.pickedRow, { backgroundColor: c.card, borderColor: c.border }]}
                  >
                    <Text style={[styles.pos, { color: c.primary }]}>{i + 1}</Text>
                    {ex ? (
                      <ExerciseIcon exercise={ex} size={32} />
                    ) : (
                      <IconChip glyph="dumbbell" size={32} />
                    )}
                    <Text style={[styles.pickedName, { color: c.text }]} numberOfLines={1}>
                      {ex?.name ?? `#${p.exercise_id}`}
                    </Text>
                    <IconButton icon="arrow-up" onPress={() => move(i, -1)} size={18} />
                    <IconButton icon="arrow-down" onPress={() => move(i, 1)} size={18} />
                    <IconButton
                      icon="close"
                      tone="danger"
                      onPress={() => remove(p.exercise_id)}
                      size={18}
                    />
                  </View>
                );
              })
            )}

            <Text style={[styles.label, { color: c.text, marginTop: 16 }]}>Adicionar</Text>

            {availableAll.length > 0 ? (
              <View
                style={[styles.searchWrap, { backgroundColor: c.inputBg, borderColor: c.border }]}
              >
                <Ionicons name="search" size={18} color={c.textMuted} />
                <TextInput
                  style={[styles.searchInput, { color: c.text }]}
                  placeholder="Buscar exercício (ex: bar, biceps...)"
                  placeholderTextColor={c.textMuted}
                  value={query}
                  onChangeText={setQuery}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                />
                {query.length > 0 ? (
                  <IconButton icon="close-circle" onPress={() => setQuery("")} size={18} />
                ) : null}
              </View>
            ) : null}

            {availableAll.length === 0 ? (
              <Text style={[styles.hint, { color: c.textMuted }]}>
                Todos os exercícios já estão no treino.
              </Text>
            ) : available.length === 0 ? (
              <Text style={[styles.hint, { color: c.textMuted }]}>
                Nenhum exercício encontrado para “{query.trim()}”.
              </Text>
            ) : null}
          </>
        }
        renderItem={({ item }) => (
          <Pressable
            style={[styles.availRow, { borderBottomColor: c.border }]}
            onPress={() => add(item)}
          >
            <Ionicons name="add-circle-outline" size={22} color={c.primary} />
            <ExerciseIcon exercise={item} size={34} />
            <View style={styles.flex}>
              <Text style={[styles.availName, { color: c.text }]}>{item.name}</Text>
              {item.muscle_group ? (
                <Text style={[styles.availSub, { color: c.textMuted }]}>{item.muscle_group}</Text>
              ) : null}
            </View>
          </Pressable>
        )}
        contentContainerStyle={{ paddingBottom: 16 }}
      />

      <Text style={[styles.saved, { color: saving || incomplete ? c.textMuted : c.primary }]}>
        {saving
          ? "Salvando…"
          : incomplete
            ? "Dê um nome e adicione ao menos 1 exercício — salva sozinho"
            : savedAt != null
              ? "Salvo ✓"
              : "Salvo"}
      </Text>
      {isEdit ? (
        <Button
          label={isArchived ? "Ativar treino" : "Desativar treino"}
          icon={isArchived ? "checkmark-circle-outline" : "archive-outline"}
          variant="secondary"
          onPress={toggleActive}
          loading={setActive.isPending}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  label: { fontSize: 14, fontWeight: "700" },
  saved: { fontSize: 13, fontWeight: "600", textAlign: "center" },
  hint: { fontSize: 13, marginTop: 6, marginBottom: 4 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginTop: 8,
    marginBottom: 4,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 8 },
  pickedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 8,
  },
  pos: { width: 22, textAlign: "center", fontWeight: "800", fontSize: 15 },
  pickedName: { flex: 1, fontSize: 15, fontWeight: "500" },
  availRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  availName: { fontSize: 16 },
  availSub: { fontSize: 13, marginTop: 2 },
});
