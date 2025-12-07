import { useCallback, useEffect } from "react";
import { Car, Database, ParkingSquare, AlertTriangle } from "lucide-react";
import StatsCard from "@/components/dashboard/StatsCard";
import AlertList from "@/components/dashboard/AlertList";
import ActivityList from "@/components/dashboard/ActivityList";
import { useStatsStore } from "@/store/useStatsStore";
import { useLogStore } from "@/store/useLogStore";
import { useSlotStore } from "@/store/useSlotStore";
import { useSocket } from "../hooks/useSocket";
import DeviceControlCard from "../components/dashboard/DeviceControlCard";

const DashboardPage = () => {
  const { stats, isLoading: statsLoading, error, fetchStats } = useStatsStore();
  const { logs, isLoading: logsLoading, fetchLogs } = useLogStore();
  const { fetchSlots, getSlotCounts, updateSlot } = useSlotStore();

  const refreshData = useCallback(() => {
    fetchStats("day");
    fetchLogs({limit: 4});
    fetchSlots();
  }, [fetchStats, fetchLogs, fetchSlots]);

  useSocket({
    autoRefresh: refreshData,
    onLprResult: (data) => {
      console.log("Dashboard received LPR:", data);
    },
    onSlotUpdate: (data) => {
      updateSlot(data.slotNumber, data.status);
    },
  });

  const { empty, occupied, total } = getSlotCounts();
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center h-full">Loading...</div>
    );
  }

  if (error) return <div className="text-red-500 text-sm">{error}</div>;

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
          value={occupied || 0}
          sublabel={`/${total || 0} slot`}
          color="green"
        />
        <StatsCard
          icon={ParkingSquare}
          label="Còn trống"
          value={empty || 0}
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

      <div className="grid grid-cols-3 gap-4 mb-6">
        <DeviceControlCard />
        <AlertList />
        <ActivityList logs={logs} isLoading={logsLoading} />
      </div>
    </div>
  );
};

export default DashboardPage;
