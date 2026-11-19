import { QueryClient } from "@tanstack/react-query";

/**
 * Cliente unico, compartilhado entre o app e a camada local (outbox).
 * As queries leem do SQLite local (fonte da verdade); o React Query e so a
 * camada reativa. `offlineFirst` evita que o RQ pause as queries locais quando
 * o device parece offline — elas resolvem sem rede de qualquer forma.
 */
export const qc = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
      networkMode: "offlineFirst",
      refetchOnReconnect: true,
    },
  },
});
