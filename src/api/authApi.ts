import { apiClient } from './apiClient';
import { RegisterFormData, LoginFormData } from '../utils/validation';

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  errorCode?: string | null;
  errors?: Record<string, string[]>;
}

export interface LoginResponseData {
  token?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  userId?: string;
  citizenId?: string;
  fullName?: string;
  email?: string;
  userRole?: string;
  isVerified?: boolean;
  user?: {
    id: string;
    citizenId: string;
    fullName: string;
    email: string;
    role?: string;
  };
}

export interface ChangePasswordRequest {
  userId?: string | number;
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

export const authApi = {
  // Đăng ký tài khoản mới (POST /api/auth/register)
  async register(data: RegisterFormData): Promise<ApiResponse<any>> {
    const payload = {
      citizenId: data.citizenId,
      fullName: data.fullName,
      email: data.email.toLowerCase().trim(),
      password: data.password,
      phoneNumber: data.phoneNumber || null,
      dateOfBirth: data.dateOfBirth ? data.dateOfBirth : null,
      address: data.address || null,
    };

    const res = await apiClient.post<ApiResponse<any>>('/api/v1/auth/register', payload);
    return res.data;
  },

  // Đăng nhập (POST /api/auth/login)
  async login(data: LoginFormData): Promise<ApiResponse<LoginResponseData>> {
    const payload = {
      citizenId: data.account.trim(),
      password: data.password,
    };

    const res = await apiClient.post<ApiResponse<LoginResponseData>>('/api/v1/auth/login', payload);
    return res.data;
  },

  // Đăng xuất (POST /api/auth/logout)
  async logout(): Promise<ApiResponse<any>> {
    const res = await apiClient.post<ApiResponse<any>>('/api/v1/auth/logout');
    return res.data;
  },

  // Đổi mật khẩu (PUT /api/auth/change-password)
  async changePassword(data: ChangePasswordRequest): Promise<ApiResponse<any>> {
    const payload = {
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
      confirmNewPassword: data.confirmNewPassword,
    };
    const res = await apiClient.put<ApiResponse<any>>('/api/v1/auth/change-password', payload);
    return res.data;
  },
};
