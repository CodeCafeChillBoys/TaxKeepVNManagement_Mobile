import { Platform } from 'react-native';

// Khi chạy máy ảo Android: 10.0.2.2 trỏ về localhost máy tính
// Khi chạy Web: ưu tiên localhost hoặc hostname trình duyệt đang mở
// Khi chạy điện thoại thật: dùng EXPO_PUBLIC_API_URL từ .env
const getLocalApiBaseUrl = () => {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location) {
      const hostname = window.location.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:5023';
      }
      if (hostname) {
        return `http://${hostname}:5023`;
      }
    }
    return 'http://localhost:5023';
  }
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5023';
  }
  return 'http://localhost:5023';
};

const getLocalAiBaseUrl = () => {
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
  return process.env.EXPO_PUBLIC_AI_URL || 'http://192.168.110.127:8000';
};

export const config = {
  // Thay đổi IP này nếu bạn test qua điện thoại thật nối cùng mạng Wi-Fi
  apiBaseUrl: getLocalApiBaseUrl(),
  aiBaseUrl: getLocalAiBaseUrl(),
  geminiApiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY || '',
  appName: 'TaxKeep VN',
  storageKeys: {
    accessToken: 'taxkeep_access_token',
    refreshToken: 'taxkeep_refresh_token',
    userData: 'taxkeep_user_data',
  },
};
