import { useMutation, useQuery } from "@tanstack/react-query";

import { measurementsRepo, profileRepo } from "../db/repos";
import { createLocalMeasurement, deleteLocalMeasurement, saveLocalProfile } from "../offline/outbox";
import type { MeasurementCreate, ProfileUpdate } from "../types";

export function useProfile() {
  return useQuery({ queryKey: ["profile"], queryFn: () => profileRepo.get() });
}

export function useMeasurements() {
  return useQuery({ queryKey: ["measurements"], queryFn: () => measurementsRepo.list() });
}

export function useUpdateProfile() {
  return useMutation({ mutationFn: (data: ProfileUpdate) => saveLocalProfile(data) });
}
export function useCreateMeasurement() {
  return useMutation({ mutationFn: (data: MeasurementCreate) => createLocalMeasurement(data) });
}
export function useDeleteMeasurement() {
  return useMutation({ mutationFn: (id: number) => deleteLocalMeasurement(id) });
}
