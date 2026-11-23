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

export interface ResetPasswordPayload {
  token: string;
  newPassword: string;
  confirmNewPassword: string;
}

export interface RegisterResponseData {
  userId?: string;
  fullName?: string;
  email?: string;
  citizenId?: string;
  userRole?: string;
  isVerified?: boolean;
  requiresEmailVerification?: boolean;
}

export const authApi = {
  // Đăng ký tài khoản mới (POST /api/v1/auth/register)
  async register(data: RegisterFormData): Promise<ApiResponse<RegisterResponseData>> {
    const payload = {
      citizenId: data.citizenId,
      fullName: data.fullName,
      email: data.email.toLowerCase().trim(),
      password: data.password,
      phoneNumber: data.phoneNumber || null,
      dateOfBirth: data.dateOfBirth ? data.dateOfBirth : null,
      address: data.address || null,
    };

    const res = await apiClient.post<ApiResponse<RegisterResponseData>>(
      '/api/v1/auth/register',
      payload
    );
    return res.data;
  },

  // 1. Xác minh email (GET /api/v1/auth/verify-email?token=string)
  async verifyEmail(token: string): Promise<ApiResponse<any>> {
    const res = await apiClient.get<ApiResponse<any>>('/api/v1/auth/verify-email', {
      params: { token: token.trim() },
    });
    return res.data;
  },

  // 2. Gửi lại mail xác minh (POST /api/v1/auth/resend-verification)
  async resendVerification(email: string): Promise<ApiResponse<any>> {
    const res = await apiClient.post<ApiResponse<any>>('/api/v1/auth/resend-verification', {
      email: email.trim().toLowerCase(),
    });
    return res.data;
  },

  // 3. Yêu cầu quên mật khẩu (POST /api/v1/auth/forgot-password)
  async forgotPassword(email: string): Promise<ApiResponse<any>> {
    const res = await apiClient.post<ApiResponse<any>>('/api/v1/auth/forgot-password', {
      email: email.trim().toLowerCase(),
    });
    return res.data;
  },

  // 4. Validate token đặt lại mật khẩu (GET /api/v1/auth/validate-reset-token?token=string)
  async validateResetToken(token: string): Promise<ApiResponse<{ valid?: boolean }>> {
    const res = await apiClient.get<ApiResponse<{ valid?: boolean }>>(
      '/api/v1/auth/validate-reset-token',
      {
        params: { token: token.trim() },
      }
    );
    return res.data;
  },

  // 5. Đặt lại mật khẩu mới (POST /api/v1/auth/reset-password)
  async resetPassword(data: ResetPasswordPayload): Promise<ApiResponse<any>> {
    const res = await apiClient.post<ApiResponse<any>>('/api/v1/auth/reset-password', {
      token: data.token.trim(),
      newPassword: data.newPassword,
      confirmNewPassword: data.confirmNewPassword,
    });
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
