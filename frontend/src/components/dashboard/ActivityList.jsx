import { LogIn, LogOut } from "lucide-react";

const ActivityList = ({ logs }) => {
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-200">
      <h3 className="font-semibold text-gray-800 mb-4">Hoạt động gần đây</h3>
      <div className="space-y-3">
        {logs.map((log) => (
          <div key={log._id} className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                log.action === "entry" ? "bg-green-100" : "bg-blue-100"
              }`}
            >
              {log.action === "entry" ? (
                <LogIn className="w-4 h-4 text-green-600" />
              ) : (
                <LogOut className="w-4 h-4 text-blue-600" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">
                {log.vehiclePlate}
              </p>
              <p className="text-xs text-gray-500">
                {log.action === "entry" ? "Xe vào" : "Xe ra"} • Slot{" "}
                {log.slot?.slotNumber || "-"}
              </p>
            </div>
            <span className="text-xs text-gray-400">
              {new Date(log.createdAt).toLocaleTimeString("vi-VN", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ActivityList;
