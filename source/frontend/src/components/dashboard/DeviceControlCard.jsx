import { useEffect, useRef } from "react";
import { DoorOpen, DoorClosed, Loader2 } from "lucide-react";
import { useGateStore } from "@/store/useGateStore";
import { io } from "socket.io-client";

const SOCKET_URL = "http://localhost:3000";

const GateControl = ({ gateId, label, status, loading, onControl }) => {
  return (
    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
      <h4 className="text-sm font-semibold text-gray-700 mb-3">{label}</h4>

      <div className="flex items-center gap-2 mb-3">
        <div
          className={`w-3 h-3 rounded-full ${
            status === "open" ? "bg-green-500 animate-pulse" : "bg-red-500"
          }`}
        />
        <span className="text-xs text-gray-600">
          {status === "open" ? "Đang mở" : "Đã đóng"}
        </span>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onControl(gateId, "Open")}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 text-sm"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <DoorOpen className="w-4 h-4" />
          )}
          Mở
        </button>

        <button
          onClick={() => onControl(gateId, "Close")}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 text-sm"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <DoorClosed className="w-4 h-4" />
          )}
          Đóng
        </button>
      </div>
    </div>
  );
};

const DeviceControlCard = () => {
  const { gates, isLoading, fetchGateStatus, controlGate, updateGateStatus } =
    useGateStore();
  const socketRef = useRef(null);

  useEffect(() => {
    fetchGateStatus();
  }, [fetchGateStatus]);

  useEffect(() => {
    socketRef.current = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
    });

    const socket = socketRef.current;

    socket.on("connect", () => {
      console.log("[DeviceControl] Socket connected");
    });

    socket.on("gate:status", (data) => {
      console.log("[DeviceControl] Gate status received:", data);
      if (data.gateId && data.status) {
        updateGateStatus(data.gateId, data.status, data.ts, data.iso);
      }
    });

    return () => {
      socket.off("connect");
      socket.off("gate:status");
      socket.disconnect();
    };
  }, [updateGateStatus]);

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        Điều khiển Cửa
      </h3>

      <div className="grid grid-cols-2 gap-4">
        <GateControl
          gateId="gate1"
          label="Cửa vào (Gate 1)"
          status={gates.gate1?.status || "closed"}
          loading={isLoading.gate1}
          onControl={controlGate}
        />
        <GateControl
          gateId="gate2"
          label="Cửa ra (Gate 2)"
          status={gates.gate2?.status || "closed"}
          loading={isLoading.gate2}
          onControl={controlGate}
        />
      </div>
    </div>
  );
};

export default DeviceControlCard;