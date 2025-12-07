import { NavLink } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";
import {
  LayoutDashboard,
  ParkingSquare,
  FileText,
  Bell,
  ListChecks,
  Settings,
  Users,
  LogOut,
  Car,
} from "lucide-react";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: ParkingSquare, label: "Quản lý slot", path: "/slots" },
  { icon: FileText, label: "Logs", path: "/logs" },
  { icon: ListChecks, label: "Whitelist", path: "/whitelist" },
  { icon: Settings, label: "Cài đặt hệ thống", path: "/settings" },
];

const Sidebar = () => {
  const { user, logout } = useAuthStore();

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Car className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg text-gray-800">SmartParking</span>
        </div>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {menuItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon
                      className={`w-5 h-5 ${
                        isActive ? "text-white" : "text-blue-600"
                      }`}
                    />
                    <span className={isActive ? "text-white" : "text-gray-700"}>
                      {item.label}
                    </span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
            <Users className="w-5 h-5 text-gray-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-800">
              {user?.username || "Admin"}
            </p>
            <p className="text-xs text-gray-500">{user?.role || "admin"}</p>
          </div>
          <button onClick={logout} className="text-gray-400 hover:text-red-500 cursor-pointer">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
