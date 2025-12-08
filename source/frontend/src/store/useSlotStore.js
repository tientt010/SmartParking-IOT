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
    // Chỉ đếm các slot không bảo trì
    const activeSlots = slots.filter((s) => !s.isMaintenance);
    const empty = activeSlots.filter((s) => s.status === "empty").length;
    const occupied = activeSlots.filter((s) => s.status === "occupied").length;
    const maintenance = slots.filter((s) => s.isMaintenance).length;
    return { empty, occupied, maintenance, total: slots.length };
  },

  // Toggle sensor isActive status
  toggleSensorStatus: async (slotNumber, isActive) => {
    try {
      const response = await AxiosInstance.patch(`/slots/${slotNumber}/sensor`, {
        isActive,
      });
      // Cập nhật local state
      set((state) => ({
        slots: state.slots.map((slot) =>
          slot.slotNumber === slotNumber
            ? {
                ...slot,
                isMaintenance: !isActive,
                maintenanceReason: isActive ? null : "Đã tắt bởi admin",
                sensor: slot.sensor ? { ...slot.sensor, isActive } : null,
              }
            : slot
        ),
      }));
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Toggle sensor failed";
      set({ error: errorMessage });
      return null;
    }
  },

  // Cập nhật slot từ socket event
  updateSlot: (slotNumber, status, vehiclePlate = null, entryTime = null, exitTime = null) => {
    set((state) => ({
      slots: state.slots.map((slot) =>
        slot.slotNumber === slotNumber
          ? {
              ...slot,
              status,
              vehiclePlate: vehiclePlate !== undefined ? vehiclePlate : slot.vehiclePlate,
              entryTime: entryTime !== undefined ? entryTime : slot.entryTime,
              exitTime: exitTime !== undefined ? exitTime : slot.exitTime,
            }
          : slot
      ),
    }));
  },

  // Cập nhật sensor status từ socket event
  updateSensorStatus: (slotNumber, isActive) => {
    set((state) => ({
      slots: state.slots.map((slot) =>
        slot.slotNumber === slotNumber
          ? {
              ...slot,
              isMaintenance: !isActive,
              maintenanceReason: isActive ? null : "Đã tắt bởi admin",
              sensor: slot.sensor ? { ...slot.sensor, isActive } : null,
            }
          : slot
      ),
    }));
  },

  clearError: () => set({ error: null }),
}));
