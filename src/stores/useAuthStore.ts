import { create } from 'zustand';
import { storageHelper } from '../api/apiClient';
import { config } from '../constants/config';
import { authApi } from '../api/authApi';

export interface UserProfile {
  id: string;
  citizenId: string;
  fullName: string;
  email: string;
  role?: string;
}

interface AuthState {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (token: string, user: UserProfile, refreshToken?: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,

  setAuth: async (token: string, user: UserProfile, refreshToken?: string) => {
    await storageHelper.setItem(config.storageKeys.accessToken, token);
    await storageHelper.setItem(config.storageKeys.userData, JSON.stringify(user));
    if (refreshToken) {
      await storageHelper.setItem(config.storageKeys.refreshToken, refreshToken);
    }
    try {
      const { useExpenseStore } = await import('./useExpenseStore');
      await useExpenseStore.getState().switchUser(user.id);
    } catch {}
    set({ token, user, isAuthenticated: true, isLoading: false });
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {}
    await storageHelper.removeItem(config.storageKeys.accessToken);
    await storageHelper.removeItem(config.storageKeys.refreshToken);
    await storageHelper.removeItem(config.storageKeys.userData);
    try {
      const { useExpenseStore } = await import('./useExpenseStore');
      await useExpenseStore.getState().clearAllExpenses();
    } catch {}
    set({ token: null, user: null, isAuthenticated: false, isLoading: false });
  },

  checkAuth: async () => {
    try {
      const token = await storageHelper.getItem(config.storageKeys.accessToken);
      const userDataStr = await storageHelper.getItem(config.storageKeys.userData);
      if (token && userDataStr) {
        // Kiểm tra thời hạn hiệu lực JWT token nếu có claim exp
        let isExpired = false;
        try {
          const parts = token.split('.');
          if (parts.length === 3) {
            const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
            const decodedStr = typeof atob === 'function' ? atob(padded) : '';
            if (decodedStr) {
              const payload = JSON.parse(decodedStr);
              if (payload.exp && typeof payload.exp === 'number') {
                isExpired = Date.now() >= payload.exp * 1000;
              }
            }
          }
        } catch {}

        if (isExpired) {
          await storageHelper.removeItem(config.storageKeys.accessToken);
          await storageHelper.removeItem(config.storageKeys.refreshToken);
          await storageHelper.removeItem(config.storageKeys.userData);
          set({ token: null, user: null, isAuthenticated: false, isLoading: false });
          return;
        }

        const user = JSON.parse(userDataStr);
        try {
          const { useExpenseStore } = await import('./useExpenseStore');
          await useExpenseStore.getState().loadFromStorage(user.id);
        } catch {}
        set({ token, user, isAuthenticated: true, isLoading: false });
        return;
      }
    } catch {}
    set({ token: null, user: null, isAuthenticated: false, isLoading: false });
  },
}));
