import { useQuery } from "@tanstack/react-query";

import { sessionsRepo } from "../db/repos";

export function useSessionsList() {
  return useQuery({ queryKey: ["sessions"], queryFn: () => sessionsRepo.list() });
}

export function useSession(id: number) {
  return useQuery({
    queryKey: ["session", id],
    queryFn: () => sessionsRepo.detail(id),
    enabled: id > 0,
  });
}
