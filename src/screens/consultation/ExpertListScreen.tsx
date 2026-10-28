import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Modal,
  BackHandler,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { DrumPatternBackdrop } from '../../components/brand/DrumPatternBackdrop';
import { GoldDoubleRule } from '../../components/brand/GoldDoubleRule';
import { RootNavigationProp } from '../../navigation/types';
import { consultationApi } from '../../api/consultationApi';
import { useAuthStore } from '../../stores/useAuthStore';
import type {
  ExpertListItemResponse,
  SpecializationDto,
  ExpertSortBy,
  ExpertTimeFilter,
} from '../../types/consultation';
import { formatVnd, formatVietnameseDate, isValidAvatarUrl } from '../../types/consultation';

const TIME_FILTERS: { key: ExpertTimeFilter; label: string }[] = [
  { key: 'All', label: 'Tất cả lịch' },
  { key: 'Today', label: 'Hôm nay' },
  { key: 'Tomorrow', label: 'Ngày mai' },
  { key: 'ThisWeekend', label: 'Cuối tuần' },
  { key: 'Next7Days', label: '7 ngày tới' },
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BANNER_CARD_WIDTH = Math.max(280, SCREEN_WIDTH - 32);
const BANNER_CARD_GAP = 12;
const BANNER_SNAP_INTERVAL = BANNER_CARD_WIDTH + BANNER_CARD_GAP;

const SORT_OPTIONS: { key: ExpertSortBy; label: string }[] = [
  { key: 'Recommended', label: 'Đề xuất ưu tiên' },
  { key: 'RatingDesc', label: 'Đánh giá cao nhất' },
  { key: 'FeeAsc', label: 'Mức phí thấp nhất' },
  { key: 'FeeDesc', label: 'Mức phí cao nhất' },
  { key: 'ExperienceDesc', label: 'Kinh nghiệm nhiều nhất' },
  { key: 'CompletedSessionsDesc', label: 'Nhiều ca hoàn thành' },
];

interface FeaturedBannerSlideItemProps {
  item: ExpertListItemResponse;
  rank: number;
  onPress: () => void;
}

const FeaturedBannerSlideItem: React.FC<FeaturedBannerSlideItemProps> = ({
  item,
  rank,
  onPress,
}) => {
  const [imgError, setImgError] = useState(false);
  const isValidHttp = isValidAvatarUrl(item.avatarUrl);
  const nameParts = (item.fullName || 'Chuyên gia').trim().split(/\s+/);
  const displayInitial = (nameParts[nameParts.length - 1]?.charAt(0) || 'C').toUpperCase();

  return (
    <TouchableOpacity
      style={styles.bannerSlideCard}
      activeOpacity={0.9}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Chuyên gia đề xuất hạng ${rank} ${item.fullName}`}
    >
      {/* Decorative top gold accent line */}
      <View style={styles.bannerGoldTopAccent} />

      {/* Top Ribbon: Rank + Verified Certs + Slot Availability */}
      <View style={styles.bannerTopBar}>
        <View style={styles.bannerTopLeftBadges}>
          <View style={styles.bannerRankBadge}>
            <Ionicons name="trophy" size={11} color="#6B1414" />
            <Text style={styles.bannerRankText}>TOP #{rank} ĐỀ XUẤT</Text>
          </View>
          {item.verifiedCertificateCount > 0 && (
            <View style={styles.bannerCertBadge}>
              <Ionicons name="shield-checkmark" size={11} color="#FDE68A" />
              <Text style={styles.bannerCertText}>
                {item.verifiedCertificateCount} chứng chỉ
              </Text>
            </View>
          )}
        </View>

        {item.hasAvailableSlotSoon ? (
          <View style={styles.bannerSlotReadyPill}>
            <View style={styles.bannerSlotDot} />
            <Text style={styles.bannerSlotReadyText} numberOfLines={1}>
              {item.earliestAvailableDate
                ? `Lịch sớm: ${formatVietnameseDate(item.earliestAvailableDate)}`
                : 'Có lịch rảnh'}
            </Text>
          </View>
        ) : (
          <View style={styles.bannerSlotFlexPill}>
            <Ionicons name="time-outline" size={10} color="#E5D5B5" />
            <Text style={styles.bannerSlotFlexText}>Lịch linh hoạt</Text>
          </View>
        )}
      </View>

      {/* Main Content: Avatar + Details */}
      <View style={styles.bannerBodyRow}>
        <View style={styles.bannerAvatarContainer}>
          {isValidHttp && !imgError ? (
            <Image
              source={{ uri: item.avatarUrl! }}
              style={styles.bannerAvatarImg}
              onError={() => setImgError(true)}
            />
          ) : (
            <View style={styles.bannerAvatarFallback}>
              <Text style={styles.bannerAvatarInitial}>{displayInitial}</Text>
            </View>
          )}
          <View style={styles.bannerVerifiedBadge}>
            <Ionicons name="checkmark" size={10} color="#FFFFFF" />
          </View>
        </View>

        <View style={styles.bannerInfoCol}>
          <Text style={styles.bannerExpertName} numberOfLines={1}>
            {item.fullName}
          </Text>
          <Text style={styles.bannerJobCompany} numberOfLines={1}>
            {item.jobTitle || 'Chuyên gia tư vấn thuế'}
            {item.companyName ? ` • ${item.companyName}` : ''}
          </Text>

          {/* Metrics Row */}
          <View style={styles.bannerMetricsRow}>
            <View style={styles.bannerRatingPill}>
              <Ionicons name="star" size={11} color="#FBBF24" />
              <Text style={styles.bannerRatingVal}>
                {item.rating > 0 ? item.rating.toFixed(1) : '5.0'}
              </Text>
              <Text style={styles.bannerReviewCnt}>({item.totalReviews})</Text>
            </View>

            {item.yearsOfExperience > 0 && (
              <View style={styles.bannerMetricDividerPill}>
                <Text style={styles.bannerMetricText}>{item.yearsOfExperience} năm KN</Text>
              </View>
            )}

            <View style={styles.bannerMetricDividerPill}>
              <Text style={styles.bannerMetricText}>
                {item.completedConsultationsCount} ca tư vấn
              </Text>
            </View>
          </View>

          {/* Specializations Row */}
          {item.specializationNames && item.specializationNames.length > 0 && (
            <View style={styles.bannerSpecsRow}>
              {item.specializationNames.slice(0, 2).map((specName, idx) => (
                <View key={idx} style={styles.bannerSpecChip}>
                  <Text style={styles.bannerSpecChipText} numberOfLines={1}>
                    {specName}
                  </Text>
                </View>
              ))}
              {item.specializationNames.length > 2 && (
                <View style={styles.bannerSpecMoreChip}>
                  <Text style={styles.bannerSpecMoreText}>
                    +{item.specializationNames.length - 2}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>

      {/* Bottom Footer Bar: Starting Fee + Book Now CTA */}
      <View style={styles.bannerFooterBar}>
        <View style={styles.bannerFeeWrap}>
          <Text style={styles.bannerFeeLabel}>Phí tư vấn từ </Text>
          <Text style={styles.bannerFeeValue}>{formatVnd(item.startingFee)}</Text>
        </View>

        <View style={styles.bannerCtaBtn}>
          <Text style={styles.bannerCtaBtnText}>Đặt lịch ngay</Text>
          <Ionicons name="arrow-forward" size={13} color="#6B1414" />
        </View>
      </View>
    </TouchableOpacity>
  );
};

interface FeaturedExpertBannerCarouselProps {
  items: ExpertListItemResponse[];
  onPressExpert: (expertId: string) => void;
}

const FeaturedExpertBannerCarousel: React.FC<FeaturedExpertBannerCarouselProps> = ({
  items,
  onPressExpert,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList<ExpertListItemResponse>>(null);
  const isUserDraggingRef = useRef(false);

  const safeIndex = items.length > 0 ? Math.min(activeIndex, items.length - 1) : 0;

  const scrollToSlide = useCallback(
    (targetIndex: number) => {
      if (items.length === 0) return;
      const clamped = ((targetIndex % items.length) + items.length) % items.length;
      setActiveIndex(clamped);
      flatListRef.current?.scrollToOffset({
        offset: clamped * BANNER_SNAP_INTERVAL,
        animated: true,
      });
    },
    [items.length]
  );

  // Auto-slide every 4 seconds when there are multiple featured experts
  useEffect(() => {
    if (items.length <= 1) return;
    const interval = setInterval(() => {
      if (isUserDraggingRef.current) return;
      setActiveIndex((prev) => {
        const next = (prev + 1) % items.length;
        flatListRef.current?.scrollToOffset({
          offset: next * BANNER_SNAP_INTERVAL,
          animated: true,
        });
        return next;
      });
    }, 4000);

    return () => clearInterval(interval);
  }, [items.length]);

  const handleMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      isUserDraggingRef.current = false;
      const offsetX = e.nativeEvent.contentOffset.x;
      const idx = Math.round(offsetX / BANNER_SNAP_INTERVAL);
      if (idx >= 0 && idx < items.length) {
        setActiveIndex(idx);
      }
    },
    [items.length]
  );

  if (items.length === 0) return null;

  return (
    <View style={styles.featuredContainer}>
      {/* Header Row with Title & Slide Controls */}
      <View style={styles.bannerHeaderRow}>
        <View style={styles.sectionTitleRow}>
          <View style={styles.sectionIconBadge}>
            <Ionicons name="ribbon" size={14} color="#FFFDF7" />
          </View>
          <View>
            <Text style={styles.sectionTitle}>Chuyên gia đề xuất hàng đầu</Text>
            <Text style={styles.sectionSubtitle}>Xếp hạng tự động theo tiêu chí hệ thống</Text>
          </View>
        </View>

        {items.length > 1 && (
          <View style={styles.bannerNavControls}>
            <TouchableOpacity
              style={styles.bannerArrowBtn}
              onPress={() => scrollToSlide(safeIndex - 1)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              accessibilityLabel="Chuyên gia trước"
            >
              <Ionicons name="chevron-back" size={14} color={theme.colors.primary} />
            </TouchableOpacity>
            <Text style={styles.bannerCounterText}>
              {safeIndex + 1}/{items.length}
            </Text>
            <TouchableOpacity
              style={styles.bannerArrowBtn}
              onPress={() => scrollToSlide(safeIndex + 1)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              accessibilityLabel="Chuyên gia tiếp theo"
            >
              <Ionicons name="chevron-forward" size={14} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Horizontal Paging Banner Slide */}
      <FlatList
        ref={flatListRef}
        data={items}
        keyExtractor={(item) => `featured-slide-${item.id}`}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={BANNER_SNAP_INTERVAL}
        snapToAlignment="start"
        decelerationRate="fast"
        contentContainerStyle={styles.bannerFlatListContent}
        onScrollBeginDrag={() => {
          isUserDraggingRef.current = true;
        }}
        onScrollEndDrag={() => {
          setTimeout(() => {
            isUserDraggingRef.current = false;
          }, 600);
        }}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        getItemLayout={(_, index) => ({
          length: BANNER_SNAP_INTERVAL,
          offset: BANNER_SNAP_INTERVAL * index,
          index,
        })}
        renderItem={({ item, index }) => (
          <View
            style={{
              width: BANNER_CARD_WIDTH,
              marginRight: index === items.length - 1 ? 0 : BANNER_CARD_GAP,
            }}
          >
            <FeaturedBannerSlideItem
              item={item}
              rank={index + 1}
              onPress={() => onPressExpert(item.id)}
            />
          </View>
        )}
      />

      {/* Pagination Indicator Dots */}
      {items.length > 1 && (
        <View style={styles.bannerDotsRow}>
          {items.map((exp, idx) => {
            const active = idx === safeIndex;
            return (
              <TouchableOpacity
                key={`dot-${exp.id}`}
                onPress={() => scrollToSlide(idx)}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                style={[styles.bannerDot, active && styles.bannerDotActive]}
              />
            );
          })}
        </View>
      )}
    </View>
  );
};

interface ExpertListItemCardProps {
  item: ExpertListItemResponse;
  onPress: () => void;
}

const ExpertListItemCard: React.FC<ExpertListItemCardProps> = ({ item, onPress }) => {
  const [imgError, setImgError] = useState(false);
  const isValidHttp = isValidAvatarUrl(item.avatarUrl);
  const nameParts = (item.fullName || 'Chuyên gia').trim().split(/\s+/);
  const displayInitial = (nameParts[nameParts.length - 1]?.charAt(0) || 'C').toUpperCase();

  return (
    <TouchableOpacity
      style={styles.expertCard}
      activeOpacity={0.88}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Chuyên gia ${item.fullName}`}
    >
      {/* Top row: Avatar & Identity */}
      <View style={styles.cardTopRow}>
        <View style={styles.cardAvatarWrap}>
          {isValidHttp && !imgError ? (
            <Image
              source={{ uri: item.avatarUrl! }}
              style={styles.cardAvatar}
              onError={() => setImgError(true)}
            />
          ) : (
            <View style={styles.cardAvatarPlaceholder}>
              <Text style={styles.cardAvatarLetter}>{displayInitial}</Text>
            </View>
          )}
        </View>

        <View style={styles.cardInfo}>
          <View style={styles.cardNameRow}>
            <Text style={styles.cardName} numberOfLines={1}>
              {item.fullName}
            </Text>
            <Ionicons name="checkmark-circle" size={16} color="#059669" style={{ marginLeft: 4 }} />
          </View>

          <Text style={styles.cardJobTitle} numberOfLines={1}>
            {item.jobTitle || 'Chuyên gia tư vấn thuế'}
          </Text>

          {item.companyName ? (
            <Text style={styles.cardCompany} numberOfLines={1}>
              <Ionicons name="business-outline" size={11} color="#777777" /> {item.companyName}
            </Text>
          ) : null}

          {/* Highlights row */}
          <View style={styles.cardHighlights}>
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={12} color="#F59E0B" />
              <Text style={styles.ratingText}>
                {item.rating > 0 ? item.rating.toFixed(1) : '5.0'}
              </Text>
              <Text style={styles.reviewCount}>({item.totalReviews})</Text>
            </View>

            {item.yearsOfExperience > 0 && (
              <View style={styles.highlightBadge}>
                <Text style={styles.highlightText}>
                  {item.yearsOfExperience} năm kinh nghiệm
                </Text>
              </View>
            )}

            {item.completedConsultationsCount > 0 && (
              <View style={styles.highlightBadge}>
                <Text style={styles.highlightText}>
                  {item.completedConsultationsCount} ca
                </Text>
              </View>
            )}

            {item.verifiedCertificateCount > 0 && (
              <View style={styles.certHighlightBadge}>
                <Ionicons name="shield-checkmark" size={10} color="#065F46" />
                <Text style={styles.certHighlightText}>
                  {item.verifiedCertificateCount} chứng chỉ
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Specialization Tags */}
      {item.specializationNames && item.specializationNames.length > 0 && (
        <View style={styles.specTagsRow}>
          {item.specializationNames.slice(0, 2).map((s, idx) => (
            <View key={idx} style={styles.specTag}>
              <Text style={styles.specTagText} numberOfLines={1} ellipsizeMode="tail">
                {s}
              </Text>
            </View>
          ))}
          {item.specializationNames.length > 2 && (
            <View style={styles.specTagMore}>
              <Text style={styles.specTagMoreText}>
                +{item.specializationNames.length - 2}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Card Footer: Fee & Booking CTA */}
      <View style={styles.cardFooter}>
        <View style={styles.footerLeft}>
          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>Mức phí từ: </Text>
            <Text style={styles.feeValue}>{formatVnd(item.startingFee)}</Text>
          </View>

          {item.hasAvailableSlotSoon ? (
            <View style={styles.slotAvailableBadge}>
              <Ionicons name="calendar-outline" size={11} color="#059669" />
              <Text style={styles.slotAvailableText} numberOfLines={1}>
                {item.earliestAvailableDate
                  ? `Lịch sớm: ${formatVietnameseDate(item.earliestAvailableDate)}`
                  : 'Có lịch rảnh'}
              </Text>
            </View>
          ) : (
            <View style={styles.slotBusyBadge}>
              <Ionicons name="time-outline" size={11} color="#6B7280" />
              <Text style={styles.slotBusyText}>Lịch linh hoạt</Text>
            </View>
          )}
        </View>

        <View style={styles.bookBtn}>
          <Text style={styles.bookBtnText}>Xem & Đặt lịch</Text>
          <Ionicons name="chevron-forward" size={13} color="#FFFFFF" />
        </View>
      </View>
    </TouchableOpacity>
  );
};

export const ExpertListScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const currentUser = useAuthStore((s) => s.user);

  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [selectedSpecId, setSelectedSpecId] = useState<number | null>(null);
  const [timeFilter, setTimeFilter] = useState<ExpertTimeFilter>('All');
  const [userSelectedSortBy, setUserSelectedSortBy] = useState<ExpertSortBy | null>(null);
  const [dynamicSortOptions, setDynamicSortOptions] = useState<{ key: ExpertSortBy; label: string }[]>(SORT_OPTIONS);
  const [defaultSortKey, setDefaultSortKey] = useState<ExpertSortBy>('Recommended');
  const sortBy: ExpertSortBy = userSelectedSortBy ?? defaultSortKey;

  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [specModalVisible, setSpecModalVisible] = useState(false);
  const [timeModalVisible, setTimeModalVisible] = useState(false);

  const [specializations, setSpecializations] = useState<SpecializationDto[]>([]);
  const [featuredExperts, setFeaturedExperts] = useState<ExpertListItemResponse[]>([]);
  const [experts, setExperts] = useState<ExpertListItemResponse[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Debounce từ khóa tìm kiếm để đồng bộ mượt với SearchableFields của Admin
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedKeyword(keyword.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [keyword]);

  // Hàm xác định xem chuyên gia có phải là chính bản thân người dùng đang đăng nhập hay không
  const isSelfExpert = useCallback(
    (exp: ExpertListItemResponse) => {
      if (!currentUser) return false;
      const myId = String(currentUser.id || '').trim().toLowerCase();
      const myName = String(currentUser.fullName || '').trim().toLowerCase();
      const expUserId = String(exp.userId || '').trim().toLowerCase();
      const expProfileId = String(exp.id || '').trim().toLowerCase();
      const expName = String(exp.fullName || '').trim().toLowerCase();

      if (myId && (myId === expUserId || myId === expProfileId)) {
        return true;
      }
      if (myName && expName && myName === expName) {
        return true;
      }
      return false;
    },
    [currentUser]
  );

  // Danh sách chuyên gia đã lọc (không bao giờ hiển thị bản thân mình)
  const displayedExperts = useMemo(() => {
    return experts.filter((e) => !isSelfExpert(e));
  }, [experts, isSelfExpert]);

  const displayedFeatured = useMemo(() => {
    return featuredExperts.filter((e) => !isSelfExpert(e));
  }, [featuredExperts, isSelfExpert]);

  // Tải danh mục lĩnh vực, chuyên gia đề xuất (6 chuyên gia chuẩn BE) & cấu hình sắp xếp từ Admin
  const loadMetadataAndFeatured = useCallback(async () => {
    try {
      const [specs, featured, sortConfig] = await Promise.all([
        consultationApi.getSpecializations(true).catch(() => []),
        consultationApi.getFeaturedExperts(6).catch(() => []),
        consultationApi.getExpertSortOptions().catch(() => null),
      ]);
      if (specs.length > 0) {
        setSpecializations(specs);
      }
      setFeaturedExperts(featured);
      if (sortConfig?.options && sortConfig.options.length > 0) {
        const mappedOptions = sortConfig.options.map((opt) => ({
          key: opt.value as ExpertSortBy,
          label: opt.label,
        }));
        setDynamicSortOptions(mappedOptions);
        if (sortConfig.defaultSortBy) {
          const defKey = sortConfig.defaultSortBy as ExpertSortBy;
          setDefaultSortKey(defKey);
        }
        setUserSelectedSortBy((prev) => {
          if (prev && !mappedOptions.some((o) => o.key === prev)) {
            return null;
          }
          return prev;
        });
      }
    } catch (e) {
      console.warn('Load specs/featured/sortConfig error:', e);
    }
  }, []);

  useEffect(() => {
    loadMetadataAndFeatured();
  }, [loadMetadataAndFeatured]);

  // Fetch danh sách chuyên gia (Khi userSelectedSortBy === null, truyền sortBy: undefined để BE tự lấy DefaultSortBy của Admin)
  const fetchExperts = useCallback(
    async (isRefresh = false, pageNum = 1) => {
      if (isRefresh) setRefreshing(true);
      else if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      setError(null);
      try {
        const result = await consultationApi.searchExperts({
          keyword: debouncedKeyword || undefined,
          specializationIds: selectedSpecId ? [selectedSpecId] : undefined,
          timeFilter,
          sortBy: userSelectedSortBy ?? undefined,
          page: pageNum,
          size: 10,
        });

        if (pageNum === 1) {
          setExperts(result.items);
        } else {
          setExperts((prev) => [...prev, ...result.items]);
        }
        setPage(pageNum);
        setHasMore(result.pagination.page < result.pagination.totalPages);
      } catch (err: any) {
        setError(err?.response?.data?.message || err?.message || 'Không thể tải danh sách chuyên gia.');
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [debouncedKeyword, selectedSpecId, timeFilter, userSelectedSortBy]
  );

  useEffect(() => {
    fetchExperts(false, 1);
  }, [fetchExperts]);

  const handleRefresh = () => {
    loadMetadataAndFeatured();
    fetchExperts(true, 1);
  };

  const handleLoadMore = () => {
    if (!loading && !loadingMore && hasMore) {
      fetchExperts(false, page + 1);
    }
  };

  const resetFilters = () => {
    setKeyword('');
    setDebouncedKeyword('');
    setSelectedSpecId(null);
    setTimeFilter('All');
    setUserSelectedSortBy(null);
  };

  const currentSortLabel = useMemo(() => {
    return (
      dynamicSortOptions.find((s) => s.key === sortBy)?.label ||
      SORT_OPTIONS.find((s) => s.key === sortBy)?.label ||
      'Sắp xếp'
    );
  }, [sortBy, dynamicSortOptions]);

  const selectedSpecName = useMemo(() => {
    if (!selectedSpecId) return 'Tất cả lĩnh vực';
    return specializations.find((s) => s.id === selectedSpecId)?.name || 'Lĩnh vực';
  }, [selectedSpecId, specializations]);

  const currentTimeFilterLabel = useMemo(() => {
    return TIME_FILTERS.find((tf) => tf.key === timeFilter)?.label || 'Thời gian';
  }, [timeFilter]);

  const hasActiveFilters = Boolean(
    selectedSpecId !== null || timeFilter !== 'All' || (userSelectedSortBy !== null && userSelectedSortBy !== defaultSortKey)
  );

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
          style={styles.headerBtn}
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Tư vấn chuyên gia</Text>
          <Text style={styles.headerSubtitle}>Đặt lịch chuyên gia thuế giàu kinh nghiệm</Text>
        </View>

        <TouchableOpacity
          style={styles.headerActionBtn}
          onPress={() => navigation.navigate('MyBookings', {})}
          accessibilityRole="button"
          accessibilityLabel="Lịch hẹn của tôi"
        >
          <Ionicons name="calendar-outline" size={22} color={theme.colors.primary} />
          <Text style={styles.headerActionText}>Lịch hẹn</Text>
        </TouchableOpacity>
      </View>

      <GoldDoubleRule />

      {/* ── SEARCH & DROPDOWN FILTER CONTROLS ── */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#888888" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm theo tên chuyên gia, chức danh..."
            placeholderTextColor="#999999"
            value={keyword}
            onChangeText={setKeyword}
            onSubmitEditing={() => fetchExperts(false, 1)}
            returnKeyType="search"
          />
          {keyword.length > 0 && (
            <TouchableOpacity onPress={() => setKeyword('')} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={16} color="#888888" />
            </TouchableOpacity>
          )}
        </View>

        {/* ── DROPDOWN FILTER ROW ── */}
        <View style={styles.filterDropdownRow}>
          {/* Dropdown 1: Lĩnh vực */}
          <TouchableOpacity
            style={[
              styles.filterDropdownBtn,
              selectedSpecId !== null && styles.filterDropdownBtnActive,
            ]}
            onPress={() => setSpecModalVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Chọn lĩnh vực chuyên môn"
          >
            <Ionicons
              name="briefcase-outline"
              size={13}
              color={selectedSpecId !== null ? '#FFFFFF' : theme.colors.primary}
            />
            <Text
              style={[
                styles.filterDropdownText,
                selectedSpecId !== null && styles.filterDropdownTextActive,
              ]}
              numberOfLines={1}
            >
              {selectedSpecName}
            </Text>
            <Ionicons
              name="chevron-down"
              size={12}
              color={selectedSpecId !== null ? '#FFFFFF' : '#6B7280'}
            />
          </TouchableOpacity>

          {/* Dropdown 2: Thời gian có lịch */}
          <TouchableOpacity
            style={[
              styles.filterDropdownBtn,
              timeFilter !== 'All' && styles.filterDropdownBtnActive,
            ]}
            onPress={() => setTimeModalVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Chọn thời gian có lịch"
          >
            <Ionicons
              name="calendar-outline"
              size={13}
              color={timeFilter !== 'All' ? '#FFFFFF' : theme.colors.primary}
            />
            <Text
              style={[
                styles.filterDropdownText,
                timeFilter !== 'All' && styles.filterDropdownTextActive,
              ]}
              numberOfLines={1}
            >
              {currentTimeFilterLabel}
            </Text>
            <Ionicons
              name="chevron-down"
              size={12}
              color={timeFilter !== 'All' ? '#FFFFFF' : '#6B7280'}
            />
          </TouchableOpacity>

          {/* Dropdown 3: Sắp xếp */}
          <TouchableOpacity
            style={[
              styles.filterDropdownBtn,
              sortBy !== defaultSortKey && styles.filterDropdownBtnActive,
            ]}
            onPress={() => setSortModalVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Chọn sắp xếp"
          >
            <Ionicons
              name="swap-vertical"
              size={13}
              color={sortBy !== defaultSortKey ? '#FFFFFF' : theme.colors.primary}
            />
            <Text
              style={[
                styles.filterDropdownText,
                sortBy !== defaultSortKey && styles.filterDropdownTextActive,
              ]}
              numberOfLines={1}
            >
              {currentSortLabel}
            </Text>
            <Ionicons
              name="chevron-down"
              size={12}
              color={sortBy !== defaultSortKey ? '#FFFFFF' : '#6B7280'}
            />
          </TouchableOpacity>
        </View>

        {/* Active Filters Bar */}
        {hasActiveFilters && (
          <View style={styles.activeFiltersRow}>
            <Text style={styles.activeFiltersLabel}>Đang lọc:</Text>
            {selectedSpecId !== null && (
              <View style={styles.activeFilterPill}>
                <Text style={styles.activeFilterPillText} numberOfLines={1}>
                  {selectedSpecName}
                </Text>
                <TouchableOpacity onPress={() => setSelectedSpecId(null)}>
                  <Ionicons name="close-circle" size={13} color="#8B1E1E" />
                </TouchableOpacity>
              </View>
            )}
            {timeFilter !== 'All' && (
              <View style={styles.activeFilterPill}>
                <Text style={styles.activeFilterPillText}>{currentTimeFilterLabel}</Text>
                <TouchableOpacity onPress={() => setTimeFilter('All')}>
                  <Ionicons name="close-circle" size={13} color="#8B1E1E" />
                </TouchableOpacity>
              </View>
            )}
            {sortBy !== defaultSortKey && (
              <View style={styles.activeFilterPill}>
                <Text style={styles.activeFilterPillText}>{currentSortLabel}</Text>
                <TouchableOpacity onPress={() => setUserSelectedSortBy(null)}>
                  <Ionicons name="close-circle" size={13} color="#8B1E1E" />
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity style={styles.resetFiltersBtn} onPress={resetFilters}>
              <Text style={styles.resetFiltersBtnText}>Đặt lại</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── EXPERT LIST & FEATURED CAROUSEL ── */}
      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Đang tải danh sách chuyên gia...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerError}>
          <Ionicons name="alert-circle-outline" size={44} color={theme.colors.error} />
          <Text style={styles.errorTitle}>Không thể tải dữ liệu</Text>
          <Text style={styles.errorMsg}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchExperts(false, 1)}>
            <Text style={styles.retryBtnText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={displayedExperts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[theme.colors.primary]}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListHeaderComponent={
            <>
              {/* Banner Slide Chuyên gia đề xuất hàng đầu (Hiển thị khi không gõ tìm kiếm) */}
              {displayedFeatured.length > 0 && !keyword.trim() && (
                <FeaturedExpertBannerCarousel
                  items={displayedFeatured}
                  onPressExpert={(expertId) =>
                    navigation.navigate('ExpertDetail', { expertProfileId: expertId })
                  }
                />
              )}

              <View style={styles.listHeaderRow}>
                <Text style={styles.listCountText}>
                  Tìm thấy <Text style={styles.boldText}>{displayedExperts.length}</Text> chuyên gia
                </Text>
                {sortBy && (
                  <Text style={styles.listSortHintText}>
                    Xếp theo: <Text style={styles.boldText}>{currentSortLabel}</Text>
                  </Text>
                )}
              </View>
            </>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={48} color="#CCCCCC" />
              <Text style={styles.emptyTitle}>Không tìm thấy chuyên gia phù hợp</Text>
              <Text style={styles.emptySubtitle}>
                Vui lòng thử tìm với từ khóa khác hoặc bỏ bớt các bộ lọc tiêu chí.
              </Text>
              <TouchableOpacity style={styles.resetBtn} onPress={resetFilters}>
                <Text style={styles.resetBtnText}>Xóa tất cả bộ lọc</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => (
            <ExpertListItemCard
              item={item}
              onPress={() =>
                navigation.navigate('ExpertDetail', { expertProfileId: item.id })
              }
            />
          )}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoading}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Text style={styles.footerLoadingText}>Đang tải thêm chuyên gia...</Text>
              </View>
            ) : null
          }
        />
      )}

      {/* ── SPECIALIZATION DROPDOWN MODAL ── */}
      <Modal
        visible={specModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSpecModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSpecModalVisible(false)}
        >
          <View style={styles.sortModalBox}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalHeaderTitle}>Chọn lĩnh vực chuyên môn</Text>
              <TouchableOpacity onPress={() => setSpecModalVisible(false)}>
                <Ionicons name="close" size={22} color="#666666" />
              </TouchableOpacity>
            </View>
            <GoldDoubleRule style={{ marginVertical: 8 }} />

            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              {/* Option: Tất cả lĩnh vực */}
              <TouchableOpacity
                style={[
                  styles.sortOptionRow,
                  selectedSpecId === null && styles.sortOptionSelected,
                ]}
                onPress={() => {
                  setSelectedSpecId(null);
                  setSpecModalVisible(false);
                }}
              >
                <Text
                  style={[
                    styles.sortOptionText,
                    selectedSpecId === null && styles.sortOptionTextActive,
                  ]}
                >
                  Tất cả lĩnh vực chuyên môn
                </Text>
                {selectedSpecId === null && (
                  <Ionicons name="checkmark-circle" size={18} color={theme.colors.primary} />
                )}
              </TouchableOpacity>

              {/* Specializations list */}
              {specializations.map((spec) => {
                const selected = selectedSpecId === spec.id;
                return (
                  <TouchableOpacity
                    key={spec.id}
                    style={[styles.sortOptionRow, selected && styles.sortOptionSelected]}
                    onPress={() => {
                      setSelectedSpecId(spec.id);
                      setSpecModalVisible(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.sortOptionText,
                        selected && styles.sortOptionTextActive,
                        { flex: 1, marginRight: 8 },
                      ]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {spec.name}
                    </Text>
                    {selected && (
                      <Ionicons name="checkmark-circle" size={18} color={theme.colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── TIME FILTER DROPDOWN MODAL ── */}
      <Modal
        visible={timeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTimeModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setTimeModalVisible(false)}
        >
          <View style={styles.sortModalBox}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalHeaderTitle}>Thời gian có lịch tư vấn</Text>
              <TouchableOpacity onPress={() => setTimeModalVisible(false)}>
                <Ionicons name="close" size={22} color="#666666" />
              </TouchableOpacity>
            </View>
            <GoldDoubleRule style={{ marginVertical: 8 }} />

            {TIME_FILTERS.map((tf) => {
              const selected = timeFilter === tf.key;
              return (
                <TouchableOpacity
                  key={tf.key}
                  style={[styles.sortOptionRow, selected && styles.sortOptionSelected]}
                  onPress={() => {
                    setTimeFilter(tf.key);
                    setTimeModalVisible(false);
                  }}
                >
                  <Text style={[styles.sortOptionText, selected && styles.sortOptionTextActive]}>
                    {tf.label}
                  </Text>
                  {selected && (
                    <Ionicons name="checkmark-circle" size={18} color={theme.colors.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── SORT MODAL ── */}
      <Modal
        visible={sortModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSortModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSortModalVisible(false)}
        >
          <View style={styles.sortModalBox}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalHeaderTitle}>Sắp xếp danh sách chuyên gia</Text>
              <TouchableOpacity onPress={() => setSortModalVisible(false)}>
                <Ionicons name="close" size={22} color="#666666" />
              </TouchableOpacity>
            </View>
            <GoldDoubleRule style={{ marginVertical: 8 }} />

            {dynamicSortOptions.map((opt) => {
              const selected = sortBy === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.sortOptionRow, selected && styles.sortOptionSelected]}
                  onPress={() => {
                    setUserSelectedSortBy(opt.key === defaultSortKey ? null : opt.key);
                    setSortModalVisible(false);
                  }}
                >
                  <Text style={[styles.sortOptionText, selected && styles.sortOptionTextActive]}>
                    {opt.label}
                    {opt.key === defaultSortKey ? ' (Mặc định)' : ''}
                  </Text>
                  {selected && (
                    <Ionicons name="checkmark-circle" size={18} color={theme.colors.primary} />
                  )}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(243, 239, 230, 0.85)',
  },
  headerTitleWrap: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 18,
    lineHeight: 24,
    color: theme.colors.primaryDark,
  },
  headerSubtitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11.5,
    color: '#5A4A22',
    marginTop: 1,
  },
  headerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 253, 247, 0.92)',
    borderWidth: 1,
    borderColor: theme.colors.goldLight,
    gap: 4,
  },
  headerActionText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: theme.colors.primary,
  },

  searchSection: {
    backgroundColor: 'transparent',
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 253, 247, 0.94)',
    marginHorizontal: 16,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    borderWidth: 1,
    borderColor: '#E5D5B5',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    color: theme.colors.textPrimary,
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 4,
  },

  filterDropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
    gap: 8,
  },
  filterDropdownBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAF6EE',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E6DCBF',
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
    color: '#FFFFFF',
    fontFamily: fonts.bodyBold,
  },

  activeFiltersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 2,
    gap: 6,
  },
  activeFiltersLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#786F66',
  },
  activeFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDF2F2',
    borderWidth: 1,
    borderColor: '#F8B4B4',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 14,
    gap: 4,
    maxWidth: '55%',
  },
  activeFilterPillText: {
    fontFamily: fonts.bodySemi,
    fontSize: 10.5,
    color: '#8B1E1E',
    flexShrink: 1,
  },
  resetFiltersBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 12,
    backgroundColor: '#F3EFE6',
  },
  resetFiltersBtnText: {
    fontFamily: fonts.bodySemi,
    fontSize: 10.5,
    color: '#6B7280',
  },

  listContent: {
    padding: 16,
    paddingBottom: 32,
  },

  // Featured experts Banner Slide Carousel
  featuredContainer: {
    marginBottom: 18,
  },
  bannerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  sectionIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: theme.colors.primary,
    borderWidth: 1,
    borderColor: '#D4AF37',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 15,
    color: theme.colors.primaryDark,
  },
  sectionSubtitle: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    color: '#7A6A53',
    marginTop: 1,
  },
  bannerNavControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF5EA',
    borderWidth: 1,
    borderColor: '#E5D5B5',
    borderRadius: 16,
    paddingHorizontal: 6,
    paddingVertical: 3,
    gap: 6,
  },
  bannerArrowBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerCounterText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: theme.colors.primaryDark,
    fontVariant: ['tabular-nums'],
  },
  bannerFlatListContent: {
    paddingVertical: 2,
  },
  bannerSlideCard: {
    backgroundColor: '#7A1616',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#D4AF37',
    overflow: 'hidden',
    shadowColor: '#4A0D0D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 4,
  },
  bannerGoldTopAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#FBBF24',
  },
  bannerTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  bannerTopLeftBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  bannerRankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDE68A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  bannerRankText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: '#6B1414',
    letterSpacing: 0.3,
  },
  bannerCertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 253, 247, 0.14)',
    borderWidth: 0.5,
    borderColor: 'rgba(253, 230, 138, 0.45)',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    gap: 3,
  },
  bannerCertText: {
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    color: '#FDE68A',
  },
  bannerSlotReadyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.22)',
    borderWidth: 0.5,
    borderColor: '#6EE7B7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
    maxWidth: '46%',
  },
  bannerSlotDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34D399',
  },
  bannerSlotReadyText: {
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    color: '#D1FAE5',
    flexShrink: 1,
  },
  bannerSlotFlexPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 3,
  },
  bannerSlotFlexText: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: '#E5D5B5',
  },
  bannerBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bannerAvatarContainer: {
    position: 'relative',
  },
  bannerAvatarImg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#FDE68A',
    backgroundColor: '#5C1010',
  },
  bannerAvatarFallback: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#FDE68A',
    backgroundColor: '#5C1010',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerAvatarInitial: {
    fontFamily: fonts.serifBold,
    fontSize: 24,
    color: '#FDE68A',
  },
  bannerVerifiedBadge: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#059669',
    borderWidth: 1.5,
    borderColor: '#FFFDF7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerInfoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  bannerExpertName: {
    fontFamily: fonts.serifBold,
    fontSize: 16.5,
    color: '#FFFDF7',
  },
  bannerJobCompany: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: '#FDE68A',
    marginTop: 2,
  },
  bannerMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  bannerRatingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
    borderWidth: 0.5,
    borderColor: 'rgba(251, 191, 36, 0.5)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    gap: 3,
  },
  bannerRatingVal: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: '#FDE68A',
  },
  bannerReviewCnt: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: '#F3E8D2',
  },
  bannerMetricDividerPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  bannerMetricText: {
    fontFamily: fonts.bodySemi,
    fontSize: 10.5,
    color: '#FFFDF7',
  },
  bannerSpecsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 7,
  },
  bannerSpecChip: {
    backgroundColor: 'rgba(255, 253, 247, 0.12)',
    borderWidth: 0.5,
    borderColor: 'rgba(235, 221, 192, 0.35)',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 5,
    maxWidth: '46%',
    flexShrink: 1,
  },
  bannerSpecChipText: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    color: '#F5EFE6',
  },
  bannerSpecMoreChip: {
    backgroundColor: 'rgba(253, 230, 138, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 5,
  },
  bannerSpecMoreText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: '#FDE68A',
  },
  bannerFooterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(253, 230, 138, 0.22)',
  },
  bannerFeeWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  bannerFeeLabel: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    color: '#E5D5B5',
  },
  bannerFeeValue: {
    fontFamily: fonts.serifBold,
    fontSize: 16,
    color: '#FDE68A',
    fontVariant: ['tabular-nums'],
  },
  bannerCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDE68A',
    paddingHorizontal: 12,
    paddingVertical: 6.5,
    borderRadius: 8,
    gap: 5,
  },
  bannerCtaBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: '#6B1414',
  },
  bannerDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    gap: 6,
  },
  bannerDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#D6C7B2',
  },
  bannerDotActive: {
    width: 22,
    backgroundColor: theme.colors.primary,
  },

  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  listCountText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  listSortHintText: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    color: '#7A6A53',
  },
  boldText: {
    fontFamily: fonts.bodyBold,
    color: theme.colors.textPrimary,
  },

  // Expert Card
  expertCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ECE6DC',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardAvatarWrap: {
    marginRight: 12,
  },
  cardAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#E8DEC8',
    backgroundColor: '#FAF5EE',
  },
  cardAvatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FAF5EE',
    borderWidth: 1,
    borderColor: '#E8DEC8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardAvatarLetter: {
    fontFamily: fonts.serifBold,
    fontSize: 22,
    color: '#8B1E1E',
  },
  cardInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  cardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardName: {
    fontFamily: fonts.serifBold,
    fontSize: 16,
    color: theme.colors.textPrimary,
    flexShrink: 1,
  },
  cardJobTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: 12.5,
    color: '#8B1E1E',
    marginTop: 2,
  },
  cardCompany: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  cardHighlights: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 7,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 4,
    gap: 3,
    borderWidth: 0.5,
    borderColor: '#FDE68A',
  },
  ratingText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: '#B45309',
  },
  reviewCount: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: '#92400E',
  },
  highlightBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 4,
  },
  highlightText: {
    fontFamily: fonts.bodySemi,
    fontSize: 10.5,
    color: '#4B5563',
  },
  certHighlightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 0.5,
    borderColor: '#A7F3D0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 3,
  },
  certHighlightText: {
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    color: '#065F46',
  },

  specTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    width: '100%',
    overflow: 'hidden',
  },
  specTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF5EA',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: '#E8DEC8',
    maxWidth: '85%',
    flexShrink: 1,
  },
  specTagText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#78350F',
    flexShrink: 1,
  },
  specTagMore: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: 6,
    flexShrink: 0,
  },
  specTagMoreText: {
    fontFamily: fonts.bodySemi,
    fontSize: 11,
    color: '#6B7280',
  },

  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3EFE6',
  },
  footerLeft: {
    flex: 1,
    marginRight: 10,
  },
  feeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 3,
  },
  feeLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#6B7280',
  },
  feeValue: {
    fontFamily: fonts.serifBold,
    fontSize: 15,
    color: '#8B1E1E',
    fontVariant: ['tabular-nums'],
  },
  slotAvailableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 4,
    gap: 3,
    alignSelf: 'flex-start',
  },
  slotAvailableText: {
    fontFamily: fonts.bodySemi,
    fontSize: 10.5,
    color: '#065F46',
  },
  slotBusyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 4,
    gap: 3,
    alignSelf: 'flex-start',
  },
  slotBusyText: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    color: '#6B7280',
  },
  bookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 8,
    gap: 2,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  bookBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
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
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 15,
    color: theme.colors.textPrimary,
    marginTop: 10,
  },
  emptySubtitle: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  resetBtn: {
    backgroundColor: '#FAF5EA',
    borderWidth: 1,
    borderColor: theme.colors.gold,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 16,
  },
  resetBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: theme.colors.primary,
  },

  footerLoading: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  footerLoadingText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },

  // Modal Sắp xếp
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sortModalBox: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 18,
    paddingBottom: 32,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalHeaderTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  sortOptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  sortOptionSelected: {
    backgroundColor: '#FAF5EE',
  },
  sortOptionText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  sortOptionTextActive: {
    fontFamily: fonts.bodyBold,
    color: theme.colors.primary,
  },
});
