import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { profileApi } from "../api/profile";
import type { MeasurementCreate, ProfileUpdate } from "../types";

export function useProfile() {
  return useQuery({ queryKey: ["profile"], queryFn: () => profileApi.get() });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ProfileUpdate) => profileApi.update(data),
    onSuccess: (p) => qc.setQueryData(["profile"], p),
  });
}

export function useMeasurements() {
  return useQuery({ queryKey: ["measurements"], queryFn: () => profileApi.measurements() });
}

export function useCreateMeasurement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: MeasurementCreate) => profileApi.createMeasurement(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["measurements"] }),
  });
}

export function useDeleteMeasurement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => profileApi.deleteMeasurement(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["measurements"] }),
  });
}
