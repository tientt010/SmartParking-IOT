import { create } from "zustand";
import { persist } from "zustand/middleware";
import { AxiosInstance } from "../lib/axios";

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (credentials) => {
        set({ isLoading: true, error: null });
        try {
          const response = await AxiosInstance.post("/auth/login", credentials);
          const { token, user } = response.data;

          localStorage.setItem("token", token);
          set({ token, user, isAuthenticated: true, isLoading: false });

          return true;
        } catch (error) {
          const errorMessage = error.response?.data?.message || "Login failed";
          set({ error: errorMessage, isLoading: false });
          return false;
        }
      },

      fetchUserInfo: async () => {
        const { token } = get();
        if (!token) {
          set({ isAuthenticated: false, user: null });
          return;
        }

        set({ isLoading: true });
        try {
          const response = await AxiosInstance.get("/auth/me");
          const user = response.data;
          set({
            user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          console.error("Failed to fetch user info:", error);
          get().logout();
          set({ isLoading: false });
        }
      },

      signup: async (userData) => {
        set({ isLoading: true, error: null });
        try {
          const response = await AxiosInstance.post("/auth/signup", {
            username: userData.username,
            password: userData.password,
            role: "admin",
          });
          const { token, user } = response.data;

          localStorage.setItem("token", token);
          set({ token, user, isAuthenticated: true, isLoading: false });

          return true;
        } catch (error) {
          const errorMessage = error.response?.data?.message || "Signup failed";
          set({ error: errorMessage, isLoading: false });
          return false;
        }
      },

      logout: () => {
        localStorage.removeItem("token");
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          error: null,
        });
      },

      clearError: () => set({ error: null }),

      initialize: async () => {
        const token = localStorage.getItem("token");
        if (token) {
          set({ token });
          await get().fetchUserInfo();
        }
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
