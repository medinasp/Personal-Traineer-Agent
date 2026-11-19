import { Ionicons } from "@expo/vector-icons";
import { useHeaderHeight } from "@react-navigation/elements";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { clearHistory, getHistory, runChat } from "../agent/coach";
import { CoachConfigError, CoachOfflineError, CoachRateLimitError, transcribe } from "../agent/groq";
import { useInternet } from "../offline/useInternet";
import type { RootTabProps } from "../navigation/types";
import { radius, useTheme } from "../theme";
import { confirmDelete } from "../ui/confirm";

interface Msg {
  key: string;
  role: "user" | "assistant";
  content: string;
  actions?: string[];
}

const SUGGESTIONS = [
  "Monte um treino de peito e tríceps",
  "Registra meu treino de hoje",
  "O que comer no pós-treino?",
];

export function ChatScreen({ navigation }: RootTabProps<"Coach">) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const online = useInternet();
  const qc = useQueryClient();
  const listRef = useRef<FlatList<Msg>>(null);

  const history = useQuery({ queryKey: ["chat", "history"], queryFn: () => getHistory() });
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");

  // gravacao de audio -> transcricao (Groq Whisper)
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

  async function startRec() {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Microfone", "Permita o acesso ao microfone para falar com o Coach.");
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
    } catch (e) {
      Alert.alert("Erro ao gravar", String(e));
    }
  }

  async function stopRec() {
    setRecording(false);
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) return;
      setTranscribing(true);
      const spoken = await transcribe(uri);
      if (spoken) setText((prev) => (prev.trim() ? `${prev.trim()} ${spoken}` : spoken));
    } catch (e) {
      Alert.alert(
        "Transcrição",
        e instanceof CoachOfflineError || e instanceof CoachRateLimitError ? (e as Error).message : String(e),
      );
    } finally {
      setTranscribing(false);
    }
  }

  // semeia com o historico (uma vez)
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !history.data) return;
    setMessages(history.data.map((m) => ({ key: String(m.id), role: m.role, content: m.content })));
    seeded.current = true;
  }, [history.data]);

  const send = useMutation({
    mutationFn: (msg: string) => runChat(msg),
    onSuccess: (res) => {
      setMessages((prev) => [
        ...prev,
        { key: "a" + Date.now(), role: "assistant", content: res.reply, actions: res.actions },
      ]);
      // runChat ja invalida as queries quando mexe em treinos/exercicios/sessoes
    },
    onError: (e) => {
      // erros tipados ja trazem mensagem amigavel em pt-BR (offline / limite+tempo / config)
      const content =
        e instanceof CoachOfflineError ||
        e instanceof CoachRateLimitError ||
        e instanceof CoachConfigError
          ? (e as Error).message
          : `Algo deu errado: ${String(e)}`;
      setMessages((prev) => [...prev, { key: "e" + Date.now(), role: "assistant", content }]);
    },
  });

  function submit(value?: string) {
    const msg = (value ?? text).trim();
    if (!msg || send.isPending) return;
    setText("");
    setMessages((prev) => [...prev, { key: "u" + Date.now(), role: "user", content: msg }]);
    send.mutate(msg);
  }

  function clearChat() {
    confirmDelete("Limpar conversa", "Apagar todo o histórico do Coach?", async () => {
      await clearHistory();
      setMessages([]);
      qc.invalidateQueries({ queryKey: ["chat", "history"] });
    });
  }

  useLayoutEffect(() => {
    navigation.setOptions({
      title: "Coach",
      headerRight: () => (
        <Pressable onPress={clearChat} hitSlop={10} style={{ paddingHorizontal: 8 }}>
          <Ionicons name="trash-outline" size={20} color={c.textMuted} />
        </Pressable>
      ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, c]);

  useEffect(() => {
    const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [messages, send.isPending]);

  const empty = messages.length === 0 && !history.isLoading;

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: c.bg }]}
      behavior="padding"
      keyboardVerticalOffset={headerHeight}
    >
      {empty ? (
        <View style={styles.welcome}>
          <View style={[styles.avatar, { backgroundColor: c.primarySoft }]}>
            <Ionicons name="sparkles" size={26} color={c.primary} />
          </View>
          <Text style={[styles.welcomeTitle, { color: c.text }]}>Fala comigo 💪</Text>
          <Text style={[styles.welcomeSub, { color: c.textMuted }]}>
            Pergunto sobre treino e dieta, e também monto treinos e registro seu diário.
          </Text>
          <View style={styles.suggestions}>
            {SUGGESTIONS.map((s) => (
              <Pressable
                key={s}
                onPress={() => submit(s)}
                style={({ pressed }) => [
                  styles.suggestion,
                  { backgroundColor: c.card, borderColor: c.border, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text style={[styles.suggestionText, { color: c.text }]}>{s}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          style={styles.flex}
          data={messages}
          keyExtractor={(m) => m.key}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => <Bubble msg={item} />}
          ListFooterComponent={
            send.isPending ? (
              <View style={[styles.bubble, styles.assistant, { backgroundColor: c.card }]}>
                <ActivityIndicator color={c.primary} />
              </View>
            ) : null
          }
        />
      )}

      {!online ? (
        <View style={[styles.offline, { backgroundColor: c.cardAlt, borderColor: c.border }]}>
          <Ionicons name="cloud-offline-outline" size={16} color={c.textMuted} />
          <Text style={[styles.offlineText, { color: c.textMuted }]}>
            O Coach precisa de internet. O resto do app funciona offline.
          </Text>
        </View>
      ) : null}

      <View style={[styles.inputBar, { borderTopColor: c.border, backgroundColor: c.bg, paddingBottom: insets.bottom + 8 }]}>
        <Pressable
          onPress={recording ? stopRec : startRec}
          disabled={!online || transcribing || send.isPending}
          style={({ pressed }) => [
            styles.micBtn,
            { backgroundColor: recording ? c.danger : c.cardAlt, opacity: !online ? 0.4 : pressed ? 0.8 : 1 },
          ]}
        >
          {transcribing ? (
            <ActivityIndicator size="small" color={c.primary} />
          ) : (
            <Ionicons name={recording ? "stop" : "mic"} size={20} color={recording ? "#fff" : c.textMuted} />
          )}
        </Pressable>
        <TextInput
          style={[styles.input, { backgroundColor: c.inputBg, borderColor: c.border, color: c.text }]}
          placeholder={
            !online ? "Sem internet" : recording ? "Gravando… toque em ■ para parar" : transcribing ? "Transcrevendo…" : "Pergunte ou peça algo…"
          }
          placeholderTextColor={c.textMuted}
          value={text}
          onChangeText={setText}
          multiline
          editable={online && !recording && !transcribing}
        />
        <Pressable
          onPress={() => submit()}
          disabled={!online || !text.trim() || send.isPending}
          style={({ pressed }) => [
            styles.sendBtn,
            { backgroundColor: !online || !text.trim() || send.isPending ? c.cardAlt : c.primary, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Ionicons name="arrow-up" size={22} color={!online || !text.trim() || send.isPending ? c.textMuted : c.primaryText} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Bubble({ msg }: { msg: Msg }) {
  const { c } = useTheme();
  const mine = msg.role === "user";
  return (
    <View style={[styles.bubbleWrap, mine ? styles.wrapRight : styles.wrapLeft]}>
      <View
        style={[
          styles.bubble,
          mine ? styles.user : styles.assistant,
          { backgroundColor: mine ? c.primary : c.card, borderColor: c.border },
        ]}
      >
        <Text style={[styles.bubbleText, { color: mine ? c.primaryText : c.text }]}>{msg.content}</Text>
      </View>
      {msg.actions && msg.actions.length > 0 ? (
        <View style={styles.actions}>
          {msg.actions.map((a, i) => (
            <View key={i} style={[styles.actionChip, { backgroundColor: c.primarySoft }]}>
              <Ionicons name="checkmark-circle" size={14} color={c.primary} />
              <Text style={[styles.actionText, { color: c.primary }]}>{a}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: 16, gap: 10 },
  bubbleWrap: { maxWidth: "88%" },
  wrapLeft: { alignSelf: "flex-start", alignItems: "flex-start" },
  wrapRight: { alignSelf: "flex-end", alignItems: "flex-end" },
  bubble: {
    borderRadius: radius.lg,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  user: { borderBottomRightRadius: 4 },
  assistant: { borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  actionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  actionText: { fontSize: 12, fontWeight: "600" },
  offline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  offlineText: { flex: 1, fontSize: 12, fontWeight: "600" },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    maxHeight: 120,
  },
  sendBtn: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  micBtn: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  welcome: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 10 },
  avatar: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  welcomeTitle: { fontSize: 20, fontWeight: "800" },
  welcomeSub: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  suggestions: { gap: 8, marginTop: 10, alignSelf: "stretch" },
  suggestion: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, padding: 14 },
  suggestionText: { fontSize: 14, fontWeight: "500" },
});
