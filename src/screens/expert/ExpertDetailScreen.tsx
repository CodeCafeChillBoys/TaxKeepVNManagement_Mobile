import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { HeaderMotif } from '../../components/common/HeaderMotif';
import { DrumPatternBackdrop } from '../../components/brand/DrumPatternBackdrop';
import { RootNavigationProp, RootStackParamList } from '../../navigation/types';
import { Card, Badge, Button, Separator } from '../../components/ui';
import { getExpertById, getSlotsForExpert, getReviewsForExpert } from './expertMockData';

type DetailRouteProp = RouteProp<RootStackParamList, 'ExpertDetail'>;

function formatCurrency(amount: number): string {
  return `${amount.toLocaleString('vi-VN')} đ`;
}

function getInitialLetter(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts[parts.length - 1] || '?').charAt(0).toUpperCase();
}

export const ExpertDetailScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const route = useRoute<DetailRouteProp>();
  const expertId = route.params?.expertId || 'exp-1';

  const expert = useMemo(() => getExpertById(expertId), [expertId]);
  const slots = useMemo(() => getSlotsForExpert(expertId).filter((s) => s.isAvailable), [expertId]);
  const reviews = useMemo(() => getReviewsForExpert(expertId), [expertId]);

  if (!expert) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <HeaderMotif title="HỒ SƠ CHUYÊN GIA" onBack={() => navigation.goBack()} />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Không tìm thấy thông tin chuyên gia.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const initial = getInitialLetter(expert.fullName);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <DrumPatternBackdrop variant="soft" />
      <HeaderMotif title="HỒ SƠ CHUYÊN GIA" onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* PROFILE HEADER CARD */}
        <Card style={styles.cleanCard}>
          <View style={styles.profileHeaderRow}>
            <View style={styles.avatarBox}>
              <Text style={styles.avatarText}>{initial}</Text>
              <View style={styles.verifiedDot}>
                <Ionicons name="checkmark" size={10} color="#FFFFFF" />
              </View>
            </View>

            <View style={styles.profileInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.expertName}>{expert.fullName}</Text>
                <Badge variant="success" style={styles.verifiedBadge}>
                  <Text style={styles.verifiedBadgeText}>Đã xác minh</Text>
                </Badge>
              </View>
              <Text style={styles.expertTitle}>{expert.title}</Text>
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={14} color="#D97706" />
                <Text style={styles.ratingScore}>{expert.rating.toFixed(2)}</Text>
                <Text style={styles.ratingCount}>({expert.reviewCount} đánh giá)</Text>
              </View>
            </View>
          </View>

          <Separator style={styles.divider} />

          {/* STATS MATRIX */}
          <View style={styles.statsGrid}>
            <View style={styles.statCol}>
              <Text style={styles.statValue}>{expert.experienceYears} năm</Text>
              <Text style={styles.statLabel}>Kinh nghiệm</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statValue}>{expert.completedSessions}</Text>
              <Text style={styles.statLabel}>Phiên tư vấn</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statValue}>{expert.responseRatePercent}%</Text>
              <Text style={styles.statLabel}>Phản hồi</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statValue}>{expert.sessionDurationMinutes}p</Text>
              <Text style={styles.statLabel}>Chuẩn block</Text>
            </View>
          </View>
        </Card>

        {/* ESCROW GUARANTEE BANNER */}
        <View style={styles.escrowNoticeRow}>
          <Ionicons name="shield-checkmark" size={16} color="#0F766E" />
          <Text style={styles.escrowNoticeText}>
            Bảo vệ Escrow: Nền tảng tạm giữ thù lao và chỉ giải ngân sau 24h ca hoàn tất.
          </Text>
        </View>

        {/* VERIFIED CERTIFICATES */}
        <Card style={styles.cleanCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="ribbon-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>Chứng chỉ & Giấy phép hành nghề</Text>
          </View>
          <View style={styles.certList}>
            {expert.verifiedCertificates.map((cert) => (
              <View key={cert.id} style={styles.certItemRow}>
                <Ionicons name="checkmark-circle" size={16} color="#16A34A" style={styles.certIcon} />
                <View style={styles.certInfo}>
                  <Text style={styles.certName}>{cert.name}</Text>
                  <Text style={styles.certMeta}>
                    Cấp bởi {cert.issuer} • Năm {cert.issueYear}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </Card>

        {/* SPECIALTIES */}
        <Card style={styles.cleanCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="briefcase-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>Lĩnh vực chuyên môn thế mạnh</Text>
          </View>
          <View style={styles.chipRow}>
            {expert.specialtyLabels.map((label, idx) => (
              <View key={idx} style={styles.specialtyChip}>
                <Text style={styles.specialtyChipText}>{label}</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* BIO & EXPERIENCE SUMMARY */}
        <Card style={styles.cleanCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="information-circle-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>Tóm tắt năng lực</Text>
          </View>
          <Text style={styles.bioText}>{expert.bio}</Text>
        </Card>

        {/* UPCOMING AVAILABLE SLOTS */}
        <Card style={styles.cleanCard}>
          <View style={styles.sectionHeaderBetween}>
            <View style={styles.sectionHeader}>
              <Ionicons name="calendar-outline" size={16} color={theme.colors.primary} />
              <Text style={styles.sectionTitle}>Khung giờ trống gần nhất</Text>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('ExpertBooking', { expertId: expert.id })}
              activeOpacity={0.7}
            >
              <Text style={styles.viewAllSlotsText}>Xem tất cả</Text>
            </TouchableOpacity>
          </View>

          {slots.length === 0 ? (
            <Text style={styles.emptySlotText}>Chuyên gia hiện chưa mở thêm slot trong tuần này.</Text>
          ) : (
            <View style={styles.slotGrid}>
              {slots.slice(0, 4).map((slot) => (
                <TouchableOpacity
                  key={slot.id}
                  style={styles.slotPill}
                  activeOpacity={0.7}
                  onPress={() =>
                    navigation.navigate('ExpertBooking', {
                      expertId: expert.id,
                      slotId: slot.id,
                    })
                  }
                >
                  <Text style={styles.slotDate}>{slot.date.slice(5).replace('-', '/')}</Text>
                  <Text style={styles.slotTime}>{slot.startTime} - {slot.endTime}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Card>

        {/* CLIENT REVIEWS */}
        <Card style={styles.cleanCard}>
          <View style={styles.sectionHeaderBetween}>
            <View style={styles.sectionHeader}>
              <Ionicons name="chatbubbles-outline" size={16} color={theme.colors.primary} />
              <Text style={styles.sectionTitle}>Đánh giá thực tế ({reviews.length})</Text>
            </View>
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={12} color="#D97706" />
              <Text style={styles.ratingBadgeText}>{expert.rating.toFixed(2)} / 5.0</Text>
            </View>
          </View>

          {reviews.length === 0 ? (
            <Text style={styles.emptyReviewText}>Chưa có đánh giá nào cho chuyên gia này.</Text>
          ) : (
            reviews.map((rev) => (
              <View key={rev.id} style={styles.reviewItem}>
                <View style={styles.reviewHeadRow}>
                  <Text style={styles.clientName}>{rev.clientName}</Text>
                  <Text style={styles.reviewDate}>{rev.date}</Text>
                </View>

                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Ionicons
                      key={star}
                      name={star <= rev.rating ? 'star' : 'star-outline'}
                      size={12}
                      color="#D97706"
                    />
                  ))}
                  {rev.tags && rev.tags.length > 0 && (
                    <View style={styles.reviewTagsRow}>
                      {rev.tags.map((t, tidx) => (
                        <View key={tidx} style={styles.reviewTag}>
                          <Text style={styles.reviewTagText}>{t}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                <Text style={styles.reviewComment}>{rev.comment}</Text>

                {rev.expertReply && (
                  <View style={styles.expertReplyRow}>
                    <Text style={styles.expertReplyTitle}>Phản hồi của chuyên gia:</Text>
                    <Text style={styles.expertReplyBody}>{rev.expertReply.comment}</Text>
                  </View>
                )}
              </View>
            ))
          )}
        </Card>
      </ScrollView>

      {/* FIXED BOTTOM ACTION BAR */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomPriceCol}>
          <Text style={styles.bottomPriceLabel}>Phí tư vấn 1 phiên (45p)</Text>
          <Text style={styles.bottomPriceValue}>{formatCurrency(expert.feePerSession)}</Text>
        </View>

        <Button
          variant="default"
          onPress={() => navigation.navigate('ExpertBooking', { expertId: expert.id })}
          style={styles.bookCtaBtn}
          icon={<Ionicons name="calendar" size={16} color="#FFFFFF" />}
        >
          Đặt lịch tư vấn
        </Button>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 88,
    gap: 12,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontFamily: fonts.primary,
  },
  cleanCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    marginVertical: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  avatarBox: {
    width: 60,
    height: 60,
    borderRadius: 6,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: fonts.primary,
  },
  verifiedDot: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 16,
    height: 16,
    borderRadius: 6,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  profileInfo: {
    flex: 1,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  expertName: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    fontFamily: fonts.primary,
    flex: 1,
  },
  verifiedBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  verifiedBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#16A34A',
  },
  expertTitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontFamily: fonts.primary,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  ratingScore: {
    fontSize: 13,
    fontWeight: '700',
    color: '#D97706',
  },
  ratingCount: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  divider: {
    marginVertical: 12,
    backgroundColor: theme.colors.border,
  },
  statsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    fontFamily: fonts.primary,
  },
  statLabel: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
    fontFamily: fonts.primary,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: theme.colors.border,
  },
  escrowNoticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  escrowNoticeText: {
    flex: 1,
    fontSize: 12,
    color: '#0F766E',
    fontFamily: fonts.primary,
    lineHeight: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionHeaderBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    fontFamily: fonts.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  viewAllSlotsText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.primary,
    fontFamily: fonts.primary,
  },
  certList: {
    gap: 10,
  },
  certItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  certIcon: {
    marginTop: 2,
  },
  certInfo: {
    flex: 1,
  },
  certName: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    fontFamily: fonts.primary,
  },
  certMeta: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 1,
    fontFamily: fonts.primary,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  specialtyChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F8F5EE',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 6,
  },
  specialtyChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.textPrimary,
    fontFamily: fonts.primary,
  },
  bioText: {
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.textPrimary,
    fontFamily: fonts.primary,
  },
  emptySlotText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontFamily: fonts.primary,
  },
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slotPill: {
    flex: 1,
    minWidth: '45%',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    gap: 2,
  },
  slotDate: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontFamily: fonts.primary,
  },
  slotTime: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.primary,
    fontFamily: fonts.primary,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  ratingBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  emptyReviewText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontFamily: fonts.primary,
  },
  reviewItem: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 12,
    marginTop: 8,
    gap: 6,
  },
  reviewHeadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clientName: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    fontFamily: fonts.primary,
  },
  reviewDate: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontFamily: fonts.primary,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  reviewTagsRow: {
    flexDirection: 'row',
    gap: 4,
    marginLeft: 8,
  },
  reviewTag: {
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  reviewTagText: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '500',
  },
  reviewComment: {
    fontSize: 12,
    color: theme.colors.textPrimary,
    lineHeight: 18,
    fontFamily: fonts.primary,
  },
  expertReplyRow: {
    backgroundColor: '#F8F9FA',
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    marginTop: 4,
  },
  expertReplyTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  expertReplyBody: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 2,
    fontStyle: 'italic',
  },
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
    gap: 16,
  },
  bottomPriceCol: {
    gap: 2,
  },
  bottomPriceLabel: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontFamily: fonts.primary,
  },
  bottomPriceValue: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.primary,
    fontFamily: fonts.primary,
  },
  bookCtaBtn: {
    flex: 1,
    borderRadius: 6,
    backgroundColor: theme.colors.primary,
    height: 44,
  },
});
