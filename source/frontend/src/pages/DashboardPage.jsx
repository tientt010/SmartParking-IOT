import { useEffect, useState } from "react";
import { useStore } from "../store/useStore.js";
import api from "../api/api.js";
import "./DashboardPage.css";

// ── Stat Card ────────────────────────────────────────────────────────
function StatCard({ label, value, icon, color, sub }) {
  return (
    <div className="stat-card" style={{ "--accent": color }}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-body">
        <div className="stat-value">{value ?? "—"}</div>
        <div className="stat-label">{label}</div>
        {sub && <div className="stat-sub">{sub}</div>}
      </div>
    </div>
  );
}

// ── Parking Slot Grid ─────────────────────────────────────────────────
function SlotGrid({ slots }) {
  if (!slots.length)
    return <div className="slots-empty">Chưa có dữ liệu slot</div>;

  return (
    <div className="slot-grid">
      {slots.map((slot) => (
        <div key={slot.slotNumber} className={`slot-card ${slot.status}`}>
          <div className="slot-icon">{slot.status === "occupied" ? "🚗" : "🟢"}</div>
          <div className="slot-name">{slot.slotNumber.toUpperCase()}</div>
          <div className={`slot-status badge ${slot.status === "occupied" ? "badge-danger" : "badge-success"}`}>
            {slot.status === "occupied" ? "Có xe" : "Trống"}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Gate Control ──────────────────────────────────────────────────────
function GateControl({ showToast }) {
  const { gateStatus } = useStore();
  const [loading, setLoading] = useState({});

  const sendCommand = async (gateId, action) => {
    setLoading((l) => ({ ...l, [gateId]: true }));
    try {
      await api.post("/device/control", { action, gateId });
      showToast(`${action === "Open" ? "Mở" : "Đóng"} ${gateId} thành công`, "success");
    } catch {
      showToast("Lỗi điều khiển cổng", "error");
    } finally {
      setLoading((l) => ({ ...l, [gateId]: false }));
    }
  };

  const gates = [
    { id: "gate1", label: "Cổng vào (Gate 1)", icon: "🚦" },
    { id: "gate2", label: "Cổng ra (Gate 2)",  icon: "🏁" },
  ];

  return (
    <div className="gate-control-grid">
      {gates.map(({ id, label, icon }) => {
        const isOpen = gateStatus[id] === "open";
        return (
          <div key={id} className={`gate-control-card ${isOpen ? "gate-open" : ""}`}>
            <div className="gate-ctrl-header">
              <span className="gate-ctrl-icon">{icon}</span>
              <div>
                <div className="gate-ctrl-label">{label}</div>
                <div className={`badge ${isOpen ? "badge-success" : "badge-danger"}`}>
                  {isOpen ? "Đang mở" : "Đang đóng"}
                </div>
              </div>
            </div>
            <div className="gate-ctrl-btns">
              <button
                id={`btn-open-${id}`}
                className="btn btn-success btn-sm"
                onClick={() => sendCommand(id, "Open")}
                disabled={loading[id]}
              >
                ▲ Mở
              </button>
              <button
                id={`btn-close-${id}`}
                className="btn btn-danger btn-sm"
                onClick={() => sendCommand(id, "Close")}
                disabled={loading[id]}
              >
                ▼ Đóng
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Live Activity Feed ─────────────────────────────────────────────────
function LiveFeed({ events }) {
  if (!events.length)
    return <div className="feed-empty">Chưa có hoạt động nào...</div>;

  const fmtVND = (n) => n != null ? `${n.toLocaleString("vi")}đ` : "";

  return (
    <div className="feed-list">
      {events.map((e, i) => {
        const isEntry  = e.gate === "entry";
        const isAccept = e.action === "accept";
        const gateLabel = isEntry ? "VÀO" : "RA";
        return (
          <div key={i} className="feed-item">
            <div className={`feed-dot ${isAccept ? "green" : "red"}`} />
            <div className="feed-content">
              <span className={`badge ${isAccept ? "badge-success" : "badge-danger"}`}>
                {isAccept ? `✅ ${gateLabel}` : `❌ ${gateLabel}`}
              </span>
              <span className="feed-plate">{e.plate || "—"}</span>
              {isAccept && e.gate === "exit" && e.fee != null && (
                <span className="feed-fee">−{fmtVND(e.fee)} ({e.durationSec}s)</span>
              )}
              {!isAccept && e.reason && (
                <span className="feed-reason">{e.reason}</span>
              )}
            </div>
            <div className="feed-time">{new Date(e.time).toLocaleTimeString("vi")}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Dashboard Page ────────────────────────────────────────────────────
export default function DashboardPage() {
  const { slots, setSlots, stats, setStats, liveEvents, showToast } = useStore();
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [slotsRes, statsRes] = await Promise.all([
        api.get("/slots"),
        api.get("/stats"),
      ]);
      setSlots(slotsRes.data);
      setStats(statsRes.data);
    } catch {
      showToast("Lỗi tải dữ liệu", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const occupied = slots.filter((s) => s.status === "occupied").length;
  const empty    = slots.filter((s) => s.status === "empty").length;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Giám sát bãi xe thời gian thực</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={fetchData}>
          🔄 Làm mới
        </button>
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : (
        <>
          {/* Stats row */}
          <div className="stats-row">
            <StatCard label="Xe vào hôm nay" value={stats?.today?.entry}  icon="🚗" color="#6366f1" />
            <StatCard label="Xe ra hôm nay"  value={stats?.today?.exit}   icon="🏁" color="#22d3ee" />
            <StatCard label="Từ chối"         value={stats?.today?.denied} icon="🚫" color="#ef4444" />
            <StatCard label="Slot có xe"      value={occupied}             icon="🅿" color="#f59e0b"
              sub={`${empty} trống / ${slots.length} tổng`} />
          </div>

          <div className="dashboard-grid">
            {/* Slot overview */}
            <div className="card dashboard-section">
              <div className="section-header">
                <h2 className="section-title">🅿 Trạng thái chỗ đỗ</h2>
                <div className="slot-legend">
                  <span><span style={{color:"var(--accent-success)"}}>●</span> Trống</span>
                  <span><span style={{color:"var(--accent-danger)"}}>●</span> Có xe</span>
                </div>
              </div>
              <SlotGrid slots={slots} />
            </div>

            {/* Right column */}
            <div className="dashboard-right">
              {/* Gate control */}
              <div className="card">
                <h2 className="section-title" style={{marginBottom:16}}>🚧 Điều khiển cổng</h2>
                <GateControl showToast={showToast} />
              </div>

              {/* Live feed */}
              <div className="card">
                <h2 className="section-title" style={{marginBottom:12}}>
                  ⚡ Hoạt động gần đây
                  <span className="pulse-dot green" style={{marginLeft:8, display:"inline-block"}} />
                </h2>
                <LiveFeed events={liveEvents} />
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
