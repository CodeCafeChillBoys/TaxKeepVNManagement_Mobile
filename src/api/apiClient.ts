import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { config, getLocalApiBaseUrl } from '../constants/config';

// Hỗ trợ lưu token an toàn: trên thiết bị dùng SecureStore, trên Web dùng localStorage
export const storageHelper = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    }
    return await SecureStore.getItemAsync(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        localStorage.setItem(key, value);
      } catch {}
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },

  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        localStorage.removeItem(key);
      } catch {}
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

export const apiClient = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Request Interceptor: baseURL động (LAN máy thật) + Bearer Token
apiClient.interceptors.request.use(
  async (reqConfig) => {
    reqConfig.baseURL = getLocalApiBaseUrl();
    const token = await storageHelper.getItem(config.storageKeys.accessToken);
    if (token && reqConfig.headers) {
      reqConfig.headers.Authorization = `Bearer ${token}`;
    }
    return reqConfig;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Xử lý lỗi hệ thống & token hết hạn (401)
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await storageHelper.removeItem(config.storageKeys.accessToken);
      await storageHelper.removeItem(config.storageKeys.refreshToken);
      await storageHelper.removeItem(config.storageKeys.userData);
    }
    return Promise.reject(error);
  }
);

