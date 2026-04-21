import { useEffect, useState } from "react";
import api from "../api/api.js";
import { useStore } from "../store/useStore.js";

export default function LogsPage() {
  const { showToast } = useStore();
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ action: "", status: "", page: 1 });

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = { page: filter.page, limit: 30 };
      if (filter.action) params.action = filter.action;
      if (filter.status) params.status = filter.status;
      const { data } = await api.get("/logs", { params });
      setLogs(data.logs);
      setTotal(data.total);
    } catch {
      showToast("Lỗi tải nhật ký", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, [filter]);

  const fmt = (d) => d ? new Date(d).toLocaleString("vi") : "—";

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Nhật ký ra/vào</h1>
          <p className="page-subtitle">Tổng {total} bản ghi</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setFilter({ ...filter, page: 1 })}>
          🔄 Làm mới
        </button>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 16, display: "flex", gap: 12 }}>
        <select
          className="input"
          style={{ maxWidth: 160 }}
          value={filter.action}
          onChange={(e) => setFilter({ ...filter, action: e.target.value, page: 1 })}
        >
          <option value="">Tất cả hành động</option>
          <option value="entry">Vào</option>
          <option value="exit">Ra</option>
        </select>
        <select
          className="input"
          style={{ maxWidth: 160 }}
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value, page: 1 })}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="accepted">Chấp nhận</option>
          <option value="denied">Từ chối</option>
        </select>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <div className="spinner" />
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Biển số</th>
                  <th>Hành động</th>
                  <th>Trạng thái</th>
                  <th>Giờ vào</th>
                  <th>Giờ ra</th>
                  <th>Thời điểm</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--text-muted)", padding: 40 }}>Không có dữ liệu</td></tr>
                ) : logs.map((log, i) => (
                  <tr key={log.id}>
                    <td style={{ color: "var(--text-muted)" }}>{(filter.page - 1) * 30 + i + 1}</td>
                    <td>
                      <span style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--accent-primary)", fontSize: 14 }}>
                        {log.vehiclePlate}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${log.action === "entry" ? "badge-info" : "badge-warning"}`}>
                        {log.action === "entry" ? "VÀO" : "RA"}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${log.status === "accepted" ? "badge-success" : "badge-danger"}`}>
                        {log.status === "accepted" ? "Chấp nhận" : "Từ chối"}
                      </span>
                    </td>
                    <td style={{ color: "var(--text-secondary)", fontSize: 12 }}>{fmt(log.entryTime)}</td>
                    <td style={{ color: "var(--text-secondary)", fontSize: 12 }}>{fmt(log.exitTime)}</td>
                    <td style={{ color: "var(--text-muted)", fontSize: 12 }}>{fmt(log.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > 30 && (
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16 }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setFilter((f) => ({ ...f, page: Math.max(1, f.page - 1) }))}
                disabled={filter.page === 1}
              >← Trước</button>
              <span style={{ padding: "6px 12px", color: "var(--text-secondary)", fontSize: 13 }}>
                Trang {filter.page} / {Math.ceil(total / 30)}
              </span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setFilter((f) => ({ ...f, page: f.page + 1 }))}
                disabled={filter.page >= Math.ceil(total / 30)}
              >Sau →</button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
