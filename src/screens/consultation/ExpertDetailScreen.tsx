import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  FlatList,
  Modal,
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
import { consultationApi } from '../../api/consultationApi';
import { getLocalApiBaseUrl } from '../../constants/config';
import type {
  ExpertDetailResponse,
  ExpertAvailableSlotDto,
  ExpertPublicReviewDto,
  ExpertPublicCertificateDto,
  SessionType,
} from '../../types/consultation';
import {
  formatVnd,
  formatSessionType,
  formatVietnameseDate,
  formatTimeRange,
  isValidAvatarUrl,
} from '../../types/consultation';

export const ExpertDetailScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'ExpertDetail'>>();
  const expertProfileId = route.params.expertProfileId;

  const [expert, setExpert] = useState<ExpertDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Slots & booking state
  const [availableSlots, setAvailableSlots] = useState<ExpertAvailableSlotDto[]>([]);
  const [configuredSessionTypes, setConfiguredSessionTypes] = useState<SessionType[]>(['ONLINE_MEETING']);
  const [selectedSessionType, setSelectedSessionType] = useState<SessionType>('ONLINE_MEETING');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<ExpertAvailableSlotDto | null>(null);
  const [slotPeriodFilter, setSlotPeriodFilter] = useState<'ALL' | 'MORNING' | 'AFTERNOON' | 'EVENING'>('ALL');
  const [slotSessionModalVisible, setSlotSessionModalVisible] = useState(false);
  const [slotPeriodModalVisible, setSlotPeriodModalVisible] = useState(false);

  // Reviews state
  const [reviews, setReviews] = useState<ExpertPublicReviewDto[]>([]);
  const [selectedRatingFilter, setSelectedRatingFilter] = useState<number | null>(null);
  const [reviewSort, setReviewSort] = useState<'NEWEST' | 'HIGHEST' | 'LOWEST'>('NEWEST');
  const [reviewRatingModalVisible, setReviewRatingModalVisible] = useState(false);
  const [reviewSortModalVisible, setReviewSortModalVisible] = useState(false);
  const [loadingReviews, setLoadingReviews] = useState(false);

  // Active sub-tab: 'INFO' | 'SCHEDULE' | 'REVIEWS'
  const [activeTab, setActiveTab] = useState<'INFO' | 'SCHEDULE' | 'REVIEWS'>('INFO');

  // Certificate viewer modal state
  const [selectedCert, setSelectedCert] = useState<ExpertPublicCertificateDto | null>(null);
  const [certModalVisible, setCertModalVisible] = useState(false);
  const [dialog, setDialog] = useState<{
    title: string;
    message: string;
    primaryLabel?: string;
    onPrimary?: () => void;
  } | null>(null);

  const resolveFileUrl = (url?: string | null) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const baseUrl = getLocalApiBaseUrl();
    const cleanPath = url.startsWith('/') ? url : `/${url}`;
    return `${baseUrl}${cleanPath}`;
  };

  const isImageFile = (url?: string | null) => {
    if (!url) return false;
    const clean = url.split('?')[0].toLowerCase();
    return (
      clean.endsWith('.jpg') ||
      clean.endsWith('.jpeg') ||
      clean.endsWith('.png') ||
      clean.endsWith('.webp') ||
      clean.endsWith('.gif')
    );
  };

  const handleOpenCertificate = (cert: ExpertPublicCertificateDto) => {
    setSelectedCert(cert);
    setCertModalVisible(true);
  };

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [detail, slots, feeConfigs] = await Promise.all([
        consultationApi.getExpertDetail(expertProfileId),
        consultationApi.getAvailableSlotsForBooking(expertProfileId, undefined, 14),
        consultationApi.getConsultationFeeConfigs({ isActive: true }).catch(() => []),
      ]);
      setExpert(detail);
      setAvailableSlots(slots);
      setReviews(detail.recentReviews || []);

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

      // Auto-select session type that is configured by Admin or has available slots
      let initialType: SessionType = activeAdminTypes[0] || 'ONLINE_MEETING';
      const activeFeePkg = (detail.feePackages || []).find((p) =>
        activeAdminTypes.includes(p.sessionType)
      );
      if (activeFeePkg) {
        initialType = activeFeePkg.sessionType;
      } else if (slots.length > 0) {
        initialType = slots[0].sessionType;
      }
      setSelectedSessionType(initialType);

      const slotsForType = slots.filter((s) => s.sessionType === initialType);
      if (slotsForType.length > 0) {
        setSelectedDate(slotsForType[0].slotDate);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Không thể tải hồ sơ chuyên gia.');
    } finally {
      setLoading(false);
    }
  }, [expertProfileId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  // Load reviews by star filter
  const fetchReviewsByRating = async (rating: number | null) => {
    setSelectedRatingFilter(rating);
    setLoadingReviews(true);
    try {
      const paged = await consultationApi.getExpertReviews(expertProfileId, {
        page: 1,
        size: 15,
        rating: rating || undefined,
      });
      setReviews(paged.items);
    } catch (e) {
      console.warn('Filter reviews error:', e);
    } finally {
      setLoadingReviews(false);
    }
  };

  // Switch session type: reset selected slot and update date
  const handleSelectSessionType = (type: SessionType) => {
    setSelectedSessionType(type);
    setSelectedSlot(null);
    const slotsForType = availableSlots.filter((s) => s.sessionType === type);
    const datesForType = Array.from(new Set(slotsForType.map((s) => s.slotDate))).sort();
    if (datesForType.length > 0) {
      if (!selectedDate || !datesForType.includes(selectedDate)) {
        setSelectedDate(datesForType[0]);
      }
    } else {
      setSelectedDate(null);
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
            ? 'Hỏi đáp & trao đổi hồ sơ chứng từ qua tin nhắn'
            : 'Tư vấn trực tiếp qua đường truyền thoại',
      };
    });
  }, [expert, availableSlots, configuredSessionTypes]);

  // Slots filtered by chosen service type
  const slotsForSelectedSession = useMemo(() => {
    return availableSlots.filter((s) => s.sessionType === selectedSessionType);
  }, [availableSlots, selectedSessionType]);

  // Unique dates for this service type
  const uniqueDatesForSession = useMemo(() => {
    const dates = Array.from(new Set(slotsForSelectedSession.map((s) => s.slotDate)));
    return dates.sort();
  }, [slotsForSelectedSession]);

  // Filter slots for currently selected date, service type & period of day
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

  const sortedReviews = useMemo(() => {
    const list = [...reviews];
    if (reviewSort === 'HIGHEST') {
      return list.sort((a, b) => b.rating - a.rating);
    }
    if (reviewSort === 'LOWEST') {
      return list.sort((a, b) => a.rating - b.rating);
    }
    return list.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [reviews, reviewSort]);

  // Proceed to booking screen
  const handleProceedToBooking = () => {
    if (!expert) return;
    navigation.navigate('BookingCreate', {
      expertProfileId: expert.id,
      initialSlotId: selectedSlot?.id,
    });
  };

  const handleBack = useCallback(() => {
    const state = navigation.getState();
    const routes = state?.routes || [];
    const prevRoute = routes.length >= 2 ? routes[routes.length - 2] : null;

    if (prevRoute && ['BookingDetail', 'PaymentResult', 'BookingCreate'].includes(prevRoute.name)) {
      navigation.navigate('ExpertList');
      return;
    }

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

  if (loading) {
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
          <Text style={styles.headerTitle}>Hồ sơ chuyên gia</Text>
          <View style={{ width: 38 }} />
        </View>
        <GoldDoubleRule />
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Đang tải hồ sơ chuyên gia...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !expert) {
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
          <Text style={styles.headerTitle}>Hồ sơ chuyên gia</Text>
          <View style={{ width: 38 }} />
        </View>
        <GoldDoubleRule />
        <View style={styles.centerLoading}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.colors.error} />
          <Text style={styles.errorTitle}>Lỗi nạp hồ sơ</Text>
          <Text style={styles.errorMsg}>{error || 'Không tìm thấy thông tin.'}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchDetail}>
            <Text style={styles.retryBtnText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
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
        <Text style={styles.headerTitle} numberOfLines={1}>
          {expert.fullName}
        </Text>
        <TouchableOpacity
          style={styles.headerRightBtn}
          onPress={() => navigation.navigate('MyBookings', {})}
          accessibilityRole="button"
          accessibilityLabel="Lịch hẹn"
        >
          <Ionicons name="calendar-outline" size={22} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>
      <GoldDoubleRule />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* ── HERO PROFILE CARD ── */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroAvatarWrap}>
              {isValidAvatarUrl(expert.avatarUrl) ? (
                <Image source={{ uri: expert.avatarUrl! }} style={styles.heroAvatar} />
              ) : (
                <View style={styles.heroAvatarPlaceholder}>
                  <Text style={styles.heroAvatarLetter}>
                    {expert.fullName.trim().charAt(expert.fullName.trim().length - 1)}
                  </Text>
                </View>
              )}
              <View style={styles.heroVerifiedBadge}>
                <Ionicons name="shield-checkmark" size={14} color="#FFFFFF" />
              </View>
            </View>

            <View style={styles.heroInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.heroName}>{expert.fullName}</Text>
              </View>
              <Text style={styles.heroJobTitle}>{expert.jobTitle || 'Chuyên gia tư vấn thuế'}</Text>
              {expert.companyName ? (
                <Text style={styles.heroCompany}>
                  <Ionicons name="business-outline" size={13} color="#666666" /> {expert.companyName}
                </Text>
              ) : null}

              {/* Status pill */}
              <View style={styles.statusPill}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Đang nhận tư vấn</Text>
              </View>
            </View>
          </View>

          {/* Stats bar */}
          <View style={styles.statsBar}>
            <View style={styles.statItem}>
              <View style={styles.statScoreRow}>
                <Ionicons name="star" size={16} color="#F59E0B" />
                <Text style={styles.statScore}>
                  {expert.rating > 0 ? expert.rating.toFixed(1) : '5.0'}
                </Text>
              </View>
              <Text style={styles.statLabel}>{expert.totalReviews} đánh giá</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{expert.yearsOfExperience} năm</Text>
              <Text style={styles.statLabel}>Kinh nghiệm</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{expert.completedConsultationsCount}</Text>
              <Text style={styles.statLabel}>Ca hoàn thành</Text>
            </View>
          </View>
        </View>

        {/* ── SEGMENT TABS ── */}
        <View style={styles.segmentBar}>
          <TouchableOpacity
            style={[styles.segmentTab, activeTab === 'INFO' && styles.segmentTabActive]}
            onPress={() => setActiveTab('INFO')}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'INFO' }}
          >
            <Ionicons
              name="person-outline"
              size={13.5}
              color={activeTab === 'INFO' ? theme.colors.primary : '#666666'}
            />
            <Text
              style={[
                styles.segmentTabText,
                activeTab === 'INFO' && styles.segmentTabTextActive,
              ]}
              numberOfLines={1}
            >
              Giới thiệu
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentTab, activeTab === 'SCHEDULE' && styles.segmentTabActive]}
            onPress={() => setActiveTab('SCHEDULE')}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'SCHEDULE' }}
          >
            <Ionicons
              name="calendar-outline"
              size={13.5}
              color={activeTab === 'SCHEDULE' ? theme.colors.primary : '#666666'}
            />
            <Text
              style={[
                styles.segmentTabText,
                activeTab === 'SCHEDULE' && styles.segmentTabTextActive,
              ]}
              numberOfLines={1}
            >
              Lịch hẹn ({availableSlots.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentTab, activeTab === 'REVIEWS' && styles.segmentTabActive]}
            onPress={() => setActiveTab('REVIEWS')}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'REVIEWS' }}
          >
            <Ionicons
              name="star-outline"
              size={13.5}
              color={activeTab === 'REVIEWS' ? theme.colors.primary : '#666666'}
            />
            <Text
              style={[
                styles.segmentTabText,
                activeTab === 'REVIEWS' && styles.segmentTabTextActive,
              ]}
              numberOfLines={1}
            >
              Đánh giá ({expert.totalReviews})
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── TAB 1: THÔNG TIN & CHỨNG CHỈ & BIỂU PHÍ ── */}
        {activeTab === 'INFO' && (
          <View style={styles.tabSection}>
            {/* Giới thiệu tóm tắt */}
            {expert.bio ? (
              <View style={styles.cardSection}>
                <Text style={styles.sectionHeaderTitle}>Giới thiệu chuyên môn</Text>
                <Text style={styles.bioText}>{expert.bio}</Text>
              </View>
            ) : null}

            {/* Lĩnh vực tư vấn chuyên môn */}
            {expert.specializationNames && expert.specializationNames.length > 0 && (
              <View style={styles.cardSection}>
                <Text style={styles.sectionHeaderTitle}>Lĩnh vực chuyên môn</Text>
                <View style={styles.specChipsWrap}>
                  {expert.specializationNames.map((s, idx) => (
                    <View key={idx} style={styles.detailSpecChip}>
                      <Ionicons name="checkmark-circle" size={14} color={theme.colors.gold} />
                      <Text style={styles.detailSpecText} numberOfLines={2}>
                        {s}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Chứng chỉ hành nghề đã xác minh (BR-03: Che mờ mã định danh) */}
            {expert.verifiedCertificates && expert.verifiedCertificates.length > 0 && (
              <View style={styles.cardSection}>
                <View style={styles.sectionHeaderRow}>
                  <Ionicons name="ribbon-outline" size={18} color={theme.colors.gold} />
                  <Text style={styles.sectionHeaderTitle}>Chứng chỉ hành nghề đã xác minh</Text>
                </View>
                <Text style={styles.sectionSubtitle}>
                  Đã được ban quản trị TaxKeep kiểm tra và xác thực tính hợp pháp
                </Text>

                {expert.verifiedCertificates.map((cert) => (
                  <TouchableOpacity
                    key={cert.id}
                    style={styles.certCard}
                    activeOpacity={0.82}
                    onPress={() => handleOpenCertificate(cert)}
                    accessibilityRole="button"
                    accessibilityLabel={`Xem chứng chỉ ${cert.certificateName}`}
                  >
                    <View style={styles.certIconWrap}>
                      <Ionicons name="document-text" size={20} color={theme.colors.primary} />
                    </View>
                    <View style={styles.certInfo}>
                      <Text style={styles.certName} numberOfLines={2}>
                        {cert.certificateName}
                      </Text>
                      <Text style={styles.certAuthority}>
                        Cơ quan cấp: {cert.issuingAuthority}
                        {cert.yearIssued ? ` (${cert.yearIssued})` : ''}
                      </Text>
                      <Text style={styles.certNumber}>
                        Mã hiệu: <Text style={styles.certNumberCode}>{cert.maskedCertificateNumber}</Text>
                      </Text>
                    </View>
                    <View style={styles.certActionCol}>
                      <View style={styles.certVerifiedTag}>
                        <Ionicons name="checkmark-done" size={11} color="#059669" />
                        <Text style={styles.certVerifiedText}>Hợp lệ</Text>
                      </View>
                      <View style={styles.viewFileBadge}>
                        <Ionicons name="eye-outline" size={12} color={theme.colors.primary} />
                        <Text style={styles.viewFileBadgeText}>Xem tệp</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Bảng biểu phí tư vấn niêm yết */}
            {expert.feePackages && expert.feePackages.length > 0 && (
              <View style={styles.cardSection}>
                <View style={styles.sectionHeaderRow}>
                  <Ionicons name="pricetags-outline" size={18} color={theme.colors.primary} />
                  <Text style={styles.sectionHeaderTitle}>Gói biểu phí dịch vụ niêm yết</Text>
                </View>
                <Text style={styles.sectionSubtitle}>
                  Mức phí tính cho từng hình thức và thời lượng phiên tư vấn
                </Text>

                {expert.feePackages.map((pkg) => {
                  const sInfo = formatSessionType(pkg.sessionType);
                  return (
                    <View key={pkg.id} style={styles.feeCard}>
                      <View style={styles.feeCardLeft}>
                        <View style={[styles.sessionIconBox, { backgroundColor: `${sInfo.color}18` }]}>
                          <Ionicons name={sInfo.icon as any} size={20} color={sInfo.color} />
                        </View>
                        <View>
                          <Text style={styles.sessionName}>{sInfo.label}</Text>
                          <Text style={styles.sessionDuration}>
                            <Ionicons name="time-outline" size={12} color="#888888" />{' '}
                            {pkg.durationMinutes} phút / phiên
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.feePrice}>{formatVnd(pkg.fee)}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* ── TAB 2: LỊCH LÀM VIỆC & CHỌN KHUNG GIỜ ── */}
        {activeTab === 'SCHEDULE' && (
          <View style={styles.tabSection}>
            {/* 1. CHỌN HÌNH THỨC DỊCH VỤ */}
            <View style={styles.cardSection}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="apps-outline" size={18} color={theme.colors.primary} />
                <Text style={styles.sectionHeaderTitle}>1. Chọn hình thức dịch vụ</Text>
              </View>
              <Text style={styles.sectionSubtitle}>
                Vui lòng chọn hình thức bạn muốn tư vấn trước khi chọn lịch làm việc
              </Text>

              {dynamicServicePackages.length === 0 ? (
                <View style={styles.emptySlotBox}>
                  <Ionicons name="pricetags-outline" size={36} color="#CCCCCC" />
                  <Text style={styles.emptySlotTitle}>Chưa có dịch vụ niêm yết</Text>
                  <Text style={styles.emptySlotDesc}>
                    Chuyên gia hiện chưa niêm yết gói biểu phí hoặc mở khung giờ tư vấn nào.
                  </Text>
                </View>
              ) : (
                  <View style={styles.serviceTypesList}>
                    {dynamicServicePackages.map((srv) => {
                      const isSelected = selectedSessionType === srv.sessionType;

                      return (
                        <TouchableOpacity
                          key={`exp_srv_${srv.sessionType}`}
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
                                {srv.feeDisplay}
                              </Text>
                              <Ionicons
                                name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                                size={20}
                                color={isSelected ? theme.colors.primary : '#C4B5A5'}
                                style={{ marginLeft: 6 }}
                              />
                            </View>
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

            {/* 2. CHỌN NGÀY VÀ KHUNG GIỜ CỦA HÌNH THỨC ĐÃ CHỌN */}
            <View style={styles.cardSection}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="calendar-outline" size={18} color={theme.colors.primary} />
                <Text style={styles.sectionHeaderTitle}>
                  2. Lịch tư vấn:{' '}
                  {dynamicServicePackages.find((s) => s.sessionType === selectedSessionType)?.label ||
                    formatSessionType(selectedSessionType).fullLabel ||
                    formatSessionType(selectedSessionType).label}
                </Text>
              </View>
              <Text style={styles.sectionSubtitle}>
                Chỉ hiển thị các khung giờ còn trống và thỏa mãn quy định đặt trước tối thiểu 4 giờ
              </Text>

              {/* Compact Horizontal Dropdown Filter Row for Schedule */}
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
                <View style={styles.emptySlotBox}>
                  <Ionicons name="calendar-outline" size={36} color="#CCCCCC" />
                  <Text style={styles.emptySlotTitle}>
                    Chưa có lịch cho{' '}
                    {dynamicServicePackages.find((s) => s.sessionType === selectedSessionType)?.label ||
                      formatSessionType(selectedSessionType).fullLabel ||
                      formatSessionType(selectedSessionType).label}
                  </Text>
                  <Text style={styles.emptySlotDesc}>
                    Chuyên gia hiện chưa mở khung giờ cho hình thức này. Bạn có thể chọn hình thức dịch vụ khác ở bước 1.
                  </Text>
                </View>
              ) : (
                <>
                  {/* Date Selector Ribbon */}
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
                          onPress={() => {
                            setSelectedDate(dateStr);
                            setSelectedSlot(null);
                          }}
                        >
                          <Text style={[styles.dateDayName, isSelected && styles.dateTextActive]}>
                            {dayName}
                          </Text>
                          <Text style={[styles.dateDayNum, isSelected && styles.dateTextActive]}>
                            {dayNum}
                          </Text>
                          <Text style={[styles.dateMonth, isSelected && styles.dateTextActive]}>
                            Tháng {monthNum}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  {/* Slot chips for the chosen date */}
                  <View style={styles.slotGridWrap}>
                    <Text style={styles.slotGridTitle}>
                      Khung giờ ngày {formatVietnameseDate(selectedDate || '')}
                    </Text>

                    {slotsForSelectedDate.length === 0 ? (
                      <Text style={styles.noSlotText}>Không có khung giờ rảnh vào ngày này.</Text>
                    ) : (
                      <View style={styles.slotGrid}>
                        {slotsForSelectedDate.map((slot) => {
                          const isSelected = selectedSlot?.id === slot.id;
                          const sInfo = formatSessionType(slot.sessionType);

                          return (
                            <TouchableOpacity
                              key={slot.id}
                              style={[styles.slotChip, isSelected && styles.slotChipSelected]}
                              onPress={() => setSelectedSlot(isSelected ? null : slot)}
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
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>
                </>
              )}
            </View>
          </View>
        )}

        {/* ── TAB 3: ĐÁNH GIÁ TỪ KHÁCH HÀNG ── */}
        {activeTab === 'REVIEWS' && (
          <View style={styles.tabSection}>
            <View style={styles.cardSection}>
              <View style={styles.ratingOverviewRow}>
                <View style={styles.bigScoreBox}>
                  <Text style={styles.bigScoreNumber}>
                    {expert.rating > 0 ? expert.rating.toFixed(1) : '5.0'}
                  </Text>
                  <View style={styles.starRow}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Ionicons
                        key={s}
                        name={s <= Math.round(expert.rating || 5) ? 'star' : 'star-outline'}
                        size={16}
                        color="#F59E0B"
                      />
                    ))}
                  </View>
                  <Text style={styles.bigScoreTotal}>{expert.totalReviews} lượt nhận xét</Text>
                </View>
              </View>

              {/* Compact Horizontal Dropdown Filter Row for Reviews */}
              <View style={styles.filterDropdownRow}>
                <TouchableOpacity
                  style={[
                    styles.dropdownFilterBtn,
                    selectedRatingFilter !== null && styles.dropdownFilterBtnActive,
                  ]}
                  onPress={() => setReviewRatingModalVisible(true)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Lọc theo mức sao đánh giá"
                >
                  <Ionicons
                    name="star"
                    size={13}
                    color={selectedRatingFilter !== null ? '#FFFFFF' : '#F59E0B'}
                  />
                  <Text
                    style={[
                      styles.dropdownFilterBtnText,
                      selectedRatingFilter !== null && styles.dropdownFilterBtnTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {selectedRatingFilter !== null ? `${selectedRatingFilter} sao` : 'Tất cả đánh giá'}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={12}
                    color={selectedRatingFilter !== null ? '#FFFFFF' : theme.colors.textSecondary}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.dropdownFilterBtn,
                    reviewSort !== 'NEWEST' && styles.dropdownFilterBtnActive,
                  ]}
                  onPress={() => setReviewSortModalVisible(true)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Sắp xếp đánh giá"
                >
                  <Ionicons
                    name="swap-vertical-outline"
                    size={13}
                    color={reviewSort !== 'NEWEST' ? '#FFFFFF' : theme.colors.primary}
                  />
                  <Text
                    style={[
                      styles.dropdownFilterBtnText,
                      reviewSort !== 'NEWEST' && styles.dropdownFilterBtnTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {reviewSort === 'HIGHEST'
                      ? 'Điểm cao nhất'
                      : reviewSort === 'LOWEST'
                      ? 'Điểm thấp nhất'
                      : 'Mới nhất'}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={12}
                    color={reviewSort !== 'NEWEST' ? '#FFFFFF' : theme.colors.textSecondary}
                  />
                </TouchableOpacity>

                {(selectedRatingFilter !== null || reviewSort !== 'NEWEST') && (
                  <TouchableOpacity
                    style={styles.filterResetIconBtn}
                    onPress={() => {
                      fetchReviewsByRating(null);
                      setReviewSort('NEWEST');
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Đặt lại lọc đánh giá"
                  >
                    <Ionicons name="refresh" size={14} color={theme.colors.primary} />
                  </TouchableOpacity>
                )}
              </View>

              {loadingReviews ? (
                <View style={styles.reviewLoading}>
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                </View>
              ) : sortedReviews.length === 0 ? (
                <View style={styles.emptyReviews}>
                  <Ionicons name="chatbox-ellipses-outline" size={32} color="#CCCCCC" />
                  <Text style={styles.emptyReviewsText}>Chưa có nhận xét nào trong mục này.</Text>
                </View>
              ) : (
                <View style={styles.reviewsList}>
                  {sortedReviews.map((r) => (
                    <View key={r.id} style={styles.reviewCard}>
                      <View style={styles.reviewHeader}>
                        <View style={styles.reviewerAvatar}>
                          <Text style={styles.reviewerAvatarLetter}>
                            {r.reviewerDisplayName.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.reviewerMeta}>
                          <Text style={styles.reviewerName}>{r.reviewerDisplayName}</Text>
                          <Text style={styles.reviewDate}>
                            {formatVietnameseDate(r.createdAt.split('T')[0])}
                          </Text>
                        </View>
                        <View style={styles.reviewStars}>
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Ionicons
                              key={s}
                              name={s <= r.rating ? 'star' : 'star-outline'}
                              size={12}
                              color="#F59E0B"
                            />
                          ))}
                        </View>
                      </View>
                      <Text style={styles.reviewComment}>{r.comment}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── STICKY BOTTOM BOOKING ACTION BAR ── */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomFeeInfo}>
          {selectedSlot ? (
            <>
              <Text style={styles.bottomSlotLabel}>
                {formatVietnameseDate(selectedSlot.slotDate)} ({formatTimeRange(selectedSlot.startTime, selectedSlot.endTime)})
              </Text>
              <Text style={styles.bottomSlotStatus}>Khung giờ đã chọn</Text>
            </>
          ) : (
            <>
              <Text style={styles.bottomFeeLabel}>Mức phí tư vấn</Text>
              <Text style={styles.bottomFeeValue}>
                {expert.feePackages && expert.feePackages.length > 0
                  ? `Từ ${formatVnd(Math.min(...expert.feePackages.map((p) => p.fee)))}`
                  : 'Theo quy định'}
              </Text>
            </>
          )}
        </View>

        <TouchableOpacity
          style={styles.bottomBookBtn}
          onPress={handleProceedToBooking}
          accessibilityRole="button"
          accessibilityLabel="Đặt lịch tư vấn"
        >
          <Ionicons name="calendar" size={16} color="#FFFFFF" />
          <Text style={styles.bottomBookBtnText}>
            {selectedSlot ? 'Xác nhận đặt lịch này' : 'Đặt lịch tư vấn'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── MODAL XEM CHI TIẾT & TỆP CHỨNG CHỈ HÀNH NGHỀ ── */}
      <Modal
        visible={certModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCertModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.certModalBox}>
            <View style={styles.certModalHeader}>
              <View style={styles.certModalHeaderLeft}>
                <Ionicons name="ribbon" size={22} color={theme.colors.gold} />
                <Text style={styles.certModalTitle} numberOfLines={1}>
                  Chứng chỉ hành nghề
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setCertModalVisible(false)}
                style={styles.modalCloseBtn}
                accessibilityRole="button"
                accessibilityLabel="Đóng"
              >
                <Ionicons name="close" size={22} color="#666666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.certModalBody} showsVerticalScrollIndicator={false}>
              {selectedCert && (
                <>
                  <Text style={styles.certModalCertName}>{selectedCert.certificateName}</Text>

                  <View style={styles.certDetailRow}>
                    <Text style={styles.certDetailLabel}>Cơ quan cấp:</Text>
                    <Text style={styles.certDetailValue}>{selectedCert.issuingAuthority}</Text>
                  </View>

                  {selectedCert.yearIssued ? (
                    <View style={styles.certDetailRow}>
                      <Text style={styles.certDetailLabel}>Năm cấp:</Text>
                      <Text style={styles.certDetailValue}>{selectedCert.yearIssued}</Text>
                    </View>
                  ) : null}

                  <View style={styles.certDetailRow}>
                    <Text style={styles.certDetailLabel}>Mã số hiệu:</Text>
                    <Text style={styles.certDetailValueBold}>{selectedCert.maskedCertificateNumber}</Text>
                  </View>

                  <View style={styles.certVerifiedBanner}>
                    <Ionicons name="checkmark-circle" size={16} color="#059669" />
                    <Text style={styles.certVerifiedBannerText}>
                      Đã được TaxKeep kiểm tra & xác minh tính hợp pháp
                    </Text>
                  </View>

                  {/* Tệp tin chứng chỉ preview / action */}
                  {selectedCert.fileUrl ? (
                    <View style={styles.certFileSection}>
                      <Text style={styles.certFileSectionTitle}>Tệp hồ sơ chứng chỉ:</Text>

                      {isImageFile(selectedCert.fileUrl) ? (
                        <View style={styles.certImageWrap}>
                          <Image
                            source={{ uri: resolveFileUrl(selectedCert.fileUrl) }}
                            style={styles.certImagePreview}
                            resizeMode="contain"
                          />
                        </View>
                      ) : (
                        <View style={styles.certDocWrap}>
                          <Ionicons name="document-text" size={48} color={theme.colors.primary} />
                          <Text style={styles.certDocText}>Tệp tin văn bản đính kèm</Text>
                        </View>
                      )}

                      <TouchableOpacity
                        style={styles.openExternalBtn}
                        onPress={() => {
                          const fullUrl = resolveFileUrl(selectedCert.fileUrl);
                          if (fullUrl) {
                            Linking.openURL(fullUrl).catch(() => {
                              setDialog({
                                title: 'Thông báo',
                                message: 'Không thể mở liên kết tệp tin trên thiết bị.',
                                primaryLabel: 'Đã hiểu',
                                onPrimary: () => setDialog(null),
                              });
                            });
                          }
                        }}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="open-outline" size={16} color="#FFFFFF" />
                        <Text style={styles.openExternalBtnText}>Mở tệp gốc / Xem toàn màn hình</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.noFileNotice}>
                      <Ionicons name="shield-checkmark-outline" size={26} color="#059669" />
                      <Text style={styles.noFileNoticeText}>
                        Chứng chỉ đã được ban quản trị TaxKeep kiểm tra trực tiếp và xác thực từ hồ sơ gốc của chuyên gia.
                      </Text>
                    </View>
                  )}
                </>
              )}
            </ScrollView>

            <View style={styles.certModalFooter}>
              <TouchableOpacity
                style={styles.certModalCloseBtn}
                onPress={() => setCertModalVisible(false)}
              >
                <Text style={styles.certModalCloseBtnText}>Đóng</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── MODAL LỌC HÌNH THỨC DỊCH VỤ (LỊCH LÀM VIỆC) ── */}
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

      {/* ── MODAL LỌC BUỔI TRONG NGÀY (LỊCH LÀM VIỆC) ── */}
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

      {/* ── MODAL LỌC MỨC SAO ĐÁNH GIÁ ── */}
      <Modal
        visible={reviewRatingModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReviewRatingModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.dropdownModalOverlay}
          activeOpacity={1}
          onPress={() => setReviewRatingModalVisible(false)}
        >
          <View style={styles.dropdownModalCard}>
            <View style={styles.dropdownModalHeader}>
              <Text style={styles.dropdownModalTitle}>Lọc theo mức đánh giá</Text>
              <TouchableOpacity onPress={() => setReviewRatingModalVisible(false)}>
                <Ionicons name="close" size={20} color="#666666" />
              </TouchableOpacity>
            </View>
            {[null, 5, 4, 3, 2, 1].map((star) => {
              const selected = selectedRatingFilter === star;
              return (
                <TouchableOpacity
                  key={String(star)}
                  style={[styles.dropdownOptionItem, selected && styles.dropdownOptionItemActive]}
                  onPress={() => {
                    fetchReviewsByRating(star);
                    setReviewRatingModalVisible(false);
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="star" size={15} color="#F59E0B" />
                    <Text style={[styles.dropdownOptionText, selected && styles.dropdownOptionTextActive]}>
                      {star === null ? 'Tất cả đánh giá' : `Đánh giá ${star} sao`}
                    </Text>
                  </View>
                  {selected && <Ionicons name="checkmark-circle" size={18} color={theme.colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── MODAL SẮP XẾP ĐÁNH GIÁ ── */}
      <Modal
        visible={reviewSortModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReviewSortModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.dropdownModalOverlay}
          activeOpacity={1}
          onPress={() => setReviewSortModalVisible(false)}
        >
          <View style={styles.dropdownModalCard}>
            <View style={styles.dropdownModalHeader}>
              <Text style={styles.dropdownModalTitle}>Sắp xếp nhận xét</Text>
              <TouchableOpacity onPress={() => setReviewSortModalVisible(false)}>
                <Ionicons name="close" size={20} color="#666666" />
              </TouchableOpacity>
            </View>
            {([
              { key: 'NEWEST', label: 'Mới nhất' },
              { key: 'HIGHEST', label: 'Điểm đánh giá cao nhất' },
              { key: 'LOWEST', label: 'Điểm đánh giá thấp nhất' },
            ] as const).map((opt) => {
              const selected = reviewSort === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.dropdownOptionItem, selected && styles.dropdownOptionItemActive]}
                  onPress={() => {
                    setReviewSort(opt.key);
                    setReviewSortModalVisible(false);
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
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(243, 239, 230, 0.85)',
  },
  headerTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 18,
    lineHeight: 24,
    color: theme.colors.primaryDark,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 10,
  },
  headerRightBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 253, 247, 0.92)',
    borderWidth: 1,
    borderColor: theme.colors.goldLight,
  },

  scrollContent: {
    padding: 16,
    paddingBottom: 90,
  },

  // Hero Card
  heroCard: {
    backgroundColor: 'rgba(255, 253, 247, 0.94)',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#E5D5B5',
    ...theme.shadows.card,
    marginBottom: 14,
  },
  heroTopRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  heroAvatarWrap: {
    position: 'relative',
    marginRight: 14,
  },
  heroAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  heroAvatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#8B1E1E1F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroAvatarLetter: {
    fontFamily: fonts.serifBold,
    fontSize: 28,
    color: theme.colors.primary,
  },
  heroVerifiedBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    backgroundColor: '#059669',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  heroInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroName: {
    fontFamily: fonts.serifBold,
    fontSize: 18,
    color: theme.colors.textPrimary,
  },
  heroJobTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    color: theme.colors.primaryDark,
    marginTop: 2,
  },
  heroCompany: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginTop: 6,
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#059669',
  },
  statusText: {
    fontFamily: fonts.bodySemi,
    fontSize: 11,
    color: '#065F46',
  },

  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3EFE6',
  },
  statItem: {
    alignItems: 'center',
  },
  statScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statScore: {
    fontFamily: fonts.serifBold,
    fontSize: 16,
    color: '#B45309',
  },
  statNumber: {
    fontFamily: fonts.serifBold,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  statLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 26,
    backgroundColor: '#E5E0D4',
  },

  // Segment Bar
  segmentBar: {
    flexDirection: 'row',
    backgroundColor: '#F5F1EA',
    borderRadius: 10,
    padding: 3,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E6DECF',
  },
  segmentTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderRadius: 8,
    gap: 3.5,
  },
  segmentTabActive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5D8C3',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentTabText: {
    fontFamily: fonts.bodySemi,
    fontSize: 11.5,
    color: '#6B7280',
  },
  segmentTabTextActive: {
    fontFamily: fonts.bodyBold,
    color: '#8B1E1E',
  },

  tabSection: {
    gap: 12,
  },
  cardSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionHeaderTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 15,
    color: theme.colors.primary,
  },
  sectionSubtitle: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 3,
    marginBottom: 10,
  },
  bioText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: '#333333',
    lineHeight: 20,
    marginTop: 6,
  },

  specChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  detailSpecChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF5EA',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: '#E4D6BE',
    gap: 5,
    maxWidth: '100%',
    flexShrink: 1,
  },
  detailSpecText: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: '#78350F',
    flexShrink: 1,
  },

  // Certificates
  certCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF8F3',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#EFE8DB',
  },
  certIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#8B1E1E14',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  certInfo: {
    flex: 1,
  },
  certName: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: theme.colors.textPrimary,
    lineHeight: 18,
  },
  certAuthority: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#666666',
    marginTop: 2,
  },
  certNumber: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#888888',
    marginTop: 2,
  },
  certNumberCode: {
    fontFamily: fonts.bodySemi,
    color: '#444444',
  },
  certActionCol: {
    alignItems: 'flex-end',
    gap: 6,
    marginLeft: 8,
  },
  certVerifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 3,
  },
  certVerifiedText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: '#065F46',
  },
  viewFileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8B1E1E12',
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: 4,
    gap: 3,
    borderWidth: 0.5,
    borderColor: '#8B1E1E30',
  },
  viewFileBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10.5,
    color: theme.colors.primary,
  },

  // Certificate Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  certModalBox: {
    width: '100%',
    maxHeight: '88%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    ...theme.shadows.card,
  },
  certModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0ECE4',
  },
  certModalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  certModalTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 16,
    color: theme.colors.primary,
  },
  modalCloseBtn: {
    padding: 4,
  },
  certModalBody: {
    marginTop: 10,
    maxHeight: 450,
  },
  certModalCertName: {
    fontFamily: fonts.serifBold,
    fontSize: 15,
    color: theme.colors.textPrimary,
    lineHeight: 21,
    marginBottom: 10,
  },
  certDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  certDetailLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#666666',
  },
  certDetailValue: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: '#333333',
    maxWidth: '65%',
    textAlign: 'right',
  },
  certDetailValueBold: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: theme.colors.primary,
    maxWidth: '65%',
    textAlign: 'right',
  },
  certVerifiedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    padding: 10,
    borderRadius: 8,
    gap: 8,
    marginTop: 10,
    borderWidth: 0.5,
    borderColor: '#A7F3D0',
  },
  certVerifiedBannerText: {
    fontFamily: fonts.bodySemi,
    fontSize: 11.5,
    color: '#065F46',
    flex: 1,
  },
  certFileSection: {
    marginTop: 14,
  },
  certFileSectionTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 12.5,
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  certImageWrap: {
    width: '100%',
    height: 220,
    backgroundColor: '#F9F7F2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E8E2D6',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  certImagePreview: {
    width: '100%',
    height: '100%',
  },
  certDocWrap: {
    padding: 24,
    backgroundColor: '#F9F7F2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E8E2D6',
    alignItems: 'center',
    gap: 8,
  },
  certDocText: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: '#666666',
  },
  openExternalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
    marginTop: 10,
  },
  openExternalBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12.5,
    color: '#FFFFFF',
  },
  noFileNotice: {
    padding: 16,
    backgroundColor: '#FAF8F3',
    borderRadius: 8,
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#ECE4D4',
  },
  noFileNoticeText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
  },
  certModalFooter: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0ECE4',
  },
  certModalCloseBtn: {
    backgroundColor: '#F3EFE6',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  certModalCloseBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: '#444444',
  },

  // Fee Cards
  feeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAF8F3',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#EFE8DB',
  },
  feeCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sessionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sessionName: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  sessionDuration: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#777777',
    marginTop: 2,
  },
  feePrice: {
    fontFamily: fonts.serifBold,
    fontSize: 15,
    color: theme.colors.primary,
    fontVariant: ['tabular-nums'],
  },

  // Schedule Tab - Service Types List (Full-width vertical cards)
  serviceTypesList: {
    gap: 8,
    marginTop: 6,
    marginBottom: 8,
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

  emptySlotBox: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptySlotTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 14,
    color: theme.colors.textPrimary,
    marginTop: 8,
  },
  emptySlotDesc: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
  },
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
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3EFE6',
  },
  slotGridTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: theme.colors.textPrimary,
    marginBottom: 10,
  },
  noSlotText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#888888',
    fontStyle: 'italic',
  },
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slotChip: {
    width: '48%',
    backgroundColor: '#FAF7F0',
    borderWidth: 1,
    borderColor: '#E6DECE',
    borderRadius: 8,
    padding: 10,
  },
  slotChipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  slotTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
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
  slotTextActive: {
    color: '#FFFFFF',
  },

  // Reviews Tab
  ratingOverviewRow: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  bigScoreBox: {
    alignItems: 'center',
  },
  bigScoreNumber: {
    fontFamily: fonts.serifBold,
    fontSize: 36,
    color: '#B45309',
  },
  starRow: {
    flexDirection: 'row',
    gap: 3,
    marginVertical: 4,
  },
  bigScoreTotal: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#777777',
  },
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
    gap: 5,
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
  reviewLoading: {
    paddingVertical: 20,
  },
  emptyReviews: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyReviewsText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#888888',
    marginTop: 6,
  },
  reviewsList: {
    marginTop: 6,
    gap: 10,
  },
  reviewCard: {
    backgroundColor: '#FAF8F3',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EFE8DB',
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  reviewerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#8B1E1E1C',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  reviewerAvatarLetter: {
    fontFamily: fonts.serifBold,
    fontSize: 12,
    color: theme.colors.primary,
  },
  reviewerMeta: {
    flex: 1,
  },
  reviewerName: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: theme.colors.textPrimary,
  },
  reviewDate: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: '#999999',
  },
  reviewStars: {
    flexDirection: 'row',
    gap: 1,
  },
  reviewComment: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#444444',
    lineHeight: 18,
  },

  // Bottom Bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...theme.shadows.card,
  },
  bottomFeeInfo: {
    flex: 1,
    marginRight: 12,
  },
  bottomFeeLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#888888',
  },
  bottomFeeValue: {
    fontFamily: fonts.serifBold,
    fontSize: 15,
    color: theme.colors.primary,
  },
  bottomSlotLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: theme.colors.textPrimary,
  },
  bottomSlotStatus: {
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    color: '#059669',
  },
  bottomBookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 8,
    gap: 6,
    ...theme.shadows.button,
  },
  bottomBookBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
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
});
