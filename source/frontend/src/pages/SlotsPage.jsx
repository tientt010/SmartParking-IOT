import { useEffect, useState } from "react";
import { useSlotStore } from "@/store/useSlotStore";
import { useSocket } from "@/hooks/useSocket";
import { RefreshCw, Filter, Loader2, Car, ParkingSquare } from "lucide-react";

const SlotsPage = () => {
  const { slots, isLoading, error, fetchSlots, getSlotCounts, updateSlot } = useSlotStore();
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  useSocket({
    onSlotUpdate: (data) => {
      updateSlot(data.slotNumber, data.status);
    },
    autoRefresh: fetchSlots,
  });

  const handleRefresh = () => {
    fetchSlots();
  };

  const filteredSlots = statusFilter
    ? slots.filter((slot) => slot.status === statusFilter)
    : slots;

  const { empty, occupied, total } = getSlotCounts();

  const formatDateTime = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Quản lý Slot</h1>
          <p className="text-gray-500 text-sm mt-1">
            Trạng thái các slot trong bãi xe
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-5 h-5 ${isLoading ? "animate-spin" : ""}`} />
          Làm mới
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Tổng số slot</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{total}</p>
            </div>
            <ParkingSquare className="w-10 h-10 text-gray-400" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Đã sử dụng</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">{occupied}</p>
            </div>
            <Car className="w-10 h-10 text-orange-400" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Còn trống</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{empty}</p>
            </div>
            <ParkingSquare className="w-10 h-10 text-green-400" />
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
        <div className="flex items-end gap-4">
          <div className="flex flex-col flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Lọc theo trạng thái
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
            >
              <option value="">Tất cả</option>
              <option value="empty">Trống</option>
              <option value="occupied">Đã sử dụng</option>
            </select>
          </div>
          <div className="flex flex-col">
            <label className="block text-sm font-medium text-gray-700 mb-1.5 opacity-0">
              Xóa bộ lọc
            </label>
            <button
              onClick={() => setStatusFilter("")}
              className="px-4 py-2.5 bg-[#bb2124] text-white rounded-lg hover:bg-[#bb2124]/80 transition font-medium cursor-pointer whitespace-nowrap"
            >
              Xóa bộ lọc
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 bg-white rounded-lg shadow-sm">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      ) : error ? (
        <div className="p-4 bg-white rounded-lg shadow-sm text-red-500 text-sm">
          {error}
        </div>
      ) : filteredSlots.length === 0 ? (
        <div className="p-8 bg-white rounded-lg shadow-sm text-center text-gray-500">
          Không có dữ liệu
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredSlots.map((slot) => (
            <div
              key={slot._id}
              className={`bg-white rounded-lg shadow-sm p-4 border-2 transition ${
                slot.status === "occupied"
                  ? "border-orange-200 bg-orange-50"
                  : "border-green-200 bg-green-50"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-gray-800">
                  {slot.slotNumber}
                </h3>
                {slot.status === "occupied" ? (
                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-700">
                    Đã sử dụng
                  </span>
                ) : (
                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700">
                    Trống
                  </span>
                )}
              </div>

              {slot.status === "occupied" && (
                <div className="space-y-2 mt-4 pt-4 border-t border-gray-200">
                  <div>
                    <p className="text-xs text-gray-500">Biển số xe</p>
                    <p className="text-sm font-semibold text-gray-800">
                      {slot.vehiclePlate || "-"}
                    </p>
                  </div>
                  {slot.entryTime && (
                    <div>
                      <p className="text-xs text-gray-500">Thời gian vào</p>
                      <p className="text-sm text-gray-700">
                        {formatDateTime(slot.entryTime)}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {slot.status === "empty" && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-center py-2">
                    <ParkingSquare className="w-8 h-8 text-green-400" />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {filteredSlots.length > 0 && (
        <div className="mt-4 text-sm text-gray-500 text-center">
          Hiển thị {filteredSlots.length} / {total} slot
        </div>
      )}
    </div>
  );
};

export default SlotsPage;

