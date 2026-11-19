import { useQuery } from "@tanstack/react-query";

import { sessionsRepo } from "../db/repos";
import type { HistoryQuery } from "../types";

export function useExerciseHistory(exerciseId: number, q: HistoryQuery, enabled = true) {
  return useQuery({
    queryKey: ["history", exerciseId, q],
    queryFn: () => sessionsRepo.history(exerciseId, q.start, q.end, q.limit ?? 50),
    enabled,
  });
}
