import { create } from "zustand";
import { AxiosInstance } from "@/lib/axios";

export const useWhitelistStore = create((set) => ({
  whitelist: [],
  isLoading: false,
  error: null,

  // Lấy danh sách whitelist với filter
  fetchWhitelist: async (params = {}) => {
    set({ isLoading: true, error: null });
    try {
      const queryParams = new URLSearchParams();
      
      if (params.status) queryParams.append("status", params.status);
      if (params.vehiclePlate) queryParams.append("vehiclePlate", params.vehiclePlate);
      if (params.limit) queryParams.append("limit", params.limit);

      const query = queryParams.toString();
      const response = await AxiosInstance.get(`/whitelist${query ? `?${query}` : ""}`);
      set({ whitelist: response.data, isLoading: false });
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Lấy whitelist thất bại";
      set({ error: errorMessage, isLoading: false });
      return null;
    }
  },

  // Thêm mới vào whitelist
  createWhitelist: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await AxiosInstance.post("/whitelist", data);
      // Thêm vào đầu danh sách
      set((state) => ({
        whitelist: [response.data, ...state.whitelist],
        isLoading: false,
      }));
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Thêm whitelist thất bại";
      set({ error: errorMessage, isLoading: false });
      return null;
    }
  },

  // Cập nhật whitelist
  updateWhitelist: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await AxiosInstance.put(`/whitelist/${id}`, data);
      // Cập nhật trong danh sách
      set((state) => ({
        whitelist: state.whitelist.map((item) =>
          item._id === id ? response.data : item
        ),
        isLoading: false,
      }));
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Cập nhật thất bại";
      set({ error: errorMessage, isLoading: false });
      return null;
    }
  },

  // Xóa khỏi whitelist (soft delete mặc định)
  deleteWhitelist: async (id, hardDelete = false) => {
    set({ isLoading: true, error: null });
    try {
      await AxiosInstance.delete(`/whitelist/${id}${hardDelete ? "?hardDelete=true" : ""}`);
      
      if (hardDelete) {
        // Xóa khỏi danh sách
        set((state) => ({
          whitelist: state.whitelist.filter((item) => item._id !== id),
          isLoading: false,
        }));
      } else {
        // Cập nhật status thành inactive
        set((state) => ({
          whitelist: state.whitelist.map((item) =>
            item._id === id ? { ...item, status: "inactive" } : item
          ),
          isLoading: false,
        }));
      }
      return true;
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Xóa thất bại";
      set({ error: errorMessage, isLoading: false });
      return false;
    }
  },

  clearError: () => set({ error: null }),
}));
