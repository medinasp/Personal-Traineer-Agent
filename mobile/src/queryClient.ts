import { QueryClient } from "@tanstack/react-query";

const MONTH = 1000 * 60 * 60 * 24 * 30;

/** Cliente unico, compartilhado entre o app e a camada offline (outbox). */
export const qc = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: MONTH, // mantem no cache p/ persistir e servir offline
      staleTime: 1000 * 60 * 5,
      retry: 1,
      networkMode: "offlineFirst", // usa cache quando sem rede
      refetchOnReconnect: true,
    },
  },
});
