import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { backendUp, pendingCount, syncNow } from "../db/sync";
import { radius, useTheme } from "../theme";
import { Button } from "./Button";

const REQS = [
  "Seu computador ligado",
  "O backend (Docker) rodando na máquina",
  "Tailscale ligado no PC e no celular",
  "Celular com internet (Wi-Fi ou dados)",
];

export function SyncModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [reachable, setReachable] = useState<boolean | null>(null);
  const [pending, setPending] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    setReachable(await backendUp());
    setPending(await pendingCount());
  }
  useEffect(() => {
    if (visible) {
      setMsg(null);
      void refresh();
    }
  }, [visible]);

  async function doSync() {
    setBusy(true);
    setMsg(null);
    const r = await syncNow();
    setBusy(false);
    setPending(r.pending);
    setReachable(r.ok ? true : await backendUp());
    setMsg(r.ok ? "Sincronizado ✓" : "Não consegui alcançar sua máquina. Confira os requisitos abaixo.");
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.flex, { backgroundColor: c.bg }]}>
        <View style={[styles.header, { borderBottomColor: c.border, paddingTop: insets.top + 12 }]}>
          <Text style={[styles.title, { color: c.text }]}>Sincronização</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={26} color={c.textMuted} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <View style={[styles.statusCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.statusRow}>
              <Ionicons
                name={reachable ? "cloud-done-outline" : "cloud-offline-outline"}
                size={20}
                color={reachable ? c.success : c.textMuted}
              />
              <Text style={[styles.statusText, { color: c.text }]}>
                {reachable == null ? "Verificando…" : reachable ? "Máquina alcançável" : "Máquina não alcançável"}
              </Text>
            </View>
            <Text style={[styles.pending, { color: pending > 0 ? c.primary : c.textMuted }]}>
              {pending > 0 ? `${pending} alteração(ões) pendente(s) de sincronização` : "Tudo sincronizado"}
            </Text>
          </View>

          <Button
            label="Sincronizar agora"
            icon="sync"
            onPress={doSync}
            loading={busy}
          />
          {msg ? <Text style={[styles.msg, { color: msg.includes("✓") ? c.primary : c.danger }]}>{msg}</Text> : null}

          <Text style={[styles.section, { color: c.textMuted }]}>PARA SINCRONIZAR, PRECISA DE:</Text>
          {REQS.map((r) => (
            <View key={r} style={styles.reqRow}>
              <Ionicons name="ellipse" size={7} color={c.textMuted} />
              <Text style={[styles.reqText, { color: c.text }]}>{r}</Text>
            </View>
          ))}

          <Text style={[styles.note, { color: c.textMuted }]}>
            O app funciona 100% offline — treinar, montar treino, histórico e perfil. O Coach funciona em qualquer
            lugar com internet (não precisa do computador). A sincronização só sobe seus dados pro computador pra
            você analisar por lá. Nada se perde enquanto isso.
          </Text>
        </ScrollView>
      </View>
    </Modal>
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
  body: { padding: 20, gap: 12 },
  statusCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, padding: 16, gap: 6 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusText: { fontSize: 16, fontWeight: "700" },
  pending: { fontSize: 13, fontWeight: "600" },
  msg: { fontSize: 13, fontWeight: "600", textAlign: "center" },
  section: { fontSize: 12, fontWeight: "800", letterSpacing: 0.6, marginTop: 8 },
  reqRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  reqText: { fontSize: 14, flex: 1 },
  note: { fontSize: 13, lineHeight: 19, marginTop: 10 },
});
