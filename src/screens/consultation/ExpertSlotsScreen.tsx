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
  WeeklySlotItemDto,
  CreateRecurringSlotRequest,
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

  // Chế độ chọn nhiều để xóa hàng loạt (Bulk Selection Mode)
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedSlotIds, setSelectedSlotIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteProgress, setBulkDeleteProgress] = useState<{ current: number; total: number } | null>(null);

  // Modal Xác nhận Xóa tất cả theo bộ lọc (Delete All Filtered Modal)
  const [deleteAllModalVisible, setDeleteAllModalVisible] = useState(false);

  // Modal create/edit
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [scheduleType, setScheduleType] = useState<'single' | 'recurring'>('single');
  const [editingSlot, setEditingSlot] = useState<ExpertSlotDetailResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Recurring Slots Form States
  const [recurringDays, setRecurringDays] = useState<number[]>([1, 3, 5]); // Thứ 2, 4, 6
  const [recurringStartTime, setRecurringStartTime] = useState('08:30');
  const [recurringEndTime, setRecurringEndTime] = useState('11:30');
  const [recurringSessionType, setRecurringSessionType] = useState<SessionType>('ONLINE_MEETING');
  const [recurringWeeks, setRecurringWeeks] = useState(4);

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
    setScheduleType('single');
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
    setScheduleType('single');
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

  // Submit Recurring Slots
  const handleSubmitRecurring = async () => {
    if (recurringDays.length === 0) {
      setDialog({
        title: 'Thiếu ngày làm việc',
        message: 'Vui lòng chọn ít nhất một thứ trong tuần để lặp lại.',
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
      return;
    }

    if (recurringStartTime >= recurringEndTime) {
      setDialog({
        title: 'Thời gian không hợp lệ',
        message: 'Giờ kết thúc phải diễn ra sau giờ bắt đầu.',
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
      return;
    }

    setSubmitting(true);
    try {
      const req: CreateRecurringSlotRequest = {
        startDate: todayStr,
        numberOfWeeks: recurringWeeks,
        weeklySlots: recurringDays.map((dow) => ({
          dayOfWeek: dow,
          startTime: toIsoTime(recurringStartTime),
          endTime: toIsoTime(recurringEndTime),
          sessionType: recurringSessionType,
        })),
      };

      const res = await consultationApi.createRecurringSlots(req);
      setModalVisible(false);
      fetchSlots();
      setDialog({
        title: 'Tạo lịch định kỳ thành công',
        message: `Đã tạo thành công ${res.totalCreated} ca làm việc.${
          res.totalSkipped > 0
            ? ` Đã tự động bỏ qua ${res.totalSkipped} ca do trùng lịch hoặc vượt quá 6 ca/ngày.`
            : ''
        }`,
        primaryLabel: 'Tuyệt vời',
        onPrimary: () => setDialog(null),
      });
    } catch (err: any) {
      const friendly = toFriendlyConsultationError(
        err,
        'Không thể tạo lịch lặp lại',
        'Hệ thống chưa thể tạo lịch làm việc hàng loạt lúc này.'
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
            'Không thể xóa khung giờ này do đã từng có khách hàng đặt hẹn (hệ thống cần bảo lưu lịch sử đối soát) hoặc đang có giao dịch.'
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

  // ── XỬ LÝ CHỌN NHIỀU & XÓA HÀNG LOẠT (ĐẶT SAU KHI FILTEREDSLOTS ĐÃ KHỞI TẠO) ──
  const selectableFilteredSlots = useMemo(() => {
    return filteredSlots.filter((s) => !s.isBooked);
  }, [filteredSlots]);

  const isAllSelectableSelected = useMemo(() => {
    if (selectableFilteredSlots.length === 0) return false;
    return selectableFilteredSlots.every((s) => selectedSlotIds.has(s.id));
  }, [selectableFilteredSlots, selectedSlotIds]);

  const enterSelectionMode = (initialSlotId?: string) => {
    setIsSelectionMode(true);
    if (initialSlotId) {
      setSelectedSlotIds(new Set([initialSlotId]));
    } else {
      setSelectedSlotIds(new Set());
    }
  };

  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedSlotIds(new Set());
  };

  const handleToggleSelectSlot = (slot: ExpertSlotDetailResponse) => {
    if (slot.isBooked) {
      setDialog({
        title: 'Khung giờ đã có khách',
        message: 'Khung giờ này đã có khách hàng đặt lịch hẹn. Hệ thống không cho phép xóa để bảo đảm quyền lợi khách hàng.',
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
      return;
    }

    setSelectedSlotIds((prev) => {
      const next = new Set(prev);
      if (next.has(slot.id)) {
        next.delete(slot.id);
      } else {
        next.add(slot.id);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (isAllSelectableSelected) {
      setSelectedSlotIds(new Set());
    } else {
      const next = new Set(selectedSlotIds);
      selectableFilteredSlots.forEach((s) => next.add(s.id));
      setSelectedSlotIds(next);
    }
  };

  const executeBatchDelete = async (ids: string[], successMessage: string) => {
    if (ids.length === 0) return;
    setBulkDeleting(true);
    setBulkDeleteProgress({ current: 0, total: ids.length });

    let successCount = 0;
    let failedCount = 0;

    const chunkSize = 3;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map(async (id) => {
          try {
            await consultationApi.deleteSlot(id);
            successCount++;
          } catch {
            failedCount++;
          }
        })
      );
      setBulkDeleteProgress({
        current: Math.min(i + chunkSize, ids.length),
        total: ids.length,
      });
    }

    setBulkDeleting(false);
    setBulkDeleteProgress(null);
    setIsSelectionMode(false);
    setSelectedSlotIds(new Set());
    await fetchSlots();

    if (failedCount === 0) {
      setDialog({
        title: 'Xóa thành công',
        message: `${successMessage} (Tổng cộng ${successCount} ca làm việc).`,
        primaryLabel: 'Đóng',
        onPrimary: () => setDialog(null),
      });
    } else {
      setDialog({
        title: 'Hoàn tất xóa ca làm việc',
        message: `Đã xóa thành công ${successCount} ca làm việc.${
          failedCount > 0
            ? ` Có ${failedCount} ca không thể xóa do đã từng có khách đặt hẹn (hệ thống cần lưu lại lịch sử đối soát) hoặc đang có giao dịch.`
            : ''
        }`,
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
    }
  };

  const handleConfirmBulkDelete = () => {
    if (selectedSlotIds.size === 0) {
      setDialog({
        title: 'Chưa chọn ca làm việc',
        message: 'Vui lòng tích chọn ít nhất một ca làm việc để thực hiện xóa.',
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
      return;
    }

    const count = selectedSlotIds.size;
    setDialog({
      title: 'Xác nhận xóa hàng loạt',
      message: `Bạn có chắc chắn muốn xóa vĩnh viễn ${count} ca làm việc đã chọn? Thao tác này không thể hoàn tác.`,
      primaryLabel: `Xóa ${count} ca`,
      secondaryLabel: 'Hủy',
      destructive: true,
      onSecondary: () => setDialog(null),
      onPrimary: () => {
        setDialog(null);
        executeBatchDelete(Array.from(selectedSlotIds), 'Đã xóa hàng loạt thành công');
      },
    });
  };

  // Danh sách các ca đã đặt trong bộ lọc hiện tại (không thể xóa)
  const bookedFilteredSlots = useMemo(() => {
    return filteredSlots.filter((s) => s.isBooked || s.isHolding);
  }, [filteredSlots]);

  // Mô tả bộ lọc hiện tại một cách rõ ràng, trực quan
  const getFilterDescription = () => {
    const parts: string[] = [];
    if (selectedCalendarDate) {
      parts.push(`Ngày ${formatDateVi(selectedCalendarDate)}`);
    }
    if (filter === 'AVAILABLE') {
      parts.push('Trạng thái Sẵn sàng');
    } else if (filter === 'EXPIRED') {
      parts.push('Trạng thái Đã hết hạn');
    } else if (filter === 'INACTIVE') {
      parts.push('Trạng thái Tạm tắt');
    } else if (filter === 'BOOKED') {
      parts.push('Trạng thái Đã đặt');
    }
    if (serviceFilter === 'ONLINE_MEETING') {
      parts.push('Dịch vụ Họp trực tuyến');
    } else if (serviceFilter === 'CHAT') {
      parts.push('Dịch vụ Nhắn tin');
    } else if (serviceFilter === 'VOICE_CALL') {
      parts.push('Dịch vụ Gọi thoại');
    }

    if (parts.length === 0) {
      return 'Toàn bộ danh sách lịch làm việc';
    }
    return parts.join(' • ');
  };

  const handleOpenDeleteAllModal = () => {
    if (filteredSlots.length === 0) {
      setDialog({
        title: 'Không có ca làm việc',
        message: 'Hiện không có ca làm việc nào phù hợp với bộ lọc tìm kiếm hiện tại để xóa.',
        primaryLabel: 'Đóng',
        onPrimary: () => setDialog(null),
      });
      return;
    }

    if (selectableFilteredSlots.length === 0) {
      setDialog({
        title: 'Không thể xóa',
        message: `Toàn bộ ${bookedFilteredSlots.length} ca làm việc phù hợp với bộ lọc hiện tại đã có khách hàng đặt lịch hẹn. Hệ thống không cho phép xóa để bảo đảm quyền lợi của khách hàng.`,
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
      return;
    }

    setDeleteAllModalVisible(true);
  };

  const handleConfirmDeleteAllFiltered = () => {
    const idsToDelete = selectableFilteredSlots.map((s) => s.id);
    const count = idsToDelete.length;
    setDeleteAllModalVisible(false);

    executeBatchDelete(
      idsToDelete,
      `Đã xóa toàn bộ ${count} ca làm việc phù hợp với bộ lọc.`
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      {isSelectionMode ? (
        <View style={styles.selectionHeader}>
          <TouchableOpacity
            style={styles.selectionCloseBtn}
            onPress={exitSelectionMode}
            accessibilityRole="button"
            accessibilityLabel="Hủy chọn"
          >
            <Ionicons name="close" size={22} color={theme.colors.primary} />
            <Text style={styles.selectionCloseText}>Hủy</Text>
          </TouchableOpacity>

          <Text style={styles.selectionHeaderTitle}>
            Đã chọn {selectedSlotIds.size} ca
          </Text>

          <TouchableOpacity
            style={styles.selectionSelectAllBtn}
            onPress={handleToggleSelectAll}
            accessibilityRole="button"
            accessibilityLabel="Chọn tất cả"
          >
            <Ionicons
              name={isAllSelectableSelected ? 'checkbox' : 'square-outline'}
              size={18}
              color={theme.colors.primary}
            />
            <Text style={styles.selectionSelectAllText}>
              {isAllSelectableSelected ? 'Bỏ chọn' : 'Chọn hết'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('ExpertBookings'))}
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
          >
            <Ionicons name="chevron-back" size={24} color={theme.colors.primary} />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Lịch làm việc tư vấn</Text>

          <View style={{ width: 38 }} />
        </View>
      )}
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
              style={styles.calAddBtn}
              onPress={() => handleOpenCreate()}
              accessibilityRole="button"
              accessibilityLabel="Thêm lịch làm việc"
            >
              <Ionicons name="add" size={13} color="#FFFFFF" />
              <Text style={styles.calAddBtnText}>Thêm lịch</Text>
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
          <Text style={styles.activeFilterNoticeText} numberOfLines={1}>
            Hiển thị {filteredSlots.length} / {slots.length} khung giờ phù hợp
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {selectableFilteredSlots.length > 0 && (
              <TouchableOpacity
                onPress={handleOpenDeleteAllModal}
                style={styles.quickDeleteFilterBtn}
                accessibilityRole="button"
                accessibilityLabel="Xóa tất cả theo bộ lọc"
              >
                <Ionicons name="trash-outline" size={12} color="#DC2626" />
                <Text style={styles.quickDeleteFilterText}>
                  Xóa tất cả ({selectableFilteredSlots.length})
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={handleResetFilters}>
              <Text style={styles.clearFilterLink}>Bỏ lọc</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Thanh công cụ danh sách: Xóa tất cả theo bộ lọc & Chọn nhiều hàng loạt */}
      <View style={styles.listToolbar}>
        <Text style={styles.listToolbarCount}>
          {filteredSlots.length} ca làm việc
        </Text>

        <View style={styles.listToolbarActions}>
          <TouchableOpacity
            style={[
              styles.toolbarActionBtn,
              selectableFilteredSlots.length === 0 && styles.btnDisabled,
            ]}
            onPress={handleOpenDeleteAllModal}
            disabled={selectableFilteredSlots.length === 0}
            accessibilityRole="button"
            accessibilityLabel="Xóa tất cả theo bộ lọc"
          >
            <Ionicons
              name="trash-outline"
              size={13}
              color={selectableFilteredSlots.length > 0 ? '#DC2626' : '#9CA3AF'}
            />
            <Text
              style={[
                styles.toolbarActionBtnTextDanger,
                selectableFilteredSlots.length === 0 && { color: '#9CA3AF' },
              ]}
            >
              Xóa tất cả ({selectableFilteredSlots.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toolbarActionBtn,
              isSelectionMode && styles.toolbarActionBtnActive,
            ]}
            onPress={() => (isSelectionMode ? exitSelectionMode() : enterSelectionMode())}
            accessibilityRole="button"
            accessibilityLabel="Chọn nhiều để xóa"
          >
            <Ionicons
              name={isSelectionMode ? 'close-circle' : 'checkmark-done-circle-outline'}
              size={14}
              color={isSelectionMode ? '#FFFFFF' : theme.colors.primary}
            />
            <Text
              style={[
                styles.toolbarActionBtnText,
                isSelectionMode && styles.toolbarActionBtnTextActive,
              ]}
            >
              {isSelectionMode ? 'Thoát chọn' : 'Chọn nhiều'}
            </Text>
          </TouchableOpacity>
        </View>
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
            const isSelected = selectedSlotIds.has(item.id);
            const canSelect = !item.isBooked;

            return (
              <TouchableOpacity
                activeOpacity={isSelectionMode ? 0.7 : 1}
                onPress={isSelectionMode ? () => handleToggleSelectSlot(item) : undefined}
                style={[
                  styles.slotCard,
                  expired && !item.isBooked && styles.slotCardExpired,
                  isSelectionMode && isSelected && styles.slotCardSelected,
                ]}
              >
                <View style={styles.slotTopRow}>
                  {/* Left: Checkbox in selection mode + Date */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    {isSelectionMode && (
                      canSelect ? (
                        <TouchableOpacity
                          style={styles.cardCheckboxTouch}
                          onPress={() => handleToggleSelectSlot(item)}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: isSelected }}
                        >
                          <Ionicons
                            name={isSelected ? 'checkbox' : 'square-outline'}
                            size={22}
                            color={isSelected ? theme.colors.primary : '#94A3B8'}
                          />
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.cardCheckboxDisabled}>
                          <Ionicons name="lock-closed" size={16} color="#94A3B8" />
                        </View>
                      )
                    )}

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

                {/* Bottom Actions or Selection Notice */}
                {isSelectionMode ? (
                  <View style={styles.selectionModeCardNotice}>
                    {item.isBooked ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="lock-closed" size={13} color="#64748B" />
                        <Text style={styles.selectionModeCardNoticeTextDisabled}>
                          Đã có khách đặt • Không thể xóa
                        </Text>
                      </View>
                    ) : isSelected ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="checkmark-circle" size={14} color={theme.colors.primary} />
                        <Text style={styles.selectionModeCardNoticeTextActive}>
                          Đã chọn ca này để xóa
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.selectionModeCardNoticeText}>
                        Chạm vào để chọn ca này
                      </Text>
                    )}
                  </View>
                ) : (
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
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* ── MODAL THÊM / CHỈNH SỬA LỊCH LÀM VIỆC (TÍCH HỢP CA ĐƠN & LẶP LẠI) ── */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {/* Header Modal */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <Ionicons
                  name={
                    modalMode === 'edit'
                      ? 'create'
                      : scheduleType === 'recurring'
                      ? 'repeat'
                      : 'calendar'
                  }
                  size={20}
                  color={theme.colors.primary}
                />
                <Text style={styles.modalTitle}>
                  {modalMode === 'edit' ? 'Chỉnh sửa ca làm việc' : 'Thêm lịch làm việc'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} disabled={submitting}>
                <Ionicons name="close" size={22} color="#666666" />
              </TouchableOpacity>
            </View>

            {/* Bộ chuyển đổi Tab: Ca đơn (1 ngày) vs Lặp lại theo tuần */}
            {modalMode === 'create' && (
              <View style={styles.tabContainer}>
                <TouchableOpacity
                  style={[styles.tabBtn, scheduleType === 'single' && styles.tabBtnActive]}
                  onPress={() => setScheduleType('single')}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={15}
                    color={scheduleType === 'single' ? theme.colors.primary : '#6B7280'}
                  />
                  <Text style={[styles.tabBtnText, scheduleType === 'single' && styles.tabBtnTextActive]}>
                    Ca đơn (1 ngày)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.tabBtn, scheduleType === 'recurring' && styles.tabBtnActive]}
                  onPress={() => setScheduleType('recurring')}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="repeat-outline"
                    size={15}
                    color={scheduleType === 'recurring' ? theme.colors.primary : '#6B7280'}
                  />
                  <Text
                    style={[styles.tabBtnText, scheduleType === 'recurring' && styles.tabBtnTextActive]}
                  >
                    Lặp lại theo tuần
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {scheduleType === 'single' || modalMode === 'edit' ? (
                /* ── FORM CA ĐƠN ── */
                <>
                  {/* 1. Chọn ngày */}
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
                          <Text
                            style={[styles.dateChipText, isSelected && styles.dateChipTextSelected]}
                          >
                            {item.label}
                          </Text>
                          <Text
                            style={[styles.dateChipSub, isSelected && styles.dateChipSubSelected]}
                          >
                            {item.dateStr.slice(5)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  {/* 2. Giờ bắt đầu & Giờ kết thúc */}
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
                              const [h, m] = t.split(':').map(Number);
                              const endCandidate = `${String(h + 1).padStart(2, '0')}:${String(
                                m
                              ).padStart(2, '0')}`;
                              if (TIME_OPTIONS.includes(endCandidate)) {
                                setEndTime(endCandidate);
                              }
                            }}
                          >
                            <Text
                              style={[
                                styles.timeOptionText,
                                startTime === t && styles.timeOptionTextActive,
                              ]}
                            >
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
                            <Text
                              style={[
                                styles.timeOptionText,
                                endTime === t && styles.timeOptionTextActive,
                              ]}
                            >
                              {t}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  </View>

                  {/* 3. Hình thức tư vấn */}
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
                </>
              ) : (
                /* ── FORM LẶP LẠI THEO TUẦN ── */
                <>
                  <View style={styles.recurringIntroBox}>
                    <Ionicons name="sparkles" size={16} color={theme.colors.primary} />
                    <Text style={styles.recurringIntroText}>
                      Tự động mở các ca cố định trong nhiều tuần liên tiếp. Hệ thống tự động chống trùng giờ và bỏ qua ca vượt hạn mức.
                    </Text>
                  </View>

                  {/* 1. Chọn thứ trong tuần */}
                  <Text style={styles.formSectionLabel}>1. Chọn ngày lặp trong tuần:</Text>
                  <View style={styles.quickDayRow}>
                    <TouchableOpacity
                      style={styles.quickDayBtn}
                      onPress={() => setRecurringDays([1, 3, 5])}
                    >
                      <Text style={styles.quickDayBtnText}>T2 - T4 - T6</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.quickDayBtn}
                      onPress={() => setRecurringDays([2, 4, 6])}
                    >
                      <Text style={styles.quickDayBtnText}>T3 - T5 - T7</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.quickDayBtn}
                      onPress={() => setRecurringDays([1, 2, 3, 4, 5])}
                    >
                      <Text style={styles.quickDayBtnText}>T2 đến T6</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.dayGridRow}>
                    {[
                      { dow: 1, label: 'Thứ 2' },
                      { dow: 2, label: 'Thứ 3' },
                      { dow: 3, label: 'Thứ 4' },
                      { dow: 4, label: 'Thứ 5' },
                      { dow: 5, label: 'Thứ 6' },
                      { dow: 6, label: 'Thứ 7' },
                      { dow: 0, label: 'Chủ Nhật' },
                    ].map((item) => {
                      const isSelected = recurringDays.includes(item.dow);
                      return (
                        <TouchableOpacity
                          key={item.dow}
                          style={[styles.dayGridPill, isSelected && styles.dayGridPillActive]}
                          onPress={() => {
                            if (isSelected) {
                              setRecurringDays(recurringDays.filter((d) => d !== item.dow));
                            } else {
                              setRecurringDays([...recurringDays, item.dow]);
                            }
                          }}
                        >
                          <Ionicons
                            name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                            size={15}
                            color={isSelected ? theme.colors.primary : '#888888'}
                          />
                          <Text
                            style={[
                              styles.dayGridPillText,
                              isSelected && styles.dayGridPillTextActive,
                            ]}
                          >
                            {item.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* 2. Khung giờ áp dụng */}
                  <Text style={[styles.formSectionLabel, { marginTop: 14 }]}>
                    2. Khung giờ áp dụng cho mỗi ca:
                  </Text>
                  <View style={styles.timeGridRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.timeLabel}>Bắt đầu:</Text>
                      <ScrollView style={styles.timeSelectBox} nestedScrollEnabled>
                        {TIME_OPTIONS.map((t) => (
                          <TouchableOpacity
                            key={`rec-start-${t}`}
                            style={[
                              styles.timeOption,
                              recurringStartTime === t && styles.timeOptionActive,
                            ]}
                            onPress={() => {
                              setRecurringStartTime(t);
                              const [h, m] = t.split(':').map(Number);
                              const endCandidate = `${String(h + 1).padStart(2, '0')}:${String(
                                m
                              ).padStart(2, '0')}`;
                              if (TIME_OPTIONS.includes(endCandidate)) {
                                setRecurringEndTime(endCandidate);
                              }
                            }}
                          >
                            <Text
                              style={[
                                styles.timeOptionText,
                                recurringStartTime === t && styles.timeOptionTextActive,
                              ]}
                            >
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
                        {TIME_OPTIONS.filter((t) => t > recurringStartTime).map((t) => (
                          <TouchableOpacity
                            key={`rec-end-${t}`}
                            style={[
                              styles.timeOption,
                              recurringEndTime === t && styles.timeOptionActive,
                            ]}
                            onPress={() => setRecurringEndTime(t)}
                          >
                            <Text
                              style={[
                                styles.timeOptionText,
                                recurringEndTime === t && styles.timeOptionTextActive,
                              ]}
                            >
                              {t}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  </View>

                  {/* 3. Hình thức phiên tư vấn */}
                  <Text style={[styles.formSectionLabel, { marginTop: 14 }]}>
                    3. Hình thức phiên tư vấn:
                  </Text>
                  <View style={styles.sessionTypeOptions}>
                    {[
                      { key: 'ONLINE_MEETING', label: 'Họp trực tuyến (1-1)', icon: 'videocam' },
                      { key: 'CHAT', label: 'Nhắn tin tư vấn', icon: 'chatbubbles' },
                      { key: 'VOICE_CALL', label: 'Gọi thoại', icon: 'call' },
                    ].map((item) => {
                      const isSelected = recurringSessionType === item.key;
                      return (
                        <TouchableOpacity
                          key={`rec-${item.key}`}
                          style={[
                            styles.sessionTypeCard,
                            isSelected && styles.sessionTypeCardActive,
                          ]}
                          onPress={() => setRecurringSessionType(item.key as SessionType)}
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

                  {/* 4. Số tuần áp dụng */}
                  <Text style={[styles.formSectionLabel, { marginTop: 14 }]}>
                    4. Số tuần áp dụng liên tiếp:
                  </Text>
                  <View style={styles.weeksChoiceRow}>
                    {[
                      { weeks: 2, label: '2 tuần' },
                      { weeks: 4, label: '4 tuần (Gợi ý)' },
                      { weeks: 8, label: '8 tuần' },
                      { weeks: 12, label: '12 tuần (Tối đa)' },
                    ].map((w) => {
                      const isSelected = recurringWeeks === w.weeks;
                      return (
                        <TouchableOpacity
                          key={w.weeks}
                          style={[
                            styles.weeksChoicePill,
                            isSelected && styles.weeksChoicePillActive,
                          ]}
                          onPress={() => setRecurringWeeks(w.weeks)}
                        >
                          <Text
                            style={[
                              styles.weeksChoicePillText,
                              isSelected && styles.weeksChoicePillTextActive,
                            ]}
                          >
                            {w.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
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
                onPress={
                  modalMode === 'edit' || scheduleType === 'single'
                    ? handleSubmit
                    : handleSubmitRecurring
                }
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons
                      name={
                        modalMode === 'edit'
                          ? 'checkmark'
                          : scheduleType === 'recurring'
                          ? 'sparkles'
                          : 'checkmark'
                      }
                      size={18}
                      color="#FFFFFF"
                    />
                    <Text style={styles.modalSubmitBtnText}>
                      {modalMode === 'edit'
                        ? 'Lưu thay đổi'
                        : scheduleType === 'recurring'
                        ? 'Xác nhận tạo hàng loạt'
                        : 'Mở khung giờ'}
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

      {/* Modal Xác nhận Xóa tất cả theo bộ lọc tìm kiếm */}
      <Modal
        visible={deleteAllModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !bulkDeleting && setDeleteAllModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.deleteAllModalCard}>
            {/* Header */}
            <View style={styles.deleteAllModalHeader}>
              <View style={styles.deleteAllIconCircle}>
                <Ionicons name="trash-outline" size={24} color="#DC2626" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.deleteAllModalTitle}>Xác nhận xóa tất cả</Text>
                <Text style={styles.deleteAllModalSubtitle}>
                  Thao tác sẽ xóa vĩnh viễn các ca làm việc
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setDeleteAllModalVisible(false)}
                disabled={bulkDeleting}
                style={{ padding: 4 }}
              >
                <Ionicons name="close" size={22} color="#666666" />
              </TouchableOpacity>
            </View>

            {/* Chi tiết phạm vi xóa */}
            <View style={styles.deleteAllScopeCard}>
              <Text style={styles.deleteAllScopeLabel}>Phạm vi áp dụng (theo bộ lọc):</Text>
              <View style={styles.deleteAllScopeValueRow}>
                <Ionicons name="funnel" size={14} color={theme.colors.primary} />
                <Text style={styles.deleteAllScopeValue} numberOfLines={2}>
                  {getFilterDescription()}
                </Text>
              </View>

              <View style={styles.deleteAllCountBox}>
                <View style={styles.deleteAllCountItem}>
                  <Text style={styles.deleteAllCountLabel}>Tổng ca phù hợp</Text>
                  <Text style={styles.deleteAllCountNum}>{filteredSlots.length}</Text>
                </View>
                <View style={styles.deleteAllCountDivider} />
                <View style={styles.deleteAllCountItem}>
                  <Text style={[styles.deleteAllCountLabel, { color: '#DC2626' }]}>Sẽ bị xóa</Text>
                  <Text style={[styles.deleteAllCountNum, { color: '#DC2626' }]}>
                    {selectableFilteredSlots.length}
                  </Text>
                </View>
                {bookedFilteredSlots.length > 0 && (
                  <>
                    <View style={styles.deleteAllCountDivider} />
                    <View style={styles.deleteAllCountItem}>
                      <Text style={[styles.deleteAllCountLabel, { color: '#2563EB' }]}>Giữ lại (Đã đặt)</Text>
                      <Text style={[styles.deleteAllCountNum, { color: '#2563EB' }]}>
                        {bookedFilteredSlots.length}
                      </Text>
                    </View>
                  </>
                )}
              </View>
            </View>

            {/* Cảnh báo */}
            <View style={styles.deleteAllWarningBox}>
              <Ionicons name="warning-outline" size={18} color="#D97706" />
              <Text style={styles.deleteAllWarningText}>
                Toàn bộ <Text style={{ fontFamily: fonts.bodyBold, color: '#DC2626' }}>{selectableFilteredSlots.length} ca làm việc</Text> phù hợp với bộ lọc tìm kiếm sẽ bị xóa vĩnh viễn khỏi lịch. Hành động này không thể hoàn tác.
              </Text>
            </View>

            {/* Nút bấm */}
            <View style={styles.deleteAllActionsRow}>
              <TouchableOpacity
                style={styles.deleteAllCancelBtn}
                onPress={() => setDeleteAllModalVisible(false)}
                disabled={bulkDeleting}
              >
                <Text style={styles.deleteAllCancelBtnText}>Hủy bỏ</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.deleteAllConfirmBtn,
                  bulkDeleting && styles.btnDisabled,
                ]}
                onPress={handleConfirmDeleteAllFiltered}
                disabled={bulkDeleting || selectableFilteredSlots.length === 0}
              >
                {bulkDeleting ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    {bulkDeleteProgress && (
                      <Text style={styles.deleteAllConfirmBtnText}>
                        Đang xóa {bulkDeleteProgress.current}/{bulkDeleteProgress.total}...
                      </Text>
                    )}
                  </View>
                ) : (
                  <>
                    <Ionicons name="trash" size={16} color="#FFFFFF" />
                    <Text style={styles.deleteAllConfirmBtnText}>
                      Xóa tất cả ({selectableFilteredSlots.length})
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Thanh tác vụ cố định bên dưới khi ở chế độ chọn nhiều */}
      {isSelectionMode && (
        <View style={styles.bottomSelectionBar}>
          <View style={styles.bottomSelectionInfo}>
            <Text style={styles.bottomSelectionCount}>
              Đã chọn: <Text style={styles.bottomSelectionCountNum}>{selectedSlotIds.size}</Text> ca
            </Text>
            <Text style={styles.bottomSelectionSub}>
              {selectableFilteredSlots.length} ca có thể xóa
            </Text>
          </View>

          <View style={styles.bottomSelectionActions}>
            <TouchableOpacity
              style={styles.bottomCancelBtn}
              onPress={exitSelectionMode}
              disabled={bulkDeleting}
            >
              <Text style={styles.bottomCancelBtnText}>Hủy</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.bottomDeleteBtn,
                (selectedSlotIds.size === 0 || bulkDeleting) && styles.btnDisabled,
              ]}
              disabled={selectedSlotIds.size === 0 || bulkDeleting}
              onPress={handleConfirmBulkDelete}
            >
              {bulkDeleting ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  {bulkDeleteProgress && (
                    <Text style={styles.bottomDeleteBtnText}>
                      {bulkDeleteProgress.current}/{bulkDeleteProgress.total}
                    </Text>
                  )}
                </View>
              ) : (
                <>
                  <Ionicons name="trash" size={16} color="#FFFFFF" />
                  <Text style={styles.bottomDeleteBtnText}>
                    Xóa ({selectedSlotIds.size})
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

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
  headerAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    ...theme.shadows.button,
  },
  headerAddBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12.5,
    color: '#FFFFFF',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3EFE6',
    borderRadius: 10,
    padding: 3,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: '#FFFFFF',
    ...theme.shadows.card,
  },
  tabBtnText: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    color: '#6B7280',
  },
  tabBtnTextActive: {
    fontFamily: fonts.bodyBold,
    color: theme.colors.primary,
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
  calAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: 6,
    gap: 3,
    ...theme.shadows.button,
  },
  calAddBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: '#FFFFFF',
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
  recurringIntroBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFFBEB',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 12,
  },
  recurringIntroText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#92400E',
    flex: 1,
    lineHeight: 18,
  },
  quickDayRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  quickDayBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#F0EBE1',
    borderWidth: 1,
    borderColor: '#E2DCD0',
  },
  quickDayBtnText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: theme.colors.primary,
  },
  dayGridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayGridPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FAF8F3',
    borderWidth: 1,
    borderColor: '#E8E2D5',
  },
  dayGridPillActive: {
    backgroundColor: '#EBF4F6',
    borderColor: theme.colors.primary,
  },
  dayGridPillText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: '#4B5563',
  },
  dayGridPillTextActive: {
    fontFamily: fonts.bodyBold,
    color: theme.colors.primary,
  },
  weeksChoiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  weeksChoicePill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FAF8F3',
    borderWidth: 1,
    borderColor: '#E8E2D5',
  },
  weeksChoicePillActive: {
    backgroundColor: '#EBF4F6',
    borderColor: theme.colors.primary,
  },
  weeksChoicePillText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#4B5563',
  },
  weeksChoicePillTextActive: {
    fontFamily: fonts.bodyBold,
    color: theme.colors.primary,
  },

  // Selection Mode Header & Bar Styles
  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#ECE6DA',
  },
  selectionCloseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4,
  },
  selectionCloseText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: theme.colors.primary,
  },
  selectionHeaderTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 16,
    color: theme.colors.primary,
  },
  selectionSelectAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#F3EFE6',
  },
  selectionSelectAllText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: theme.colors.primary,
  },

  // List Toolbar
  listToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
  },
  listToolbarCount: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: '#6B7280',
  },
  listToolbarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toolbarActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2DAC8',
  },
  toolbarActionBtnActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  toolbarActionBtnText: {
    fontFamily: fonts.bodySemi,
    fontSize: 11.5,
    color: theme.colors.primary,
  },
  toolbarActionBtnTextActive: {
    color: '#FFFFFF',
    fontFamily: fonts.bodyBold,
  },
  toolbarActionBtnTextDanger: {
    fontFamily: fonts.bodySemi,
    fontSize: 11.5,
    color: '#DC2626',
  },

  // Quick delete in active filter
  quickDeleteFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
  },
  quickDeleteFilterText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: '#DC2626',
  },

  // Card Selection Styles
  cardCheckboxTouch: {
    padding: 2,
  },
  cardCheckboxDisabled: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  slotCardSelected: {
    borderColor: theme.colors.primary,
    borderWidth: 1.5,
    backgroundColor: '#FDFBF7',
  },
  selectionModeCardNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3EFE6',
  },
  selectionModeCardNoticeText: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    color: '#6B7280',
  },
  selectionModeCardNoticeTextActive: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: theme.colors.primary,
  },
  selectionModeCardNoticeTextDisabled: {
    fontFamily: fonts.bodySemi,
    fontSize: 11.5,
    color: '#64748B',
  },

  // Bottom Floating Selection Bar
  bottomSelectionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  bottomSelectionInfo: {
    flex: 1,
  },
  bottomSelectionCount: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    color: '#1F2937',
  },
  bottomSelectionCountNum: {
    fontFamily: fonts.serifBold,
    fontSize: 15,
    color: theme.colors.primary,
  },
  bottomSelectionSub: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#6B7280',
  },
  bottomSelectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bottomCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  bottomCancelBtnText: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    color: '#4B5563',
  },
  bottomDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DC2626',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  bottomDeleteBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: '#FFFFFF',
  },

  // Delete All Modal Confirmation Styles
  deleteAllModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 420,
    ...theme.shadows.card,
  },
  deleteAllModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  deleteAllIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteAllModalTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 17,
    color: '#1F2937',
  },
  deleteAllModalSubtitle: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  deleteAllScopeCard: {
    backgroundColor: '#FBF9F4',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ECE4D4',
    marginBottom: 14,
  },
  deleteAllScopeLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 11.5,
    color: '#6B7280',
    marginBottom: 6,
  },
  deleteAllScopeValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  deleteAllScopeValue: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: theme.colors.primary,
    flex: 1,
  },
  deleteAllCountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#EFEBE1',
  },
  deleteAllCountItem: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  deleteAllCountLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 2,
  },
  deleteAllCountNum: {
    fontFamily: fonts.serifBold,
    fontSize: 16,
    color: '#1F2937',
  },
  deleteAllCountDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E5E7EB',
  },
  deleteAllWarningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 10,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  deleteAllWarningText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#92400E',
    flex: 1,
    lineHeight: 17,
  },
  deleteAllActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  deleteAllCancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteAllCancelBtnText: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    color: '#4B5563',
  },
  deleteAllConfirmBtn: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: '#DC2626',
  },
  deleteAllConfirmBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
});
