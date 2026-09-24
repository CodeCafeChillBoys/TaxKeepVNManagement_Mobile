import { NativeModules, Platform } from 'react-native';

const API_PORT = 5023;

/**
 * IP Wi‑Fi của PC (ipconfig → Wireless LAN).
 * Đổi nếu máy đổi mạng / IP. Máy thật Expo Go bắt buộc dùng LAN, không dùng 10.0.2.2.
 */
export const DEV_LAN_HOST = '192.168.2.22';

/** Host Metro / Expo từ bundle URL (nếu có). */
function getDevServerHost(): string | null {
  const scriptURL: string | undefined = NativeModules.SourceCode?.scriptURL;
  if (!scriptURL) return null;
  const match = scriptURL.match(/https?:\/\/([^/:]+)/);
  return match?.[1] ?? null;
}

/**
 * - Ưu tiên EXPO_PUBLIC_API_URL / EXPO_PUBLIC_API_BASE_URL
 * - Rồi host Metro (LAN) — máy thật Android/iPhone
 * - Web: localhost hoặc window.location.hostname
 * - Emulator Android cổ điển: 10.0.2.2
 * - Fallback thiết bị thật: DEV_LAN_HOST
 */
export function getLocalApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim() || process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location) {
      const hostname = window.location.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return `http://localhost:${API_PORT}`;
      }
      if (hostname) {
        return `http://${hostname}:${API_PORT}`;
      }
    }
    return `http://localhost:${API_PORT}`;
  }

  const host = getDevServerHost();
  if (host === '10.0.2.2') {
    return `http://10.0.2.2:${API_PORT}`;
  }
  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    return `http://${host}:${API_PORT}`;
  }

  // Máy thật (Android / iPhone): luôn LAN PC, không dùng localhost
  if (Platform.OS === 'android' || Platform.OS === 'ios') {
    return `http://${DEV_LAN_HOST}:${API_PORT}`;
  }
  return `http://localhost:${API_PORT}`;
}

export function getLocalAiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_AI_URL?.trim()) {
    return process.env.EXPO_PUBLIC_AI_URL.trim().replace(/\/+$/, '');
  }
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location) {
      const hostname = window.location.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:8000';
      }
      if (hostname) {
        return `http://${hostname}:8000`;
      }
    }
    return 'http://localhost:8000';
  }
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000';
  }
  return 'http://localhost:8000';
}

export const config = {
  /** Getter — luôn resolve lại (tránh kẹt 10.0.2.2 lúc import module). */
  get apiBaseUrl() {
    return getLocalApiBaseUrl();
  },
  get aiBaseUrl() {
    return getLocalAiBaseUrl();
  },
  appName: 'TaxKeep VN',
  storageKeys: {
    accessToken: 'taxkeep_access_token',
    refreshToken: 'taxkeep_refresh_token',
    userData: 'taxkeep_user_data',
  },
};
