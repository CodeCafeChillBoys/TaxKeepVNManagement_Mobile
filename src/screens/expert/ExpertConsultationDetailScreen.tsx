import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
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
import { getBookingById, updateBooking, addReviewToExpert } from './expertMockData';
import { ConsultationBooking } from '../../types/expert';

type DetailRouteProp = RouteProp<RootStackParamList, 'ExpertConsultationDetail'>;

function formatCurrency(amount: number): string {
  return `${amount.toLocaleString('vi-VN')} đ`;
}

const RATING_TAGS = [
  'Đúng giờ',
  'Chuyên môn sâu',
  'Giải thích dễ hiểu',
  'Tối ưu thuế hợp pháp',
  'Nhiệt tình',
];

export const ExpertConsultationDetailScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const route = useRoute<DetailRouteProp>();
  const bookingId = route.params?.bookingId || 'BK-2026-9812';

  const [booking, setBooking] = useState<ConsultationBooking | undefined>(() =>
    getBookingById(bookingId)
  );

  // Live video room simulated state
  const [isInMeeting, setIsInMeeting] = useState<boolean>(false);
  const [meetingTimer, setMeetingTimer] = useState<number>(45 * 60); // 45 mins
  const [isMicOn, setIsMicOn] = useState<boolean>(true);
  const [isCamOn, setIsCamOn] = useState<boolean>(true);

  // Modals
  const [isRatingModalOpen, setIsRatingModalOpen] = useState<boolean>(false);
  const [ratingScore, setRatingScore] = useState<number>(5);
  const [selectedTags, setSelectedTags] = useState<string[]>(['Đúng giờ', 'Chuyên môn sâu']);
  const [reviewComment, setReviewComment] = useState<string>('');

  const [isDisputeModalOpen, setIsDisputeModalOpen] = useState<boolean>(false);
  const [disputeReason, setDisputeReason] = useState<string>('EXPERT_NO_SHOW');
  const [disputeDetail, setDisputeDetail] = useState<string>('');

  useEffect(() => {
    let interval: any;
    if (isInMeeting) {
      interval = setInterval(() => {
        setMeetingTimer((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isInMeeting]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  if (!booking) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <HeaderMotif title="CHI TIẾT LỊCH HẸN" onBack={() => navigation.goBack()} />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Không tìm thấy dữ liệu ca tư vấn.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleStartMeeting = () => {
    setIsInMeeting(true);
    const updated = updateBooking(booking.bookingId, { status: 'IN_PROGRESS' });
    if (updated) setBooking({ ...updated });
  };

  const handleEndMeeting = () => {
    setIsInMeeting(false);
    const updated = updateBooking(booking.bookingId, {
      status: 'COMPLETED',
      completedAt: new Date().toISOString(),
    });
    if (updated) setBooking({ ...updated });
    Alert.alert(
      'Phiên tư vấn kết thúc',
      'Ca tư vấn đã hoàn tất. Khoản tiền sẽ được giữ trong Escrow 24h để bảo vệ quyền lợi của bạn.'
    );
  };

  const handleEarlyReleaseEscrow = () => {
    Alert.alert(
      'Xác nhận hài lòng',
      'Bạn đồng ý giải ngân sớm thù lao cho chuyên gia ngay bây giờ?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xác nhận giải ngân',
          onPress: () => {
            const updated = updateBooking(booking.bookingId, { escrowStatus: 'RELEASED' });
            if (updated) setBooking({ ...updated });
            Alert.alert('Thành công', 'Thù lao đã được giải ngân vào ví chuyên gia.');
          },
        },
      ]
    );
  };

  const handleSubmitRating = () => {
    if (!reviewComment.trim()) {
      Alert.alert('Thiếu nhận xét', 'Vui lòng nhập vài dòng đánh giá.');
      return;
    }

    addReviewToExpert(booking.expertId, {
      id: `rev-${Date.now()}`,
      bookingId: booking.bookingId,
      clientName: 'Bạn (Người nộp thuế)',
      rating: ratingScore,
      date: 'Hôm nay',
      comment: reviewComment.trim(),
      tags: selectedTags,
    });

    const updated = updateBooking(booking.bookingId, { hasReviewed: true });
    if (updated) setBooking({ ...updated });
    setIsRatingModalOpen(false);
    Alert.alert('Cảm ơn bạn', 'Đánh giá đã được gửi và cập nhật vào hồ sơ chuyên gia.');
  };

  const handleSubmitDispute = () => {
    if (!disputeDetail.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng mô tả lý do khiếu nại.');
      return;
    }

    const updated = updateBooking(booking.bookingId, {
      status: 'DISPUTED',
      escrowStatus: 'FROZEN',
    });
    if (updated) setBooking({ ...updated });
    setIsDisputeModalOpen(false);
    Alert.alert(
      'Khiếu nại đã tiếp nhận',
      'Khoản tiền Escrow đã được ĐÓNG BĂNG. Bộ phận CSKH TaxKeep sẽ xử lý và liên hệ trong 24 giờ làm việc.'
    );
  };

  const renderStatusBadge = () => {
    switch (booking.status) {
      case 'CONFIRMED':
        return <Badge variant="default" style={styles.badge}><Text style={styles.badgeText}>Đã xác nhận</Text></Badge>;
      case 'IN_PROGRESS':
        return <Badge variant="warning" style={styles.badge}><Text style={styles.badgeTextWarning}>Đang diễn ra</Text></Badge>;
      case 'COMPLETED':
        return <Badge variant="success" style={styles.badge}><Text style={styles.badgeTextSuccess}>Đã hoàn thành</Text></Badge>;
      case 'DISPUTED':
        return <Badge variant="destructive" style={styles.badge}><Text style={styles.badgeTextDestructive}>Đang tranh chấp</Text></Badge>;
      default:
        return <Badge variant="secondary" style={styles.badge}><Text style={styles.badgeTextSecondary}>Chờ thanh toán</Text></Badge>;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <DrumPatternBackdrop variant="soft" />
      <HeaderMotif title="CHI TIẾT LỊCH HẸN" onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER ID & STATUS ROW */}
        <Card style={styles.cleanCard}>
          <View style={styles.headerIdRow}>
            <View style={styles.bookingIdCol}>
              <Text style={styles.bookingIdSub}>Mã lịch hẹn</Text>
              <Text style={styles.bookingIdTitle}>{booking.bookingId}</Text>
            </View>
            {renderStatusBadge()}
          </View>
        </Card>

        {/* LIVE MEETING SECTION */}
        {booking.status === 'CONFIRMED' && !isInMeeting && (
          <Card style={styles.cleanCard}>
            <View style={styles.meetingCardHeader}>
              <Ionicons name="videocam" size={20} color={theme.colors.primary} />
              <Text style={styles.meetingCardTitle}>Phòng họp trực tuyến 1-1</Text>
            </View>

            <View style={styles.meetingNoticeBox}>
              <Text style={styles.meetingNoticeTime}>
                Lịch hẹn: {booking.timeSlot} • {booking.date}
              </Text>
              <Text style={styles.meetingNoticeSub}>
                Phòng mở trước 10 phút. Dữ liệu âm thanh và tài liệu được mã hóa đầu cuối.
              </Text>
            </View>

            <Button
              variant="default"
              onPress={handleStartMeeting}
              style={styles.joinBtn}
              icon={<Ionicons name="enter-outline" size={18} color="#FFFFFF" />}
            >
              Vào phòng tư vấn ngay
            </Button>
          </Card>
        )}

        {/* IN-MEETING SIMULATION VIEW */}
        {isInMeeting && (
          <Card style={styles.videoRoomCard}>
            <View style={styles.videoRoomHeader}>
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>TRỰC TIẾP</Text>
              </View>
              <Text style={styles.timerCountText}>{formatTimer(meetingTimer)}</Text>
            </View>

            <View style={styles.videoPlaceholder}>
              <Ionicons name="person-circle-outline" size={64} color="#64748B" />
              <Text style={styles.videoHostName}>{booking.expertName}</Text>
              <Text style={styles.videoRole}>Chuyên gia tư vấn thuế</Text>
              <View style={styles.encryptedTag}>
                <Ionicons name="lock-closed" size={10} color="#10B981" />
                <Text style={styles.encryptedText}>Kết nối WebRTC mã hóa</Text>
              </View>
            </View>

            {/* CALL CONTROLS */}
            <View style={styles.controlsRow}>
              <TouchableOpacity
                style={[styles.controlCircle, !isMicOn && styles.controlOff]}
                onPress={() => setIsMicOn(!isMicOn)}
                activeOpacity={0.7}
              >
                <Ionicons name={isMicOn ? 'mic' : 'mic-off'} size={18} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.controlCircle, !isCamOn && styles.controlOff]}
                onPress={() => setIsCamOn(!isCamOn)}
                activeOpacity={0.7}
              >
                <Ionicons name={isCamOn ? 'videocam' : 'videocam-off'} size={18} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.controlCircle}
                onPress={() => Alert.alert('Ghi chú chung', 'Khung ghi chú thuế đã sẵn sàng.')}
                activeOpacity={0.7}
              >
                <Ionicons name="document-text" size={18} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.hangupCircle}
                onPress={handleEndMeeting}
                activeOpacity={0.7}
              >
                <Ionicons name="call" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </Card>
        )}

        {/* POST-SESSION ESCROW COOL-DOWN ACTIONS */}
        {booking.status === 'COMPLETED' && (
          <Card style={styles.escrowStatusCard}>
            <View style={styles.escrowStatusHeader}>
              <Ionicons
                name={booking.escrowStatus === 'RELEASED' ? 'checkmark-circle' : 'shield-half'}
                size={18}
                color={booking.escrowStatus === 'RELEASED' ? '#16A34A' : '#D97706'}
              />
              <Text style={styles.escrowStatusTitle}>
                {booking.escrowStatus === 'RELEASED'
                  ? 'Đã quyết toán & giải ngân thù lao'
                  : 'Bảo vệ Escrow: Chờ khiếu nại (24h)'}
              </Text>
            </View>

            <Text style={styles.escrowStatusDesc}>
              {booking.escrowStatus === 'RELEASED'
                ? 'Giao dịch đã hoàn tất. Thù lao đã chuyển vào ví chuyên gia sau khi bạn xác nhận hài lòng.'
                : 'Khoản tiền vẫn tạm giữ tại TaxKeep. Tự động giải ngân sau 22h 15m nếu không có khiếu nại phát sinh.'}
            </Text>

            <View style={styles.escrowActionBtns}>
              {booking.escrowStatus !== 'RELEASED' && (
                <Button
                  variant="outline"
                  onPress={handleEarlyReleaseEscrow}
                  style={styles.actionBtnHalf}
                  icon={<Ionicons name="thumbs-up-outline" size={14} color="#0F172A" />}
                >
                  Xác nhận hài lòng
                </Button>
              )}

              {!booking.hasReviewed ? (
                <Button
                  variant="default"
                  onPress={() => setIsRatingModalOpen(true)}
                  style={styles.actionBtnHalf}
                  icon={<Ionicons name="star" size={14} color="#FFFFFF" />}
                >
                  Đánh giá
                </Button>
              ) : (
                <View style={styles.reviewedRow}>
                  <Ionicons name="checkmark" size={14} color="#16A34A" />
                  <Text style={styles.reviewedText}>Đã gửi đánh giá</Text>
                </View>
              )}
            </View>

            {booking.escrowStatus !== 'RELEASED' && (
              <TouchableOpacity
                onPress={() => setIsDisputeModalOpen(true)}
                style={styles.disputeLinkRow}
                activeOpacity={0.7}
              >
                <Ionicons name="alert-circle-outline" size={14} color="#DC2626" />
                <Text style={styles.disputeLinkText}>Gửi khiếu nại / Đóng băng tiền Escrow</Text>
              </TouchableOpacity>
            )}
          </Card>
        )}

        {/* DISPUTED STATE CARD */}
        {booking.status === 'DISPUTED' && (
          <Card style={styles.disputeAlertCard}>
            <View style={styles.disputeHeader}>
              <Ionicons name="warning" size={18} color="#DC2626" />
              <Text style={styles.disputeTitle}>Khoản tiền tạm giữ đang bị đóng băng</Text>
            </View>
            <Text style={styles.disputeDesc}>
              Hệ thống đã phong tỏa thù lao ca tư vấn này. Đội ngũ đối soát TaxKeep đang thẩm định log phòng họp và sẽ ra phán quyết bồi hoàn trong 24 giờ.
            </Text>
          </Card>
        )}

        {/* EXPERT PROFILE SUMMARY */}
        <Card style={styles.cleanCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="person-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>Chuyên gia phụ trách</Text>
          </View>

          <View style={styles.expertRow}>
            <View style={styles.avatarMini}>
              <Text style={styles.avatarMiniText}>
                {booking.expertName.trim().split(/\s+/).pop()?.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.expertMeta}>
              <Text style={styles.expertName}>{booking.expertName}</Text>
              <Text style={styles.expertTitle}>{booking.expertTitle}</Text>
            </View>
          </View>
        </Card>

        {/* CONSULTATION CONTENT & DOCUMENTS */}
        <Card style={styles.cleanCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="document-text-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>Nội dung tư vấn</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Chủ đề:</Text>
            <Text style={styles.detailValue}>{booking.topic}</Text>
          </View>

          <View style={styles.detailCol}>
            <Text style={styles.detailLabel}>Vấn đề trọng tâm:</Text>
            <Text style={styles.detailBody}>{booking.problemDescription}</Text>
          </View>

          <Separator style={styles.divider} />

          <View style={styles.sectionHeader}>
            <Ionicons name="attach-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>Chứng từ đã đính kèm ({booking.attachedFiles.length})</Text>
          </View>

          {booking.attachedFiles.length === 0 ? (
            <Text style={styles.emptyText}>Không đính kèm chứng từ trước phiên.</Text>
          ) : (
            booking.attachedFiles.map((file) => (
              <View key={file.id} style={styles.fileItemRow}>
                <Ionicons name="document-attach" size={16} color={theme.colors.primary} />
                <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
                <Badge variant="outline" style={styles.fileBadge}>
                  <Text style={styles.fileBadgeText}>Đã mã hóa</Text>
                </Badge>
              </View>
            ))
          )}
        </Card>

        {/* FINANCIAL SUMMARY */}
        <Card style={styles.cleanCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="cash-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>Hóa đơn &amp; Tạm giữ Escrow</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Tổng thanh toán:</Text>
            <Text style={styles.detailValueBold}>{formatCurrency(booking.totalAmount)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Trạng thái tiền:</Text>
            <Text style={styles.detailEscrowHeld}>
              {booking.escrowStatus === 'RELEASED'
                ? 'Đã giải ngân cho chuyên gia'
                : booking.escrowStatus === 'FROZEN'
                ? 'Đóng băng do khiếu nại'
                : 'Tạm giữ an toàn (Escrow)'}
            </Text>
          </View>
        </Card>
      </ScrollView>

      {/* RATING & FEEDBACK MODAL (Đặc tả 6) */}
      <Modal visible={isRatingModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Đánh giá buổi tư vấn</Text>
              <TouchableOpacity onPress={() => setIsRatingModalOpen(false)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.starPickerRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setRatingScore(star)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={star <= ratingScore ? 'star' : 'star-outline'}
                    size={28}
                    color="#D97706"
                  />
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>Chọn thẻ nhận xét nhanh:</Text>
            <View style={styles.tagsContainer}>
              {RATING_TAGS.map((t) => {
                const isSelected = selectedTags.includes(t);
                return (
                  <TouchableOpacity
                    key={t}
                    style={[styles.tagPill, isSelected && styles.tagPillSelected]}
                    onPress={() => {
                      if (isSelected) {
                        setSelectedTags(selectedTags.filter((x) => x !== t));
                      } else {
                        setSelectedTags([...selectedTags, t]);
                      }
                    }}
                  >
                    <Text style={[styles.tagText, isSelected && styles.tagTextSelected]}>{t}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.modalLabel}>Nhận xét cụ thể:</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Chia sẻ cảm nhận về mức độ hài lòng, giải pháp thuế nhận được..."
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={3}
              value={reviewComment}
              onChangeText={setReviewComment}
            />

            <Button
              variant="default"
              onPress={handleSubmitRating}
              style={styles.modalSubmitBtn}
            >
              Gửi đánh giá
            </Button>
          </View>
        </View>
      </Modal>

      {/* DISPUTE MODAL (Đặc tả 7) */}
      <Modal visible={isDisputeModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitleDestructive}>Khiếu nại ca tư vấn</Text>
              <TouchableOpacity onPress={() => setIsDisputeModalOpen(false)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.disputeWarningText}>
              Gửi khiếu nại sẽ lập tức ĐÓNG BĂNG số tiền tạm giữ trong Escrow để Admin xử lý.
            </Text>

            <Text style={styles.modalLabel}>Lý do khiếu nại:</Text>
            {[
              { id: 'EXPERT_NO_SHOW', text: 'Chuyên gia không vào phòng / Vắng mặt' },
              { id: 'WRONG_ADVICE', text: 'Tư vấn sai luật thuế / Trái quy định hiện hành' },
              { id: 'EARLY_QUIT', text: 'Chuyên gia kết thúc sớm, không đủ thời lượng' },
              { id: 'NETWORK_ISSUE', text: 'Sự cố kết nối hệ thống không thể trao đổi' },
            ].map((r) => (
              <TouchableOpacity
                key={r.id}
                style={[
                  styles.disputeReasonItem,
                  disputeReason === r.id && styles.disputeReasonSelected,
                ]}
                onPress={() => setDisputeReason(r.id)}
              >
                <Ionicons
                  name={disputeReason === r.id ? 'radio-button-on' : 'radio-button-off'}
                  size={16}
                  color={disputeReason === r.id ? '#DC2626' : '#94A3B8'}
                />
                <Text style={styles.disputeReasonText}>{r.text}</Text>
              </TouchableOpacity>
            ))}

            <Text style={styles.modalLabel}>Chi tiết phản ánh:</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Cung cấp chi tiết sự việc để Admin đối soát..."
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={3}
              value={disputeDetail}
              onChangeText={setDisputeDetail}
            />

            <Button
              variant="destructive"
              onPress={handleSubmitDispute}
              style={styles.modalSubmitBtn}
            >
              Xác nhận khiếu nại &amp; Đóng băng tiền
            </Button>
          </View>
        </View>
      </Modal>
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
    paddingBottom: 40,
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
  headerIdRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bookingIdCol: {
    gap: 2,
  },
  bookingIdSub: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontFamily: fonts.primary,
  },
  bookingIdTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    fontFamily: fonts.primary,
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  badgeTextWarning: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  badgeTextSuccess: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
  },
  badgeTextDestructive: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  badgeTextSecondary: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  meetingCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  meetingCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    fontFamily: fonts.primary,
    textTransform: 'uppercase',
  },
  meetingNoticeBox: {
    backgroundColor: '#F8F5EE',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 6,
    padding: 12,
    gap: 4,
    marginBottom: 12,
  },
  meetingNoticeTime: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.primary,
    fontFamily: fonts.primary,
  },
  meetingNoticeSub: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontFamily: fonts.primary,
  },
  joinBtn: {
    borderRadius: 6,
    backgroundColor: theme.colors.primary,
    height: 44,
  },
  videoRoomCard: {
    backgroundColor: '#0F172A',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 16,
    marginVertical: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  videoRoomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#EF4444',
  },
  timerCountText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  videoPlaceholder: {
    height: 140,
    backgroundColor: '#1E293B',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 16,
  },
  videoHostName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: fonts.primary,
  },
  videoRole: {
    fontSize: 11,
    color: '#94A3B8',
    fontFamily: fonts.primary,
  },
  encryptedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  encryptedText: {
    fontSize: 10,
    color: '#10B981',
    fontFamily: fonts.primary,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  controlCircle: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlOff: {
    backgroundColor: '#64748B',
  },
  hangupCircle: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  escrowStatusCard: {
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
  escrowStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  escrowStatusTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F766E',
    fontFamily: fonts.primary,
  },
  escrowStatusDesc: {
    fontSize: 12,
    color: '#134E4A',
    lineHeight: 18,
    fontFamily: fonts.primary,
  },
  escrowActionBtns: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  actionBtnHalf: {
    flex: 1,
    borderRadius: 6,
    height: 38,
  },
  reviewedRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 6,
    paddingVertical: 8,
  },
  reviewedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16A34A',
  },
  disputeLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#BBF7D0',
  },
  disputeLinkText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#DC2626',
    fontFamily: fonts.primary,
  },
  disputeAlertCard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 6,
    padding: 14,
    marginVertical: 0,
    shadowOpacity: 0,
    elevation: 0,
    gap: 6,
  },
  disputeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  disputeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
    fontFamily: fonts.primary,
  },
  disputeDesc: {
    fontSize: 12,
    color: '#991B1B',
    lineHeight: 18,
    fontFamily: fonts.primary,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  expertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  avatarMini: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMiniText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: fonts.primary,
  },
  expertMeta: {
    flex: 1,
    gap: 2,
  },
  expertName: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    fontFamily: fonts.primary,
  },
  expertTitle: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontFamily: fonts.primary,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  detailCol: {
    paddingVertical: 4,
    gap: 2,
  },
  detailLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontFamily: fonts.primary,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.textPrimary,
    fontFamily: fonts.primary,
  },
  detailValueBold: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.primary,
    fontFamily: fonts.primary,
  },
  detailEscrowHeld: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F766E',
    fontFamily: fonts.primary,
  },
  detailBody: {
    fontSize: 12,
    color: theme.colors.textPrimary,
    lineHeight: 18,
    fontFamily: fonts.primary,
  },
  divider: {
    marginVertical: 10,
    backgroundColor: theme.colors.border,
  },
  fileItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 6,
    padding: 8,
    backgroundColor: '#F8F5EE',
    marginTop: 4,
  },
  fileName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.textPrimary,
    fontFamily: fonts.primary,
  },
  fileBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  fileBadgeText: {
    fontSize: 10,
    color: '#0F766E',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    gap: 12,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    fontFamily: fonts.primary,
  },
  modalTitleDestructive: {
    fontSize: 15,
    fontWeight: '700',
    color: '#DC2626',
    fontFamily: fonts.primary,
  },
  starPickerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    fontFamily: fonts.primary,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagPill: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF',
  },
  tagPillSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: '#8B1E1E0D',
  },
  tagText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontFamily: fonts.primary,
  },
  tagTextSelected: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 6,
    padding: 10,
    fontSize: 12,
    fontFamily: fonts.primary,
    color: theme.colors.textPrimary,
    backgroundColor: '#FBFBFA',
    textAlignVertical: 'top',
    minHeight: 60,
  },
  modalSubmitBtn: {
    borderRadius: 6,
    height: 42,
    marginTop: 4,
  },
  disputeWarningText: {
    fontSize: 11,
    color: '#991B1B',
    lineHeight: 16,
    fontFamily: fonts.primary,
  },
  disputeReasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  disputeReasonSelected: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  disputeReasonText: {
    fontSize: 12,
    color: theme.colors.textPrimary,
    fontFamily: fonts.primary,
  },
});
