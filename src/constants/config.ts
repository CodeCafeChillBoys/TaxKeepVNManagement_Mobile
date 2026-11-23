import Constants from 'expo-constants';
import { NativeModules, Platform } from 'react-native';

const API_PORT = 5023;
const AI_PORT = 5000;
const WEB_PORT = 8081;

/**
 * Tự động trích xuất IP LAN của máy tính đang chạy Metro Bundler.
 * Hoạt động trên Expo Go & Dev Client (iOS / Android thật).
 * Khi máy tính đổi mạng Wi-Fi (ở nhà, cty, quán cafe, hay 4G hotspot):
 * Metro tự cấp IP mới cho app -> App tự động kết nối API mà KHÔNG CẦN sửa IP thủ công!
 */
export function getAutoDetectedHost(): string | null {
  // 1. Expo Constants hostUri (chuẩn nhất cho Expo SDK hiện đại)
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest?.debuggerHost ||
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost ||
    (Constants as any).manifest2?.extra?.expoClient?.hostUri;

  if (hostUri && typeof hostUri === 'string') {
    const ip = hostUri.split(':')[0]?.trim();
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return ip;
    }
  }

  // 2. Linking URI từ Expo (ví dụ: exp://192.168.1.10:8081)
  if (Constants.linkingUri && typeof Constants.linkingUri === 'string') {
    const match = Constants.linkingUri.match(/^[a-zA-Z0-9+.-]+:\/\/([^/:]+)/);
    const ip = match?.[1]?.trim();
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return ip;
    }
  }

  // 3. React Native SourceCode scriptURL
  const scriptURL: string | undefined = NativeModules.SourceCode?.scriptURL;
  if (scriptURL && typeof scriptURL === 'string') {
    const match = scriptURL.match(/https?:\/\/([^/:]+)/);
    const ip = match?.[1]?.trim();
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return ip;
    }
  }

  return null;
}

/**
 * IP dự phòng khi chạy offline hoặc môi trường test không có Metro.
 */
export const DEV_LAN_HOST = '192.168.110.124';

/**
 * Kiểm tra xem URL cấu hình trong biến môi trường có phải máy chủ public / đã deploy
 * (https://... hoặc http:// trỏ tới IP/domain public, không phải localhost hay mạng LAN nội bộ).
 */
function isRemoteServerUrl(rawUrl?: string): boolean {
  if (!rawUrl) return false;
  if (rawUrl.startsWith('https://')) return true;
  const match = rawUrl.match(/^http:\/\/([^/:]+)/i);
  if (!match) return false;
  const host = match[1].toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host === '10.0.2.2') return false;
  if (host.startsWith('192.168.') || host.startsWith('10.')) return false;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return false;
  return true;
}

/**
 * - Web: localhost hoặc hostname trình duyệt
 * - Ưu tiên URL production / tunnel / server đã deploy từ biến môi trường nếu có
 * - Tự động nhận diện IP LAN từ Metro Bundler (Expo Go trên điện thoại thật)
 * - Fallback: DEV_LAN_HOST hoặc 10.0.2.2 (Android emulator)
 */
export function getLocalApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim() || process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  // Nếu có URL cố định dạng domain https hoặc IP/domain server đã deploy (vd http://13.236.166.3:5000), ưu tiên dùng trên mọi nền tảng
  if (fromEnv && isRemoteServerUrl(fromEnv)) {
    return fromEnv.replace(/\/+$/, '');
  }

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

  // TỰ ĐỘNG nhận diện IP từ Metro Bundler (không cần cấu hình thủ công)
  const autoHost = getAutoDetectedHost();
  if (autoHost) {
    if (autoHost === '10.0.2.2') {
      return `http://10.0.2.2:${API_PORT}`;
    }
    return `http://${autoHost}:${API_PORT}`;
  }

  // Máy thật Android / iOS fallback
  if (Platform.OS === 'android' || Platform.OS === 'ios') {
    return `http://${DEV_LAN_HOST}:${API_PORT}`;
  }
  return `http://localhost:${API_PORT}`;
}

export function getLocalAiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_AI_URL?.trim();
  if (fromEnv && isRemoteServerUrl(fromEnv)) {
    return fromEnv.replace(/\/+$/, '');
  }

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location) {
      const hostname = window.location.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return `http://localhost:${AI_PORT}`;
      }
      if (hostname) {
        return `http://${hostname}:${AI_PORT}`;
      }
    }
    return `http://localhost:${AI_PORT}`;
  }

  const autoHost = getAutoDetectedHost();
  if (autoHost) {
    if (autoHost === '10.0.2.2') {
      return `http://10.0.2.2:${AI_PORT}`;
    }
    return `http://${autoHost}:${AI_PORT}`;
  }

  if (fromEnv) {
    return fromEnv.replace(/\/+$/, '');
  }

  if (Platform.OS === 'android' || Platform.OS === 'ios') {
    return `http://${DEV_LAN_HOST}:${AI_PORT}`;
  }
  return `http://localhost:${AI_PORT}`;
}

export const PRODUCTION_WEB_FRONTEND_URL = 'https://taxkeepvn.vercel.app';

export function getLocalWebFrontendUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_WEB_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/+$/, '');
  }

  // Trên trình duyệt Web dev, giữ window.location.origin nếu đang chạy local dev
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin;
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return origin;
    }
  }

  // Mặc định luôn trỏ về trang web frontend đã deploy trên Vercel
  return PRODUCTION_WEB_FRONTEND_URL;
}

export const config = {
  /** Getter — luôn resolve lại (tránh kẹt IP cũ lúc import module). */
  get apiBaseUrl() {
    return getLocalApiBaseUrl();
  },
  get aiBaseUrl() {
    return getLocalAiBaseUrl();
  },
  get webFrontendUrl() {
    return getLocalWebFrontendUrl();
  },
  appName: 'TaxKeep VN',
  storageKeys: {
    accessToken: 'taxkeep_access_token',
    refreshToken: 'taxkeep_refresh_token',
    userData: 'taxkeep_user_data',
  },
};

