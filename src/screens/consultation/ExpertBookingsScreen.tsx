import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { DrumPatternBackdrop } from '../../components/brand/DrumPatternBackdrop';
import { GoldDoubleRule } from '../../components/brand/GoldDoubleRule';
import { Dialog } from '../../components/common/Dialog';
import { RootNavigationProp, RootStackParamList } from '../../navigation/types';
import { consultationApi } from '../../api/consultationApi';
import { walletApi, WalletResponse } from '../../api/walletApi';
import { toFriendlyConsultationError } from '../../utils/consultationFriendlyErrors';
import type { BookingListItemResponse } from '../../types/consultation';
import {
  formatVnd,
  formatBookingStatus,
  formatSessionType,
  formatVietnameseDate,
  formatTimeRange,
} from '../../types/consultation';

const EXPERT_STATUS_FILTER_OPTIONS = [
  { key: 'ALL', label: 'Tất cả trạng thái', shortLabel: 'Trạng thái' },
  { key: 'CONFIRMED', label: 'Đã xác nhận', shortLabel: 'Đã xác nhận' },
  { key: 'IN_PROGRESS', label: 'Đang tư vấn', shortLabel: 'Đang tư vấn' },
  { key: 'COMPLETED', label: 'Đã hoàn thành', shortLabel: 'Hoàn thành' },
  { key: 'SETTLED', label: 'Đã tất toán thù lao', shortLabel: 'Đã tất toán' },
  { key: 'UNDER_DISPUTE', label: 'Đang khiếu nại', shortLabel: 'Khiếu nại' },
  { key: 'USER_NO_SHOW', label: 'Khách vắng mặt (Đóng ca)', shortLabel: 'Khách vắng' },
  { key: 'REJECTED_BY_EXPERT', label: 'Chuyên gia từ chối', shortLabel: 'Từ chối' },
  { key: 'CANCELLED_BY_USER', label: 'Khách hàng đã hủy', shortLabel: 'Khách hủy' },
];

const SESSION_FILTER_OPTIONS = [
  { key: 'ALL', label: 'Tất cả dịch vụ', shortLabel: 'Dịch vụ', icon: 'layers-outline' },
  { key: 'ONLINE_MEETING', label: 'Họp trực tuyến (Video 1-1)', shortLabel: 'Video 1-1', icon: 'videocam-outline' },
  { key: 'CHAT', label: 'Nhắn tin tư vấn (Chat)', shortLabel: 'Nhắn tin', icon: 'chatbubbles-outline' },
  { key: 'VOICE_CALL', label: 'Gọi thoại tư vấn (Audio)', shortLabel: 'Gọi thoại', icon: 'call-outline' },
];

const DATE_FILTER_OPTIONS = [
  { key: 'ALL', label: 'Tất cả thời gian', shortLabel: 'Thời gian' },
  { key: 'TODAY', label: 'Hôm nay', shortLabel: 'Hôm nay' },
  { key: 'UPCOMING', label: 'Lịch sắp tới', shortLabel: 'Sắp tới' },
  { key: '7DAYS', label: 'Trong 7 ngày qua', shortLabel: '7 ngày qua' },
  { key: 'THIS_MONTH', label: 'Trong tháng này', shortLabel: 'Tháng này' },
];

type TabKey = 'PENDING' | 'ALL';

export const ExpertBookingsScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'ExpertBookings'>>();
  const initialTab = route.params?.initialTab === 'pending' ? 'PENDING' : 'ALL';

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [pendingBookings, setPendingBookings] = useState<BookingListItemResponse[]>([]);
  const [allBookings, setAllBookings] = useState<BookingListItemResponse[]>([]);
  const [expertWallet, setExpertWallet] = useState<WalletResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters (Dropdowns)
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sessionFilter, setSessionFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('ALL');
  const [configuredSessionTypes, setConfiguredSessionTypes] = useState<string[]>(['ONLINE_MEETING']);
  const [statusModalVisible, setStatusModalVisible] = useState<boolean>(false);
  const [sessionModalVisible, setSessionModalVisible] = useState<boolean>(false);
  const [dateModalVisible, setDateModalVisible] = useState<boolean>(false);

  // Reject modal state
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectingBooking, setRejectingBooking] = useState<BookingListItemResponse | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Dialog state
  const [dialog, setDialog] = useState<{
    title: string;
    message: string;
    primaryLabel?: string;
    onPrimary?: () => void;
    secondaryLabel?: string;
    onSecondary?: () => void;
    destructive?: boolean;
  } | null>(null);

  // Live timer for 2h approval countdown
  const [currentTimeMs, setCurrentTimeMs] = useState(Date.now());

  // Xử lý nút quay lại chuẩn xác, tránh vòng lặp điều hướng
  const handleBack = useCallback(() => {
    const state = navigation.getState();
    const routes = state?.routes || [];
    const prevRoute = routes.length >= 2 ? routes[routes.length - 2] : null;

    if (
      prevRoute &&
      ['BookingDetail', 'Wallet', 'PaymentResult', 'ExpertSlots', 'ExpertApplication'].includes(
        prevRoute.name
      )
    ) {
      navigation.navigate('Profile');
      return;
    }

    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Profile');
    }
  }, [navigation]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true;
    });
    return () => sub.remove();
  }, [handleBack]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimeMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const apiStatusParam =
        statusFilter === 'ALL' || statusFilter === 'USER_NO_SHOW' ? undefined : statusFilter;

      const [walletRes, bookingsRes, feeConfigsRes] = await Promise.allSettled([
        walletApi.getMyWallet('EXPERT'),
        activeTab === 'PENDING'
          ? consultationApi.getExpertPendingBookings({ page: 1, size: 30 })
          : consultationApi.getExpertBookings({
              status: apiStatusParam,
              page: 1,
              size: 50,
            }),
        consultationApi.getConsultationFeeConfigs({ isActive: true }),
      ]);

      if (walletRes.status === 'fulfilled') {
        setExpertWallet(walletRes.value);
      }

      if (feeConfigsRes.status === 'fulfilled' && Array.isArray(feeConfigsRes.value)) {
        const activeTypes = Array.from(
          new Set(
            feeConfigsRes.value
              .filter((c) => c.isActive !== false)
              .map((c) => c.sessionType)
          )
        );
        if (activeTypes.length > 0) {
          setConfiguredSessionTypes(activeTypes);
        }
      }

      if (bookingsRes.status === 'fulfilled') {
        if (activeTab === 'PENDING') {
          setPendingBookings(bookingsRes.value.items || []);
        } else {
          setAllBookings(bookingsRes.value.items || []);
        }
      } else {
        throw bookingsRes.reason;
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Không thể tải danh sách ca tư vấn.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useFocusEffect(
    useCallback(() => {
      fetchData(true);
    }, [fetchData])
  );

  // Handle Accept
  const handleAccept = (booking: BookingListItemResponse) => {
    setDialog({
      title: 'Tiếp nhận ca tư vấn',
      message: `Bạn đồng ý tiếp nhận ca tư vấn của khách hàng ${booking.userFullName}?`,
      primaryLabel: 'Đồng ý tiếp nhận',
      secondaryLabel: 'Hủy',
      onSecondary: () => setDialog(null),
      onPrimary: async () => {
        setDialog(null);
        setActionLoading(true);
        try {
          await consultationApi.acceptBooking(booking.id);
          setDialog({
            title: 'Thành công',
            message: 'Lịch hẹn tư vấn chính thức được xác nhận.',
            primaryLabel: 'Đóng',
            onPrimary: () => setDialog(null),
          });
          fetchData(true);
        } catch (err: any) {
          const friendly = toFriendlyConsultationError(
            err,
            'Không thể tiếp nhận',
            'Không thể tiếp nhận ca tư vấn lúc này.'
          );
          setDialog({
            title: friendly.title,
            message: friendly.message,
            primaryLabel: 'Đã hiểu',
            onPrimary: () => setDialog(null),
          });
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  // Handle Reject Submit
  const handleConfirmReject = async () => {
    if (!rejectingBooking || rejectReason.trim().length < 5) {
      setDialog({
        title: 'Cần nêu rõ lý do',
        message: 'Vui lòng nhập lý do từ chối tối thiểu 5 ký tự để khách hàng nắm thông tin.',
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
      return;
    }
    setActionLoading(true);
    try {
      await consultationApi.rejectBooking(rejectingBooking.id, rejectReason.trim());
      setRejectModalVisible(false);
      setRejectingBooking(null);
      setRejectReason('');
      setDialog({
        title: 'Đã từ chối ca tư vấn',
        message:
          'Ca tư vấn đã được từ chối. Hệ thống tự động hoàn trả 100% chi phí cho khách hàng và mở lại khung giờ.',
        primaryLabel: 'Đóng',
        onPrimary: () => setDialog(null),
      });
      fetchData(true);
    } catch (err: any) {
      const friendly = toFriendlyConsultationError(
        err,
        'Không thể từ chối',
        'Không thể từ chối ca tư vấn lúc này.'
      );
      setDialog({
        title: friendly.title,
        message: friendly.message,
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
    } finally {
      setActionLoading(false);
    }
  };

  const renderPendingItem = ({ item }: { item: BookingListItemResponse }) => {
    const session = formatSessionType(item.sessionType);
    let secondsLeft = 0;
    if (item.approvalDeadline) {
      const deadlineMs = new Date(item.approvalDeadline).getTime();
      secondsLeft = Math.max(0, Math.floor((deadlineMs - currentTimeMs) / 1000));
    }
    const hours = Math.floor(secondsLeft / 3600);
    const mins = Math.floor((secondsLeft % 3600) / 60);
    const secs = secondsLeft % 60;
    const isUrgent = secondsLeft < 1800; // Under 30 mins

    return (
      <View style={styles.bookingCard}>
        {/* Header row: Session meta, Countdown tag, Fee */}
        <View style={styles.cardHeader}>
          <View style={styles.codeWrap}>
            <View style={styles.sessionMeta}>
              <Ionicons name={session.icon as any} size={14} color="#666666" />
              <Text style={styles.sessionMetaText}>{session.label}</Text>
            </View>
            <View style={styles.timerMetaRow}>
              <Ionicons
                name={isUrgent ? 'alarm' : 'hourglass-outline'}
                size={13}
                color={isUrgent ? '#B91C1C' : '#92400E'}
              />
              <Text style={[styles.timerMetaText, isUrgent && styles.timerMetaTextUrgent]}>
                {secondsLeft > 0
                  ? `Chờ duyệt: ${hours > 0 ? `${hours}h ` : ''}${mins}m`
                  : 'Hết hạn'}
              </Text>
            </View>
          </View>
          <Text style={styles.cardFee}>{formatVnd(item.fee)}</Text>
        </View>

        {/* Customer & topic */}
        <Text style={styles.clientName}>Khách hàng: {item.userFullName}</Text>
        <Text style={styles.topicTitle} numberOfLines={2}>
          {item.topicTitle || 'Yêu cầu tư vấn quyết toán thuế'}
        </Text>

        {/* Info pills */}
        <View style={styles.pillRow}>
          <View style={styles.pill}>
            <Ionicons name="calendar-outline" size={13} color="#444444" />
            <Text style={styles.pillText}>{formatVietnameseDate(item.slotDate)}</Text>
          </View>
          <View style={styles.pill}>
            <Ionicons name="time-outline" size={13} color="#444444" />
            <Text style={styles.pillText}>{formatTimeRange(item.startTime, item.endTime)}</Text>
          </View>
          {Boolean(item.attachmentCount && item.attachmentCount > 0) && (
            <View style={styles.pill}>
              <Ionicons name="attach" size={13} color="#444444" />
              <Text style={styles.pillText}>{item.attachmentCount} tệp</Text>
            </View>
          )}
        </View>

        {/* Action Buttons Row */}
        <View style={styles.actionBtnRow}>
          <TouchableOpacity
            style={styles.detailBtn}
            onPress={() => navigation.navigate('BookingDetail', { bookingId: item.id, isExpertView: true })}
          >
            <Text style={styles.detailBtnText}>Chi tiết</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cardRejectBtn}
            onPress={() => {
              setRejectingBooking(item);
              setRejectReason('');
              setRejectModalVisible(true);
            }}
          >
            <Text style={styles.cardRejectBtnText}>Từ chối</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cardAcceptBtn}
            onPress={() => handleAccept(item)}
            disabled={actionLoading}
          >
            <Ionicons name="checkmark-circle" size={15} color="#FFFFFF" />
            <Text style={styles.cardAcceptBtnText}>Tiếp nhận</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderAllItem = ({ item }: { item: BookingListItemResponse }) => {
    const status = formatBookingStatus(item.status, item.noShowType, true);
    const session = formatSessionType(item.sessionType);

    return (
      <TouchableOpacity
        style={styles.bookingCard}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('BookingDetail', { bookingId: item.id, isExpertView: true })}
      >
        <View style={styles.cardHeader}>
          <View style={styles.sessionMeta}>
            <Ionicons name={session.icon as any} size={14} color="#666666" />
            <Text style={styles.sessionMetaText}>{session.label}</Text>
          </View>
          <View style={styles.statusIndicatorRow}>
            <View style={[styles.statusDot, { backgroundColor: status.color }]} />
            <Text style={[styles.statusIndicatorText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>

        {item.noShowType === 'USER_NO_SHOW' && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#ECFDF5',
              borderWidth: 1,
              borderColor: '#A7F3D0',
              borderRadius: 8,
              paddingHorizontal: 10,
              paddingVertical: 6,
              marginBottom: 8,
              gap: 6,
            }}
          >
            <Ionicons name="shield-checkmark" size={14} color="#059669" />
            <Text style={{ flex: 1, fontFamily: fonts.bodySemi, fontSize: 11.5, color: '#065F46' }}>
              Khách hàng vắng mặt sau 15 phút • Hệ thống đóng ca bảo vệ thù lao
            </Text>
          </View>
        )}
        {item.noShowType === 'EXPERT_NO_SHOW' && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#FEF2F2',
              borderWidth: 1,
              borderColor: '#FECACA',
              borderRadius: 8,
              paddingHorizontal: 10,
              paddingVertical: 6,
              marginBottom: 8,
              gap: 6,
            }}
          >
            <Ionicons name="warning" size={14} color="#DC2626" />
            <Text style={{ flex: 1, fontFamily: fonts.bodySemi, fontSize: 11.5, color: '#991B1B' }}>
              Bạn vắng mặt quá 15 phút • Đã tự động hủy & hoàn tiền cho khách
            </Text>
          </View>
        )}

        <Text style={styles.clientName}>Khách hàng: {item.userFullName}</Text>
        <Text style={styles.topicTitle} numberOfLines={2}>
          {item.topicTitle || 'Yêu cầu tư vấn'}
        </Text>

        <View style={styles.pillRow}>
          <View style={styles.pill}>
            <Ionicons name="calendar-outline" size={13} color="#444444" />
            <Text style={styles.pillText}>{formatVietnameseDate(item.slotDate)}</Text>
          </View>
          <View style={styles.pill}>
            <Ionicons name="time-outline" size={13} color="#444444" />
            <Text style={styles.pillText}>{formatTimeRange(item.startTime, item.endTime)}</Text>
          </View>
          <View style={[styles.pill, { backgroundColor: `${session.color}15` }]}>
            <Ionicons name={session.icon as any} size={13} color={session.color} />
            <Text style={[styles.pillText, { color: session.color }]}>{session.label}</Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.cardFee}>{formatVnd(item.fee)}</Text>
          <View style={styles.cardFooterRight}>
            <Text style={styles.viewDetailLink}>Xem chi tiết</Text>
            <Ionicons name="chevron-forward" size={14} color={theme.colors.primary} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const currentList = useMemo(() => {
    const rawList = activeTab === 'PENDING' ? pendingBookings : allBookings;
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const sevenDaysAgoStr = `${sevenDaysAgo.getFullYear()}-${String(sevenDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(sevenDaysAgo.getDate()).padStart(2, '0')}`;

    return rawList.filter((item) => {
      if (activeTab === 'ALL') {
        if (statusFilter === 'USER_NO_SHOW' && item.noShowType !== 'USER_NO_SHOW') {
          return false;
        }
        if (
          statusFilter !== 'ALL' &&
          statusFilter !== 'USER_NO_SHOW' &&
          item.status !== statusFilter
        ) {
          return false;
        }
      }
      if (sessionFilter !== 'ALL' && item.sessionType !== sessionFilter) {
        return false;
      }
      if (dateFilter !== 'ALL') {
        const slotDate = (item.slotDate || '').split('T')[0];
        if (dateFilter === 'TODAY' && slotDate !== todayStr) return false;
        if (dateFilter === 'UPCOMING' && slotDate < todayStr) return false;
        if (dateFilter === '7DAYS' && (slotDate < sevenDaysAgoStr || slotDate > todayStr)) return false;
        if (dateFilter === 'THIS_MONTH' && !slotDate.startsWith(currentMonthPrefix)) return false;
      }
      return true;
    });
  }, [activeTab, pendingBookings, allBookings, statusFilter, sessionFilter, dateFilter]);

  const hasActiveFilters =
    (activeTab === 'ALL' && statusFilter !== 'ALL') ||
    sessionFilter !== 'ALL' ||
    dateFilter !== 'ALL';

  const resetFilters = () => {
    setStatusFilter('ALL');
    setSessionFilter('ALL');
    setDateFilter('ALL');
  };

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
        <Text style={styles.headerTitle}>Quản lý ca tư vấn</Text>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => fetchData(true)}
          accessibilityRole="button"
          accessibilityLabel="Làm mới"
        >
          <Ionicons name="refresh" size={20} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>
      <GoldDoubleRule />

      {/* ── REVENUE & WALLET KPI CARD ── */}
      <View style={styles.kpiRevenueCard}>
        <View style={styles.kpiRevenueLeft}>
          <Text style={styles.kpiRevenueLabel}>Tổng thu nhập tích lũy</Text>
          <Text style={styles.kpiRevenueValue}>{formatVnd(expertWallet?.totalEarned ?? 0)}</Text>
          <Text style={styles.kpiAvailableSub}>
            Số dư ví khả dụng: <Text style={{ fontFamily: fonts.bodyBold, color: '#059669' }}>{formatVnd(expertWallet?.availableBalance ?? 0)}</Text>
          </Text>
          {(expertWallet?.pendingEscrowReceivable ?? 0) > 0 && (
            <Text style={[styles.kpiAvailableSub, { marginTop: 2 }]}>
              Đang giữ bảo chứng chờ giải ngân:{' '}
              <Text style={{ fontFamily: fonts.bodyBold, color: '#D97706' }}>
                {formatVnd(expertWallet?.pendingEscrowReceivable ?? 0)}
              </Text>
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={styles.kpiWalletBtn}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('Wallet', { walletType: 'EXPERT' })}
          accessibilityRole="button"
          accessibilityLabel="TAXKEEP VN WALLET"
        >
          <Ionicons name="wallet-outline" size={16} color="#FFFFFF" />
          <Text style={styles.kpiWalletBtnText}>TAXKEEP VN WALLET</Text>
        </TouchableOpacity>
      </View>

      {/* ── TAB SELECTOR ── */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'PENDING' && styles.tabBtnActive]}
          onPress={() => setActiveTab('PENDING')}
        >
          <Text style={[styles.tabBtnText, activeTab === 'PENDING' && styles.tabBtnTextActive]}>
            Chờ duyệt
          </Text>
          {pendingBookings.length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{pendingBookings.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'ALL' && styles.tabBtnActive]}
          onPress={() => setActiveTab('ALL')}
        >
          <Text style={[styles.tabBtnText, activeTab === 'ALL' && styles.tabBtnTextActive]}>
            Tất cả lịch hẹn
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── SINGLE-ROW COMPACT DROPDOWN FILTER BAR ── */}
      <View style={styles.filterDropdownRow}>
        {/* Dropdown 1: Trạng thái (hiển thị ở tab Tất cả lịch hẹn) */}
        {activeTab === 'ALL' && (
          <TouchableOpacity
            style={[
              styles.filterDropdownBtn,
              statusFilter !== 'ALL' && styles.filterDropdownBtnActive,
            ]}
            onPress={() => setStatusModalVisible(true)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Lọc theo trạng thái"
          >
            <Ionicons
              name="funnel-outline"
              size={13}
              color={statusFilter !== 'ALL' ? '#FFFFFF' : theme.colors.primary}
            />
            <Text
              style={[
                styles.filterDropdownText,
                statusFilter !== 'ALL' && styles.filterDropdownTextActive,
              ]}
              numberOfLines={1}
            >
              {EXPERT_STATUS_FILTER_OPTIONS.find((o) => o.key === statusFilter)?.shortLabel || 'Trạng thái'}
            </Text>
            <Ionicons
              name="chevron-down"
              size={12}
              color={statusFilter !== 'ALL' ? '#FFFFFF' : '#6B7280'}
            />
          </TouchableOpacity>
        )}

        {/* Dropdown 2: Hình thức dịch vụ */}
        <TouchableOpacity
          style={[
            styles.filterDropdownBtn,
            sessionFilter !== 'ALL' && styles.filterDropdownBtnActive,
          ]}
          onPress={() => setSessionModalVisible(true)}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Lọc theo hình thức dịch vụ"
        >
          <Ionicons
            name="layers-outline"
            size={13}
            color={sessionFilter !== 'ALL' ? '#FFFFFF' : theme.colors.primary}
          />
          <Text
            style={[
              styles.filterDropdownText,
              sessionFilter !== 'ALL' && styles.filterDropdownTextActive,
            ]}
            numberOfLines={1}
          >
            {SESSION_FILTER_OPTIONS.find((o) => o.key === sessionFilter)?.shortLabel || 'Dịch vụ'}
          </Text>
          <Ionicons
            name="chevron-down"
            size={12}
            color={sessionFilter !== 'ALL' ? '#FFFFFF' : '#6B7280'}
          />
        </TouchableOpacity>

        {/* Dropdown 3: Thời gian hẹn */}
        <TouchableOpacity
          style={[
            styles.filterDropdownBtn,
            dateFilter !== 'ALL' && styles.filterDropdownBtnActive,
          ]}
          onPress={() => setDateModalVisible(true)}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Lọc theo thời gian"
        >
          <Ionicons
            name="calendar-outline"
            size={13}
            color={dateFilter !== 'ALL' ? '#FFFFFF' : theme.colors.primary}
          />
          <Text
            style={[
              styles.filterDropdownText,
              dateFilter !== 'ALL' && styles.filterDropdownTextActive,
            ]}
            numberOfLines={1}
          >
            {DATE_FILTER_OPTIONS.find((o) => o.key === dateFilter)?.shortLabel || 'Thời gian'}
          </Text>
          <Ionicons
            name="chevron-down"
            size={12}
            color={dateFilter !== 'ALL' ? '#FFFFFF' : '#6B7280'}
          />
        </TouchableOpacity>

        {hasActiveFilters && (
          <TouchableOpacity
            style={styles.filterResetIconBtn}
            onPress={resetFilters}
            accessibilityRole="button"
            accessibilityLabel="Xóa bộ lọc"
          >
            <Ionicons name="refresh" size={14} color={theme.colors.error} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── CONTENT LIST ── */}
      {loading && !refreshing ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Đang tải danh sách ca tư vấn...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerLoading}>
          <Ionicons name="alert-circle-outline" size={44} color={theme.colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchData(true)}>
            <Text style={styles.retryBtnText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : currentList.length === 0 ? (
        <View style={styles.centerEmpty}>
          <Ionicons
            name={activeTab === 'PENDING' ? 'checkmark-done-circle-outline' : 'calendar-outline'}
            size={48}
            color="#999999"
          />
          <Text style={styles.emptyTitle}>
            {activeTab === 'PENDING'
              ? 'Không có ca nào chờ tiếp nhận'
              : 'Chưa có lịch hẹn nào phù hợp'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {activeTab === 'PENDING'
              ? 'Bạn đã phản hồi toàn bộ các yêu cầu tư vấn hiện tại.'
              : 'Các lịch hẹn tư vấn mới sẽ hiển thị tại đây.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={currentList}
          keyExtractor={(item) => item.id}
          renderItem={activeTab === 'PENDING' ? renderPendingItem : renderAllItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchData(true)}
              colors={[theme.colors.primary]}
            />
          }
        />
      )}

      {/* ── DROPDOWN MODALS (TRẠNG THÁI / DỊCH VỤ / THỜI GIAN) ── */}
      <Modal
        visible={statusModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setStatusModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.dropdownModalOverlay}
          activeOpacity={1}
          onPress={() => setStatusModalVisible(false)}
        >
          <View style={styles.dropdownModalBox}>
            <View style={styles.dropdownModalHeader}>
              <Text style={styles.dropdownModalTitle}>Lọc theo trạng thái lịch hẹn</Text>
              <TouchableOpacity onPress={() => setStatusModalVisible(false)}>
                <Ionicons name="close" size={20} color="#666666" />
              </TouchableOpacity>
            </View>
            <GoldDoubleRule style={{ marginVertical: 8 }} />
            {EXPERT_STATUS_FILTER_OPTIONS.map((opt) => {
              const selected = statusFilter === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.dropdownOptionRow, selected && styles.dropdownOptionSelected]}
                  onPress={() => {
                    setStatusFilter(opt.key);
                    setStatusModalVisible(false);
                  }}
                >
                  <Text style={[styles.dropdownOptionText, selected && styles.dropdownOptionTextActive]}>
                    {opt.label}
                  </Text>
                  {selected && <Ionicons name="checkmark-circle" size={18} color={theme.colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={sessionModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSessionModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.dropdownModalOverlay}
          activeOpacity={1}
          onPress={() => setSessionModalVisible(false)}
        >
          <View style={styles.dropdownModalBox}>
            <View style={styles.dropdownModalHeader}>
              <Text style={styles.dropdownModalTitle}>Lọc theo hình thức tư vấn</Text>
              <TouchableOpacity onPress={() => setSessionModalVisible(false)}>
                <Ionicons name="close" size={20} color="#666666" />
              </TouchableOpacity>
            </View>
            <GoldDoubleRule style={{ marginVertical: 8 }} />
            {SESSION_FILTER_OPTIONS.filter(
              (opt) =>
                opt.key === 'ALL' ||
                configuredSessionTypes.includes(opt.key) ||
                pendingBookings.some((b) => b.sessionType === opt.key) ||
                allBookings.some((b) => b.sessionType === opt.key)
            ).map((opt) => {
              const selected = sessionFilter === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.dropdownOptionRow, selected && styles.dropdownOptionSelected]}
                  onPress={() => {
                    setSessionFilter(opt.key);
                    setSessionModalVisible(false);
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons
                      name={opt.icon as any}
                      size={16}
                      color={selected ? theme.colors.primary : '#666666'}
                    />
                    <Text style={[styles.dropdownOptionText, selected && styles.dropdownOptionTextActive]}>
                      {opt.label}
                    </Text>
                  </View>
                  {selected && <Ionicons name="checkmark-circle" size={18} color={theme.colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={dateModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDateModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.dropdownModalOverlay}
          activeOpacity={1}
          onPress={() => setDateModalVisible(false)}
        >
          <View style={styles.dropdownModalBox}>
            <View style={styles.dropdownModalHeader}>
              <Text style={styles.dropdownModalTitle}>Lọc theo thời gian lịch hẹn</Text>
              <TouchableOpacity onPress={() => setDateModalVisible(false)}>
                <Ionicons name="close" size={20} color="#666666" />
              </TouchableOpacity>
            </View>
            <GoldDoubleRule style={{ marginVertical: 8 }} />
            {DATE_FILTER_OPTIONS.map((opt) => {
              const selected = dateFilter === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.dropdownOptionRow, selected && styles.dropdownOptionSelected]}
                  onPress={() => {
                    setDateFilter(opt.key);
                    setDateModalVisible(false);
                  }}
                >
                  <Text style={[styles.dropdownOptionText, selected && styles.dropdownOptionTextActive]}>
                    {opt.label}
                  </Text>
                  {selected && <Ionicons name="checkmark-circle" size={18} color={theme.colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── REJECT MODAL ── */}
      <Modal
        visible={rejectModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Ionicons name="close-circle" size={26} color={theme.colors.error} />
              <Text style={styles.modalTitle}>Từ chối ca tư vấn</Text>
            </View>

            <Text style={styles.modalDesc}>
              Hệ thống sẽ hoàn trả 100% chi phí cho khách hàng và mở lại khung giờ tư vấn. Vui lòng nêu rõ lý do:
            </Text>

            <TextInput
              style={styles.reasonInput}
              placeholder="VD: Trùng lịch làm việc đột xuất, hồ sơ ngoài phạm vi hỗ trợ..."
              placeholderTextColor="#999999"
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setRejectModalVisible(false)}
                disabled={actionLoading}
              >
                <Text style={styles.modalCloseBtnText}>Đóng</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleConfirmReject}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>Xác nhận từ chối</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Thông báo Dialog chuẩn hệ thống */}
      {dialog ? (
        <Dialog
          visible={Boolean(dialog)}
          title={dialog.title}
          message={dialog.message}
          primaryLabel={dialog.primaryLabel || 'Đóng'}
          secondaryLabel={dialog.secondaryLabel}
          destructive={dialog.destructive}
          onPrimary={dialog.onPrimary || (() => setDialog(null))}
          onSecondary={dialog.onSecondary || (() => setDialog(null))}
          onRequestClose={() => setDialog(null)}
        />
      ) : null}
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
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(243, 239, 230, 0.85)',
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(243, 239, 230, 0.85)',
  },
  headerTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 18,
    lineHeight: 24,
    color: theme.colors.primaryDark,
  },

  // Tabs
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    marginRight: 20,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: theme.colors.primary,
  },
  tabBtnText: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  tabBtnTextActive: {
    fontFamily: fonts.bodyBold,
    color: theme.colors.primary,
  },
  tabBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  tabBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: '#FFFFFF',
  },

  // Single-row compact dropdown filters
  filterDropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
    gap: 8,
    backgroundColor: 'transparent',
  },
  filterDropdownBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 253, 247, 0.94)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5D5B5',
    gap: 4,
  },
  filterDropdownBtnActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterDropdownText: {
    flex: 1,
    fontFamily: fonts.bodySemi,
    fontSize: 11.5,
    color: '#3A2E25',
  },
  filterDropdownTextActive: {
    fontFamily: fonts.bodyBold,
    color: '#FFFFFF',
  },
  filterResetIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  dropdownModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  dropdownModalBox: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 18,
    paddingBottom: 30,
  },
  dropdownModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownModalTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 16,
    color: theme.colors.primaryDark,
  },
  dropdownOptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  dropdownOptionSelected: {
    backgroundColor: '#FAF5EE',
  },
  dropdownOptionText: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    color: theme.colors.textPrimary,
  },
  dropdownOptionTextActive: {
    fontFamily: fonts.bodyBold,
    color: theme.colors.primary,
  },

  // List & Cards (Flat design, NO nested card)
  listContent: {
    padding: 16,
    gap: 12,
  },
  bookingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  codeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sessionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  sessionMetaText: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: '#4B5563',
  },
  timerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timerMetaText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11.5,
    color: '#92400E',
  },
  timerMetaTextUrgent: {
    color: '#B91C1C',
  },
  cardFee: {
    fontFamily: fonts.serifBold,
    fontSize: 14,
    color: theme.colors.primary,
  },
  clientName: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  topicTitle: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#444444',
    lineHeight: 17,
    marginBottom: 10,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3EFE6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pillText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#333333',
  },
  statusIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusIndicatorText: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  cardFooterRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewDetailLink: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: theme.colors.primary,
  },

  // Actions row in pending card
  actionBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  detailBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#F3EFE6',
  },
  detailBtnText: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: '#444444',
  },
  cardRejectBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.error,
  },
  cardRejectBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: theme.colors.error,
  },
  cardAcceptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#059669',
    paddingVertical: 8,
    borderRadius: 6,
  },
  cardAcceptBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: '#FFFFFF',
  },

  // States
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 10,
  },
  centerEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 15,
    color: theme.colors.textPrimary,
    marginTop: 12,
  },
  emptySubtitle: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  errorText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: theme.colors.error,
    textAlign: 'center',
    marginVertical: 10,
  },
  retryBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 6,
  },
  retryBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: '#FFFFFF',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    width: '100%',
    maxWidth: 360,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  modalTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 16,
    color: theme.colors.error,
  },
  modalDesc: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#555555',
    lineHeight: 17,
    marginBottom: 12,
  },
  reasonInput: {
    backgroundColor: theme.colors.inputBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 10,
    fontFamily: fonts.body,
    fontSize: 12,
    color: theme.colors.textPrimary,
    minHeight: 70,
    marginBottom: 16,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCloseBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#F3EFE6',
  },
  modalCloseBtnText: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: '#555555',
  },
  modalSubmitBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: theme.colors.error,
  },
  modalSubmitBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: '#FFFFFF',
  },
  kpiRevenueCard: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: 'rgba(255, 253, 247, 0.94)',
    borderRadius: 14,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: '#E5D5B5',
    ...theme.shadows.card,
  },
  kpiRevenueLeft: {
    flex: 1,
    marginRight: 10,
  },
  kpiRevenueLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: '#5A4A22',
  },
  kpiRevenueValue: {
    fontFamily: fonts.serifBold,
    fontSize: 22,
    lineHeight: 28,
    color: theme.colors.primaryDark,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  kpiAvailableSub: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    color: theme.colors.textSecondary,
    marginTop: 3,
  },
  kpiWalletBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.primary,
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 8,
    ...theme.shadows.button,
  },
  kpiWalletBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: '#FFFFFF',
  },
});
