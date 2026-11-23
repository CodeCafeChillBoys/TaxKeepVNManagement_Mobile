import { create } from 'zustand';
import { storageHelper } from '../api/apiClient';
import {
  applyGlobalThemeMode,
  DARK_THEME_COLORS,
  LIGHT_THEME_COLORS,
} from '../constants/theme';

export type ThemeMode = 'light' | 'dark';

const THEME_STORAGE_KEY = 'taxkeep_theme_mode';

export const LIGHT_COLORS = LIGHT_THEME_COLORS;
export const DARK_COLORS = DARK_THEME_COLORS;

interface ThemeState {
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
  loadTheme: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'light',
  isDark: false,

  setMode: async (mode: ThemeMode) => {
    applyGlobalThemeMode(mode);
    set({ mode, isDark: mode === 'dark' });
    try {
      await storageHelper.setItem(THEME_STORAGE_KEY, mode);
    } catch {}
  },

  toggleTheme: async () => {
    const next: ThemeMode = get().mode === 'dark' ? 'light' : 'dark';
    await get().setMode(next);
  },

  loadTheme: async () => {
    try {
      const saved = await storageHelper.getItem(THEME_STORAGE_KEY);
      if (saved === 'dark' || saved === 'light') {
        applyGlobalThemeMode(saved);
        set({ mode: saved, isDark: saved === 'dark' });
      }
    } catch {}
  },
}));
