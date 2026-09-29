import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { HeaderMotif } from '../../components/common/HeaderMotif';
import { DrumPatternBackdrop } from '../../components/brand/DrumPatternBackdrop';
import { RootNavigationProp } from '../../navigation/types';
import { Card, Badge, Button } from '../../components/ui';
import { MOCK_EXPERTS, MOCK_BOOKINGS } from './expertMockData';
import { ExpertProfile, ConsultationBooking } from '../../types/expert';

type TabView = 'EXPERTS' | 'MY_BOOKINGS';

const FILTER_TAGS = [
  { id: 'ALL', label: 'Tất cả' },
  { id: 'TNCN_MULTI_INCOME', label: 'TNCN nhiều nguồn' },
  { id: 'DEPENDENT_DEDUCTION', label: 'Người phụ thuộc' },
  { id: 'STOCK_CRYPTO', label: 'Chứng khoán' },
  { id: 'TAX_AUDIT_RISK', label: 'Rà soát rủi ro' },
];

function formatCurrency(amount: number): string {
  return `${amount.toLocaleString('vi-VN')} đ`;
}

function getInitialLetter(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts[parts.length - 1] || '?').charAt(0).toUpperCase();
}

function getBookingStatusBadge(status: ConsultationBooking['status']) {
  switch (status) {
    case 'CONFIRMED':
      return { variant: 'default' as const, label: 'Đã xác nhận' };
    case 'IN_PROGRESS':
      return { variant: 'warning' as const, label: 'Đang diễn ra' };
    case 'COMPLETED':
      return { variant: 'success' as const, label: 'Đã hoàn tất' };
    case 'PENDING_PAYMENT':
      return { variant: 'warning' as const, label: 'Chờ thanh toán' };
    case 'DISPUTED':
      return { variant: 'destructive' as const, label: 'Đang tranh chấp' };
    default:
      return { variant: 'secondary' as const, label: 'Đã hủy' };
  }
}

export const ExpertListScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const [activeTab, setActiveTab] = useState<TabView>('EXPERTS');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('ALL');

  const filteredExperts = useMemo(() => {
    return MOCK_EXPERTS.filter((exp) => {
      const matchQuery =
        !searchQuery.trim() ||
        exp.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        exp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        exp.specialtyLabels.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchTag =
        selectedTag === 'ALL' || exp.specialties.includes(selectedTag as any);

      return matchQuery && matchTag;
    });
  }, [searchQuery, selectedTag]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <DrumPatternBackdrop variant="soft" />
      <HeaderMotif title="TƯ VẤN CHUYÊN GIA THUẾ" onBack={() => navigation.goBack()} />

      {/* TOP TABS: TÌM CHUYÊN GIA / LỊCH HẸN CỦA TÔI */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'EXPERTS' && styles.tabBtnActive]}
          onPress={() => setActiveTab('EXPERTS')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabBtnText, activeTab === 'EXPERTS' && styles.tabBtnTextActive]}>
            Danh bạ chuyên gia
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'MY_BOOKINGS' && styles.tabBtnActive]}
          onPress={() => setActiveTab('MY_BOOKINGS')}
          activeOpacity={0.8}
        >
          <View style={styles.tabBadgeRow}>
            <Text style={[styles.tabBtnText, activeTab === 'MY_BOOKINGS' && styles.tabBtnTextActive]}>
              Lịch hẹn của tôi
            </Text>
            {MOCK_BOOKINGS.length > 0 && (
              <View style={styles.tabCountPill}>
                <Text style={styles.tabCountText}>{MOCK_BOOKINGS.length}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'EXPERTS' ? (
          <>
            {/* WORKSPACE SHORTCUT */}
            <TouchableOpacity
              style={styles.expertWorkspaceBanner}
              onPress={() => navigation.navigate('ExpertDashboard')}
              activeOpacity={0.7}
            >
              <Ionicons name="briefcase-outline" size={16} color={theme.colors.primary} />
              <Text style={styles.expertWorkspaceText}>Bàn làm việc Chuyên gia (Đặc tả 8)</Text>
              <Ionicons name="chevron-forward" size={14} color={theme.colors.primary} />
            </TouchableOpacity>

            {/* SEARCH BOX */}
            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={18} color="#64748B" />
              <TextInput
                style={styles.searchInput}
                placeholder="Tìm tên chuyên gia, chủ đề thuế..."
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={16} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>

            {/* HORIZONTAL SPECIALTY FILTER TAGS */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterScroll}
            >
              {FILTER_TAGS.map((tag) => {
                const isSelected = selectedTag === tag.id;
                return (
                  <TouchableOpacity
                    key={tag.id}
                    style={[styles.filterChip, isSelected && styles.filterChipActive]}
                    onPress={() => setSelectedTag(tag.id)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                      {tag.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* LIST OF EXPERTS */}
            <View style={styles.listSection}>
              {filteredExperts.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="search-outline" size={40} color="#94A3B8" />
                  <Text style={styles.emptyTitle}>Không tìm thấy chuyên gia phù hợp</Text>
                  <Text style={styles.emptySub}>Vui lòng thử từ khóa khác hoặc thay đổi bộ lọc.</Text>
                </View>
              ) : (
                filteredExperts.map((expert) => (
                  <Card key={expert.id} style={styles.expertCard}>
                    {/* Header: Avatar, Name, Title */}
                    <View style={styles.expertHeaderRow}>
                      <View style={styles.avatarCircle}>
                        <Text style={styles.avatarText}>{getInitialLetter(expert.fullName)}</Text>
                      </View>
                      <View style={styles.headerInfo}>
                        <View style={styles.nameRow}>
                          <Text style={styles.expertName} numberOfLines={1}>
                            {expert.fullName}
                          </Text>
                          <Ionicons name="checkmark-circle" size={16} color={theme.colors.primary} />
                        </View>
                        <Text style={styles.expertTitle} numberOfLines={1}>
                          {expert.title}
                        </Text>
                      </View>
                    </View>

                    {/* Verified Certificate Badges */}
                    <View style={styles.certRow}>
                      {expert.verifiedCertificates.map((cert) => (
                        <Badge key={cert.id} variant="secondary" style={styles.certBadge}>
                          {cert.type === 'CPA' ? 'CPA Việt Nam' : cert.type === 'LAWYER' ? 'Luật sư Thuế' : 'Đại lý Thuế'}
                        </Badge>
                      ))}
                      <Badge variant="outline" style={styles.expBadge}>
                        {expert.experienceYears} năm KN
                      </Badge>
                    </View>

                    {/* Stats bar */}
                    <View style={styles.statsRow}>
                      <View style={styles.statItem}>
                        <Ionicons name="star" size={14} color="#D97706" />
                        <Text style={styles.statVal}>{expert.rating}</Text>
                        <Text style={styles.statLabel}>({expert.reviewCount})</Text>
                      </View>
                      <View style={styles.statDivider} />
                      <View style={styles.statItem}>
                        <Ionicons name="videocam-outline" size={14} color="#64748B" />
                        <Text style={styles.statLabel}>{expert.completedSessions} ca hoàn thành</Text>
                      </View>
                      <View style={styles.statDivider} />
                      <View style={styles.statItem}>
                        <Ionicons name="flash-outline" size={14} color="#16A34A" />
                        <Text style={styles.statLabel}>{expert.responseRatePercent}% phản hồi</Text>
                      </View>
                    </View>

                    {/* Fee & Action Buttons */}
                    <View style={styles.actionRow}>
                      <View>
                        <Text style={styles.feeLabel}>Mức phí niêm yết</Text>
                        <Text style={styles.feeAmount}>
                          {formatCurrency(expert.feePerSession)}
                          <Text style={styles.feeUnit}> / 45p</Text>
                        </Text>
                      </View>

                      <View style={styles.btnGroup}>
                        <Button
                          variant="outline"
                          size="sm"
                          style={styles.detailBtn}
                          onPress={() => navigation.navigate('ExpertDetail', { expertId: expert.id })}
                        >
                          Hồ sơ
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          style={styles.bookBtn}
                          onPress={() => navigation.navigate('ExpertBooking', { expertId: expert.id })}
                        >
                          Đặt lịch
                        </Button>
                      </View>
                    </View>
                  </Card>
                ))
              )}
            </View>
          </>
        ) : (
          /* TAB 2: LỊCH HẸN CỦA TÔI */
          <View style={styles.listSection}>
            {MOCK_BOOKINGS.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="calendar-outline" size={40} color="#94A3B8" />
                <Text style={styles.emptyTitle}>Chưa có lịch hẹn tư vấn nào</Text>
                <Text style={styles.emptySub}>Hãy chọn chuyên gia phù hợp để nhận giải đáp trực tiếp 1-1.</Text>
              </View>
            ) : (
              MOCK_BOOKINGS.map((booking) => {
                const statusBadge = getBookingStatusBadge(booking.status);
                return (
                  <Card key={booking.bookingId} style={styles.bookingCard}>
                    <View style={styles.bookingHeader}>
                      <View style={styles.bookingIdRow}>
                        <Text style={styles.bookingIdText}>{booking.bookingId}</Text>
                        <Badge variant={statusBadge.variant} style={styles.statusBadge}>
                          {statusBadge.label}
                        </Badge>
                      </View>
                      <Text style={styles.bookingDate}>
                        {booking.date} · {booking.timeSlot}
                      </Text>
                    </View>

                    <View style={styles.bookingBody}>
                      <Text style={styles.bookingTopic} numberOfLines={2}>
                        {booking.topic}
                      </Text>
                      <View style={styles.expertMiniRow}>
                        <Ionicons name="person-outline" size={14} color="#64748B" />
                        <Text style={styles.expertMiniName}>{booking.expertName} ({booking.expertTitle})</Text>
                      </View>

                      <View style={styles.escrowNoticeRow}>
                        <Ionicons name="shield-checkmark" size={14} color="#15803D" />
                        <Text style={styles.escrowNoticeText}>
                          {booking.escrowStatus === 'HELD'
                            ? 'Bảo đảm Escrow: Tiền tạm giữ an toàn, bảo vệ 24h sau ca'
                            : 'Đã giải ngân cho chuyên gia'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.bookingFooter}>
                      <Text style={styles.bookingAmountText}>
                        Tổng: <Text style={styles.bookingAmountVal}>{formatCurrency(booking.totalAmount)}</Text>
                      </Text>
                      <Button
                        variant={booking.status === 'CONFIRMED' ? 'default' : 'outline'}
                        size="sm"
                        style={styles.bookingActionBtn}
                        onPress={() =>
                          navigation.navigate('ExpertConsultationDetail', { bookingId: booking.bookingId })
                        }
                      >
                        {booking.status === 'CONFIRMED' ? 'Vào phòng tư vấn' : 'Chi tiết lịch hẹn'}
                      </Button>
                    </View>
                  </Card>
                );
              })
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: 'transparent',
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#FFFFFF',
  },
  tabBtnActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  tabBtnText: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  tabBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  tabBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabCountPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
  },
  tabCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
  },
  expertWorkspaceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F5EE',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
    gap: 8,
  },
  expertWorkspaceText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.primary,
    fontFamily: fonts.bodySemi,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: theme.colors.textPrimary,
    padding: 0,
  },
  filterScroll: {
    flexDirection: 'row',
    paddingVertical: 10,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#FFFFFF',
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listSection: {
    marginTop: 4,
    gap: 12,
  },
  expertCard: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#FFFFFF',
    padding: 14,
    shadowOpacity: 0,
    elevation: 0,
  },
  expertHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  expertName: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  expertTitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  certRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  certBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  expBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#EFEBE2',
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 10,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statVal: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  statDivider: {
    width: 1,
    height: 12,
    backgroundColor: '#CBD5E1',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  feeLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  feeAmount: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: theme.colors.primary,
  },
  feeUnit: {
    fontSize: 11,
    fontWeight: 'normal',
    color: '#64748B',
  },
  btnGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  detailBtn: {
    borderRadius: 6,
    borderColor: theme.colors.border,
  },
  bookBtn: {
    borderRadius: 6,
    backgroundColor: theme.colors.primary,
  },
  bookingCard: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#FFFFFF',
    padding: 14,
    shadowOpacity: 0,
    elevation: 0,
  },
  bookingHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
    gap: 4,
  },
  bookingIdRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bookingIdText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  statusBadge: {
    borderRadius: 6,
  },
  bookingDate: {
    fontSize: 12,
    color: '#64748B',
  },
  bookingBody: {
    paddingVertical: 10,
    gap: 6,
  },
  bookingTopic: {
    fontFamily: fonts.bodySemi,
    fontSize: 13.5,
    lineHeight: 18,
    color: theme.colors.textPrimary,
  },
  expertMiniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  expertMiniName: {
    fontSize: 12,
    color: '#64748B',
  },
  escrowNoticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 4,
  },
  escrowNoticeText: {
    fontSize: 11,
    color: '#15803D',
    fontWeight: '500',
    flex: 1,
  },
  bookingFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  bookingAmountText: {
    fontSize: 12,
    color: '#64748B',
  },
  bookingAmountVal: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: theme.colors.primary,
  },
  bookingActionBtn: {
    borderRadius: 6,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 20,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  emptySub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
});
