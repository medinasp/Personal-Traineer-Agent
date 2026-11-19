/**
 * Notificação fixa do cronômetro de descanso (Android): fica presa na barra
 * e "tica" nativamente (chronometer) enquanto o descanso corre — igual ao
 * relógio do Android. Some quando o descanso pausa/para.
 */
import notifee, { AndroidImportance } from "@notifee/react-native";
import { Platform } from "react-native";

const ID = "rest-timer";
let channelId: string | null = null;
let ready = false;

async function ensure(): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  if (!ready) {
    await notifee.requestPermission();
    channelId = await notifee.createChannel({
      id: "rest",
      name: "Descanso",
      importance: AndroidImportance.LOW, // sem som/heads-up: só fixa na barra, ticando
    });
    ready = true;
  }
  return true;
}

/** Mostra/atualiza a notificação fixa. `startMs` = epoch de quando o tempo "zero" ocorreu. */
export async function showRestNotification(startMs: number): Promise<void> {
  try {
    if (!(await ensure())) return;
    await notifee.displayNotification({
      id: ID,
      title: "Descanso",
      body: "Toque para voltar ao treino",
      android: {
        channelId: channelId!,
        ongoing: true, // fixa: não desliza pra fora
        onlyAlertOnce: true,
        showChronometer: true, // tica sozinho (nativo), mesmo em segundo plano
        chronometerDirection: "up",
        timestamp: startMs,
        smallIcon: "ic_launcher",
        pressAction: { id: "default" }, // toca -> volta ao app
        importance: AndroidImportance.LOW,
      },
    });
  } catch {
    /* sem permissão / indisponível: cronômetro segue funcionando dentro do app */
  }
}

export async function hideRestNotification(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await notifee.cancelNotification(ID);
  } catch {
    /* ignora */
  }
}
