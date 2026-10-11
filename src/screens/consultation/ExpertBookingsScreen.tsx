import React, { useState, useEffect, useCallback } from 'react';
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
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { GoldDoubleRule } from '../../components/brand/GoldDoubleRule';
import { RootNavigationProp, RootStackParamList } from '../../navigation/types';
import { consultationApi } from '../../api/consultationApi';
import type { BookingListItemResponse } from '../../types/consultation';
import {
  formatVnd,
  formatBookingStatus,
  formatSessionType,
  formatVietnameseDate,
  formatTimeRange,
} from '../../types/consultation';

type TabKey = 'PENDING' | 'ALL';

export const ExpertBookingsScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'ExpertBookings'>>();
  const initialTab = route.params?.initialTab === 'pending' ? 'PENDING' : 'ALL';

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [pendingBookings, setPendingBookings] = useState<BookingListItemResponse[]>([]);
  const [allBookings, setAllBookings] = useState<BookingListItemResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filter for ALL tab
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Reject modal state
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectingBooking, setRejectingBooking] = useState<BookingListItemResponse | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Live timer for SLA 2h
  const [currentTimeMs, setCurrentTimeMs] = useState(Date.now());

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
      if (activeTab === 'PENDING') {
        const res = await consultationApi.getExpertPendingBookings({ page: 1, size: 20 });
        setPendingBookings(res.items || []);
      } else {
        const filterParam = statusFilter === 'ALL' ? undefined : statusFilter;
        const res = await consultationApi.getExpertBookings({
          status: filterParam,
          page: 1,
          size: 30,
        });
        setAllBookings(res.items || []);
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

  // Handle Accept
  const handleAccept = (booking: BookingListItemResponse) => {
    Alert.alert(
      'Tiếp nhận ca tư vấn',
      `Bạn đồng ý tiếp nhận ca tư vấn ${booking.bookingCode} của ${booking.userFullName}?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Tiếp nhận',
          onPress: async () => {
            setActionLoading(true);
            try {
              await consultationApi.acceptBooking(booking.id);
              Alert.alert('Thành công', 'Lịch hẹn chính thức được xác nhận.');
              fetchData(true);
            } catch (err: any) {
              Alert.alert('Lỗi', err?.message || 'Không thể tiếp nhận ca tư vấn.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  // Handle Reject Submit
  const handleConfirmReject = async () => {
    if (!rejectingBooking || rejectReason.trim().length < 5) {
      Alert.alert('Lưu ý', 'Vui lòng nhập lý do từ chối tối thiểu 5 ký tự.');
      return;
    }
    setActionLoading(true);
    try {
      await consultationApi.rejectBooking(rejectingBooking.id, rejectReason.trim());
      setRejectModalVisible(false);
      setRejectingBooking(null);
      setRejectReason('');
      Alert.alert('Đã từ chối', 'Ca tư vấn đã được từ chối. Hệ thống hoàn trả 100% chi phí cho khách.');
      fetchData(true);
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Không thể từ chối ca tư vấn.');
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
        {/* Header row: Code, SLA tag, Fee */}
        <View style={styles.cardHeader}>
          <View style={styles.codeWrap}>
            <Text style={styles.bookingCode}>#{item.bookingCode}</Text>
            <View style={[styles.slaBadge, isUrgent && styles.slaBadgeUrgent]}>
              <Ionicons
                name={isUrgent ? 'alarm' : 'hourglass-outline'}
                size={12}
                color={isUrgent ? '#B91C1C' : '#92400E'}
              />
              <Text style={[styles.slaText, isUrgent && styles.slaTextUrgent]}>
                {secondsLeft > 0
                  ? `${hours > 0 ? `${hours}h ` : ''}${mins}m ${secs < 10 ? '0' : ''}${secs}s`
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
          <View style={[styles.pill, { backgroundColor: `${session.color}15` }]}>
            <Ionicons name={session.icon as any} size={13} color={session.color} />
            <Text style={[styles.pillText, { color: session.color }]}>{session.label}</Text>
          </View>
          {item.attachmentCount > 0 && (
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
            onPress={() => navigation.navigate('BookingDetail', { bookingId: item.id })}
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
    const status = formatBookingStatus(item.status);
    const session = formatSessionType(item.sessionType);

    return (
      <TouchableOpacity
        style={styles.bookingCard}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('BookingDetail', { bookingId: item.id })}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.bookingCode}>#{item.bookingCode}</Text>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusBadgeText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>

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

  const currentList = activeTab === 'PENDING' ? pendingBookings : allBookings;

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

      {/* ── TAB SELECTOR ── */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'PENDING' && styles.tabBtnActive]}
          onPress={() => setActiveTab('PENDING')}
        >
          <Text style={[styles.tabBtnText, activeTab === 'PENDING' && styles.tabBtnTextActive]}>
            Chờ duyệt (SLA 2h)
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

      {/* ── STATUS FILTER (Only for ALL tab) ── */}
      {activeTab === 'ALL' && (
        <View style={styles.filterChipScroll}>
          {[
            { key: 'ALL', label: 'Tất cả' },
            { key: 'CONFIRMED', label: 'Đã xác nhận' },
            { key: 'COMPLETED', label: 'Hoàn thành' },
            { key: 'REJECTED_BY_EXPERT', label: 'Từ chối' },
            { key: 'CANCELLED_BY_USER', label: 'Khách hủy' },
          ].map((chip) => (
            <TouchableOpacity
              key={chip.key}
              style={[
                styles.filterChip,
                statusFilter === chip.key && styles.filterChipActive,
              ]}
              onPress={() => setStatusFilter(chip.key)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  statusFilter === chip.key && styles.filterChipTextActive,
                ]}
              >
                {chip.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

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
              Hệ thống sẽ hoàn trả 100% chi phí cho khách hàng và mở lại slot thời gian. Vui lòng nêu rõ lý do:
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
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 17,
    color: theme.colors.textPrimary,
  },

  // Tabs
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
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

  // Filter Chips
  filterChipScroll: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: '#FFFFFF',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3EFE6',
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary,
  },
  filterChipText: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: '#666666',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
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
  bookingCode: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: theme.colors.primary,
  },
  slaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  slaBadgeUrgent: {
    backgroundColor: '#FEE2E2',
  },
  slaText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: '#92400E',
  },
  slaTextUrgent: {
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
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
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
});
