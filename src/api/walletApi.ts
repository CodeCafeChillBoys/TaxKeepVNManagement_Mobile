import { apiClient } from './apiClient';
import type { ApiResponse } from './authApi';

export interface WalletResponse {
  id: string;
  userId: string;
  walletType: string;
  availableBalance: number;
  frozenBalance: number;
  totalEarned: number;
  totalWithdrawn: number;
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

export interface PagedWalletResult<T> {
  items: T[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export const walletApi = {
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
  async getMyWalletTransactions(page: number = 1, size: number = 20): Promise<PagedWalletResult<WalletTransactionResponse>> {
    const res = await apiClient.get<ApiResponse<PagedWalletResult<WalletTransactionResponse>>>('/api/v1/wallets/me/transactions', {
      params: { page, size },
    });
    if (!res.data.data) {
      return { items: [], pageNumber: page, pageSize: size, totalCount: 0, totalPages: 0 };
    }
    return res.data.data;
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
    const res = await apiClient.get<ApiResponse<PagedWalletResult<WithdrawalResponse>>>('/api/v1/expert/wallets/withdrawals', { params });
    if (!res.data.data) {
      return { items: [], pageNumber: page, pageSize: size, totalCount: 0, totalPages: 0 };
    }
    return res.data.data;
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
    const res = await apiClient.get<ApiResponse<PagedWalletResult<WithdrawalResponse>>>('/api/v1/user/wallets/withdrawals', { params });
    if (!res.data.data) {
      return { items: [], pageNumber: page, pageSize: size, totalCount: 0, totalPages: 0 };
    }
    return res.data.data;
  },
};
