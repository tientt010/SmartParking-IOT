import { useEffect, useState } from "react";
import api from "../api/api.js";
import { useStore } from "../store/useStore.js";

export default function WhitelistPage() {
  const { showToast } = useStore();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ vehiclePlate: "", ownerName: "" });
  const [showForm, setShowForm] = useState(false);

  const fetch = async () => {
    setLoading(true);
    try { const { data } = await api.get("/whitelist"); setList(data); }
    catch { showToast("Lỗi tải whitelist", "error"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setAdding(true);
    try {
      await api.post("/whitelist", { ...form, vehiclePlate: form.vehiclePlate.toUpperCase() });
      showToast(`Đã thêm biển ${form.vehiclePlate.toUpperCase()}`, "success");
      setForm({ vehiclePlate: "", ownerName: "" });
      setShowForm(false);
      fetch();
    } catch (err) {
      showToast(err.response?.data?.message || "Lỗi thêm biển số", "error");
    } finally { setAdding(false); }
  };

  const toggleStatus = async (item) => {
    try {
      const newStatus = item.status === "active" ? "inactive" : "active";
      await api.put(`/whitelist/${item.id}`, { status: newStatus });
      showToast(`Đã ${newStatus === "active" ? "kích hoạt" : "vô hiệu"} biển ${item.vehiclePlate}`, "success");
      fetch();
    } catch { showToast("Lỗi cập nhật", "error"); }
  };

  const handleDelete = async (item) => {
    if (!confirm(`Xóa biển ${item.vehiclePlate}?`)) return;
    try {
      await api.delete(`/whitelist/${item.id}`);
      showToast(`Đã xóa ${item.vehiclePlate}`, "success");
      fetch();
    } catch { showToast("Lỗi xóa", "error"); }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Quản lý Whitelist</h1>
          <p className="page-subtitle">{list.filter(i => i.status === "active").length} biển số active</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "✕ Hủy" : "+ Thêm biển số"}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 16, fontSize: 14, fontWeight: 600 }}>Thêm biển số mới</h3>
          <form onSubmit={handleAdd} style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <input
              id="wl-plate"
              className="input"
              style={{ flex: "0 0 180px" }}
              placeholder="Biển số (vd: 51A12345)"
              value={form.vehiclePlate}
              onChange={(e) => setForm({ ...form, vehiclePlate: e.target.value })}
              required
            />
            <input
              id="wl-owner"
              className="input"
              style={{ flex: 1, minWidth: 200 }}
              placeholder="Tên chủ xe (tuỳ chọn)"
              value={form.ownerName}
              onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
            />
            <button id="wl-submit" type="submit" className="btn btn-primary" disabled={adding}>
              {adding ? "Đang thêm..." : "✓ Thêm"}
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><div className="spinner" /></div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Biển số</th>
                  <th>Chủ xe</th>
                  <th>Trạng thái</th>
                  <th>Ngày thêm</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {list.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)", padding: 40 }}>Whitelist trống</td></tr>
                ) : list.map((item, i) => (
                  <tr key={item.id}>
                    <td style={{ color: "var(--text-muted)" }}>{i + 1}</td>
                    <td>
                      <span style={{ fontFamily: "monospace", fontWeight: 800, fontSize: 15, color: "var(--accent-primary)" }}>
                        {item.vehiclePlate}
                      </span>
                    </td>
                    <td style={{ color: "var(--text-secondary)" }}>{item.ownerName || "—"}</td>
                    <td>
                      <span className={`badge ${item.status === "active" ? "badge-success" : "badge-warning"}`}>
                        {item.status === "active" ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td style={{ color: "var(--text-muted)", fontSize: 12 }}>
                      {new Date(item.createdAt).toLocaleDateString("vi")}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          className={`btn btn-sm ${item.status === "active" ? "btn-ghost" : "btn-success"}`}
                          onClick={() => toggleStatus(item)}
                        >
                          {item.status === "active" ? "Tắt" : "Bật"}
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(item)}>
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
