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
        const user = JSON.parse(userDataStr);
        set({ token, user, isAuthenticated: true, isLoading: false });
        return;
      }
    } catch {}
    set({ token: null, user: null, isAuthenticated: false, isLoading: false });
  },
}));
