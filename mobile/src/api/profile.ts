import type { Measurement, MeasurementCreate, Profile, ProfileUpdate } from "../types";
import { api } from "./client";

export const profileApi = {
  get: () => api.get<Profile>("/profile"),
  update: (data: ProfileUpdate) => api.put<Profile>("/profile", data),
  measurements: () => api.get<Measurement[]>("/measurements"),
  createMeasurement: (data: MeasurementCreate) => api.post<Measurement>("/measurements", data),
  deleteMeasurement: (id: number) => api.del(`/measurements/${id}`),
};
