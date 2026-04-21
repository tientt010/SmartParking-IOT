import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useStore } from "./store/useStore.js";
import Sidebar from "./components/Sidebar.jsx";
import Toast from "./components/Toast.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import LogsPage from "./pages/LogsPage.jsx";
import WhitelistPage from "./pages/WhitelistPage.jsx";
import SensorsPage from "./pages/SensorsPage.jsx";
import CustomerPage from "./pages/CustomerPage.jsx";
import CustomersPage from "./pages/CustomersPage.jsx";

function ProtectedLayout() {
  const { initSocket } = useStore();
  useEffect(() => {
    initSocket();
  }, []);

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <div className="page-wrapper">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/logs" element={<LogsPage />} />
            <Route path="/whitelist" element={<WhitelistPage />} />
            <Route path="/sensors" element={<SensorsPage />} />
            <Route path="/customers" element={<CustomersPage />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

function RequireAuth({ children }) {
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const toasts = useStore((s) => s.toasts);

  return (
    <BrowserRouter>
      <Toast toasts={toasts} />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/customer" element={<CustomerPage />} />
        <Route
          path="/*"
          element={
            <RequireAuth>
              <ProtectedLayout />
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
