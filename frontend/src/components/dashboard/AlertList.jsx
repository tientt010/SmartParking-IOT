import { AlertTriangle, AlertCircle, Info } from "lucide-react";

const alerts = [
  {
    id: 1,
    type: "error",
    message: "Cảm biến #3 mất kết nối",
    time: "5 phút trước",
  },
  {
    id: 2,
    type: "warning",
    message: "Bãi đã 80% công suất",
    time: "15 phút trước",
  },
  {
    id: 3,
    type: "info",
    message: "Phương tiện lạ GD-yxx",
    time: "20 phút trước",
  },
];

const alertStyles = {
  error: {
    bg: "bg-red-50",
    border: "border-red-200",
    icon: AlertTriangle,
    iconColor: "text-red-500",
  },
  warning: {
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    icon: AlertCircle,
    iconColor: "text-yellow-500",
  },
  info: {
    bg: "bg-orange-50",
    border: "border-orange-200",
    icon: Info,
    iconColor: "text-orange-500",
  },
};

const AlertList = () => {
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800">Cảnh báo</h3>
        <span className="text-xs bg-red-500 text-white px-2 py-1 rounded-full">
          New
        </span>
      </div>
      <div className="space-y-3">
        {alerts.map((alert) => {
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
      <button className="w-full text-center text-sm text-blue-600 mt-4">
        Xem tất cả cảnh báo
      </button>
    </div>
  );
};

export default AlertList;
