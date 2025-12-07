import { create } from "zustand";
import { AxiosInstance } from "@/lib/axios";
import toast from "react-hot-toast";

export const useGateStore = create((set, get) => ({
  gates: {
    gate1: { status: "closed", ts: null, iso: null },
    gate2: { status: "closed", ts: null, iso: null },
  },
  isLoading: { gate1: false, gate2: false },
  error: null,

  fetchGateStatus: async () => {
    set({ error: null });
    try {
      const res = await AxiosInstance.get("/device/status");
      if (res.data.gates) {
        set({
          gates: {
            gate1: res.data.gates.gate1 || { status: "closed", ts: null, iso: null },
            gate2: res.data.gates.gate2 || { status: "closed", ts: null, iso: null },
          },
        });
      }
      return res.data.gates;
    } catch (err) {
      const msg = err.response?.data?.error || "Failed to fetch gate status";
      set({ error: msg });
      console.error("Fetch gate status error:", err);
      return null;
    }
  },

  controlGate: async (gateId, action) => {
    const { isLoading } = get();
    set({
      isLoading: { ...isLoading, [gateId]: true },
      error: null,
    });

    try {
      await AxiosInstance.post("/device/control", {
        action, // "Open" | "Close"
        gateId, // "gate1" | "gate2"
      });

      const { gates } = get();
      set({
        gates: {
          ...gates,
          [gateId]: {
            ...gates[gateId],
            status: action === "Open" ? "open" : "closed",
          },
        },
        isLoading: { ...isLoading, [gateId]: false },
      });

      const gateLabel = gateId === "gate1" ? "Cửa vào" : "Cửa ra";
      toast.success(`${gateLabel} đã ${action === "Open" ? "mở" : "đóng"}!`);
      return true;
    } catch (err) {
      const msg = err.response?.data?.error || "Failed to control gate";
      set({
        error: msg,
        isLoading: { ...isLoading, [gateId]: false },
      });

      const gateLabel = gateId === "gate1" ? "Cửa vào" : "Cửa ra";
      toast.error(`Lỗi điều khiển ${gateLabel}!`);
      console.error("Control gate error:", err);
      return false;
    }
  },

  updateGateStatus: (gateId, status, ts, iso) => {
    const { gates } = get();
    set({
      gates: {
        ...gates,
        [gateId]: {
          status,
          ts,
          iso,
        },
      },
    });
  },

  clearError: () => set({ error: null }),
}));

