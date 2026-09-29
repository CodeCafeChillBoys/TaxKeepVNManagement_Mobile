import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
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
import { getBookingById, updateBooking } from './expertMockData';

type PaymentRouteProp = RouteProp<RootStackParamList, 'ExpertPayment'>;

type PaymentMethod = 'VIETQR' | 'CARD' | 'TAXKEEP_WALLET';

function formatCurrency(amount: number): string {
  return `${amount.toLocaleString('vi-VN')} đ`;
}

export const ExpertPaymentScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const route = useRoute<PaymentRouteProp>();
  const bookingId = route.params?.bookingId || 'BK-2026-9812';

  const booking = useMemo(() => getBookingById(bookingId), [bookingId]);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('VIETQR');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // 10-minute countdown timer simulation
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(592); // ~9m 52s

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeftSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  if (!booking) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <HeaderMotif title="THANH TOÁN ESCROW" onBack={() => navigation.goBack()} />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Không tìm thấy thông tin phiên đặt lịch.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleConfirmPayment = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      updateBooking(booking.bookingId, {
        status: 'CONFIRMED',
        escrowStatus: 'HELD',
        meetingUrl: `https://meet.taxkeep.vn/room/${booking.bookingId}`,
      });

      Alert.alert(
        'Thanh toán thành công',
        `Mã lịch hẹn: ${booking.bookingId}. Tiền đang được bảo vệ bởi Escrow và phòng tư vấn đã sẵn sàng.`,
        [
          {
            text: 'Xem chi tiết lịch hẹn',
            onPress: () =>
              navigation.replace('ExpertConsultationDetail', {
                bookingId: booking.bookingId,
              }),
          },
        ]
      );
    }, 1200);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <DrumPatternBackdrop variant="soft" />
      <HeaderMotif title="THANH TOÁN & ESCROW" onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 10-MINUTE HOLD COUNTDOWN BANNER */}
        <View style={styles.timerBanner}>
          <Ionicons name="timer-outline" size={16} color="#B45309" />
          <Text style={styles.timerText}>
            Khung giờ giữ chỗ hết hạn sau:{' '}
            <Text style={styles.timerCount}>{formatTimer(timeLeftSeconds)}</Text>
          </Text>
        </View>

        {/* BOOKING SUMMARY CARD */}
        <Card style={styles.cleanCard}>
          <View style={styles.sectionHeaderBetween}>
            <View style={styles.sectionHeader}>
              <Ionicons name="calendar-outline" size={16} color={theme.colors.primary} />
              <Text style={styles.sectionTitle}>Thông tin lịch hẹn</Text>
            </View>
            <Badge variant="outline" style={styles.bookingIdBadge}>
              <Text style={styles.bookingIdText}>{booking.bookingId}</Text>
            </Badge>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Chuyên gia:</Text>
            <Text style={styles.infoValue}>{booking.expertName}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Thời gian:</Text>
            <Text style={styles.infoValueHighlight}>
              {booking.timeSlot} • {booking.date}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Chủ đề:</Text>
            <Text style={styles.infoValue} numberOfLines={1}>{booking.topic}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Thời lượng:</Text>
            <Text style={styles.infoValue}>45 phút (1-on-1 trực tuyến)</Text>
          </View>
        </Card>

        {/* ESCROW SECURITY MECHANISM */}
        <Card style={styles.escrowCard}>
          <View style={styles.escrowHeader}>
            <Ionicons name="shield-checkmark" size={18} color="#0F766E" />
            <Text style={styles.escrowTitle}>Cơ chế bảo vệ Escrow 24 giờ</Text>
          </View>
          <Text style={styles.escrowBody}>
            Khoản tiền thanh toán được tạm giữ an toàn tại tài khoản trung gian của TaxKeep và chỉ giải ngân cho chuyên gia sau 24h tính từ thời điểm hoàn tất phiên tư vấn.
          </Text>
          <View style={styles.escrowPoints}>
            <View style={styles.escrowBullet}>
              <Ionicons name="checkmark" size={12} color="#0F766E" />
              <Text style={styles.escrowBulletText}>Hoàn tiền 100% nếu chuyên gia vắng mặt.</Text>
            </View>
            <View style={styles.escrowBullet}>
              <Ionicons name="checkmark" size={12} color="#0F766E" />
              <Text style={styles.escrowBulletText}>Được quyền gửi khiếu nại trong 24h sau buổi họp.</Text>
            </View>
          </View>
        </Card>

        {/* PAYMENT METHOD SELECTOR */}
        <Card style={styles.cleanCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="card-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>Phương thức thanh toán</Text>
          </View>

          {/* METHOD 1: VIETQR */}
          <TouchableOpacity
            style={[
              styles.methodItem,
              selectedMethod === 'VIETQR' && styles.methodItemSelected,
            ]}
            onPress={() => setSelectedMethod('VIETQR')}
            activeOpacity={0.7}
          >
            <Ionicons
              name={selectedMethod === 'VIETQR' ? 'radio-button-on' : 'radio-button-off'}
              size={18}
              color={selectedMethod === 'VIETQR' ? theme.colors.primary : '#94A3B8'}
            />
            <Ionicons name="qr-code-outline" size={20} color="#0F766E" />
            <View style={styles.methodInfo}>
              <Text style={styles.methodName}>Quét mã VietQR (Tất cả ngân hàng)</Text>
              <Text style={styles.methodSub}>Xác nhận tức thì qua Napas 247</Text>
            </View>
          </TouchableOpacity>

          {/* METHOD 2: VISA / ATM */}
          <TouchableOpacity
            style={[
              styles.methodItem,
              selectedMethod === 'CARD' && styles.methodItemSelected,
            ]}
            onPress={() => setSelectedMethod('CARD')}
            activeOpacity={0.7}
          >
            <Ionicons
              name={selectedMethod === 'CARD' ? 'radio-button-on' : 'radio-button-off'}
              size={18}
              color={selectedMethod === 'CARD' ? theme.colors.primary : '#94A3B8'}
            />
            <Ionicons name="card" size={20} color="#3B82F6" />
            <View style={styles.methodInfo}>
              <Text style={styles.methodName}>Thẻ ATM nội địa / Visa / Mastercard</Text>
              <Text style={styles.methodSub}>Bảo mật tiêu chuẩn PCI-DSS</Text>
            </View>
          </TouchableOpacity>

          {/* METHOD 3: TAXKEEP WALLET */}
          <TouchableOpacity
            style={[
              styles.methodItem,
              selectedMethod === 'TAXKEEP_WALLET' && styles.methodItemSelected,
            ]}
            onPress={() => setSelectedMethod('TAXKEEP_WALLET')}
            activeOpacity={0.7}
          >
            <Ionicons
              name={selectedMethod === 'TAXKEEP_WALLET' ? 'radio-button-on' : 'radio-button-off'}
              size={18}
              color={selectedMethod === 'TAXKEEP_WALLET' ? theme.colors.primary : '#94A3B8'}
            />
            <Ionicons name="wallet-outline" size={20} color="#8B1E1E" />
            <View style={styles.methodInfo}>
              <Text style={styles.methodName}>Ví TaxKeep</Text>
              <Text style={styles.methodSub}>Số dư khả dụng: 500.000 đ</Text>
            </View>
          </TouchableOpacity>

          {/* VIETQR DETAILS SIMULATION */}
          {selectedMethod === 'VIETQR' && (
            <View style={styles.vietqrBox}>
              <View style={styles.qrCodePlaceholder}>
                <Ionicons name="qr-code" size={96} color="#1E293B" />
                <Text style={styles.qrHint}>Mã VietQR động tự động khớp số tiền</Text>
              </View>

              <Separator style={styles.qrDivider} />

              <View style={styles.qrInfoRow}>
                <Text style={styles.qrLabel}>Ngân hàng thụ hưởng:</Text>
                <Text style={styles.qrValue}>MBBank (Ngân hàng Quân đội)</Text>
              </View>
              <View style={styles.qrInfoRow}>
                <Text style={styles.qrLabel}>Số tài khoản:</Text>
                <Text style={styles.qrValueBold}>090123456789</Text>
              </View>
              <View style={styles.qrInfoRow}>
                <Text style={styles.qrLabel}>Tên tài khoản:</Text>
                <Text style={styles.qrValueBold}>TAXKEEP ESCROW GATEWAY</Text>
              </View>
              <View style={styles.qrInfoRow}>
                <Text style={styles.qrLabel}>Nội dung:</Text>
                <Text style={styles.qrValueHighlight}>{booking.bookingId}</Text>
              </View>
            </View>
          )}
        </Card>

        {/* FINANCIAL SUMMARY */}
        <Card style={styles.cleanCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Thù lao phiên tư vấn (45p)</Text>
            <Text style={styles.summaryValue}>{formatCurrency(booking.expertFee)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Phí sàn giao dịch TaxKeep</Text>
            <Text style={styles.summaryValueFree}>0 đ</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Mã giảm giá hội viên</Text>
            <Text style={styles.summaryValue}>-0 đ</Text>
          </View>

          <Separator style={styles.divider} />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Tổng tiền tạm giữ Escrow</Text>
            <Text style={styles.totalValue}>{formatCurrency(booking.totalAmount)}</Text>
          </View>
        </Card>
      </ScrollView>

      {/* FIXED BOTTOM ACTION BAR */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomTotalCol}>
          <Text style={styles.bottomTotalLabel}>Tổng thanh toán</Text>
          <Text style={styles.bottomTotalAmount}>{formatCurrency(booking.totalAmount)}</Text>
        </View>

        <Button
          variant="default"
          onPress={handleConfirmPayment}
          loading={isProcessing}
          style={styles.payBtn}
          icon={<Ionicons name="lock-closed" size={16} color="#FFFFFF" />}
        >
          Xác nhận &amp; Giữ tiền Escrow
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
    paddingBottom: 96,
    gap: 12,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontFamily: fonts.primary,
  },
  timerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  timerText: {
    fontSize: 12,
    color: '#92400E',
    fontFamily: fonts.primary,
  },
  timerCount: {
    fontWeight: '700',
    color: '#B45309',
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
  bookingIdBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#F1F5F9',
  },
  bookingIdText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontFamily: fonts.primary,
  },
  infoValue: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.textPrimary,
    fontFamily: fonts.primary,
  },
  infoValueHighlight: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
    fontFamily: fonts.primary,
  },
  escrowCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 6,
    padding: 14,
    marginVertical: 0,
    shadowOpacity: 0,
    elevation: 0,
    gap: 8,
  },
  escrowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  escrowTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F766E',
    fontFamily: fonts.primary,
  },
  escrowBody: {
    fontSize: 12,
    lineHeight: 18,
    color: '#134E4A',
    fontFamily: fonts.primary,
  },
  escrowPoints: {
    gap: 4,
    marginTop: 2,
  },
  escrowBullet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  escrowBulletText: {
    fontSize: 11,
    color: '#0F766E',
    fontFamily: fonts.primary,
  },
  methodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    marginTop: 8,
  },
  methodItemSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: '#8B1E1E08',
  },
  methodInfo: {
    flex: 1,
    gap: 2,
  },
  methodName: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    fontFamily: fonts.primary,
  },
  methodSub: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontFamily: fonts.primary,
  },
  vietqrBox: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 6,
    backgroundColor: '#F8F9FA',
    padding: 12,
    alignItems: 'center',
  },
  qrCodePlaceholder: {
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  qrHint: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontFamily: fonts.primary,
  },
  qrDivider: {
    width: '100%',
    backgroundColor: theme.colors.border,
    marginVertical: 10,
  },
  qrInfoRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  qrLabel: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontFamily: fonts.primary,
  },
  qrValue: {
    fontSize: 11,
    color: theme.colors.textPrimary,
    fontFamily: fonts.primary,
  },
  qrValueBold: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    fontFamily: fonts.primary,
  },
  qrValueHighlight: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
    fontFamily: fonts.primary,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontFamily: fonts.primary,
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.textPrimary,
    fontFamily: fonts.primary,
  },
  summaryValueFree: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16A34A',
    fontFamily: fonts.primary,
  },
  divider: {
    marginVertical: 10,
    backgroundColor: theme.colors.border,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    fontFamily: fonts.primary,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.primary,
    fontFamily: fonts.primary,
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
  bottomTotalCol: {
    gap: 2,
  },
  bottomTotalLabel: {
    fontSize: 10,
    color: theme.colors.textMuted,
    fontFamily: fonts.primary,
  },
  bottomTotalAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.primary,
    fontFamily: fonts.primary,
  },
  payBtn: {
    flex: 1,
    borderRadius: 6,
    backgroundColor: theme.colors.primary,
    height: 44,
  },
});
