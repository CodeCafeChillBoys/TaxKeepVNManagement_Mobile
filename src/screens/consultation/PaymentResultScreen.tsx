import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  BackHandler,
  Platform,
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
import { DrumPatternBackdrop } from '../../components/brand/DrumPatternBackdrop';
import { GoldDoubleRule } from '../../components/brand/GoldDoubleRule';

function formatVnPayDate(str?: string | null): string {
  if (!str || str.length < 14) return '—';
  // yyyyMMddHHmmss -> HH:mm:ss dd/MM/yyyy
  const y = str.substring(0, 4);
  const m = str.substring(4, 6);
  const d = str.substring(6, 8);
  const h = str.substring(8, 10);
  const min = str.substring(10, 12);
  const s = str.substring(12, 14);
  return `${h}:${min}:${s} ${d}/${m}/${y}`;
}

export const PaymentResultScreen: React.FC = () => {
  const route = useRoute<RouteProp<RootStackParamList, 'PaymentResult'>>();
  const navigation = useNavigation<RootNavigationProp>();

  const routeParams = (route.params || {}) as Record<string, any>;
  const initialMessage = routeParams.message;
  const initialSuccess =
    routeParams.isSuccess === true || routeParams.isSuccess === 'true';

  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<BookingDetailResponse | null>(null);
  const [escrow, setEscrow] = useState<EscrowTransactionResponse | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>(initialMessage || '');
  const [isSuccess, setIsSuccess] = useState<boolean>(initialSuccess);
  const [extractedParams, setExtractedParams] = useState<Record<string, string>>({});

  // 1. Trích xuất đầy đủ query parameters từ Web window.location.search và React Navigation route.params
  const extractAllParams = useCallback((): Record<string, string> => {
    const result: Record<string, string> = {};

    // A. Đọc trực tiếp từ window.location.search trên nền tảng Web
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.search) {
      const search = window.location.search.replace(/^\?/, '');
      if (search) {
        const parts = search.split('&');
        for (const part of parts) {
          const [rawK, rawV] = part.split('=');
          if (rawK) {
            try {
              result[decodeURIComponent(rawK)] = decodeURIComponent((rawV || '').replace(/\+/g, ' '));
            } catch {
              result[rawK] = rawV || '';
            }
          }
        }
      }
    }

    // B. Đọc từ route.params (bao gồm cả nested vnpParams nếu có)
    if (route.params && typeof route.params === 'object') {
      Object.entries(route.params).forEach(([k, v]) => {
        if (k === 'vnpParams' && typeof v === 'object' && v !== null) {
          Object.assign(result, v);
        } else if (v !== undefined && v !== null && typeof v !== 'object') {
          result[k] = String(v);
        }
      });
    }

    return result;
  }, [route.params]);

  const allParams = useMemo(() => extractAllParams(), [extractAllParams]);

  // Phân loại: Giao dịch Nạp tiền vào ví hay Thanh toán ca tư vấn
  const isTopUpTx = useMemo(() => {
    const orderInfo = (allParams.vnp_OrderInfo || routeParams.vnp_OrderInfo || '').toUpperCase();
    if (orderInfo.includes('NAPVI') || orderInfo.includes('NẠP TIỀN') || orderInfo.includes('NAP TIEN')) {
      return true;
    }
    const targetBookingId = routeParams.bookingId || allParams.bookingId || escrow?.bookingId;
    if (!targetBookingId && (allParams.vnp_TxnRef || allParams.vnp_Amount)) {
      return true;
    }
    return false;
  }, [allParams, routeParams, escrow?.bookingId]);

  const processPaymentResult = useCallback(async () => {
    setLoading(true);
    try {
      setExtractedParams(allParams);

      const passedSuccess =
        routeParams.isSuccess === true || routeParams.isSuccess === 'true';
      const responseCode =
        allParams.vnp_ResponseCode || routeParams.vnp_ResponseCode;
      const codeSuccess = responseCode === '00';

      const effectiveBookingId =
        routeParams.bookingId || allParams.bookingId || escrow?.bookingId;

      // 1. Tải thông tin booking và escrow từ DB trước nếu có bookingId
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

      // 2. Nếu có vnp_SecureHash, gọi Backend đối soát (xác thực chữ ký và cập nhật DB tự động)
      let backendSuccess = false;
      if (allParams.vnp_SecureHash) {
        try {
          const escrowRes = await consultationApi.handleVnPayReturn(allParams);
          if (escrowRes) {
            setEscrow(escrowRes);
            if (escrowRes.escrowStatus === 'HeldInEscrow' || escrowRes.escrowStatus === 'Settled') {
              backendSuccess = true;
            }
            if (escrowRes.bookingId) {
              try {
                const bRes = await consultationApi.getBookingDetail(escrowRes.bookingId);
                setBooking(bRes);
                if (Boolean(bRes.paidAt) || bRes.status === 'AWAITING_EXPERT_APPROVAL' || bRes.status === 'CONFIRMED') {
                  isPaidBooking = true;
                }
              } catch {
                // Ignore secondary fetch error
              }
            }
          }
        } catch (err: any) {
          if (__DEV__) {
            console.log('Mobile handleVnPayReturn error note:', err?.message);
          }
        }
      }

      // 3. Quyết định trạng thái hiển thị
      if (isPaidBooking || backendSuccess || (codeSuccess && isTopUpTx)) {
        setIsSuccess(true);
      } else if (codeSuccess || passedSuccess) {
        // VNPay báo thành công 00
        setIsSuccess(true);
      } else {
        setIsSuccess(false);
        if (responseCode && responseCode !== '00') {
          let errText = 'Giao dịch chưa hoàn tất.';
          if (responseCode === '24') {
            errText = 'Bạn đã hủy giao dịch trên cổng VNPay.';
          } else if (responseCode === '09') {
            errText = 'Thẻ/Tài khoản chưa kích hoạt dịch vụ thanh toán trực tuyến.';
          } else if (responseCode === '51') {
            errText = 'Tài khoản của bạn không đủ số dư để thực hiện giao dịch.';
          } else if (responseCode === '79') {
            errText = 'Nhập sai mật khẩu xác thực quá số lần quy định.';
          } else if (responseCode === '11') {
            errText = 'Đã hết thời gian chờ thanh toán. Vui lòng thử lại.';
          }
          setStatusMessage(errText);
        }
      }
    } catch (err: any) {
      setStatusMessage('Chưa thể cập nhật trạng thái thanh toán.');
    } finally {
      setLoading(false);
    }
  }, [allParams, isTopUpTx, routeParams, escrow?.bookingId]);

  useEffect(() => {
    processPaymentResult();
  }, [processPaymentResult]);

  // Hardware Back & Navigation handling
  useEffect(() => {
    const onBackPress = () => {
      if (isTopUpTx) {
        navigation.replace('Wallet');
        return true;
      }
      const targetId = routeParams.bookingId || allParams.bookingId || booking?.id;
      if (targetId) {
        navigation.replace('BookingDetail', { bookingId: targetId });
        return true;
      }
      navigation.replace('MyBookings');
      return true;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [isTopUpTx, routeParams.bookingId, allParams.bookingId, booking?.id, navigation]);

  const handleClose = () => {
    if (isTopUpTx) {
      navigation.replace('Wallet');
    } else {
      const targetId = routeParams.bookingId || allParams.bookingId || booking?.id;
      if (targetId) {
        navigation.replace('BookingDetail', { bookingId: targetId });
      } else {
        navigation.replace('MyBookings');
      }
    }
  };

  const sessionInfo = useMemo(() => {
    if (!booking) return null;
    return formatSessionType(booking.sessionType);
  }, [booking]);

  const topUpAmountDisplay = useMemo(() => {
    if (escrow?.amount) return escrow.amount;
    const rawAmt = allParams.vnp_Amount || routeParams.vnp_Amount;
    if (rawAmt) {
      const parsed = parseFloat(rawAmt);
      if (!isNaN(parsed) && parsed > 0) {
        // VNPay amount is multiplied by 100
        return parsed >= 1000000 ? parsed / 100 : parsed;
      }
    }
    return 0;
  }, [escrow?.amount, allParams.vnp_Amount, routeParams.vnp_Amount]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <DrumPatternBackdrop variant="soft" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingTitle}>Đang đối soát kết quả thanh toán...</Text>
          <Text style={styles.loadingSubtitle}>Vui lòng đợi trong giây lát</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <DrumPatternBackdrop variant="soft" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleClose}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Đóng"
        >
          <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isTopUpTx ? 'Kết quả nạp tiền ví' : 'Kết quả thanh toán'}
        </Text>
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
            {isTopUpTx
              ? isSuccess
                ? 'Nạp tiền vào ví thành công!'
                : 'Nạp tiền chưa hoàn tất'
              : isSuccess
              ? 'Thanh toán lịch hẹn thành công'
              : 'Thanh toán chưa hoàn tất'}
          </Text>

          <Text style={styles.statusSubtitle}>
            {isTopUpTx
              ? isSuccess
                ? 'Số tiền đã được cộng trực tiếp vào ví TAXKEEP VN của bạn.'
                : statusMessage || 'Giao dịch nạp tiền qua cổng VNPay chưa được hoàn tất.'
              : isSuccess
              ? 'Lịch hẹn của bạn đã được ghi nhận và gửi đến chuyên gia.'
              : statusMessage || 'Giao dịch chưa hoàn tất.'}
          </Text>
        </View>

        {/* CHI TIẾT NẠP TIỀN VÀO VÍ */}
        {isTopUpTx ? (
          <View style={styles.receiptCard}>
            <View style={styles.receiptHeader}>
              <Ionicons name="wallet-outline" size={18} color={theme.colors.primary} />
              <Text style={styles.receiptHeaderTitle}>Thông tin nạp tiền</Text>
            </View>

            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Loại giao dịch:</Text>
              <Text style={styles.receiptValueBold}>Nạp tiền vào ví TAXKEEP VN</Text>
            </View>

            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Mã đơn giao dịch:</Text>
              <Text style={styles.receiptValue}>
                {allParams.vnp_TxnRef || escrow?.orderCode || '—'}
              </Text>
            </View>

            {allParams.vnp_TransactionNo ? (
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Mã GD VNPay:</Text>
                <Text style={styles.receiptValue}>{allParams.vnp_TransactionNo}</Text>
              </View>
            ) : null}

            {allParams.vnp_BankCode ? (
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Ngân hàng / Cổng:</Text>
                <Text style={styles.receiptValue}>{allParams.vnp_BankCode}</Text>
              </View>
            ) : null}

            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Thời gian:</Text>
              <Text style={styles.receiptValue}>
                {allParams.vnp_PayDate
                  ? formatVnPayDate(allParams.vnp_PayDate)
                  : new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) +
                    ' ' +
                    new Date().toLocaleDateString('vi-VN')}
              </Text>
            </View>

            <View style={styles.receiptDivider} />

            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabelTotal}>Số tiền nạp:</Text>
              <Text style={styles.receiptValueTotal}>
                {formatVnd(topUpAmountDisplay)}
              </Text>
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
                  {isSuccess ? 'Nạp ví thành công' : 'Chưa hoàn tất'}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          /* CHI TIẾT LỊCH HẸN TƯ VẤN */
          booking && (
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
          )
        )}

        {/* Ghi chú đảm bảo an toàn */}
        {isSuccess ? (
          <View style={styles.compactNoteBox}>
            <Ionicons name="shield-checkmark" size={16} color="#059669" />
            <Text style={styles.compactNoteText}>
              {isTopUpTx
                ? 'Số dư ví đã sẵn sàng để bạn sử dụng đặt lịch tư vấn và thanh toán dịch vụ.'
                : 'Khoản tiền được bảo chứng an toàn và chỉ giải ngân cho chuyên gia khi buổi tư vấn hoàn tất.'}
            </Text>
          </View>
        ) : (
          <View style={styles.compactWarningBox}>
            <Ionicons name="time-outline" size={16} color="#D97706" />
            <Text style={styles.compactWarningText}>
              {isTopUpTx
                ? 'Bạn có thể thử nạp lại tiền hoặc kiểm tra lại lịch sử giao dịch trong ví.'
                : 'Bạn có thể thử thanh toán lại trong 10 phút để giữ khung giờ hẹn với chuyên gia.'}
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          {isTopUpTx ? (
            <>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => navigation.replace('Wallet')}
                activeOpacity={0.85}
              >
                <Ionicons name="wallet-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.primaryBtnText}>Về màn hình TAXKEEP VN WALLET</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => navigation.navigate('Home' as any)}
                activeOpacity={0.8}
              >
                <Text style={styles.secondaryBtnText}>Trang chủ</Text>
              </TouchableOpacity>
            </>
          ) : isSuccess ? (
            <>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => {
                  const targetId = routeParams.bookingId || allParams.bookingId || booking?.id;
                  if (targetId) {
                    navigation.replace('BookingDetail', { bookingId: targetId });
                  } else {
                    navigation.replace('MyBookings');
                  }
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="calendar-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.primaryBtnText}>Xem chi tiết lịch hẹn</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => navigation.replace('MyBookings')}
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

              {isTopUpTx ? (
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => navigation.replace('Wallet')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.secondaryBtnText}>Quay lại ví TAXKEEP VN</Text>
                </TouchableOpacity>
              ) : (
                <>
                  {(routeParams.bookingId || allParams.bookingId || booking?.id) ? (
                    <TouchableOpacity
                      style={styles.secondaryBtn}
                      onPress={() => {
                        const targetId = routeParams.bookingId || allParams.bookingId || booking?.id;
                        navigation.replace('BookingDetail', { bookingId: targetId });
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.secondaryBtnText}>Chi tiết lịch hẹn</Text>
                    </TouchableOpacity>
                  ) : null}

                  <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={() => navigation.replace('MyBookings')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.secondaryBtnText}>Danh sách lịch hẹn</Text>
                  </TouchableOpacity>
                </>
              )}
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
