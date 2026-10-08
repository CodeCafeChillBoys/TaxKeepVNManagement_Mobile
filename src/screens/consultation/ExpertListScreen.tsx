import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { GoldDoubleRule } from '../../components/brand/GoldDoubleRule';
import { RootNavigationProp } from '../../navigation/types';
import { consultationApi } from '../../api/consultationApi';
import type {
  ExpertListItemResponse,
  SpecializationDto,
  ExpertSortBy,
  ExpertTimeFilter,
} from '../../types/consultation';
import { formatVnd, formatVietnameseDate } from '../../types/consultation';

const TIME_FILTERS: { key: ExpertTimeFilter; label: string }[] = [
  { key: 'All', label: 'Tất cả lịch' },
  { key: 'Today', label: 'Hôm nay' },
  { key: 'Tomorrow', label: 'Ngày mai' },
  { key: 'ThisWeekend', label: 'Cuối tuần' },
  { key: 'Next7Days', label: '7 ngày tới' },
];

const SORT_OPTIONS: { key: ExpertSortBy; label: string }[] = [
  { key: 'Recommended', label: 'Đề xuất ưu tiên' },
  { key: 'RatingDesc', label: 'Đánh giá cao nhất' },
  { key: 'FeeAsc', label: 'Mức phí thấp nhất' },
  { key: 'FeeDesc', label: 'Mức phí cao nhất' },
  { key: 'ExperienceDesc', label: 'Kinh nghiệm nhiều nhất' },
  { key: 'CompletedSessionsDesc', label: 'Nhiều ca hoàn thành' },
];

export const ExpertListScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();

  const [keyword, setKeyword] = useState('');
  const [selectedSpecId, setSelectedSpecId] = useState<number | null>(null);
  const [timeFilter, setTimeFilter] = useState<ExpertTimeFilter>('All');
  const [sortBy, setSortBy] = useState<ExpertSortBy>('Recommended');
  const [sortModalVisible, setSortModalVisible] = useState(false);

  const [specializations, setSpecializations] = useState<SpecializationDto[]>([]);
  const [featuredExperts, setFeaturedExperts] = useState<ExpertListItemResponse[]>([]);
  const [experts, setExperts] = useState<ExpertListItemResponse[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Tải danh mục lĩnh vực & chuyên gia nổi bật ban đầu
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [specs, featured] = await Promise.all([
          consultationApi.getSpecializations(true),
          consultationApi.getFeaturedExperts(5),
        ]);
        if (mounted) {
          setSpecializations(specs);
          setFeaturedExperts(featured);
        }
      } catch (e) {
        console.warn('Load specs/featured error:', e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Fetch danh sách chuyên gia
  const fetchExperts = useCallback(
    async (isRefresh = false, pageNum = 1) => {
      if (isRefresh) setRefreshing(true);
      else if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      setError(null);
      try {
        const result = await consultationApi.searchExperts({
          keyword: keyword.trim() || undefined,
          specializationIds: selectedSpecId ? [selectedSpecId] : undefined,
          timeFilter,
          sortBy,
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
    [keyword, selectedSpecId, timeFilter, sortBy]
  );

  useEffect(() => {
    fetchExperts(false, 1);
  }, [fetchExperts]);

  const handleRefresh = () => {
    fetchExperts(true, 1);
  };

  const handleLoadMore = () => {
    if (!loading && !loadingMore && hasMore) {
      fetchExperts(false, page + 1);
    }
  };

  const resetFilters = () => {
    setKeyword('');
    setSelectedSpecId(null);
    setTimeFilter('All');
    setSortBy('Recommended');
  };

  const currentSortLabel = useMemo(() => {
    return SORT_OPTIONS.find((s) => s.key === sortBy)?.label || 'Sắp xếp';
  }, [sortBy]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* ── HEADER ── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation.navigate('Home')}
          accessibilityRole="button"
          accessibilityLabel="Về trang chủ"
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

      {/* ── SEARCH & FILTER CONTROLS ── */}
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

        {/* Specialization Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.specScrollContent}
        >
          <TouchableOpacity
            style={[styles.specChip, selectedSpecId === null && styles.specChipActive]}
            onPress={() => setSelectedSpecId(null)}
          >
            <Text
              style={[
                styles.specChipText,
                selectedSpecId === null && styles.specChipTextActive,
              ]}
            >
              Tất cả lĩnh vực
            </Text>
          </TouchableOpacity>
          {specializations.map((spec) => {
            const isSelected = selectedSpecId === spec.id;
            return (
              <TouchableOpacity
                key={spec.id}
                style={[styles.specChip, isSelected && styles.specChipActive]}
                onPress={() => setSelectedSpecId(isSelected ? null : spec.id)}
              >
                <Text style={[styles.specChipText, isSelected && styles.specChipTextActive]}>
                  {spec.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Secondary Filter Row: Time Filter & Sort Dropdown */}
        <View style={styles.secondaryFilterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timeScroll}>
            {TIME_FILTERS.map((tf) => {
              const active = timeFilter === tf.key;
              return (
                <TouchableOpacity
                  key={tf.key}
                  style={[styles.timeChip, active && styles.timeChipActive]}
                  onPress={() => setTimeFilter(tf.key)}
                >
                  <Text style={[styles.timeChipText, active && styles.timeChipTextActive]}>
                    {tf.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            style={styles.sortBtn}
            onPress={() => setSortModalVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Chọn sắp xếp"
          >
            <Ionicons name="swap-vertical" size={14} color={theme.colors.primary} />
            <Text style={styles.sortBtnText} numberOfLines={1}>
              {currentSortLabel}
            </Text>
          </TouchableOpacity>
        </View>
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
          data={experts}
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
              {/* Chuyên gia nổi bật (Hiển thị khi không gõ tìm kiếm và trang 1) */}
              {featuredExperts.length > 0 && !keyword && (
                <View style={styles.featuredContainer}>
                  <View style={styles.sectionTitleRow}>
                    <Ionicons name="ribbon" size={18} color={theme.colors.gold} />
                    <Text style={styles.sectionTitle}>Chuyên gia đề xuất hàng đầu</Text>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.featuredScroll}
                  >
                    {featuredExperts.map((exp) => (
                      <TouchableOpacity
                        key={exp.id}
                        style={styles.featuredCard}
                        activeOpacity={0.85}
                        onPress={() =>
                          navigation.navigate('ExpertDetail', { expertProfileId: exp.id })
                        }
                      >
                        <View style={styles.featuredAvatarWrap}>
                          {exp.avatarUrl ? (
                            <Image source={{ uri: exp.avatarUrl }} style={styles.featuredAvatar} />
                          ) : (
                            <View style={styles.avatarPlaceholder}>
                              <Text style={styles.avatarLetter}>
                                {exp.fullName.trim().charAt(exp.fullName.trim().length - 1)}
                              </Text>
                            </View>
                          )}
                          <View style={styles.verifiedDot}>
                            <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                          </View>
                        </View>
                        <Text style={styles.featuredName} numberOfLines={1}>
                          {exp.fullName}
                        </Text>
                        <Text style={styles.featuredJob} numberOfLines={1}>
                          {exp.jobTitle || 'Chuyên gia thuế'}
                        </Text>
                        <View style={styles.featuredRatingRow}>
                          <Ionicons name="star" size={13} color="#F59E0B" />
                          <Text style={styles.featuredRatingText}>
                            {exp.rating > 0 ? exp.rating.toFixed(1) : '5.0'}
                          </Text>
                          <Text style={styles.featuredSessionsText}>
                            ({exp.completedConsultationsCount} ca)
                          </Text>
                        </View>
                        <View style={styles.featuredFeeBadge}>
                          <Text style={styles.featuredFeeText}>
                            Từ {formatVnd(exp.startingFee)}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              <View style={styles.listHeaderRow}>
                <Text style={styles.listCountText}>
                  Tìm thấy <Text style={styles.boldText}>{experts.length}</Text> chuyên gia
                </Text>
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
            <TouchableOpacity
              style={styles.expertCard}
              activeOpacity={0.88}
              onPress={() => navigation.navigate('ExpertDetail', { expertProfileId: item.id })}
            >
              {/* Top row: Avatar & Identity */}
              <View style={styles.cardTopRow}>
                <View style={styles.cardAvatarWrap}>
                  {item.avatarUrl ? (
                    <Image source={{ uri: item.avatarUrl }} style={styles.cardAvatar} />
                  ) : (
                    <View style={styles.cardAvatarPlaceholder}>
                      <Text style={styles.cardAvatarLetter}>
                        {item.fullName.trim().charAt(item.fullName.trim().length - 1)}
                      </Text>
                    </View>
                  )}
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="shield-checkmark" size={12} color="#FFFFFF" />
                  </View>
                </View>

                <View style={styles.cardInfo}>
                  <View style={styles.cardNameRow}>
                    <Text style={styles.cardName} numberOfLines={1}>
                      {item.fullName}
                    </Text>
                  </View>
                  <Text style={styles.cardJobTitle} numberOfLines={1}>
                    {item.jobTitle || 'Chuyên gia tư vấn thuế'}
                  </Text>
                  {item.companyName ? (
                    <Text style={styles.cardCompany} numberOfLines={1}>
                      <Ionicons name="business-outline" size={12} color="#666666" />{' '}
                      {item.companyName}
                    </Text>
                  ) : null}

                  {/* Highlights row */}
                  <View style={styles.cardHighlights}>
                    <View style={styles.ratingBadge}>
                      <Ionicons name="star" size={13} color="#F59E0B" />
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
                          {item.completedConsultationsCount} ca hoàn thành
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              {/* Specialization Tags */}
              {item.specializationNames && item.specializationNames.length > 0 && (
                <View style={styles.specTagsRow}>
                  {item.specializationNames.slice(0, 3).map((s, idx) => (
                    <View key={idx} style={styles.specTag}>
                      <Text style={styles.specTagText}>{s}</Text>
                    </View>
                  ))}
                  {item.specializationNames.length > 3 && (
                    <View style={styles.specTagMore}>
                      <Text style={styles.specTagMoreText}>
                        +{item.specializationNames.length - 3}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Card Footer: Fee & Availability */}
              <View style={styles.cardFooter}>
                <View style={styles.feeWrap}>
                  <Text style={styles.feeLabel}>Mức phí từ</Text>
                  <Text style={styles.feeValue}>{formatVnd(item.startingFee)}</Text>
                </View>

                {item.hasAvailableSlotSoon ? (
                  <View style={styles.slotAvailableBadge}>
                    <Ionicons name="time" size={12} color="#059669" />
                    <Text style={styles.slotAvailableText}>
                      {item.earliestAvailableDate
                        ? `Lịch sớm: ${formatVietnameseDate(item.earliestAvailableDate)}`
                        : 'Có lịch rảnh'}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.slotBusyBadge}>
                    <Text style={styles.slotBusyText}>Xem lịch</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.bookBtn}
                  onPress={() =>
                    navigation.navigate('ExpertDetail', { expertProfileId: item.id })
                  }
                >
                  <Text style={styles.bookBtnText}>Xem & Đặt lịch</Text>
                  <Ionicons name="chevron-forward" size={14} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
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

            {SORT_OPTIONS.map((opt) => {
              const selected = sortBy === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.sortOptionRow, selected && styles.sortOptionSelected]}
                  onPress={() => {
                    setSortBy(opt.key);
                    setSortModalVisible(false);
                  }}
                >
                  <Text style={[styles.sortOptionText, selected && styles.sortOptionTextActive]}>
                    {opt.label}
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
    backgroundColor: '#FFFFFF',
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3EFE6',
  },
  headerTitleWrap: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 18,
    color: theme.colors.primary,
  },
  headerSubtitle: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  headerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FAF6EE',
    borderWidth: 1,
    borderColor: theme.colors.goldLight,
    gap: 4,
  },
  headerActionText: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: theme.colors.primary,
  },

  searchSection: {
    backgroundColor: '#FFFFFF',
    paddingTop: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.inputBackground,
    marginHorizontal: 16,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    borderWidth: 1,
    borderColor: theme.colors.border,
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

  specScrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  specChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F4EFE6',
    borderWidth: 1,
    borderColor: '#E2DCD0',
  },
  specChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  specChipText: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: theme.colors.textPrimary,
  },
  specChipTextActive: {
    color: '#FFFFFF',
  },

  secondaryFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 4,
    gap: 8,
  },
  timeScroll: {
    flex: 1,
  },
  timeChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F8F6F0',
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#E6E0D4',
  },
  timeChipActive: {
    backgroundColor: '#EAE1D0',
    borderColor: theme.colors.gold,
  },
  timeChipText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#555555',
  },
  timeChipTextActive: {
    fontFamily: fonts.bodyBold,
    color: theme.colors.primaryDark,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#FAF5EA',
    borderWidth: 1,
    borderColor: theme.colors.goldLight,
    maxWidth: 130,
  },
  sortBtnText: {
    fontFamily: fonts.bodySemi,
    fontSize: 11,
    color: theme.colors.primary,
  },

  listContent: {
    padding: 16,
    paddingBottom: 32,
  },

  // Featured experts
  featuredContainer: {
    marginBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 14,
    color: theme.colors.primary,
  },
  featuredScroll: {
    gap: 12,
    paddingRight: 16,
  },
  featuredCard: {
    width: 140,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EBDDC0',
    ...theme.shadows.card,
  },
  featuredAvatarWrap: {
    position: 'relative',
    marginBottom: 6,
  },
  featuredAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#8B1E1E22',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    fontFamily: fonts.serifBold,
    fontSize: 20,
    color: theme.colors.primary,
  },
  verifiedDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: '#059669',
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  featuredName: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  featuredJob: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  featuredRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 6,
  },
  featuredRatingText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: '#D97706',
  },
  featuredSessionsText: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: '#888888',
  },
  featuredFeeBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    width: '100%',
    alignItems: 'center',
  },
  featuredFeeText: {
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    color: '#B45309',
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
  boldText: {
    fontFamily: fonts.bodyBold,
    color: theme.colors.textPrimary,
  },

  // Expert Card
  expertCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  cardTopRow: {
    flexDirection: 'row',
  },
  cardAvatarWrap: {
    position: 'relative',
    marginRight: 12,
  },
  cardAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  cardAvatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#8B1E1E1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardAvatarLetter: {
    fontFamily: fonts.serifBold,
    fontSize: 24,
    color: theme.colors.primary,
  },
  verifiedBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    backgroundColor: '#059669',
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  cardInfo: {
    flex: 1,
  },
  cardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardName: {
    fontFamily: fonts.serifBold,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  cardJobTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: theme.colors.primaryDark,
    marginTop: 1,
  },
  cardCompany: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#666666',
    marginTop: 1,
  },
  cardHighlights: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 2,
    borderWidth: 0.5,
    borderColor: '#FDE68A',
  },
  ratingText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: '#D97706',
  },
  reviewCount: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: '#92400E',
  },
  highlightBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  highlightText: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: '#4B5563',
  },

  specTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3EFE6',
  },
  specTag: {
    backgroundColor: '#FAF5EA',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: '#E8DEC8',
  },
  specTagText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#78350F',
  },
  specTagMore: {
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  specTagMoreText: {
    fontFamily: fonts.bodySemi,
    fontSize: 11,
    color: '#888888',
  },

  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0ECE4',
  },
  feeWrap: {},
  feeLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: '#888888',
  },
  feeValue: {
    fontFamily: fonts.serifBold,
    fontSize: 14,
    color: theme.colors.primary,
    fontVariant: ['tabular-nums'],
  },
  slotAvailableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 3,
  },
  slotAvailableText: {
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    color: '#065F46',
  },
  slotBusyBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  slotBusyText: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: '#6B7280',
  },
  bookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    gap: 2,
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
