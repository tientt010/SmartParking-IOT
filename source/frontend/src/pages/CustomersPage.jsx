import { useState, useEffect, useCallback } from "react";
import api from "../api/api.js";
import "./CustomersPage.css";

function fmtVND(n) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n ?? 0);
}
function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("vi-VN");
}

function CreateModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: "", phone: "", password: "123456", vehiclePlate: "", initialBalance: "" });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault(); setErr(""); setLoading(true);
    try {
      const { data } = await api.post("/admin/customers", {
        ...form,
        vehiclePlate: form.vehiclePlate.toUpperCase().replace(/\s+/g, "") || undefined,
        initialBalance: parseFloat(form.initialBalance) || 0,
      });
      onCreated(data.customer);
    } catch (ex) { setErr(ex.response?.data?.message || "Lỗi tạo tài khoản"); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">➕ Tạo tài khoản khách hàng</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit} className="modal-form">
          <div className="mf-row">
            <div className="mf-field">
              <label>Họ tên *</label>
              <input className="input" placeholder="Nguyễn Văn A" value={form.name}
                onChange={e => set("name", e.target.value)} required />
            </div>
            <div className="mf-field">
              <label>Số điện thoại *</label>
              <input className="input" type="tel" placeholder="09xxxxxxxx" value={form.phone}
                onChange={e => set("phone", e.target.value)} required />
            </div>
          </div>
          <div className="mf-row">
            <div className="mf-field">
              <label>Mật khẩu *</label>
              <input className="input" type="text" value={form.password}
                onChange={e => set("password", e.target.value)} required />
            </div>
            <div className="mf-field">
              <label>Biển số xe</label>
              <input className="input plate-input" placeholder="VD: 30A12345" value={form.vehiclePlate}
                onChange={e => set("vehiclePlate", e.target.value.toUpperCase())} maxLength={12} />
            </div>
          </div>
          <div className="mf-field">
            <label>Số tiền khởi tạo (đ)</label>
            <input className="input" type="number" min="0" step="10000" placeholder="0 = không nạp"
              value={form.initialBalance} onChange={e => set("initialBalance", e.target.value)} />
          </div>
          {err && <div className="modal-err">{err}</div>}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Huỷ</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Đang tạo..." : "✓ Tạo tài khoản"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TopupModal({ customer, onClose, onDone }) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const QUICK = [50000, 100000, 200000, 500000];

  const confirm = async () => {
    const num = parseFloat(amount);
    if (!num || num <= 0) return;
    setLoading(true);
    try {
      const { data } = await api.patch(`/admin/customers/${customer.id}/topup`, { amount: num });
      onDone(data.customer);
    } catch (ex) { alert(ex.response?.data?.message || "Lỗi nạp tiền"); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">💰 Nạp tiền — {customer.name}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-form">
          <div className="topup-balance-current">
            Số dư hiện tại: <strong>{fmtVND(customer.balance)}</strong>
          </div>
          <div className="quick-row">
            {QUICK.map(q => (
              <button key={q} className={`quick-btn ${parseFloat(amount) === q ? "active" : ""}`}
                onClick={() => setAmount(String(q))}>{fmtVND(q)}</button>
            ))}
          </div>
          <input className="input" type="number" min="10000" step="10000"
            placeholder="Hoặc nhập số tiền khác..." value={amount}
            onChange={e => setAmount(e.target.value)} style={{ marginTop: 12 }} />
          <div className="modal-actions" style={{ marginTop: 16 }}>
            <button className="btn btn-ghost" onClick={onClose}>Huỷ</button>
            <button className="btn btn-success" onClick={confirm}
              disabled={loading || !parseFloat(amount)}>
              {loading ? "Đang nạp..." : `Nạp ${amount ? fmtVND(parseFloat(amount)) : ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlateModal({ customer, onClose, onDone }) {
  const [plate, setPlate] = useState(customer.vehiclePlate || "");
  const [loading, setLoading] = useState(false);

  const save = async () => {
    setLoading(true);
    try {
      const { data } = await api.patch(`/admin/customers/${customer.id}/plate`, {
        vehiclePlate: plate.toUpperCase().replace(/\s+/g, "") || null,
      });
      onDone(data.customer);
    } catch (ex) { alert(ex.response?.data?.message || "Lỗi cập nhật"); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">🚗 Cập nhật biển số — {customer.name}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-form">
          <input className="input plate-input" placeholder="VD: 30A12345" value={plate}
            onChange={e => setPlate(e.target.value.toUpperCase())} maxLength={12} autoFocus />
          <div className="modal-actions" style={{ marginTop: 16 }}>
            <button className="btn btn-ghost" onClick={onClose}>Huỷ</button>
            <button className="btn btn-primary" onClick={save} disabled={loading}>
              {loading ? "Đang lưu..." : "✓ Lưu biển số"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [topupTarget, setTopupTarget] = useState(null);
  const [plateTarget, setPlateTarget] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/admin/customers");
      setCustomers(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (c) => {
    if (!confirm(`Xoá tài khoản "${c.name}" (${c.phone})? Hành động này không thể hoàn tác.`)) return;
    try {
      await api.delete(`/admin/customers/${c.id}`);
      setCustomers(cs => cs.filter(x => x.id !== c.id));
    } catch (ex) { alert(ex.response?.data?.message || "Lỗi xoá"); }
  };

  const updateCustomer = (updated) => {
    setCustomers(cs => cs.map(c => c.id === updated.id ? { ...c, ...updated } : c));
    setTopupTarget(null);
    setPlateTarget(null);
  };

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search) ||
    (c.vehiclePlate || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="customers-page">
      <div className="page-header">
        <div>
          <div className="page-title">👥 Quản lý Khách hàng</div>
          <div className="page-subtitle">{customers.length} tài khoản đã đăng ký</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          ➕ Tạo tài khoản
        </button>
      </div>

      <div className="cust-search-bar">
        <input className="input" placeholder="🔍 Tìm theo tên, SĐT hoặc biển số..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="cust-loading"><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="cust-empty">
          <div>👤</div>
          <div>{search ? "Không tìm thấy khách hàng phù hợp" : "Chưa có khách hàng nào"}</div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Họ tên</th>
                <th>Số ĐT</th>
                <th>Biển số xe</th>
                <th>Số dư ví</th>
                <th>Ngày tạo</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr key={c.id}>
                  <td className="cust-idx">{i + 1}</td>
                  <td>
                    <div className="cust-avatar-row">
                      <div className="cust-avatar">{c.name[0]?.toUpperCase()}</div>
                      <span className="cust-name">{c.name}</span>
                    </div>
                  </td>
                  <td className="cust-phone">{c.phone}</td>
                  <td>
                    {c.vehiclePlate
                      ? <span className="plate-tag">{c.vehiclePlate}</span>
                      : <span className="no-plate">Chưa có</span>}
                  </td>
                  <td>
                    <span className={`cust-balance ${c.balance < 5000 ? "low" : ""}`}>
                      {fmtVND(c.balance)}
                    </span>
                  </td>
                  <td className="cust-date">{fmtDate(c.createdAt)}</td>
                  <td>
                    <div className="cust-actions">
                      <button className="btn btn-success btn-sm"
                        title="Nạp tiền" onClick={() => setTopupTarget(c)}>💰</button>
                      <button className="btn btn-ghost btn-sm"
                        title="Sửa biển số" onClick={() => setPlateTarget(c)}>🚗</button>
                      <button className="btn btn-danger btn-sm"
                        title="Xoá tài khoản" onClick={() => handleDelete(c)}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={(c) => { setCustomers(cs => [c, ...cs]); setShowCreate(false); }}
        />
      )}
      {topupTarget && (
        <TopupModal customer={topupTarget} onClose={() => setTopupTarget(null)} onDone={updateCustomer} />
      )}
      {plateTarget && (
        <PlateModal customer={plateTarget} onClose={() => setPlateTarget(null)} onDone={updateCustomer} />
      )}
    </div>
  );
}
