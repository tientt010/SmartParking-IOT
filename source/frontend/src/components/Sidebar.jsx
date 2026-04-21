import { NavLink, useNavigate } from "react-router-dom";
import { useStore } from "../store/useStore.js";
import "./Sidebar.css";

const NAV = [
  { to: "/", icon: "⬡", label: "Dashboard" },
  { to: "/logs", icon: "📋", label: "Nhật ký" },
  { to: "/customers", icon: "👥", label: "Khách hàng" },
  { to: "/whitelist", icon: "✅", label: "Whitelist" },
  { to: "/sensors", icon: "📡", label: "Cảm biến" },
];

export default function Sidebar() {
  const { user, logout, connected, gateStatus } = useStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-icon">🅿</div>
        <div>
          <div className="logo-name">SmartParking</div>
          <div className="logo-sub">Pi Edition v2</div>
        </div>
      </div>

      {/* Connection status */}
      <div className="sidebar-status">
        <span className={`pulse-dot ${connected ? "green" : "red"}`} />
        <span className="status-text">
          {connected ? "Realtime ON" : "Mất kết nối"}
        </span>
      </div>

      {/* Gate status */}
      <div className="gate-status-bar">
        <div
          className={`gate-pill ${gateStatus.gate1 === "open" ? "open" : ""}`}
        >
          <span>Cổng vào</span>
          <span className="gate-state">
            {gateStatus.gate1 === "open" ? "Mở" : "Đóng"}
          </span>
        </div>
        <div
          className={`gate-pill ${gateStatus.gate2 === "open" ? "open" : ""}`}
        >
          <span>Cổng ra</span>
          <span className="gate-state">
            {gateStatus.gate2 === "open" ? "Mở" : "Đóng"}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <div className="nav-label">Menu</div>
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User info */}
      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-avatar">
            {user?.username?.[0]?.toUpperCase() || "A"}
          </div>
          <div>
            <div className="user-name">{user?.username || "Admin"}</div>
            <div className="user-role">{user?.role || "admin"}</div>
          </div>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={handleLogout}
          title="Đăng xuất"
        >
          ⏏
        </button>
      </div>
    </aside>
  );
}
