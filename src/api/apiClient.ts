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

// Request Interceptor: baseURL động (LAN máy thật) + Bearer Token + FormData boundary fix
apiClient.interceptors.request.use(
  async (reqConfig) => {
    reqConfig.baseURL = getLocalApiBaseUrl();
    const token = await storageHelper.getItem(config.storageKeys.accessToken);
    if (token && reqConfig.headers) {
      reqConfig.headers.Authorization = `Bearer ${token}`;
    }
    // Khi gửi FormData trong React Native hoặc Web, cần xóa Content-Type để runtime tự tạo multipart boundary
    const isFormData =
      reqConfig.data &&
      ((typeof FormData !== 'undefined' && reqConfig.data instanceof FormData) ||
        Boolean((reqConfig.data as any)?._parts) ||
        (reqConfig.data as any)?.constructor?.name === 'FormData' ||
        typeof (reqConfig.data as any)?.append === 'function');

    if (isFormData && reqConfig.headers) {
      if (typeof (reqConfig.headers as any).delete === 'function') {
        (reqConfig.headers as any).delete('Content-Type');
        (reqConfig.headers as any).delete('content-type');
      }
      delete reqConfig.headers['Content-Type'];
      delete reqConfig.headers['content-type'];
      (reqConfig.headers as any)['Content-Type'] = undefined;
      (reqConfig.headers as any)['content-type'] = undefined;
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
      try {
        const { useAuthStore } = await import('../stores/useAuthStore');
        useAuthStore.setState({ token: null, user: null, isAuthenticated: false });
      } catch {}
    }
    if (error.response?.status === 400) {
      console.warn(
        `[API 400] ${error.config?.method?.toUpperCase()} ${error.config?.baseURL || ''}${error.config?.url || ''}`,
        error.response?.data
      );
    }
    return Promise.reject(error);
  }
);

