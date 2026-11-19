import { useEffect } from "react";
import { AppState } from "react-native";

import { syncNow } from "../db/sync";

/** Sincroniza o banco local com o backend: ao abrir, ao voltar pro 1o plano e a cada 20s. */
export function OfflineSync() {
  useEffect(() => {
    void syncNow();
    const sub = AppState.addEventListener("change", (st) => {
      if (st === "active") void syncNow();
    });
    const iv = setInterval(() => void syncNow(), 20000);
    return () => {
      sub.remove();
      clearInterval(iv);
    };
  }, []);
  return null;
}
