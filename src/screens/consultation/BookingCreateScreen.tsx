import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
  Platform,
  BackHandler,
  Modal,
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
import { consultationApi } from '../../api/consultationApi';
import { toFriendlyConsultationError } from '../../utils/consultationFriendlyErrors';
import type {
  ExpertDetailResponse,
  ExpertAvailableSlotDto,
  SpecializationDto,
  BookingPreviewResponse,
  SessionType,
} from '../../types/consultation';
import {
  formatVnd,
  formatSessionType,
  formatVietnameseDate,
  formatTimeRange,
  isValidAvatarUrl,
} from '../../types/consultation';

export const BookingCreateScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'BookingCreate'>>();
  const { expertProfileId, initialSlotId, specializationId: initialSpecId } = route.params;

  const [expert, setExpert] = useState<ExpertDetailResponse | null>(null);
  const [availableSlots, setAvailableSlots] = useState<ExpertAvailableSlotDto[]>([]);
  const [specializations, setSpecializations] = useState<SpecializationDto[]>([]);

  // Form states
  const [configuredSessionTypes, setConfiguredSessionTypes] = useState<SessionType[]>(['ONLINE_MEETING']);
  const [selectedSessionType, setSelectedSessionType] = useState<SessionType>('ONLINE_MEETING');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string>(initialSlotId || '');
  const [selectedSpecId, setSelectedSpecId] = useState<number>(initialSpecId || 0);
  const [topicTitle, setTopicTitle] = useState('');
  const [problemDescription, setProblemDescription] = useState('');
  const [slotPeriodFilter, setSlotPeriodFilter] = useState<'ALL' | 'MORNING' | 'AFTERNOON' | 'EVENING'>('ALL');
  const [slotSessionModalVisible, setSlotSessionModalVisible] = useState(false);
  const [slotPeriodModalVisible, setSlotPeriodModalVisible] = useState(false);
  const [specModalVisible, setSpecModalVisible] = useState(false);

  // Loading & Preview states
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [previewData, setPreviewData] = useState<BookingPreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
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

  // Load initial expert, slots & specializations
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingInitial(true);
      try {
        const [detail, slots, specs, feeConfigs] = await Promise.all([
          consultationApi.getExpertDetail(expertProfileId),
          consultationApi.getAvailableSlotsForBooking(expertProfileId, undefined, 14),
          consultationApi.getSpecializations(true),
          consultationApi.getConsultationFeeConfigs({ isActive: true }).catch(() => []),
        ]);

        if (mounted) {
          setExpert(detail);
          setAvailableSlots(slots);
          setSpecializations(specs);

          const activeAdminTypes: SessionType[] =
            Array.isArray(feeConfigs) && feeConfigs.length > 0
              ? (Array.from(
                  new Set(
                    feeConfigs
                      .filter((c) => c.isActive !== false)
                      .map((c) => c.sessionType as SessionType)
                  )
                ) as SessionType[])
              : ['ONLINE_MEETING'];
          if (activeAdminTypes.length > 0) {
            setConfiguredSessionTypes(activeAdminTypes);
          }

          // Default specialization if not selected
          if (!initialSpecId && specs.length > 0) {
            setSelectedSpecId(specs[0].id);
          }
          // Default session type & slot
          if (initialSlotId) {
            const initSlot = slots.find((s) => s.id === initialSlotId);
            if (initSlot) {
              setSelectedSlotId(initialSlotId);
              setSelectedSessionType(initSlot.sessionType);
              setSelectedDate(initSlot.slotDate);
            }
          } else if (detail.feePackages && detail.feePackages.length > 0) {
            const activePkg =
              detail.feePackages.find((p) => activeAdminTypes.includes(p.sessionType)) ||
              detail.feePackages[0];
            const firstType = activePkg.sessionType;
            setSelectedSessionType(firstType);
            const slotsForType = slots.filter((s) => s.sessionType === firstType);
            if (slotsForType.length > 0) {
              setSelectedDate(slotsForType[0].slotDate);
              setSelectedSlotId(slotsForType[0].id);
            }
          } else if (slots.length > 0) {
            setSelectedSessionType(slots[0].sessionType);
            setSelectedDate(slots[0].slotDate);
            setSelectedSlotId(slots[0].id);
          }
        }
      } catch (err: any) {
        const friendly = toFriendlyConsultationError(
          err,
          'Lỗi tải thông tin',
          'Không thể tải thông tin đặt lịch tư vấn lúc này.'
        );
        setDialog({
          title: friendly.title,
          message: friendly.message,
          primaryLabel: 'Đã hiểu',
          onPrimary: () => setDialog(null),
        });
      } finally {
        if (mounted) setLoadingInitial(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [expertProfileId, initialSlotId, initialSpecId]);

// Helper: Tính thời lượng phút giữa 2 mốc giờ
const getSlotDurationMinutes = (startTime?: string, endTime?: string): number => {
  if (!startTime || !endTime) return 60;
  try {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const diff = (eh * 60 + (em || 0)) - (sh * 60 + (sm || 0));
    return diff > 0 ? diff : 60;
  } catch {
    return 60;
  }
};

  // Danh sách các gói dịch vụ tư vấn niêm yết của chuyên gia gom nhóm duy nhất theo sessionType (đồng bộ theo cấu hình Admin)
  const dynamicServicePackages = useMemo(() => {
    if (!expert) return [];

    const feeSessionTypes = expert.feePackages
      ? expert.feePackages
          .map((p) => p.sessionType)
          .filter((t) => configuredSessionTypes.includes(t))
      : [];
    const slotSessionTypes = availableSlots
      .map((s) => s.sessionType)
      .filter((t) => configuredSessionTypes.includes(t) || availableSlots.some((s) => s.sessionType === t));
    const distinctTypes = Array.from(
      new Set(
        [...feeSessionTypes, ...slotSessionTypes].length > 0
          ? [...feeSessionTypes, ...slotSessionTypes]
          : configuredSessionTypes
      )
    );

    return distinctTypes.map((type) => {
      const sInfo = formatSessionType(type);
      const pkgs = (expert.feePackages || [])
        .filter((p) => p.sessionType === type)
        .sort((a, b) => a.durationMinutes - b.durationMinutes);

      const slotCount = availableSlots.filter((s) => s.sessionType === type).length;
      const minFee = pkgs.length > 0 ? Math.min(...pkgs.map((p) => p.fee)) : 0;
      const maxFee = pkgs.length > 0 ? Math.max(...pkgs.map((p) => p.fee)) : 0;

      // Chuỗi hiển thị mức giá chính
      let feeDisplay = 'Liên hệ';
      if (pkgs.length === 1) {
        feeDisplay = `${formatVnd(pkgs[0].fee)} / ${pkgs[0].durationMinutes}p`;
      } else if (pkgs.length > 1) {
        if (minFee === maxFee) {
          feeDisplay = formatVnd(minFee);
        } else {
          feeDisplay = `Từ ${formatVnd(minFee)}`;
        }
      }

      // Chuỗi tóm tắt biểu phí theo các mốc thời lượng (ví dụ: "30p: 300.000 đ • 60p: 500.000 đ")
      const feeTiersText = pkgs.length > 1
        ? pkgs.map((p) => `${p.durationMinutes}p: ${formatVnd(p.fee)}`).join('  •  ')
        : '';

      return {
        sessionType: type,
        label: sInfo.fullLabel || sInfo.label,
        icon: sInfo.icon as keyof typeof Ionicons.glyphMap,
        color: sInfo.color,
        minFee,
        maxFee,
        feeDisplay,
        feeTiersText,
        packages: pkgs,
        slotCount,
        desc:
          type === 'ONLINE_MEETING'
            ? 'Gọi video tương tác và chia sẻ màn hình trực tiếp'
            : type === 'CHAT'
            ? 'Hỏi đáp & gửi hồ sơ chứng từ qua tin nhắn'
            : 'Tư vấn trực tiếp qua đường truyền thoại',
      };
    });
  }, [expert, availableSlots, configuredSessionTypes]);

  // Switch session type: reset slot and update date
  const handleSelectSessionType = (type: SessionType) => {
    setSelectedSessionType(type);
    const slotsForType = availableSlots.filter((s) => s.sessionType === type);
    const datesForType = Array.from(new Set(slotsForType.map((s) => s.slotDate))).sort();
    if (datesForType.length > 0) {
      const nextDate =
        selectedDate && datesForType.includes(selectedDate) ? selectedDate : datesForType[0];
      setSelectedDate(nextDate);
      const slotOnDate = slotsForType.find((s) => s.slotDate === nextDate);
      setSelectedSlotId(slotOnDate ? slotOnDate.id : (slotsForType[0]?.id || ''));
    } else {
      setSelectedDate(null);
      setSelectedSlotId('');
    }
  };

  // Switch date: auto-select first slot on that date
  const handleSelectDate = (dateStr: string) => {
    setSelectedDate(dateStr);
    const slotsOnDate = availableSlots.filter(
      (s) => s.sessionType === selectedSessionType && s.slotDate === dateStr
    );
    if (!slotsOnDate.some((s) => s.id === selectedSlotId)) {
      setSelectedSlotId(slotsOnDate[0]?.id || '');
    }
  };

  // Filtered slots & dates for chosen session type
  const slotsForSelectedSession = useMemo(() => {
    return availableSlots.filter((s) => s.sessionType === selectedSessionType);
  }, [availableSlots, selectedSessionType]);

  const uniqueDatesForSession = useMemo(() => {
    const dates = Array.from(new Set(slotsForSelectedSession.map((s) => s.slotDate)));
    return dates.sort();
  }, [slotsForSelectedSession]);

  const slotsForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    return slotsForSelectedSession.filter((s) => {
      if (s.slotDate !== selectedDate) return false;
      if (slotPeriodFilter !== 'ALL') {
        const hour = parseInt((s.startTime || '00:00').split(':')[0], 10);
        if (slotPeriodFilter === 'MORNING' && hour >= 12) return false;
        if (slotPeriodFilter === 'AFTERNOON' && (hour < 12 || hour >= 18)) return false;
        if (slotPeriodFilter === 'EVENING' && hour < 18) return false;
      }
      return true;
    });
  }, [slotsForSelectedSession, selectedDate, slotPeriodFilter]);

  // Dry-run preview calculation triggered when slot or specialization changes
  const runPreview = useCallback(async () => {
    if (!selectedSlotId || !selectedSpecId) return;

    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const res = await consultationApi.previewBooking({
        expertSlotId: selectedSlotId,
        specializationId: selectedSpecId,
      });
      setPreviewData(res);
      if (!res.isValid && res.validationMessage) {
        setPreviewError(res.validationMessage);
      }
    } catch (err: any) {
      const friendly = toFriendlyConsultationError(
        err,
        'Lỗi tạm tính',
        'Không thể tính toán chi phí tư vấn dự kiến lúc này.'
      );
      setPreviewError(friendly.message);
      setPreviewData(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [selectedSlotId, selectedSpecId]);

  useEffect(() => {
    if (selectedSlotId && selectedSpecId) {
      runPreview();
    }
  }, [selectedSlotId, selectedSpecId, runPreview]);

  // Submit Booking
  const handleSubmitBooking = async () => {
    if (!selectedSlotId) {
      setDialog({
        title: 'Thông tin chưa đầy đủ',
        message: 'Vui lòng chọn một khung giờ tư vấn khả dụng.',
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
      return;
    }
    if (!selectedSpecId) {
      setDialog({
        title: 'Thông tin chưa đầy đủ',
        message: 'Vui lòng chọn lĩnh vực cần tư vấn.',
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
      return;
    }
    if (!topicTitle.trim()) {
      setDialog({
        title: 'Thông tin chưa đầy đủ',
        message: 'Vui lòng nhập tiêu đề tóm tắt buổi tư vấn.',
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
      return;
    }
    if (!problemDescription.trim()) {
      setDialog({
        title: 'Thông tin chưa đầy đủ',
        message: 'Vui lòng mô tả chi tiết vấn đề hoặc câu hỏi trọng tâm để chuyên gia chuẩn bị.',
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
      return;
    }
    if (previewError || (previewData && !previewData.isValid)) {
      setDialog({
        title: 'Không thể đặt lịch',
        message: previewError || previewData?.validationMessage || 'Khung giờ này không khả dụng.',
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
      return;
    }

    setSubmitting(true);
    try {
      const result = await consultationApi.createBooking({
        expertSlotId: selectedSlotId,
        specializationId: selectedSpecId,
        topicTitle: topicTitle.trim(),
        problemDescription: problemDescription.trim(),
      });

      const holdMins = result.holdExpiresAt
        ? Math.max(1, Math.round((new Date(result.holdExpiresAt).getTime() - Date.now()) / 60000))
        : null;

      setDialog({
        title: 'Đặt lịch hẹn thành công!',
        message: holdMins
          ? `Khung giờ đã được tạm giữ trong ${holdMins} phút. Vui lòng hoàn tất thanh toán để lịch hẹn được xác nhận.`
          : 'Khung giờ đã được tạm giữ. Vui lòng hoàn tất thanh toán để lịch hẹn được xác nhận.',
        primaryLabel: 'Xem chi tiết lịch hẹn',
        onPrimary: () => {
          setDialog(null);
          navigation.replace('BookingDetail', { bookingId: result.id, autoPay: true });
        },
      });
    } catch (err: any) {
      const friendly = toFriendlyConsultationError(
        err,
        'Đặt lịch thất bại',
        'Không thể khởi tạo lịch hẹn lúc này.'
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

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('ExpertList');
    }
  }, [navigation]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true;
    });
    return () => sub.remove();
  }, [handleBack]);

  const selectedSlot = useMemo(() => {
    return availableSlots.find((s) => s.id === selectedSlotId);
  }, [availableSlots, selectedSlotId]);

  if (loadingInitial) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <DrumPatternBackdrop variant="soft" />
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Đặt lịch tư vấn</Text>
          <View style={{ width: 38 }} />
        </View>
        <GoldDoubleRule />
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Đang chuẩn bị biểu mẫu đặt lịch...</Text>
        </View>
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
  }

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
        <Text style={styles.headerTitle}>Xác nhận đặt lịch tư vấn</Text>
        <View style={{ width: 38 }} />
      </View>
      <GoldDoubleRule />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* ── 1. EXPERT MINI SUMMARY ── */}
        {expert && (
          <View style={styles.expertSummaryCard}>
            <View style={styles.expertSummaryAvatarWrap}>
              {isValidAvatarUrl(expert.avatarUrl) ? (
                <Image source={{ uri: expert.avatarUrl! }} style={styles.expertSummaryAvatar} />
              ) : (
                <View style={styles.expertSummaryAvatarPlaceholder}>
                  <Text style={styles.expertSummaryAvatarLetter}>
                    {expert.fullName.trim().charAt(expert.fullName.trim().length - 1)}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.expertSummaryInfo}>
              <Text style={styles.expertSummaryName}>{expert.fullName}</Text>
              <Text style={styles.expertSummaryJob}>{expert.jobTitle || 'Chuyên gia thuế'}</Text>
              <View style={styles.expertSummaryRatingRow}>
                <Ionicons name="star" size={13} color="#F59E0B" />
                <Text style={styles.expertSummaryRating}>
                  {expert.rating > 0 ? expert.rating.toFixed(1) : '5.0'}
                </Text>
                <Text style={styles.expertSummaryReviews}>({expert.totalReviews} đánh giá)</Text>
              </View>
            </View>
          </View>
        )}

        {/* ── 2. CHỌN HÌNH THỨC DỊCH VỤ ── */}
        <View style={styles.formSection}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="apps-outline" size={18} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>1. Hình thức dịch vụ tư vấn</Text>
            <Text style={styles.requiredMark}>*</Text>
          </View>
          <Text style={styles.sectionHint}>
            Chọn hình thức bạn mong muốn để xem lịch và khung giờ tương ứng
          </Text>

          {dynamicServicePackages.length === 0 ? (
            <View style={styles.emptySlotWarning}>
              <Ionicons name="alert-circle" size={18} color="#D97706" />
              <Text style={styles.emptySlotWarningText}>
                Chuyên gia hiện chưa niêm yết gói dịch vụ hoặc khung giờ tư vấn nào.
              </Text>
            </View>
          ) : (
            <View style={styles.serviceTypesList}>
              {dynamicServicePackages.map((srv) => {
                const isSelected = selectedSessionType === srv.sessionType;

                // Nếu hình thức này đang được chọn và người dùng đã chọn slot, tính giá chính xác theo thời lượng slot
                const selectedSlotDur =
                  isSelected && selectedSlot && selectedSlot.sessionType === srv.sessionType
                    ? getSlotDurationMinutes(selectedSlot.startTime, selectedSlot.endTime)
                    : null;

                const matchedSlotPkg = selectedSlotDur
                  ? srv.packages.find((p) => p.durationMinutes === selectedSlotDur)
                  : null;

                const activeFeeDisplay = matchedSlotPkg
                  ? formatVnd(matchedSlotPkg.fee)
                  : srv.feeDisplay;

                return (
                  <TouchableOpacity
                    key={`srv_${srv.sessionType}`}
                    style={[
                      styles.serviceCardItem,
                      isSelected && styles.serviceCardItemActive,
                    ]}
                    onPress={() => handleSelectSessionType(srv.sessionType)}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={`Chọn hình thức ${srv.label}`}
                  >
                    <View style={styles.serviceCardLeft}>
                      <View
                        style={[
                          styles.serviceIconWrap,
                          isSelected && styles.serviceIconWrapActive,
                        ]}
                      >
                        <Ionicons
                          name={srv.icon}
                          size={20}
                          color={isSelected ? '#FFFFFF' : theme.colors.primary}
                        />
                      </View>
                      <View style={styles.serviceInfoCol}>
                        <Text
                          style={[
                            styles.serviceName,
                            isSelected && styles.serviceNameActive,
                          ]}
                        >
                          {srv.label}
                        </Text>
                        <Text style={styles.serviceDesc}>{srv.desc}</Text>
                        {srv.feeTiersText ? (
                          <Text style={styles.serviceTiersText}>{srv.feeTiersText}</Text>
                        ) : null}
                      </View>
                    </View>

                    <View style={styles.serviceCardRight}>
                      <View style={styles.servicePriceRow}>
                        <Text style={styles.servicePrice}>
                          {activeFeeDisplay}
                        </Text>
                        <Ionicons
                          name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                          size={20}
                          color={isSelected ? theme.colors.primary : '#C4B5A5'}
                          style={{ marginLeft: 6 }}
                        />
                      </View>
                      {matchedSlotPkg && selectedSlotDur ? (
                        <Text style={styles.selectedDurationHint}>
                          Đã chọn: {selectedSlotDur} phút
                        </Text>
                      ) : null}
                      <View
                        style={[
                          styles.serviceSlotBadge,
                          srv.slotCount === 0 && styles.serviceSlotBadgeEmpty,
                        ]}
                      >
                        <Text
                          style={[
                            styles.serviceSlotBadgeText,
                            srv.slotCount === 0 && styles.serviceSlotBadgeTextEmpty,
                          ]}
                        >
                          {srv.slotCount > 0 ? `${srv.slotCount} khung giờ` : 'Tạm hết lịch'}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* ── 3. LỊCH & KHUNG GIỜ CỦA HÌNH THỨC ĐÃ CHỌN ── */}
        <View style={styles.formSection}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="calendar-outline" size={18} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>
              2. Lịch & Khung giờ:{' '}
              {dynamicServicePackages.find((s) => s.sessionType === selectedSessionType)?.label ||
                formatSessionType(selectedSessionType).fullLabel ||
                formatSessionType(selectedSessionType).label}
            </Text>
            <Text style={styles.requiredMark}>*</Text>
          </View>
          <Text style={styles.sectionHint}>
            Chọn ngày và khung giờ tư vấn phù hợp với lịch trình của bạn
          </Text>

          {/* Compact Horizontal Dropdown Filter Row */}
          <View style={styles.filterDropdownRow}>
            <TouchableOpacity
              style={styles.dropdownFilterBtn}
              onPress={() => setSlotSessionModalVisible(true)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Chọn hình thức dịch vụ"
            >
              <Ionicons
                name={formatSessionType(selectedSessionType).icon as any}
                size={13}
                color={theme.colors.primary}
              />
              <Text style={styles.dropdownFilterBtnText} numberOfLines={1}>
                {formatSessionType(selectedSessionType).label}
              </Text>
              <Ionicons name="chevron-down" size={12} color={theme.colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.dropdownFilterBtn,
                slotPeriodFilter !== 'ALL' && styles.dropdownFilterBtnActive,
              ]}
              onPress={() => setSlotPeriodModalVisible(true)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Lọc theo buổi trong ngày"
            >
              <Ionicons
                name="sunny-outline"
                size={13}
                color={slotPeriodFilter !== 'ALL' ? '#FFFFFF' : theme.colors.primary}
              />
              <Text
                style={[
                  styles.dropdownFilterBtnText,
                  slotPeriodFilter !== 'ALL' && styles.dropdownFilterBtnTextActive,
                ]}
                numberOfLines={1}
              >
                {slotPeriodFilter === 'MORNING'
                  ? 'Buổi sáng'
                  : slotPeriodFilter === 'AFTERNOON'
                  ? 'Buổi chiều'
                  : slotPeriodFilter === 'EVENING'
                  ? 'Buổi tối'
                  : 'Tất cả buổi'}
              </Text>
              <Ionicons
                name="chevron-down"
                size={12}
                color={slotPeriodFilter !== 'ALL' ? '#FFFFFF' : theme.colors.textSecondary}
              />
            </TouchableOpacity>

            {slotPeriodFilter !== 'ALL' && (
              <TouchableOpacity
                style={styles.filterResetIconBtn}
                onPress={() => setSlotPeriodFilter('ALL')}
                accessibilityRole="button"
                accessibilityLabel="Đặt lại lọc buổi"
              >
                <Ionicons name="refresh" size={14} color={theme.colors.primary} />
              </TouchableOpacity>
            )}
          </View>

          {uniqueDatesForSession.length === 0 ? (
            <View style={styles.emptySlotWarning}>
              <Ionicons name="alert-circle" size={18} color="#D97706" />
              <Text style={styles.emptySlotWarningText}>
                Chưa có khung giờ khả dụng cho hình thức này. Vui lòng chọn hình thức khác hoặc quay lại sau.
              </Text>
            </View>
          ) : (
            <>
              {/* Date Ribbon */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.dateRibbon}
              >
                {uniqueDatesForSession.map((dateStr) => {
                  const isSelected = selectedDate === dateStr;
                  const dateObj = new Date(dateStr);
                  const dayName = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][dateObj.getDay()];
                  const dayNum = dateObj.getDate();
                  const monthNum = dateObj.getMonth() + 1;

                  return (
                    <TouchableOpacity
                      key={dateStr}
                      style={[styles.dateCard, isSelected && styles.dateCardSelected]}
                      onPress={() => handleSelectDate(dateStr)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.dateDayName, isSelected && styles.dateTextActive]}>
                        {dayName}
                      </Text>
                      <Text style={[styles.dateDayNum, isSelected && styles.dateTextActive]}>
                        {dayNum}
                      </Text>
                      <Text style={[styles.dateMonth, isSelected && styles.dateTextActive]}>
                        T.{monthNum}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Slot chips for selected date */}
              <View style={styles.slotGridWrap}>
                <Text style={styles.slotGridTitle}>
                  Khung giờ ngày {formatVietnameseDate(selectedDate || '')}
                </Text>

                {slotsForSelectedDate.length === 0 ? (
                  <Text style={styles.noSlotText}>Không có khung giờ rảnh vào ngày này.</Text>
                ) : (
                  <View style={styles.slotGrid}>
                    {slotsForSelectedDate.map((slot) => {
                      const isSelected = selectedSlotId === slot.id;
                      const sInfo = formatSessionType(slot.sessionType);
                      const slotDur = getSlotDurationMinutes(slot.startTime, slot.endTime);
                      const matchedSlotFee = expert?.feePackages?.find(
                        (p) => p.sessionType === slot.sessionType && p.durationMinutes === slotDur
                      )?.fee;

                      return (
                        <TouchableOpacity
                          key={slot.id}
                          style={[styles.slotChip, isSelected && styles.slotChipSelected]}
                          onPress={() => setSelectedSlotId(slot.id)}
                          activeOpacity={0.8}
                        >
                          <View style={styles.slotTopRow}>
                            <Ionicons
                              name={sInfo.icon as any}
                              size={13}
                              color={isSelected ? '#FFFFFF' : sInfo.color}
                            />
                            <Text
                              style={[
                                styles.slotSessionText,
                                isSelected && styles.slotTextActive,
                              ]}
                            >
                              {sInfo.label}
                            </Text>
                          </View>
                          <Text
                            style={[styles.slotTimeText, isSelected && styles.slotTextActive]}
                          >
                            {formatTimeRange(slot.startTime, slot.endTime)}
                          </Text>
                          <View style={styles.slotDurationRow}>
                            <Text
                              style={[
                                styles.slotDurationText,
                                isSelected && styles.slotTextActive,
                              ]}
                            >
                              {slotDur} phút{matchedSlotFee ? ` • ${formatVnd(matchedSlotFee)}` : ''}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            </>
          )}
        </View>

        {/* ── 4. CHỌN CHỦ ĐỀ CHUYÊN MÔN ── */}
        <View style={styles.formSection}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="bookmark" size={18} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>3. Lĩnh vực chuyên môn cần tư vấn</Text>
            <Text style={styles.requiredMark}>*</Text>
          </View>
          <Text style={styles.sectionHint}>
            Chọn lĩnh vực để chuyên gia chuẩn bị tài liệu và giải đáp trọng tâm
          </Text>

          <TouchableOpacity
            style={styles.dropdownFilterBtn}
            onPress={() => setSpecModalVisible(true)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Chọn lĩnh vực chuyên môn"
          >
            <Ionicons name="ribbon-outline" size={14} color={theme.colors.primary} />
            <Text style={styles.dropdownFilterBtnText} numberOfLines={1}>
              {specializations.find((s) => s.id === selectedSpecId)?.name ||
                'Chọn lĩnh vực chuyên môn'}
            </Text>
            <Ionicons name="chevron-down" size={14} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* ── 4. TIÊU ĐỀ & MÔ TẢ NỘI DUNG VẤN ĐỀ ── */}
        <View style={styles.formSection}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="document-text" size={18} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>Nội dung câu hỏi & Vấn đề</Text>
            <Text style={styles.requiredMark}>*</Text>
          </View>

          {/* Topic Title */}
          <Text style={styles.inputLabel}>Tiêu đề tóm tắt</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Ví dụ: Tư vấn quyết toán thuế TNCN có 2 nguồn thu nhập"
            placeholderTextColor="#999999"
            value={topicTitle}
            onChangeText={setTopicTitle}
            maxLength={150}
          />

          {/* Problem Description */}
          <Text style={[styles.inputLabel, { marginTop: 12 }]}>
            Mô tả chi tiết câu hỏi & Tình huống cụ thể
          </Text>
          <TextInput
            style={styles.textArea}
            placeholder="Vui lòng nêu rõ các thắc mắc, số liệu hoặc bối cảnh cần hỗ trợ để chuyên gia chuẩn bị tài liệu trước phiên tư vấn..."
            placeholderTextColor="#999999"
            value={problemDescription}
            onChangeText={setProblemDescription}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
        </View>

        {/* ── 5. DRY-RUN PREVIEW LIVE ESTIMATE CARD ── */}
        <View style={styles.previewCard}>
          <View style={styles.previewCardHeader}>
            <Ionicons name="calculator-outline" size={18} color={theme.colors.gold} />
            <Text style={styles.previewCardTitle}>Tóm tắt đặt lịch & Phí dự kiến</Text>
          </View>

          {previewLoading ? (
            <View style={styles.previewLoadingBox}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={styles.previewLoadingText}>Đang kiểm tra tính hợp lệ & tính phí...</Text>
            </View>
          ) : previewError ? (
            <View style={styles.previewErrorBox}>
              <Ionicons name="warning-outline" size={18} color={theme.colors.error} />
              <Text style={styles.previewErrorText}>{previewError}</Text>
            </View>
          ) : previewData ? (
            <View style={styles.previewBody}>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Chuyên gia:</Text>
                <Text style={styles.previewValueBold}>{previewData.expertFullName}</Text>
              </View>

              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Khung giờ:</Text>
                <Text style={styles.previewValue}>
                  {formatVietnameseDate(previewData.slotDate)} (
                  {formatTimeRange(previewData.startTime, previewData.endTime)})
                </Text>
              </View>

              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Hình thức:</Text>
                <Text style={styles.previewValue}>
                  {formatSessionType(previewData.sessionType).fullLabel ||
                    formatSessionType(previewData.sessionType).label}
                </Text>
              </View>

              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Thời lượng phiên:</Text>
                <Text style={styles.previewValueBold}>{previewData.durationMinutes} phút</Text>
              </View>

              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Biểu phí niêm yết:</Text>
                <Text style={styles.previewValue}>
                  {formatVnd(previewData.totalFee)} / gói {previewData.durationMinutes} phút
                </Text>
              </View>

              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Chủ đề:</Text>
                <Text style={styles.previewValue}>{previewData.specializationName}</Text>
              </View>

              <View style={styles.previewDivider} />

              <View style={styles.previewFeeRow}>
                <Text style={styles.previewFeeLabel}>Tổng chi phí phiên tư vấn:</Text>
                <Text style={styles.previewFeeValue}>{formatVnd(previewData.totalFee)}</Text>
              </View>
            </View>
          ) : null}
        </View>

        {/* ── 7. SUBMIT BUTTON ── */}
        <TouchableOpacity
          style={[
            styles.submitBtn,
            (submitting || Boolean(previewError) || (previewData && !previewData.isValid)) &&
              styles.submitBtnDisabled,
          ]}
          onPress={handleSubmitBooking}
          disabled={submitting || Boolean(previewError)}
          accessibilityRole="button"
          accessibilityLabel="Xác nhận đặt lịch tư vấn"
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="shield-checkmark" size={18} color="#FFFFFF" />
              <Text style={styles.submitBtnText}>Xác nhận đặt lịch tư vấn</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* ── MODAL CHỌN HÌNH THỨC DỊCH VỤ ── */}
      <Modal
        visible={slotSessionModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSlotSessionModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.dropdownModalOverlay}
          activeOpacity={1}
          onPress={() => setSlotSessionModalVisible(false)}
        >
          <View style={styles.dropdownModalCard}>
            <View style={styles.dropdownModalHeader}>
              <Text style={styles.dropdownModalTitle}>Chọn hình thức tư vấn</Text>
              <TouchableOpacity onPress={() => setSlotSessionModalVisible(false)}>
                <Ionicons name="close" size={20} color="#666666" />
              </TouchableOpacity>
            </View>
            {Array.from(
              new Set([
                ...configuredSessionTypes,
                ...dynamicServicePackages.map((p) => p.sessionType),
              ])
            ).map((type) => {
              const sInfo = formatSessionType(type);
              const selected = selectedSessionType === type;
              return (
                <TouchableOpacity
                  key={type}
                  style={[styles.dropdownOptionItem, selected && styles.dropdownOptionItemActive]}
                  onPress={() => {
                    handleSelectSessionType(type);
                    setSlotSessionModalVisible(false);
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons
                      name={sInfo.icon as any}
                      size={16}
                      color={selected ? theme.colors.primary : '#555555'}
                    />
                    <Text style={[styles.dropdownOptionText, selected && styles.dropdownOptionTextActive]}>
                      {sInfo.fullLabel || sInfo.label}
                    </Text>
                  </View>
                  {selected && <Ionicons name="checkmark-circle" size={18} color={theme.colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── MODAL LỌC BUỔI TRONG NGÀY ── */}
      <Modal
        visible={slotPeriodModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSlotPeriodModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.dropdownModalOverlay}
          activeOpacity={1}
          onPress={() => setSlotPeriodModalVisible(false)}
        >
          <View style={styles.dropdownModalCard}>
            <View style={styles.dropdownModalHeader}>
              <Text style={styles.dropdownModalTitle}>Lọc theo buổi trong ngày</Text>
              <TouchableOpacity onPress={() => setSlotPeriodModalVisible(false)}>
                <Ionicons name="close" size={20} color="#666666" />
              </TouchableOpacity>
            </View>
            {([
              { key: 'ALL', label: 'Tất cả buổi trong ngày' },
              { key: 'MORNING', label: 'Buổi sáng (Trước 12:00)' },
              { key: 'AFTERNOON', label: 'Buổi chiều (12:00 - 18:00)' },
              { key: 'EVENING', label: 'Buổi tối (Sau 18:00)' },
            ] as const).map((opt) => {
              const selected = slotPeriodFilter === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.dropdownOptionItem, selected && styles.dropdownOptionItemActive]}
                  onPress={() => {
                    setSlotPeriodFilter(opt.key);
                    setSlotPeriodModalVisible(false);
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

      {/* ── MODAL CHỌN LĨNH VỰC CHUYÊN MÔN ── */}
      <Modal
        visible={specModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSpecModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.dropdownModalOverlay}
          activeOpacity={1}
          onPress={() => setSpecModalVisible(false)}
        >
          <View style={styles.dropdownModalCard}>
            <View style={styles.dropdownModalHeader}>
              <Text style={styles.dropdownModalTitle}>Chọn lĩnh vực chuyên môn</Text>
              <TouchableOpacity onPress={() => setSpecModalVisible(false)}>
                <Ionicons name="close" size={20} color="#666666" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 340 }}>
              {specializations.map((spec) => {
                const selected = selectedSpecId === spec.id;
                return (
                  <TouchableOpacity
                    key={spec.id}
                    style={[styles.dropdownOptionItem, selected && styles.dropdownOptionItemActive]}
                    onPress={() => {
                      setSelectedSpecId(spec.id);
                      setSpecModalVisible(false);
                    }}
                  >
                    <Text style={[styles.dropdownOptionText, selected && styles.dropdownOptionTextActive]}>
                      {spec.name}
                    </Text>
                    {selected && <Ionicons name="checkmark-circle" size={18} color={theme.colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <Dialog
        visible={Boolean(dialog)}
        title={dialog?.title || ''}
        message={dialog?.message || ''}
        primaryLabel={dialog?.primaryLabel || 'Đã hiểu'}
        onPrimary={dialog?.onPrimary || (() => setDialog(null))}
        secondaryLabel={dialog?.secondaryLabel}
        onSecondary={dialog?.onSecondary}
        destructive={dialog?.destructive}
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

  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },

  // Expert Summary Card
  expertSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  expertSummaryAvatarWrap: {
    marginRight: 12,
  },
  expertSummaryAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  expertSummaryAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#8B1E1E1F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  expertSummaryAvatarLetter: {
    fontFamily: fonts.serifBold,
    fontSize: 18,
    color: theme.colors.primary,
  },
  expertSummaryInfo: {
    flex: 1,
  },
  expertSummaryName: {
    fontFamily: fonts.serifBold,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  expertSummaryJob: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: theme.colors.primaryDark,
    marginTop: 1,
  },
  expertSummaryRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 3,
  },
  expertSummaryRating: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: '#D97706',
  },
  expertSummaryReviews: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#777777',
  },

  // Form Section
  formSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 14,
    color: theme.colors.primary,
  },
  requiredMark: {
    fontFamily: fonts.bodyBold,
    color: theme.colors.error,
    fontSize: 14,
  },
  sectionCounter: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginLeft: 'auto',
  },
  sectionHint: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 2,
    marginBottom: 10,
  },

  emptySlotWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: 10,
    borderRadius: 8,
    gap: 6,
  },
  emptySlotWarningText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#B45309',
  },

  // Service Types List (Full-width vertical cards)
  serviceTypesList: {
    gap: 8,
    marginTop: 4,
    marginBottom: 6,
  },
  serviceCardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAF8F3',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#EFE8DB',
  },
  serviceCardItemActive: {
    borderColor: theme.colors.primary,
    backgroundColor: '#FDF7F7',
  },
  serviceCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  serviceIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FAF5EE',
    borderWidth: 1,
    borderColor: '#E8DEC8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceIconWrapActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  serviceInfoCol: {
    flex: 1,
  },
  serviceName: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: '#3A2E25',
  },
  serviceNameActive: {
    color: theme.colors.primary,
  },
  serviceDesc: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#786F66',
    marginTop: 2,
  },
  serviceTiersText: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: '#92400E',
    marginTop: 3,
  },
  serviceCardRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  servicePriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  servicePrice: {
    fontFamily: fonts.serifBold,
    fontSize: 13,
    color: theme.colors.primaryDark,
    fontVariant: ['tabular-nums'],
  },
  selectedDurationHint: {
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    color: theme.colors.primary,
    marginTop: 1,
  },
  serviceSlotBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-end',
  },
  serviceSlotBadgeEmpty: {
    backgroundColor: '#F3F4F6',
  },
  serviceSlotBadgeText: {
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    color: '#065F46',
  },
  serviceSlotBadgeTextEmpty: {
    color: '#9CA3AF',
  },

  // Date Ribbon & Slot Grid
  dateRibbon: {
    gap: 8,
    paddingVertical: 6,
  },
  dateCard: {
    width: 68,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#FAF7F0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E6DECE',
  },
  dateCardSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  dateDayName: {
    fontFamily: fonts.bodySemi,
    fontSize: 11,
    color: '#666666',
  },
  dateDayNum: {
    fontFamily: fonts.serifBold,
    fontSize: 18,
    color: theme.colors.textPrimary,
    marginVertical: 1,
  },
  dateMonth: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: '#888888',
  },
  dateTextActive: {
    color: '#FFFFFF',
  },

  slotGridWrap: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3EFE6',
  },
  slotGridTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  noSlotText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 10,
  },
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slotChip: {
    backgroundColor: '#FAF7F0',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#E6DECE',
    minWidth: '47%',
    flex: 1,
  },
  slotChipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  slotTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  slotSessionText: {
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    color: '#555555',
  },
  slotTimeText: {
    fontFamily: fonts.serifBold,
    fontSize: 13,
    color: theme.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  slotDurationRow: {
    marginTop: 2,
  },
  slotDurationText: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: '#666666',
  },
  slotTextActive: {
    color: '#FFFFFF',
  },

  // Compact Horizontal Dropdown Filter Row
  filterDropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 8,
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
    gap: 6,
  },
  dropdownFilterBtnActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  dropdownFilterBtnText: {
    flex: 1,
    fontFamily: fonts.bodySemi,
    fontSize: 12,
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
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  dropdownOptionTextActive: {
    fontFamily: fonts.bodyBold,
    color: theme.colors.primary,
  },

  // Inputs
  inputLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: theme.colors.inputBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: fonts.body,
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  textArea: {
    backgroundColor: theme.colors.inputBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.body,
    fontSize: 13,
    color: theme.colors.textPrimary,
    minHeight: 90,
  },

  // Upload buttons
  uploadBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  uploadPickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAF5EE',
    borderWidth: 1,
    borderColor: theme.colors.goldLight,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 6,
  },
  uploadPickBtnText: {
    fontFamily: fonts.bodySemi,
    fontSize: 11,
    color: theme.colors.primary,
  },

  attachmentsListWrap: {
    marginTop: 6,
    gap: 6,
  },
  totalSizeRow: {
    marginBottom: 4,
  },
  totalSizeText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  boldText: {
    fontFamily: fonts.bodyBold,
    color: theme.colors.textPrimary,
  },
  fileChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9F6F0',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#EAE2D2',
  },
  fileChipInfo: {
    flex: 1,
  },
  fileChipName: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: theme.colors.textPrimary,
  },
  fileChipSize: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: '#888888',
  },
  removeFileBtn: {
    padding: 4,
  },

  // Preview Card
  previewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: theme.colors.goldLight,
    ...theme.shadows.card,
  },
  previewCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  previewCardTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 14,
    color: theme.colors.primary,
  },
  previewLoadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  previewLoadingText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  previewErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    padding: 10,
    borderRadius: 6,
    gap: 6,
  },
  previewErrorText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 12,
    color: theme.colors.error,
  },
  previewBody: {
    gap: 6,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  previewLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#666666',
    flexShrink: 0,
  },
  previewValue: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: theme.colors.textPrimary,
    flex: 1,
    textAlign: 'right',
    flexWrap: 'wrap',
  },
  previewValueBold: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: theme.colors.primary,
    flex: 1,
    textAlign: 'right',
    flexWrap: 'wrap',
  },
  previewDivider: {
    height: 1,
    backgroundColor: '#EAE3D5',
    marginVertical: 4,
  },
  previewFeeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewFeeLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  previewFeeValue: {
    fontFamily: fonts.serifBold,
    fontSize: 16,
    color: theme.colors.primary,
    fontVariant: ['tabular-nums'],
  },


  // Submit
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
    ...theme.shadows.button,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: '#FFFFFF',
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
});
