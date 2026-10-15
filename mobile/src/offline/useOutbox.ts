import { useEffect, useState } from "react";

import { backendUp, queueLength, subscribeOutbox } from "./outbox";

/** Pendencias na fila + status de conexao com o backend. */
export function useOutbox(): { pending: number; online: boolean } {
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      const n = await queueLength();
      if (alive) setPending(n);
    };
    refresh();
    const unsub = subscribeOutbox(refresh);
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      const up = await backendUp();
      if (alive) setOnline(up);
    };
    check();
    const iv = setInterval(check, 15000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, []);

  return { pending, online };
}
