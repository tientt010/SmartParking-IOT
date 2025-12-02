import axios from "axios";

export const AxiosInstance = axios.create({
  baseURL: "http://localhost:3000/api",
  headers: {
    "Content-Type": "application/json",
  },
});

AxiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

AxiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const skipAutoLogout = error.config?.skipAutoLogout;

    if (error.response?.status === 401 && !skipAutoLogout) {
      localStorage.removeItem("token");
      import("../store/useAuthStore").then(({ useAuthStore }) => {
        useAuthStore.getState().logout();
      });

      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);
