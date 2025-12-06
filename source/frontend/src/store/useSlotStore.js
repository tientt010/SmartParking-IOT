import { create } from "zustand";
import { AxiosInstance } from "@/lib/axios";

export const useSlotStore = create((set, get) => ({
  slots: [],
  isLoading: false,
  error: null,

  fetchSlots: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await AxiosInstance.get("/slots");
      set({ slots: response.data, isLoading: false });
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Fetch slots failed";
      set({ error: errorMessage, isLoading: false });
      return null;
    }
  },

  getSlotCounts: () => {
    const { slots } = get();
    const empty = slots.filter((s) => s.status === "empty").length;
    const occupied = slots.filter((s) => s.status === "occupied").length;
    return { empty, occupied, total: slots.length };
  },

  clearError: () => set({ error: null }),
}));
