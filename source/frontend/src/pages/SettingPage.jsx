import { useEffect, useState } from "react";
import { Settings, Save, RefreshCw, Loader2, Gauge } from "lucide-react";
import { AxiosInstance } from "@/lib/axios";
import toast from "react-hot-toast";
import { useSensorStore } from "../store/useSensorStore";

const SettingsPage = () => {
    
    const { 
        sensors, 
        isLoading, 
        fetchSensors, 
        updateSensorThreshold,
        setLocalThreshold 
    } = useSensorStore();
    
  const [isSaving, setIsSaving] = useState(false);
  useEffect(() => {
    fetchSensors();
  }, [fetchSensors]);

  const handleThresholdChange = (sensorId, value) => {
    setLocalThreshold(sensorId, parseInt(value) || 0);
  };

  const handleSaveSensor = async (sensor) => {
    setIsSaving(true);
    try {
      await updateSensorThreshold(sensor.sensorId, sensor.threshold);
      toast.success(`Đã lưu cấu hình ${sensor.sensorId}!`);
    } catch (error) {
      toast.error(`Lỗi: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Save all sensors
  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      await Promise.all(
        sensors.map((sensor) =>
          updateSensorThreshold(sensor.sensorId, sensor.threshold)
        )
      );
      toast.success("Đã lưu tất cả cấu hình!");
    } catch (error) {
      toast.error("Lỗi lưu cấu hình!", error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusColor = (status) => {
    return status === 1 ? "bg-red-500" : "bg-green-500";
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Cài đặt hệ thống</h1>
          <p className="text-gray-500 text-sm mt-1">
            Cấu hình sensors và các thông số hệ thống
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchSensors}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Làm mới
          </button>
          <button
            onClick={handleSaveAll}
            disabled={isSaving || sensors.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition cursor-pointer disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Lưu tất cả
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Gauge className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-800">Cấu hình Sensors</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Điều chỉnh ngưỡng khoảng cách (threshold) để xác định có xe hay không. 
          Nếu khoảng cách đo được &lt; threshold → Có xe (occupied).
        </p>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : sensors.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Chưa có sensor nào được cấu hình
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {sensors.map((sensor) => (
              <div
                key={sensor.sensorId}
                className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-800">
                      {sensor.sensorId}
                    </span>
                    <span className="text-sm text-gray-500">
                      → {sensor.slotNumber}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(sensor.currentStatus)}`} />
                    <span className="text-xs text-gray-500">
                      {sensor.currentStatus === 1 ? "Có xe" : "Trống"}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Khoảng cách hiện tại:</span>
                    <span className="font-mono text-gray-800">
                      {sensor.currentDistance ?? "-"} cm
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-500 whitespace-nowrap">
                      Threshold:
                    </label>
                    <input
                      type="number"
                      min="10"
                      max="200"
                      value={sensor.threshold}
                      onChange={(e) => handleThresholdChange(sensor.sensorId, e.target.value)}
                      className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                    <span className="text-sm text-gray-500">cm</span>
                  </div>
                </div>

                <button
                  onClick={() => handleSaveSensor(sensor)}
                  disabled={isSaving}
                  className="mt-3 w-full px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition cursor-pointer"
                >
                  Lưu
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h3 className="font-medium text-blue-800 mb-2">Hướng dẫn</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• <strong>Threshold</strong>: Ngưỡng khoảng cách để xác định có xe (10-200 cm)</li>
          <li>• Nếu khoảng cách đo được &lt; threshold → Slot đang có xe</li>
          <li>• Nếu khoảng cách đo được ≥ threshold → Slot trống</li>
          <li>• Giá trị mặc định: 50 cm</li>
        </ul>
      </div>
    </div>
  );
};

export default SettingsPage;