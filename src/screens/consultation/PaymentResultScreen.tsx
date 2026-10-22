import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList, RootNavigationProp } from '../../navigation/types';
import { consultationApi } from '../../api/consultationApi';
import {
  BookingDetailResponse,
  EscrowTransactionResponse,
  formatSessionType,
  formatVnd,
  formatVietnameseDate,
  formatTimeRange,
} from '../../types/consultation';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { GoldDoubleRule } from '../../components/brand/GoldDoubleRule';

export const PaymentResultScreen: React.FC = () => {
  const route = useRoute<RouteProp<RootStackParamList, 'PaymentResult'>>();
  const navigation = useNavigation<RootNavigationProp>();

  const { bookingId, vnp_ResponseCode, vnpParams, message: initialMessage } = route.params || {};

  const initialSuccess =
    route.params?.isSuccess === true || (route.params?.isSuccess as any) === 'true';

  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<BookingDetailResponse | null>(null);
  const [escrow, setEscrow] = useState<EscrowTransactionResponse | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>(initialMessage || '');
  const [isSuccess, setIsSuccess] = useState<boolean>(initialSuccess);

  const processPaymentResult = useCallback(async () => {
    setLoading(true);
    try {
      const passedSuccess =
        route.params?.isSuccess === true || (route.params?.isSuccess as any) === 'true';
      const responseCode = vnp_ResponseCode || vnpParams?.vnp_ResponseCode;
      const codeSuccess = responseCode === '00';

      const effectiveBookingId =
        bookingId || escrow?.bookingId || (route.params as any)?.bookingId;

      // 1. Tải thông tin booking và escrow từ DB trước
      let isPaidBooking = false;
      if (effectiveBookingId) {
        const [bookingRes, escrowRes] = await Promise.allSettled([
          consultationApi.getBookingDetail(effectiveBookingId),
          consultationApi.getBookingEscrow(effectiveBookingId),
        ]);

        if (bookingRes.status === 'fulfilled') {
          setBooking(bookingRes.value);
          const b = bookingRes.value;
          if (
            Boolean(b.paidAt) ||
            b.status === 'AWAITING_EXPERT_APPROVAL' ||
            b.status === 'CONFIRMED' ||
            b.status === 'IN_PROGRESS'
          ) {
            isPaidBooking = true;
          }
        }

        if (escrowRes.status === 'fulfilled') {
          setEscrow(escrowRes.value);
          if (escrowRes.value.escrowStatus === 'HeldInEscrow') {
            isPaidBooking = true;
          }
        }
      }

      // 2. Nếu DB CHƯA ghi nhận thanh toán, nhưng có vnpParams và vnp_SecureHash:
      // Kích hoạt gọi Backend đối soát (đóng vai trò fail-safe nếu Web chưa gọi hoặc bị lỗi mạng)
      if (!isPaidBooking && vnpParams && Object.keys(vnpParams).length > 0 && vnpParams.vnp_SecureHash) {
        try {
          const escrowRes = await consultationApi.handleVnPayReturn(vnpParams);
          if (escrowRes) {
            setEscrow(escrowRes);
            if (escrowRes.escrowStatus === 'HeldInEscrow') {
              isPaidBooking = true;
            }
          }
          if (effectiveBookingId) {
            const bRes = await consultationApi.getBookingDetail(effectiveBookingId);
            setBooking(bRes);
            if (Boolean(bRes.paidAt) || bRes.status === 'AWAITING_EXPERT_APPROVAL') {
              isPaidBooking = true;
            }
          }
        } catch (err: any) {
          if (__DEV__) {
            console.log('Mobile fallback handleVnPayReturn note:', err?.message);
          }
        }
      }

      // 3. Quyết định trạng thái hiển thị
      if (isPaidBooking) {
        setIsSuccess(true);
      } else if (codeSuccess || passedSuccess) {
        // VNPay báo thành công nhưng Backend DB chưa kịp ghi nhận
        setIsSuccess(false);
        setStatusMessage(
          'VNPay đã trừ tiền thành công nhưng hệ thống đang đồng bộ dữ liệu. Bạn vui lòng bấm "Thử lại" hoặc kiểm tra lại sau ít giây.'
        );
      } else {
        setIsSuccess(false);
        if (responseCode && responseCode !== '00') {
          let errText = 'Giao dịch chưa hoàn tất.';
          if (responseCode === '24') {
            errText = 'Bạn đã hủy giao dịch.';
          } else if (responseCode === '09') {
            errText = 'Thẻ chưa kích hoạt thanh toán trực tuyến.';
          } else if (responseCode === '51') {
            errText = 'Số dư tài khoản không đủ.';
          } else if (responseCode === '79') {
            errText = 'Nhập sai mật khẩu quá số lần quy định.';
          }
          setStatusMessage(errText);
        }
      }
    } catch (err: any) {
      setStatusMessage('Chưa thể cập nhật trạng thái thanh toán.');
    } finally {
      setLoading(false);
    }
  }, [bookingId, vnp_ResponseCode, vnpParams, escrow?.bookingId, route.params]);

  useEffect(() => {
    processPaymentResult();
  }, [processPaymentResult]);

  useEffect(() => {
    const onBackPress = () => {
      const targetId = bookingId || booking?.id;
      if (targetId) {
        navigation.replace('BookingDetail', { bookingId: targetId });
        return true;
      }
      return false;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [bookingId, booking?.id, navigation]);

  const sessionInfo = useMemo(() => {
    if (!booking) return null;
    return formatSessionType(booking.sessionType);
  }, [booking]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingTitle}>Đang kiểm tra thanh toán...</Text>
          <Text style={styles.loadingSubtitle}>Vui lòng đợi trong giây lát</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            const targetId = bookingId || booking?.id;
            if (targetId) {
              navigation.replace('BookingDetail', { bookingId: targetId });
            } else {
              navigation.navigate('MyBookings');
            }
          }}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Đóng"
        >
          <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Kết quả thanh toán</Text>
        <View style={{ width: 38 }} />
      </View>
      <GoldDoubleRule />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Result Status Hero */}
        <View style={[styles.statusHeroCard, isSuccess ? styles.heroSuccess : styles.heroFailed]}>
          <View style={[styles.iconCircle, isSuccess ? styles.iconCircleSuccess : styles.iconCircleFailed]}>
            <Ionicons
              name={isSuccess ? 'checkmark-circle' : 'alert-circle'}
              size={48}
              color={isSuccess ? '#059669' : '#DC2626'}
            />
          </View>

          <Text style={[styles.statusTitle, isSuccess ? styles.statusTitleSuccess : styles.statusTitleFailed]}>
            {isSuccess ? 'Thanh toán thành công' : 'Thanh toán chưa hoàn tất'}
          </Text>

          <Text style={styles.statusSubtitle}>
            {isSuccess
              ? 'Lịch hẹn của bạn đã được ghi nhận.'
              : statusMessage || 'Giao dịch chưa hoàn tất.'}
          </Text>
        </View>

        {/* Chi tiết giao dịch */}
        {booking && (
          <View style={styles.receiptCard}>
            <View style={styles.receiptHeader}>
              <Ionicons name="receipt-outline" size={18} color={theme.colors.primary} />
              <Text style={styles.receiptHeaderTitle}>Chi tiết giao dịch</Text>
            </View>

            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Mã lịch hẹn:</Text>
              <Text style={styles.receiptValueBold}>{booking.bookingCode}</Text>
            </View>

            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Chuyên gia:</Text>
              <Text style={styles.receiptValue}>{booking.expertFullName}</Text>
            </View>

            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Thời gian:</Text>
              <Text style={styles.receiptValue}>
                {formatVietnameseDate(booking.slotDate)} ({formatTimeRange(booking.startTime, booking.endTime)})
              </Text>
            </View>

            {sessionInfo && (
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Hình thức:</Text>
                <Text style={styles.receiptValue}>
                  {sessionInfo.label} ({booking.durationMinutes} phút)
                </Text>
              </View>
            )}

            <View style={styles.receiptDivider} />

            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabelTotal}>Số tiền:</Text>
              <Text style={styles.receiptValueTotal}>
                {formatVnd(escrow?.amount ?? booking.fee)}
              </Text>
            </View>

            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Phương thức:</Text>
              <Text style={styles.receiptValue}>VNPay / VietQR</Text>
            </View>

            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Trạng thái:</Text>
              <View
                style={[
                  styles.statusPill,
                  isSuccess ? styles.statusPillSuccess : styles.statusPillPending,
                ]}
              >
                <Text
                  style={[
                    styles.statusPillText,
                    isSuccess ? styles.statusPillTextSuccess : styles.statusPillTextPending,
                  ]}
                >
                  {isSuccess ? 'Chờ chuyên gia xác nhận' : 'Chờ thanh toán'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Ghi chú đảm bảo ngắn gọn */}
        {isSuccess ? (
          <View style={styles.compactNoteBox}>
            <Ionicons name="shield-checkmark" size={16} color="#059669" />
            <Text style={styles.compactNoteText}>
              Khoản tiền được bảo đảm an toàn cho đến khi hoàn tất buổi tư vấn.
            </Text>
          </View>
        ) : (
          <View style={styles.compactWarningBox}>
            <Ionicons name="time-outline" size={16} color="#D97706" />
            <Text style={styles.compactWarningText}>
              Bạn có thể thử thanh toán lại trong 10 phút để giữ giờ hẹn.
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          {isSuccess ? (
            <>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => {
                  if (bookingId || booking?.id) {
                    navigation.replace('BookingDetail', { bookingId: (bookingId || booking?.id)! });
                  } else {
                    navigation.navigate('MyBookings');
                  }
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="calendar-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.primaryBtnText}>Xem chi tiết lịch hẹn</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => navigation.navigate('MyBookings')}
                activeOpacity={0.8}
              >
                <Text style={styles.secondaryBtnText}>Danh sách lịch hẹn</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={processPaymentResult}
                activeOpacity={0.85}
              >
                <Ionicons name="refresh-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.primaryBtnText}>Kiểm tra lại kết quả</Text>
              </TouchableOpacity>

              {bookingId || booking?.id ? (
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => {
                    navigation.replace('BookingDetail', { bookingId: (bookingId || booking?.id)! });
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.secondaryBtnText}>Chi tiết lịch hẹn</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => navigation.navigate('MyBookings')}
                activeOpacity={0.8}
              >
                <Text style={styles.secondaryBtnText}>Danh sách lịch hẹn</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
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
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: 16,
    color: theme.colors.textPrimary,
    marginTop: 16,
    marginBottom: 6,
  },
  loadingSubtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },

  // Status Hero
  statusHeroCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
  },
  heroSuccess: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  heroFailed: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircleSuccess: {
    backgroundColor: '#DCFCE7',
  },
  iconCircleFailed: {
    backgroundColor: '#FEE2E2',
  },
  statusTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 20,
    marginBottom: 8,
    textAlign: 'center',
  },
  statusTitleSuccess: {
    color: '#065F46',
  },
  statusTitleFailed: {
    color: '#991B1B',
  },
  statusSubtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 20,
  },

  // Receipt
  receiptCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  receiptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  receiptHeaderTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: 15,
    color: theme.colors.primary,
    marginLeft: 8,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  receiptLabel: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: '#6B7280',
  },
  receiptValue: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  receiptValueBold: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    color: theme.colors.primary,
  },
  receiptDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 10,
  },
  receiptLabelTotal: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  receiptValueTotal: {
    fontFamily: fonts.serifBold,
    fontSize: 18,
    color: '#059669',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusPillSuccess: {
    backgroundColor: '#ECFDF5',
  },
  statusPillPending: {
    backgroundColor: '#FEF3C7',
  },
  statusPillText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
  },
  statusPillTextSuccess: {
    color: '#059669',
  },
  statusPillTextPending: {
    color: '#D97706',
  },

  // Compact Note Box
  compactNoteBox: {
    backgroundColor: '#ECFDF5',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  compactNoteText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#065F46',
    flex: 1,
    lineHeight: 16,
  },
  compactWarningBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  compactWarningText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#92400E',
    flex: 1,
    lineHeight: 16,
  },

  // Actions
  actionsContainer: {
    marginTop: 8,
    gap: 12,
  },
  primaryBtn: {
    flexDirection: 'row',
    height: 48,
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  primaryBtnText: {
    fontFamily: fonts.bodySemi,
    fontSize: 15,
    color: '#FFFFFF',
  },
  secondaryBtn: {
    height: 46,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  secondaryBtnText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: '#374151',
  },
});
