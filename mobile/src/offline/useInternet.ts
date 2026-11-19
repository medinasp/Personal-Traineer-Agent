import * as Network from "expo-network";
import { useEffect, useState } from "react";
import { AppState } from "react-native";

/** Ha internet pra alcancar a Groq? (o Coach roda no celular, mas o modelo e na nuvem) */
export function useInternet(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const st = await Network.getNetworkStateAsync();
        // isInternetReachable pode vir undefined em alguns aparelhos -> so bloqueia se for explicitamente false
        const ok = !!st.isConnected && st.isInternetReachable !== false;
        if (alive) setOnline(ok);
      } catch {
        if (alive) setOnline(true); // na duvida, deixa tentar
      }
    };
    check();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void check();
    });
    const iv = setInterval(check, 10000);
    return () => {
      alive = false;
      sub.remove();
      clearInterval(iv);
    };
  }, []);

  return online;
}
