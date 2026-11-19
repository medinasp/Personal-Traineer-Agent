import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";

import { hideRestNotification, showRestNotification } from "./restNotification";

const BG_LIMIT_MS = 5 * 60 * 1000; // 5 min em segundo plano => para sozinho

interface RestTimerValue {
  elapsed: number; // segundos
  running: boolean;
  toggle: () => void;
  stop: () => void;
}

const Ctx = createContext<RestTimerValue | null>(null);

/**
 * Cronometro de descanso GLOBAL: nao para ao sair da tela.
 * Tempo derivado de timestamp (preciso mesmo em background).
 * Se ficar >= 5 min em segundo plano sem ser parado, para sozinho no marco dos 5 min.
 */
export function RestTimerProvider({ children }: { children: ReactNode }) {
  const [running, setRunning] = useState(false);
  const [accumulated, setAccumulated] = useState(0); // segundos ja contados (antes do trecho atual)
  const startedAt = useRef<number | null>(null); // epoch ms do inicio do trecho atual
  const bgAt = useRef<number | null>(null);
  const [, tick] = useState(0); // forca re-render p/ atualizar o display

  // tick de UI enquanto roda
  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => tick((x) => x + 1), 500);
    return () => clearInterval(iv);
  }, [running]);

  // limite de 5 min em background
  useEffect(() => {
    const sub = AppState.addEventListener("change", (st) => {
      if (st === "background" || st === "inactive") {
        if (running) bgAt.current = Date.now();
      } else if (st === "active") {
        if (running && bgAt.current != null) {
          const bgMs = Date.now() - bgAt.current;
          if (bgMs >= BG_LIMIT_MS) {
            // parou sozinho no marco dos 5 min
            const stopAt = bgAt.current + BG_LIMIT_MS;
            const total = accumulated + Math.floor((stopAt - (startedAt.current ?? stopAt)) / 1000);
            setAccumulated(total);
            startedAt.current = null;
            setRunning(false);
            void hideRestNotification();
          }
          bgAt.current = null;
        }
      }
    });
    return () => sub.remove();
  }, [running, accumulated]);

  const elapsed =
    accumulated +
    (running && startedAt.current ? Math.floor((Date.now() - startedAt.current) / 1000) : 0);

  function toggle() {
    if (running) {
      const now = Date.now();
      setAccumulated((a) => a + Math.floor((now - (startedAt.current ?? now)) / 1000));
      startedAt.current = null;
      setRunning(false);
      void hideRestNotification();
    } else {
      startedAt.current = Date.now();
      setRunning(true);
      // timestamp = "zero" do cronometro = agora menos o que ja foi acumulado
      void showRestNotification(Date.now() - accumulated * 1000);
    }
  }
  function stop() {
    startedAt.current = null;
    setAccumulated(0);
    setRunning(false);
    void hideRestNotification();
  }

  return <Ctx.Provider value={{ elapsed, running, toggle, stop }}>{children}</Ctx.Provider>;
}

export function useRestTimer(): RestTimerValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useRestTimer fora do RestTimerProvider");
  return v;
}
