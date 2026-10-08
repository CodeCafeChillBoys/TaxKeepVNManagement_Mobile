/**
 * Types & Domain Models cho Luồng Tư Vấn Chuyên Gia Thuế & Đặt Lịch
 * Khớp chuẩn BE TaxKeepVN (Đặc tả 2 & Đặc tả 3)
 */

export type SessionType = 'ONLINE_MEETING' | 'CHAT' | 'VOICE_CALL';

export type BookingStatus =
  | 'PENDING_PAYMENT'
  | 'EXPIRED_UNPAID'
  | 'AWAITING_EXPERT_APPROVAL'
  | 'CONFIRMED'
  | 'REJECTED_BY_EXPERT'
  | 'EXPIRED_NO_RESPONSE'
  | 'CANCELLED_BY_USER'
  | 'CANCELLED_BY_EXPERT'
  | 'COMPLETED';

export type ExpertSortBy =
  | 'Recommended'
  | 'RatingDesc'
  | 'FeeAsc'
  | 'FeeDesc'
  | 'ExperienceDesc'
  | 'CompletedSessionsDesc';

export type ExpertTimeFilter =
  | 'All'
  | 'Today'
  | 'Tomorrow'
  | 'ThisWeekend'
  | 'Next7Days';

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface PagedResult<T> {
  items: T[];
  pagination: PaginationMeta;
}

export interface SpecializationDto {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
}

export interface ExpertListItemResponse {
  id: string;
  userId: string;
  fullName: string;
  avatarUrl?: string | null;
  jobTitle: string;
  companyName?: string | null;
  bio?: string | null;
  yearsOfExperience: number;
  rating: number;
  totalReviews: number;
  completedConsultationsCount: number;
  startingFee: number;
  specializationNames: string[];
  verifiedCertificateCount: number;
  hasAvailableSlotSoon: boolean;
  earliestAvailableDate?: string | null;
  rankingScore: number;
}

export interface ExpertPublicCertificateDto {
  id: string;
  certificateName: string;
  issuingAuthority: string;
  yearIssued: number;
  maskedCertificateNumber: string;
  isVerified: boolean;
}

export interface ExpertPublicFeeDto {
  id: string;
  sessionType: SessionType;
  durationMinutes: number;
  fee: number;
}

export interface ExpertPublicReviewDto {
  id: string;
  rating: number;
  comment: string;
  reviewerDisplayName: string;
  createdAt: string;
}

export interface ExpertAvailableSlotDto {
  id: string;
  slotDate: string;
  startTime: string;
  endTime: string;
  sessionType: SessionType;
  isBooked: boolean;
  isActive: boolean;
}

export interface ExpertDetailResponse {
  id: string;
  userId: string;
  fullName: string;
  avatarUrl?: string | null;
  jobTitle: string;
  companyName?: string | null;
  bio?: string | null;
  yearsOfExperience: number;
  rating: number;
  totalReviews: number;
  completedConsultationsCount: number;
  isActive: boolean;
  specializationNames: string[];
  verifiedCertificates: ExpertPublicCertificateDto[];
  feePackages: ExpertPublicFeeDto[];
  recentReviews: ExpertPublicReviewDto[];
  upcomingAvailableSlots: ExpertAvailableSlotDto[];
}

export interface ExpertSearchQueryParameters {
  keyword?: string;
  specializationIds?: number[];
  minFee?: number;
  maxFee?: number;
  minRating?: number;
  timeFilter?: ExpertTimeFilter;
  sortBy?: ExpertSortBy;
  page?: number;
  size?: number;
}

export interface ExpertSearchResultDto {
  items: ExpertListItemResponse[];
  pagination: PaginationMeta;
  suggestion?: any;
}

export interface BookingPreviewRequest {
  expertSlotId: string;
  specializationId: number;
}

export interface BookingPreviewResponse {
  expertSlotId: string;
  expertProfileId: string;
  expertFullName: string;
  expertAvatarUrl?: string | null;
  expertJobTitle: string;
  slotDate: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  sessionType: SessionType;
  specializationId: number;
  specializationName: string;
  totalFee: number;
  minimumLeadTimeHours: number;
  isValid: boolean;
  validationMessage?: string | null;
}

export interface BookingAttachmentDto {
  id: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  createdAt: string;
}

export interface BookingDetailResponse {
  id: string;
  bookingCode: string;
  userId: string;
  userFullName: string;
  userEmail: string;
  userPhoneNumber?: string | null;
  expertProfileId: string;
  expertFullName: string;
  expertAvatarUrl?: string | null;
  expertJobTitle: string;
  expertSlotId: string;
  slotDate: string;
  startTime: string;
  endTime: string;
  sessionType: SessionType;
  durationMinutes: number;
  fee: number;
  specializationId: number;
  specializationName: string;
  topicTitle: string;
  problemDescription: string;
  status: BookingStatus;
  holdExpiresAt: string;
  holdCountdownSeconds: number;
  approvalDeadline?: string | null;
  approvalCountdownSeconds?: number | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  paidAt?: string | null;
  paymentReference?: string | null;
  refundStatus: string;
  refundedAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  cancelledBy?: string | null;
  createdAt: string;
  attachments: BookingAttachmentDto[];
}

export interface BookingListItemResponse {
  id: string;
  bookingCode: string;
  userId: string;
  userFullName: string;
  expertProfileId: string;
  expertFullName: string;
  expertAvatarUrl?: string | null;
  slotDate: string;
  startTime: string;
  endTime: string;
  sessionType: SessionType;
  durationMinutes: number;
  fee: number;
  specializationName: string;
  topicTitle: string;
  status: BookingStatus;
  holdExpiresAt: string;
  approvalDeadline?: string | null;
  attachmentCount: number;
  createdAt: string;
}

// ── Utility Functions ──────────────────────────────────────────

export function formatVnd(amount?: number | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '0 đ';
  return `${Math.round(amount).toLocaleString('vi-VN')} đ`;
}

export function formatSessionType(type?: SessionType | string): {
  label: string;
  icon: string;
  color: string;
} {
  switch (type) {
    case 'ONLINE_MEETING':
      return { label: 'Họp trực tuyến', icon: 'videocam', color: '#1565C0' };
    case 'VOICE_CALL':
      return { label: 'Gọi thoại', icon: 'call', color: '#2E7D32' };
    case 'CHAT':
      return { label: 'Nhắn tin', icon: 'chatbubbles', color: '#E65100' };
    default:
      return { label: 'Tư vấn', icon: 'chatbox-ellipses', color: '#666666' };
  }
}

export function formatBookingStatus(status?: BookingStatus | string): {
  label: string;
  color: string;
  bg: string;
  icon: string;
  desc: string;
} {
  switch (status) {
    case 'PENDING_PAYMENT':
      return {
        label: 'Chờ thanh toán',
        color: '#D97706',
        bg: '#FEF3C7',
        icon: 'time-outline',
        desc: 'Khung giờ đang được giữ chỗ trong 10 phút. Vui lòng hoàn tất thanh toán để xác nhận.',
      };
    case 'EXPIRED_UNPAID':
      return {
        label: 'Hết hạn giữ chỗ',
        color: '#6B7280',
        bg: '#F3F4F6',
        icon: 'alert-circle-outline',
        desc: 'Đã quá 10 phút chưa thanh toán. Khung giờ đã được giải phóng.',
      };
    case 'AWAITING_EXPERT_APPROVAL':
      return {
        label: 'Chờ chuyên gia duyệt',
        color: '#2563EB',
        bg: '#DBEAFE',
        icon: 'hourglass-outline',
        desc: 'Đã thanh toán. Chuyên gia có tối đa 2 giờ để tiếp nhận ca tư vấn của bạn.',
      };
    case 'CONFIRMED':
      return {
        label: 'Đã xác nhận',
        color: '#059669',
        bg: '#D1FAE5',
        icon: 'checkmark-circle-outline',
        desc: 'Chuyên gia đã đồng ý tiếp nhận. Lịch hẹn chính thức được xác nhận.',
      };
    case 'REJECTED_BY_EXPERT':
      return {
        label: 'Chuyên gia từ chối',
        color: '#DC2626',
        bg: '#FEE2E2',
        icon: 'close-circle-outline',
        desc: 'Chuyên gia bận đột xuất và từ chối. Hệ thống tự động hoàn tiền 100% cho bạn.',
      };
    case 'EXPIRED_NO_RESPONSE':
      return {
        label: 'Quá hạn phản hồi',
        color: '#DC2626',
        bg: '#FEE2E2',
        icon: 'time-outline',
        desc: 'Chuyên gia không phản hồi trong 2 giờ. Hệ thống tự động hủy và hoàn tiền 100%.',
      };
    case 'CANCELLED_BY_USER':
      return {
        label: 'Bạn đã hủy',
        color: '#6B7280',
        bg: '#F3F4F6',
        icon: 'remove-circle-outline',
        desc: 'Bạn đã chủ động hủy lịch hẹn này.',
      };
    case 'CANCELLED_BY_EXPERT':
      return {
        label: 'Chuyên gia hủy',
        color: '#DC2626',
        bg: '#FEE2E2',
        icon: 'close-circle-outline',
        desc: 'Chuyên gia hủy do sự cố đột xuất. Hệ thống kích hoạt hoàn tiền cho bạn.',
      };
    case 'COMPLETED':
      return {
        label: 'Đã hoàn thành',
        color: '#8B1E1E',
        bg: '#FDE8E8',
        icon: 'shield-checkmark-outline',
        desc: 'Phiên tư vấn đã kết thúc thành công.',
      };
    default:
      return {
        label: String(status || 'Không rõ'),
        color: '#4B5563',
        bg: '#F3F4F6',
        icon: 'help-circle-outline',
        desc: '',
      };
  }
}

export function formatTimeRange(start?: string, end?: string): string {
  if (!start || !end) return '';
  const s = start.substring(0, 5);
  const e = end.substring(0, 5);
  return `${s} - ${e}`;
}

export function formatVietnameseDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const d = new Date(dateStr);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
}
