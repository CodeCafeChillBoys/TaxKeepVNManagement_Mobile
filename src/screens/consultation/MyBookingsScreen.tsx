import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  BackHandler,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { DrumPatternBackdrop } from '../../components/brand/DrumPatternBackdrop';
import { GoldDoubleRule } from '../../components/brand/GoldDoubleRule';
import { RootNavigationProp, RootStackParamList } from '../../navigation/types';
import { consultationApi } from '../../api/consultationApi';
import type { BookingListItemResponse, BookingStatus } from '../../types/consultation';
import {
  formatVnd,
  formatBookingStatus,
  formatSessionType,
  formatVietnameseDate,
  formatTimeRange,
  isValidAvatarUrl,
} from '../../types/consultation';

const STATUS_TABS: { key: string; label: string; shortLabel: string; status?: BookingStatus }[] = [
  { key: 'ALL', label: 'Tất cả trạng thái', shortLabel: 'Trạng thái' },
  { key: 'PENDING_PAYMENT', label: 'Chờ thanh toán', shortLabel: 'Chờ thanh toán', status: 'PENDING_PAYMENT' },
  { key: 'AWAITING_EXPERT_APPROVAL', label: 'Chờ chuyên gia duyệt', shortLabel: 'Chờ duyệt', status: 'AWAITING_EXPERT_APPROVAL' },
  { key: 'CONFIRMED', label: 'Đã xác nhận', shortLabel: 'Đã xác nhận', status: 'CONFIRMED' },
  { key: 'IN_PROGRESS', label: 'Đang tư vấn', shortLabel: 'Đang tư vấn', status: 'IN_PROGRESS' },
  { key: 'COMPLETED', label: 'Đã hoàn thành', shortLabel: 'Hoàn thành', status: 'COMPLETED' },
  { key: 'UNDER_DISPUTE', label: 'Đang khiếu nại', shortLabel: 'Khiếu nại', status: 'UNDER_DISPUTE' },
  { key: 'USER_NO_SHOW', label: 'Khách vắng mặt (Đóng ca)', shortLabel: 'Khách vắng mặt' },
  { key: 'CANCELLED_BY_USER', label: 'Đã hủy lịch', shortLabel: 'Đã hủy', status: 'CANCELLED_BY_USER' },
];

const SESSION_FILTER_OPTIONS: { key: 'ALL' | 'ONLINE_MEETING' | 'CHAT' | 'VOICE_CALL'; label: string; shortLabel: string; icon: string }[] = [
  { key: 'ALL', label: 'Tất cả dịch vụ', shortLabel: 'Dịch vụ', icon: 'layers-outline' },
  { key: 'ONLINE_MEETING', label: 'Họp trực tuyến (Video 1-1)', shortLabel: 'Video 1-1', icon: 'videocam-outline' },
  { key: 'CHAT', label: 'Nhắn tin tư vấn (Chat)', shortLabel: 'Nhắn tin', icon: 'chatbubbles-outline' },
  { key: 'VOICE_CALL', label: 'Gọi thoại tư vấn (Audio)', shortLabel: 'Gọi thoại', icon: 'call-outline' },
];

const DATE_FILTER_OPTIONS: { key: 'ALL' | 'TODAY' | 'UPCOMING' | '7DAYS' | 'THIS_MONTH'; label: string; shortLabel: string }[] = [
  { key: 'ALL', label: 'Tất cả thời gian', shortLabel: 'Thời gian' },
  { key: 'TODAY', label: 'Hôm nay', shortLabel: 'Hôm nay' },
  { key: 'UPCOMING', label: 'Lịch sắp tới', shortLabel: 'Sắp tới' },
  { key: '7DAYS', label: 'Trong 7 ngày qua', shortLabel: '7 ngày qua' },
  { key: 'THIS_MONTH', label: 'Trong tháng này', shortLabel: 'Tháng này' },
];

export const MyBookingsScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'MyBookings'>>();

  const [activeTabKey, setActiveTabKey] = useState<string>(route.params?.initialStatus || 'ALL');
  const [sessionFilter, setSessionFilter] = useState<'ALL' | 'ONLINE_MEETING' | 'CHAT' | 'VOICE_CALL'>('ALL');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'UPCOMING' | '7DAYS' | 'THIS_MONTH'>('ALL');
  const [configuredSessionTypes, setConfiguredSessionTypes] = useState<string[]>(['ONLINE_MEETING']);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [sessionModalVisible, setSessionModalVisible] = useState(false);
  const [dateModalVisible, setDateModalVisible] = useState(false);

  const [bookings, setBookings] = useState<BookingListItemResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const displayedBookings = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString().split('T')[0];
    const currentMonthPrefix = todayStr.slice(0, 7);

    return bookings.filter((item) => {
      if (activeTabKey === 'USER_NO_SHOW' && item.noShowType !== 'USER_NO_SHOW') {
        return false;
      }
      if (sessionFilter !== 'ALL' && item.sessionType !== sessionFilter) {
        return false;
      }
      if (dateFilter !== 'ALL') {
        const slotDate = (item.slotDate || '').split('T')[0];
        if (dateFilter === 'TODAY' && slotDate !== todayStr) return false;
        if (dateFilter === 'UPCOMING' && slotDate < todayStr) return false;
        if (dateFilter === '7DAYS' && slotDate < sevenDaysAgo) return false;
        if (dateFilter === 'THIS_MONTH' && !slotDate.startsWith(currentMonthPrefix)) return false;
      }
      return true;
    });
  }, [bookings, activeTabKey, sessionFilter, dateFilter]);

  // Countdown tick state
  const [currentTimeMs, setCurrentTimeMs] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimeMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    consultationApi
      .getConsultationFeeConfigs({ isActive: true })
      .then((configs) => {
        if (Array.isArray(configs)) {
          const activeTypes = Array.from(
            new Set(configs.filter((c) => c.isActive !== false).map((c) => c.sessionType))
          );
          if (activeTypes.length > 0) {
            setConfiguredSessionTypes(activeTypes);
          }
        }
      })
      .catch(() => {});
  }, []);

  const fetchBookings = useCallback(
    async (isRefresh = false, pageNum = 1) => {
      if (isRefresh) setRefreshing(true);
      else if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      setError(null);
      try {
        const tab = STATUS_TABS.find((t) => t.key === activeTabKey);
        const result = await consultationApi.getMyBookings({
          status: tab?.status,
          page: pageNum,
          size: 10,
        });

        if (pageNum === 1) {
          setBookings(result.items);
        } else {
          setBookings((prev) => [...prev, ...result.items]);
        }
        setPage(pageNum);
        setHasMore(result.pagination.page < result.pagination.totalPages);
      } catch (err: any) {
        setError(err?.response?.data?.message || err?.message || 'Không thể tải danh sách lịch hẹn.');
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [activeTabKey]
  );

  // Tự động tải lại danh sách lịch hẹn mới nhất mỗi khi quay lại màn hình
  useFocusEffect(
    useCallback(() => {
      fetchBookings(false, 1);
    }, [fetchBookings])
  );

  const handleRefresh = () => {
    fetchBookings(true, 1);
  };

  const handleLoadMore = () => {
    if (!loading && !loadingMore && hasMore) {
      fetchBookings(false, page + 1);
    }
  };

  // Helper calculation for hold timer
  const renderHoldTimer = (item: BookingListItemResponse) => {
    if (item.status === 'PENDING_PAYMENT') {
      const expiresAtMs = new Date(item.holdExpiresAt).getTime();
      const diffSec = Math.max(0, Math.floor((expiresAtMs - currentTimeMs) / 1000));
      const mins = Math.floor(diffSec / 60);
      const secs = diffSec % 60;

      if (diffSec <= 0) {
        return (
          <View style={styles.timerMetaRow}>
            <Ionicons name="alert-circle" size={13} color="#DC2626" />
            <Text style={styles.timerMetaExpired}>Đã hết hạn giữ chỗ</Text>
          </View>
        );
      }

      return (
        <View style={styles.timerMetaRow}>
          <Ionicons name="time" size={13} color="#D97706" />
          <Text style={styles.timerMetaWarning}>
            Giữ chỗ còn: {mins}:{secs.toString().padStart(2, '0')}
          </Text>
        </View>
      );
    }

    if (item.status === 'AWAITING_EXPERT_APPROVAL' && item.approvalDeadline) {
      const deadlineMs = new Date(item.approvalDeadline).getTime();
      const diffSec = Math.max(0, Math.floor((deadlineMs - currentTimeMs) / 1000));
      const hours = Math.floor(diffSec / 3600);
      const mins = Math.floor((diffSec % 3600) / 60);

      if (diffSec <= 0) {
        return (
          <View style={styles.timerMetaRow}>
            <Ionicons name="alert-circle" size={13} color="#DC2626" />
            <Text style={styles.timerMetaExpired}>Hết hạn 2 giờ duyệt</Text>
          </View>
        );
      }

      return (
        <View style={styles.timerMetaRow}>
          <Ionicons name="hourglass" size={13} color="#2563EB" />
          <Text style={styles.timerMetaInfo}>
            Hạn duyệt: {hours}h {mins}p
          </Text>
        </View>
      );
    }

    return null;
  };

  const handleBack = useCallback(() => {
    const state = navigation.getState();
    const routes = state?.routes || [];
    const prevRoute = routes.length >= 2 ? routes[routes.length - 2] : null;

    if (prevRoute && ['BookingDetail', 'PaymentResult', 'BookingCreate'].includes(prevRoute.name)) {
      navigation.navigate('Home');
      return;
    }

    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Home');
    }
  }, [navigation]);

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
        <Text style={styles.headerTitle}>Lịch hẹn của tôi</Text>
        <TouchableOpacity
          style={styles.newBookingBtn}
          onPress={() => navigation.navigate('ExpertList')}
          accessibilityRole="button"
          accessibilityLabel="Đặt lịch mới"
        >
          <Ionicons name="add" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>
      <GoldDoubleRule />

      {/* ── COMPACT HORIZONTAL DROPDOWN FILTERS ── */}
      <View style={styles.filterDropdownRow}>
        {/* 1. Dropdown Trạng thái */}
        <TouchableOpacity
          style={[
            styles.dropdownFilterBtn,
            activeTabKey !== 'ALL' && styles.dropdownFilterBtnActive,
          ]}
          onPress={() => setStatusModalVisible(true)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Lọc theo trạng thái lịch hẹn"
        >
          <Ionicons
            name="funnel-outline"
            size={13}
            color={activeTabKey !== 'ALL' ? '#FFFFFF' : theme.colors.primary}
          />
          <Text
            style={[
              styles.dropdownFilterBtnText,
              activeTabKey !== 'ALL' && styles.dropdownFilterBtnTextActive,
            ]}
            numberOfLines={1}
          >
            {STATUS_TABS.find((t) => t.key === activeTabKey)?.shortLabel || 'Trạng thái'}
          </Text>
          <Ionicons
            name="chevron-down"
            size={12}
            color={activeTabKey !== 'ALL' ? '#FFFFFF' : theme.colors.textSecondary}
          />
        </TouchableOpacity>

        {/* 2. Dropdown Hình thức dịch vụ */}
        <TouchableOpacity
          style={[
            styles.dropdownFilterBtn,
            sessionFilter !== 'ALL' && styles.dropdownFilterBtnActive,
          ]}
          onPress={() => setSessionModalVisible(true)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Lọc theo hình thức dịch vụ"
        >
          <Ionicons
            name={
              (SESSION_FILTER_OPTIONS.find((s) => s.key === sessionFilter)?.icon ||
                'layers-outline') as any
            }
            size={13}
            color={sessionFilter !== 'ALL' ? '#FFFFFF' : theme.colors.primary}
          />
          <Text
            style={[
              styles.dropdownFilterBtnText,
              sessionFilter !== 'ALL' && styles.dropdownFilterBtnTextActive,
            ]}
            numberOfLines={1}
          >
            {SESSION_FILTER_OPTIONS.find((s) => s.key === sessionFilter)?.shortLabel || 'Dịch vụ'}
          </Text>
          <Ionicons
            name="chevron-down"
            size={12}
            color={sessionFilter !== 'ALL' ? '#FFFFFF' : theme.colors.textSecondary}
          />
        </TouchableOpacity>

        {/* 3. Dropdown Thời gian */}
        <TouchableOpacity
          style={[
            styles.dropdownFilterBtn,
            dateFilter !== 'ALL' && styles.dropdownFilterBtnActive,
          ]}
          onPress={() => setDateModalVisible(true)}
          activeOpacity={0.85}
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
              styles.dropdownFilterBtnText,
              dateFilter !== 'ALL' && styles.dropdownFilterBtnTextActive,
            ]}
            numberOfLines={1}
          >
            {DATE_FILTER_OPTIONS.find((d) => d.key === dateFilter)?.shortLabel || 'Thời gian'}
          </Text>
          <Ionicons
            name="chevron-down"
            size={12}
            color={dateFilter !== 'ALL' ? '#FFFFFF' : theme.colors.textSecondary}
          />
        </TouchableOpacity>

        {/* Nút xóa lọc nhanh */}
        {(activeTabKey !== 'ALL' || sessionFilter !== 'ALL' || dateFilter !== 'ALL') && (
          <TouchableOpacity
            style={styles.filterResetIconBtn}
            onPress={() => {
              setActiveTabKey('ALL');
              setSessionFilter('ALL');
              setDateFilter('ALL');
            }}
            accessibilityRole="button"
            accessibilityLabel="Xóa bộ lọc"
          >
            <Ionicons name="refresh" size={14} color={theme.colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── BOOKINGS LIST ── */}
      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Đang tải danh sách lịch hẹn...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerError}>
          <Ionicons name="alert-circle-outline" size={44} color={theme.colors.error} />
          <Text style={styles.errorTitle}>Lỗi kết nối</Text>
          <Text style={styles.errorMsg}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchBookings(false, 1)}>
            <Text style={styles.retryBtnText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={displayedBookings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[theme.colors.primary]}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-clear-outline" size={54} color="#D1C7B7" />
              <Text style={styles.emptyTitle}>Chưa có lịch hẹn nào</Text>
              <Text style={styles.emptySubtitle}>
                {activeTabKey === 'ALL' && sessionFilter === 'ALL' && dateFilter === 'ALL'
                  ? 'Bạn chưa đặt lịch hẹn tư vấn nào. Hãy tìm chuyên gia để được giải đáp thắc mắc về thuế.'
                  : 'Không có lịch hẹn nào khớp với bộ lọc hiện tại.'}
              </Text>
              <TouchableOpacity
                style={styles.findExpertBtn}
                onPress={() => navigation.navigate('ExpertList')}
              >
                <Ionicons name="search" size={16} color="#FFFFFF" />
                <Text style={styles.findExpertBtnText}>Tìm chuyên gia tư vấn</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => {
            const statusInfo = formatBookingStatus(item.status, item.noShowType, false);
            const sessionInfo = formatSessionType(item.sessionType);

            return (
              <TouchableOpacity
                style={styles.bookingCard}
                activeOpacity={0.88}
                onPress={() => navigation.navigate('BookingDetail', { bookingId: item.id })}
              >
                {/* Header: Session & Status Indicator */}
                <View style={styles.cardHeader}>
                  <View style={styles.sessionMeta}>
                    <Ionicons name={sessionInfo.icon as any} size={14} color="#666666" />
                    <Text style={styles.sessionMetaText}>
                      {sessionInfo.label}
                    </Text>
                  </View>

                  <View style={styles.statusIndicatorRow}>
                    <View style={[styles.statusDot, { backgroundColor: statusInfo.color }]} />
                    <Text style={[styles.statusIndicatorText, { color: statusInfo.color }]}>
                      {statusInfo.label}
                    </Text>
                  </View>
                </View>

                {/* Countdown banner if applicable */}
                {renderHoldTimer(item)}

                {/* No-Show Notice Strip */}
                {item.noShowType === 'USER_NO_SHOW' && (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: '#FFF7ED',
                      borderWidth: 1,
                      borderColor: '#FED7AA',
                      borderRadius: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 7,
                      marginBottom: 10,
                      gap: 6,
                    }}
                  >
                    <Ionicons name="alert-circle" size={15} color="#C2410C" />
                    <Text style={{ flex: 1, fontFamily: fonts.bodySemi, fontSize: 12, color: '#9A3412' }}>
                      Bạn không tham gia phòng tư vấn sau 15 phút • Hệ thống tự động đóng ca
                    </Text>
                  </View>
                )}
                {item.noShowType === 'EXPERT_NO_SHOW' && (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: '#ECFDF5',
                      borderWidth: 1,
                      borderColor: '#A7F3D0',
                      borderRadius: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 7,
                      marginBottom: 10,
                      gap: 6,
                    }}
                  >
                    <Ionicons name="shield-checkmark" size={15} color="#059669" />
                    <Text style={{ flex: 1, fontFamily: fonts.bodySemi, fontSize: 12, color: '#065F46' }}>
                      Chuyên gia vắng mặt quá 15 phút • Đã hoàn tiền 100% về ví
                    </Text>
                  </View>
                )}

                {/* Expert info row */}
                <View style={styles.expertRow}>
                  <View style={styles.expertAvatarWrap}>
                    {isValidAvatarUrl(item.expertAvatarUrl) ? (
                      <Image source={{ uri: item.expertAvatarUrl! }} style={styles.expertAvatar} />
                    ) : (
                      <View style={styles.expertAvatarPlaceholder}>
                        <Text style={styles.expertAvatarLetter}>
                          {item.expertFullName.trim().charAt(item.expertFullName.trim().length - 1)}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.expertInfo}>
                    <Text style={styles.expertName} numberOfLines={1}>
                      {item.expertFullName}
                    </Text>
                    <Text style={styles.specName} numberOfLines={1}>
                      Chủ đề: {item.specializationName || 'Tư vấn thuế'}
                    </Text>
                  </View>
                </View>

                {/* Topic title */}
                <Text style={styles.topicTitle} numberOfLines={2}>
                  {item.topicTitle}
                </Text>

                {/* Slot schedule row */}
                <View style={styles.scheduleRow}>
                  <View style={styles.scheduleTime}>
                    <Ionicons name="calendar-outline" size={14} color="#666666" />
                    <Text style={styles.scheduleDateText}>
                      {formatVietnameseDate(item.slotDate)}
                    </Text>
                    <Text style={styles.scheduleHoursText}>
                      ({formatTimeRange(item.startTime, item.endTime)})
                    </Text>
                  </View>
                </View>

                {/* Card footer: Fee & action */}
                <View style={styles.cardFooter}>
                  <View style={styles.feeWrap}>
                    <Text style={styles.feeLabel}>Phí tư vấn:</Text>
                    <Text style={styles.feeValue}>{formatVnd(item.fee)}</Text>
                  </View>

                  <View style={styles.arrowWrap}>
                    <Text style={styles.detailLinkText}>Chi tiết</Text>
                    <Ionicons name="chevron-forward" size={14} color={theme.colors.primary} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoading}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Text style={styles.footerLoadingText}>Đang tải thêm...</Text>
              </View>
            ) : null
          }
        />
      )}

      {/* ── MODAL LỌC TRẠNG THÁI ── */}
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
          <View style={styles.dropdownModalCard}>
            <View style={styles.dropdownModalHeader}>
              <Text style={styles.dropdownModalTitle}>Lọc theo trạng thái</Text>
              <TouchableOpacity onPress={() => setStatusModalVisible(false)}>
                <Ionicons name="close" size={20} color="#666666" />
              </TouchableOpacity>
            </View>
            {STATUS_TABS.map((opt) => {
              const selected = activeTabKey === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.dropdownOptionItem, selected && styles.dropdownOptionItemActive]}
                  onPress={() => {
                    setActiveTabKey(opt.key);
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

      {/* ── MODAL LỌC DỊCH VỤ ── */}
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
          <View style={styles.dropdownModalCard}>
            <View style={styles.dropdownModalHeader}>
              <Text style={styles.dropdownModalTitle}>Lọc theo hình thức dịch vụ</Text>
              <TouchableOpacity onPress={() => setSessionModalVisible(false)}>
                <Ionicons name="close" size={20} color="#666666" />
              </TouchableOpacity>
            </View>
            {SESSION_FILTER_OPTIONS.filter(
              (opt) =>
                opt.key === 'ALL' ||
                configuredSessionTypes.includes(opt.key) ||
                bookings.some((b) => b.sessionType === opt.key)
            ).map((opt) => {
              const selected = sessionFilter === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.dropdownOptionItem, selected && styles.dropdownOptionItemActive]}
                  onPress={() => {
                    setSessionFilter(opt.key);
                    setSessionModalVisible(false);
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons
                      name={opt.icon as any}
                      size={16}
                      color={selected ? theme.colors.primary : '#555555'}
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

      {/* ── MODAL LỌC THỜI GIAN ── */}
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
          <View style={styles.dropdownModalCard}>
            <View style={styles.dropdownModalHeader}>
              <Text style={styles.dropdownModalTitle}>Lọc theo thời gian</Text>
              <TouchableOpacity onPress={() => setDateModalVisible(false)}>
                <Ionicons name="close" size={20} color="#666666" />
              </TouchableOpacity>
            </View>
            {DATE_FILTER_OPTIONS.map((opt) => {
              const selected = dateFilter === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.dropdownOptionItem, selected && styles.dropdownOptionItemActive]}
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
  headerTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 18,
    lineHeight: 24,
    color: theme.colors.primaryDark,
  },
  newBookingBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 253, 247, 0.92)',
    borderWidth: 1,
    borderColor: theme.colors.goldLight,
  },

  filterDropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  dropdownFilterBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 253, 247, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#E5DEC9',
    gap: 4,
  },
  dropdownFilterBtnActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  dropdownFilterBtnText: {
    flex: 1,
    fontFamily: fonts.bodySemi,
    fontSize: 11.5,
    color: theme.colors.textPrimary,
  },
  dropdownFilterBtnTextActive: {
    color: '#FFFFFF',
    fontFamily: fonts.bodyBold,
  },
  filterResetIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FECACA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dropdownModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFDF7',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E6D5B8',
    ...theme.shadows.card,
  },
  dropdownModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#EFE8D8',
  },
  dropdownModalTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 15,
    color: theme.colors.primaryDark,
  },
  dropdownOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  dropdownOptionItemActive: {
    backgroundColor: '#FDF8EE',
  },
  dropdownOptionText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  dropdownOptionTextActive: {
    fontFamily: fonts.bodyBold,
    color: theme.colors.primary,
  },

  listContent: {
    padding: 16,
    paddingBottom: 32,
  },

  // Booking Card
  bookingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bookingCodeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: theme.colors.primary,
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
  timerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  timerMetaWarning: {
    fontFamily: fonts.bodyBold,
    fontSize: 11.5,
    color: '#D97706',
  },
  timerMetaInfo: {
    fontFamily: fonts.bodyBold,
    fontSize: 11.5,
    color: '#2563EB',
  },
  timerMetaExpired: {
    fontFamily: fonts.bodyBold,
    fontSize: 11.5,
    color: '#DC2626',
  },

  expertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  expertAvatarWrap: {
    marginRight: 10,
  },
  expertAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  expertAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#8B1E1E1F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  expertAvatarLetter: {
    fontFamily: fonts.serifBold,
    fontSize: 16,
    color: theme.colors.primary,
  },
  expertInfo: {
    flex: 1,
  },
  expertName: {
    fontFamily: fonts.serifBold,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  specName: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },

  topicTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    color: theme.colors.textPrimary,
    lineHeight: 18,
    marginBottom: 10,
  },

  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAF7F0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 10,
  },
  scheduleTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scheduleDateText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: theme.colors.textPrimary,
  },
  scheduleHoursText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#555555',
    fontVariant: ['tabular-nums'],
  },


  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3EFE6',
  },
  feeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  feeLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#777777',
  },
  feeValue: {
    fontFamily: fonts.serifBold,
    fontSize: 13,
    color: theme.colors.primary,
    fontVariant: ['tabular-nums'],
  },
  arrowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  detailLinkText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: theme.colors.primary,
  },

  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 10,
  },
  centerError: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 16,
    color: theme.colors.error,
    marginTop: 8,
  },
  errorMsg: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  retryBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 14,
  },
  retryBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: '#FFFFFF',
  },

  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 50,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 16,
    color: theme.colors.textPrimary,
    marginTop: 12,
  },
  emptySubtitle: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  findExpertBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
    marginTop: 18,
    ...theme.shadows.button,
  },
  findExpertBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: '#FFFFFF',
  },

  footerLoading: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  footerLoadingText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
});
