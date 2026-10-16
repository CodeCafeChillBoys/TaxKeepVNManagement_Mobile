import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
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
import { Dialog } from '../../components/common/Dialog';
import { RootNavigationProp, RootStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../stores/useAuthStore';
import { consultationApi } from '../../api/consultationApi';
import { toFriendlyConsultationError, formatRefundStatus } from '../../utils/consultationFriendlyErrors';
import type {
  BookingDetailResponse,
  PaymentLinkResponse,
  EscrowTransactionResponse,
  SharedTaxDossierResponse,
} from '../../types/consultation';
import {
  formatVnd,
  formatBookingStatus,
  formatSessionType,
  formatVietnameseDate,
  formatTimeRange,
  formatEscrowStatus,
} from '../../types/consultation';

export const BookingDetailScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'BookingDetail'>>();
  const { bookingId, isExpertView: isExpertViewParam } = route.params;

  const currentUser = useAuthStore((s) => s.user);
  const userRole = (currentUser?.role || '').toLowerCase();
  const isExpertRole = userRole === 'expert' || userRole.includes('expert');

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

  // Payment link modal
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentData, setPaymentData] = useState<PaymentLinkResponse | null>(null);

  // Live Consultation & Dossier states
  const [joiningMeeting, setJoiningMeeting] = useState(false);
  const [dossierModalVisible, setDossierModalVisible] = useState(false);
  const [dossierLoading, setDossierLoading] = useState(false);
  const [dossierData, setDossierData] = useState<SharedTaxDossierResponse | null>(null);

  // Complete consultation modal
  const [completeModalVisible, setCompleteModalVisible] = useState(false);
  const [sharedNotes, setSharedNotes] = useState('');
  const [completing, setCompleting] = useState(false);

  // Report No-Show modal
  const [noShowModalVisible, setNoShowModalVisible] = useState(false);
  const [noShowParty, setNoShowParty] = useState<'CUSTOMER' | 'EXPERT'>('CUSTOMER');
  const [noShowReason, setNoShowReason] = useState('');
  const [reportingNoShow, setReportingNoShow] = useState(false);

  // Escrow detail modal
  const [escrowModalVisible, setEscrowModalVisible] = useState(false);
  const [escrowLoading, setEscrowLoading] = useState(false);
  const [escrowTx, setEscrowTx] = useState<EscrowTransactionResponse | null>(null);

  // Dialog state
  const [dialog, setDialog] = useState<{
    title: string;
    message: string;
    primaryLabel?: string;
    onPrimary?: () => void;
    secondaryLabel?: string;
    onSecondary?: () => void;
    destructive?: boolean;
  } | null>(null);

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
      setDialog({
        title: 'Đã hủy lịch hẹn',
        message: 'Bạn đã hủy lịch hẹn tư vấn thành công.',
        primaryLabel: 'Đóng',
        onPrimary: () => setDialog(null),
      });
    } catch (err: any) {
      const friendly = toFriendlyConsultationError(
        err,
        'Không thể hủy lịch',
        'Hệ thống chưa thể hủy lịch hẹn lúc này.'
      );
      setDialog({
        title: friendly.title,
        message: friendly.message,
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
    } finally {
      setCancelling(false);
    }
  };

  // Reject modal (Expert)
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [accepting, setAccepting] = useState(false);

  // Handle Accept Booking (Expert)
  const handleAcceptBooking = () => {
    setDialog({
      title: 'Tiếp nhận ca tư vấn',
      message: `Bạn đồng ý tiếp nhận ca tư vấn của khách hàng ${booking?.userFullName}?`,
      primaryLabel: 'Đồng ý tiếp nhận',
      secondaryLabel: 'Hủy',
      onSecondary: () => setDialog(null),
      onPrimary: async () => {
        setDialog(null);
        setAccepting(true);
        try {
          const updated = await consultationApi.acceptBooking(bookingId);
          setBooking(updated);
          setDialog({
            title: 'Thành công',
            message: 'Bạn đã tiếp nhận ca tư vấn. Lịch hẹn chính thức được xác nhận.',
            primaryLabel: 'Đóng',
            onPrimary: () => setDialog(null),
          });
        } catch (err: any) {
          const friendly = toFriendlyConsultationError(
            err,
            'Không thể tiếp nhận',
            'Không thể tiếp nhận ca tư vấn lúc này.'
          );
          setDialog({
            title: friendly.title,
            message: friendly.message,
            primaryLabel: 'Đã hiểu',
            onPrimary: () => setDialog(null),
          });
        } finally {
          setAccepting(false);
        }
      },
    });
  };

  // Handle Reject Booking (Expert)
  const handleConfirmReject = async () => {
    if (!rejectReason.trim() || rejectReason.trim().length < 5) {
      setDialog({
        title: 'Cần nêu rõ lý do',
        message: 'Vui lòng nhập lý do từ chối tối thiểu 5 ký tự để khách hàng nắm thông tin.',
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
      return;
    }
    setRejecting(true);
    try {
      const updated = await consultationApi.rejectBooking(bookingId, rejectReason.trim());
      setBooking(updated);
      setRejectModalVisible(false);
      setRejectReason('');
      setDialog({
        title: 'Đã từ chối ca tư vấn',
        message: 'Bạn đã từ chối ca tư vấn. Hệ thống tự động hoàn tiền 100% cho khách hàng.',
        primaryLabel: 'Đóng',
        onPrimary: () => setDialog(null),
      });
    } catch (err: any) {
      const friendly = toFriendlyConsultationError(
        err,
        'Không thể từ chối',
        'Không thể từ chối ca tư vấn lúc này.'
      );
      setDialog({
        title: friendly.title,
        message: friendly.message,
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
    } finally {
      setRejecting(false);
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
        setDialog({
          title: 'Thông báo',
          message: 'Đường dẫn tệp tin đính kèm hiện không khả dụng.',
          primaryLabel: 'Đã hiểu',
          onPrimary: () => setDialog(null),
        });
      }
    } catch (err: any) {
      const friendly = toFriendlyConsultationError(
        err,
        'Lỗi tải tệp',
        'Không thể lấy đường dẫn tải tệp đính kèm.'
      );
      setDialog({
        title: friendly.title,
        message: friendly.message,
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
    } finally {
      setDownloadingId(null);
    }
  };

  // Handle Payment Link
  const handleOpenPayment = async () => {
    setPaymentLoading(true);
    try {
      const res = await consultationApi.createPaymentLink(bookingId);
      setPaymentData(res);
      setPaymentModalVisible(true);
    } catch (err: any) {
      const friendly = toFriendlyConsultationError(
        err,
        'Lỗi thanh toán',
        'Không thể tạo liên kết thanh toán lúc này.'
      );
      setDialog({
        title: friendly.title,
        message: friendly.message,
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
    } finally {
      setPaymentLoading(false);
    }
  };

  // Handle Join Consultation Meeting
  const handleJoinMeeting = async () => {
    setJoiningMeeting(true);
    try {
      const res = await consultationApi.joinConsultation(bookingId);
      if (res?.roomUrl) {
        await Linking.openURL(res.roomUrl);
        fetchDetail();
      } else {
        setDialog({
          title: 'Thông báo',
          message: 'Chưa thể kết nối tới phòng tư vấn trực tuyến lúc này.',
          primaryLabel: 'Đã hiểu',
          onPrimary: () => setDialog(null),
        });
      }
    } catch (err: any) {
      const friendly = toFriendlyConsultationError(
        err,
        'Phòng tư vấn',
        'Chưa thể vào phòng tư vấn trực tuyến.'
      );
      setDialog({
        title: friendly.title,
        message: friendly.message,
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
    } finally {
      setJoiningMeeting(false);
    }
  };

  // Handle Open Shared Dossier
  const handleOpenDossier = async () => {
    setDossierLoading(true);
    setDossierModalVisible(true);
    try {
      const res = await consultationApi.getSharedTaxDossier(bookingId);
      setDossierData(res);
    } catch (err: any) {
      const friendly = toFriendlyConsultationError(
        err,
        'Hồ sơ thuế',
        'Không thể tải hồ sơ thuế chia sẻ lúc này.'
      );
      setDialog({
        title: friendly.title,
        message: friendly.message,
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
    } finally {
      setDossierLoading(false);
    }
  };

  // Handle Confirm Complete (Expert)
  const handleConfirmComplete = async () => {
    if (!sharedNotes.trim() || sharedNotes.trim().length < 10) {
      setDialog({
        title: 'Cần biên bản tóm tắt',
        message: 'Biên bản tóm tắt buổi tư vấn phải có tối thiểu 10 ký tự.',
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
      return;
    }
    setCompleting(true);
    try {
      await consultationApi.completeConsultation(bookingId, sharedNotes.trim());
      setCompleteModalVisible(false);
      setSharedNotes('');
      setDialog({
        title: 'Hoàn tất ca tư vấn',
        message:
          'Ca tư vấn đã được hoàn tất thành công. Số tiền ký quỹ được chuyển sang giai đoạn chờ kết toán 24 giờ để đối soát bảo vệ quyền lợi hai bên trước khi giải ngân vào ví.',
        primaryLabel: 'Đóng',
        onPrimary: () => setDialog(null),
      });
      fetchDetail();
    } catch (err: any) {
      const friendly = toFriendlyConsultationError(
        err,
        'Không thể hoàn tất',
        'Không thể hoàn tất ca tư vấn lúc này.'
      );
      setDialog({
        title: friendly.title,
        message: friendly.message,
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
    } finally {
      setCompleting(false);
    }
  };

  // Handle Confirm No-Show
  const handleConfirmNoShow = async () => {
    setReportingNoShow(true);
    try {
      await consultationApi.reportNoShow(bookingId, noShowReason.trim() || undefined);
      setNoShowModalVisible(false);
      setNoShowReason('');
      setDialog({
        title: 'Đã báo vắng mặt',
        message:
          'Hệ thống đã ghi nhận tình trạng vắng mặt và áp dụng quy tắc xử lý bảo vệ quyền lợi hai bên.',
        primaryLabel: 'Đóng',
        onPrimary: () => setDialog(null),
      });
      fetchDetail();
    } catch (err: any) {
      const friendly = toFriendlyConsultationError(
        err,
        'Không thể báo vắng mặt',
        'Không thể báo vắng mặt lúc này.'
      );
      setDialog({
        title: friendly.title,
        message: friendly.message,
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
    } finally {
      setReportingNoShow(false);
    }
  };

  // Handle Open Escrow Details
  const handleOpenEscrow = async () => {
    // Nếu ca tư vấn chưa từng thanh toán và không ở trạng thái chờ thanh toán
    if (!booking?.paidAt && booking?.status !== 'PENDING_PAYMENT') {
      setDialog({
        title: 'Ký quỹ bảo đảm',
        message: 'Lịch hẹn này chưa từng thực hiện thanh toán nên không phát sinh giao dịch ký quỹ bảo đảm.',
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
      return;
    }

    setEscrowLoading(true);
    try {
      const res = await consultationApi.getBookingEscrow(bookingId);
      setEscrowTx(res);
      setEscrowModalVisible(true);
    } catch (err: any) {
      setEscrowModalVisible(false);
      const isNotFound =
        err?.response?.status === 404 ||
        err?.response?.data?.message?.includes('Chưa khởi tạo') ||
        err?.message?.includes('Chưa khởi tạo');

      if (isNotFound) {
        if (booking?.status === 'PENDING_PAYMENT') {
          setDialog({
            title: 'Chưa có giao dịch ký quỹ',
            message:
              'Lịch hẹn này chưa thực hiện thanh toán nên chưa khởi tạo giao dịch bảo đảm. Bạn có muốn thanh toán ngay không?',
            primaryLabel: 'Thanh toán ngay',
            secondaryLabel: 'Để sau',
            onSecondary: () => setDialog(null),
            onPrimary: () => {
              setDialog(null);
              handleOpenPayment();
            },
          });
        } else {
          setDialog({
            title: 'Ký quỹ bảo đảm',
            message: 'Chưa phát sinh giao dịch ký quỹ cho ca tư vấn này.',
            primaryLabel: 'Đã hiểu',
            onPrimary: () => setDialog(null),
          });
        }
      } else {
        const friendly = toFriendlyConsultationError(
          err,
          'Ký quỹ bảo đảm',
          'Không thể tải thông tin ký quỹ lúc này.'
        );
        setDialog({
          title: friendly.title,
          message: friendly.message,
          primaryLabel: 'Đã hiểu',
          onPrimary: () => setDialog(null),
        });
      }
    } finally {
      setEscrowLoading(false);
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

  // Xác định xem màn hình đang được xem từ phía Chuyên gia hay Người nộp thuế
  const isExpertView =
    Boolean(isExpertViewParam) ||
    Boolean(
      isExpertRole &&
        booking &&
        ((currentUser?.id && String(booking.userId).toLowerCase() !== String(currentUser.id).toLowerCase()) ||
          (currentUser?.fullName &&
            booking.expertFullName &&
            currentUser.fullName.trim().toLowerCase() === booking.expertFullName.trim().toLowerCase()))
    );

  // Can user cancel this booking? (Chỉ người nộp thuế mới có thao tác hủy lịch tại đây)
  const canCancel =
    !isExpertView &&
    (booking.status === 'PENDING_PAYMENT' ||
      booking.status === 'AWAITING_EXPERT_APPROVAL' ||
      booking.status === 'CONFIRMED');

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
                  Thời gian chờ chuyên gia tiếp nhận:
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
                Trạng thái hoàn tiền: <Text style={styles.boldText}>{formatRefundStatus(booking.refundStatus)}</Text> (Hoàn 100% chi phí đã đóng)
              </Text>
            </View>
          )}
        </View>

        {/* ── 2. THÔNG TIN ĐỐI TÁC PHIÊN TƯ VẤN (CHUYÊN GIA HOẶC KHÁCH HÀNG) ── */}
        {isExpertView ? (
          <View style={styles.cardSection}>
            <Text style={styles.sectionHeaderTitle}>Khách hàng tư vấn</Text>
            <View style={styles.clientRow}>
              <View style={styles.clientAvatarWrap}>
                <View style={styles.clientAvatarPlaceholder}>
                  <Text style={styles.clientAvatarLetter}>
                    {booking.userFullName ? booking.userFullName.trim().charAt(booking.userFullName.trim().length - 1) : 'K'}
                  </Text>
                </View>
              </View>

              <View style={styles.clientInfo}>
                <Text style={styles.clientName}>{booking.userFullName || 'Khách hàng'}</Text>
                {booking.userPhoneNumber ? (
                  <View style={styles.clientMetaRow}>
                    <Ionicons name="call-outline" size={13} color="#666666" />
                    <Text style={styles.clientMetaText}>{booking.userPhoneNumber}</Text>
                  </View>
                ) : null}
                {booking.userEmail ? (
                  <View style={styles.clientMetaRow}>
                    <Ionicons name="mail-outline" size={13} color="#666666" />
                    <Text style={styles.clientMetaText}>{booking.userEmail}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        ) : (
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
        )}

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
                {sessionInfo.fullLabel || sessionInfo.label}
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
          {/* Quyết định tiếp nhận dành cho chuyên gia khi ca đang chờ phê duyệt */}
          {isExpertView && booking.status === 'AWAITING_EXPERT_APPROVAL' && (
            <View style={styles.expertActionBlock}>
              <Text style={styles.expertActionTitle}>Quyết định tiếp nhận ca tư vấn</Text>
              <View style={styles.expertBtnRow}>
                <TouchableOpacity
                  style={styles.acceptBtn}
                  onPress={handleAcceptBooking}
                  disabled={accepting}
                  accessibilityRole="button"
                  accessibilityLabel="Tiếp nhận ca"
                >
                  {accepting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                      <Text style={styles.acceptBtnText}>Tiếp nhận ca</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.rejectBtn}
                  onPress={() => setRejectModalVisible(true)}
                  disabled={accepting}
                  accessibilityRole="button"
                  accessibilityLabel="Từ chối"
                >
                  <Ionicons name="close-circle-outline" size={18} color={theme.colors.error} />
                  <Text style={styles.rejectBtnText}>Từ chối</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Thanh toán ngay nếu PENDING_PAYMENT (chỉ dành cho khách hàng) */}
          {!isExpertView && booking.status === 'PENDING_PAYMENT' && (
            <TouchableOpacity
              style={styles.payNowBtn}
              onPress={handleOpenPayment}
              disabled={paymentLoading}
              accessibilityRole="button"
              accessibilityLabel="Thanh toán bảo chứng ngay"
            >
              {paymentLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="card" size={18} color="#FFFFFF" />
                  <Text style={styles.payNowBtnText}>Thanh toán bảo chứng (VNPay / VietQR)</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Hành động khi CONFIRMED hoặc IN_PROGRESS */}
          {(booking.status === 'CONFIRMED' || booking.status === 'IN_PROGRESS') && (
            <View style={styles.liveConsultationCard}>
              <View style={styles.liveConsultationHeader}>
                <Ionicons name="videocam" size={20} color={theme.colors.primary} />
                <Text style={styles.liveConsultationTitle}>Phiên tư vấn trực tuyến</Text>
              </View>
              <Text style={styles.liveConsultationDesc}>
                Phòng tư vấn mở trước giờ hẹn 10 phút. Hệ thống tự động chuyển sang "Đang tư vấn" khi cả hai bên tham gia.
              </Text>

              <TouchableOpacity
                style={styles.joinMeetingBtn}
                onPress={handleJoinMeeting}
                disabled={joiningMeeting}
                accessibilityRole="button"
                accessibilityLabel="Vào phòng tư vấn ngay"
              >
                {joiningMeeting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="videocam" size={18} color="#FFFFFF" />
                    <Text style={styles.joinMeetingBtnText}>Vào phòng tư vấn trực tuyến</Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.consultationSubBtnRow}>
                <TouchableOpacity
                  style={styles.dossierBtn}
                  onPress={handleOpenDossier}
                  accessibilityRole="button"
                  accessibilityLabel="Xem hồ sơ thuế chia sẻ"
                >
                  <Ionicons name="folder-open-outline" size={16} color={theme.colors.primary} />
                  <Text style={styles.dossierBtnText}>Hồ sơ thuế chia sẻ</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.completeBtn}
                  onPress={() => setCompleteModalVisible(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Biên bản & Hoàn thành"
                >
                  <Ionicons name="checkmark-done-circle-outline" size={16} color="#059669" />
                  <Text style={styles.completeBtnText}>Biên bản & Kết thúc</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.noShowBtn}
                onPress={() => setNoShowModalVisible(true)}
                accessibilityRole="button"
                accessibilityLabel="Báo vắng mặt"
              >
                <Ionicons name="person-remove-outline" size={14} color={theme.colors.error} />
                <Text style={styles.noShowBtnText}>Báo vắng mặt (sau 15 phút)</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Khi COMPLETED hoặc SETTLED */}
          {(booking.status === 'COMPLETED' || booking.status === 'SETTLED') && (
            <View style={styles.completedNoticeCard}>
              <View style={styles.liveConsultationHeader}>
                <Ionicons name="checkmark-circle" size={20} color="#059669" />
                <Text style={[styles.liveConsultationTitle, { color: '#065F46' }]}>
                  Ca tư vấn đã hoàn tất
                </Text>
              </View>
              <TouchableOpacity style={styles.dossierBtn} onPress={handleOpenDossier}>
                <Ionicons name="folder-open-outline" size={16} color={theme.colors.primary} />
                <Text style={styles.dossierBtnText}>Xem lại hồ sơ thuế chia sẻ</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Nút xem Ký quỹ bảo đảm: Chỉ hiển thị khi có liên quan tới thanh toán */}
          {(Boolean(booking.paidAt) || booking.status === 'PENDING_PAYMENT' || (booking.refundStatus && booking.refundStatus !== 'NONE')) && (
            <TouchableOpacity
              style={styles.escrowViewBtn}
              onPress={handleOpenEscrow}
              disabled={escrowLoading}
              accessibilityRole="button"
              accessibilityLabel="Xem ký quỹ bảo đảm"
            >
              {escrowLoading ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <>
                  <Ionicons name="shield-checkmark-outline" size={16} color={theme.colors.primary} />
                  <Text style={styles.escrowViewBtnText}>Xem chi tiết ký quỹ bảo đảm</Text>
                </>
              )}
            </TouchableOpacity>
          )}

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

          {!isExpertView && (
            <TouchableOpacity
              style={styles.bookAnotherBtn}
              onPress={() => navigation.navigate('ExpertList')}
              accessibilityRole="button"
              accessibilityLabel="Đặt lịch khác"
            >
              <Ionicons name="search" size={18} color={theme.colors.primary} />
              <Text style={styles.bookAnotherBtnText}>Tìm chuyên gia khác</Text>
            </TouchableOpacity>
          )}
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
              Bạn có chắc chắn muốn hủy lịch hẹn này? Khung giờ sẽ được giải phóng cho khách hàng khác.
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

      {/* ── MODAL TỪ CHỐI TIẾP NHẬN (EXPERT) ── */}
      <Modal
        visible={rejectModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.cancelModalBox}>
            <View style={styles.cancelModalHeader}>
              <Ionicons name="close-circle" size={28} color={theme.colors.error} />
              <Text style={styles.cancelModalTitle}>Từ chối tiếp nhận ca tư vấn</Text>
            </View>

            <Text style={styles.cancelModalDesc}>
              Hệ thống sẽ hoàn trả 100% chi phí cho khách hàng và giải phóng khung giờ. Vui lòng cho biết lý do từ chối:
            </Text>

            <Text style={styles.reasonInputLabel}>Lý do từ chối (tối thiểu 5 ký tự) *:</Text>
            <TextInput
              style={styles.reasonInput}
              placeholder="VD: Trùng lịch đột xuất tại cơ quan thuế, lĩnh vực chưa phù hợp..."
              placeholderTextColor="#999999"
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <View style={styles.cancelModalBtnRow}>
              <TouchableOpacity
                style={styles.cancelModalCloseBtn}
                onPress={() => setRejectModalVisible(false)}
                disabled={rejecting}
              >
                <Text style={styles.cancelModalCloseBtnText}>Đóng</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelModalSubmitBtn}
                onPress={handleConfirmReject}
                disabled={rejecting}
              >
                {rejecting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.cancelModalSubmitBtnText}>Xác nhận từ chối</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── MODAL THANH TOÁN BẢO CHỨNG (VNPAY / VIETQR) ── */}
      <Modal
        visible={paymentModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPaymentModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.paymentModalBox}>
            <View style={styles.paymentModalHeader}>
              <View style={styles.paymentHeaderIcon}>
                <Ionicons name="shield-checkmark" size={24} color="#059669" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.paymentModalTitle}>Thanh toán bảo chứng</Text>
                <Text style={styles.paymentModalSubtitle}>
                  Thanh toán an toàn qua cổng ngân hàng
                </Text>
              </View>
              <TouchableOpacity onPress={() => setPaymentModalVisible(false)}>
                <Ionicons name="close" size={24} color="#777777" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              <View style={styles.paymentAmountCard}>
                <Text style={styles.paymentAmountLabel}>Số tiền cần thanh toán</Text>
                <Text style={styles.paymentAmountValue}>
                  {formatVnd(paymentData?.amount ?? booking.fee)}
                </Text>
              </View>

              {/* VietQR Code Image if available */}
              {paymentData?.qrCode ? (
                <View style={styles.qrCodeSection}>
                  <Text style={styles.qrInstruction}>
                    Quét mã VietQR bằng ứng dụng Ngân hàng hoặc Ví điện tử:
                  </Text>
                  <View style={styles.qrImageWrap}>
                    <Image
                      source={{ uri: paymentData.qrCode }}
                      style={styles.qrImage}
                      resizeMode="contain"
                    />
                  </View>
                </View>
              ) : null}

              {/* Open VNPay Link */}
              {paymentData?.checkoutUrl ? (
                <TouchableOpacity
                  style={styles.vnpayLinkBtn}
                  onPress={() => paymentData.checkoutUrl && Linking.openURL(paymentData.checkoutUrl)}
                >
                  <Ionicons name="open-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.vnpayLinkBtnText}>Mở cổng thanh toán VNPay</Text>
                </TouchableOpacity>
              ) : null}

              <View style={styles.escrowNoticeBox}>
                <Ionicons name="information-circle" size={18} color="#065F46" />
                <Text style={styles.escrowNoticeText}>
                  Khoản tiền được tạm giữ bảo đảm 100% tại TaxKeepVN. Tiền chỉ chuyển cho chuyên gia sau khi buổi tư vấn kết thúc thỏa đáng.
                </Text>
              </View>
            </ScrollView>

            <View style={styles.paymentFooter}>
              <TouchableOpacity
                style={styles.paidCheckBtn}
                onPress={() => {
                  setPaymentModalVisible(false);
                  fetchDetail();
                }}
              >
                <Text style={styles.paidCheckBtnText}>Tôi đã chuyển khoản xong</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── MODAL HỒ SƠ THUẾ CHIA SẺ ── */}
      <Modal
        visible={dossierModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDossierModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.dossierModalBox}>
            <View style={styles.dossierModalHeader}>
              <Ionicons name="folder-open" size={24} color={theme.colors.primary} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.dossierModalTitle}>Hồ sơ thuế chia sẻ</Text>
                <Text style={styles.dossierModalSubtitle}>
                  Khách hàng: {dossierData?.taxpayerFullName || booking.userFullName}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setDossierModalVisible(false)}>
                <Ionicons name="close" size={24} color="#777777" />
              </TouchableOpacity>
            </View>

            {dossierLoading ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={{ marginTop: 10, fontSize: 12, color: '#777777' }}>
                  Đang tải dữ liệu hồ sơ thuế...
                </Text>
              </View>
            ) : !dossierData ? (
              <View style={{ padding: 30, alignItems: 'center' }}>
                <Text style={{ fontSize: 13, color: '#666666' }}>Không có dữ liệu hồ sơ thuế chia sẻ.</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 450 }} showsVerticalScrollIndicator={false}>
                {/* Taxpayer info */}
                <View style={styles.dossierCard}>
                  <Text style={styles.dossierCardTitle}>Thông tin người nộp thuế</Text>
                  <View style={styles.dossierRow}>
                    <Text style={styles.dossierLabel}>Mã số thuế:</Text>
                    <Text style={styles.dossierValueBold}>
                      {dossierData.taxpayerTaxId || 'Chưa cung cấp'}
                    </Text>
                  </View>
                  <View style={styles.dossierRow}>
                    <Text style={styles.dossierLabel}>Số Căn cước công dân:</Text>
                    <Text style={styles.dossierValue}>{dossierData.taxpayerCitizenId || '—'}</Text>
                  </View>
                  <View style={styles.dossierRow}>
                    <Text style={styles.dossierLabel}>Email liên hệ:</Text>
                    <Text style={styles.dossierValue}>{dossierData.taxpayerEmail || '—'}</Text>
                  </View>
                  {dossierData.taxpayerPhone ? (
                    <View style={styles.dossierRow}>
                      <Text style={styles.dossierLabel}>Số điện thoại:</Text>
                      <Text style={styles.dossierValue}>{dossierData.taxpayerPhone}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Income Sources */}
                <View style={styles.dossierCard}>
                  <Text style={styles.dossierCardTitle}>
                    Nguồn thu nhập ({dossierData.incomeSources?.length || 0})
                  </Text>
                  {(!dossierData.incomeSources || dossierData.incomeSources.length === 0) ? (
                    <Text style={styles.dossierEmptyText}>Chưa có thông tin nguồn thu nhập.</Text>
                  ) : (
                    dossierData.incomeSources.map((s, idx) => (
                      <View key={idx} style={styles.dossierItemBox}>
                        <Text style={styles.dossierItemName}>{s.companyName}</Text>
                        <Text style={styles.dossierItemSub}>
                          MST: {s.companyTaxCode || '—'} • Thu nhập: {formatVnd(s.totalIncome)}
                        </Text>
                        <Text style={[styles.dossierItemSub, { color: '#059669' }]}>
                          Thuế đã khấu trừ: {formatVnd(s.taxWithheld)}
                        </Text>
                      </View>
                    ))
                  )}
                </View>

                {/* Dependents */}
                <View style={styles.dossierCard}>
                  <Text style={styles.dossierCardTitle}>
                    Người phụ thuộc ({dossierData.dependents?.length || 0})
                  </Text>
                  {(!dossierData.dependents || dossierData.dependents.length === 0) ? (
                    <Text style={styles.dossierEmptyText}>Chưa có thông tin người phụ thuộc.</Text>
                  ) : (
                    dossierData.dependents.map((dep, idx) => (
                      <View key={idx} style={styles.dossierItemBox}>
                        <Text style={styles.dossierItemName}>{dep.fullName}</Text>
                        <Text style={styles.dossierItemSub}>
                          Quan hệ: {dep.relationship} • Nhóm: {dep.currentGroup || '—'}
                        </Text>
                      </View>
                    ))
                  )}
                </View>

                {/* Draft settlement */}
                {dossierData.draftSettlement && (
                  <View style={styles.dossierCard}>
                    <Text style={styles.dossierCardTitle}>
                      Nháp quyết toán năm {dossierData.draftSettlement.taxYear}
                    </Text>
                    <View style={styles.dossierRow}>
                      <Text style={styles.dossierLabel}>Tổng thu nhập chịu thuế:</Text>
                      <Text style={styles.dossierValue}>
                        {formatVnd(dossierData.draftSettlement.totalGrossIncome)}
                      </Text>
                    </View>
                    <View style={styles.dossierRow}>
                      <Text style={styles.dossierLabel}>Giảm trừ gia cảnh:</Text>
                      <Text style={styles.dossierValueBold}>
                        {formatVnd(dossierData.draftSettlement.personalDeductionAmount)}
                      </Text>
                    </View>
                    <View style={styles.dossierRow}>
                      <Text style={styles.dossierLabel}>Giảm trừ bảo hiểm:</Text>
                      <Text style={styles.dossierValue}>
                        {formatVnd(dossierData.draftSettlement.totalInsuranceDeduction)}
                      </Text>
                    </View>
                    <View style={styles.dossierRow}>
                      <Text style={styles.dossierLabel}>Thuế đã khấu trừ:</Text>
                      <Text style={[styles.dossierValueBold, { color: '#059669' }]}>
                        {formatVnd(dossierData.draftSettlement.totalTaxWithheld)}
                      </Text>
                    </View>
                  </View>
                )}
              </ScrollView>
            )}

            <View style={{ marginTop: 12 }}>
              <TouchableOpacity
                style={styles.cancelModalCloseBtn}
                onPress={() => setDossierModalVisible(false)}
              >
                <Text style={[styles.cancelModalCloseBtnText, { textAlign: 'center' }]}>Đóng</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── MODAL BIÊN BẢN & KẾT THÚC CA (EXPERT) ── */}
      <Modal
        visible={completeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCompleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.cancelModalBox}>
            <View style={styles.cancelModalHeader}>
              <Ionicons name="checkmark-done-circle" size={28} color="#059669" />
              <Text style={[styles.cancelModalTitle, { color: '#065F46' }]}>
                Hoàn tất & Lưu biên bản ca tư vấn
              </Text>
            </View>

            <Text style={styles.cancelModalDesc}>
              Nhập tóm tắt kết quả tư vấn cho khách hàng. Biên bản này sẽ được lưu vào hồ sơ và hiển thị cho khách hàng.
            </Text>

            <Text style={styles.reasonInputLabel}>
              Biên bản tóm tắt kết quả tư vấn (tối thiểu 10 ký tự) *:
            </Text>
            <TextInput
              style={styles.reasonInput}
              placeholder="VD: Đã tư vấn hướng dẫn kê khai giảm trừ người phụ thuộc theo TT87, khách cần bổ sung giấy khai sinh..."
              placeholderTextColor="#999999"
              value={sharedNotes}
              onChangeText={setSharedNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={[styles.escrowNoticeBox, { marginBottom: 14 }]}>
              <Ionicons name="information-circle" size={16} color="#B45309" />
              <Text style={[styles.escrowNoticeText, { color: '#92400E' }]}>
                Sau khi kết thúc, tiền ký quỹ sẽ chuyển sang trạng thái Chờ kết toán 24 giờ để bảo vệ quyền lợi hai bên trước khi giải ngân vào ví.
              </Text>
            </View>

            <View style={styles.cancelModalBtnRow}>
              <TouchableOpacity
                style={styles.cancelModalCloseBtn}
                onPress={() => setCompleteModalVisible(false)}
                disabled={completing}
              >
                <Text style={styles.cancelModalCloseBtnText}>Đóng</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.cancelModalSubmitBtn, { backgroundColor: '#059669' }]}
                onPress={handleConfirmComplete}
                disabled={completing || sharedNotes.trim().length < 10}
              >
                {completing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.cancelModalSubmitBtnText}>Xác nhận hoàn tất</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── MODAL BÁO VẮNG MẶT (NO-SHOW) ── */}
      <Modal
        visible={noShowModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNoShowModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.cancelModalBox}>
            <View style={styles.cancelModalHeader}>
              <Ionicons name="person-remove" size={28} color={theme.colors.error} />
              <Text style={styles.cancelModalTitle}>Báo vắng mặt ca tư vấn</Text>
            </View>

            <Text style={styles.cancelModalDesc}>
              Áp dụng sau khi quá 15 phút so với giờ hẹn bắt đầu. Hệ thống sẽ xử lý bảo vệ quyền lợi của bên có mặt.
            </Text>

            <Text style={styles.reasonInputLabel}>Bên vắng mặt:</Text>
            <View style={styles.noShowPartyRow}>
              <TouchableOpacity
                style={[
                  styles.noShowPartyBtn,
                  noShowParty === 'CUSTOMER' && styles.noShowPartyBtnActive,
                ]}
                onPress={() => setNoShowParty('CUSTOMER')}
              >
                <Text
                  style={[
                    styles.noShowPartyText,
                    noShowParty === 'CUSTOMER' && styles.noShowPartyTextActive,
                  ]}
                >
                  Khách hàng vắng
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.noShowPartyBtn,
                  noShowParty === 'EXPERT' && styles.noShowPartyBtnActive,
                ]}
                onPress={() => setNoShowParty('EXPERT')}
              >
                <Text
                  style={[
                    styles.noShowPartyText,
                    noShowParty === 'EXPERT' && styles.noShowPartyTextActive,
                  ]}
                >
                  Chuyên gia vắng
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.reasonInputLabel}>Ghi chú thêm (không bắt buộc):</Text>
            <TextInput
              style={styles.reasonInput}
              placeholder="VD: Đã chờ trong phòng họp trực tuyến quá 15 phút không thấy khách..."
              placeholderTextColor="#999999"
              value={noShowReason}
              onChangeText={setNoShowReason}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <View style={styles.cancelModalBtnRow}>
              <TouchableOpacity
                style={styles.cancelModalCloseBtn}
                onPress={() => setNoShowModalVisible(false)}
                disabled={reportingNoShow}
              >
                <Text style={styles.cancelModalCloseBtnText}>Đóng</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelModalSubmitBtn}
                onPress={handleConfirmNoShow}
                disabled={reportingNoShow}
              >
                {reportingNoShow ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.cancelModalSubmitBtnText}>Xác nhận báo</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── MODAL CHI TIẾT KÝ QUỸ ESCROW ── */}
      <Modal
        visible={escrowModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEscrowModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.paymentModalBox}>
            <View style={styles.paymentModalHeader}>
              <View style={styles.paymentHeaderIcon}>
                <Ionicons name="shield-checkmark" size={24} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.paymentModalTitle}>Ký quỹ bảo đảm</Text>
                <Text style={styles.paymentModalSubtitle}>
                  Phiên tư vấn ngày {formatVietnameseDate(booking.slotDate)}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setEscrowModalVisible(false)}>
                <Ionicons name="close" size={24} color="#777777" />
              </TouchableOpacity>
            </View>

            {escrowLoading ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={{ marginTop: 10, fontSize: 12, color: '#777777' }}>
                  Đang tải thông tin ký quỹ...
                </Text>
              </View>
            ) : !escrowTx ? (
              <View style={{ padding: 30, alignItems: 'center' }}>
                <Text style={{ fontSize: 13, color: '#666666' }}>Không có thông tin ký quỹ bảo đảm.</Text>
              </View>
            ) : (
              <View style={{ paddingVertical: 10, gap: 10 }}>
                <View style={styles.escrowStatusRow}>
                  <Text style={styles.dossierLabel}>Trạng thái ký quỹ:</Text>
                  <View
                    style={[
                      styles.escrowStatusBadge,
                      { backgroundColor: formatEscrowStatus(escrowTx.escrowStatus).bg },
                    ]}
                  >
                    <Text
                      style={[
                        styles.escrowStatusText,
                        { color: formatEscrowStatus(escrowTx.escrowStatus).color },
                      ]}
                    >
                      {formatEscrowStatus(escrowTx.escrowStatus).label}
                    </Text>
                  </View>
                </View>

                <View style={styles.escrowGrid}>
                  <View style={styles.escrowGridItem}>
                    <Text style={styles.dossierLabel}>Khách hàng trả:</Text>
                    <Text style={styles.dossierValueBold}>{formatVnd(escrowTx.amount)}</Text>
                  </View>
                  <View style={styles.escrowGridItem}>
                    <Text style={styles.dossierLabel}>Chuyên gia nhận:</Text>
                    <Text style={[styles.dossierValueBold, { color: theme.colors.primary }]}>
                      {formatVnd(escrowTx.expertReceivable)}
                    </Text>
                  </View>
                  <View style={styles.escrowGridItem}>
                    <Text style={styles.dossierLabel}>Hoa hồng sàn:</Text>
                    <Text style={styles.dossierValue}>
                      {formatVnd(escrowTx.commissionAmount)} ({escrowTx.commissionRate * 100}%)
                    </Text>
                  </View>
                  <View style={styles.escrowGridItem}>
                    <Text style={styles.dossierLabel}>Cổng thanh toán:</Text>
                    <Text style={styles.dossierValue}>{escrowTx.paymentGateway || 'PAYOS'}</Text>
                  </View>
                </View>

                {escrowTx.refundAmount > 0 && (
                  <View style={styles.refundBox}>
                    <Text style={styles.refundText}>
                      Đã hoàn lại: {formatVnd(escrowTx.refundAmount)} (Lý do: {escrowTx.refundReason || 'Hủy lịch hoặc vắng mặt'})
                    </Text>
                  </View>
                )}
              </View>
            )}

            <View style={{ marginTop: 12 }}>
              <TouchableOpacity
                style={styles.cancelModalCloseBtn}
                onPress={() => setEscrowModalVisible(false)}
              >
                <Text style={[styles.cancelModalCloseBtnText, { textAlign: 'center' }]}>Đóng</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Thông báo Dialog chuẩn hệ thống */}
      {dialog ? (
        <Dialog
          visible={Boolean(dialog)}
          title={dialog.title}
          message={dialog.message}
          primaryLabel={dialog.primaryLabel || 'Đóng'}
          secondaryLabel={dialog.secondaryLabel}
          destructive={dialog.destructive}
          onPrimary={dialog.onPrimary || (() => setDialog(null))}
          onSecondary={dialog.onSecondary || (() => setDialog(null))}
          onRequestClose={() => setDialog(null)}
        />
      ) : null}
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

  // Client row (dành cho UI chuyên gia xem khách hàng)
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  clientAvatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
  },
  clientAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EEF2FF',
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientAvatarLetter: {
    fontFamily: fonts.serifBold,
    fontSize: 20,
    color: '#3730A3',
  },
  clientInfo: {
    flex: 1,
    gap: 2,
  },
  clientName: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  clientMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  clientMetaText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#666666',
  },

  // Info rows
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 5,
    gap: 10,
  },
  infoLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#666666',
    flexShrink: 0,
  },
  infoValue: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: theme.colors.textPrimary,
    flex: 1,
    textAlign: 'right',
    flexWrap: 'wrap',
  },
  infoValueBold: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: theme.colors.textPrimary,
    flex: 1,
    textAlign: 'right',
    flexWrap: 'wrap',
  },
  sessionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 5,
    flexShrink: 1,
  },
  sessionBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11.5,
    flexShrink: 1,
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

  // Expert Action Block
  expertActionBlock: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#D97706',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  expertActionTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: '#92400E',
    marginBottom: 10,
    textAlign: 'center',
  },
  expertBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  acceptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingVertical: 11,
    borderRadius: 8,
  },
  acceptBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: theme.colors.error,
    paddingVertical: 11,
    borderRadius: 8,
  },
  rejectBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: theme.colors.error,
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

  // Pay Now Button
  payNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: 10,
    ...theme.shadows.card,
  },
  payNowBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: '#FFFFFF',
  },

  // Live Consultation Card
  liveConsultationCard: {
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#F8F4EC',
    borderWidth: 1.5,
    borderColor: '#D4AF37',
    gap: 10,
  },
  liveConsultationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveConsultationTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 15,
    color: theme.colors.primary,
  },
  liveConsultationDesc: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#555555',
    lineHeight: 17,
  },
  joinMeetingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
  },
  joinMeetingBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  consultationSubBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dossierBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2D7C2',
    paddingVertical: 10,
    borderRadius: 8,
  },
  dossierBtnText: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: theme.colors.primary,
  },
  completeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingVertical: 10,
    borderRadius: 8,
  },
  completeBtnText: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: '#059669',
  },
  noShowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  noShowBtnText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: theme.colors.error,
  },
  completedNoticeCard: {
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    gap: 10,
  },
  escrowViewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#FAF5EE',
    borderWidth: 1,
    borderColor: '#E8DEC8',
  },
  escrowViewBtnText: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: theme.colors.primary,
  },

  // Payment Modal
  paymentModalBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    width: '92%',
    maxWidth: 420,
    ...theme.shadows.card,
  },
  paymentModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  paymentHeaderIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentModalTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  paymentModalSubtitle: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#666666',
  },
  paymentAmountCard: {
    backgroundColor: '#FAF5EE',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8DEC8',
    marginBottom: 12,
  },
  paymentAmountLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#777777',
  },
  paymentAmountValue: {
    fontFamily: fonts.serifBold,
    fontSize: 22,
    color: theme.colors.primary,
    marginTop: 2,
  },
  qrCodeSection: {
    alignItems: 'center',
    marginBottom: 12,
  },
  qrInstruction: {
    fontFamily: fonts.bodySemi,
    fontSize: 11,
    color: '#444444',
    textAlign: 'center',
    marginBottom: 8,
  },
  qrImageWrap: {
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DDDDDD',
  },
  qrImage: {
    width: 200,
    height: 200,
  },
  vnpayLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#005BAA',
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  vnpayLinkBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  escrowNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#ECFDF5',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  escrowNoticeText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#065F46',
    flex: 1,
    lineHeight: 16,
  },
  paymentFooter: {
    marginTop: 14,
  },
  paidCheckBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  paidCheckBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: '#FFFFFF',
  },

  // Dossier Modal
  dossierModalBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    width: '95%',
    maxWidth: 450,
    ...theme.shadows.card,
  },
  dossierModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  dossierModalTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 16,
    color: theme.colors.primary,
  },
  dossierModalSubtitle: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#666666',
  },
  dossierCard: {
    backgroundColor: '#FAF5EE',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E8DEC8',
    gap: 6,
  },
  dossierCardTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: theme.colors.primary,
    marginBottom: 4,
  },
  dossierRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dossierLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#666666',
  },
  dossierValue: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#222222',
  },
  dossierValueBold: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: '#222222',
  },
  dossierEmptyText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#888888',
    fontStyle: 'italic',
  },
  dossierItemBox: {
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5DDCB',
    marginBottom: 4,
  },
  dossierItemName: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: theme.colors.textPrimary,
  },
  dossierItemSub: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: '#555555',
    marginTop: 2,
  },

  // No-Show Party Selection
  noShowPartyRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  noShowPartyBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDDDDD',
    backgroundColor: '#F9F9F9',
    alignItems: 'center',
  },
  noShowPartyBtnActive: {
    borderColor: theme.colors.error,
    backgroundColor: '#FEF2F2',
  },
  noShowPartyText: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: '#666666',
  },
  noShowPartyTextActive: {
    color: theme.colors.error,
    fontFamily: fonts.bodyBold,
  },

  // Escrow Details Modal
  escrowStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FAF5EE',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E8DEC8',
  },
  escrowStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  escrowStatusText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
  },
  escrowGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  escrowGridItem: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5DDCB',
    borderRadius: 8,
    padding: 10,
  },
});
