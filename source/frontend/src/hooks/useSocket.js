import { useEffect, useRef, useCallback, useState } from "react";
import { io } from "socket.io-client";
import toast from "react-hot-toast";

const SOCKET_URL = "http://localhost:3000";

export const useSocket = (options = {}) => {
  const { 
    onLprResult,      // callback kết quả LPR
    onDeviceControl,  // callback lệnh điều khiển
    onSlotUpdate,     // callback slot update
    onExitProcessed,  // callback exit processed
    onSensorStatus,   // callback sensor status (bật/tắt)
    autoRefresh,      // function refresh data
  } = options;

  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    socketRef.current = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
    });

    const socket = socketRef.current;

    socket.on("connect", () => {
      console.log("Socket connected:", socket.id);
      setIsConnected(true);
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected");
      setIsConnected(false);
    });

    socket.on("lpr:result", (data) => {
      console.log("LPR Result:", data);
      
      if (data.action === "accept") {
        toast.success(`Xe ${data.number} được vào bãi`, {
          duration: 4000,
        });
      } else {
        toast.error(`Xe ${data.number} bị từ chối: ${data.reason}`, {
          duration: 5000,
        });
      }

      onLprResult?.(data);
      
      autoRefresh?.();
    });

    socket.on("device:control", (data) => {
      console.log("Device Control:", data);
      
      if (data.action === "Open") {
        toast(`Barrier đang mở...`, {
          duration: 5000,
        });
      }

      onDeviceControl?.(data);
    });

    socket.on("slot:update", (data) => {
      console.log("Slot Update:", data);
      onSlotUpdate?.(data);
      autoRefresh?.();
    });

    socket.on("exit:processed", (data) => {
      console.log("Exit Processed:", data);
      if (data.vehiclePlate) {
        toast.success(`Xe ${data.vehiclePlate} đã ra khỏi slot ${data.slotNumber}`, {
          duration: 4000,
        });
      }
      onExitProcessed?.(data);
      autoRefresh?.();
    });

    socket.on("sensor:status", (data) => {
      console.log("Sensor Status:", data);
      const statusText = data.isActive ? "bật" : "tắt";
      toast(`Sensor ${data.sensorId} đã ${statusText}`, {
        duration: 3000,
        icon: data.isActive ? "🟢" : "🔴",
      });
      onSensorStatus?.(data);
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("lpr:result");
      socket.off("device:control");
      socket.off("slot:update");
      socket.off("exit:processed");
      socket.off("sensor:status");
      socket.disconnect();
    };
  }, [onLprResult, onDeviceControl, onSlotUpdate, onExitProcessed, onSensorStatus, autoRefresh]);

  const emit = useCallback((event, data) => {
    socketRef.current?.emit(event, data);
  }, []);

  return {
    emit,
    isConnected,
  };
};