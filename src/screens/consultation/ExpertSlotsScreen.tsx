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
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { GoldDoubleRule } from '../../components/brand/GoldDoubleRule';
import { Dialog } from '../../components/common/Dialog';
import { RootNavigationProp } from '../../navigation/types';
import { consultationApi } from '../../api/consultationApi';
import { toFriendlyConsultationError } from '../../utils/consultationFriendlyErrors';
import type {
  ExpertSlotDetailResponse,
  SessionType,
  CreateExpertSlotRequest,
  UpdateExpertSlotRequest,
} from '../../types/consultation';
import { formatSessionType } from '../../types/consultation';

const TIME_OPTIONS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00',
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00',
];

type FilterType = 'ALL' | 'AVAILABLE' | 'BOOKED' | 'INACTIVE';

function formatDateVi(dateStr: string) {
  if (!dateStr) return '—';
  try {
    const [y, m, d] = dateStr.split('-');
    const dt = new Date(Number(y), Number(m) - 1, Number(d));
    const dayNames = ['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    const dayName = dayNames[dt.getDay()] || '';
    return `${dayName}, ${d}/${m}/${y}`;
  } catch {
    return dateStr;
  }
}

function formatTime(t: string) {
  if (!t) return '';
  return t.slice(0, 5);
}

export const ExpertSlotsScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();

  const [slots, setSlots] = useState<ExpertSlotDetailResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('ALL');

  // Modal create/edit
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingSlot, setEditingSlot] = useState<ExpertSlotDetailResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  // Form fields
  const [selectedDate, setSelectedDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [sessionType, setSessionType] = useState<SessionType>('ONLINE_MEETING');
  const [isActive, setIsActive] = useState(true);

  // Date selection helper (next 14 days)
  const [availableDates, setAvailableDates] = useState<{ dateStr: string; label: string }[]>([]);

  useEffect(() => {
    const dates: { dateStr: string; label: string }[] = [];
    const today = new Date();
    for (let i = 0; i < 21; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
      const label = i === 0 ? 'Hôm nay' : i === 1 ? 'Ngày mai' : `${dayNames[d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1}`;
      dates.push({ dateStr, label });
    }
    setAvailableDates(dates);
    if (dates.length > 0) {
      setSelectedDate(dates[1].dateStr); // Default to tomorrow
    }
  }, []);

  const fetchSlots = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await consultationApi.getMySlots();
      setSlots(Array.isArray(res) ? res : []);
    } catch (err: any) {
      const friendly = toFriendlyConsultationError(
        err,
        'Lỗi tải lịch',
        'Không thể tải danh sách khung giờ làm việc lúc này.'
      );
      setDialog({
        title: friendly.title,
        message: friendly.message,
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setModalMode('create');
    setEditingSlot(null);
    if (availableDates.length > 1) {
      setSelectedDate(availableDates[1].dateStr);
    }
    setStartTime('09:00');
    setEndTime('10:00');
    setSessionType('ONLINE_MEETING');
    setIsActive(true);
    setModalVisible(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (slot: ExpertSlotDetailResponse) => {
    if (slot.isBooked) {
      setDialog({
        title: 'Khung giờ đã có khách',
        message: 'Khung giờ này đã có khách hàng đặt lịch hẹn. Không thể chỉnh sửa.',
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
      return;
    }
    setModalMode('edit');
    setEditingSlot(slot);
    setSelectedDate(slot.slotDate);
    setStartTime(formatTime(slot.startTime));
    setEndTime(formatTime(slot.endTime));
    setSessionType(slot.sessionType || 'ONLINE_MEETING');
    setIsActive(slot.isActive);
    setModalVisible(true);
  };

  // Submit Slot
  const handleSubmit = async () => {
    if (!selectedDate) {
      setDialog({
        title: 'Thiếu thông tin',
        message: 'Vui lòng chọn ngày làm việc.',
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
      return;
    }

    if (startTime >= endTime) {
      setDialog({
        title: 'Thời gian không hợp lệ',
        message: 'Giờ kết thúc phải diễn ra sau giờ bắt đầu.',
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
      return;
    }

    // Check if slot in past
    const slotStartDateTime = new Date(`${selectedDate}T${startTime}:00`);
    if (slotStartDateTime <= new Date()) {
      setDialog({
        title: 'Thời gian không hợp lệ',
        message: 'Vui lòng chọn khung giờ trong tương lai.',
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
      return;
    }

    setSubmitting(true);
    try {
      if (modalMode === 'create') {
        const req: CreateExpertSlotRequest = {
          slotDate: selectedDate,
          startTime,
          endTime,
          sessionType,
        };
        await consultationApi.createSlot(req);
      } else if (editingSlot) {
        const req: UpdateExpertSlotRequest = {
          slotDate: selectedDate,
          startTime,
          endTime,
          sessionType,
          isActive,
        };
        await consultationApi.updateSlot(editingSlot.id, req);
      }
      setModalVisible(false);
      fetchSlots();
      setDialog({
        title: 'Thành công',
        message:
          modalMode === 'create'
            ? 'Đã mở khung giờ làm việc mới để khách hàng đặt lịch.'
            : 'Đã cập nhật khung giờ làm việc thành công.',
        primaryLabel: 'Đóng',
        onPrimary: () => setDialog(null),
      });
    } catch (err: any) {
      const friendly = toFriendlyConsultationError(
        err,
        'Không thể lưu khung giờ',
        'Hệ thống chưa thể lưu khung giờ làm việc lúc này.'
      );
      setDialog({
        title: friendly.title,
        message: friendly.message,
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle Active
  const handleToggleActive = async (slot: ExpertSlotDetailResponse) => {
    if (slot.isBooked) {
      setDialog({
        title: 'Khung giờ đã có khách',
        message: 'Khung giờ này đã có khách hàng đặt lịch hẹn. Không thể thay đổi trạng thái.',
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
      return;
    }

    try {
      await consultationApi.toggleSlotActive(slot.id);
      fetchSlots();
    } catch (err: any) {
      const friendly = toFriendlyConsultationError(
        err,
        'Không thể đổi trạng thái',
        'Không thể đổi trạng thái khung giờ lúc này.'
      );
      setDialog({
        title: friendly.title,
        message: friendly.message,
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
    }
  };

  // Delete Slot
  const handleDeleteSlot = (slot: ExpertSlotDetailResponse) => {
    if (slot.isBooked) {
      setDialog({
        title: 'Khung giờ đã có khách',
        message: 'Khung giờ này đã có khách hàng đặt lịch hẹn. Không thể xóa.',
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
      return;
    }

    setDialog({
      title: 'Xóa khung giờ làm việc',
      message: `Bạn có chắc muốn xóa khung giờ ${formatTime(slot.startTime)} - ${formatTime(slot.endTime)} ngày ${formatDateVi(slot.slotDate)} khỏi lịch của mình?`,
      primaryLabel: 'Xác nhận xóa',
      secondaryLabel: 'Hủy',
      destructive: true,
      onSecondary: () => setDialog(null),
      onPrimary: async () => {
        setDialog(null);
        try {
          await consultationApi.deleteSlot(slot.id);
          fetchSlots();
          setDialog({
            title: 'Thành công',
            message: 'Đã xóa khung giờ làm việc thành công.',
            primaryLabel: 'Đóng',
            onPrimary: () => setDialog(null),
          });
        } catch (err: any) {
          const friendly = toFriendlyConsultationError(
            err,
            'Không thể xóa khung giờ',
            'Không thể xóa khung giờ làm việc lúc này.'
          );
          setDialog({
            title: friendly.title,
            message: friendly.message,
            primaryLabel: 'Đã hiểu',
            onPrimary: () => setDialog(null),
          });
        }
      },
    });
  };

  // Filtered slots
  const filteredSlots = slots.filter((slot) => {
    if (filter === 'AVAILABLE') return slot.isActive && !slot.isBooked && !slot.isHolding;
    if (filter === 'BOOKED') return slot.isBooked;
    if (filter === 'INACTIVE') return !slot.isActive && !slot.isBooked;
    return true;
  });

  // Counters
  const countAvailable = slots.filter((s) => s.isActive && !s.isBooked && !s.isHolding).length;
  const countBooked = slots.filter((s) => s.isBooked).length;
  const countInactive = slots.filter((s) => !s.isActive && !s.isBooked).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
        >
          <Ionicons name="chevron-back" size={24} color={theme.colors.primary} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Lịch làm việc tư vấn</Text>

        <TouchableOpacity
          style={styles.addBtn}
          onPress={handleOpenCreate}
          accessibilityRole="button"
          accessibilityLabel="Thêm khung giờ mới"
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      <GoldDoubleRule />

      {/* Counters Pill Bar */}
      <View style={styles.countersRow}>
        <View style={styles.counterItem}>
          <Text style={styles.counterNum}>{slots.length}</Text>
          <Text style={styles.counterLabel}>Tổng khung giờ</Text>
        </View>
        <View style={styles.counterDivider} />
        <View style={styles.counterItem}>
          <Text style={[styles.counterNum, { color: '#059669' }]}>{countAvailable}</Text>
          <Text style={styles.counterLabel}>Sẵn sàng</Text>
        </View>
        <View style={styles.counterDivider} />
        <View style={styles.counterItem}>
          <Text style={[styles.counterNum, { color: '#2563EB' }]}>{countBooked}</Text>
          <Text style={styles.counterLabel}>Đã đặt</Text>
        </View>
        <View style={styles.counterDivider} />
        <View style={styles.counterItem}>
          <Text style={[styles.counterNum, { color: '#6B7280' }]}>{countInactive}</Text>
          <Text style={styles.counterLabel}>Tạm tắt</Text>
        </View>
      </View>

      {/* Filters Segment Bar */}
      <View style={styles.filtersBar}>
        <TouchableOpacity
          style={[styles.filterChip, filter === 'ALL' && styles.filterChipActive]}
          onPress={() => setFilter('ALL')}
        >
          <Text style={[styles.filterChipText, filter === 'ALL' && styles.filterChipTextActive]}>
            Tất cả ({slots.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterChip, filter === 'AVAILABLE' && styles.filterChipActive]}
          onPress={() => setFilter('AVAILABLE')}
        >
          <Text style={[styles.filterChipText, filter === 'AVAILABLE' && styles.filterChipTextActive]}>
            Sẵn sàng ({countAvailable})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterChip, filter === 'BOOKED' && styles.filterChipActive]}
          onPress={() => setFilter('BOOKED')}
        >
          <Text style={[styles.filterChipText, filter === 'BOOKED' && styles.filterChipTextActive]}>
            Đã đặt ({countBooked})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterChip, filter === 'INACTIVE' && styles.filterChipActive]}
          onPress={() => setFilter('INACTIVE')}
        >
          <Text style={[styles.filterChipText, filter === 'INACTIVE' && styles.filterChipTextActive]}>
            Tạm tắt ({countInactive})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Slots List */}
      {loading && !refreshing ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Đang tải khung giờ làm việc...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredSlots}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchSlots(true)}
              tintColor={theme.colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="calendar-outline" size={48} color="#CCCCCC" />
              <Text style={styles.emptyTitle}>Chưa có khung giờ làm việc</Text>
              <Text style={styles.emptySubtitle}>
                Hãy mở khung giờ để người nộp thuế có thể đặt lịch hẹn tư vấn với bạn.
              </Text>
              <TouchableOpacity style={styles.emptyAddBtn} onPress={handleOpenCreate}>
                <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
                <Text style={styles.emptyAddBtnText}>Mở khung giờ ngay</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => {
            const sInfo = formatSessionType(item.sessionType);

            return (
              <View style={styles.slotCard}>
                <View style={styles.slotTopRow}>
                  <View style={styles.slotDateRow}>
                    <Ionicons name="calendar" size={15} color={theme.colors.gold} />
                    <Text style={styles.slotDateText}>{formatDateVi(item.slotDate)}</Text>
                  </View>

                  {/* Status Badge */}
                  {item.isBooked ? (
                    <View style={styles.badgeBooked}>
                      <Ionicons name="person" size={11} color="#1E40AF" />
                      <Text style={styles.badgeBookedText}>Đã đặt hẹn</Text>
                    </View>
                  ) : item.isHolding ? (
                    <View style={styles.badgeHolding}>
                      <Ionicons name="lock-closed" size={11} color="#92400E" />
                      <Text style={styles.badgeHoldingText}>Đang tạm giữ</Text>
                    </View>
                  ) : item.isActive ? (
                    <View style={styles.badgeActive}>
                      <Ionicons name="checkmark-circle" size={11} color="#065F46" />
                      <Text style={styles.badgeActiveText}>Sẵn sàng</Text>
                    </View>
                  ) : (
                    <View style={styles.badgeInactive}>
                      <Ionicons name="pause" size={11} color="#4B5563" />
                      <Text style={styles.badgeInactiveText}>Tạm tắt</Text>
                    </View>
                  )}
                </View>

                {/* Time & Session */}
                <View style={styles.slotMidRow}>
                  <View style={styles.slotTimePill}>
                    <Ionicons name="time-outline" size={14} color={theme.colors.primary} />
                    <Text style={styles.slotTimeText}>
                      {formatTime(item.startTime)} - {formatTime(item.endTime)}
                    </Text>
                    <Text style={styles.slotDurationText}>({item.durationMinutes || 60} phút)</Text>
                  </View>

                  <View style={[styles.sessionTypePill, { backgroundColor: `${sInfo.color}14` }]}>
                    <Ionicons name={sInfo.icon as any} size={13} color={sInfo.color} />
                    <Text style={[styles.sessionTypeText, { color: sInfo.color }]}>
                      {sInfo.label}
                    </Text>
                  </View>
                </View>

                {/* Bottom Actions */}
                <View style={styles.slotBottomRow}>
                  {/* Toggle Active Button */}
                  <TouchableOpacity
                    style={[
                      styles.toggleBtn,
                      item.isBooked && styles.btnDisabled,
                      item.isActive ? styles.toggleBtnActive : styles.toggleBtnInactive,
                    ]}
                    disabled={item.isBooked}
                    onPress={() => handleToggleActive(item)}
                  >
                    <Ionicons
                      name={item.isActive ? 'toggle' : 'toggle-outline'}
                      size={15}
                      color={item.isActive ? '#065F46' : '#6B7280'}
                    />
                    <Text
                      style={[
                        styles.toggleBtnText,
                        { color: item.isActive ? '#065F46' : '#6B7280' },
                      ]}
                    >
                      {item.isActive ? 'Đang mở' : 'Đang tắt'}
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.rightActionRow}>
                    <TouchableOpacity
                      style={[styles.cardActionBtn, item.isBooked && styles.btnDisabled]}
                      disabled={item.isBooked}
                      onPress={() => handleOpenEdit(item)}
                    >
                      <Ionicons name="pencil-outline" size={15} color={theme.colors.primary} />
                      <Text style={styles.cardActionBtnText}>Sửa</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.cardDeleteBtn, item.isBooked && styles.btnDisabled]}
                      disabled={item.isBooked}
                      onPress={() => handleDeleteSlot(item)}
                    >
                      <Ionicons name="trash-outline" size={15} color="#DC2626" />
                      <Text style={styles.cardDeleteBtnText}>Xóa</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Modal Thêm / Chỉnh sửa khung giờ */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <Ionicons
                  name={modalMode === 'create' ? 'add-circle' : 'create'}
                  size={20}
                  color={theme.colors.primary}
                />
                <Text style={styles.modalTitle}>
                  {modalMode === 'create' ? 'Mở khung giờ làm việc mới' : 'Chỉnh sửa khung giờ'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={22} color="#666666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Chọn ngày */}
              <Text style={styles.formSectionLabel}>1. Chọn ngày làm việc:</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.datesScroll}
                contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
              >
                {availableDates.map((item) => {
                  const isSelected = selectedDate === item.dateStr;
                  return (
                    <TouchableOpacity
                      key={item.dateStr}
                      style={[styles.dateChip, isSelected && styles.dateChipSelected]}
                      onPress={() => setSelectedDate(item.dateStr)}
                    >
                      <Text style={[styles.dateChipText, isSelected && styles.dateChipTextSelected]}>
                        {item.label}
                      </Text>
                      <Text style={[styles.dateChipSub, isSelected && styles.dateChipSubSelected]}>
                        {item.dateStr.slice(5)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Giờ bắt đầu & Giờ kết thúc */}
              <Text style={[styles.formSectionLabel, { marginTop: 14 }]}>
                2. Chọn khung giờ (Bắt đầu - Kết thúc):
              </Text>
              <View style={styles.timeGridRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.timeLabel}>Bắt đầu:</Text>
                  <ScrollView style={styles.timeSelectBox} nestedScrollEnabled>
                    {TIME_OPTIONS.map((t) => (
                      <TouchableOpacity
                        key={`start-${t}`}
                        style={[styles.timeOption, startTime === t && styles.timeOptionActive]}
                        onPress={() => {
                          setStartTime(t);
                          // Auto suggest endTime after 60m
                          const [h, m] = t.split(':').map(Number);
                          const endCandidate = `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                          if (TIME_OPTIONS.includes(endCandidate)) {
                            setEndTime(endCandidate);
                          }
                        }}
                      >
                        <Text style={[styles.timeOptionText, startTime === t && styles.timeOptionTextActive]}>
                          {t}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <View style={{ width: 16, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="arrow-forward" size={16} color="#999999" />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.timeLabel}>Kết thúc:</Text>
                  <ScrollView style={styles.timeSelectBox} nestedScrollEnabled>
                    {TIME_OPTIONS.filter((t) => t > startTime).map((t) => (
                      <TouchableOpacity
                        key={`end-${t}`}
                        style={[styles.timeOption, endTime === t && styles.timeOptionActive]}
                        onPress={() => setEndTime(t)}
                      >
                        <Text style={[styles.timeOptionText, endTime === t && styles.timeOptionTextActive]}>
                          {t}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>

              {/* Hình thức tư vấn */}
              <Text style={[styles.formSectionLabel, { marginTop: 14 }]}>
                3. Hình thức phiên tư vấn:
              </Text>
              <View style={styles.sessionTypeOptions}>
                {[
                  { key: 'ONLINE_MEETING', label: 'Họp trực tuyến (1-1)', icon: 'videocam' },
                  { key: 'CHAT', label: 'Nhắn tin tư vấn', icon: 'chatbubbles' },
                  { key: 'VOICE_CALL', label: 'Gọi thoại', icon: 'call' },
                ].map((item) => {
                  const isSelected = sessionType === item.key;
                  return (
                    <TouchableOpacity
                      key={item.key}
                      style={[styles.sessionTypeCard, isSelected && styles.sessionTypeCardActive]}
                      onPress={() => setSessionType(item.key as SessionType)}
                    >
                      <Ionicons
                        name={item.icon as any}
                        size={18}
                        color={isSelected ? theme.colors.primary : '#666666'}
                      />
                      <Text
                        style={[
                          styles.sessionTypeCardText,
                          isSelected && styles.sessionTypeCardTextActive,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {modalMode === 'edit' && (
                <TouchableOpacity
                  style={styles.activeCheckRow}
                  onPress={() => setIsActive(!isActive)}
                >
                  <Ionicons
                    name={isActive ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={theme.colors.primary}
                  />
                  <Text style={styles.activeCheckLabel}>Mở nhận lịch hẹn ngay sau khi lưu</Text>
                </TouchableOpacity>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setModalVisible(false)}
                disabled={submitting}
              >
                <Text style={styles.modalCancelBtnText}>Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                    <Text style={styles.modalSubmitBtnText}>
                      {modalMode === 'create' ? 'Tạo khung giờ' : 'Lưu thay đổi'}
                    </Text>
                  </>
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
    backgroundColor: '#F7F5EF',
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
    fontSize: 17,
    color: theme.colors.primary,
    flex: 1,
    textAlign: 'center',
  },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
  },

  // Counters
  countersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ECE6DA',
    ...theme.shadows.card,
  },
  counterItem: {
    alignItems: 'center',
  },
  counterNum: {
    fontFamily: fonts.bodyBold,
    fontSize: 18,
    color: theme.colors.textPrimary,
  },
  counterLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#777777',
    marginTop: 1,
  },
  counterDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#EBE5D8',
  },

  // Filters Bar
  filtersBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#ECE7DB',
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary,
  },
  filterChipText: {
    fontFamily: fonts.bodySemi,
    fontSize: 11.5,
    color: '#666666',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontFamily: fonts.bodyBold,
  },

  // List
  listContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 10,
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    color: '#777777',
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 6,
  },
  emptyTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 16,
    color: theme.colors.textPrimary,
    marginTop: 6,
  },
  emptySubtitle: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#777777',
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    gap: 6,
    marginTop: 10,
  },
  emptyAddBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12.5,
    color: '#FFFFFF',
  },

  // Slot Card
  slotCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ECE6DA',
    ...theme.shadows.card,
  },
  slotTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F1E8',
  },
  slotDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  slotDateText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13.5,
    color: theme.colors.textPrimary,
  },

  // Badges
  badgeBooked: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    gap: 4,
    borderWidth: 0.5,
    borderColor: '#BFDBFE',
  },
  badgeBookedText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10.5,
    color: '#1E40AF',
  },
  badgeHolding: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    gap: 4,
    borderWidth: 0.5,
    borderColor: '#FDE68A',
  },
  badgeHoldingText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10.5,
    color: '#92400E',
  },
  badgeActive: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    gap: 4,
    borderWidth: 0.5,
    borderColor: '#A7F3D0',
  },
  badgeActiveText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10.5,
    color: '#065F46',
  },
  badgeInactive: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    gap: 4,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
  },
  badgeInactiveText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10.5,
    color: '#4B5563',
  },

  // Slot Mid
  slotMidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  slotTimePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF7F0',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 5,
  },
  slotTimeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12.5,
    color: theme.colors.textPrimary,
  },
  slotDurationText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#777777',
  },
  sessionTypePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  sessionTypeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
  },

  // Slot Bottom Actions
  slotBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F5F1E8',
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  toggleBtnActive: {
    backgroundColor: '#ECFDF5',
  },
  toggleBtnInactive: {
    backgroundColor: '#F3F4F6',
  },
  toggleBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
  },
  rightActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 3,
  },
  cardActionBtnText: {
    fontFamily: fonts.bodySemi,
    fontSize: 11.5,
    color: theme.colors.primary,
  },
  cardDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 3,
  },
  cardDeleteBtnText: {
    fontFamily: fonts.bodySemi,
    fontSize: 11.5,
    color: '#DC2626',
  },
  btnDisabled: {
    opacity: 0.35,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 18,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0ECE4',
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modalTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 16,
    color: theme.colors.primary,
  },
  modalBody: {
    maxHeight: 460,
    paddingVertical: 10,
  },
  formSectionLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 12.5,
    color: theme.colors.textPrimary,
    marginBottom: 6,
  },
  datesScroll: {
    marginBottom: 4,
  },
  dateChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F4EFE6',
    alignItems: 'center',
    minWidth: 70,
  },
  dateChipSelected: {
    backgroundColor: theme.colors.primary,
  },
  dateChipText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11.5,
    color: '#444444',
  },
  dateChipTextSelected: {
    color: '#FFFFFF',
  },
  dateChipSub: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: '#777777',
    marginTop: 2,
  },
  dateChipSubSelected: {
    color: '#FDE68A',
  },

  timeGridRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 11,
    color: '#666666',
    marginBottom: 4,
  },
  timeSelectBox: {
    height: 120,
    borderWidth: 1,
    borderColor: '#E6DECF',
    borderRadius: 8,
    backgroundColor: '#FAF7F0',
  },
  timeOption: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#EBE5D8',
  },
  timeOptionActive: {
    backgroundColor: theme.colors.primary,
  },
  timeOptionText: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: '#333333',
    textAlign: 'center',
  },
  timeOptionTextActive: {
    color: '#FFFFFF',
    fontFamily: fonts.bodyBold,
  },

  sessionTypeOptions: {
    gap: 6,
  },
  sessionTypeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#FAF8F3',
    borderWidth: 1,
    borderColor: '#ECE5D6',
    gap: 8,
  },
  sessionTypeCardActive: {
    backgroundColor: '#8B1E1E10',
    borderColor: theme.colors.primary,
  },
  sessionTypeCardText: {
    fontFamily: fonts.bodySemi,
    fontSize: 12.5,
    color: '#555555',
  },
  sessionTypeCardTextActive: {
    fontFamily: fonts.bodyBold,
    color: theme.colors.primary,
  },

  activeCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F5F1E8',
  },
  activeCheckLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#444444',
  },

  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0ECE4',
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#F3EFE6',
  },
  modalCancelBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12.5,
    color: '#555555',
  },
  modalSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: theme.colors.primary,
    gap: 5,
  },
  modalSubmitBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12.5,
    color: '#FFFFFF',
  },
});
