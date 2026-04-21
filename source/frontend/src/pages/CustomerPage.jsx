import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import "./CustomerPage.css";

const BASE = import.meta.env.VITE_API_URL || "";
const api = axios.create({ baseURL: `${BASE}/api` });

const TOKEN_KEY = "sp_customer_token";
function getToken() { return localStorage.getItem(TOKEN_KEY); }
function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
function removeToken() { localStorage.removeItem(TOKEN_KEY); }
function authHeader() { const t = getToken(); return t ? { Authorization: `Bearer ${t}` } : {}; }

function fmtVND(n) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n ?? 0);
}
function fmtDuration(mins) {
  if (!mins || mins < 1) return "Vừa vào";
  const h = Math.floor(mins / 60), m = mins % 60;
  return h ? `${h} giờ ${m} phút` : `${m} phút`;
}
function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("vi-VN");
}

function SlotMiniGrid({ slots = [] }) {
  return (
    <div className="smg-wrap">
      {slots.map((s) => (
        <div key={s.slotNumber} className={`smg-cell ${s.status}`} title={s.slotNumber}>
          {s.slotNumber.replace("slot", "")}
        </div>
      ))}
    </div>
  );
}

function SlotOverview() {
  const [data, setData] = useState(null);
  useEffect(() => {
    const load = () => api.get("/public/slots").then(r => setData(r.data)).catch(() => {});
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);
  if (!data) return null;
  return (
    <div className="cp-ov-bar">
      <div className="cp-ov-item empty"><span className="cp-ov-num">{data.empty}</span><span className="cp-ov-lbl">Chỗ trống</span></div>
      <div className="cp-ov-sep" />
      <div className="cp-ov-item occupied"><span className="cp-ov-num">{data.occupied}</span><span className="cp-ov-lbl">Có xe</span></div>
      <div className="cp-ov-sep" />
      <div className="cp-ov-item"><span className="cp-ov-num">{data.total}</span><span className="cp-ov-lbl">Tổng</span></div>
      <div className="cp-ov-grid"><SlotMiniGrid slots={data.slots} /></div>
    </div>
  );
}

function AuthForm({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ phone: "", name: "", password: "", vehiclePlate: "" });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const submit = async (e) => {
    e.preventDefault(); setErr(""); setLoading(true);
    try {
      const url = mode === "login" ? "/customer/login" : "/customer/register";
      const payload = mode === "login"
        ? { phone: form.phone, password: form.password }
        : { phone: form.phone, name: form.name, password: form.password, vehiclePlate: form.vehiclePlate };
      const { data } = await api.post(url, payload);
      setToken(data.token); onAuth(data.customer);
    } catch (ex) { setErr(ex.response?.data?.message || "Lỗi kết nối"); }
    finally { setLoading(false); }
  };
  return (
    <div className="cp-auth-card">
      <div className="cp-auth-tabs">
        <button className={`cp-tab ${mode === "login" ? "active" : ""}`} onClick={() => { setMode("login"); setErr(""); }}>Đăng nhập</button>
        <button className={`cp-tab ${mode === "register" ? "active" : ""}`} onClick={() => { setMode("register"); setErr(""); }}>Đăng ký</button>
      </div>
      <form onSubmit={submit} className="cp-auth-form">
        {mode === "register" && (
          <div className="cp-field"><label>Họ tên</label>
            <input className="input" placeholder="Nguyễn Văn A" value={form.name} onChange={e => set("name", e.target.value)} required />
          </div>
        )}
        <div className="cp-field"><label>Số điện thoại</label>
          <input className="input" type="tel" placeholder="09xxxxxxxx" value={form.phone} onChange={e => set("phone", e.target.value)} required />
        </div>
        <div className="cp-field"><label>Mật khẩu</label>
          <input className="input" type="password" placeholder="••••••••" value={form.password} onChange={e => set("password", e.target.value)} required />
        </div>
        {mode === "register" && (
          <div className="cp-field"><label>Biển số xe <span className="opt">(tuỳ chọn)</span></label>
            <input className="input plate-input" placeholder="VD: 30A12345" value={form.vehiclePlate}
              onChange={e => set("vehiclePlate", e.target.value.toUpperCase())} maxLength={12} />
          </div>
        )}
        {err && <div className="cp-err">{err}</div>}
        <button className="btn btn-primary btn-lg" type="submit" disabled={loading} style={{ width: "100%" }}>
          {loading ? "Đang xử lý..." : mode === "login" ? "Đăng nhập →" : "Tạo tài khoản →"}
        </button>
      </form>
    </div>
  );
}

function VehicleCard({ vehicle, balance, onPaid }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const canPay = balance >= vehicle.fee;
  const pay = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/customer/pay", { vehiclePlate: vehicle.vehiclePlate }, { headers: authHeader() });
      setResult(data); onPaid?.(data.balanceAfter);
    } catch (ex) { alert(ex.response?.data?.message || "Lỗi thanh toán"); }
    finally { setLoading(false); }
  };
  if (result) return (
    <div className="vc-success">
      <div className="vcs-icon">✅</div>
      <div className="vcs-title">Thanh toán thành công!</div>
      <div className="vcs-rows">
        <div className="vcs-row"><span>Biển số</span><strong>{result.vehiclePlate}</strong></div>
        <div className="vcs-row"><span>Chỗ đỗ</span><strong>{result.slotNumber?.toUpperCase()}</strong></div>
        <div className="vcs-row"><span>Số tiền</span><strong style={{color:"var(--accent-success)"}}>{fmtVND(result.fee)}</strong></div>
        <div className="vcs-row"><span>Số dư còn</span><strong>{fmtVND(result.balanceAfter)}</strong></div>
        <div className="vcs-row"><span>Mã GD</span><strong>{result.transactionId}</strong></div>
      </div>
      <p className="vcs-note">{result.message}</p>
    </div>
  );
  return (
    <div className="vc-card">
      <div className="vc-head"><span className="vc-plate">{vehicle.vehiclePlate}</span><span className="badge badge-success">● Đang đỗ</span></div>
      <div className="vc-rows">
        <div className="vc-row"><span>Chỗ đỗ</span><strong>{vehicle.slot?.toUpperCase()}</strong></div>
        <div className="vc-row"><span>Vào lúc</span><strong>{fmtDate(vehicle.entryTime)}</strong></div>
        <div className="vc-row"><span>Thời gian</span><strong>{fmtDuration(vehicle.durationMinutes)}</strong></div>
        <div className="vc-row vc-fee-row"><span>Phí cần trả</span><strong className="vc-fee">{fmtVND(vehicle.fee)}</strong></div>
      </div>
      <div className="vc-balance-row">
        Số dư ví: <strong style={{color: canPay ? "var(--accent-success)" : "var(--accent-danger)"}}>{fmtVND(balance)}</strong>
        {!canPay && <span className="vc-short"> — Không đủ, hãy nạp thêm</span>}
      </div>
      <button className="btn btn-primary btn-lg vc-pay-btn" onClick={pay} disabled={loading || !canPay}>
        {loading ? "Đang xử lý..." : `💳 Thanh toán ${fmtVND(vehicle.fee)} từ ví`}
      </button>
    </div>
  );
}

function TabVehicle({ customer, balance, onBalanceChange }) {
  const [plate, setPlate] = useState(customer.vehiclePlate || "");
  const [vehicle, setVehicle] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [editPlate, setEditPlate] = useState(false);
  const [newPlate, setNewPlate] = useState(customer.vehiclePlate || "");
  const [savingPlate, setSavingPlate] = useState(false);

  const search = useCallback(async (p) => {
    const q = (p || plate).toUpperCase().replace(/\s+/g, "");
    if (!q) return;
    setLoadingSearch(true); setVehicle(null); setNotFound(false);
    try {
      const { data } = await api.get(`/customer/vehicle?plate=${q}`, { headers: authHeader() });
      if (data.found) setVehicle(data); else setNotFound(true);
    } catch { setNotFound(true); } finally { setLoadingSearch(false); }
  }, [plate]);

  useEffect(() => { if (customer.vehiclePlate) search(customer.vehiclePlate); }, []);

  const savePlate = async () => {
    setSavingPlate(true);
    try {
      await api.put("/customer/plate", { vehiclePlate: newPlate }, { headers: authHeader() });
      customer.vehiclePlate = newPlate.toUpperCase().replace(/\s+/g, "") || null;
      setPlate(customer.vehiclePlate || ""); setEditPlate(false);
    } catch (ex) { alert(ex.response?.data?.message || "Lỗi lưu"); }
    finally { setSavingPlate(false); }
  };

  return (
    <div className="tab-content">
      <div className="section-box">
        <div className="sb-title">🚗 Biển số xe liên kết</div>
        {editPlate ? (
          <div className="plate-edit-row">
            <input className="input plate-input" value={newPlate} onChange={e => setNewPlate(e.target.value.toUpperCase())} placeholder="VD: 30A12345" maxLength={12} />
            <button className="btn btn-success btn-sm" onClick={savePlate} disabled={savingPlate}>✓</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditPlate(false)}>✕</button>
          </div>
        ) : (
          <div className="plate-show-row">
            <span className="plate-badge">{customer.vehiclePlate || "Chưa liên kết"}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => { setNewPlate(customer.vehiclePlate || ""); setEditPlate(true); }}>✏️ Sửa</button>
          </div>
        )}
      </div>
      <div className="section-box">
        <div className="sb-title">🔍 Tra cứu xe trong bãi</div>
        <form className="lookup-row" onSubmit={e => { e.preventDefault(); search(); }}>
          <input className="input plate-input" value={plate} onChange={e => setPlate(e.target.value.toUpperCase())} placeholder="Nhập biển số xe" maxLength={12} />
          <button className="btn btn-primary" type="submit" disabled={loadingSearch}>
            {loadingSearch ? <span className="spinner" style={{width:14,height:14,borderWidth:2}} /> : "Tra cứu"}
          </button>
        </form>
      </div>
      {notFound && <div className="empty-box"><div>🔎</div><div>Không tìm thấy xe <strong>{plate}</strong> trong bãi</div></div>}
      {vehicle && <VehicleCard vehicle={vehicle} balance={balance} onPaid={(b) => { onBalanceChange(b); setVehicle(null); }} />}
    </div>
  );
}

const QUICK = [50000, 100000, 200000, 500000];
const METHODS = [
  { id: "qr", label: "QR Banking", icon: "📱" },
  { id: "bank", label: "Chuyển khoản", icon: "🏦" },
  { id: "momo", label: "MoMo", icon: "💜" },
];

function TabTopup({ onSuccess }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("qr");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const parsedAmount = parseFloat(String(amount).replace(/[^0-9]/g, "")) || 0;

  const confirm = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/customer/topup", { amount: parsedAmount, method }, { headers: authHeader() });
      setResult(data); onSuccess?.(data.balance);
    } catch (ex) { alert(ex.response?.data?.message || "Lỗi nạp tiền"); }
    finally { setLoading(false); }
  };

  if (result) return (
    <div className="tab-content">
      <div className="topup-success">
        <div className="ts-icon">🎉</div>
        <div className="ts-title">Nạp tiền thành công!</div>
        <div className="ts-rows">
          <div className="ts-row"><span>Số tiền nạp</span><strong style={{color:"var(--accent-success)"}}>{fmtVND(result.amount)}</strong></div>
          <div className="ts-row"><span>Số dư mới</span><strong>{fmtVND(result.balance)}</strong></div>
          <div className="ts-row"><span>Mã GD</span><strong>{result.transactionId}</strong></div>
        </div>
        <button className="btn btn-ghost" style={{width:"100%"}} onClick={() => { setResult(null); setAmount(""); }}>Nạp tiếp</button>
      </div>
    </div>
  );

  return (
    <div className="tab-content">
      <div className="section-box">
        <div className="sb-title">💰 Chọn số tiền nạp</div>
        <div className="quick-row">
          {QUICK.map(q => (
            <button key={q} className={`quick-btn ${parsedAmount === q ? "active" : ""}`} onClick={() => setAmount(String(q))}>{fmtVND(q)}</button>
          ))}
        </div>
        <div style={{marginTop:12}}>
          <label className="cp-field-label">Hoặc nhập số tiền khác</label>
          <input className="input" type="number" min="10000" max="10000000" step="10000"
            placeholder="VD: 150000" value={amount} onChange={e => setAmount(e.target.value)} />
          {parsedAmount > 0 && parsedAmount < 10000 && <div className="cp-err">Tối thiểu 10,000đ</div>}
        </div>
      </div>
      <div className="section-box">
        <div className="sb-title">📲 Phương thức nạp</div>
        <div className="method-row">
          {METHODS.map(m => (
            <button key={m.id} className={`method-btn ${method === m.id ? "active" : ""}`} onClick={() => setMethod(m.id)}>
              <span className="method-icon">{m.icon}</span><span>{m.label}</span>
            </button>
          ))}
        </div>
      </div>
      {parsedAmount >= 10000 && (
        <div className="section-box topup-confirm-box">
          <div className="tcb-info">
            <div className="tcb-line"><span>Số tiền nạp</span><strong style={{color:"var(--accent-success)"}}>{fmtVND(parsedAmount)}</strong></div>
            <div className="tcb-line"><span>Phương thức</span><strong>{METHODS.find(m => m.id === method)?.label}</strong></div>
          </div>
          <div className="bank-hint">
            <p>Chuyển <strong>{fmtVND(parsedAmount)}</strong> đến TK <strong>0123 4567 89 — MB Bank</strong></p>
            <p>Nội dung: <strong>TOPUP {parsedAmount}</strong></p>
            <p style={{fontSize:11,color:"var(--text-muted)"}}>Sau khi chuyển khoản, bấm xác nhận để cộng vào ví.</p>
          </div>
          <button className="btn btn-primary btn-lg" style={{width:"100%"}} onClick={confirm} disabled={loading}>
            {loading ? "Đang xử lý..." : `Xác nhận nạp ${fmtVND(parsedAmount)}`}
          </button>
        </div>
      )}
    </div>
  );
}

function TabHistory() {
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get("/customer/transactions", { headers: authHeader() }).then(r => setTxs(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);
  if (loading) return <div className="tab-content" style={{display:"flex",justifyContent:"center",padding:60}}><div className="spinner" /></div>;
  if (!txs.length) return <div className="tab-content"><div className="empty-box"><div>📋</div><div>Chưa có giao dịch nào</div></div></div>;
  return (
    <div className="tab-content">
      <div className="tx-list">
        {txs.map(tx => (
          <div key={tx.id} className={`tx-item ${tx.type}`}>
            <div className="tx-icon">{tx.type === "topup" ? "⬆️" : "⬇️"}</div>
            <div className="tx-body">
              <div className="tx-desc">{tx.description || tx.type}</div>
              <div className="tx-date">{fmtDate(tx.createdAt)}</div>
            </div>
            <div className={`tx-amount ${tx.type}`}>{tx.type === "topup" ? "+" : "-"}{fmtVND(tx.amount)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Dashboard({ customer: initCustomer, onLogout }) {
  const [customer] = useState(initCustomer);
  const [balance, setBalance] = useState(initCustomer.balance ?? 0);
  const [tab, setTab] = useState("vehicle");
  const TABS = [
    { id: "vehicle", label: "🚗 Xe & Thanh toán" },
    { id: "topup", label: "💰 Nạp tiền" },
    { id: "history", label: "📋 Lịch sử" },
  ];
  return (
    <div className="cp-dashboard">
      <div className="cp-profile-bar">
        <div className="cp-profile-left">
          <div className="cp-avatar">{customer.name?.[0]?.toUpperCase() || "K"}</div>
          <div>
            <div className="cp-profile-name">{customer.name}</div>
            <div className="cp-profile-phone">{customer.phone}</div>
          </div>
        </div>
        <div className="cp-balance-box">
          <div className="cp-balance-label">Số dư ví</div>
          <div className="cp-balance-value">{fmtVND(balance)}</div>
        </div>
        <button className="btn btn-ghost btn-sm cp-logout" onClick={onLogout}>⏏ Đăng xuất</button>
      </div>
      <div className="cp-tabs">
        {TABS.map(t => (
          <button key={t.id} className={`cp-tab-btn ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>
      {tab === "vehicle" && <TabVehicle customer={customer} balance={balance} onBalanceChange={setBalance} />}
      {tab === "topup"   && <TabTopup onSuccess={setBalance} />}
      {tab === "history" && <TabHistory key={tab} />}
    </div>
  );
}

export default function CustomerPage() {
  const [customer, setCustomer] = useState(null);
  const [booting, setBooting] = useState(true);
  useEffect(() => {
    const token = getToken();
    if (!token) { setBooting(false); return; }
    api.get("/customer/me", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setCustomer(r.data)).catch(() => removeToken()).finally(() => setBooting(false));
  }, []);
  const logout = () => { removeToken(); setCustomer(null); };
  if (booting) return (
    <div className="customer-page" style={{display:"flex",justifyContent:"center",alignItems:"center",height:"100vh"}}>
      <div className="spinner" />
    </div>
  );
  return (
    <div className="customer-page">
      <header className="cp-header">
        <div className="cp-header-inner">
          <div className="cp-logo">
            <div className="cp-logo-icon">🅿</div>
            <div><div className="cp-logo-name">SmartParking</div><div className="cp-logo-sub">Cổng khách hàng</div></div>
          </div>
        </div>
      </header>
      <SlotOverview />
      <main className="cp-main">
        {customer ? (
          <Dashboard customer={customer} onLogout={logout} />
        ) : (
          <>
            <div className="cp-guest-title">
              <h2>Đăng nhập để tra cứu xe & thanh toán</h2>
              <p>Quản lý ví, nộp tiền và thanh toán phí đỗ xe dễ dàng</p>
            </div>
            <AuthForm onAuth={setCustomer} />
            <div className="cp-features">
              {[
                { icon: "🔍", t: "Tra cứu xe", s: "Kiểm tra xe đang đỗ theo biển số" },
                { icon: "💳", t: "Thanh toán ví", s: "Trừ phí trực tiếp từ số dư ví" },
                { icon: "💰", t: "Nạp tiền", s: "Nạp qua QR, chuyển khoản, MoMo" },
                { icon: "📋", t: "Lịch sử GD", s: "Xem lại tất cả giao dịch" },
              ].map(f => (
                <div key={f.t} className="cp-feature-item">
                  <div className="cp-fi-icon">{f.icon}</div>
                  <div className="cp-fi-title">{f.t}</div>
                  <div className="cp-fi-sub">{f.s}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
      <footer className="cp-footer">© 2025 SmartParking Pi</footer>
    </div>
  );
}
