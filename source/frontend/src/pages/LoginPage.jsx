import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store/useStore.js";
import "./LoginPage.css";

export default function LoginPage() {
  const { login, showToast } = useStore();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "admin", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await login(form.username, form.password);
      navigate("/");
    } catch {
      setError("Sai tài khoản hoặc mật khẩu");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Animated background */}
      <div className="login-bg">
        <div className="bg-orb orb1" />
        <div className="bg-orb orb2" />
        <div className="bg-orb orb3" />
      </div>

      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-icon">🅿</div>
          <h1 className="login-title">SmartParking</h1>
          <p className="login-subtitle">Raspberry Pi Edition — Hệ thống bãi xe thông minh</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label className="form-label">Tài khoản</label>
            <input
              id="login-username"
              className="input"
              type="text"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="admin"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Mật khẩu</label>
            <input
              id="login-password"
              className="input"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
              required
            />
          </div>

          {error && <div className="login-error">{error}</div>}

          <button
            id="login-submit"
            type="submit"
            className="btn btn-primary btn-lg login-btn"
            disabled={loading}
          >
            {loading ? <><span className="spinner" style={{width:16, height:16, borderWidth:2}} /> Đang đăng nhập...</> : "Đăng nhập →"}
          </button>
        </form>

      </div>
    </div>
  );
}
