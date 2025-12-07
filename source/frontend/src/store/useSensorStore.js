import { create } from "zustand";
import { AxiosInstance } from "@/lib/axios";

export const useSensorStore = create((set) => ({
    sensors: [],
    isLoading: false,
    error: null,

    fetchSensors: async () => {
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
        try {
          const res = await AxiosInstance.put(`/hardware/sensor/${sensorId}`, {
            threshold,
          });
          
          set((state) => ({
            sensors: state.sensors.map((s) =>
              s.sensorId === sensorId ? { ...s, threshold: res.data.threshold } : s
            ),
          }));
          return res.data;
        } catch (err) {
          const msg = err.response?.data?.error || "Failed to update threshold";
          throw new Error(msg);
        }
      },

      // Update local state (chưa save)
      setLocalThreshold: (sensorId, threshold) => {
        set((state) => ({
          sensors: state.sensors.map((s) =>
            s.sensorId === sensorId ? { ...s, threshold } : s
          ),
        }));
      },

      clearError: () => set({ error: null }),
}))