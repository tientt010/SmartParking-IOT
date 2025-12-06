import { useEffect, useState } from "react";
import { useLogStore } from "@/store/useLogStore";
import { Search, Filter, Loader2, ArrowUpCircle, ArrowDownCircle, CheckCircle, XCircle } from "lucide-react";

const LogsPage = () => {
  const { logs, isLoading, error, fetchLogs } = useLogStore();

  const [filters, setFilters] = useState({
    vehiclePlate: "",
    action: "",
    startDate: "",
    endDate: "",
    limit: 50,
  });

  useEffect(() => {
    fetchLogs({ limit: filters.limit });
  }, [fetchLogs]);

  const handleFilter = () => {
    const params = {};
    if (filters.vehiclePlate) params.vehiclePlate = filters.vehiclePlate;
    if (filters.action) params.action = filters.action;
    if (filters.startDate) params.startDate = filters.startDate;
    if (filters.endDate) params.endDate = filters.endDate;
    if (filters.limit) params.limit = filters.limit;
    fetchLogs(params);
  };

  const handleReset = () => {
    setFilters({
      vehiclePlate: "",
      action: "",
      startDate: "",
      endDate: "",
      limit: 50,
    });
    fetchLogs({ limit: 50 });
  };

  const getActionBadge = (action) => {
    if (action === "entry") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">
          <ArrowUpCircle className="w-3 h-3" />
          Vào
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-700">
        <ArrowDownCircle className="w-3 h-3" />
        Ra
      </span>
    );
  };

  const getStatusBadge = (status) => {
    if (status === "accepted") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700">
          <CheckCircle className="w-3 h-3" />
          Chấp nhận
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-700">
        <XCircle className="w-3 h-3" />
        Từ chối
      </span>
    );
  };

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
          <h1 className="text-2xl font-bold text-gray-800">Nhật ký hoạt động</h1>
          <p className="text-gray-500 text-sm mt-1">
            Lịch sử ra/vào của các phương tiện
          </p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
        <div className="grid grid-cols-5 gap-4 items-end">
          <div className="flex flex-col">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Tìm kiếm biển số
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Nhập biển số..."
                value={filters.vehiclePlate}
                onChange={(e) =>
                  setFilters({ ...filters, vehiclePlate: e.target.value })
                }
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Loại hành động
            </label>
            <select
              value={filters.action}
              onChange={(e) => setFilters({ ...filters, action: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
            >
              <option value="">Tất cả</option>
              <option value="entry">Vào</option>
              <option value="exit">Ra</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Từ ngày
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) =>
                setFilters({ ...filters, startDate: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>

          <div className="flex flex-col">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Đến ngày
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) =>
                setFilters({ ...filters, endDate: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={handleFilter}
                className="flex-1 px-4 py-2 bg-[#22bb33] text-white rounded-lg hover:bg-[#22bb33]/80 transition font-medium cursor-pointer flex items-center justify-center gap-2"
              >
                <Filter className="w-4 h-4" />
                Lọc
              </button>
              <button
                onClick={handleReset}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition cursor-pointer"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : error ? (
          <div className="p-4 text-red-500 text-sm">{error}</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Không có dữ liệu
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Thời gian
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Biển số
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Hành động
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Slot
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Trạng thái
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {logs.map((log) => (
                  <tr key={log._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatDateTime(log.createdAt)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-semibold text-gray-900">
                        {log.vehiclePlate || "-"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getActionBadge(log.action)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                      {log.slot?.slotNumber || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(log.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {logs.length > 0 && (
        <div className="mt-4 text-sm text-gray-500 text-center">
          Hiển thị {logs.length} log
        </div>
      )}
    </div>
  );
};

export default LogsPage;

