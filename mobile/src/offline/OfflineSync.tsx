import { useEffect } from "react";
import { AppState } from "react-native";

import { maintain } from "../agent/modelPool";
import { syncNow } from "../db/sync";

/** Sincroniza o banco local com o backend: ao abrir, ao voltar pro 1o plano e a cada 20s.
 *  De passagem, roda a manutencao de rotina do pool de modelos (poda os aposentados;
 *  throttle interno de 1h, so um GET /models — nao gasta cota com probes). */
export function OfflineSync() {
  useEffect(() => {
    void syncNow();
    void maintain(false);
    const sub = AppState.addEventListener("change", (st) => {
      if (st === "active") {
        void syncNow();
        void maintain(false);
      }
    });
    const iv = setInterval(() => void syncNow(), 20000);
    return () => {
      sub.remove();
      clearInterval(iv);
    };
  }, []);
  return null;
}
