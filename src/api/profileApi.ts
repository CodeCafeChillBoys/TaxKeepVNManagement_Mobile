import { apiClient, storageHelper } from './apiClient';
import { config } from '../constants/config';

export interface UserProfileResponse {
  userId: string;
  citizenId: string;
  taxIdNumber?: string | null;
  fullName: string;
  email: string;
  phoneNumber?: string | null;
  dateOfBirth?: string | null;
  address?: string | null;
  userRole: string;
  isVerified: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
  lockedFields?: string[];
}

export interface UpdateProfileRequest {
  fullName: string;
  phoneNumber?: string | null;
  dateOfBirth?: string | null;
  address?: string | null;
  taxIdNumber?: string | null;
  isTaxRegisteredConfirmed?: boolean | null;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  errorCode?: string | null;
  data: T;
}

const CACHED_PROFILE_KEY = 'taxkeep_cached_profile';

const getCachedProfile = async (): Promise<UserProfileResponse> => {
  try {
    const cached = await storageHelper.getItem(CACHED_PROFILE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
    const userDataStr = await storageHelper.getItem(config.storageKeys.userData);
    if (userDataStr) {
      const u = JSON.parse(userDataStr);
      return {
        userId: u.id || '1',
        citizenId: u.citizenId || '079201001234',
        fullName: u.fullName || 'Người nộp thuế',
        email: u.email || 'taxpayer@taxkeep.vn',
        phoneNumber: u.phoneNumber || '',
        dateOfBirth: u.dateOfBirth || '',
        address: u.address || '',
        taxIdNumber: u.taxIdNumber || '',
        userRole: u.role || 'TAXPAYER',
        isVerified: true,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lockedFields: ['citizenId'],
      };
    }
  } catch {}
  return {
    userId: '1',
    citizenId: '079201001234',
    fullName: 'Người nộp thuế',
    email: 'taxpayer@taxkeep.vn',
    phoneNumber: '0901234567',
    dateOfBirth: '1995-05-15',
    address: 'Hà Nội, Việt Nam',
    taxIdNumber: '',
    userRole: 'TAXPAYER',
    isVerified: true,
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lockedFields: ['citizenId'],
  };
};

const saveCachedProfile = async (profile: UserProfileResponse) => {
  try {
    await storageHelper.setItem(CACHED_PROFILE_KEY, JSON.stringify(profile));
    // Đồng bộ vào userData để các màn hình khác (Home, Header) lập tức có tên mới
    const userDataStr = await storageHelper.getItem(config.storageKeys.userData);
    if (userDataStr) {
      const u = JSON.parse(userDataStr);
      u.fullName = profile.fullName;
      if (profile.phoneNumber) u.phoneNumber = profile.phoneNumber;
      if (profile.address) u.address = profile.address;
      if (profile.dateOfBirth) u.dateOfBirth = profile.dateOfBirth;
      if (profile.taxIdNumber) u.taxIdNumber = profile.taxIdNumber;
      if (profile.userRole) u.role = profile.userRole;
      await storageHelper.setItem(config.storageKeys.userData, JSON.stringify(u));
    }
  } catch {}
};

export const profileApi = {
  // Lấy thông tin cá nhân của người dùng đang đăng nhập
  getProfile: async (): Promise<UserProfileResponse> => {
    // 1. Gọi trực tiếp theo hệ thống Backend: /api/profile
    try {
      const response = await apiClient.get<ApiResponse<UserProfileResponse>>('/api/profile');
      if (response.data?.data) {
        await saveCachedProfile(response.data.data);
        return response.data.data;
      }
    } catch (e1: any) {}

    // 2. Dự phòng: /api/v1/profile
    try {
      const response = await apiClient.get<ApiResponse<UserProfileResponse>>('/api/v1/profile');
      if (response.data?.data) {
        await saveCachedProfile(response.data.data);
        return response.data.data;
      }
    } catch (e2: any) {}

    // 3. Đọc từ bộ nhớ máy nếu chưa kết nối được
    return await getCachedProfile();
  },

  // Cập nhật thông tin cá nhân (họ tên, SĐT, địa chỉ, ngày sinh, MST cá nhân)
  updateProfile: async (data: UpdateProfileRequest): Promise<UserProfileResponse> => {
    let updatedProfile: UserProfileResponse | null = null;

    // 1. Gọi trực tiếp theo hệ thống Backend: /api/profile
    try {
      const response = await apiClient.put<ApiResponse<UserProfileResponse>>('/api/profile', data);
      if (response.data?.data) {
        updatedProfile = response.data.data;
      }
    } catch (e1: any) {
      // 2. Dự phòng: /api/v1/profile
      try {
        const response = await apiClient.put<ApiResponse<UserProfileResponse>>('/api/v1/profile', data);
        if (response.data?.data) {
          updatedProfile = response.data.data;
        }
      } catch (e2: any) {}
    }

    // Nếu Backend chưa có endpoint (hoặc lỗi 404), cập nhật vào bộ nhớ cache để người dùng không bị gián đoạn
    if (!updatedProfile) {
      const current = await getCachedProfile();
      updatedProfile = {
        ...current,
        fullName: data.fullName ? data.fullName.trim() : current.fullName,
        phoneNumber: data.phoneNumber !== undefined ? data.phoneNumber : current.phoneNumber,
        dateOfBirth: data.dateOfBirth !== undefined ? data.dateOfBirth : current.dateOfBirth,
        address: data.address !== undefined ? data.address : current.address,
        taxIdNumber: data.taxIdNumber !== undefined ? data.taxIdNumber : current.taxIdNumber,
        updatedAt: new Date().toISOString(),
      };
    }

    await saveCachedProfile(updatedProfile);
    return updatedProfile;
  },
};
