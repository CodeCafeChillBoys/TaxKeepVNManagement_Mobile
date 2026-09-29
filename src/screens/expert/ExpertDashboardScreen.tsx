import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { HeaderMotif } from '../../components/common/HeaderMotif';
import { DrumPatternBackdrop } from '../../components/brand/DrumPatternBackdrop';
import { RootNavigationProp } from '../../navigation/types';
import { Card, Badge, Button, Separator } from '../../components/ui';
import { MOCK_EXPERTS, MOCK_BOOKINGS, MOCK_SLOTS } from './expertMockData';

function formatCurrency(amount: number): string {
  return `${amount.toLocaleString('vi-VN')} đ`;
}

export const ExpertDashboardScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const expert = MOCK_EXPERTS[0]; // Nguyễn Văn Bình
  const [slots, setSlots] = useState(MOCK_SLOTS['exp-1'] || []);
  const [activeTab, setActiveTab] = useState<'SLOTS' | 'BOOKINGS' | 'WALLET'>('SLOTS');

  const toggleSlot = (slotId: string) => {
    setSlots((prev) =>
      prev.map((s) => (s.id === slotId ? { ...s, isAvailable: !s.isAvailable } : s))
    );
  };

  const handleWithdrawRequest = () => {
    Alert.alert(
      'Yêu cầu rút tiền',
      'Số dư khả dụng: 3.420.000 đ. Lệnh rút tiền về MBBank STK 090123456789 đã được ghi nhận. Tiền sẽ về trong 24 giờ làm việc.',
      [{ text: 'Đã hiểu' }]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <DrumPatternBackdrop variant="soft" />
      <HeaderMotif title="BÀN LÀM VIỆC CHUYÊN GIA" onBack={() => navigation.goBack()} />

      {/* SUB-HEADER SWITCH VIEW */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'SLOTS' && styles.tabBtnActive]}
          onPress={() => setActiveTab('SLOTS')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabBtnText, activeTab === 'SLOTS' && styles.tabBtnTextActive]}>
            Lịch rảnh
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'BOOKINGS' && styles.tabBtnActive]}
          onPress={() => setActiveTab('BOOKINGS')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabBtnText, activeTab === 'BOOKINGS' && styles.tabBtnTextActive]}>
            Lịch hẹn tiếp nhận
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'WALLET' && styles.tabBtnActive]}
          onPress={() => setActiveTab('WALLET')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabBtnText, activeTab === 'WALLET' && styles.tabBtnTextActive]}>
            Ví thu nhập
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* EXPERT QUICK INFO */}
        <Card style={styles.cleanCard}>
          <View style={styles.profileRow}>
            <View style={styles.avatarBox}>
              <Text style={styles.avatarText}>B</Text>
            </View>
            <View style={styles.profileInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.expertName}>{expert.fullName}</Text>
                <Badge variant="success" style={styles.badge}>
                  <Text style={styles.badgeText}>Hoạt động</Text>
                </Badge>
              </View>
              <Text style={styles.expertTitle}>{expert.title}</Text>
              <Text style={styles.feeSub}>Phí niêm yết: {formatCurrency(expert.feePerSession)} / 45p</Text>
            </View>
          </View>
        </Card>

        {/* TAB 1: SLOTS MANAGEMENT */}
        {activeTab === 'SLOTS' && (
          <Card style={styles.cleanCard}>
            <View style={styles.sectionHeaderBetween}>
              <View style={styles.sectionHeader}>
                <Ionicons name="calendar-outline" size={16} color={theme.colors.primary} />
                <Text style={styles.sectionTitle}>Quản lý khung giờ trống</Text>
              </View>
              <Text style={styles.slotCountText}>{slots.filter((s) => s.isAvailable).length} slot mở</Text>
            </View>

            <View style={styles.slotList}>
              {slots.map((s) => (
                <View key={s.id} style={styles.slotRow}>
                  <View style={styles.slotTimeCol}>
                    <Text style={styles.slotDate}>{s.date.slice(5).replace('-', '/')}</Text>
                    <Text style={styles.slotTime}>{s.startTime} - {s.endTime}</Text>
                  </View>
                  <View style={styles.slotActionCol}>
                    <Text style={[styles.slotStatus, s.isAvailable ? styles.slotOpen : styles.slotClosed]}>
                      {s.isAvailable ? 'Sẵn sàng' : 'Khóa slot'}
                    </Text>
                    <Switch
                      value={s.isAvailable}
                      onValueChange={() => toggleSlot(s.id)}
                      trackColor={{ false: '#CBD5E1', true: theme.colors.primary }}
                      thumbColor="#FFFFFF"
                    />
                  </View>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* TAB 2: BOOKINGS RECEIVED */}
        {activeTab === 'BOOKINGS' && (
          <Card style={styles.cleanCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="briefcase-outline" size={16} color={theme.colors.primary} />
              <Text style={styles.sectionTitle}>Lịch hẹn khách hàng</Text>
            </View>

            <View style={styles.bookingList}>
              {MOCK_BOOKINGS.map((b) => (
                <TouchableOpacity
                  key={b.bookingId}
                  style={styles.bookingItem}
                  onPress={() =>
                    navigation.navigate('ExpertConsultationDetail', {
                      bookingId: b.bookingId,
                    })
                  }
                  activeOpacity={0.7}
                >
                  <View style={styles.bookingItemHeader}>
                    <Text style={styles.bookingItemCode}>{b.bookingId}</Text>
                    <Badge
                      variant={b.status === 'CONFIRMED' ? 'default' : 'success'}
                      style={styles.badge}
                    >
                      <Text style={styles.badgeTextSmall}>
                        {b.status === 'CONFIRMED' ? 'Đã xác nhận' : 'Hoàn tất'}
                      </Text>
                    </Badge>
                  </View>

                  <Text style={styles.bookingItemTopic}>{b.topic}</Text>
                  <Text style={styles.bookingItemTime}>
                    {b.timeSlot} • {b.date}
                  </Text>

                  {b.attachedFiles.length > 0 && (
                    <View style={styles.attachedDocRow}>
                      <Ionicons name="document-attach" size={12} color={theme.colors.primary} />
                      <Text style={styles.attachedDocText}>
                        {b.attachedFiles.length} tài liệu khách gửi trước
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </Card>
        )}

        {/* TAB 3: WALLET & ESCROW REVENUE */}
        {activeTab === 'WALLET' && (
          <>
            <Card style={styles.cleanCard}>
              <View style={styles.sectionHeader}>
                <Ionicons name="wallet-outline" size={16} color={theme.colors.primary} />
                <Text style={styles.sectionTitle}>Ví thu nhập chuyên gia</Text>
              </View>

              <View style={styles.walletMetricsGrid}>
                <View style={styles.walletMetricBox}>
                  <Text style={styles.walletMetricLabel}>Khả dụng rút</Text>
                  <Text style={styles.walletMetricValueHighlight}>3.420.000 đ</Text>
                </View>
                <View style={styles.walletMetricBox}>
                  <Text style={styles.walletMetricLabel}>Tạm giữ Escrow</Text>
                  <Text style={styles.walletMetricValueEscrow}>450.000 đ</Text>
                </View>
              </View>

              <Separator style={styles.divider} />

              <View style={styles.walletDetailRow}>
                <Text style={styles.walletDetailLabel}>Tổng doanh thu tích lũy:</Text>
                <Text style={styles.walletDetailValue}>12.600.000 đ</Text>
              </View>
              <View style={styles.walletDetailRow}>
                <Text style={styles.walletDetailLabel}>Phí sàn TaxKeep (10%):</Text>
                <Text style={styles.walletDetailValue}>-1.260.000 đ</Text>
              </View>
              <View style={styles.walletDetailRow}>
                <Text style={styles.walletDetailLabel}>Thuế TNCN khấu trừ 10%:</Text>
                <Text style={styles.walletDetailValue}>-1.134.000 đ</Text>
              </View>

              <Button
                variant="default"
                onPress={handleWithdrawRequest}
                style={styles.withdrawBtn}
                icon={<Ionicons name="cash-outline" size={16} color="#FFFFFF" />}
              >
                Yêu cầu rút tiền về ngân hàng
              </Button>
            </Card>

            <View style={styles.escrowNoticeRow}>
              <Ionicons name="shield-checkmark" size={16} color="#0F766E" />
              <Text style={styles.escrowNoticeText}>
                Quy định Escrow: Thù lao ca tư vấn sẽ tự động chuyển vào số dư khả dụng sau 24h kết thúc phiên họp.
              </Text>
            </View>
          </>
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
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingHorizontal: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: theme.colors.primary,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    fontFamily: fonts.primary,
  },
  tabBtnTextActive: {
    color: theme.colors.primary,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
    gap: 12,
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
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarBox: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: fonts.primary,
  },
  profileInfo: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  expertName: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    fontFamily: fonts.primary,
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 10,
    color: '#16A34A',
    fontWeight: '600',
  },
  badgeTextSmall: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  expertTitle: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontFamily: fonts.primary,
  },
  feeSub: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.primary,
    marginTop: 2,
    fontFamily: fonts.primary,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sectionHeaderBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    fontFamily: fonts.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  slotCountText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontFamily: fonts.primary,
  },
  slotList: {
    gap: 8,
    marginTop: 4,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F8F5EE',
  },
  slotTimeCol: {
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
    color: theme.colors.textPrimary,
    fontFamily: fonts.primary,
  },
  slotActionCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  slotStatus: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: fonts.primary,
  },
  slotOpen: {
    color: '#16A34A',
  },
  slotClosed: {
    color: '#64748B',
  },
  bookingList: {
    gap: 8,
    marginTop: 4,
  },
  bookingItem: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 6,
    padding: 12,
    backgroundColor: '#F8F5EE',
    gap: 4,
  },
  bookingItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bookingItemCode: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
    fontFamily: fonts.primary,
  },
  bookingItemTopic: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    fontFamily: fonts.primary,
  },
  bookingItemTime: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontFamily: fonts.primary,
  },
  attachedDocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  attachedDocText: {
    fontSize: 10,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  walletMetricsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  walletMetricBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 6,
    padding: 10,
    backgroundColor: '#F8F5EE',
    gap: 2,
  },
  walletMetricLabel: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontFamily: fonts.primary,
  },
  walletMetricValueHighlight: {
    fontSize: 15,
    fontWeight: '700',
    color: '#16A34A',
    fontFamily: fonts.primary,
  },
  walletMetricValueEscrow: {
    fontSize: 15,
    fontWeight: '700',
    color: '#D97706',
    fontFamily: fonts.primary,
  },
  divider: {
    marginVertical: 12,
    backgroundColor: theme.colors.border,
  },
  walletDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  walletDetailLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontFamily: fonts.primary,
  },
  walletDetailValue: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    fontFamily: fonts.primary,
  },
  withdrawBtn: {
    borderRadius: 6,
    backgroundColor: theme.colors.primary,
    height: 42,
    marginTop: 12,
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
    fontSize: 11,
    color: '#0F766E',
    fontFamily: fonts.primary,
    lineHeight: 16,
  },
});
