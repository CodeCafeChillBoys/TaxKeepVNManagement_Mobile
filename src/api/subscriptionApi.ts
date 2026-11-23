import { apiClient } from './apiClient';
import type { ApiResponse } from './authApi';
import type {
  PurchaseSubscriptionRequest,
  SubscriptionPlan,
  SubscriptionPurchaseResult,
  SubscriptionQuotaStatus,
  UserSubscription,
} from '../types/subscription';

export const subscriptionApi = {
  /**
   * Danh sách gói đang mở bán
   * GET /api/v1/subscription/plans
   */
  async getPlans(): Promise<SubscriptionPlan[]> {
    const res = await apiClient.get<ApiResponse<SubscriptionPlan[]>>('/api/v1/subscription/plans');
    const plans = Array.isArray(res.data?.data) ? res.data.data : [];
    return [...plans].sort((a, b) => a.displayOrder - b.displayOrder);
  },

  /**
   * Gói đang sử dụng của người dùng
   * GET /api/v1/subscription/my
   */
  async getMySubscription(): Promise<UserSubscription | null> {
    const res = await apiClient.get<ApiResponse<UserSubscription>>('/api/v1/subscription/my');
    return res.data?.data ?? null;
  },

  /**
   * Mua / nâng cấp gói. Có returnUrl thì app phải gọi /api/v1/payments/vnpay-return để BE xác nhận đơn
   * POST /api/v1/subscription/purchase
   */
  async purchase(data: PurchaseSubscriptionRequest): Promise<SubscriptionPurchaseResult> {
    const res = await apiClient.post<ApiResponse<SubscriptionPurchaseResult>>('/api/v1/subscription/purchase', data);
    if (!res.data.data) {
      throw new Error(res.data.message || 'Không tạo được đơn mua gói.');
    }
    return res.data.data;
  },

  /**
   * Lịch sử các gói đã mua (gồm đơn đang chờ thanh toán)
   * GET /api/v1/subscription/history
   */
  async getHistory(): Promise<UserSubscription[]> {
    const res = await apiClient.get<ApiResponse<UserSubscription[]>>('/api/v1/subscription/history');
    return Array.isArray(res.data?.data) ? res.data.data : [];
  },

  /**
   * Hạn mức đã dùng / tối đa của gói hiện tại
   * GET /api/v1/subscription/quota
   */
  async getQuota(): Promise<SubscriptionQuotaStatus> {
    const res = await apiClient.get<ApiResponse<SubscriptionQuotaStatus>>('/api/v1/subscription/quota');
    if (!res.data.data) {
      throw new Error(res.data.message || 'Không tải được hạn mức gói.');
    }
    return res.data.data;
  },
};
