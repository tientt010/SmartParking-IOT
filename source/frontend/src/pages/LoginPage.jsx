// src/pages/auth/LoginPage.jsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";
import { Eye, EyeOff, User, Lock, Loader2, Car } from "lucide-react";
import toast from "react-hot-toast";

const LoginPage = ({ isSignup = false }) => {
  const navigate = useNavigate();
  const { login, signup, isLoading, error, clearError } = useAuthStore();

  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });

  const handleChange = (e) => {
    clearError();
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.username.length < 3) {
      toast.error("Username phải có ít nhất 3 ký tự");
      return;
    }
    if (formData.password.length < 6) {
      toast.error("Mật khẩu phải có ít nhất 6 ký tự");
      return;
    }

    let success;
    if (isSignup) {
      success = await signup(formData);
      if (success) toast.success("Đăng ký thành công!");
    } else {
      success = await login(formData);
      if (success) toast.success("Đăng nhập thành công!");
    }

    if (success) {
      navigate("/dashboard");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row">
        {/* Cột trái: giới thiệu / banner (ẩn trên mobile nếu muốn) */}
        <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex-col justify-between p-8">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-white/10 p-3 rounded-full">
                <Car className="w-8 h-8 text-white" />
              </div>
              <div>
                <p className="text-sm text-blue-100">Smart Parking System</p>
                <h2 className="text-2xl font-bold">Quản lý bãi xe thông minh</h2>
              </div>
            </div>
            <p className="text-blue-100 text-sm leading-relaxed">
              Giám sát lượng xe ra vào, tình trạng chỗ trống và barrier theo thời
              gian thực trên hệ thống dashboard hiện đại.
            </p>
          </div>
          <div className="text-xs text-blue-100/80">
            © {new Date().getFullYear()} Smart Parking — Nhóm 8
          </div>
        </div>

        {/* Cột phải: form đăng nhập */}
        <div className="w-full md:w-1/2 p-8 md:p-10">
          <div className="flex justify-center md:justify-start mb-6 md:mb-8 md:hidden">
            <div className="bg-blue-600 p-3 rounded-full">
              <Car className="w-8 h-8 text-white" />
            </div>
          </div>

          <h2 className="text-2xl md:text-3xl font-bold text-center md:text-left text-gray-800">
            {isSignup ? "Tạo tài khoản" : "Đăng nhập"}
          </h2>
          <p className="text-gray-500 text-center md:text-left mt-2 mb-6">
            Smart Parking System
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tên đăng nhập
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  name="username"
                  placeholder="Nhập username"
                  value={formData.username}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  required
                  minLength={3}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mật khẩu
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="Nhập mật khẩu"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition"
            >
              {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
              {isSignup ? "Đăng ký" : "Đăng nhập"}
            </button>
          </form>

          <p className="text-center md:text-left text-gray-600 mt-6 text-sm">
            {isSignup ? "Đã có tài khoản?" : "Chưa có tài khoản?"}{" "}
            <Link
              to={isSignup ? "/login" : "/signup"}
              className="text-blue-600 font-semibold hover:underline"
            >
              {isSignup ? "Đăng nhập" : "Đăng ký ngay"}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
