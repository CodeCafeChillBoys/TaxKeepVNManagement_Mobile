import { apiClient } from './apiClient';

export interface NotificationItem {
  notificationId: string;
  title: string;
  message: string;
  notificationType: string;
  isRead: boolean;
  targetActionUrl?: string | null;
  createdAt: string;
}

export interface NotificationQueryParams {
  page?: number;
  size?: number;
  isRead?: boolean;
  search?: string;
  sort?: string;
}

export interface NotificationListResponse {
  items: NotificationItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export const notificationApi = {
  // Lấy danh sách thông báo: GET /api/v1/notifications
  async getNotifications(params?: NotificationQueryParams): Promise<NotificationListResponse> {
    try {
      const response = await apiClient.get<any>('/api/v1/notifications', { params });
      const data = response.data?.data;
      if (data && Array.isArray(data.items)) {
        return data;
      }
      if (Array.isArray(data)) {
        return {
          items: data,
          pagination: { page: 1, pageSize: 20, totalItems: data.length, totalPages: 1 },
        };
      }
      return {
        items: [],
        pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 1 },
      };
    } catch (err: any) {
      if (__DEV__) {
        console.warn('notificationApi.getNotifications error:', err?.response?.data || err?.message);
      }
      return {
        items: [],
        pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 1 },
      };
    }
  },

  // Đánh dấu thông báo là đã đọc: PATCH /api/v1/notifications/{id}/read
  async markAsRead(notificationId: string): Promise<boolean> {
    try {
      await apiClient.patch(`/api/v1/notifications/${notificationId}/read`);
      return true;
    } catch (err: any) {
      if (__DEV__) {
        console.warn('notificationApi.markAsRead error:', err?.response?.data || err?.message);
      }
      return false;
    }
  },

  // Đếm số thông báo chưa đọc
  async getUnreadCount(): Promise<number> {
    try {
      const data = await notificationApi.getNotifications({ isRead: false, size: 1 });
      return data.pagination?.totalItems || 0;
    } catch {
      return 0;
    }
  },
};
