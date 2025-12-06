import { create } from "zustand";
import { AxiosInstance } from "@/lib/axios";

export const useSensorStore = create((set) => ({
    sensors: [],
    isLoading: false,
    error: null,

    fetchSensorsConfig: async () => {
        set({ isLoading: true, error: null });
        try {
          const res = await AxiosInstance.get("/hardware/sensors");
          set({ sensors: res.data, isLoading: false });
          return res.data;
        } catch (err) {
          const msg = err.response?.data?.error || "Failed to fetch sensor config";
          set({ error: msg, isLoading: false });
          return null;
        }
      },
      
      updateSensorThreshold: async (sensorId, threshold) => {
        set({ isLoading: true, error: null });
        try {
          const res = await AxiosInstance.put(`/hardware/sensor/${sensorId}/config`, {
            threshold,
          });
          
          set((state) => ({
            sensors: state.sensors.map((s) =>
              s.sensorId === sensorId ? { ...s, threshold: res.data.threshold } : s
            ),
            isLoading: false,
          }));
          return res.data;
        } catch (err) {
          const msg = err.response?.data?.error || "Failed to update threshold";
          set({ error: msg, isLoading: false });
          return null;
        }
      },

      clearError: () => set({ error: null }),
}))