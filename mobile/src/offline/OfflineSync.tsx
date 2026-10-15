import { useEffect } from "react";
import { AppState } from "react-native";

import { flush } from "./outbox";

/** Dispara a sincronizacao: ao abrir, ao voltar pro 1o plano e a cada 20s. */
export function OfflineSync() {
  useEffect(() => {
    void flush();
    const sub = AppState.addEventListener("change", (st) => {
      if (st === "active") void flush();
    });
    const iv = setInterval(() => void flush(), 20000);
    return () => {
      sub.remove();
      clearInterval(iv);
    };
  }, []);
  return null;
}
