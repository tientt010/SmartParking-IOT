import { create } from "zustand";
import { AxiosInstance } from "@/lib/axios";

export const useLogStore = create((set) => ({
  logs: [],
  isLoading: false,
  error: null,

  // Lấy danh sách logs với filter
  fetchLogs: async (params = {}) => {
    set({ isLoading: true, error: null });
    try {
      const queryParams = new URLSearchParams();
      
      if (params.vehiclePlate) queryParams.append("vehiclePlate", params.vehiclePlate);
      if (params.action) queryParams.append("action", params.action);
      if (params.startDate) queryParams.append("startDate", params.startDate);
      if (params.endDate) queryParams.append("endDate", params.endDate);
      if (params.limit) queryParams.append("limit", params.limit);

      const query = queryParams.toString();
      const response = await AxiosInstance.get(`/logs${query ? `?${query}` : ""}`);
      set({ logs: response.data, isLoading: false });
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Lấy logs thất bại";
      set({ error: errorMessage, isLoading: false });
      return null;
    }
  },

  clearError: () => set({ error: null }),
}));
