import { useEffect, useState } from "react";
import { AxiosInstance } from "@/lib/axios";
import { Car, Database, ParkingSquare, AlertTriangle } from "lucide-react";
import StatsCard from "@/components/dashboard/StatsCard";
import AlertList from "@/components/dashboard/AlertList";
import ActivityList from "@/components/dashboard/ActivityList";
import BarrierStatus from "@/components/dashboard/BarrierStatus";

const DashboardPage = () => {
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, logsRes] = await Promise.all([
          AxiosInstance.get("/stats"),
          AxiosInstance.get("/logs?limit=5"),
        ]);
        setStats(statsRes.data);
        setLogs(logsRes.data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">Loading...</div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-gray-500 text-sm">Tổng quan hệ thống bãi xe</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatsCard
          icon={Car}
          label="Tổng số xe"
          value={stats?.totalLogs || 0}
          sublabel="Trong ngày"
          color="blue"
        />
        <StatsCard
          icon={Database}
          label="Dung lượng"
          value={stats?.occupiedSlots || 0}
          sublabel={`/${stats?.totalSlots || 0} slot`}
          color="green"
        />
        <StatsCard
          icon={ParkingSquare}
          label="Còn trống"
          value={stats?.emptySlots || 0}
          sublabel="Slot trống"
          color="purple"
        />
        <StatsCard
          icon={AlertTriangle}
          label="Cảnh báo"
          value={3}
          sublabel="Chưa xử lý"
          color="red"
        />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <AlertList />
        <ActivityList logs={logs} />
      </div>

      <BarrierStatus />
    </div>
  );
};

export default DashboardPage;
