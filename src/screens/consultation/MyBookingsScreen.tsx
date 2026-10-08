import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
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
} from '../../types/consultation';

const STATUS_TABS: { key: string; label: string; status?: BookingStatus }[] = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'PENDING_PAYMENT', label: 'Chờ thanh toán', status: 'PENDING_PAYMENT' },
  { key: 'AWAITING_EXPERT_APPROVAL', label: 'Chờ duyệt', status: 'AWAITING_EXPERT_APPROVAL' },
  { key: 'CONFIRMED', label: 'Đã xác nhận', status: 'CONFIRMED' },
  { key: 'COMPLETED', label: 'Hoàn thành', status: 'COMPLETED' },
  { key: 'CANCELLED_BY_USER', label: 'Đã hủy', status: 'CANCELLED_BY_USER' },
];

export const MyBookingsScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'MyBookings'>>();

  const [activeTabKey, setActiveTabKey] = useState<string>(route.params?.initialStatus || 'ALL');
  const [bookings, setBookings] = useState<BookingListItemResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Countdown tick state
  const [currentTimeMs, setCurrentTimeMs] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimeMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
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

  useEffect(() => {
    fetchBookings(false, 1);
  }, [fetchBookings]);

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
          <View style={styles.expiredBadge}>
            <Ionicons name="time-outline" size={12} color="#DC2626" />
            <Text style={styles.expiredBadgeText}>Đã hết hạn giữ chỗ</Text>
          </View>
        );
      }

      return (
        <View style={styles.countdownBadge}>
          <Ionicons name="stopwatch-outline" size={12} color="#D97706" />
          <Text style={styles.countdownBadgeText}>
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
          <View style={styles.expiredBadge}>
            <Text style={styles.expiredBadgeText}>Hết hạn 2 giờ duyệt</Text>
          </View>
        );
      }

      return (
        <View style={styles.approvalCountdownBadge}>
          <Ionicons name="hourglass-outline" size={12} color="#2563EB" />
          <Text style={styles.approvalCountdownText}>
            Hạn duyệt: {hours}h {mins}p
          </Text>
        </View>
      );
    }

    return null;
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* ── HEADER ── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
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

      {/* ── STATUS FILTER TABS ── */}
      <View style={styles.tabsWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsScrollContent}
        >
          {STATUS_TABS.map((tab) => {
            const active = activeTabKey === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabChip, active && styles.tabChipActive]}
                onPress={() => setActiveTabKey(tab.key)}
              >
                <Text style={[styles.tabChipText, active && styles.tabChipTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
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
          data={bookings}
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
                {activeTabKey === 'ALL'
                  ? 'Bạn chưa đặt lịch hẹn tư vấn nào. Hãy tìm chuyên gia để được giải đáp thắc mắc về thuế.'
                  : 'Không có lịch hẹn nào ở trạng thái này.'}
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
            const statusInfo = formatBookingStatus(item.status);
            const sessionInfo = formatSessionType(item.sessionType);

            return (
              <TouchableOpacity
                style={styles.bookingCard}
                activeOpacity={0.88}
                onPress={() => navigation.navigate('BookingDetail', { bookingId: item.id })}
              >
                {/* Header: Code & Status */}
                <View style={styles.cardHeader}>
                  <View style={styles.codeRow}>
                    <Ionicons name="pricetag-outline" size={13} color={theme.colors.primary} />
                    <Text style={styles.bookingCodeText}>{item.bookingCode}</Text>
                  </View>

                  <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: statusInfo.color }]}>
                      {statusInfo.label}
                    </Text>
                  </View>
                </View>

                {/* Countdown banner if applicable */}
                {renderHoldTimer(item)}

                {/* Expert info row */}
                <View style={styles.expertRow}>
                  <View style={styles.expertAvatarWrap}>
                    {item.expertAvatarUrl ? (
                      <Image source={{ uri: item.expertAvatarUrl }} style={styles.expertAvatar} />
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

                  <View style={[styles.sessionBadge, { backgroundColor: `${sessionInfo.color}18` }]}>
                    <Ionicons name={sessionInfo.icon as any} size={11} color={sessionInfo.color} />
                    <Text style={[styles.sessionBadgeText, { color: sessionInfo.color }]}>
                      {sessionInfo.label}
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
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3EFE6',
  },
  headerTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 16,
    color: theme.colors.primary,
  },
  newBookingBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAF5EE',
    borderWidth: 1,
    borderColor: theme.colors.goldLight,
  },

  tabsWrap: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tabsScrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  tabChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: '#F5EFE4',
    borderWidth: 1,
    borderColor: '#E6DDD0',
  },
  tabChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  tabChipText: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: '#666666',
  },
  tabChipTextActive: {
    color: '#FFFFFF',
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
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
  },

  countdownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    gap: 4,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  countdownBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: '#B45309',
  },
  approvalCountdownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    gap: 4,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  approvalCountdownText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: '#1E40AF',
  },
  expiredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    gap: 4,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  expiredBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
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
  sessionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 3,
  },
  sessionBadgeText: {
    fontFamily: fonts.bodySemi,
    fontSize: 10,
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
