import { create } from "zustand";
import { AxiosInstance } from "@/lib/axios";

export const useStatsStore = create((set) => ({
  stats: null,
  isLoading: false,
  error: null,

  // Lấy thống kê theo ngày/tuần/tháng
  fetchStats: async (type = "day") => {
    set({ isLoading: true, error: null });
    try {
      const response = await AxiosInstance.get(`/stats?type=${type}`);
      set({ stats: response.data, isLoading: false });
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Lấy thống kê thất bại";
      set({ error: errorMessage, isLoading: false });
      return null;
    }
  },

  clearError: () => set({ error: null }),
}));
