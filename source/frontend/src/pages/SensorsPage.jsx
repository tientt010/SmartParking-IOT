import { useEffect, useState } from "react";
import api from "../api/api.js";
import { useStore } from "../store/useStore.js";

const SENSOR_LABELS = {
  sensor1: "Sensor 1 (Cửa vào)",
  sensor2: "Sensor 2 (Cửa ra)",
  sensor3: "Sensor 3 (Slot 1)",
  sensor4: "Sensor 4 (Slot 2)",
  sensor5: "Sensor 5 (Slot 3)",
  sensor6: "Sensor 6 (Slot 4)",
};

function DistanceBar({ value, threshold }) {
  if (value === null || value === undefined) return <span style={{ color: "var(--text-muted)" }}>—</span>;
  const pct = Math.min((value / 50) * 100, 100);
  const isOccupied = value < threshold;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flex: 1, height: 6, background: "var(--bg-input)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{
          width: `${pct}%`,
          height: "100%",
          background: isOccupied ? "var(--accent-danger)" : "var(--accent-success)",
          borderRadius: 99,
          transition: "width 0.4s ease",
        }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", minWidth: 50 }}>
        {value.toFixed(1)} cm
      </span>
    </div>
  );
}

export default function SensorsPage() {
  const { showToast } = useStore();
  const [sensors, setSensors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState({});

  const fetch = async () => {
    setLoading(true);
    try { const { data } = await api.get("/hardware/sensor"); setSensors(data); }
    catch { showToast("Lỗi tải cảm biến", "error"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch(); const t = setInterval(fetch, 2000); return () => clearInterval(t); }, []);

  const saveThreshold = async (sensorId, threshold) => {
    try {
      await api.put(`/hardware/sensor/${sensorId}`, { threshold: parseFloat(threshold) });
      showToast(`Đã cập nhật threshold cho ${sensorId}`, "success");
      setEditing((e) => ({ ...e, [sensorId]: undefined }));
      fetch();
    } catch { showToast("Lỗi cập nhật threshold", "error"); }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Quản lý cảm biến</h1>
          <p className="page-subtitle">Tự động cập nhật mỗi 2s</p>
        </div>
        <span className="badge badge-info">
          <span className="pulse-dot green" style={{ width: 6, height: 6 }} /> Live
        </span>
      </div>

      {loading && sensors.length === 0 ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><div className="spinner" /></div>
      ) : sensors.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📡</div>
          <div>Chưa nhận được dữ liệu từ Pi Driver</div>
          <div style={{ fontSize: 12, marginTop: 8 }}>Kiểm tra driver.py có đang chạy không</div>
        </div>
      ) : (
        <div className="sensor-grid">
          {sensors.map((sensor) => {
            const isOccupied = sensor.currentStatus === 1;
            const editVal = editing[sensor.sensorId];
            return (
              <div key={sensor.sensorId} className={`sensor-card card ${isOccupied ? "s-occupied" : "s-empty"}`}>
                <div className="sensor-header">
                  <div>
                    <div className="sensor-name">{SENSOR_LABELS[sensor.sensorId] || sensor.sensorId}</div>
                    <div className="sensor-slot">→ {sensor.slotNumber}</div>
                  </div>
                  <span className={`badge ${isOccupied ? "badge-danger" : "badge-success"}`}>
                    {isOccupied ? "Có xe" : "Trống"}
                  </span>
                </div>

                <div style={{ margin: "16px 0" }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>
                    Khoảng cách hiện tại
                  </div>
                  <DistanceBar
                    value={sensor.currentDistance}
                    threshold={sensor.threshold}
                  />
                </div>

                <div className="sensor-threshold">
                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    Threshold: <strong>{sensor.threshold} cm</strong>
                  </span>
                  <div style={{ display: "flex", gap: 6 }}>
                    {editVal !== undefined ? (
                      <>
                        <input
                          className="input"
                          style={{ width: 70, padding: "4px 8px", fontSize: 12 }}
                          type="number"
                          min="1" max="200" step="0.5"
                          value={editVal}
                          onChange={(e) => setEditing((ed) => ({ ...ed, [sensor.sensorId]: e.target.value }))}
                        />
                        <button className="btn btn-success btn-sm" onClick={() => saveThreshold(sensor.sensorId, editVal)}>✓</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditing((ed) => ({ ...ed, [sensor.sensorId]: undefined }))}>✕</button>
                      </>
                    ) : (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setEditing((ed) => ({ ...ed, [sensor.sensorId]: sensor.threshold }))}
                      >
                        ✏️ Sửa
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
