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

type FilterType = 'ALL' | 'AVAILABLE' | 'BOOKED' | 'INACTIVE' | 'EXPIRED';
type ServiceFilterType = 'ALL' | SessionType;

function isSlotExpired(slotDate: string, endTime: string): boolean {
  if (!slotDate) return false;
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  if (slotDate < todayStr) return true;
  if (slotDate === todayStr) {
    const nowTimeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const cleanEndTime = endTime ? endTime.slice(0, 5) : '23:59';
    return cleanEndTime <= nowTimeStr;
  }
  return false;
}

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const firstDayOfWeek = (firstDay.getDay() + 6) % 7; // Monday = 0, Sunday = 6
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];
  const pad = (n: number) => String(n).padStart(2, '0');

  // Trailing days from previous month
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const prevDate = new Date(year, month - 1, d);
    const dateStr = `${prevDate.getFullYear()}-${pad(prevDate.getMonth() + 1)}-${pad(d)}`;
    days.push({ dateStr, dayNum: d, isCurrentMonth: false });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${pad(month + 1)}-${pad(d)}`;
    days.push({ dateStr, dayNum: d, isCurrentMonth: true });
  }

  // Next month leading days to complete full 35 or 42 grid
  const totalCells = days.length <= 35 ? 35 : 42;
  const nextNeeded = totalCells - days.length;
  for (let d = 1; d <= nextNeeded; d++) {
    const nextDate = new Date(year, month + 1, d);
    const dateStr = `${nextDate.getFullYear()}-${pad(nextDate.getMonth() + 1)}-${pad(d)}`;
    days.push({ dateStr, dayNum: d, isCurrentMonth: false });
  }

  return days;
}

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

function toIsoTime(timeStr: string): string {
  if (!timeStr) return '';
  const [h, m, s] = timeStr.split(':');
  const d = new Date();
  d.setHours(Number(h) || 0, Number(m) || 0, Number(s) || 0, 0);
  return d.toTimeString().slice(0, 8);
}

export const ExpertSlotsScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();

  const [slots, setSlots] = useState<ExpertSlotDetailResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Calendar View State
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [calendarExpanded, setCalendarExpanded] = useState(true);

  // Filters
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [serviceFilter, setServiceFilter] = useState<ServiceFilterType>('ALL');

  // Dropdown Picker Modals
  const [servicePickerVisible, setServicePickerVisible] = useState(false);
  const [statusPickerVisible, setStatusPickerVisible] = useState(false);

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
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${day}`;
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
  const handleOpenCreate = (prefillDate?: string) => {
    setModalMode('create');
    setEditingSlot(null);
    if (prefillDate) {
      setSelectedDate(prefillDate);
    } else if (selectedCalendarDate) {
      setSelectedDate(selectedCalendarDate);
    } else if (availableDates.length > 1) {
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
    if (isSlotExpired(slot.slotDate, slot.endTime)) {
      setDialog({
        title: 'Khung giờ đã hết hạn',
        message: 'Khung giờ này đã quá thời gian so với hiện tại. Không thể chỉnh sửa.',
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
          startTime: toIsoTime(startTime),
          endTime: toIsoTime(endTime),
          sessionType,
        };
        await consultationApi.createSlot(req);
      } else if (editingSlot) {
        const req: UpdateExpertSlotRequest = {
          slotDate: selectedDate,
          startTime: toIsoTime(startTime),
          endTime: toIsoTime(endTime),
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

    if (isSlotExpired(slot.slotDate, slot.endTime)) {
      setDialog({
        title: 'Khung giờ đã hết hạn',
        message: 'Khung giờ này đã quá thời gian so với hiện tại. Hệ thống đã tự động khóa ca này.',
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

  // Calendar month days
  const monthDays = useMemo(() => getMonthDays(calYear, calMonth), [calYear, calMonth]);

  // Slots aggregated by date for calendar dots & counts
  const slotsByDate = useMemo(() => {
    const map = new Map<string, { total: number; available: number; booked: number; expired: number }>();
    slots.forEach((s) => {
      const entry = map.get(s.slotDate) || { total: 0, available: 0, booked: 0, expired: 0 };
      entry.total += 1;
      const expired = isSlotExpired(s.slotDate, s.endTime);
      if (s.isBooked) {
        entry.booked += 1;
      } else if (expired) {
        entry.expired += 1;
      } else if (s.isActive && !s.isHolding) {
        entry.available += 1;
      }
      map.set(s.slotDate, entry);
    });
    return map;
  }, [slots]);

  // Month navigation helpers
  const handlePrevMonth = () => {
    if (calMonth === 0) {
      setCalYear((y) => y - 1);
      setCalMonth(11);
    } else {
      setCalMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (calMonth === 11) {
      setCalYear((y) => y + 1);
      setCalMonth(0);
    } else {
      setCalMonth((m) => m + 1);
    }
  };

  const handleToday = () => {
    const d = new Date();
    setCalYear(d.getFullYear());
    setCalMonth(d.getMonth());
    setSelectedCalendarDate(todayStr);
  };

  // Counters strictly separating active future slots vs expired past slots
  const countAvailable = useMemo(
    () => slots.filter((s) => !isSlotExpired(s.slotDate, s.endTime) && s.isActive && !s.isBooked && !s.isHolding).length,
    [slots]
  );
  const countBooked = useMemo(
    () => slots.filter((s) => s.isBooked).length,
    [slots]
  );
  const countExpired = useMemo(
    () => slots.filter((s) => isSlotExpired(s.slotDate, s.endTime) && !s.isBooked).length,
    [slots]
  );
  const countInactive = useMemo(
    () => slots.filter((s) => !s.isActive && !s.isBooked && !isSlotExpired(s.slotDate, s.endTime)).length,
    [slots]
  );

  // Filter state check
  const isFiltered = filter !== 'ALL' || selectedCalendarDate !== null || serviceFilter !== 'ALL';

  const handleResetFilters = () => {
    setFilter('ALL');
    setSelectedCalendarDate(null);
    setServiceFilter('ALL');
  };

  // Filtered slots
  const filteredSlots = useMemo(() => {
    return slots.filter((slot) => {
      const expired = isSlotExpired(slot.slotDate, slot.endTime);

      // 1. Status filter
      if (filter === 'AVAILABLE') {
        if (expired || !slot.isActive || slot.isBooked || slot.isHolding) return false;
      } else if (filter === 'BOOKED') {
        if (!slot.isBooked) return false;
      } else if (filter === 'INACTIVE') {
        if (slot.isActive || slot.isBooked || expired) return false;
      } else if (filter === 'EXPIRED') {
        if (!expired || slot.isBooked) return false;
      }

      // 2. Service filter
      if (serviceFilter !== 'ALL' && slot.sessionType !== serviceFilter) return false;

      // 3. Calendar Date filter
      if (selectedCalendarDate !== null && slot.slotDate !== selectedCalendarDate) {
        return false;
      }

      return true;
    });
  }, [slots, filter, serviceFilter, selectedCalendarDate]);

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
          onPress={() => handleOpenCreate()}
          accessibilityRole="button"
          accessibilityLabel="Thêm khung giờ mới"
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      <GoldDoubleRule />

      {/* Counters Pill Bar */}
      <View style={styles.countersRow}>
        <TouchableOpacity
          style={styles.counterItem}
          onPress={() => setFilter('ALL')}
          activeOpacity={0.7}
        >
          <Text style={styles.counterNum}>{slots.length}</Text>
          <Text style={styles.counterLabel}>Tổng khung giờ</Text>
        </TouchableOpacity>
        <View style={styles.counterDivider} />
        <TouchableOpacity
          style={styles.counterItem}
          onPress={() => setFilter('AVAILABLE')}
          activeOpacity={0.7}
        >
          <Text style={[styles.counterNum, { color: '#059669' }]}>{countAvailable}</Text>
          <Text style={styles.counterLabel}>Sẵn sàng</Text>
        </TouchableOpacity>
        <View style={styles.counterDivider} />
        <TouchableOpacity
          style={styles.counterItem}
          onPress={() => setFilter('BOOKED')}
          activeOpacity={0.7}
        >
          <Text style={[styles.counterNum, { color: '#2563EB' }]}>{countBooked}</Text>
          <Text style={styles.counterLabel}>Đã đặt</Text>
        </TouchableOpacity>
        <View style={styles.counterDivider} />
        <TouchableOpacity
          style={styles.counterItem}
          onPress={() => setFilter('EXPIRED')}
          activeOpacity={0.7}
        >
          <Text style={[styles.counterNum, { color: '#D97706' }]}>{countExpired}</Text>
          <Text style={styles.counterLabel}>Đã hết hạn</Text>
        </TouchableOpacity>
      </View>

      {/* Component Bảng lịch ngày tháng năm */}
      <View style={styles.calendarCard}>
        {/* Calendar Card Header */}
        <View style={styles.calHeaderRow}>
          <View style={styles.calMonthNav}>
            <TouchableOpacity
              style={styles.calNavArrow}
              onPress={handlePrevMonth}
              accessibilityRole="button"
              accessibilityLabel="Tháng trước"
            >
              <Ionicons name="chevron-back" size={14} color={theme.colors.primary} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setCalendarExpanded(!calendarExpanded)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Đổi trạng thái lịch"
            >
              <Text style={styles.calMonthTitle}>
                Tháng {calMonth + 1}/{calYear}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.calNavArrow}
              onPress={handleNextMonth}
              accessibilityRole="button"
              accessibilityLabel="Tháng sau"
            >
              <Ionicons name="chevron-forward" size={14} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.calHeaderActions}>
            <TouchableOpacity
              style={styles.calTodayBtn}
              onPress={handleToday}
              accessibilityRole="button"
              accessibilityLabel="Về hôm nay"
            >
              <Ionicons name="today-outline" size={12} color={theme.colors.primary} />
              <Text style={styles.calTodayBtnText}>Hôm nay</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.calToggleBtn,
                !calendarExpanded && styles.calToggleBtnHighlight,
              ]}
              onPress={() => setCalendarExpanded(!calendarExpanded)}
              accessibilityRole="button"
              accessibilityLabel={calendarExpanded ? 'Thu gọn lịch' : 'Mở lịch'}
            >
              <Ionicons
                name={calendarExpanded ? 'chevron-up' : 'calendar'}
                size={12}
                color={!calendarExpanded ? '#FFFFFF' : theme.colors.primary}
              />
              <Text
                style={[
                  styles.calToggleBtnText,
                  !calendarExpanded && styles.calToggleBtnTextHighlight,
                ]}
              >
                {calendarExpanded ? 'Thu gọn' : 'Mở lịch'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {calendarExpanded && (
          <View style={styles.calBody}>
            {/* Weekday Row */}
            <View style={styles.weekDaysRow}>
              {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((w, idx) => (
                <View key={w} style={styles.weekDayCol}>
                  <Text
                    style={[
                      styles.weekDayText,
                      idx >= 5 && styles.weekDayWeekendText,
                    ]}
                  >
                    {w}
                  </Text>
                </View>
              ))}
            </View>

            {/* Grid of days */}
            <View style={styles.daysGrid}>
              {monthDays.map((d, index) => {
                const isToday = d.dateStr === todayStr;
                const isSelected = d.dateStr === selectedCalendarDate;
                const stats = slotsByDate.get(d.dateStr);

                return (
                  <TouchableOpacity
                    key={`${d.dateStr}-${index}`}
                    style={[
                      styles.dayCell,
                      isSelected && styles.dayCellSelected,
                      isToday && !isSelected && styles.dayCellToday,
                    ]}
                    onPress={() => {
                      if (selectedCalendarDate === d.dateStr) {
                        setSelectedCalendarDate(null);
                      } else {
                        setSelectedCalendarDate(d.dateStr);
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.dayNumText,
                        !d.isCurrentMonth && styles.dayNumOtherMonth,
                        isToday && styles.dayNumTodayText,
                        isSelected && styles.dayNumSelectedText,
                      ]}
                    >
                      {d.dayNum}
                    </Text>

                    {/* Indicator dots for slots */}
                    <View style={styles.dayDotsRow}>
                      {stats && stats.available > 0 && (
                        <View style={[styles.dayDot, { backgroundColor: '#059669' }]} />
                      )}
                      {stats && stats.booked > 0 && (
                        <View style={[styles.dayDot, { backgroundColor: '#2563EB' }]} />
                      )}
                      {stats && stats.expired > 0 && stats.available === 0 && (
                        <View style={[styles.dayDot, { backgroundColor: '#9CA3AF' }]} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Legend bar */}
            <View style={styles.calLegendRow}>
              <View style={styles.calLegendItem}>
                <View style={[styles.calLegendDot, { backgroundColor: '#059669' }]} />
                <Text style={styles.calLegendText}>Sẵn sàng</Text>
              </View>
              <View style={styles.calLegendItem}>
                <View style={[styles.calLegendDot, { backgroundColor: '#2563EB' }]} />
                <Text style={styles.calLegendText}>Đã đặt</Text>
              </View>
              <View style={styles.calLegendItem}>
                <View style={[styles.calLegendDot, { backgroundColor: '#9CA3AF' }]} />
                <Text style={styles.calLegendText}>Hết hạn</Text>
              </View>
            </View>
          </View>
        )}

        {/* Selected Date Filter Banner */}
        {selectedCalendarDate && (
          <View style={styles.selectedDateBanner}>
            <View style={styles.selectedDateInfo}>
              <Ionicons name="calendar" size={15} color={theme.colors.primary} />
              <Text style={styles.selectedDateText}>
                {formatDateVi(selectedCalendarDate)} ({filteredSlots.length} ca)
              </Text>
            </View>
            <View style={styles.selectedDateActions}>
              <TouchableOpacity
                style={styles.addSlotForDateBtn}
                onPress={() => handleOpenCreate(selectedCalendarDate)}
              >
                <Ionicons name="add" size={14} color="#FFFFFF" />
                <Text style={styles.addSlotForDateText}>Mở ca</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.clearDateFilterBtn}
                onPress={() => setSelectedCalendarDate(null)}
              >
                <Ionicons name="close" size={16} color="#666666" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Thanh bộ lọc dạng Dropdown */}
      <View style={styles.dropdownFiltersContainer}>
        {/* Dropdown Dịch Vụ */}
        <TouchableOpacity
          style={[
            styles.dropdownBtn,
            serviceFilter !== 'ALL' && styles.dropdownBtnActive,
          ]}
          onPress={() => setServicePickerVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Lọc dịch vụ"
        >
          <Ionicons
            name={
              serviceFilter === 'ONLINE_MEETING'
                ? 'videocam'
                : serviceFilter === 'CHAT'
                ? 'chatbubbles'
                : serviceFilter === 'VOICE_CALL'
                ? 'call'
                : 'layers-outline'
            }
            size={14}
            color={serviceFilter !== 'ALL' ? theme.colors.primary : '#555555'}
          />
          <Text
            style={[
              styles.dropdownBtnText,
              serviceFilter !== 'ALL' && styles.dropdownBtnTextActive,
            ]}
            numberOfLines={1}
          >
            {serviceFilter === 'ONLINE_MEETING'
              ? 'Họp trực tuyến'
              : serviceFilter === 'CHAT'
              ? 'Nhắn tin'
              : serviceFilter === 'VOICE_CALL'
              ? 'Gọi thoại'
              : 'Tất cả dịch vụ'}
          </Text>
          <Ionicons
            name="chevron-down"
            size={14}
            color={serviceFilter !== 'ALL' ? theme.colors.primary : '#777777'}
          />
        </TouchableOpacity>

        {/* Dropdown Trạng Thái */}
        <TouchableOpacity
          style={[
            styles.dropdownBtn,
            filter !== 'ALL' && styles.dropdownBtnActive,
          ]}
          onPress={() => setStatusPickerVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Lọc trạng thái"
        >
          <Ionicons
            name="funnel-outline"
            size={14}
            color={filter !== 'ALL' ? theme.colors.primary : '#555555'}
          />
          <Text
            style={[
              styles.dropdownBtnText,
              filter !== 'ALL' && styles.dropdownBtnTextActive,
            ]}
            numberOfLines={1}
          >
            {filter === 'AVAILABLE'
              ? `Sẵn sàng (${countAvailable})`
              : filter === 'BOOKED'
              ? `Đã đặt (${countBooked})`
              : filter === 'EXPIRED'
              ? `Hết hạn (${countExpired})`
              : filter === 'INACTIVE'
              ? `Tạm tắt (${countInactive})`
              : `Tất cả (${slots.length})`}
          </Text>
          <Ionicons
            name="chevron-down"
            size={14}
            color={filter !== 'ALL' ? theme.colors.primary : '#777777'}
          />
        </TouchableOpacity>

        {/* Reset Filter Button */}
        {isFiltered && (
          <TouchableOpacity
            style={styles.dropdownResetBtn}
            onPress={handleResetFilters}
            accessibilityRole="button"
            accessibilityLabel="Đặt lại bộ lọc"
          >
            <Ionicons name="refresh" size={14} color="#DC2626" />
          </TouchableOpacity>
        )}
      </View>

      {/* Active Filter Notification */}
      {isFiltered && (
        <View style={styles.activeFilterNotice}>
          <Text style={styles.activeFilterNoticeText}>
            Hiển thị {filteredSlots.length} / {slots.length} khung giờ phù hợp
          </Text>
          <TouchableOpacity onPress={handleResetFilters}>
            <Text style={styles.clearFilterLink}>Bỏ lọc</Text>
          </TouchableOpacity>
        </View>
      )}

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
              <Ionicons
                name={isFiltered ? 'search-outline' : 'calendar-outline'}
                size={44}
                color="#CCCCCC"
              />
              <Text style={styles.emptyTitle}>
                {isFiltered ? 'Không có khung giờ phù hợp' : 'Chưa có khung giờ làm việc'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {isFiltered
                  ? 'Không tìm thấy khung giờ nào theo tiêu chí ngày hẹn hoặc dịch vụ đã chọn.'
                  : 'Hãy mở khung giờ để người nộp thuế có thể đặt lịch hẹn tư vấn với bạn.'}
              </Text>
              {isFiltered ? (
                <TouchableOpacity style={styles.emptyAddBtn} onPress={handleResetFilters}>
                  <Ionicons name="refresh-outline" size={17} color="#FFFFFF" />
                  <Text style={styles.emptyAddBtnText}>Đặt lại bộ lọc</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.emptyAddBtn} onPress={() => handleOpenCreate()}>
                  <Ionicons name="add-circle-outline" size={17} color="#FFFFFF" />
                  <Text style={styles.emptyAddBtnText}>Mở khung giờ ngay</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          renderItem={({ item }) => {
            const sInfo = formatSessionType(item.sessionType);
            const expired = isSlotExpired(item.slotDate, item.endTime);

            return (
              <View style={[styles.slotCard, expired && !item.isBooked && styles.slotCardExpired]}>
                <View style={styles.slotTopRow}>
                  <View style={styles.slotDateRow}>
                    <Ionicons
                      name="calendar"
                      size={15}
                      color={expired && !item.isBooked ? '#9CA3AF' : theme.colors.gold}
                    />
                    <Text
                      style={[
                        styles.slotDateText,
                        expired && !item.isBooked && styles.slotDateTextExpired,
                      ]}
                    >
                      {formatDateVi(item.slotDate)}
                    </Text>
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
                  ) : expired ? (
                    <View style={styles.badgeExpired}>
                      <Ionicons name="time" size={11} color="#475569" />
                      <Text style={styles.badgeExpiredText}>Đã hết hạn</Text>
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
                  <View
                    style={[
                      styles.slotTimePill,
                      expired && !item.isBooked && styles.slotTimePillExpired,
                    ]}
                  >
                    <Ionicons
                      name="time-outline"
                      size={14}
                      color={expired && !item.isBooked ? '#64748B' : theme.colors.primary}
                    />
                    <Text
                      style={[
                        styles.slotTimeText,
                        expired && !item.isBooked && styles.slotTimeTextExpired,
                      ]}
                    >
                      {formatTime(item.startTime)} - {formatTime(item.endTime)}
                    </Text>
                    <Text style={styles.slotDurationText}>({item.durationMinutes || 60} phút)</Text>
                  </View>

                  <View
                    style={[
                      styles.sessionTypePill,
                      { backgroundColor: expired && !item.isBooked ? '#F1F5F9' : `${sInfo.color}14` },
                    ]}
                  >
                    <Ionicons
                      name={sInfo.icon as any}
                      size={13}
                      color={expired && !item.isBooked ? '#64748B' : sInfo.color}
                    />
                    <Text
                      style={[
                        styles.sessionTypeText,
                        { color: expired && !item.isBooked ? '#64748B' : sInfo.color },
                      ]}
                    >
                      {sInfo.label}
                    </Text>
                  </View>
                </View>

                {/* Bottom Actions */}
                <View style={styles.slotBottomRow}>
                  {/* Toggle Active Button */}
                  {expired && !item.isBooked ? (
                    <TouchableOpacity
                      style={[styles.toggleBtn, styles.toggleBtnExpired]}
                      onPress={() => {
                        setDialog({
                          title: 'Khung giờ đã hết hạn',
                          message:
                            'Khung giờ này đã quá thời gian so với hiện tại. Hệ thống đã tự động tắt nhận lịch để tránh xung đột.',
                          primaryLabel: 'Đã hiểu',
                          onPrimary: () => setDialog(null),
                        });
                      }}
                    >
                      <Ionicons name="lock-closed-outline" size={14} color="#64748B" />
                      <Text style={styles.toggleBtnExpiredText}>Đã tự tắt (Hết hạn)</Text>
                    </TouchableOpacity>
                  ) : item.isBooked ? (
                    <View style={[styles.toggleBtn, styles.btnDisabled]}>
                      <Ionicons name="checkmark-done" size={14} color="#1E40AF" />
                      <Text style={[styles.toggleBtnText, { color: '#1E40AF' }]}>Đã có lịch hẹn</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[
                        styles.toggleBtn,
                        item.isActive ? styles.toggleBtnActive : styles.toggleBtnInactive,
                      ]}
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
                  )}

                  <View style={styles.rightActionRow}>
                    <TouchableOpacity
                      style={[
                        styles.cardActionBtn,
                        (item.isBooked || expired) && styles.btnDisabled,
                      ]}
                      disabled={item.isBooked || expired}
                      onPress={() => handleOpenEdit(item)}
                    >
                      <Ionicons
                        name="pencil-outline"
                        size={15}
                        color={item.isBooked || expired ? '#A3A3A3' : theme.colors.primary}
                      />
                      <Text
                        style={[
                          styles.cardActionBtnText,
                          (item.isBooked || expired) && { color: '#A3A3A3' },
                        ]}
                      >
                        Sửa
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.cardDeleteBtn, item.isBooked && styles.btnDisabled]}
                      disabled={item.isBooked}
                      onPress={() => handleDeleteSlot(item)}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={15}
                        color={item.isBooked ? '#A3A3A3' : '#DC2626'}
                      />
                      <Text
                        style={[
                          styles.cardDeleteBtnText,
                          item.isBooked && { color: '#A3A3A3' },
                        ]}
                      >
                        Xóa
                      </Text>
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

      {/* Modal Dropdown Chọn Dịch Vụ */}
      <Modal
        visible={servicePickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setServicePickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.pickerBackdrop}
          activeOpacity={1}
          onPress={() => setServicePickerVisible(false)}
        >
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <View style={styles.pickerTitleRow}>
                <Ionicons name="layers" size={18} color={theme.colors.primary} />
                <Text style={styles.pickerTitle}>Lọc theo hình thức tư vấn</Text>
              </View>
              <TouchableOpacity
                onPress={() => setServicePickerVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Đóng"
              >
                <Ionicons name="close" size={20} color="#666666" />
              </TouchableOpacity>
            </View>

            <View style={styles.pickerOptionsList}>
              {[
                {
                  id: 'ALL' as const,
                  label: 'Tất cả dịch vụ',
                  icon: 'apps-outline',
                  desc: 'Hiển thị mọi hình thức tư vấn',
                },
                {
                  id: 'ONLINE_MEETING' as const,
                  label: 'Họp trực tuyến (1-1)',
                  icon: 'videocam-outline',
                  desc: 'Họp video qua Google Meet / phòng họp số',
                },
                {
                  id: 'CHAT' as const,
                  label: 'Nhắn tin tư vấn',
                  icon: 'chatbubble-ellipses-outline',
                  desc: 'Tư vấn trực tiếp bằng tin nhắn trong ứng dụng',
                },
                {
                  id: 'VOICE_CALL' as const,
                  label: 'Gọi thoại',
                  icon: 'call-outline',
                  desc: 'Tư vấn qua cuộc gọi thoại bảo mật',
                },
              ].map((opt) => {
                const isSelected = serviceFilter === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[
                      styles.pickerOptionItem,
                      isSelected && styles.pickerOptionItemSelected,
                    ]}
                    onPress={() => {
                      setServiceFilter(opt.id);
                      setServicePickerVisible(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.pickerOptionIconBox,
                        isSelected && styles.pickerOptionIconBoxSelected,
                      ]}
                    >
                      <Ionicons
                        name={opt.icon as any}
                        size={18}
                        color={isSelected ? theme.colors.primary : '#666666'}
                      />
                    </View>
                    <View style={styles.pickerOptionContent}>
                      <Text
                        style={[
                          styles.pickerOptionLabel,
                          isSelected && styles.pickerOptionLabelSelected,
                        ]}
                      >
                        {opt.label}
                      </Text>
                      <Text style={styles.pickerOptionDesc}>{opt.desc}</Text>
                    </View>
                    {isSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={theme.colors.primary}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal Dropdown Chọn Trạng Thái */}
      <Modal
        visible={statusPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setStatusPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.pickerBackdrop}
          activeOpacity={1}
          onPress={() => setStatusPickerVisible(false)}
        >
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <View style={styles.pickerTitleRow}>
                <Ionicons name="funnel" size={18} color={theme.colors.primary} />
                <Text style={styles.pickerTitle}>Lọc theo trạng thái khung giờ</Text>
              </View>
              <TouchableOpacity
                onPress={() => setStatusPickerVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Đóng"
              >
                <Ionicons name="close" size={20} color="#666666" />
              </TouchableOpacity>
            </View>

            <View style={styles.pickerOptionsList}>
              {[
                {
                  id: 'ALL' as const,
                  label: 'Tất cả trạng thái',
                  count: slots.length,
                  color: '#4B5563',
                  desc: 'Xem toàn bộ khung giờ làm việc',
                  icon: 'grid-outline',
                },
                {
                  id: 'AVAILABLE' as const,
                  label: 'Sẵn sàng nhận khách',
                  count: countAvailable,
                  color: '#059669',
                  desc: 'Khung giờ trong tương lai chưa có khách đặt',
                  icon: 'checkmark-circle-outline',
                },
                {
                  id: 'BOOKED' as const,
                  label: 'Đã có khách đặt hẹn',
                  count: countBooked,
                  color: '#2563EB',
                  desc: 'Khách hàng đã đăng ký & xác nhận cuộc hẹn',
                  icon: 'person-outline',
                },
                {
                  id: 'EXPIRED' as const,
                  label: 'Đã hết hạn (Hệ thống tự tắt)',
                  count: countExpired,
                  color: '#D97706',
                  desc: 'Đã quá thời gian hiện tại, tự động khóa nhận khách',
                  icon: 'time-outline',
                },
                {
                  id: 'INACTIVE' as const,
                  label: 'Tạm tắt thủ công',
                  count: countInactive,
                  color: '#6B7280',
                  desc: 'Khung giờ bạn tự chuyển sang tạm ngưng',
                  icon: 'pause-circle-outline',
                },
              ].map((opt) => {
                const isSelected = filter === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[
                      styles.pickerOptionItem,
                      isSelected && styles.pickerOptionItemSelected,
                    ]}
                    onPress={() => {
                      setFilter(opt.id);
                      setStatusPickerVisible(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.pickerOptionIconBox,
                        isSelected && styles.pickerOptionIconBoxSelected,
                      ]}
                    >
                      <Ionicons
                        name={opt.icon as any}
                        size={18}
                        color={isSelected ? opt.color : '#666666'}
                      />
                    </View>
                    <View style={styles.pickerOptionContent}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text
                          style={[
                            styles.pickerOptionLabel,
                            isSelected && styles.pickerOptionLabelSelected,
                          ]}
                        >
                          {opt.label}
                        </Text>
                        <View
                          style={[
                            styles.pickerCountBadge,
                            { backgroundColor: `${opt.color}18` },
                          ]}
                        >
                          <Text style={[styles.pickerCountBadgeText, { color: opt.color }]}>
                            {opt.count}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.pickerOptionDesc}>{opt.desc}</Text>
                    </View>
                    {isSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={theme.colors.primary}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
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
    marginHorizontal: 12,
    marginTop: 10,
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

  // Component Bảng lịch ngày tháng năm
  calendarCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ECE6DA',
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  calHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#FAF8F3',
    borderBottomWidth: 1,
    borderBottomColor: '#F0EBE1',
  },
  calMonthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  calNavArrow: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: '#E2DAC8',
  },
  calMonthTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 13.5,
    color: theme.colors.primary,
    paddingHorizontal: 4,
    textAlign: 'center',
  },
  calHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  calTodayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 7,
    paddingVertical: 4.5,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: '#E2DAC8',
    gap: 3,
  },
  calTodayBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: theme.colors.primary,
  },
  calToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: '#E2DAC8',
    gap: 3,
  },
  calToggleBtnHighlight: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  calToggleBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: theme.colors.primary,
  },
  calToggleBtnTextHighlight: {
    color: '#FFFFFF',
  },

  calBody: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 6,
  },
  weekDaysRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  weekDayCol: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 2,
  },
  weekDayText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: '#8C7653',
  },
  weekDayWeekendText: {
    color: '#C2410C',
  },

  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginVertical: 1,
  },
  dayCellSelected: {
    backgroundColor: theme.colors.primary,
  },
  dayCellToday: {
    borderWidth: 1.2,
    borderColor: theme.colors.gold,
    backgroundColor: '#FDFBF7',
  },
  dayNumText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: '#333333',
  },
  dayNumOtherMonth: {
    color: '#C4B5A5',
    fontFamily: fonts.body,
  },
  dayNumTodayText: {
    color: theme.colors.primary,
  },
  dayNumSelectedText: {
    color: '#FFFFFF',
  },
  dayDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 5,
    marginTop: 2,
    gap: 2,
  },
  dayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },

  calLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingTop: 6,
    borderTopWidth: 0.5,
    borderTopColor: '#F3EFE6',
    marginTop: 4,
  },
  calLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  calLegendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  calLegendText: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: '#777777',
  },

  // Selected date filter banner
  selectedDateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#FEF9F3',
    borderTopWidth: 1,
    borderTopColor: '#F7E7C4',
  },
  selectedDateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  selectedDateText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: theme.colors.primary,
  },
  selectedDateActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addSlotForDateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 5,
    gap: 3,
  },
  addSlotForDateText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: '#FFFFFF',
  },
  clearDateFilterBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EDE8DE',
  },

  // Dropdown Filter Row
  dropdownFiltersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginTop: 2,
    marginBottom: 4,
    gap: 8,
  },
  dropdownBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#ECE6DA',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    ...theme.shadows.card,
  },
  dropdownBtnActive: {
    borderColor: theme.colors.primary,
    backgroundColor: '#FDFBF9',
  },
  dropdownBtnText: {
    fontFamily: fonts.bodySemi,
    fontSize: 11.5,
    color: '#444444',
    flex: 1,
    marginHorizontal: 6,
  },
  dropdownBtnTextActive: {
    fontFamily: fonts.bodyBold,
    color: theme.colors.primary,
  },
  dropdownResetBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },

  activeFilterNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FBF9F4',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EFE9DD',
  },
  activeFilterNoticeText: {
    fontFamily: fonts.bodySemi,
    fontSize: 11.5,
    color: theme.colors.textSecondary,
  },
  clearFilterLink: {
    fontFamily: fonts.bodyBold,
    fontSize: 11.5,
    color: '#DC2626',
  },

  // Expired slot styles
  slotCardExpired: {
    backgroundColor: '#FAFAFA',
    borderColor: '#E5E7EB',
    opacity: 0.88,
  },
  slotDateTextExpired: {
    color: '#6B7280',
  },
  badgeExpired: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    gap: 4,
    borderWidth: 0.5,
    borderColor: '#CBD5E1',
  },
  badgeExpiredText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10.5,
    color: '#475569',
  },
  slotTimePillExpired: {
    backgroundColor: '#F3F4F6',
  },
  slotTimeTextExpired: {
    color: '#6B7280',
  },
  toggleBtnExpired: {
    backgroundColor: '#F1F5F9',
    borderWidth: 0.5,
    borderColor: '#CBD5E1',
  },
  toggleBtnExpiredText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: '#64748B',
  },

  // Picker Modal Styles
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 28,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EBE1',
  },
  pickerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pickerTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 16,
    color: theme.colors.primary,
  },
  pickerOptionsList: {
    paddingTop: 10,
    gap: 8,
  },
  pickerOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#FAF8F3',
    borderWidth: 1,
    borderColor: '#EFEBE1',
    gap: 12,
  },
  pickerOptionItemSelected: {
    backgroundColor: '#8B1E1E0B',
    borderColor: theme.colors.primary,
  },
  pickerOptionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#E2DAC8',
  },
  pickerOptionIconBoxSelected: {
    borderColor: theme.colors.primary,
  },
  pickerOptionContent: {
    flex: 1,
  },
  pickerOptionLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: '#333333',
  },
  pickerOptionLabelSelected: {
    color: theme.colors.primary,
  },
  pickerOptionDesc: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#777777',
    marginTop: 2,
  },
  pickerCountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  pickerCountBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
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
