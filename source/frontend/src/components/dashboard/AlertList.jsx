import { AlertTriangle, AlertCircle, Info, XCircle } from "lucide-react";
import { useLogStore } from "@/store/useLogStore";
import { useSlotStore } from "@/store/useSlotStore";

const alertStyles = {
  error: {
    bg: "bg-red-50",
    border: "border-red-200",
    icon: XCircle,
    iconColor: "text-red-500",
  },
  warning: {
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    icon: AlertTriangle,
    iconColor: "text-yellow-500",
  },
  info: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    icon: Info,
    iconColor: "text-blue-500",
  },
};

const AlertList = () => {
  const { logs } = useLogStore();
  const { getSlotCounts } = useSlotStore();
  const { empty, total } = getSlotCounts();

  const alerts = [];

  const deniedLogs = logs.filter((log) => log.status === "denied").slice(0, 3);
  deniedLogs.forEach((log) => {
    alerts.push({
      id: `denied-${log._id}`,
      type: "error",
      message: `Xe ${log.vehiclePlate} bị từ chối vào bãi`,
      time: formatTime(log.createdAt),
    });
  });

  if (total > 0 && empty / total <= 0.2) {
    alerts.push({
      id: "capacity-warning",
      type: "warning",
      message: `Bãi xe đã ${Math.round(((total - empty) / total) * 100)}% công suất`,
      time: "Hiện tại",
    });
  }

  if (total > 0 && empty === 0) {
    alerts.push({
      id: "capacity-full",
      type: "error",
      message: "Bãi xe đã đầy!",
      time: "Hiện tại",
    });
  }

  return (
    <div className="bg-white rounded-xl p-4 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800">Cảnh báo</h3>
        {alerts.length > 0 && (
          <span className="text-xs bg-red-500 text-white px-2 py-1 rounded-full">
            {alerts.length}
          </span>
        )}
      </div>
      
      {alerts.length === 0 ? (
        <div className="text-center py-6 text-gray-400">
          <Info className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm">Không có cảnh báo</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.slice(0, 5).map((alert) => {
            const style = alertStyles[alert.type];
            const Icon = style.icon;
            return (
              <div
                key={alert.id}
                className={`${style.bg} ${style.border} border rounded-lg p-3 flex items-start gap-3`}
              >
                <Icon className={`w-5 h-5 ${style.iconColor} mt-0.5`} />
                <div className="flex-1">
                  <p className="text-sm text-gray-800">{alert.message}</p>
                  <p className="text-xs text-gray-500 mt-1">{alert.time}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {alerts.length > 5 && (
        <button className="w-full text-center text-sm text-blue-600 mt-4 hover:underline">
          Xem tất cả ({alerts.length})
        </button>
      )}
    </div>
  );
};

const formatTime = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return "Vừa xong";
  if (diffMins < 60) return `${diffMins} phút trước`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)} giờ trước`;
  return date.toLocaleDateString("vi-VN");
};

export default AlertList;