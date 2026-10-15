import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState, type ReactNode } from "react";
import {
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  useCreateMeasurement,
  useDeleteMeasurement,
  useMeasurements,
  useProfile,
  useUpdateProfile,
} from "../hooks/useProfile";
import { radius, useTheme } from "../theme";
import type { MeasurementCreate } from "../types";
import { formatDate } from "../utils/date";
import { Button } from "./Button";
import { confirmDelete } from "./confirm";

const SEXOS = ["Masculino", "Feminino", "Outro"];

function toNum(s: string): number | null {
  const t = s.trim().replace(",", ".");
  if (t === "") return null;
  const n = parseFloat(t);
  return Number.isNaN(n) ? null : n;
}
function toInt(s: string): number | null {
  const n = toNum(s);
  return n == null ? null : Math.round(n);
}
const str = (n: number | null | undefined) => (n == null ? "" : String(n));

/** medida em branco p/ o formulario de nova medida */
type MForm = {
  weight: string;
  fat: string;
  muscle: string;
  visceral: string;
  water: string;
  bmr: string;
};
const EMPTY_M: MForm = { weight: "", fat: "", muscle: "", visceral: "", water: "", bmr: "" };

export function PersonalDataModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();

  const profile = useProfile();
  const updateProfile = useUpdateProfile();
  const measurements = useMeasurements();
  const createM = useCreateMeasurement();
  const deleteM = useDeleteMeasurement();

  // perfil (autosave)
  const [height, setHeight] = useState("");
  const [sex, setSex] = useState<string | null>(null);
  const [goals, setGoals] = useState("");
  const [objectives, setObjectives] = useState("");

  useEffect(() => {
    if (!visible || !profile.data) return;
    setHeight(str(profile.data.height_cm));
    setSex(profile.data.sex);
    setGoals(profile.data.goals ?? "");
    setObjectives(profile.data.objectives ?? "");
  }, [visible, profile.data]);

  function saveProfile(patch: Record<string, unknown>) {
    updateProfile.mutate({
      height_cm: toInt(height),
      sex,
      goals: goals.trim() || null,
      objectives: objectives.trim() || null,
      ...patch,
    });
  }

  // nova medida
  const [m, setM] = useState<MForm>(EMPTY_M);
  function addMeasurement() {
    const payload: MeasurementCreate = {
      weight_kg: toNum(m.weight),
      body_fat_pct: toNum(m.fat),
      muscle_mass_kg: toNum(m.muscle),
      visceral_fat: toNum(m.visceral),
      body_water_pct: toNum(m.water),
      bmr_kcal: toInt(m.bmr),
    };
    if (Object.values(payload).every((v) => v == null)) return; // nada preenchido
    createM.mutate(payload, { onSuccess: () => setM(EMPTY_M) });
  }

  const list = measurements.data ?? [];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.flex, { backgroundColor: c.bg }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.header, { borderBottomColor: c.border, paddingTop: insets.top + 12 }]}>
          <Text style={[styles.title, { color: c.text }]}>Dados pessoais</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={26} color={c.textMuted} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={[styles.section, { color: c.textMuted }]}>PERFIL</Text>

          <Field label="Altura (cm)">
            <TextInput
              style={[styles.input, { backgroundColor: c.inputBg, borderColor: c.border, color: c.text }]}
              value={height}
              onChangeText={setHeight}
              onBlur={() => saveProfile({ height_cm: toInt(height) })}
              keyboardType="number-pad"
              placeholder="Ex: 178"
              placeholderTextColor={c.textMuted}
            />
          </Field>

          <Field label="Sexo">
            <View style={styles.chips}>
              {SEXOS.map((s) => {
                const active = sex === s;
                return (
                  <Pressable
                    key={s}
                    onPress={() => {
                      setSex(s);
                      saveProfile({ sex: s });
                    }}
                    style={[styles.chip, { backgroundColor: active ? c.primary : c.chip }]}
                  >
                    <Text style={{ color: active ? c.primaryText : c.textMuted, fontWeight: "700", fontSize: 13 }}>
                      {s}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Field>

          <Field label="Metas">
            <TextInput
              style={[styles.input, styles.multiline, { backgroundColor: c.inputBg, borderColor: c.border, color: c.text }]}
              value={goals}
              onChangeText={setGoals}
              onBlur={() => saveProfile({ goals: goals.trim() || null })}
              placeholder="Ex: ganhar 3 kg de massa em 6 meses"
              placeholderTextColor={c.textMuted}
              multiline
            />
          </Field>

          <Field label="Objetivos / foco">
            <TextInput
              style={[styles.input, styles.multiline, { backgroundColor: c.inputBg, borderColor: c.border, color: c.text }]}
              value={objectives}
              onChangeText={setObjectives}
              onBlur={() => saveProfile({ objectives: objectives.trim() || null })}
              placeholder="Ex: hipertrofia, reduzir % de gordura"
              placeholderTextColor={c.textMuted}
              multiline
            />
          </Field>

          <Text style={[styles.hint, { color: updateProfile.isPending ? c.textMuted : c.primary }]}>
            {updateProfile.isPending ? "Salvando…" : "Salva sozinho ao sair de cada campo"}
          </Text>

          <Text style={[styles.section, { color: c.textMuted, marginTop: 20 }]}>NOVA MEDIDA (bioimpedância)</Text>
          <View style={styles.grid}>
            <MField label="Peso (kg)" value={m.weight} onChange={(v) => setM({ ...m, weight: v })} />
            <MField label="% Gordura" value={m.fat} onChange={(v) => setM({ ...m, fat: v })} />
            <MField label="Massa musc. (kg)" value={m.muscle} onChange={(v) => setM({ ...m, muscle: v })} />
            <MField label="Gord. visceral" value={m.visceral} onChange={(v) => setM({ ...m, visceral: v })} />
            <MField label="% Água" value={m.water} onChange={(v) => setM({ ...m, water: v })} />
            <MField label="TMB (kcal)" value={m.bmr} onChange={(v) => setM({ ...m, bmr: v })} />
          </View>
          <Button label="Adicionar medida" icon="add" onPress={addMeasurement} loading={createM.isPending} />

          {list.length > 0 ? (
            <>
              <Text style={[styles.section, { color: c.textMuted, marginTop: 20 }]}>HISTÓRICO DE MEDIDAS</Text>
              {list.map((it) => (
                <View key={it.id} style={[styles.mRow, { backgroundColor: c.card, borderColor: c.border }]}>
                  <View style={styles.flex}>
                    <Text style={[styles.mDate, { color: c.text }]}>{formatDate(it.measured_on)}</Text>
                    <Text style={[styles.mVals, { color: c.textMuted }]}>
                      {[
                        it.weight_kg != null ? `${it.weight_kg} kg` : null,
                        it.body_fat_pct != null ? `${it.body_fat_pct}% gord.` : null,
                        it.muscle_mass_kg != null ? `${it.muscle_mass_kg} kg músc.` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() =>
                      confirmDelete("Excluir medida", `Excluir a medida de ${formatDate(it.measured_on)}?`, () =>
                        deleteM.mutate(it.id),
                      )
                    }
                    hitSlop={8}
                  >
                    <Ionicons name="trash-outline" size={20} color={c.danger} />
                  </Pressable>
                </View>
              ))}
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: c.textMuted }]}>{label}</Text>
      {children}
    </View>
  );
}

function MField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const { c } = useTheme();
  return (
    <View style={styles.mField}>
      <Text style={[styles.fieldLabel, { color: c.textMuted }]}>{label}</Text>
      <TextInput
        style={[styles.input, { backgroundColor: c.inputBg, borderColor: c.border, color: c.text }]}
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        placeholder="—"
        placeholderTextColor={c.textMuted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 20, fontWeight: "800" },
  body: { padding: 20, gap: 4, paddingBottom: 48 },
  section: { fontSize: 12, fontWeight: "800", letterSpacing: 0.6, marginBottom: 8 },
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 13, fontWeight: "600", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 16,
  },
  multiline: { minHeight: 64, textAlignVertical: "top" },
  chips: { flexDirection: "row", gap: 8 },
  chip: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, alignItems: "center" },
  hint: { fontSize: 13, fontWeight: "600", textAlign: "center", marginVertical: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  mField: { width: "47%", flexGrow: 1 },
  mRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: 14,
    marginTop: 8,
  },
  mDate: { fontSize: 15, fontWeight: "700" },
  mVals: { fontSize: 13, marginTop: 2 },
});
