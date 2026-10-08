import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { GoldDoubleRule } from '../../components/brand/GoldDoubleRule';
import { RootNavigationProp, RootStackParamList } from '../../navigation/types';
import { consultationApi } from '../../api/consultationApi';
import type { BookingDetailResponse } from '../../types/consultation';
import {
  formatVnd,
  formatBookingStatus,
  formatSessionType,
  formatVietnameseDate,
  formatTimeRange,
} from '../../types/consultation';

export const BookingDetailScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'BookingDetail'>>();
  const bookingId = route.params.bookingId;

  const [booking, setBooking] = useState<BookingDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Countdown timer state
  const [currentTimeMs, setCurrentTimeMs] = useState(Date.now());

  // Cancel modal
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // Downloading attachment state
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimeMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await consultationApi.getBookingDetail(bookingId);
      setBooking(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Không thể tải chi tiết lịch hẹn.');
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  // Handle Cancel Booking
  const handleConfirmCancel = async () => {
    setCancelling(true);
    try {
      const updated = await consultationApi.cancelBooking(
        bookingId,
        cancelReason.trim() || 'Khách hàng chủ động hủy.'
      );
      setBooking(updated);
      setCancelModalVisible(false);
      setCancelReason('');
      Alert.alert('Thành công', 'Đã hủy lịch hẹn tư vấn thành công.');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Không thể hủy lịch hẹn.';
      Alert.alert('Lỗi', msg);
    } finally {
      setCancelling(false);
    }
  };

  // Handle Attachment Download
  const handleDownloadAttachment = async (attachmentId: string) => {
    setDownloadingId(attachmentId);
    try {
      const url = await consultationApi.getAttachmentDownloadUrl(bookingId, attachmentId);
      if (url) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Thông báo', 'Đường dẫn tệp tin không khả dụng.');
      }
    } catch (err: any) {
      Alert.alert('Lỗi tải tệp', err?.message || 'Không thể lấy đường dẫn tải tệp.');
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Chi tiết lịch hẹn</Text>
          <View style={{ width: 38 }} />
        </View>
        <GoldDoubleRule />
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Đang tải thông tin lịch hẹn...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !booking) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Chi tiết lịch hẹn</Text>
          <View style={{ width: 38 }} />
        </View>
        <GoldDoubleRule />
        <View style={styles.centerLoading}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.colors.error} />
          <Text style={styles.errorTitle}>Lỗi tải dữ liệu</Text>
          <Text style={styles.errorMsg}>{error || 'Không tìm thấy lịch hẹn này.'}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchDetail}>
            <Text style={styles.retryBtnText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const statusInfo = formatBookingStatus(booking.status);
  const sessionInfo = formatSessionType(booking.sessionType);

  // Can user cancel this booking?
  const canCancel =
    booking.status === 'PENDING_PAYMENT' ||
    booking.status === 'AWAITING_EXPERT_APPROVAL' ||
    booking.status === 'CONFIRMED';

  // Countdown calculations
  let holdSecondsLeft = 0;
  if (booking.status === 'PENDING_PAYMENT') {
    const expiresMs = new Date(booking.holdExpiresAt).getTime();
    holdSecondsLeft = Math.max(0, Math.floor((expiresMs - currentTimeMs) / 1000));
  }

  let approvalSecondsLeft = 0;
  if (booking.status === 'AWAITING_EXPERT_APPROVAL' && booking.approvalDeadline) {
    const deadlineMs = new Date(booking.approvalDeadline).getTime();
    approvalSecondsLeft = Math.max(0, Math.floor((deadlineMs - currentTimeMs) / 1000));
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
        <Text style={styles.headerTitle}>Chi tiết lịch hẹn</Text>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={fetchDetail}
          accessibilityRole="button"
          accessibilityLabel="Làm mới"
        >
          <Ionicons name="refresh" size={20} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>
      <GoldDoubleRule />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* ── 1. STATUS HERO BANNER ── */}
        <View style={[styles.statusHeroCard, { backgroundColor: statusInfo.bg }]}>
          <View style={styles.statusHeroHeader}>
            <View style={styles.statusHeroLeft}>
              <Ionicons name={statusInfo.icon as any} size={22} color={statusInfo.color} />
              <Text style={[styles.statusHeroTitle, { color: statusInfo.color }]}>
                {statusInfo.label}
              </Text>
            </View>
            <View style={styles.bookingCodeBadge}>
              <Text style={styles.bookingCodeText}>{booking.bookingCode}</Text>
            </View>
          </View>

          <Text style={styles.statusHeroDesc}>{statusInfo.desc}</Text>

          {/* 10-Min Hold Countdown */}
          {booking.status === 'PENDING_PAYMENT' && (
            <View style={styles.holdCountdownBox}>
              <Ionicons name="stopwatch" size={20} color="#B45309" />
              <View style={{ flex: 1 }}>
                <Text style={styles.holdCountdownTitle}>
                  Thời gian tạm giữ chỗ còn lại:
                </Text>
                <Text style={styles.holdCountdownTimer}>
                  {Math.floor(holdSecondsLeft / 60)} phút {(holdSecondsLeft % 60).toString().padStart(2, '0')} giây
                </Text>
              </View>
            </View>
          )}

          {/* 2-Hour Approval Countdown */}
          {booking.status === 'AWAITING_EXPERT_APPROVAL' && (
            <View style={styles.approvalCountdownBox}>
              <Ionicons name="hourglass" size={20} color="#1E40AF" />
              <View style={{ flex: 1 }}>
                <Text style={styles.approvalCountdownTitle}>
                  Hạn chót chuyên gia tiếp nhận (SLA 2 giờ):
                </Text>
                <Text style={styles.approvalCountdownTimer}>
                  {Math.floor(approvalSecondsLeft / 3600)} giờ {Math.floor((approvalSecondsLeft % 3600) / 60)} phút
                </Text>
              </View>
            </View>
          )}

          {/* Rejection / Cancellation Reason */}
          {booking.rejectionReason && (
            <View style={styles.reasonBox}>
              <Text style={styles.reasonLabel}>Lý do chuyên gia từ chối:</Text>
              <Text style={styles.reasonText}>{booking.rejectionReason}</Text>
            </View>
          )}

          {booking.cancellationReason && (
            <View style={styles.reasonBox}>
              <Text style={styles.reasonLabel}>Lý do hủy lịch:</Text>
              <Text style={styles.reasonText}>{booking.cancellationReason}</Text>
            </View>
          )}

          {/* Refund notification */}
          {booking.refundStatus && booking.refundStatus !== 'NONE' && (
            <View style={styles.refundBox}>
              <Ionicons name="cash-outline" size={16} color="#065F46" />
              <Text style={styles.refundText}>
                Trạng thái hoàn tiền: <Text style={styles.boldText}>{booking.refundStatus}</Text> (Hoàn 100% chi phí đã đóng)
              </Text>
            </View>
          )}
        </View>

        {/* ── 2. THÔNG TIN CHUYÊN GIA ── */}
        <View style={styles.cardSection}>
          <Text style={styles.sectionHeaderTitle}>Chuyên gia tư vấn</Text>
          <View style={styles.expertRow}>
            <View style={styles.expertAvatarWrap}>
              {booking.expertAvatarUrl ? (
                <Image source={{ uri: booking.expertAvatarUrl }} style={styles.expertAvatar} />
              ) : (
                <View style={styles.expertAvatarPlaceholder}>
                  <Text style={styles.expertAvatarLetter}>
                    {booking.expertFullName.trim().charAt(booking.expertFullName.trim().length - 1)}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.expertInfo}>
              <Text style={styles.expertName}>{booking.expertFullName}</Text>
              <Text style={styles.expertJobTitle}>{booking.expertJobTitle || 'Chuyên gia thuế'}</Text>
              <TouchableOpacity
                style={styles.viewProfileBtn}
                onPress={() =>
                  navigation.navigate('ExpertDetail', { expertProfileId: booking.expertProfileId })
                }
              >
                <Text style={styles.viewProfileBtnText}>Xem lại hồ sơ chuyên gia</Text>
                <Ionicons name="chevron-forward" size={12} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── 3. THÔNG TIN PHIÊN TƯ VẤN & CHI PHÍ ── */}
        <View style={styles.cardSection}>
          <Text style={styles.sectionHeaderTitle}>Chi tiết phiên tư vấn</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Ngày hẹn:</Text>
            <Text style={styles.infoValueBold}>{formatVietnameseDate(booking.slotDate)}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Khung giờ:</Text>
            <Text style={styles.infoValue}>
              {formatTimeRange(booking.startTime, booking.endTime)} ({booking.durationMinutes} phút)
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Hình thức tư vấn:</Text>
            <View style={[styles.sessionBadge, { backgroundColor: `${sessionInfo.color}18` }]}>
              <Ionicons name={sessionInfo.icon as any} size={13} color={sessionInfo.color} />
              <Text style={[styles.sessionBadgeText, { color: sessionInfo.color }]}>
                {sessionInfo.label}
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Lĩnh vực chuyên môn:</Text>
            <Text style={styles.infoValue}>{booking.specializationName}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.feeLabel}>Mức phí tư vấn:</Text>
            <Text style={styles.feeValue}>{formatVnd(booking.fee)}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Thanh toán:</Text>
            <Text
              style={[
                styles.infoValue,
                { color: booking.paidAt ? '#059669' : '#D97706', fontWeight: '600' },
              ]}
            >
              {booking.paidAt
                ? `Đã thanh toán (${formatVietnameseDate(booking.paidAt.split('T')[0])})`
                : 'Chưa thanh toán'}
            </Text>
          </View>
        </View>

        {/* ── 4. CHỦ ĐỀ & MÔ TẢ VẤN ĐỀ ── */}
        <View style={styles.cardSection}>
          <Text style={styles.sectionHeaderTitle}>Nội dung câu hỏi của bạn</Text>

          <View style={styles.topicWrap}>
            <Text style={styles.topicLabel}>Tiêu đề câu hỏi:</Text>
            <Text style={styles.topicTitleText}>{booking.topicTitle}</Text>
          </View>

          <View style={styles.problemWrap}>
            <Text style={styles.topicLabel}>Mô tả chi tiết:</Text>
            <Text style={styles.problemDescText}>{booking.problemDescription}</Text>
          </View>
        </View>

        {/* ── 5. DANH SÁCH TÀI LIỆU ĐÍNH KÈM ── */}
        {booking.attachments && booking.attachments.length > 0 && (
          <View style={styles.cardSection}>
            <Text style={styles.sectionHeaderTitle}>
              Tài liệu đính kèm ({booking.attachments.length})
            </Text>

            {booking.attachments.map((att) => (
              <View key={att.id} style={styles.attItemRow}>
                <Ionicons
                  name={att.contentType.includes('image') ? 'image-outline' : 'document-text-outline'}
                  size={20}
                  color={theme.colors.primary}
                  style={{ marginRight: 8 }}
                />
                <View style={styles.attInfo}>
                  <Text style={styles.attName} numberOfLines={1}>
                    {att.fileName}
                  </Text>
                  <Text style={styles.attSize}>{(att.fileSize / 1024).toFixed(1)} KB</Text>
                </View>

                <TouchableOpacity
                  style={styles.downloadBtn}
                  onPress={() => handleDownloadAttachment(att.id)}
                  disabled={downloadingId === att.id}
                >
                  {downloadingId === att.id ? (
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                  ) : (
                    <>
                      <Ionicons name="download-outline" size={16} color={theme.colors.primary} />
                      <Text style={styles.downloadBtnText}>Tải về</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* ── 6. ACTION BUTTONS ── */}
        <View style={styles.actionsWrap}>
          {canCancel && (
            <TouchableOpacity
              style={styles.cancelBookingBtn}
              onPress={() => setCancelModalVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Hủy lịch hẹn"
            >
              <Ionicons name="close-circle-outline" size={18} color={theme.colors.error} />
              <Text style={styles.cancelBookingBtnText}>Hủy lịch hẹn này</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.bookAnotherBtn}
            onPress={() => navigation.navigate('ExpertList')}
            accessibilityRole="button"
            accessibilityLabel="Đặt lịch khác"
          >
            <Ionicons name="search" size={18} color={theme.colors.primary} />
            <Text style={styles.bookAnotherBtnText}>Tìm chuyên gia khác</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── MODAL XÁC NHẬN HỦY ── */}
      <Modal
        visible={cancelModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCancelModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.cancelModalBox}>
            <View style={styles.cancelModalHeader}>
              <Ionicons name="alert-circle" size={28} color={theme.colors.error} />
              <Text style={styles.cancelModalTitle}>Xác nhận hủy lịch hẹn</Text>
            </View>

            <Text style={styles.cancelModalDesc}>
              Bạn có chắc chắn muốn hủy lịch hẹn {booking.bookingCode}? Khung giờ sẽ được giải phóng
              cho khách hàng khác.
            </Text>

            <Text style={styles.reasonInputLabel}>Lý do hủy (không bắt buộc):</Text>
            <TextInput
              style={styles.reasonInput}
              placeholder="Nhập lý do bạn hủy lịch..."
              placeholderTextColor="#999999"
              value={cancelReason}
              onChangeText={setCancelReason}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <View style={styles.cancelModalBtnRow}>
              <TouchableOpacity
                style={styles.cancelModalCloseBtn}
                onPress={() => setCancelModalVisible(false)}
                disabled={cancelling}
              >
                <Text style={styles.cancelModalCloseBtnText}>Đóng</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelModalSubmitBtn}
                onPress={handleConfirmCancel}
                disabled={cancelling}
              >
                {cancelling ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.cancelModalSubmitBtnText}>Xác nhận hủy</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAF5EE',
  },

  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },

  // Hero Card
  statusHeroCard: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E8DEC8',
    ...theme.shadows.card,
  },
  statusHeroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  statusHeroLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusHeroTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 16,
  },
  bookingCodeBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2D7C2',
  },
  bookingCodeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: theme.colors.primary,
  },
  statusHeroDesc: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#444444',
    lineHeight: 18,
  },

  holdCountdownBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 8,
    gap: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  holdCountdownTitle: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#78350F',
  },
  holdCountdownTimer: {
    fontFamily: fonts.serifBold,
    fontSize: 16,
    color: '#B45309',
    fontVariant: ['tabular-nums'],
  },

  approvalCountdownBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 8,
    gap: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  approvalCountdownTitle: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#1E3A8A',
  },
  approvalCountdownTimer: {
    fontFamily: fonts.serifBold,
    fontSize: 16,
    color: '#2563EB',
    fontVariant: ['tabular-nums'],
  },

  reasonBox: {
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  reasonLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: theme.colors.error,
  },
  reasonText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#333333',
    marginTop: 2,
  },
  refundBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    padding: 8,
    borderRadius: 6,
    gap: 6,
    marginTop: 8,
  },
  refundText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#065F46',
  },
  boldText: {
    fontFamily: fonts.bodyBold,
  },

  // Card Sections
  cardSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  sectionHeaderTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 14,
    color: theme.colors.primary,
    marginBottom: 10,
  },

  // Expert row
  expertRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expertAvatarWrap: {
    marginRight: 12,
  },
  expertAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  expertAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#8B1E1E1C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  expertAvatarLetter: {
    fontFamily: fonts.serifBold,
    fontSize: 20,
    color: theme.colors.primary,
  },
  expertInfo: {
    flex: 1,
  },
  expertName: {
    fontFamily: fonts.serifBold,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  expertJobTitle: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  viewProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
  },
  viewProfileBtnText: {
    fontFamily: fonts.bodySemi,
    fontSize: 11,
    color: theme.colors.primary,
  },

  // Info rows
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  infoLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#666666',
  },
  infoValue: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: theme.colors.textPrimary,
  },
  infoValueBold: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  sessionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 4,
  },
  sessionBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
  },
  divider: {
    height: 1,
    backgroundColor: '#EFEAE0',
    marginVertical: 6,
  },
  feeLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  feeValue: {
    fontFamily: fonts.serifBold,
    fontSize: 16,
    color: theme.colors.primary,
    fontVariant: ['tabular-nums'],
  },

  // Topic & problem
  topicWrap: {
    marginBottom: 8,
  },
  topicLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: '#777777',
    marginBottom: 2,
  },
  topicTitleText: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  problemWrap: {},
  problemDescText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#444444',
    lineHeight: 18,
  },

  // Attachments
  attItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF7F1',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#EFE8DC',
    marginBottom: 6,
  },
  attInfo: {
    flex: 1,
  },
  attName: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: theme.colors.textPrimary,
  },
  attSize: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: '#888888',
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: theme.colors.goldLight,
    gap: 4,
  },
  downloadBtnText: {
    fontFamily: fonts.bodySemi,
    fontSize: 11,
    color: theme.colors.primary,
  },

  // Actions
  actionsWrap: {
    gap: 10,
    marginTop: 6,
  },
  cancelBookingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  cancelBookingBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: theme.colors.error,
  },
  bookAnotherBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAF5EE',
    borderWidth: 1,
    borderColor: theme.colors.goldLight,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  bookAnotherBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: theme.colors.primary,
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

  // Cancel Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  cancelModalBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    width: '100%',
    maxWidth: 360,
  },
  cancelModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  cancelModalTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 16,
    color: theme.colors.error,
  },
  cancelModalDesc: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: '#444444',
    lineHeight: 18,
    marginBottom: 12,
  },
  reasonInputLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  reasonInput: {
    backgroundColor: theme.colors.inputBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 10,
    fontFamily: fonts.body,
    fontSize: 12,
    color: theme.colors.textPrimary,
    minHeight: 70,
    marginBottom: 16,
  },
  cancelModalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  cancelModalCloseBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#F3EFE6',
  },
  cancelModalCloseBtnText: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: '#555555',
  },
  cancelModalSubmitBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: theme.colors.error,
  },
  cancelModalSubmitBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: '#FFFFFF',
  },
});
