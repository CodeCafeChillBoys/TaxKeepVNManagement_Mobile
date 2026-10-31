import { apiClient } from './apiClient';
import type { ApiResponse } from './authApi';

export interface PendingEscrowDetailResponse {
  escrowId: string;
  bookingId: string;
  bookingCode: string;
  taxpayerName: string;
  totalAmount: number;
  commissionRate: number;
  commissionAmount: number;
  expertReceivable: number;
  escrowStatus: string;
  escrowStatusDescription: string;
  paidAt?: string | null;
  consultationTime?: string | null;
  estimatedReleaseAt?: string | null;
}

export interface WalletResponse {
  id: string;
  userId: string;
  walletType: string;
  availableBalance: number;
  frozenBalance: number;
  totalEarned: number;
  totalWithdrawn: number;
  pendingEscrowReceivable?: number;
  pendingEscrowDetails?: PendingEscrowDetailResponse[];
  updatedAt: string;
  recentTransactions?: WalletTransactionResponse[];
}

export interface WalletTransactionResponse {
  id: string;
  walletId: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  transactionType: string;
  referenceId?: string | null;
  description: string;
  createdAt: string;
}

export interface CreateWithdrawalRequest {
  amount: number;
  bankName: string;
  accountNumber: string;
  accountName: string;
}

export interface WithdrawalResponse {
  id: string;
  userId: string;
  userFullName?: string;
  amount: number;
  bankName: string;
  accountNumber: string;
  accountName: string;
  status: string; // PENDING | COMPLETED | REJECTED
  rejectionReason?: string | null;
  transactionReference?: string | null;
  adminNotes?: string | null;
  createdAt: string;
  processedAt?: string | null;
}

export interface WalletTopUpRequest {
  amount: number;
  returnUrl?: string;
}

export interface WalletTopUpResponse {
  orderCode: number;
  amount: number;
  paymentGateway: string;
  checkoutUrl?: string | null;
  qrCode?: string | null;
  createdAt: string;
}

export interface PagedWalletResult<T> {
  items: T[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export const walletApi = {
  /**
   * Nạp tiền vào ví cá nhân thông qua cổng thanh toán VNPay / VietQR
   * POST /api/v1/wallets/top-up
   */
  async topUpWallet(data: WalletTopUpRequest): Promise<WalletTopUpResponse> {
    const res = await apiClient.post<ApiResponse<WalletTopUpResponse>>('/api/v1/wallets/top-up', data);
    if (!res.data.data) {
      throw new Error(res.data.message || 'Không thể tạo yêu cầu nạp tiền vào ví.');
    }
    return res.data.data;
  },

  /**
   * Lấy thông tin số dư ví điện tử cá nhân và các giao dịch gần nhất
   * walletType: 'EXPERT' (Ví thu nhập chuyên gia) | 'USER' (Ví hoàn tiền người nộp thuế)
   */
  async getMyWallet(walletType?: 'EXPERT' | 'USER'): Promise<WalletResponse> {
    const params: Record<string, string> = {};
    if (walletType) params.walletType = walletType;
    const res = await apiClient.get<ApiResponse<WalletResponse>>('/api/v1/wallets/me', { params });
    if (!res.data.data) {
      throw new Error(res.data.message || 'Không thể lấy thông tin ví.');
    }
    return res.data.data;
  },

  /**
   * Lấy toàn bộ lịch sử biến động số dư ví
   */
  async getMyWalletTransactions(
    page: number = 1,
    size: number = 20,
    transactionType?: string
  ): Promise<PagedWalletResult<WalletTransactionResponse>> {
    const params: Record<string, any> = { page, size };
    if (transactionType && transactionType !== 'ALL') {
      params.transactionType = transactionType;
    }
    const res = await apiClient.get<ApiResponse<any>>('/api/v1/wallets/me/transactions', {
      params,
    });
    const d = res.data?.data;
    if (!d) {
      return { items: [], pageNumber: page, pageSize: size, totalCount: 0, totalPages: 0 };
    }
    const items = Array.isArray(d.items) ? d.items : Array.isArray(d) ? d : [];
    const p = d.pagination || {};
    return {
      items,
      pageNumber: p.page ?? d.pageNumber ?? d.page ?? page,
      pageSize: p.pageSize ?? d.pageSize ?? d.size ?? size,
      totalCount: p.totalItems ?? d.totalCount ?? d.totalItems ?? items.length,
      totalPages: p.totalPages ?? d.totalPages ?? 1,
    };
  },

  /**
   * Chuyên gia: Xem danh sách chi tiết các ca tư vấn đang tạm giữ tiền trong quỹ Escrow chờ giải ngân
   * GET /api/v1/expert/wallets/pending-escrow
   */
  async getExpertPendingEscrow(): Promise<PendingEscrowDetailResponse[]> {
    const res = await apiClient.get<ApiResponse<PendingEscrowDetailResponse[]>>(
      '/api/v1/expert/wallets/pending-escrow'
    );
    return Array.isArray(res.data?.data) ? res.data.data : [];
  },

  /**
   * Chuyên gia: Tạo yêu cầu rút thù lao về tài khoản ngân hàng
   */
  async requestExpertWithdrawal(data: CreateWithdrawalRequest): Promise<WithdrawalResponse> {
    const res = await apiClient.post<ApiResponse<WithdrawalResponse>>('/api/v1/expert/wallets/withdraw', data);
    if (!res.data.data) {
      throw new Error(res.data.message || 'Không thể tạo yêu cầu rút tiền.');
    }
    return res.data.data;
  },

  /**
   * Chuyên gia: Xem danh sách lệnh rút tiền của mình
   */
  async getMyExpertWithdrawals(status?: string, page: number = 1, size: number = 20): Promise<PagedWalletResult<WithdrawalResponse>> {
    const params: Record<string, any> = { page, size };
    if (status) params.status = status;
    const res = await apiClient.get<ApiResponse<any>>('/api/v1/expert/wallets/withdrawals', { params });
    const d = res.data?.data;
    if (!d) {
      return { items: [], pageNumber: page, pageSize: size, totalCount: 0, totalPages: 0 };
    }
    const items = Array.isArray(d.items) ? d.items : Array.isArray(d) ? d : [];
    const p = d.pagination || {};
    return {
      items,
      pageNumber: p.page ?? d.pageNumber ?? d.page ?? page,
      pageSize: p.pageSize ?? d.pageSize ?? d.size ?? size,
      totalCount: p.totalItems ?? d.totalCount ?? d.totalItems ?? items.length,
      totalPages: p.totalPages ?? d.totalPages ?? 1,
    };
  },

  /**
   * Khách hàng: Tạo yêu cầu rút tiền hoàn về tài khoản ngân hàng
   */
  async requestUserWithdrawal(data: CreateWithdrawalRequest): Promise<WithdrawalResponse> {
    const res = await apiClient.post<ApiResponse<WithdrawalResponse>>('/api/v1/user/wallets/withdraw', data);
    if (!res.data.data) {
      throw new Error(res.data.message || 'Không thể tạo yêu cầu rút tiền hoàn.');
    }
    return res.data.data;
  },

  /**
   * Khách hàng: Xem danh sách yêu cầu rút tiền hoàn của mình
   */
  async getMyUserWithdrawals(status?: string, page: number = 1, size: number = 20): Promise<PagedWalletResult<WithdrawalResponse>> {
    const params: Record<string, any> = { page, size };
    if (status) params.status = status;
    const res = await apiClient.get<ApiResponse<any>>('/api/v1/user/wallets/withdrawals', { params });
    const d = res.data?.data;
    if (!d) {
      return { items: [], pageNumber: page, pageSize: size, totalCount: 0, totalPages: 0 };
    }
    const items = Array.isArray(d.items) ? d.items : Array.isArray(d) ? d : [];
    const p = d.pagination || {};
    return {
      items,
      pageNumber: p.page ?? d.pageNumber ?? d.page ?? page,
      pageSize: p.pageSize ?? d.pageSize ?? d.size ?? size,
      totalCount: p.totalItems ?? d.totalCount ?? d.totalItems ?? items.length,
      totalPages: p.totalPages ?? d.totalPages ?? 1,
    };
  },
};
