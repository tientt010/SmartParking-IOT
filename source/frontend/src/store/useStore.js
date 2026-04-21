import { create } from "zustand";
import { io } from "socket.io-client";
import api from "../api/api.js";

const SOCKET_URL = import.meta.env.VITE_API_URL || "";

let socket = null;

export const useStore = create((set, get) => ({
  // ── Auth ─────────────────────────────────────────────────────
  user: null,
  token: localStorage.getItem("sp_token"),
  isAuthenticated: !!localStorage.getItem("sp_token"),

  login: async (username, password) => {
    const { data } = await api.post("/auth/login", { username, password });
    localStorage.setItem("sp_token", data.token);
    set({ token: data.token, user: data.user, isAuthenticated: true });
    get().initSocket();
  },

  logout: () => {
    localStorage.removeItem("sp_token");
    socket?.disconnect();
    socket = null;
    set({ token: null, user: null, isAuthenticated: false, slots: [], liveEvents: [] });
  },

  // ── Real-time data ────────────────────────────────────────────
  slots: [],
  stats: null,
  gateStatus: { gate1: "closed", gate2: "closed" },
  liveEvents: [],   // recent LPR results (max 10)
  connected: false,

  setSlots: (slots) => set({ slots }),
  setStats: (stats) => set({ stats }),

  // ── Socket.IO ─────────────────────────────────────────────────
  initSocket: () => {
    if (socket?.connected) return;
    socket = io(SOCKET_URL, { transports: ["websocket"] });

    socket.on("connect", () => {
      console.log("[Socket] Connected");
      set({ connected: true });
    });
    socket.on("disconnect", () => set({ connected: false }));

    // Parking slot update
    socket.on("slot:update", ({ slotNumber, status }) => {
      set((state) => ({
        slots: state.slots.map((s) =>
          s.slotNumber === slotNumber ? { ...s, status } : s
        ),
      }));
    });

    // Camera đang quét biển - toast info
    socket.on("lpr:scanning", ({ gate, plate }) => {
      const label = gate === "entry" ? "Đầu vào" : "Đầu ra";
      get().showToast(`📷 [${label}] Nhận diện biển ${plate}...`, "info");
    });

    // Kết quả nhận diện
    socket.on("lpr:result", (event) => {
      const { action, plate, gate, reason, fee, durationSec, balance, balanceAfter, name } = event;
      const label = gate === "entry" ? "Vào" : "Ra";
      if (action === "accept" && gate === "entry") {
        get().showToast(`✅ Xe ${plate} (${name || ""}) được phép VÀO — Số dư: ${balance?.toLocaleString("vi")} đ`, "success");
      } else if (action === "accept" && gate === "exit") {
        get().showToast(`✅ Xe ${plate} ĐÃ RA — Phí: ${fee?.toLocaleString("vi")}đ (${durationSec}s) — Còn: ${balanceAfter?.toLocaleString("vi")}đ`, "success");
      } else {
        get().showToast(`❌ [${label}] Từ chối ${plate}: ${reason}`, "error");
      }

      set((state) => ({
        liveEvents: [{ ...event, time: new Date().toISOString() }, ...state.liveEvents].slice(0, 20),
      }));
    });

    // Gate status update
    socket.on("gate:status", ({ gateId, status }) => {
      if (!gateId) return;
      set((state) => ({
        gateStatus: { ...state.gateStatus, [gateId]: status },
      }));
    });

    // Exit event
    socket.on("parking:exit", ({ plate, fee }) => {
      // Đã xử lý ở lpr:result rồi, không cần toast thêm
    });
  },

  // ── Toast ─────────────────────────────────────────────────────
  toasts: [],
  showToast: (message, type = "info") => {
    const id = Date.now();
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3500);
  },
}));
