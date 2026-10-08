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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { GoldDoubleRule } from '../../components/brand/GoldDoubleRule';
import { RootNavigationProp, RootStackParamList } from '../../navigation/types';
import { consultationApi } from '../../api/consultationApi';
import type {
  ExpertDetailResponse,
  ExpertAvailableSlotDto,
  ExpertPublicReviewDto,
} from '../../types/consultation';
import {
  formatVnd,
  formatSessionType,
  formatVietnameseDate,
  formatTimeRange,
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
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<ExpertAvailableSlotDto | null>(null);

  // Reviews state
  const [reviews, setReviews] = useState<ExpertPublicReviewDto[]>([]);
  const [selectedRatingFilter, setSelectedRatingFilter] = useState<number | null>(null);
  const [loadingReviews, setLoadingReviews] = useState(false);

  // Active sub-tab: 'INFO' | 'SCHEDULE' | 'REVIEWS'
  const [activeTab, setActiveTab] = useState<'INFO' | 'SCHEDULE' | 'REVIEWS'>('INFO');

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [detail, slots] = await Promise.all([
        consultationApi.getExpertDetail(expertProfileId),
        consultationApi.getAvailableSlotsForBooking(expertProfileId, undefined, 14),
      ]);
      setExpert(detail);
      setAvailableSlots(slots);
      setReviews(detail.recentReviews || []);

      // Auto-select first date with available slots
      if (slots.length > 0) {
        setSelectedDate(slots[0].slotDate);
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

  // Group slots by date
  const uniqueDates = useMemo(() => {
    const dates = Array.from(new Set(availableSlots.map((s) => s.slotDate)));
    return dates.sort();
  }, [availableSlots]);

  // Filter slots for currently selected date
  const slotsForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    return availableSlots.filter((s) => s.slotDate === selectedDate);
  }, [availableSlots, selectedDate]);

  // Proceed to booking screen
  const handleProceedToBooking = () => {
    if (!expert) return;
    navigation.navigate('BookingCreate', {
      expertProfileId: expert.id,
      initialSlotId: selectedSlot?.id,
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
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
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
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
              {expert.avatarUrl ? (
                <Image source={{ uri: expert.avatarUrl }} style={styles.heroAvatar} />
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
          >
            <Ionicons
              name="person-outline"
              size={16}
              color={activeTab === 'INFO' ? theme.colors.primary : '#666666'}
            />
            <Text
              style={[
                styles.segmentTabText,
                activeTab === 'INFO' && styles.segmentTabTextActive,
              ]}
            >
              Giới thiệu
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentTab, activeTab === 'SCHEDULE' && styles.segmentTabActive]}
            onPress={() => setActiveTab('SCHEDULE')}
          >
            <Ionicons
              name="calendar-outline"
              size={16}
              color={activeTab === 'SCHEDULE' ? theme.colors.primary : '#666666'}
            />
            <Text
              style={[
                styles.segmentTabText,
                activeTab === 'SCHEDULE' && styles.segmentTabTextActive,
              ]}
            >
              Lịch làm việc ({availableSlots.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentTab, activeTab === 'REVIEWS' && styles.segmentTabActive]}
            onPress={() => setActiveTab('REVIEWS')}
          >
            <Ionicons
              name="star-outline"
              size={16}
              color={activeTab === 'REVIEWS' ? theme.colors.primary : '#666666'}
            />
            <Text
              style={[
                styles.segmentTabText,
                activeTab === 'REVIEWS' && styles.segmentTabTextActive,
              ]}
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
                      <Text style={styles.detailSpecText}>{s}</Text>
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
                  <View key={cert.id} style={styles.certCard}>
                    <View style={styles.certIconWrap}>
                      <Ionicons name="document-text" size={20} color={theme.colors.primary} />
                    </View>
                    <View style={styles.certInfo}>
                      <Text style={styles.certName}>{cert.certificateName}</Text>
                      <Text style={styles.certAuthority}>
                        Cơ quan cấp: {cert.issuingAuthority} ({cert.yearIssued})
                      </Text>
                      <Text style={styles.certNumber}>
                        Mã hiệu: <Text style={styles.certNumberCode}>{cert.maskedCertificateNumber}</Text>
                      </Text>
                    </View>
                    <View style={styles.certVerifiedTag}>
                      <Ionicons name="checkmark-done" size={12} color="#059669" />
                      <Text style={styles.certVerifiedText}>Hợp lệ</Text>
                    </View>
                  </View>
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
            <View style={styles.cardSection}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="calendar" size={18} color={theme.colors.primary} />
                <Text style={styles.sectionHeaderTitle}>Chọn ngày tư vấn</Text>
              </View>
              <Text style={styles.sectionSubtitle}>
                Chỉ hiển thị các khung giờ còn trống và thỏa mãn quy định đặt trước tối thiểu 4 giờ
              </Text>

              {uniqueDates.length === 0 ? (
                <View style={styles.emptySlotBox}>
                  <Ionicons name="calendar-outline" size={36} color="#CCCCCC" />
                  <Text style={styles.emptySlotTitle}>Chuyên gia tạm thời chưa có lịch trống</Text>
                  <Text style={styles.emptySlotDesc}>
                    Vui lòng quay lại sau hoặc chọn chuyên gia khác đang có khung giờ khả dụng.
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
                    {uniqueDates.map((dateStr) => {
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
                      Khung giờ khả dụng ngày {formatVietnameseDate(selectedDate || '')}
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

              {/* Star Filter Chips */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.starFilterScroll}
              >
                <TouchableOpacity
                  style={[
                    styles.starFilterChip,
                    selectedRatingFilter === null && styles.starFilterChipActive,
                  ]}
                  onPress={() => fetchReviewsByRating(null)}
                >
                  <Text
                    style={[
                      styles.starFilterText,
                      selectedRatingFilter === null && styles.starFilterTextActive,
                    ]}
                  >
                    Tất cả
                  </Text>
                </TouchableOpacity>
                {[5, 4, 3, 2, 1].map((star) => {
                  const active = selectedRatingFilter === star;
                  return (
                    <TouchableOpacity
                      key={star}
                      style={[styles.starFilterChip, active && styles.starFilterChipActive]}
                      onPress={() => fetchReviewsByRating(star)}
                    >
                      <Ionicons
                        name="star"
                        size={12}
                        color={active ? '#FFFFFF' : '#F59E0B'}
                      />
                      <Text
                        style={[styles.starFilterText, active && styles.starFilterTextActive]}
                      >
                        {star} sao
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {loadingReviews ? (
                <View style={styles.reviewLoading}>
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                </View>
              ) : reviews.length === 0 ? (
                <View style={styles.emptyReviews}>
                  <Ionicons name="chatbox-ellipses-outline" size={32} color="#CCCCCC" />
                  <Text style={styles.emptyReviewsText}>Chưa có nhận xét nào trong mục này.</Text>
                </View>
              ) : (
                <View style={styles.reviewsList}>
                  {reviews.map((r) => (
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
    backgroundColor: '#FAF5EE',
    borderWidth: 1,
    borderColor: theme.colors.goldLight,
  },

  scrollContent: {
    padding: 16,
    paddingBottom: 90,
  },

  // Hero Card
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
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
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 4,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E8E1D3',
  },
  segmentTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 8,
    gap: 4,
  },
  segmentTabActive: {
    backgroundColor: '#FAF5EE',
    borderWidth: 1,
    borderColor: theme.colors.goldLight,
  },
  segmentTabText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#666666',
  },
  segmentTabTextActive: {
    fontFamily: fonts.bodyBold,
    color: theme.colors.primary,
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
  },
  detailSpecText: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: '#78350F',
  },

  // Certificates
  certCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF8F3',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#EFE8DB',
  },
  certIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
  },
  certAuthority: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#666666',
    marginTop: 1,
  },
  certNumber: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#888888',
    marginTop: 1,
  },
  certNumberCode: {
    fontFamily: fonts.bodySemi,
    color: '#444444',
  },
  certVerifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 3,
  },
  certVerifiedText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: '#065F46',
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

  // Schedule Tab
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
  starFilterScroll: {
    gap: 6,
    paddingVertical: 10,
  },
  starFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#F5EFE4',
    borderWidth: 1,
    borderColor: '#E4D9C7',
    gap: 3,
  },
  starFilterChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  starFilterText: {
    fontFamily: fonts.bodySemi,
    fontSize: 11,
    color: '#555555',
  },
  starFilterTextActive: {
    color: '#FFFFFF',
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
