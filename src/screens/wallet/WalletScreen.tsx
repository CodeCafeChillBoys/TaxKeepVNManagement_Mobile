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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { GoldDoubleRule } from '../../components/brand/GoldDoubleRule';
import { Dialog } from '../../components/common/Dialog';
import { RootNavigationProp, RootStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../stores/useAuthStore';
import {
  walletApi,
  WalletResponse,
  WalletTransactionResponse,
  WithdrawalResponse,
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

function formatTxType(type?: string): { label: string; isPositive: boolean; icon: string; color: string } {
  switch ((type || '').toUpperCase()) {
    case 'DISBURSEMENT':
      return { label: 'Nhận thù lao tư vấn', isPositive: true, icon: 'arrow-down-circle', color: '#059669' };
    case 'REFUND':
      return { label: 'Hoàn tiền ca tư vấn', isPositive: true, icon: 'refresh-circle', color: '#2563EB' };
    case 'TOPUP':
      return { label: 'Nạp tiền vào ví', isPositive: true, icon: 'add-circle', color: '#059669' };
    case 'WITHDRAWAL':
      return { label: 'Rút tiền về ngân hàng', isPositive: false, icon: 'arrow-up-circle', color: '#D97706' };
    case 'FROZEN':
      return { label: 'Tạm giữ xử lý', isPositive: false, icon: 'lock-closed', color: '#DC2626' };
    default:
      return { label: 'Biến động số dư', isPositive: false, icon: 'cash-outline', color: '#6B7280' };
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

  // Modal rút tiền
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [bankName, setBankName] = useState('Vietcombank');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState(currentUser?.fullName ? currentUser.fullName.toUpperCase() : '');
  const [submittingWithdraw, setSubmittingWithdraw] = useState(false);
  const [showBankPicker, setShowBankPicker] = useState(false);

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
        if (expRes.status === 'fulfilled') setExpertWallet(expRes.value);
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
        const res = await walletApi.getMyWalletTransactions(1, 40);
        setTransactions(res.items || []);
      } else {
        if (isExpertRole) {
          const [expRes, usrRes] = await Promise.allSettled([
            walletApi.getMyExpertWithdrawals(undefined, 1, 20),
            walletApi.getMyUserWithdrawals(undefined, 1, 20),
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
          const res = await walletApi.getMyUserWithdrawals(undefined, 1, 30);
          setWithdrawals(res.items || []);
        }
      }
    } catch (err: any) {
      console.warn('Lỗi tải lịch sử:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, [activeTab, isExpertRole]);

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

  const handleOpenWithdrawModal = () => {
    if (availableBalance <= 0) {
      setDialog({
        title: 'Số dư không đủ',
        message: 'Số dư khả dụng hiện tại là 0 ₫. Không thể tạo lệnh rút tiền.',
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
      return;
    }

    const expBal = Number(expertWallet?.availableBalance ?? 0);
    const usrBal = Number(userWallet?.availableBalance ?? 0);

    if (isExpertRole) {
      if (expBal >= 500000) {
        setWithdrawSource('EXPERT');
        setWithdrawAmount(String(Math.floor(expBal)));
      } else if (usrBal >= 50000) {
        setWithdrawSource('USER');
        setWithdrawAmount(String(Math.floor(usrBal)));
      } else if (expBal > 0) {
        setWithdrawSource('EXPERT');
        setWithdrawAmount(String(Math.floor(expBal)));
      } else {
        setWithdrawSource('USER');
        setWithdrawAmount(String(Math.floor(usrBal)));
      }
    } else {
      setWithdrawSource('USER');
      setWithdrawAmount(String(Math.floor(usrBal)));
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

    if (parsedAmount > targetBal) {
      const sourceName = isExpertRole && withdrawSource === 'EXPERT' ? 'Ví thu nhập chuyên gia' : 'Ví hoàn tiền dịch vụ';
      setDialog({
        title: 'Vượt quá số dư',
        message: `Số tiền muốn rút (${formatVnd(parsedAmount)}) lớn hơn số dư khả dụng hiện có trong ${sourceName} (${formatVnd(targetBal)}).`,
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
      return;
    }

    if (isExpertRole && withdrawSource === 'EXPERT' && parsedAmount < 500000) {
      setDialog({
        title: 'Chưa đạt mức tối thiểu',
        message: 'Theo quy định sàn, chuyên gia rút thù lao tư vấn tối thiểu từ 500.000 ₫ mỗi lần.',
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
      return;
    }

    if ((!isExpertRole || withdrawSource === 'USER') && parsedAmount < 50000) {
      setDialog({
        title: 'Chưa đạt mức tối thiểu',
        message: 'Số tiền rút từ ví hoàn tiền tối thiểu từ 50.000 ₫ mỗi lần.',
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

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      if (isExpertRole) {
        navigation.navigate('ExpertBookings');
      } else {
        navigation.navigate('Profile');
      }
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
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
          {isExpertRole ? 'Ví tài khoản chuyên gia' : 'Ví hoàn tiền & Rút tiền'}
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
              <Ionicons name="wallet" size={24} color="#D97706" />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.heroSubLabel}>
                {isExpertRole ? 'Tổng số dư khả dụng' : 'Số dư hoàn tiền khả dụng'}
              </Text>
              <Text style={styles.heroBalanceText}>{formatVnd(availableBalance)}</Text>
            </View>
          </View>

          {isExpertRole && Number(userWallet?.availableBalance ?? 0) > 0 && (
            <View style={styles.walletBreakdownRow}>
              <Text style={styles.walletBreakdownText}>
                Thù lao: <Text style={{ fontFamily: fonts.bodyBold }}>{formatVnd(expertWallet?.availableBalance ?? 0)}</Text>
                {'   •   '}
                Tiền hoàn: <Text style={{ fontFamily: fonts.bodyBold }}>{formatVnd(userWallet?.availableBalance ?? 0)}</Text>
              </Text>
            </View>
          )}

          {/* Stats Bar */}
          <View style={styles.heroStatsRow}>
            <View style={styles.statCol}>
              <Text style={styles.statLabel}>
                {isExpertRole ? 'Tổng thu nhập đã nhận' : 'Tổng tiền đã hoàn'}
              </Text>
              <Text style={styles.statValueBold}>{formatVnd(totalEarned)}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statLabel}>Đã rút về ngân hàng</Text>
              <Text style={styles.statValueBold}>{formatVnd(totalWithdrawn)}</Text>
            </View>
          </View>

          {frozenBalance > 0 && (
            <View style={styles.frozenRow}>
              <Ionicons name="lock-closed-outline" size={14} color="#B45309" />
              <Text style={styles.frozenText}>
                Đang tạm giữ đối soát: <Text style={{ fontFamily: fonts.bodyBold }}>{formatVnd(frozenBalance)}</Text>
              </Text>
            </View>
          )}

          {/* Action Button: Rút tiền */}
          <TouchableOpacity
            style={styles.withdrawBtn}
            activeOpacity={0.85}
            onPress={handleOpenWithdrawModal}
            accessibilityRole="button"
            accessibilityLabel="Rút tiền về ngân hàng"
          >
            <Ionicons name="arrow-down-circle-outline" size={18} color="#FFFFFF" />
            <Text style={styles.withdrawBtnText}>Rút tiền về tài khoản ngân hàng</Text>
          </TouchableOpacity>
        </View>

        {/* ── TAB BAR ── */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'TRANSACTIONS' && styles.tabBtnActive]}
            onPress={() => setActiveTab('TRANSACTIONS')}
          >
            <Text style={[styles.tabBtnText, activeTab === 'TRANSACTIONS' && styles.tabBtnTextActive]}>
              Biến động số dư
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'WITHDRAWALS' && styles.tabBtnActive]}
            onPress={() => setActiveTab('WITHDRAWALS')}
          >
            <Text style={[styles.tabBtnText, activeTab === 'WITHDRAWALS' && styles.tabBtnTextActive]}>
              Lịch sử rút tiền
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── CONTENT LIST ── */}
        {historyLoading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Đang tải dữ liệu ví...</Text>
          </View>
        ) : activeTab === 'TRANSACTIONS' ? (
          transactions.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="receipt-outline" size={44} color="#CCCCCC" />
              <Text style={styles.emptyTitle}>Chưa có biến động số dư</Text>
              <Text style={styles.emptySub}>
                {isExpertRole
                  ? 'Khi hoàn thành các ca tư vấn, thù lao sẽ tự động được cộng vào ví này.'
                  : 'Khoản tiền hoàn từ các ca tư vấn bị hủy hoặc hoàn trả sẽ hiển thị tại đây.'}
              </Text>
            </View>
          ) : (
            <View style={styles.listCard}>
              {transactions.map((tx, idx) => {
                const info = formatTxType(tx.transactionType);
                const isAmountPositive = Number(tx.amount) > 0;
                return (
                  <View key={tx.id ? `${tx.id}-${idx}` : `tx-${idx}`}>
                    <View style={styles.txRow}>
                      <View style={[styles.txIconCircle, { backgroundColor: `${info.color}15` }]}>
                        <Ionicons name={info.icon as any} size={20} color={info.color} />
                      </View>
                      <View style={styles.txMain}>
                        <Text style={styles.txTitle}>{info.label}</Text>
                        <Text style={styles.txDesc} numberOfLines={2}>
                          {tx.description || 'Giao dịch qua ví TaxKeepVN'}
                        </Text>
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
                        <Text style={styles.txBalanceAfter}>
                          Số dư: {formatVnd(tx.balanceAfter)}
                        </Text>
                      </View>
                    </View>
                    {idx < transactions.length - 1 && <View style={styles.rowDivider} />}
                  </View>
                );
              })}
            </View>
          )
        ) : (
          withdrawals.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="card-outline" size={44} color="#CCCCCC" />
              <Text style={styles.emptyTitle}>Chưa có lệnh rút tiền nào</Text>
              <Text style={styles.emptySub}>
                Bạn có thể bấm nút "Rút tiền về tài khoản ngân hàng" phía trên để tạo lệnh rút.
              </Text>
            </View>
          ) : (
            <View style={styles.listCard}>
              {withdrawals.map((w, idx) => {
                const st = formatWithdrawalStatus(w.status);
                return (
                  <View key={w.id ? `${w.id}-${idx}` : `withdraw-${idx}`}>
                    <View style={styles.withdrawalRow}>
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
                      </View>
                    </View>
                    {idx < withdrawals.length - 1 && <View style={styles.rowDivider} />}
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
                        name="refresh-circle-outline"
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
                          Tiền hoàn
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
                    ? 'Số dư Tiền hoàn khả dụng:'
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
                  value={withdrawAmount}
                  onChangeText={(t) => setWithdrawAmount(t.replace(/\D/g, ''))}
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
                  * Mức rút tối thiểu thù lao chuyên gia: 500.000 ₫ (Yêu cầu đã eKYC & cập nhật MST)
                </Text>
              ) : (
                <Text style={styles.hintText}>* Mức rút tối thiểu từ tiền hoàn: 50.000 ₫</Text>
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
    backgroundColor: '#FFFFFF',
  },
  backBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 17,
    color: theme.colors.textPrimary,
  },
  refreshBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroSubLabel: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: '#94A3B8',
  },
  heroBalanceText: {
    fontFamily: fonts.bodyBold,
    fontSize: 26,
    color: '#F8FAFC',
    marginTop: 2,
  },
  walletBreakdownRow: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  walletBreakdownText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#CBD5E1',
  },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 10,
    padding: 12,
    marginTop: 14,
  },
  statCol: {
    flex: 1,
  },
  statLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#94A3B8',
  },
  statValueBold: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: '#F1F5F9',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
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
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 4,
    marginBottom: 14,
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
    fontFamily: fonts.body,
    fontSize: 13,
    color: '#64748B',
  },
  tabBtnTextActive: {
    fontFamily: fonts.bodyBold,
    color: theme.colors.textPrimary,
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
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: '#475569',
  },
  emptySub: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
  },
  listCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: '#1E293B',
  },
  txDesc: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  txTime: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  txAmountCol: {
    alignItems: 'flex-end',
  },
  txAmountText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
  },
  txBalanceAfter: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  rowDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
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
    fontSize: 13,
    color: '#1E293B',
  },
  accountNumberText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
  accountNameText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  withdrawalRight: {
    alignItems: 'flex-end',
  },
  withdrawAmountText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: '#D97706',
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
    fontFamily: fonts.bodyBold,
    fontSize: 17,
    color: theme.colors.textPrimary,
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
});
