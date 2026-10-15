import { useQuery } from "@tanstack/react-query";

import { exercisesApi } from "../api/exercises";
import type { HistoryQuery } from "../types";

export function useExerciseHistory(
  exerciseId: number,
  q: HistoryQuery,
  enabled = true,
) {
  return useQuery({
    queryKey: ["history", exerciseId, q],
    queryFn: () => exercisesApi.history(exerciseId, q),
    enabled,
  });
}
