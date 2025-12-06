import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";

const GuestRoute = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : children;
};

export default GuestRoute;
