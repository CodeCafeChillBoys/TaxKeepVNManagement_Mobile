import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Image,
  Linking,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { DrumPatternBackdrop } from '../../components/brand/DrumPatternBackdrop';
import { GoldDoubleRule } from '../../components/brand/GoldDoubleRule';
import { Dialog } from '../../components/common/Dialog';
import { RootNavigationProp, RootStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../stores/useAuthStore';
import { config } from '../../constants/config';
import {
  walletApi,
  WalletResponse,
  WalletTransactionResponse,
  WithdrawalResponse,
  WalletTopUpResponse,
  PendingEscrowDetailResponse,
} from '../../api/walletApi';

const POPULAR_BANKS = [
  'Vietcombank',
  'MB Bank',
  'Techcombank',
  'BIDV',
  'VietinBank',
  'Agribank',
  'ACB',
  'VPBank',
  'TPBank',
  'Sacombank',
  'HDBank',
  'VIB',
  'MSB',
  'SHB',
  'SeABank',
  'OCB',
  'Eximbank',
];

function formatVnd(val?: number | string | null): string {
  if (val === null || val === undefined) return '0 ₫';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(num);
}

function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return `${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })}`;
  } catch {
    return String(dateStr);
  }
}

function formatEstimatedReleaseCountdown(dateStr?: string | null): string {
  if (!dateStr) return 'Đang cập nhật';
  try {
    const target = new Date(dateStr).getTime();
    if (isNaN(target)) return String(dateStr);
    const diffMs = target - Date.now();
    if (diffMs <= 0) {
      return `Đến hạn giải ngân (${formatDateTime(dateStr)})`;
    }
    const totalMins = Math.ceil(diffMs / 60000);
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      const remHours = hours % 24;
      return `Còn ${days} ngày ${remHours} giờ (${formatDateTime(dateStr)})`;
    }
    if (hours > 0) {
      return `Còn ${hours} giờ ${mins > 0 ? `${mins} phút ` : ''}(${formatDateTime(dateStr)})`;
    }
    return `Còn ${mins} phút (${formatDateTime(dateStr)})`;
  } catch {
    return String(dateStr);
  }
}

function formatTxType(type?: string): {
  label: string;
  badgeText: string;
  isPositive: boolean;
  icon: string;
  color: string;
  bg: string;
} {
  switch ((type || '').toUpperCase()) {
    case 'DISBURSEMENT':
      return {
        label: 'Đã giải ngân thù lao',
        badgeText: 'Đã giải ngân (+)',
        isPositive: true,
        icon: 'arrow-down-circle',
        color: '#059669',
        bg: '#ECFDF5',
      };
    case 'PAYMENT_CONSULTATION':
      return {
        label: 'Thanh toán phí tư vấn',
        badgeText: 'Thanh toán (-)',
        isPositive: false,
        icon: 'card-outline',
        color: '#D97706',
        bg: '#FEF3C7',
      };
    case 'PENDING_ESCROW':
      return {
        label: 'Tạm giữ bảo chứng Escrow',
        badgeText: 'Đang tạm giữ (+)',
        isPositive: true,
        icon: 'hourglass-outline',
        color: '#D97706',
        bg: '#FEF3C7',
      };
    case 'PENDING_COOLING_DOWN':
      return {
        label: 'Bảo chứng Cool-down 24h',
        badgeText: 'Chờ giải ngân 24h (+)',
        isPositive: true,
        icon: 'hourglass-outline',
        color: '#D97706',
        bg: '#FEF3C7',
      };
    case 'REFUND':
      return {
        label: 'Hoàn tiền ca tư vấn',
        badgeText: 'Hoàn tiền (+)',
        isPositive: true,
        icon: 'refresh-circle',
        color: '#2563EB',
        bg: '#EFF6FF',
      };
    case 'TOPUP':
      return {
        label: 'Nạp tiền vào ví',
        badgeText: 'Nạp tiền (+)',
        isPositive: true,
        icon: 'add-circle',
        color: '#059669',
        bg: '#ECFDF5',
      };
    case 'TOPUP_PENDING':
      return {
        label: 'Chờ nạp tiền vào ví',
        badgeText: 'Chờ nạp tiền',
        isPositive: false,
        icon: 'time-outline',
        color: '#D97706',
        bg: '#FEF3C7',
      };
    case 'TOPUP_FAILED':
      return {
        label: 'Nạp tiền không thành công',
        badgeText: 'Nạp thất bại',
        isPositive: false,
        icon: 'close-circle-outline',
        color: '#DC2626',
        bg: '#FEE2E2',
      };
    case 'WITHDRAWAL':
      return {
        label: 'Rút tiền về ngân hàng',
        badgeText: 'Đã rút tiền (-)',
        isPositive: false,
        icon: 'arrow-up-circle',
        color: '#DC2626',
        bg: '#FEE2E2',
      };
    case 'WITHDRAWAL_REFUND':
      return {
        label: 'Hoàn trả lệnh rút',
        badgeText: 'Hoàn lệnh rút (+)',
        isPositive: true,
        icon: 'return-up-back',
        color: '#059669',
        bg: '#ECFDF5',
      };
    case 'COMPENSATION':
      return {
        label: 'Bồi thường lịch hẹn',
        badgeText: 'Bồi thường (+)',
        isPositive: true,
        icon: 'shield-checkmark',
        color: '#059669',
        bg: '#ECFDF5',
      };
    case 'PENALTY':
      return {
        label: 'Phạt vi phạm cam kết',
        badgeText: 'Phạt (-)',
        isPositive: false,
        icon: 'alert-circle',
        color: '#DC2626',
        bg: '#FEE2E2',
      };
    case 'FROZEN':
      return {
        label: 'Tạm giữ xử lý',
        badgeText: 'Tạm giữ',
        isPositive: false,
        icon: 'lock-closed',
        color: '#DC2626',
        bg: '#FEE2E2',
      };
    case 'COMMISSION_EARNED':
    case 'PLATFORM_FEE':
      return {
        label: 'Phí dịch vụ nền tảng',
        badgeText: 'Phí nền tảng',
        isPositive: false,
        icon: 'layers-outline',
        color: '#6B7280',
        bg: '#F3F4F6',
      };
    default:
      return {
        label: 'Biến động số dư',
        badgeText: 'Biến động',
        isPositive: false,
        icon: 'cash-outline',
        color: '#6B7280',
        bg: '#F3F4F6',
      };
  }
}

function formatWithdrawalStatus(status?: string): { label: string; color: string; bg: string } {
  switch ((status || '').toUpperCase()) {
    case 'COMPLETED':
      return { label: 'Đã chuyển tiền', color: '#059669', bg: '#D1FAE5' };
    case 'REJECTED':
      return { label: 'Bị từ chối', color: '#DC2626', bg: '#FEE2E2' };
    case 'PENDING':
    default:
      return { label: 'Đang xử lý', color: '#D97706', bg: '#FEF3C7' };
  }
}

function parseFilterDate(input?: string | null, isEndOfDay: boolean = false): Date | null {
  if (!input || !input.trim()) return null;
  const clean = input.trim();
  const parts = clean.split(/[-/.]/);
  if (parts.length !== 3) return null;

  let year: number;
  let month: number;
  let day: number;

  if (parts[0].length === 4) {
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10) - 1;
    day = parseInt(parts[2], 10);
  } else {
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10) - 1;
    year = parseInt(parts[2], 10);
  }

  if (isNaN(year) || isNaN(month) || isNaN(day) || month < 0 || month > 11 || day < 1 || day > 31) {
    return null;
  }

  const d = new Date(
    year,
    month,
    day,
    isEndOfDay ? 23 : 0,
    isEndOfDay ? 59 : 0,
    isEndOfDay ? 59 : 0,
    isEndOfDay ? 999 : 0
  );
  return isNaN(d.getTime()) ? null : d;
}

function isDateInRange(
  dateStr: string,
  rangeType: 'ALL' | 'TODAY' | '7DAYS' | 'THIS_MONTH' | 'LAST_MONTH' | 'CUSTOM',
  customStart?: string,
  customEnd?: string
): boolean {
  if (rangeType === 'ALL') return true;
  if (!dateStr) return false;

  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return true;

  const now = new Date();
  if (rangeType === 'TODAY') {
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return d >= startOfToday && d <= endOfToday;
  }
  if (rangeType === '7DAYS') {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return d >= sevenDaysAgo;
  }
  if (rangeType === 'THIS_MONTH') {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    return d >= startOfMonth;
  }
  if (rangeType === 'LAST_MONTH') {
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return d >= startOfLastMonth && d <= endOfLastMonth;
  }
  if (rangeType === 'CUSTOM') {
    const s = parseFilterDate(customStart, false);
    const e = parseFilterDate(customEnd, true);
    if (s && d < s) return false;
    if (e && d > e) return false;
    return true;
  }
  return true;
}

export const WalletScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'Wallet'>>();
  const currentUser = useAuthStore((s) => s.user);

  const userRole = (currentUser?.role || '').toLowerCase();
  const isExpertRole = userRole === 'expert' || userRole.includes('expert');

  const [expertWallet, setExpertWallet] = useState<WalletResponse | null>(null);
  const [userWallet, setUserWallet] = useState<WalletResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'TRANSACTIONS' | 'WITHDRAWALS'>('TRANSACTIONS');

  // Source rút tiền (khi là chuyên gia: 'EXPERT' cho Thù lao tư vấn, 'USER' cho Tiền hoàn)
  const [withdrawSource, setWithdrawSource] = useState<'EXPERT' | 'USER'>('EXPERT');

  // Lịch sử biến động & lệnh rút
  const [transactions, setTransactions] = useState<WalletTransactionResponse[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalResponse[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Chi tiết giao dịch & lệnh rút
  const [selectedTransaction, setSelectedTransaction] = useState<WalletTransactionResponse | null>(null);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalResponse | null>(null);

  // Bộ lọc giao dịch & thời gian
  const [txTypeFilter, setTxTypeFilter] = useState<string>('ALL'); // ALL | IN | OUT | DISBURSEMENT | REFUND | TOPUP | WITHDRAWAL
  const [withdrawalStatusFilter, setWithdrawalStatusFilter] = useState<string>('ALL'); // ALL | PENDING | COMPLETED | REJECTED
  const [dateRangeFilter, setDateRangeFilter] = useState<'ALL' | 'TODAY' | '7DAYS' | 'THIS_MONTH' | 'LAST_MONTH' | 'CUSTOM'>('ALL');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Modals chọn bộ lọc
  const [showTypeFilterModal, setShowTypeFilterModal] = useState(false);
  const [showDateFilterModal, setShowDateFilterModal] = useState(false);
  const [tempStartDate, setTempStartDate] = useState('');
  const [tempEndDate, setTempEndDate] = useState('');

  const openDateFilterModal = () => {
    setTempStartDate(customStartDate);
    setTempEndDate(customEndDate);
    setShowDateFilterModal(true);
  };

  const getTxTypeLabel = (type: string) => {
    switch (type) {
      case 'IN': return 'Tiền vào (+)';
      case 'OUT': return 'Tiền ra (-)';
      case 'DISBURSEMENT': return 'Thù lao tư vấn';
      case 'PAYMENT_CONSULTATION': return 'Thanh toán tư vấn';
      case 'PENDING_ESCROW': return 'Đang tạm giữ Escrow';
      case 'REFUND': return 'Hoàn tiền';
      case 'TOPUP': return 'Nạp tiền';
      case 'WITHDRAWAL': return 'Rút tiền';
      default: return 'Loại biến động';
    }
  };

  const getWithdrawalStatusLabel = (status: string) => {
    switch (status) {
      case 'PENDING': return 'Đang xử lý';
      case 'COMPLETED': return 'Đã chuyển tiền';
      case 'REJECTED': return 'Bị từ chối';
      default: return 'Trạng thái';
    }
  };

  const getDateFilterButtonText = () => {
    if (dateRangeFilter === 'TODAY') return 'Hôm nay';
    if (dateRangeFilter === '7DAYS') return '7 ngày qua';
    if (dateRangeFilter === 'THIS_MONTH') return 'Tháng này';
    if (dateRangeFilter === 'LAST_MONTH') return 'Tháng trước';
    if (dateRangeFilter === 'CUSTOM') {
      if (customStartDate && customEndDate) return `${customStartDate} - ${customEndDate}`;
      if (customStartDate) return `Từ ${customStartDate}`;
      if (customEndDate) return `Đến ${customEndDate}`;
      return 'Chọn ngày';
    }
    return 'Chọn ngày';
  };

  // Modal nạp tiền
  const [topUpModalVisible, setTopUpModalVisible] = useState(false);
  const [topUpStep, setTopUpStep] = useState<'AMOUNT' | 'QR'>('AMOUNT');
  const [topUpAmount, setTopUpAmount] = useState('100000');
  const [submittingTopUp, setSubmittingTopUp] = useState(false);
  const [topUpData, setTopUpData] = useState<WalletTopUpResponse | null>(null);
  const [checkingTopUp, setCheckingTopUp] = useState(false);

  // Modal rút tiền
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [bankName, setBankName] = useState('Vietcombank');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState(currentUser?.fullName ? currentUser.fullName.toUpperCase() : '');
  const [submittingWithdraw, setSubmittingWithdraw] = useState(false);
  const [showBankPicker, setShowBankPicker] = useState(false);

  // Modal chi tiết các ca đang tạm giữ tiền (Pending Escrow Details)
  const [pendingEscrowModalVisible, setPendingEscrowModalVisible] = useState(false);
  const [pendingEscrowList, setPendingEscrowList] = useState<PendingEscrowDetailResponse[]>([]);
  const [loadingPendingEscrow, setLoadingPendingEscrow] = useState(false);

  // Dialog thông báo
  const [dialog, setDialog] = useState<{
    title: string;
    message: string;
    primaryLabel?: string;
    onPrimary?: () => void;
  } | null>(null);

  const fetchWalletData = useCallback(async (silent: boolean = false) => {
    if (!silent) setLoading(true);
    try {
      if (isExpertRole) {
        const [expRes, usrRes] = await Promise.allSettled([
          walletApi.getMyWallet('EXPERT'),
          walletApi.getMyWallet('USER'),
        ]);
        if (expRes.status === 'fulfilled') {
          setExpertWallet(expRes.value);
          if (Array.isArray(expRes.value.pendingEscrowDetails)) {
            setPendingEscrowList(expRes.value.pendingEscrowDetails);
          }
        }
        if (usrRes.status === 'fulfilled') setUserWallet(usrRes.value);
      } else {
        const data = await walletApi.getMyWallet('USER');
        setUserWallet(data);
      }
    } catch (err: any) {
      console.warn('Lỗi lấy thông tin ví:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [isExpertRole]);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      if (activeTab === 'TRANSACTIONS') {
        const apiTxType =
          txTypeFilter &&
          ['DISBURSEMENT', 'PENDING_ESCROW', 'WITHDRAWAL', 'REFUND', 'TOPUP', 'PAYMENT_CONSULTATION'].includes(
            txTypeFilter
          )
            ? txTypeFilter
            : undefined;
        const res = await walletApi.getMyWalletTransactions(1, 100, apiTxType);
        setTransactions(res.items || []);
      } else {
        if (isExpertRole) {
          const [expRes, usrRes] = await Promise.allSettled([
            walletApi.getMyExpertWithdrawals(undefined, 1, 50),
            walletApi.getMyUserWithdrawals(undefined, 1, 50),
          ]);
          const expItems = expRes.status === 'fulfilled' ? expRes.value.items || [] : [];
          const usrItems = usrRes.status === 'fulfilled' ? usrRes.value.items || [] : [];
          
          // Khử trùng lặp lệnh rút tiền theo Id
          const seen = new Set<string>();
          const combined: WithdrawalResponse[] = [];
          for (const item of [...expItems, ...usrItems]) {
            if (item && item.id) {
              if (!seen.has(item.id)) {
                seen.add(item.id);
                combined.push(item);
              }
            } else if (item) {
              combined.push(item);
            }
          }

          combined.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          setWithdrawals(combined);
        } else {
          const res = await walletApi.getMyUserWithdrawals(undefined, 1, 50);
          setWithdrawals(res.items || []);
        }
      }
    } catch (err: any) {
      console.warn('Lỗi tải lịch sử:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, [activeTab, isExpertRole, txTypeFilter]);

  // Danh sách biến động số dư sau khi áp dụng bộ lọc
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const txTypeUpper = (tx.transactionType || '').toUpperCase();
      // 1. Lọc theo trạng thái / loại giao dịch
      if (txTypeFilter === 'IN') {
        if (Number(tx.amount) <= 0) return false;
      } else if (txTypeFilter === 'OUT') {
        if (Number(tx.amount) >= 0) return false;
      } else if (txTypeFilter === 'PENDING_ESCROW') {
        if (txTypeUpper !== 'PENDING_ESCROW' && txTypeUpper !== 'PENDING_COOLING_DOWN') return false;
      } else if (txTypeFilter === 'WITHDRAWAL') {
        if (txTypeUpper !== 'WITHDRAWAL' && txTypeUpper !== 'WITHDRAWAL_REFUND') return false;
      } else if (txTypeFilter !== 'ALL') {
        if (txTypeUpper !== txTypeFilter) return false;
      }

      // 2. Lọc theo ngày tháng năm
      return isDateInRange(tx.createdAt, dateRangeFilter, customStartDate, customEndDate);
    });
  }, [transactions, txTypeFilter, dateRangeFilter, customStartDate, customEndDate]);

  // Danh sách lệnh rút tiền sau khi áp dụng bộ lọc
  const filteredWithdrawals = useMemo(() => {
    return withdrawals.filter((w) => {
      // 1. Lọc theo trạng thái rút tiền
      if (withdrawalStatusFilter !== 'ALL') {
        if ((w.status || '').toUpperCase() !== withdrawalStatusFilter) return false;
      }

      // 2. Lọc theo ngày tháng năm
      return isDateInRange(w.createdAt, dateRangeFilter, customStartDate, customEndDate);
    });
  }, [withdrawals, withdrawalStatusFilter, dateRangeFilter, customStartDate, customEndDate]);

  // Kiểm tra có đang áp dụng bộ lọc nào không
  const hasActiveFilter = useMemo(() => {
    if (activeTab === 'TRANSACTIONS') {
      return (
        txTypeFilter !== 'ALL' ||
        dateRangeFilter !== 'ALL' ||
        Boolean(customStartDate) ||
        Boolean(customEndDate)
      );
    } else {
      return (
        withdrawalStatusFilter !== 'ALL' ||
        dateRangeFilter !== 'ALL' ||
        Boolean(customStartDate) ||
        Boolean(customEndDate)
      );
    }
  }, [activeTab, txTypeFilter, withdrawalStatusFilter, dateRangeFilter, customStartDate, customEndDate]);

  const resetFilters = useCallback(() => {
    setTxTypeFilter('ALL');
    setWithdrawalStatusFilter('ALL');
    setDateRangeFilter('ALL');
    setCustomStartDate('');
    setCustomEndDate('');
  }, []);

  useEffect(() => {
    fetchWalletData();
  }, [fetchWalletData]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchWalletData(true), fetchHistory()]);
    setRefreshing(false);
  };

  const availableBalance = isExpertRole
    ? Number(expertWallet?.availableBalance ?? 0) + Number(userWallet?.availableBalance ?? 0)
    : Number(userWallet?.availableBalance ?? 0);

  const totalEarned = isExpertRole
    ? Number(expertWallet?.totalEarned ?? 0)
    : Number(userWallet?.totalEarned ?? 0);

  const totalWithdrawn = isExpertRole
    ? Number(expertWallet?.totalWithdrawn ?? 0) + Number(userWallet?.totalWithdrawn ?? 0)
    : Number(userWallet?.totalWithdrawn ?? 0);

  const frozenBalance = isExpertRole
    ? Number(expertWallet?.frozenBalance ?? 0) + Number(userWallet?.frozenBalance ?? 0)
    : Number(userWallet?.frozenBalance ?? 0);

  const pendingEscrowReceivable = isExpertRole
    ? Number(expertWallet?.pendingEscrowReceivable ?? 0)
    : 0;

  const pendingEscrowDetails = useMemo(
    () =>
      isExpertRole
        ? pendingEscrowList.length > 0
          ? pendingEscrowList
          : expertWallet?.pendingEscrowDetails ?? []
        : [],
    [isExpertRole, pendingEscrowList, expertWallet?.pendingEscrowDetails]
  );

  const handleOpenPendingEscrowModal = async () => {
    setPendingEscrowModalVisible(true);
    setLoadingPendingEscrow(true);
    try {
      const fresh = await walletApi.getExpertPendingEscrow();
      if (Array.isArray(fresh)) {
        setPendingEscrowList(fresh);
      }
    } catch (err) {
      console.warn('Lỗi tải danh sách ca tạm giữ Escrow:', err);
    } finally {
      setLoadingPendingEscrow(false);
    }
  };

  const handleOpenTopUpModal = () => {
    setTopUpStep('AMOUNT');
    setTopUpAmount('100000');
    setTopUpData(null);
    setTopUpModalVisible(true);
  };

  const handleCreateTopUp = async () => {
    const parsed = parseInt(topUpAmount.replace(/\D/g, ''), 10);
    if (isNaN(parsed) || parsed < 10000) {
      setDialog({
        title: 'Số tiền không hợp lệ',
        message: 'Số tiền nạp tối thiểu vào ví TAXKEEP VN là 10.000 ₫.',
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
      return;
    }
    if (parsed > 100000000) {
      setDialog({
        title: 'Vượt hạn mức nạp',
        message: 'Số tiền nạp tối đa mỗi giao dịch là 100.000.000 ₫.',
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
      return;
    }

    setSubmittingTopUp(true);
    try {
      const returnUrl = `${config.webFrontendUrl}/payments/vnpay-return`;
      const res = await walletApi.topUpWallet({ amount: parsed, returnUrl });
      setTopUpData(res);
      setTopUpStep('QR');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Không thể tạo yêu cầu nạp tiền lúc này.';
      setDialog({
        title: 'Chưa thể tạo giao dịch nạp',
        message: msg,
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
    } finally {
      setSubmittingTopUp(false);
    }
  };

  const handleCheckTopUpSuccess = async () => {
    setCheckingTopUp(true);
    try {
      await Promise.all([fetchWalletData(true), fetchHistory()]);
      setTopUpModalVisible(false);
      setDialog({
        title: 'Làm mới số dư thành công',
        message: 'Đã cập nhật số dư ví mới nhất. Giao dịch chuyển khoản ngân hàng có thể mất 15-30 giây để hoàn tất ghi nhận vào ví.',
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
    } catch (err) {
      console.warn('Lỗi kiểm tra nạp tiền:', err);
    } finally {
      setCheckingTopUp(false);
    }
  };

  const handleOpenWithdrawModal = () => {
    const expBal = Number(expertWallet?.availableBalance ?? 0);
    const usrBal = Number(userWallet?.availableBalance ?? 0);

    if (isExpertRole) {
      setWithdrawSource('EXPERT');
      setWithdrawAmount(expBal > 0 ? String(Math.floor(expBal)) : '500000');
    } else {
      setWithdrawSource('USER');
      setWithdrawAmount(usrBal > 0 ? String(Math.floor(usrBal)) : '50000');
    }

    setWithdrawModalVisible(true);
  };

  const handleConfirmWithdraw = async () => {
    const parsedAmount = parseFloat(withdrawAmount.replace(/\D/g, ''));

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setDialog({
        title: 'Số tiền chưa hợp lệ',
        message: 'Vui lòng nhập số tiền bạn muốn rút về tài khoản.',
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
      return;
    }

    const expBal = Number(expertWallet?.availableBalance ?? 0);
    const usrBal = Number(userWallet?.availableBalance ?? 0);
    const targetBal = isExpertRole && withdrawSource === 'EXPERT' ? expBal : usrBal;

    if ((!isExpertRole || withdrawSource === 'USER') && parsedAmount < 50000) {
      setDialog({
        title: 'Chưa đạt mức tối thiểu',
        message: 'Số tiền rút từ ví cá nhân tối thiểu từ 50.000 ₫ mỗi lần.',
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
      return;
    }

    if (parsedAmount > targetBal) {
      const sourceName = isExpertRole && withdrawSource === 'EXPERT' ? 'Ví thu nhập chuyên gia' : 'Ví cá nhân';
      setDialog({
        title: 'Vượt quá số dư khả dụng',
        message: `Số tiền muốn rút (${formatVnd(parsedAmount)}) lớn hơn số dư khả dụng hiện có trong ${sourceName} (${formatVnd(targetBal)}).`,
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
      return;
    }

    if (!accountNumber.trim()) {
      setDialog({
        title: 'Thiếu thông tin',
        message: 'Vui lòng nhập số tài khoản ngân hàng nhận tiền.',
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
      return;
    }

    if (!accountName.trim()) {
      setDialog({
        title: 'Thiếu thông tin',
        message: 'Vui lòng nhập tên chủ tài khoản ngân hàng.',
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
      return;
    }

    setSubmittingWithdraw(true);
    try {
      const payload = {
        amount: parsedAmount,
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        accountName: accountName.trim().toUpperCase(),
      };

      if (isExpertRole && withdrawSource === 'EXPERT') {
        await walletApi.requestExpertWithdrawal(payload);
      } else {
        await walletApi.requestUserWithdrawal(payload);
      }

      setWithdrawModalVisible(false);
      setDialog({
        title: 'Tạo lệnh rút tiền thành công',
        message: `Yêu cầu rút ${formatVnd(parsedAmount)} đã được tiếp nhận. Ban quản trị sẽ đối soát và chuyển khoản vào tài khoản ${bankName} của bạn.`,
        primaryLabel: 'Đã hiểu',
        onPrimary: () => {
          setDialog(null);
          handleRefresh();
        },
      });
    } catch (err: any) {
      const errCode = err?.response?.data?.errors?.errorCode || err?.response?.data?.errorCode;
      if (errCode === 'EKYC_REQUIRED') {
        setDialog({
          title: 'Yêu cầu định danh eKYC',
          message: 'Theo quy định, bạn cần hoàn tất định danh công dân điện tử (eKYC) trước khi rút thù lao chuyên gia về tài khoản ngân hàng.',
          primaryLabel: 'Đã hiểu',
          onPrimary: () => setDialog(null),
        });
        return;
      }
      if (errCode === 'TAX_ID_REQUIRED') {
        setDialog({
          title: 'Cần cập nhật Mã số thuế',
          message: 'Theo quy định thuế TNCN, bạn cần cập nhật Mã số thuế cá nhân hợp lệ trong mục Thông tin cá nhân trước khi thực hiện rút thù lao chuyên gia.',
          primaryLabel: 'Đã hiểu',
          onPrimary: () => setDialog(null),
        });
        return;
      }
      const msg = err?.response?.data?.message || err?.message || 'Không thể tạo yêu cầu rút tiền lúc này.';
      setDialog({
        title: 'Chưa thể rút tiền',
        message: msg,
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
    } finally {
      setSubmittingWithdraw(false);
    }
  };

  const handleBack = useCallback(() => {
    // Nếu màn hình trước đó trong stack là PaymentResult hoặc không có màn hình trước, quay về trang chính
    const state = navigation.getState();
    const routes = state?.routes || [];
    const prevRoute = routes.length >= 2 ? routes[routes.length - 2] : null;

    if (prevRoute && ['PaymentResult', 'BookingDetail'].includes(prevRoute.name)) {
      if (route.params?.walletType === 'EXPERT') {
        navigation.navigate('ExpertBookings');
      } else {
        navigation.navigate('Profile');
      }
      return;
    }

    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      if (route.params?.walletType === 'EXPERT') {
        navigation.navigate('ExpertBookings');
      } else {
        navigation.navigate('Profile');
      }
    }
  }, [navigation, route.params?.walletType]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true;
    });
    return () => sub.remove();
  }, [handleBack]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <DrumPatternBackdrop variant="soft" />

      {/* ── HEADER ── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          Ví điện tử TaxKeepVN
        </Text>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={handleRefresh}
          accessibilityRole="button"
          accessibilityLabel="Làm mới"
        >
          <Ionicons name="refresh" size={20} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>
      <GoldDoubleRule />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[theme.colors.primary]} />}
      >
        {/* ── HERO BALANCE CARD ── */}
        <View style={styles.heroCard}>
          <View style={styles.heroHeaderRow}>
            <View style={styles.heroIconCircle}>
              <Ionicons name="wallet" size={24} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.heroSubLabel}>
                {isExpertRole ? 'Tổng số dư khả dụng' : 'Số dư ví cá nhân khả dụng'}
              </Text>
              <Text style={styles.heroBalanceText}>{formatVnd(availableBalance)}</Text>
            </View>
          </View>

          {/* Số tiền đang tạm giữ bảo chứng / chờ quyết toán */}
          {isExpertRole ? (
            <>
              <TouchableOpacity
                style={styles.walletBreakdownRow}
                activeOpacity={0.75}
                onPress={handleOpenPendingEscrowModal}
              >
                <Ionicons name="shield-half-outline" size={14} color="#B45309" style={{ marginRight: 6 }} />
                <Text style={styles.walletBreakdownText} numberOfLines={1}>
                  Tạm giữ (Escrow):{' '}
                  <Text style={{ fontFamily: fonts.serifBold, color: theme.colors.primaryDark }}>
                    {formatVnd(pendingEscrowReceivable)}
                  </Text>
                </Text>
              </TouchableOpacity>
              {frozenBalance > 0 && (
                <View style={[styles.walletBreakdownRow, { marginTop: 6 }]}>
                  <Ionicons name="time-outline" size={14} color="#B45309" style={{ marginRight: 6 }} />
                  <Text style={styles.walletBreakdownText} numberOfLines={1}>
                    Chờ xử lý rút:{' '}
                    <Text style={{ fontFamily: fonts.serifBold, color: theme.colors.primaryDark }}>
                      {formatVnd(frozenBalance)}
                    </Text>
                  </Text>
                </View>
              )}
            </>
          ) : (
            <View style={styles.walletBreakdownRow}>
              <Ionicons name="time-outline" size={14} color="#B45309" style={{ marginRight: 6 }} />
              <Text style={styles.walletBreakdownText}>
                Số tiền chờ xử lý rút:{' '}
                <Text style={{ fontFamily: fonts.serifBold, color: theme.colors.primaryDark }}>
                  {formatVnd(frozenBalance)}
                </Text>
              </Text>
            </View>
          )}

          {/* Stats Bar: 2 ô phân cách gồm Thù lao và Ví cá nhân */}
          <View style={styles.heroStatsRow}>
            <View style={styles.statCol}>
              <Text style={styles.statLabel}>
                {isExpertRole ? 'Thù lao khả dụng' : 'Ví cá nhân'}
              </Text>
              <Text style={styles.statValueBold}>
                {formatVnd(isExpertRole ? (expertWallet?.availableBalance ?? 0) : (userWallet?.availableBalance ?? 0))}
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statLabel}>
                {isExpertRole ? 'Ví cá nhân' : 'Tổng đã rút'}
              </Text>
              <Text style={styles.statValueBold}>
                {formatVnd(isExpertRole ? (userWallet?.availableBalance ?? 0) : totalWithdrawn)}
              </Text>
            </View>
          </View>

          {/* Action Buttons: Nạp tiền & Rút tiền */}
          <View style={styles.heroActionBtnRow}>
            <TouchableOpacity
              style={styles.topUpHeroBtn}
              activeOpacity={0.85}
              onPress={handleOpenTopUpModal}
              accessibilityRole="button"
              accessibilityLabel="Nạp tiền vào ví"
            >
              <Ionicons name="add-circle" size={18} color="#FFFFFF" />
              <Text style={styles.topUpHeroBtnText}>Nạp tiền vào ví</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.withdrawHeroBtn}
              activeOpacity={0.85}
              onPress={handleOpenWithdrawModal}
              accessibilityRole="button"
              accessibilityLabel="Rút tiền về ngân hàng"
            >
              <Ionicons name="arrow-up-circle-outline" size={18} color={theme.colors.primary} />
              <Text style={styles.withdrawHeroBtnText}>Rút tiền</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── DANH SÁCH CA ĐANG TẠM GIỮ ESCROW (DÀNH CHO CHUYÊN GIA) ── */}
        {isExpertRole && pendingEscrowDetails.length > 0 && (
          <View style={[styles.listCard, { marginBottom: 14, padding: 14 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ionicons name="shield-half" size={17} color={theme.colors.primary} style={{ marginRight: 6 }} />
              <Text
                style={{ fontFamily: fonts.serifBold, fontSize: 14.5, color: theme.colors.primaryDark, flex: 1 }}
                numberOfLines={1}
              >
                Ca đang tạm giữ ({pendingEscrowDetails.length})
              </Text>
              <TouchableOpacity onPress={handleOpenPendingEscrowModal}>
                <Text style={{ fontFamily: fonts.bodyBold, fontSize: 12, color: theme.colors.primary }}>
                  Chi tiết →
                </Text>
              </TouchableOpacity>
            </View>
            {pendingEscrowDetails.map((esc, idx) => {
              const isCooling = esc.escrowStatus === 'CoolingDown';
              return (
                <TouchableOpacity
                  key={esc.escrowId || `esc-${idx}`}
                  style={{
                    paddingVertical: 8,
                    borderTopWidth: idx === 0 ? 0 : 1,
                    borderTopColor: '#F1ECE4',
                  }}
                  activeOpacity={0.75}
                  onPress={() =>
                    navigation.navigate('BookingDetail', {
                      bookingId: esc.bookingId,
                      isExpertView: true,
                    })
                  }
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text
                      style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: theme.colors.primary, flex: 1, marginRight: 8 }}
                      numberOfLines={1}
                    >
                      #{esc.bookingCode} • {esc.taxpayerName}
                    </Text>
                    <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13.5, color: '#059669' }}>
                      +{formatVnd(esc.expertReceivable)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 3 }}>
                    <Text
                      style={{ fontFamily: fonts.body, fontSize: 11.5, color: isCooling ? '#059669' : '#2563EB' }}
                      numberOfLines={1}
                    >
                      {isCooling ? 'Bảo chứng 24h' : 'Chờ thực hiện ca'}
                    </Text>
                    {esc.estimatedReleaseAt ? (
                      <Text style={{ fontFamily: fonts.body, fontSize: 11, color: '#6B7280' }} numberOfLines={1}>
                        Giải ngân: {formatDateTime(esc.estimatedReleaseAt)}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── TAB BAR ── */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'TRANSACTIONS' && styles.tabBtnActive]}
            onPress={() => setActiveTab('TRANSACTIONS')}
          >
            <Text style={[styles.tabBtnText, activeTab === 'TRANSACTIONS' && styles.tabBtnTextActive]}>
              Biến động số dư ({transactions.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'WITHDRAWALS' && styles.tabBtnActive]}
            onPress={() => setActiveTab('WITHDRAWALS')}
          >
            <Text style={[styles.tabBtnText, activeTab === 'WITHDRAWALS' && styles.tabBtnTextActive]}>
              Lịch sử rút tiền ({withdrawals.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── BỘ LỌC 1 HÀNG (SINGLE-ROW FILTER BAR) ── */}
        <View style={styles.filterOneRowCard}>
          <View style={styles.filterOneRowInner}>
            {/* Dropdown 1: Loại biến động / Trạng thái */}
            <TouchableOpacity
              style={[
                styles.dropdownBtn,
                (activeTab === 'TRANSACTIONS' ? txTypeFilter !== 'ALL' : withdrawalStatusFilter !== 'ALL') &&
                  styles.dropdownBtnActive,
              ]}
              onPress={() => setShowTypeFilterModal(true)}
              activeOpacity={0.7}
            >
              <Ionicons
                name="funnel"
                size={13}
                color={
                  (activeTab === 'TRANSACTIONS' ? txTypeFilter !== 'ALL' : withdrawalStatusFilter !== 'ALL')
                    ? '#FFFFFF'
                    : theme.colors.primary
                }
              />
              <Text
                style={[
                  styles.dropdownBtnText,
                  (activeTab === 'TRANSACTIONS' ? txTypeFilter !== 'ALL' : withdrawalStatusFilter !== 'ALL') &&
                    styles.dropdownBtnTextActive,
                ]}
                numberOfLines={1}
              >
                {activeTab === 'TRANSACTIONS'
                  ? txTypeFilter === 'ALL'
                    ? 'Loại giao dịch'
                    : getTxTypeLabel(txTypeFilter)
                  : withdrawalStatusFilter === 'ALL'
                  ? 'Trạng thái'
                  : getWithdrawalStatusLabel(withdrawalStatusFilter)}
              </Text>
              <Ionicons
                name="chevron-down"
                size={13}
                color={
                  (activeTab === 'TRANSACTIONS' ? txTypeFilter !== 'ALL' : withdrawalStatusFilter !== 'ALL')
                    ? '#FFFFFF'
                    : '#64748B'
                }
              />
            </TouchableOpacity>

            {/* Dropdown 2: Thời gian giao dịch / Chọn ngày */}
            <TouchableOpacity
              style={[
                styles.dropdownBtn,
                (dateRangeFilter !== 'ALL' || Boolean(customStartDate) || Boolean(customEndDate)) &&
                  styles.dropdownBtnActive,
              ]}
              onPress={openDateFilterModal}
              activeOpacity={0.7}
            >
              <Ionicons
                name="calendar"
                size={13}
                color={
                  dateRangeFilter !== 'ALL' || Boolean(customStartDate) || Boolean(customEndDate)
                    ? '#FFFFFF'
                    : theme.colors.primary
                }
              />
              <Text
                style={[
                  styles.dropdownBtnText,
                  (dateRangeFilter !== 'ALL' || Boolean(customStartDate) || Boolean(customEndDate)) &&
                    styles.dropdownBtnTextActive,
                ]}
                numberOfLines={1}
              >
                {getDateFilterButtonText()}
              </Text>
              <Ionicons
                name="chevron-down"
                size={13}
                color={
                  dateRangeFilter !== 'ALL' || Boolean(customStartDate) || Boolean(customEndDate)
                    ? '#FFFFFF'
                    : '#64748B'
                }
              />
            </TouchableOpacity>

            {/* Nút Đặt lại nhanh (nếu có lọc) */}
            {hasActiveFilter && (
              <TouchableOpacity
                style={styles.resetQuickBtn}
                onPress={resetFilters}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="refresh" size={13} color="#EF4444" />
                <Text style={styles.resetQuickBtnText}>Xóa lọc</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Dòng tóm tắt nhỏ nếu có lọc */}
          {hasActiveFilter && (
            <Text style={styles.filterSummaryMiniText}>
              {activeTab === 'TRANSACTIONS'
                ? `Hiển thị ${filteredTransactions.length} / ${transactions.length} giao dịch`
                : `Hiển thị ${filteredWithdrawals.length} / ${withdrawals.length} lệnh rút`}
            </Text>
          )}
        </View>

        {/* ── CONTENT LIST ── */}
        {historyLoading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Đang tải dữ liệu ví...</Text>
          </View>
        ) : activeTab === 'TRANSACTIONS' ? (
          filteredTransactions.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons
                name={hasActiveFilter ? 'filter-circle-outline' : 'receipt-outline'}
                size={44}
                color="#CCCCCC"
              />
              <Text style={styles.emptyTitle}>
                {hasActiveFilter ? 'Không tìm thấy giao dịch phù hợp' : 'Chưa có biến động số dư'}
              </Text>
              <Text style={styles.emptySub}>
                {hasActiveFilter
                  ? 'Không có giao dịch nào thỏa mãn bộ lọc trạng thái hoặc ngày đã chọn.'
                  : isExpertRole
                  ? 'Khi hoàn thành các ca tư vấn, thù lao sẽ tự động được cộng vào ví này.'
                  : 'Khoản tiền hoàn từ các ca tư vấn bị hủy hoặc hoàn trả sẽ hiển thị tại đây.'}
              </Text>
              {hasActiveFilter && (
                <TouchableOpacity style={styles.resetEmptyBtn} onPress={resetFilters}>
                  <Text style={styles.resetEmptyBtnText}>Đặt lại bộ lọc</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.listCard}>
              {filteredTransactions.map((tx, idx) => {
                const info = formatTxType(tx.transactionType);
                const isAmountPositive = Number(tx.amount) > 0;
                return (
                  <View key={tx.id ? `${tx.id}-${idx}` : `tx-${idx}`}>
                    <TouchableOpacity
                      style={styles.txRow}
                      activeOpacity={0.7}
                      onPress={() => setSelectedTransaction(tx)}
                    >
                      <View style={[styles.txIconCircle, { backgroundColor: `${info.color}15` }]}>
                        <Ionicons name={info.icon as any} size={20} color={info.color} />
                      </View>
                      <View style={styles.txMain}>
                        <Text style={styles.txTitle}>{info.label}</Text>
                        <Text style={styles.txTime}>{formatDateTime(tx.createdAt)}</Text>
                      </View>
                      <View style={styles.txAmountCol}>
                        <Text
                          style={[
                            styles.txAmountText,
                            { color: isAmountPositive ? '#059669' : '#D97706' },
                          ]}
                        >
                          {isAmountPositive ? '+' : ''}
                          {formatVnd(tx.amount)}
                        </Text>
                        <View style={styles.txDetailHint}>
                          <Text style={styles.txDetailHintText}>Chi tiết</Text>
                          <Ionicons name="chevron-forward" size={12} color="#9CA3AF" />
                        </View>
                      </View>
                    </TouchableOpacity>
                    {idx < filteredTransactions.length - 1 && <View style={styles.rowDivider} />}
                  </View>
                );
              })}
            </View>
          )
        ) : (
          filteredWithdrawals.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons
                name={hasActiveFilter ? 'filter-circle-outline' : 'card-outline'}
                size={44}
                color="#CCCCCC"
              />
              <Text style={styles.emptyTitle}>
                {hasActiveFilter ? 'Không tìm thấy lệnh rút phù hợp' : 'Chưa có lệnh rút tiền nào'}
              </Text>
              <Text style={styles.emptySub}>
                {hasActiveFilter
                  ? 'Không có lệnh rút tiền nào khớp với trạng thái hoặc khoảng ngày đã chọn.'
                  : 'Bạn có thể bấm nút "Rút tiền về tài khoản ngân hàng" phía trên để tạo lệnh rút.'}
              </Text>
              {hasActiveFilter && (
                <TouchableOpacity style={styles.resetEmptyBtn} onPress={resetFilters}>
                  <Text style={styles.resetEmptyBtnText}>Đặt lại bộ lọc</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.listCard}>
              {filteredWithdrawals.map((w, idx) => {
                const st = formatWithdrawalStatus(w.status);
                return (
                  <View key={w.id ? `${w.id}-${idx}` : `withdraw-${idx}`}>
                    <TouchableOpacity
                      style={styles.withdrawalRow}
                      activeOpacity={0.7}
                      onPress={() => setSelectedWithdrawal(w)}
                    >
                      <View style={styles.withdrawalLeft}>
                        <View style={styles.bankNameRow}>
                          <Ionicons name="business" size={14} color={theme.colors.primary} />
                          <Text style={styles.bankNameText}>{w.bankName}</Text>
                        </View>
                        <Text style={styles.accountNumberText}>STK: {w.accountNumber}</Text>
                        <Text style={styles.accountNameText}>{w.accountName}</Text>
                        <Text style={styles.txTime}>{formatDateTime(w.createdAt)}</Text>
                      </View>
                      <View style={styles.withdrawalRight}>
                        <Text style={styles.withdrawAmountText}>-{formatVnd(w.amount)}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                          <Text style={[styles.statusBadgeText, { color: st.color }]}>{st.label}</Text>
                        </View>
                        {w.rejectionReason && (
                          <Text style={styles.rejectionReasonText} numberOfLines={2}>
                            Lý do: {w.rejectionReason}
                          </Text>
                        )}
                        <View style={styles.txDetailHint}>
                          <Text style={styles.txDetailHintText}>Chi tiết</Text>
                          <Ionicons name="chevron-forward" size={12} color="#9CA3AF" />
                        </View>
                      </View>
                    </TouchableOpacity>
                    {idx < filteredWithdrawals.length - 1 && <View style={styles.rowDivider} />}
                  </View>
                );
              })}
            </View>
          )
        )}
      </ScrollView>

      {/* ── MODAL RÚT TIỀN ── */}
      <Modal visible={withdrawModalVisible} transparent animationType="slide" onRequestClose={() => setWithdrawModalVisible(false)}>
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <Ionicons name="cash" size={20} color={theme.colors.primary} />
                <Text style={styles.modalTitle}>Rút tiền về ngân hàng</Text>
              </View>
              <TouchableOpacity onPress={() => setWithdrawModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color="#777777" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
              {/* Chọn nguồn tiền rút (dành cho chuyên gia) */}
              {isExpertRole && (
                <View style={styles.sourceSelectorWrap}>
                  <Text style={styles.fieldLabel}>Chọn ví rút tiền *</Text>
                  <View style={styles.sourceTabRow}>
                    <TouchableOpacity
                      style={[
                        styles.sourceTabBtn,
                        withdrawSource === 'EXPERT' && styles.sourceTabBtnActive,
                      ]}
                      onPress={() => {
                        setWithdrawSource('EXPERT');
                        const expBal = Number(expertWallet?.availableBalance ?? 0);
                        setWithdrawAmount(String(Math.floor(expBal)));
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name="briefcase-outline"
                        size={15}
                        color={withdrawSource === 'EXPERT' ? '#FFFFFF' : theme.colors.textPrimary}
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.sourceTabTitle,
                            withdrawSource === 'EXPERT' && styles.sourceTabTitleActive,
                          ]}
                          numberOfLines={1}
                        >
                          Thù lao tư vấn
                        </Text>
                        <Text
                          style={[
                            styles.sourceTabSub,
                            withdrawSource === 'EXPERT' && styles.sourceTabSubActive,
                          ]}
                          numberOfLines={1}
                        >
                          {formatVnd(expertWallet?.availableBalance)}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.sourceTabBtn,
                        withdrawSource === 'USER' && styles.sourceTabBtnActive,
                      ]}
                      onPress={() => {
                        setWithdrawSource('USER');
                        const usrBal = Number(userWallet?.availableBalance ?? 0);
                        setWithdrawAmount(String(Math.floor(usrBal)));
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name="wallet-outline"
                        size={17}
                        color={withdrawSource === 'USER' ? '#FFFFFF' : theme.colors.textPrimary}
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.sourceTabTitle,
                            withdrawSource === 'USER' && styles.sourceTabTitleActive,
                          ]}
                          numberOfLines={1}
                        >
                          Ví cá nhân
                        </Text>
                        <Text
                          style={[
                            styles.sourceTabSub,
                            withdrawSource === 'USER' && styles.sourceTabSubActive,
                          ]}
                          numberOfLines={1}
                        >
                          {formatVnd(userWallet?.availableBalance)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Số dư khả dụng của nguồn đã chọn */}
              <View style={styles.balanceReminderBox}>
                <Text style={styles.balanceReminderLabel}>
                  {isExpertRole && withdrawSource === 'EXPERT'
                    ? 'Số dư Thù lao khả dụng:'
                    : isExpertRole && withdrawSource === 'USER'
                    ? 'Số dư Ví cá nhân khả dụng:'
                    : 'Số dư khả dụng:'}
                </Text>
                <Text style={styles.balanceReminderValue}>
                  {formatVnd(
                    isExpertRole && withdrawSource === 'EXPERT'
                      ? expertWallet?.availableBalance
                      : userWallet?.availableBalance
                  )}
                </Text>
              </View>

              {/* Nhập số tiền */}
              <Text style={styles.fieldLabel}>Số tiền muốn rút (VNĐ) *</Text>
              <View style={styles.inputWrapRow}>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0"
                  placeholderTextColor="#999999"
                  keyboardType="numeric"
                  value={
                    withdrawAmount
                      ? Number(withdrawAmount.replace(/\D/g, '')).toLocaleString('vi-VN')
                      : ''
                  }
                  onChangeText={(t) => {
                    const clean = t.replace(/\D/g, '');
                    setWithdrawAmount(clean);
                  }}
                />
                <TouchableOpacity
                  style={styles.allBtn}
                  onPress={() => {
                    const targetBal =
                      isExpertRole && withdrawSource === 'EXPERT'
                        ? Number(expertWallet?.availableBalance ?? 0)
                        : Number(userWallet?.availableBalance ?? 0);
                    setWithdrawAmount(String(Math.floor(targetBal)));
                  }}
                >
                  <Text style={styles.allBtnText}>Rút tất cả</Text>
                </TouchableOpacity>
              </View>

              {isExpertRole && withdrawSource === 'EXPERT' ? (
                <Text style={styles.hintText}>
                  * Áp dụng hạn mức rút tối thiểu theo quy định hệ thống (yêu cầu đã xác thực danh tính và mã số thuế)
                </Text>
              ) : (
                <Text style={styles.hintText}>* Mức rút tối thiểu từ ví cá nhân: 50.000 ₫</Text>
              )}

              {/* Chọn ngân hàng */}
              <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Ngân hàng thụ hưởng *</Text>
              <TouchableOpacity
                style={styles.pickerSelector}
                onPress={() => setShowBankPicker(!showBankPicker)}
                activeOpacity={0.8}
              >
                <Text style={styles.pickerSelectorText}>{bankName || 'Chọn ngân hàng'}</Text>
                <Ionicons name={showBankPicker ? 'chevron-up' : 'chevron-down'} size={18} color="#666666" />
              </TouchableOpacity>

              {showBankPicker && (
                <View style={styles.bankListDropdown}>
                  <ScrollView nestedScrollEnabled style={{ maxHeight: 180 }}>
                    {POPULAR_BANKS.map((bank) => (
                      <TouchableOpacity
                        key={bank}
                        style={[styles.bankItem, bankName === bank && styles.bankItemActive]}
                        onPress={() => {
                          setBankName(bank);
                          setShowBankPicker(false);
                        }}
                      >
                        <Text style={[styles.bankItemText, bankName === bank && styles.bankItemTextActive]}>
                          {bank}
                        </Text>
                        {bankName === bank && <Ionicons name="checkmark" size={16} color={theme.colors.primary} />}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Số tài khoản */}
              <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Số tài khoản ngân hàng *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Nhập số tài khoản"
                placeholderTextColor="#999999"
                keyboardType="numeric"
                value={accountNumber}
                onChangeText={setAccountNumber}
              />

              {/* Tên chủ tài khoản */}
              <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Tên chủ tài khoản (in hoa không dấu) *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Ví dụ: NGUYEN VAN A"
                placeholderTextColor="#999999"
                autoCapitalize="characters"
                value={accountName}
                onChangeText={(t) => setAccountName(t.toUpperCase())}
              />

              <View style={styles.safeNoteBox}>
                <Ionicons name="shield-checkmark-outline" size={16} color="#059669" />
                <Text style={styles.safeNoteText}>
                  Lệnh rút tiền sẽ được xử lý và chuyển thẳng vào số tài khoản ngân hàng trên sau khi đối soát thành công.
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setWithdrawModalVisible(false)}
                disabled={submittingWithdraw}
              >
                <Text style={styles.modalCancelBtnText}>Hủy bỏ</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleConfirmWithdraw}
                disabled={submittingWithdraw}
              >
                {submittingWithdraw ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>Xác nhận rút tiền</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── MODAL NẠP TIỀN VÀO VÍ ── */}
      <Modal
        visible={topUpModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setTopUpModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <Ionicons name="wallet" size={20} color="#059669" />
                <Text style={styles.modalTitle}>Nạp tiền vào ví TAXKEEP VN</Text>
              </View>
              <TouchableOpacity
                onPress={() => setTopUpModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={22} color="#777777" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
              {topUpStep === 'AMOUNT' ? (
                <>
                  {/* Current Balance */}
                  <View style={styles.topUpBalanceBox}>
                    <Text style={styles.topUpBalanceLabel}>Số dư ví cá nhân hiện tại:</Text>
                    <Text style={styles.topUpBalanceValue}>
                      {formatVnd(userWallet?.availableBalance ?? 0)}
                    </Text>
                  </View>

                  <Text style={[styles.fieldLabel, { marginTop: 14 }]}>
                    Chọn nhanh mệnh giá nạp
                  </Text>
                  <View style={styles.quickAmountRow}>
                    {['50000', '100000', '200000', '500000', '1000000', '2000000'].map((amt) => {
                      const isSelected = topUpAmount === amt;
                      return (
                        <TouchableOpacity
                          key={amt}
                          style={[
                            styles.quickAmountChip,
                            isSelected && styles.quickAmountChipSelected,
                          ]}
                          onPress={() => setTopUpAmount(amt)}
                          activeOpacity={0.8}
                        >
                          <Text
                            style={[
                              styles.quickAmountText,
                              isSelected && styles.quickAmountTextSelected,
                            ]}
                          >
                            {formatVnd(Number(amt))}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={[styles.fieldLabel, { marginTop: 14 }]}>
                    Hoặc nhập số tiền tùy chọn (VNĐ) *
                  </Text>
                  <View style={styles.topUpAmountInputWrap}>
                    <TextInput
                      style={styles.topUpAmountInput}
                      keyboardType="numeric"
                      placeholder="100.000"
                      placeholderTextColor="#999999"
                      value={topUpAmount ? Number(topUpAmount.replace(/\D/g, '')).toLocaleString('vi-VN') : ''}
                      onChangeText={(t) => {
                        const clean = t.replace(/\D/g, '');
                        setTopUpAmount(clean);
                      }}
                    />
                    <Text style={styles.currencyBadge}>₫</Text>
                  </View>
                  <Text style={styles.fieldHint}>Tối thiểu: 10.000 ₫ - Tối đa: 100.000.000 ₫</Text>

                  <View style={[styles.modalBtnRow, { marginTop: 20 }]}>
                    <TouchableOpacity
                      style={styles.modalCancelBtn}
                      onPress={() => setTopUpModalVisible(false)}
                      disabled={submittingTopUp}
                    >
                      <Text style={styles.modalCancelBtnText}>Hủy</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.modalSubmitBtn, { backgroundColor: '#059669' }]}
                      onPress={handleCreateTopUp}
                      disabled={submittingTopUp}
                    >
                      {submittingTopUp ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.modalSubmitBtnText}>Tạo mã QR nạp tiền</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  {/* Top-up Payment Display (QR & Link) */}
                  <View style={styles.topUpSummaryCard}>
                    <Text style={styles.topUpSummaryLabel}>Số tiền cần chuyển khoản:</Text>
                    <Text style={styles.topUpSummaryAmount}>
                      {formatVnd(topUpData?.amount ?? Number(topUpAmount))}
                    </Text>
                    {topUpData?.orderCode ? (
                      <Text style={styles.topUpOrderCodeText}>
                        Nội dung chuyển khoản:{' '}
                        <Text style={{ fontFamily: fonts.bodyBold, color: '#B45309' }}>
                          NAPVI{topUpData.orderCode}
                        </Text>
                      </Text>
                    ) : null}
                  </View>

                  {topUpData?.qrCode ? (
                    <View style={styles.topUpQrSection}>
                      <Text style={styles.topUpQrHint}>
                        Quét mã VietQR bằng ứng dụng Ngân hàng để nạp tiền tự động:
                      </Text>
                      <View style={styles.topUpQrWrap}>
                        <Image
                          source={{ uri: topUpData.qrCode }}
                          style={styles.topUpQrImage}
                          resizeMode="contain"
                        />
                      </View>
                    </View>
                  ) : null}

                  {topUpData?.checkoutUrl ? (
                    <TouchableOpacity
                      style={styles.topUpVnPayBtn}
                      onPress={() => topUpData.checkoutUrl && Linking.openURL(topUpData.checkoutUrl)}
                    >
                      <Ionicons name="open-outline" size={18} color="#FFFFFF" />
                      <Text style={styles.topUpVnPayBtnText}>Mở cổng thanh toán VNPay</Text>
                    </TouchableOpacity>
                  ) : null}

                  <View style={styles.topUpTipBox}>
                    <Ionicons name="information-circle-outline" size={16} color="#0369A1" />
                    <Text style={styles.topUpTipText}>
                      Hệ thống tự động cộng tiền vào ví sau khi giao dịch chuyển khoản thành công.
                    </Text>
                  </View>

                  <View style={[styles.modalBtnRow, { marginTop: 16 }]}>
                    <TouchableOpacity
                      style={styles.modalCancelBtn}
                      onPress={() => setTopUpStep('AMOUNT')}
                    >
                      <Text style={styles.modalCancelBtnText}>Đổi số tiền</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.modalSubmitBtn, { backgroundColor: '#059669' }]}
                      onPress={handleCheckTopUpSuccess}
                      disabled={checkingTopUp}
                    >
                      {checkingTopUp ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.modalSubmitBtnText}>Kiểm tra số dư / Hoàn tất</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── MODAL CHỌN LOẠI / TRẠNG THÁI GIAO DỊCH ── */}
      <Modal
        visible={showTypeFilterModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTypeFilterModal(false)}
      >
        <TouchableOpacity
          style={styles.filterModalOverlay}
          activeOpacity={1}
          onPress={() => setShowTypeFilterModal(false)}
        >
          <View style={styles.filterModalCard} onStartShouldSetResponder={() => true}>
            <View style={styles.filterModalHeader}>
              <Text style={styles.filterModalTitle}>
                {activeTab === 'TRANSACTIONS' ? 'Lọc theo loại giao dịch' : 'Lọc theo trạng thái'}
              </Text>
              <TouchableOpacity onPress={() => setShowTypeFilterModal(false)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 320 }}>
              {activeTab === 'TRANSACTIONS' ? (
                <>
                  {[
                    { id: 'ALL', label: 'Tất cả loại giao dịch' },
                    { id: 'IN', label: 'Tiền vào (+)', icon: 'arrow-down-circle', color: '#059669' },
                    { id: 'OUT', label: 'Tiền ra (-)', icon: 'arrow-up-circle', color: '#D97706' },
                    { id: 'PAYMENT_CONSULTATION', label: 'Thanh toán phí tư vấn', icon: 'card-outline', color: '#D97706' },
                    { id: 'DISBURSEMENT', label: 'Thù lao tư vấn', icon: 'cash-outline', color: '#059669' },
                    { id: 'PENDING_ESCROW', label: 'Đang tạm giữ Escrow', icon: 'shield-half-outline', color: '#2563EB' },
                    { id: 'REFUND', label: 'Hoàn tiền ca tư vấn', icon: 'refresh-circle', color: '#2563EB' },
                    { id: 'TOPUP', label: 'Nạp tiền vào ví', icon: 'add-circle', color: '#059669' },
                    { id: 'WITHDRAWAL', label: 'Rút tiền về ngân hàng', icon: 'arrow-up-circle', color: '#D97706' },
                  ].map((item) => {
                    const isSelected = txTypeFilter === item.id;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[styles.filterOptionRow, isSelected && styles.filterOptionRowActive]}
                        onPress={() => {
                          setTxTypeFilter(item.id);
                          setShowTypeFilterModal(false);
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          {item.icon && <Ionicons name={item.icon as any} size={16} color={item.color} />}
                          <Text
                            style={[
                              styles.filterOptionText,
                              isSelected && styles.filterOptionTextActive,
                            ]}
                          >
                            {item.label}
                          </Text>
                        </View>
                        {isSelected && <Ionicons name="checkmark" size={18} color={theme.colors.primary} />}
                      </TouchableOpacity>
                    );
                  })}
                </>
              ) : (
                <>
                  {[
                    { id: 'ALL', label: 'Tất cả trạng thái' },
                    { id: 'PENDING', label: 'Đang xử lý', color: '#D97706' },
                    { id: 'COMPLETED', label: 'Đã chuyển tiền', color: '#059669' },
                    { id: 'REJECTED', label: 'Bị từ chối', color: '#DC2626' },
                  ].map((item) => {
                    const isSelected = withdrawalStatusFilter === item.id;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[styles.filterOptionRow, isSelected && styles.filterOptionRowActive]}
                        onPress={() => {
                          setWithdrawalStatusFilter(item.id);
                          setShowTypeFilterModal(false);
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          {item.color && (
                            <View style={[styles.dotIndicator, { backgroundColor: item.color }]} />
                          )}
                          <Text
                            style={[
                              styles.filterOptionText,
                              isSelected && styles.filterOptionTextActive,
                            ]}
                          >
                            {item.label}
                          </Text>
                        </View>
                        {isSelected && <Ionicons name="checkmark" size={18} color={theme.colors.primary} />}
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── MODAL CHỌN NGÀY / THỜI GIAN GIAO DỊCH ── */}
      <Modal
        visible={showDateFilterModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDateFilterModal(false)}
      >
        <TouchableOpacity
          style={styles.filterModalOverlay}
          activeOpacity={1}
          onPress={() => setShowDateFilterModal(false)}
        >
          <View style={styles.filterModalCard} onStartShouldSetResponder={() => true}>
            <View style={styles.filterModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="calendar" size={18} color={theme.colors.primary} />
                <Text style={styles.filterModalTitle}>Chọn ngày giao dịch</Text>
              </View>
              <TouchableOpacity onPress={() => setShowDateFilterModal(false)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
              {/* Danh sách mốc ngày chọn nhanh */}
              {[
                { id: 'ALL', label: 'Tất cả thời gian' },
                { id: 'TODAY', label: 'Hôm nay' },
                { id: '7DAYS', label: '7 ngày qua' },
                { id: 'THIS_MONTH', label: 'Tháng này' },
                { id: 'LAST_MONTH', label: 'Tháng trước' },
                { id: 'CUSTOM', label: 'Tùy chọn khoảng ngày...' },
              ].map((opt) => {
                const isSelected = dateRangeFilter === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.filterOptionRow, isSelected && styles.filterOptionRowActive]}
                    onPress={() => {
                      if (opt.id !== 'CUSTOM') {
                        setDateRangeFilter(opt.id as any);
                        setCustomStartDate('');
                        setCustomEndDate('');
                        setShowDateFilterModal(false);
                      } else {
                        setDateRangeFilter('CUSTOM');
                      }
                    }}
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        isSelected && styles.filterOptionTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                    {isSelected && <Ionicons name="checkmark" size={18} color={theme.colors.primary} />}
                  </TouchableOpacity>
                );
              })}

              {/* Nhập ngày tùy chọn nếu chọn CUSTOM */}
              {dateRangeFilter === 'CUSTOM' && (
                <View style={styles.modalCustomDateBox}>
                  <Text style={styles.modalCustomDatePrompt}>Nhập ngày cần lọc (DD/MM/YYYY):</Text>
                  <View style={styles.modalCustomDateRow}>
                    <View style={styles.modalDateInputCol}>
                      <Text style={styles.modalDateInputLabel}>Từ ngày</Text>
                      <TextInput
                        style={styles.modalDateInput}
                        placeholder="DD/MM/YYYY"
                        placeholderTextColor="#94A3B8"
                        value={tempStartDate}
                        onChangeText={setTempStartDate}
                      />
                    </View>
                    <View style={styles.modalDateInputCol}>
                      <Text style={styles.modalDateInputLabel}>Đến ngày</Text>
                      <TextInput
                        style={styles.modalDateInput}
                        placeholder="DD/MM/YYYY"
                        placeholderTextColor="#94A3B8"
                        value={tempEndDate}
                        onChangeText={setTempEndDate}
                      />
                    </View>
                  </View>

                  <View style={styles.modalCustomBtnRow}>
                    <TouchableOpacity
                      style={styles.modalCustomResetBtn}
                      onPress={() => {
                        setTempStartDate('');
                        setTempEndDate('');
                        setCustomStartDate('');
                        setCustomEndDate('');
                        setDateRangeFilter('ALL');
                        setShowDateFilterModal(false);
                      }}
                    >
                      <Text style={styles.modalCustomResetText}>Xóa ngày</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.modalCustomApplyBtn}
                      onPress={() => {
                        setCustomStartDate(tempStartDate.trim());
                        setCustomEndDate(tempEndDate.trim());
                        setDateRangeFilter('CUSTOM');
                        setShowDateFilterModal(false);
                      }}
                    >
                      <Text style={styles.modalCustomApplyText}>Áp dụng</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── MODAL CHI TIẾT GIAO DỊCH ── */}
      <Modal
        visible={Boolean(selectedTransaction)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedTransaction(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.detailModalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <Ionicons name="receipt" size={20} color={theme.colors.primary} />
                <Text style={styles.modalTitle}>Chi tiết giao dịch</Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedTransaction(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={22} color="#777777" />
              </TouchableOpacity>
            </View>

            {selectedTransaction && (() => {
              const info = formatTxType(selectedTransaction.transactionType);
              const isAmountPositive = Number(selectedTransaction.amount) > 0;
              const linkedWithdrawal = withdrawals.find((w) => w.id === selectedTransaction.referenceId);

              return (
                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
                  {/* Hero Amount Banner */}
                  <View style={styles.detailHeroBox}>
                    <View style={[styles.detailHeroIcon, { backgroundColor: `${info.color}15` }]}>
                      <Ionicons name={info.icon as any} size={28} color={info.color} />
                    </View>
                    <Text style={styles.detailHeroType}>{info.label}</Text>
                    <Text
                      style={[
                        styles.detailHeroAmount,
                        { color: isAmountPositive ? '#059669' : '#D97706' },
                      ]}
                    >
                      {isAmountPositive ? '+' : ''}
                      {formatVnd(selectedTransaction.amount)}
                    </Text>
                    <Text style={styles.detailHeroTime}>{formatDateTime(selectedTransaction.createdAt)}</Text>
                  </View>

                  {/* Section: Thông tin đối soát số dư */}
                  <View style={styles.detailSectionBox}>
                    <Text style={styles.detailSectionTitle}>ĐỐI SOÁT SỐ DƯ VÍ</Text>

                    <View style={styles.detailDataRow}>
                      <Text style={styles.detailDataLabel}>Số dư trước giao dịch</Text>
                      <Text style={styles.detailDataValue}>{formatVnd(selectedTransaction.balanceBefore)}</Text>
                    </View>

                    <View style={styles.detailDataRow}>
                      <Text style={styles.detailDataLabel}>Biến động trong ví</Text>
                      <Text
                        style={[
                          styles.detailDataValueBold,
                          { color: isAmountPositive ? '#059669' : '#D97706' },
                        ]}
                      >
                        {isAmountPositive ? '+' : ''}
                        {formatVnd(selectedTransaction.amount)}
                      </Text>
                    </View>

                    <View style={styles.detailDataRow}>
                      <Text style={styles.detailDataLabel}>Số dư khả dụng sau đó</Text>
                      <Text style={[styles.detailDataValueBold, { color: theme.colors.primary }]}>
                        {formatVnd(selectedTransaction.balanceAfter)}
                      </Text>
                    </View>
                  </View>

                  {/* Section: Chi tiết nghiệp vụ */}
                  <View style={styles.detailSectionBox}>
                    <Text style={styles.detailSectionTitle}>THÔNG TIN NGHIỆP VỤ</Text>

                    <View style={styles.detailDataRow}>
                      <Text style={styles.detailDataLabel}>Mã định danh giao dịch</Text>
                      <Text style={styles.detailDataValueMono} selectable>
                        {selectedTransaction.id}
                      </Text>
                    </View>

                    <View style={styles.detailDataRow}>
                      <Text style={styles.detailDataLabel}>Hình thức biến động</Text>
                      <View style={[styles.detailTypeBadge, { backgroundColor: `${info.color}15` }]}>
                        <Text style={[styles.detailTypeBadgeText, { color: info.color }]}>{info.label}</Text>
                      </View>
                    </View>

                    <View style={styles.detailDataRow}>
                      <Text style={styles.detailDataLabel}>Thời gian ghi nhận</Text>
                      <Text style={styles.detailDataValue}>{formatDateTime(selectedTransaction.createdAt)}</Text>
                    </View>

                    <View style={styles.detailDescRow}>
                      <Text style={styles.detailDataLabel}>Nội dung diễn giải</Text>
                      <View style={styles.detailDescContentBox}>
                        <Text style={styles.detailDescContentText}>
                          {selectedTransaction.description || 'Không có ghi chú thêm.'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Linked Withdrawal Details if applicable */}
                  {linkedWithdrawal && (
                    <View style={styles.detailSectionBox}>
                      <Text style={styles.detailSectionTitle}>THÔNG TIN LỆNH RÚT TIỀN THỤ HƯỞNG</Text>

                      <View style={styles.detailDataRow}>
                        <Text style={styles.detailDataLabel}>Ngân hàng thụ hưởng</Text>
                        <Text style={styles.detailDataValueBold}>{linkedWithdrawal.bankName}</Text>
                      </View>

                      <View style={styles.detailDataRow}>
                        <Text style={styles.detailDataLabel}>Số tài khoản</Text>
                        <Text style={styles.detailDataValueMono} selectable>{linkedWithdrawal.accountNumber}</Text>
                      </View>

                      <View style={styles.detailDataRow}>
                        <Text style={styles.detailDataLabel}>Tên chủ tài khoản</Text>
                        <Text style={styles.detailDataValueBold}>{linkedWithdrawal.accountName}</Text>
                      </View>

                      <View style={styles.detailDataRow}>
                        <Text style={styles.detailDataLabel}>Trạng thái chuyển khoản</Text>
                        <View
                          style={[
                            styles.statusBadge,
                            { backgroundColor: formatWithdrawalStatus(linkedWithdrawal.status).bg },
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusBadgeText,
                              { color: formatWithdrawalStatus(linkedWithdrawal.status).color },
                            ]}
                          >
                            {formatWithdrawalStatus(linkedWithdrawal.status).label}
                          </Text>
                        </View>
                      </View>

                      {linkedWithdrawal.transactionReference && (
                        <View style={styles.detailDataRow}>
                          <Text style={styles.detailDataLabel}>Mã giao dịch ngân hàng / UNC</Text>
                          <Text style={styles.detailDataValueMono} selectable>
                            {linkedWithdrawal.transactionReference}
                          </Text>
                        </View>
                      )}

                      {linkedWithdrawal.rejectionReason && (
                        <View style={styles.rejectionAlertBox}>
                          <Ionicons name="alert-circle" size={16} color="#DC2626" />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.rejectionAlertTitle}>Lý do từ chối:</Text>
                            <Text style={styles.rejectionAlertDesc}>{linkedWithdrawal.rejectionReason}</Text>
                          </View>
                        </View>
                      )}
                    </View>
                  )}

                  <TouchableOpacity
                    style={styles.detailCloseBtn}
                    onPress={() => setSelectedTransaction(null)}
                  >
                    <Text style={styles.detailCloseBtnText}>Đóng</Text>
                  </TouchableOpacity>
                </ScrollView>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* ── MODAL CHI TIẾT LỆNH RÚT TIỀN ── */}
      <Modal
        visible={Boolean(selectedWithdrawal)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedWithdrawal(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.detailModalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <Ionicons name="card" size={20} color={theme.colors.primary} />
                <Text style={styles.modalTitle}>Chi tiết lệnh rút tiền</Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedWithdrawal(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={22} color="#777777" />
              </TouchableOpacity>
            </View>

            {selectedWithdrawal && (() => {
              const st = formatWithdrawalStatus(selectedWithdrawal.status);

              return (
                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
                  {/* Hero Box */}
                  <View style={styles.detailHeroBox}>
                    <View style={[styles.detailHeroIcon, { backgroundColor: st.bg }]}>
                      <Ionicons
                        name={
                          selectedWithdrawal.status === 'COMPLETED'
                            ? 'checkmark-done-circle'
                            : selectedWithdrawal.status === 'REJECTED'
                            ? 'close-circle'
                            : 'time'
                        }
                        size={28}
                        color={st.color}
                      />
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: st.bg, marginTop: 4 }]}>
                      <Text style={[styles.statusBadgeText, { color: st.color, fontSize: 11 }]}>{st.label}</Text>
                    </View>
                    <Text style={[styles.detailHeroAmount, { color: '#D97706', marginTop: 6 }]}>
                      -{formatVnd(selectedWithdrawal.amount)}
                    </Text>
                    <Text style={styles.detailHeroTime}>{formatDateTime(selectedWithdrawal.createdAt)}</Text>
                  </View>

                  {/* Section: Tài khoản nhận tiền */}
                  <View style={styles.detailSectionBox}>
                    <Text style={styles.detailSectionTitle}>TÀI KHOẢN NHẬN TIỀN</Text>

                    <View style={styles.detailDataRow}>
                      <Text style={styles.detailDataLabel}>Ngân hàng thụ hưởng</Text>
                      <Text style={styles.detailDataValueBold}>{selectedWithdrawal.bankName}</Text>
                    </View>

                    <View style={styles.detailDataRow}>
                      <Text style={styles.detailDataLabel}>Số tài khoản</Text>
                      <Text style={styles.detailDataValueMono} selectable>
                        {selectedWithdrawal.accountNumber}
                      </Text>
                    </View>

                    <View style={styles.detailDataRow}>
                      <Text style={styles.detailDataLabel}>Tên chủ tài khoản</Text>
                      <Text style={styles.detailDataValueBold}>{selectedWithdrawal.accountName}</Text>
                    </View>
                  </View>

                  {/* Section: Thông tin đối soát & Xử lý */}
                  <View style={styles.detailSectionBox}>
                    <Text style={styles.detailSectionTitle}>THÔNG TIN XỬ LÝ LỆNH</Text>

                    <View style={styles.detailDataRow}>
                      <Text style={styles.detailDataLabel}>Mã định danh lệnh rút</Text>
                      <Text style={styles.detailDataValueMono} selectable>
                        {selectedWithdrawal.id}
                      </Text>
                    </View>

                    <View style={styles.detailDataRow}>
                      <Text style={styles.detailDataLabel}>Thời gian gửi lệnh</Text>
                      <Text style={styles.detailDataValue}>{formatDateTime(selectedWithdrawal.createdAt)}</Text>
                    </View>

                    {selectedWithdrawal.processedAt && (
                      <View style={styles.detailDataRow}>
                        <Text style={styles.detailDataLabel}>Thời gian xử lý</Text>
                        <Text style={styles.detailDataValue}>{formatDateTime(selectedWithdrawal.processedAt)}</Text>
                      </View>
                    )}

                    {selectedWithdrawal.transactionReference && (
                      <View style={styles.detailDataRow}>
                        <Text style={styles.detailDataLabel}>Mã GD ngân hàng / UNC</Text>
                        <Text style={styles.detailDataValueMono} selectable>
                          {selectedWithdrawal.transactionReference}
                        </Text>
                      </View>
                    )}

                    {selectedWithdrawal.adminNotes && (
                      <View style={styles.detailDescRow}>
                        <Text style={styles.detailDataLabel}>Ghi chú từ quản trị</Text>
                        <View style={styles.detailDescContentBox}>
                          <Text style={styles.detailDescContentText}>{selectedWithdrawal.adminNotes}</Text>
                        </View>
                      </View>
                    )}
                  </View>

                  {selectedWithdrawal.rejectionReason && (
                    <View style={styles.rejectionAlertBox}>
                      <Ionicons name="alert-circle" size={18} color="#DC2626" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rejectionAlertTitle}>Lý do từ chối rút tiền:</Text>
                        <Text style={styles.rejectionAlertDesc}>{selectedWithdrawal.rejectionReason}</Text>
                      </View>
                    </View>
                  )}

                  <TouchableOpacity
                    style={styles.detailCloseBtn}
                    onPress={() => setSelectedWithdrawal(null)}
                  >
                    <Text style={styles.detailCloseBtnText}>Đóng</Text>
                  </TouchableOpacity>
                </ScrollView>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* ── 2. MODAL: CHI TIẾT CÁC CA ĐANG TẠM GIỮ TIỀN (PENDING ESCROW DETAILS) ── */}
      <Modal
        visible={pendingEscrowModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPendingEscrowModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.detailModalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <Ionicons name="hourglass-outline" size={20} color="#D97706" />
                <Text style={styles.modalTitle}>Chi tiết các ca đang tạm giữ tiền</Text>
              </View>
              <TouchableOpacity
                onPress={() => setPendingEscrowModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={22} color="#777777" />
              </TouchableOpacity>
            </View>

            {/* Tổng quan tạm giữ */}
            <View
              style={{
                backgroundColor: '#FFFBEB',
                borderWidth: 1,
                borderColor: '#FDE68A',
                borderRadius: 10,
                padding: 12,
                marginBottom: 12,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <View>
                <Text style={{ fontFamily: fonts.body, fontSize: 12, color: '#92400E' }}>
                  Tổng thù lao đang tạm giữ ({pendingEscrowDetails.length} ca)
                </Text>
                <Text style={{ fontFamily: fonts.serifBold, fontSize: 18, color: '#B45309', marginTop: 2 }}>
                  {formatVnd(pendingEscrowReceivable)}
                </Text>
              </View>
              {loadingPendingEscrow && <ActivityIndicator size="small" color="#D97706" />}
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
              {pendingEscrowDetails.length === 0 ? (
                <View style={{ paddingVertical: 36, alignItems: 'center' }}>
                  <Ionicons name="shield-checkmark-outline" size={40} color="#CBD5E1" />
                  <Text
                    style={{
                      fontFamily: fonts.serifBold,
                      fontSize: 14,
                      color: theme.colors.textPrimary,
                      marginTop: 8,
                    }}
                  >
                    Hiện không có ca tư vấn nào đang tạm giữ tiền
                  </Text>
                  <Text
                    style={{
                      fontFamily: fonts.body,
                      fontSize: 12,
                      color: '#64748B',
                      textAlign: 'center',
                      marginTop: 4,
                    }}
                  >
                    Tất cả thù lao từ các ca hoàn thành đã được giải ngân vào số dư khả dụng của bạn.
                  </Text>
                </View>
              ) : (
                pendingEscrowDetails.map((esc, idx) => {
                  const isCooling = esc.escrowStatus === 'CoolingDown';
                  const statusBadgeBg = isCooling ? '#E0F2FE' : '#FEF3C7';
                  const statusBadgeBorder = isCooling ? '#BAE6FD' : '#FDE68A';
                  const statusBadgeColor = isCooling ? '#0284C7' : '#D97706';
                  const statusShortLabel = isCooling
                    ? 'Bảo chứng Cool-down 24h (Chờ giải ngân)'
                    : 'Đang tạm giữ Escrow (Chờ thực hiện ca)';

                  return (
                    <View
                      key={esc.escrowId || `esc-modal-${idx}`}
                      style={{
                        backgroundColor: '#F8FAFC',
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: '#E2E8F0',
                        padding: 13,
                        marginBottom: 10,
                      }}
                    >
                      {/* Row 1: Mã ca hẹn (Click để xem chi tiết buổi tư vấn) */}
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          paddingBottom: 8,
                          borderBottomWidth: 1,
                          borderBottomColor: '#E2E8F0',
                        }}
                      >
                        <TouchableOpacity
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
                          onPress={() => {
                            setPendingEscrowModalVisible(false);
                            navigation.navigate('BookingDetail', {
                              bookingId: esc.bookingId,
                              isExpertView: true,
                            });
                          }}
                        >
                          <Ionicons name="document-text-outline" size={15} color={theme.colors.primary} />
                          <Text
                            style={{
                              fontFamily: fonts.bodyBold,
                              fontSize: 13.5,
                              color: theme.colors.primary,
                              textDecorationLine: 'underline',
                            }}
                          >
                            {esc.bookingCode}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => {
                            setPendingEscrowModalVisible(false);
                            navigation.navigate('BookingDetail', {
                              bookingId: esc.bookingId,
                              isExpertView: true,
                            });
                          }}
                        >
                          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 11.5, color: '#2563EB' }}>
                            Xem buổi tư vấn →
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* Row 2: Khách hàng */}
                      <View style={styles.detailDataRow}>
                        <Text style={styles.detailDataLabel}>Khách hàng</Text>
                        <Text style={styles.detailDataValueBold}>{esc.taxpayerName || 'Khách hàng'}</Text>
                      </View>

                      {/* Row 3: Thời gian tư vấn */}
                      <View style={styles.detailDataRow}>
                        <Text style={styles.detailDataLabel}>Thời gian tư vấn</Text>
                        <Text style={styles.detailDataValue}>{formatDateTime(esc.consultationTime)}</Text>
                      </View>

                      {/* Row 4: Tổng phí ca */}
                      <View style={styles.detailDataRow}>
                        <Text style={styles.detailDataLabel}>Tổng phí ca</Text>
                        <Text style={styles.detailDataValue}>{formatVnd(esc.totalAmount)}</Text>
                      </View>

                      {/* Row 5: Phí nền tảng */}
                      <View style={styles.detailDataRow}>
                        <Text style={styles.detailDataLabel}>Phí nền tảng</Text>
                        <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: '#DC2626' }}>
                          -{formatVnd(esc.commissionAmount)} ({esc.commissionRate}%)
                        </Text>
                      </View>

                      {/* Row 6: Thực nhận (Dự kiến) - In đậm màu xanh dương */}
                      <View style={styles.detailDataRow}>
                        <Text style={styles.detailDataLabel}>Thực nhận (Dự kiến)</Text>
                        <Text style={{ fontFamily: fonts.serifBold, fontSize: 15, color: '#2563EB' }}>
                          {formatVnd(esc.expertReceivable)}
                        </Text>
                      </View>

                      {/* Row 7: Trạng thái tạm giữ */}
                      <View style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                        <Text style={styles.detailDataLabel}>Trạng thái tạm giữ</Text>
                        <View
                          style={{
                            marginTop: 5,
                            backgroundColor: statusBadgeBg,
                            borderWidth: 1,
                            borderColor: statusBadgeBorder,
                            borderRadius: 7,
                            paddingHorizontal: 9,
                            paddingVertical: 6,
                          }}
                        >
                          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 11.5, color: statusBadgeColor }}>
                            {statusShortLabel}
                          </Text>
                          {esc.escrowStatusDescription ? (
                            <Text
                              style={{
                                fontFamily: fonts.body,
                                fontSize: 11,
                                color: statusBadgeColor,
                                marginTop: 2,
                              }}
                            >
                              {esc.escrowStatusDescription}
                            </Text>
                          ) : null}
                        </View>
                      </View>

                      {/* Row 8: Dự kiến giải ngân */}
                      <View style={[styles.detailDataRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
                        <Text style={styles.detailDataLabel}>Dự kiến giải ngân</Text>
                        <Text
                          style={{
                            fontFamily: fonts.bodyBold,
                            fontSize: 12,
                            color: '#0F172A',
                            textAlign: 'right',
                            flex: 1.3,
                          }}
                        >
                          {formatEstimatedReleaseCountdown(esc.estimatedReleaseAt)}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}

              <TouchableOpacity
                style={styles.detailCloseBtn}
                onPress={() => setPendingEscrowModalVisible(false)}
              >
                <Text style={styles.detailCloseBtnText}>Đóng</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── DIALOG ── */}
      <Dialog
        visible={Boolean(dialog)}
        title={dialog?.title || ''}
        message={dialog?.message || ''}
        primaryLabel={dialog?.primaryLabel || 'Đã hiểu'}
        onPrimary={dialog?.onPrimary || (() => setDialog(null))}
        onRequestClose={() => setDialog(null)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(243, 239, 230, 0.85)',
  },
  headerTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 18,
    lineHeight: 24,
    color: theme.colors.primaryDark,
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(243, 239, 230, 0.85)',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: 'rgba(255, 253, 247, 0.94)',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#E5D5B5',
    ...theme.shadows.card,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FAF3E3',
    borderWidth: 1,
    borderColor: theme.colors.goldLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroSubLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    lineHeight: 16,
    color: '#5A4A22',
  },
  heroBalanceText: {
    fontFamily: fonts.serifBold,
    fontSize: 28,
    lineHeight: 34,
    color: theme.colors.primaryDark,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  walletBreakdownRow: {
    backgroundColor: '#FAF5EA',
    borderWidth: 1,
    borderColor: '#E8DEC8',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 10,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
  },
  walletBreakdownText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#5A4A22',
  },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF6EE',
    borderWidth: 1,
    borderColor: '#E8DEC8',
    borderRadius: 10,
    padding: 12,
    marginTop: 14,
  },
  statCol: {
    flex: 1,
  },
  statLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: '#5A4A22',
  },
  statValueBold: {
    fontFamily: fonts.serifBold,
    fontSize: 15,
    color: theme.colors.primaryDark,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E5D5B5',
    marginHorizontal: 12,
  },
  frozenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 10,
  },
  frozenText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#92400E',
  },
  heroActionBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
  },
  topUpHeroBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    gap: 6,
    ...theme.shadows.button,
  },
  topUpHeroBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  withdrawHeroBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    gap: 6,
  },
  withdrawHeroBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: theme.colors.primary,
  },
  topUpBalanceBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  topUpBalanceLabel: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: '#64748B',
  },
  topUpBalanceValue: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: '#059669',
  },
  quickAmountRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  quickAmountChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickAmountChipSelected: {
    backgroundColor: '#ECFDF5',
    borderColor: '#059669',
  },
  quickAmountText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: '#475569',
  },
  quickAmountTextSelected: {
    fontFamily: fonts.bodyBold,
    color: '#059669',
  },
  topUpAmountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginTop: 6,
  },
  topUpAmountInput: {
    flex: 1,
    height: 44,
    fontFamily: fonts.bodyBold,
    fontSize: 17,
    color: theme.colors.textPrimary,
  },
  currencyBadge: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: '#64748B',
    marginLeft: 6,
  },
  fieldHint: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
  },
  topUpNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 8,
    padding: 10,
    marginTop: 14,
    gap: 8,
  },
  topUpNoticeText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#166534',
    lineHeight: 17,
  },
  topUpSummaryCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  topUpSummaryLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#92400E',
  },
  topUpSummaryAmount: {
    fontFamily: fonts.bodyBold,
    fontSize: 24,
    color: '#B45309',
    marginTop: 4,
  },
  topUpOrderCodeText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#78350F',
    marginTop: 6,
  },
  topUpQrSection: {
    alignItems: 'center',
    marginTop: 16,
  },
  topUpQrHint: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 10,
  },
  topUpQrWrap: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  topUpQrImage: {
    width: 200,
    height: 200,
  },
  topUpVnPayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#005BAA',
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 14,
    gap: 6,
  },
  topUpVnPayBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  topUpTipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
    gap: 6,
  },
  topUpTipText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#0369A1',
    lineHeight: 16,
  },
  withdrawBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 14,
    gap: 6,
  },
  withdrawBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#EFEBE2',
    borderRadius: 10,
    padding: 4,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  tabBtnText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  tabBtnTextActive: {
    fontFamily: fonts.bodyBold,
    color: theme.colors.primary,
  },
  centerLoading: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: '#666666',
  },
  emptyWrap: {
    paddingVertical: 40,
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  emptySub: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  listCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  txIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  txMain: {
    flex: 1,
    marginRight: 8,
  },
  txTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: 13.5,
    color: theme.colors.textPrimary,
  },
  txDesc: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  txTime: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    color: '#888888',
    marginTop: 2,
  },
  txAmountCol: {
    alignItems: 'flex-end',
  },
  txAmountText: {
    fontFamily: fonts.serifBold,
    fontSize: 14.5,
    fontVariant: ['tabular-nums'],
  },
  txBalanceAfter: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    color: '#888888',
    marginTop: 2,
  },
  rowDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
  },
  withdrawalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  withdrawalLeft: {
    flex: 1,
    marginRight: 10,
  },
  bankNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bankNameText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13.5,
    color: theme.colors.textPrimary,
  },
  accountNumberText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: '#444444',
    marginTop: 2,
  },
  accountNameText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  withdrawalRight: {
    alignItems: 'flex-end',
  },
  withdrawAmountText: {
    fontFamily: fonts.serifBold,
    fontSize: 14.5,
    color: '#D97706',
    fontVariant: ['tabular-nums'],
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  statusBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
  },
  rejectionReasonText: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: '#DC2626',
    marginTop: 4,
    maxWidth: 120,
    textAlign: 'right',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 28,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 17,
    color: theme.colors.primaryDark,
  },
  balanceReminderBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  balanceReminderLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#64748B',
  },
  balanceReminderValue: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: theme.colors.primary,
  },
  sourceSelectorWrap: {
    marginBottom: 12,
  },
  sourceTabRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sourceTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 10,
    backgroundColor: '#F8FAFC',
  },
  sourceTabBtnActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  sourceTabTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: theme.colors.textPrimary,
  },
  sourceTabTitleActive: {
    color: '#FFFFFF',
  },
  sourceTabSub: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  sourceTabSubActive: {
    color: '#FEF3C7',
  },
  fieldLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: '#334155',
    marginBottom: 6,
  },
  inputWrapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
  },
  amountInput: {
    flex: 1,
    paddingVertical: 10,
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  allBtn: {
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  allBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: theme.colors.primary,
  },
  hintText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },
  pickerSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: '#FFFFFF',
  },
  pickerSelectorText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  bankListDropdown: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    marginTop: 6,
    overflow: 'hidden',
  },
  bankItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  bankItemActive: {
    backgroundColor: '#F8FAFC',
  },
  bankItemText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: '#334155',
  },
  bankItemTextActive: {
    fontFamily: fonts.bodyBold,
    color: theme.colors.primary,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: fonts.body,
    fontSize: 14,
    color: theme.colors.textPrimary,
    backgroundColor: '#FFFFFF',
  },
  safeNoteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 8,
    padding: 10,
    marginTop: 14,
  },
  safeNoteText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#166534',
    lineHeight: 16,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  modalCancelBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: '#64748B',
  },
  modalSubmitBtn: {
    flex: 1.5,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
  },
  modalSubmitBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  txDetailHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  txDetailHintText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#9CA3AF',
    marginRight: 2,
  },
  detailModalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 24,
    maxHeight: '88%',
  },
  detailHeroBox: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  detailHeroIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  detailHeroType: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: '#64748B',
  },
  detailHeroAmount: {
    fontFamily: fonts.serifBold,
    fontSize: 24,
    marginVertical: 4,
  },
  detailHeroTime: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#94A3B8',
  },
  detailSectionBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginTop: 10,
  },
  detailSectionTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  detailDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  detailDataLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#64748B',
    flex: 1,
  },
  detailDataValue: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: '#1E293B',
  },
  detailDataValueBold: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: '#1E293B',
  },
  detailDataValueMono: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: '#334155',
    maxWidth: 200,
    textAlign: 'right',
  },
  detailTypeBadge: {
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  detailTypeBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
  },
  detailDescRow: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  detailDescContentBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 8,
    marginTop: 6,
  },
  detailDescContentText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#334155',
    lineHeight: 18,
  },
  rejectionAlertBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  rejectionAlertTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: '#DC2626',
  },
  rejectionAlertDesc: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#991B1B',
    marginTop: 2,
    lineHeight: 16,
  },
  linkedBookingBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  linkedBookingBtnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  linkedBookingBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  detailCloseBtn: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    marginBottom: 6,
  },
  detailCloseBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: '#475569',
  },
  filterOneRowCard: {
    backgroundColor: 'rgba(255, 253, 247, 0.92)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterOneRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dotIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dropdownBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAF6EE',
    borderWidth: 1,
    borderColor: '#E6DCBF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  dropdownBtnActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  dropdownBtnText: {
    flex: 1,
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: '#3A2E25',
  },
  dropdownBtnTextActive: {
    fontFamily: fonts.bodyBold,
    color: '#FFFFFF',
  },
  resetQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 8,
  },
  resetQuickBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: '#EF4444',
  },
  filterSummaryMiniText: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: '#64748B',
    marginTop: 6,
    textAlign: 'right',
  },
  filterModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  filterModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  filterModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 8,
  },
  filterModalTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 15,
    color: theme.colors.primaryDark,
  },
  filterOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  filterOptionRowActive: {
    backgroundColor: '#F0FDF4',
  },
  filterOptionText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: '#334155',
  },
  filterOptionTextActive: {
    fontFamily: fonts.bodyBold,
    color: theme.colors.primary,
  },
  modalCustomDateBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginTop: 8,
  },
  modalCustomDatePrompt: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: '#475569',
    marginBottom: 8,
  },
  modalCustomDateRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modalDateInputCol: {
    flex: 1,
  },
  modalDateInputLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: '#64748B',
    marginBottom: 3,
  },
  modalDateInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#1E293B',
  },
  modalCustomBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 10,
  },
  modalCustomResetBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  modalCustomResetText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#64748B',
  },
  modalCustomApplyBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
    backgroundColor: theme.colors.primary,
  },
  modalCustomApplyText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: '#FFFFFF',
  },
  resetEmptyBtn: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  resetEmptyBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: theme.colors.primary,
  },
});



