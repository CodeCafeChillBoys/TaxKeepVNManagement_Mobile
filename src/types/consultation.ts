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
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'SETTLED'
  | 'UNDER_DISPUTE';

export type EscrowStatus =
  | 'PendingPayment'
  | 'HeldInEscrow'
  | 'CoolingDown'
  | 'Settled'
  | 'Refunded'
  | 'PartiallyRefunded'
  | 'Cancelled';

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
  certificateType?: string;
  certificateName: string;
  issuingAuthority: string;
  issueDate?: string;
  yearIssued?: number;
  hasExpiry?: boolean;
  expiryDate?: string | null;
  maskedCertificateNumber: string;
  isVerified?: boolean;
  fileUrl?: string | null;
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
  fullLabel: string;
  icon: string;
  color: string;
} {
  switch (type) {
    case 'ONLINE_MEETING':
      return {
        label: 'Họp trực tuyến',
        fullLabel: 'Họp trực tuyến (Gọi video)',
        icon: 'videocam',
        color: '#1565C0',
      };
    case 'VOICE_CALL':
      return {
        label: 'Gọi thoại',
        fullLabel: 'Gọi thoại trực tiếp',
        icon: 'call',
        color: '#2E7D32',
      };
    case 'CHAT':
      return {
        label: 'Nhắn tin',
        fullLabel: 'Nhắn tin tư vấn',
        icon: 'chatbubbles',
        color: '#E65100',
      };
    default:
      return {
        label: 'Tư vấn',
        fullLabel: 'Tư vấn trực tuyến',
        icon: 'chatbox-ellipses',
        color: '#666666',
      };
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
    case 'IN_PROGRESS':
      return {
        label: 'Đang tư vấn',
        color: '#0D9488',
        bg: '#CCFBF1',
        icon: 'radio-outline',
        desc: 'Phiên tư vấn trực tuyến 1-1 đang diễn ra trong phòng họp trực tuyến.',
      };
    case 'COMPLETED':
      return {
        label: 'Đã hoàn thành',
        color: '#8B1E1E',
        bg: '#FDE8E8',
        icon: 'shield-checkmark-outline',
        desc: 'Phiên tư vấn đã kết thúc thành công. Tiền đang trong thời gian bảo chứng (24 giờ) trước khi quyết toán.',
      };
    case 'SETTLED':
      return {
        label: 'Đã quyết toán',
        color: '#059669',
        bg: '#D1FAE5',
        icon: 'cash-outline',
        desc: 'Khoản thù lao đã được quyết toán và giải ngân cho chuyên gia.',
      };
    case 'UNDER_DISPUTE':
      return {
        label: 'Đang khiếu nại',
        color: '#DC2626',
        bg: '#FEF2F2',
        icon: 'alert-circle-outline',
        desc: 'Phiên tư vấn đang có khiếu nại chất lượng. Tiền ký quỹ Escrow đã được đóng băng an toàn.',
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

// ── EXPERT APPLICATION & PORTAL TYPES ──────────────────────────

export type ExpertApplicationStatus =
  | 'Draft'
  | 'PendingReview'
  | 'NeedSupplement'
  | 'Rejected'
  | 'Approved';

export type CertificateVerificationStatus =
  | 'PendingVerification'
  | 'Verified'
  | 'Rejected'
  | 'Expired';

export interface RejectBookingRequest {
  reason: string;
}

export interface SpecializationDtoItem {
  id: number;
  code: string;
  name: string;
}

export interface CertificateResponseDto {
  id: string;
  certificateType: string;
  certificateName: string;
  certificateNumber: string;
  issuingAuthority: string;
  issueDate: string;
  hasExpiry: boolean;
  expiryDate?: string | null;
  fileUrl: string;
  verificationStatus: CertificateVerificationStatus;
  rejectionReason?: string | null;
  verifiedAt?: string | null;
  createdAt: string;
}

export interface FeeProposalRequestDto {
  sessionType: SessionType;
  durationMinutes: number;
  proposedFee: number;
}

export interface FeeProposalResponseDto {
  id: string;
  sessionType: SessionType;
  durationMinutes: number;
  proposedFee: number;
}

export interface ExpertApplicationAuditResponseDto {
  id: string;
  action: string;
  actorUserId?: string | null;
  note?: string | null;
  createdAt: string;
}

export interface ExpertApplicationDetailResponse {
  id: string;
  userId: string;
  applicationNumber: string;
  fullName: string;
  avatarUrl?: string | null;
  jobTitle: string;
  companyName?: string | null;
  bio?: string | null;
  yearsOfExperience: number;
  currentPosition?: string | null;
  experienceDescription: string;
  status: ExpertApplicationStatus;
  submittedAt?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  supplementRequestReason?: string | null;
  createdAt: string;
  updatedAt: string;
  specializations: SpecializationDtoItem[];
  certificates: CertificateResponseDto[];
  feeProposals: FeeProposalResponseDto[];
  audits: ExpertApplicationAuditResponseDto[];
}

export interface SaveExpertApplicationDraftRequest {
  fullName: string;
  avatarUrl?: string | null;
  jobTitle: string;
  companyName?: string | null;
  bio?: string | null;
  yearsOfExperience: number;
  currentPosition?: string | null;
  experienceDescription: string;
  specializationIds: number[];
  feeProposals: FeeProposalRequestDto[];
}

export interface ConsultationFeeConfigDto {
  id: number;
  sessionType: SessionType;
  durationMinutes: number;
  minFee: number;
  maxFee: number;
  isActive: boolean;
}

export function formatExpertApplicationStatus(status?: ExpertApplicationStatus | string): {
  label: string;
  color: string;
  bg: string;
  icon: string;
  desc: string;
} {
  switch (status) {
    case 'Draft':
      return {
        label: 'Bản nháp',
        color: '#6B7280',
        bg: '#F3F4F6',
        icon: 'create-outline',
        desc: 'Hồ sơ đang soạn thảo, chưa nộp thẩm định.',
      };
    case 'PendingReview':
      return {
        label: 'Chờ thẩm định',
        color: '#D97706',
        bg: '#FEF3C7',
        icon: 'hourglass-outline',
        desc: 'Hồ sơ đã gửi và đang trong quá trình xét duyệt của Quản trị viên.',
      };
    case 'NeedSupplement':
      return {
        label: 'Cần bổ sung',
        color: '#EA580C',
        bg: '#FFEDD5',
        icon: 'alert-circle-outline',
        desc: 'Quản trị viên yêu cầu bổ sung thông tin hoặc giấy tờ chứng chỉ.',
      };
    case 'Rejected':
      return {
        label: 'Từ chối',
        color: '#DC2626',
        bg: '#FEE2E2',
        icon: 'close-circle-outline',
        desc: 'Hồ sơ không đáp ứng điều kiện hành nghề tư vấn thuế.',
      };
    case 'Approved':
      return {
        label: 'Đã phê duyệt',
        color: '#059669',
        bg: '#D1FAE5',
        icon: 'checkmark-circle-outline',
        desc: 'Chúc mừng! Hồ sơ đã được duyệt, bạn chính thức là Chuyên gia tư vấn thuế.',
      };
    default:
      return {
        label: String(status || 'Chưa đăng ký'),
        color: '#6B7280',
        bg: '#F3F4F6',
        icon: 'help-circle-outline',
        desc: '',
      };
  }
}

export function formatCertStatus(status?: CertificateVerificationStatus | string): {
  label: string;
  color: string;
  bg: string;
} {
  switch (status) {
    case 'Verified':
      return { label: 'Hợp lệ', color: '#059669', bg: '#D1FAE5' };
    case 'Rejected':
      return { label: 'Không hợp lệ', color: '#DC2626', bg: '#FEE2E2' };
    case 'Expired':
      return { label: 'Hết hạn', color: '#6B7280', bg: '#F3F4F6' };
    case 'PendingVerification':
    default:
      return { label: 'Chờ thẩm định', color: '#D97706', bg: '#FEF3C7' };
  }
}

export function formatEscrowStatus(status?: EscrowStatus | string): {
  label: string;
  color: string;
  bg: string;
} {
  switch (status) {
    case 'PendingPayment':
      return { label: 'Chờ thanh toán', color: '#D97706', bg: '#FEF3C7' };
    case 'HeldInEscrow':
      return { label: 'Đang tạm giữ bảo đảm', color: '#059669', bg: '#D1FAE5' };
    case 'CoolingDown':
      return { label: 'Chờ kết toán (24h)', color: '#2563EB', bg: '#DBEAFE' };
    case 'Settled':
      return { label: 'Đã giải ngân', color: '#047857', bg: '#D1FAE5' };
    case 'Refunded':
      return { label: 'Đã hoàn tiền 100%', color: '#6B7280', bg: '#F3F4F6' };
    case 'PartiallyRefunded':
      return { label: 'Hoàn tiền một phần', color: '#EA580C', bg: '#FFEDD5' };
    case 'Cancelled':
      return { label: 'Đã hủy', color: '#DC2626', bg: '#FEE2E2' };
    default:
      return { label: String(status || 'Chưa xác định'), color: '#4B5563', bg: '#F3F4F6' };
  }
}

// ── Payment & Escrow DTOs (Đặc tả 4) ───────────────────────────

export interface PaymentLinkResponse {
  bookingId: string;
  bookingCode: string;
  escrowTransactionId: string;
  orderCode: number;
  amount: number;
  commissionRate: number;
  commissionAmount: number;
  expertReceivable: number;
  escrowStatus: EscrowStatus;
  paymentGateway: string;
  paymentLinkId?: string | null;
  checkoutUrl?: string | null;
  qrCode?: string | null;
  holdExpiresAt: string;
  holdCountdownSeconds: number;
}

export interface EscrowTransactionResponse {
  id: string;
  bookingId: string;
  bookingCode: string;
  bookingStatus: BookingStatus;
  orderCode: number;
  amount: number;
  commissionRate: number;
  commissionAmount: number;
  expertReceivable: number;
  escrowStatus: EscrowStatus;
  paymentGateway: string;
  paymentReference?: string | null;
  paymentLinkId?: string | null;
  checkoutUrl?: string | null;
  qrCode?: string | null;
  refundAmount: number;
  refundReason?: string | null;
  paidAt?: string | null;
  settledAt?: string | null;
  refundedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Live Consultation Session DTOs (Đặc tả 5) ─────────────────

export interface ConsultationSessionResponse {
  id: string;
  bookingId: string;
  bookingCode: string;
  topicTitle: string;
  problemDescription?: string | null;
  sessionType: SessionType;
  scheduledDurationMinutes: number;
  slotDate: string;
  startTime: string;
  endTime: string;
  roomName: string;
  roomUrl: string;
  userCheckInAt?: string | null;
  expertCheckInAt?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  actualDurationMinutes?: number | null;
  remainingMinutes: number;
  status: BookingStatus;
  sharedNotes?: string | null;
  noShowType: string;
  isRoomOpen: boolean;
  isUserPresent: boolean;
  isExpertPresent: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface JoinConsultationResponse {
  sessionId: string;
  bookingId: string;
  bookingCode: string;
  roomName: string;
  roomUrl: string;
  checkedInAt: string;
  participantRole: string;
  bothPresent: boolean;
  bookingStatus: BookingStatus;
  message: string;
}

export interface SharedIncomeSourceDto {
  id: string;
  companyName: string;
  companyTaxCode: string;
  taxYear: number;
  totalIncome: number;
  taxWithheld: number;
  insuranceDeducted: number;
}

export interface SharedMonthlyIncomeDto {
  id: string;
  month: number;
  year: number;
  organizationName: string;
  taxIdNumber?: string | null;
  totalTaxableIncome: number;
  insuranceDeducted: number;
  taxAlreadyDeducted: number;
  payslipFileUrl?: string | null;
}

export interface SharedDependentDto {
  id: string;
  fullName: string;
  relationship: string;
  currentGroup: string;
  citizenId?: string | null;
  birthCertNumber?: string | null;
  status: string;
  isProfileComplete: boolean;
}

export interface SharedDocumentDto {
  id: string;
  docTypeCode?: string | null;
  invoiceSeries?: string | null;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  sellerName?: string | null;
  sellerTaxCode?: string | null;
  fileUrl: string;
}

export interface SharedDraftSettlementDto {
  dossierId: string;
  taxYear: number;
  totalGrossIncome: number;
  totalTaxWithheld: number;
  totalInsuranceDeduction: number;
  personalDeductionAmount: number;
}

export interface SharedAttachmentDto {
  id: string;
  fileName: string;
  fileUrl: string;
  contentType: string;
  fileSize: number;
}

export interface SharedTaxDossierResponse {
  bookingId: string;
  bookingCode: string;
  taxYear: number;
  taxpayerFullName: string;
  taxpayerEmail: string;
  taxpayerPhone?: string | null;
  taxpayerCitizenId?: string | null;
  taxpayerTaxId?: string | null;
  incomeSources: SharedIncomeSourceDto[];
  monthlyIncomes: SharedMonthlyIncomeDto[];
  totalAnnualIncome: number;
  totalTaxWithheld: number;
  dependents: SharedDependentDto[];
  totalDependentsCount: number;
  deductibleDocuments: SharedDocumentDto[];
  totalMedicalEducationExpenses: number;
  draftSettlement?: SharedDraftSettlementDto | null;
  bookingAttachments: SharedAttachmentDto[];
}

// ══════════════════════════════════════════════════════════════════
// THÔNG BÁO NHẮC NHỞ LỊCH HẸN SẮP TỚI (DASHBOARD & BANNER)
// ══════════════════════════════════════════════════════════════════

export interface UpcomingMeetingReminderDto {
  hasUpcomingMeeting: boolean;
  bookingId?: string | null;
  bookingCode?: string | null;
  topicTitle?: string | null;
  partnerName?: string | null;
  partnerRole?: string | null;
  slotDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  minutesRemaining?: number | null;
  isRoomOpen: boolean;
  canJoinRoom: boolean;
  roomUrl?: string | null;
  urgencyLevel?: 'NORMAL' | 'SOON' | 'OPENED' | 'IN_PROGRESS' | null;
  reminderMessage?: string | null;
}

// ══════════════════════════════════════════════════════════════════
// QUẢN LÝ KHUNG GIỜ LÀM VIỆC CỦA CHUYÊN GIA (EXPERT SLOTS CRUD)
// ══════════════════════════════════════════════════════════════════

export interface CreateExpertSlotRequest {
  slotDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  sessionType: SessionType;
}

export interface UpdateExpertSlotRequest {
  slotDate: string;
  startTime: string;
  endTime: string;
  sessionType: SessionType;
  isActive: boolean;
}

export interface ExpertSlotFilterParameters {
  fromDate?: string;
  toDate?: string;
  sessionType?: SessionType;
  isBooked?: boolean;
  isActive?: boolean;
}

export interface ExpertSlotDetailResponse {
  id: string;
  expertProfileId: string;
  slotDate: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  sessionType: SessionType;
  isBooked: boolean;
  isActive: boolean;
  holdExpiresAt?: string | null;
  isHolding: boolean;
  createdAt: string;
  updatedAt: string;
}

// ══════════════════════════════════════════════════════════════════
// ĐÁNH GIÁ & FEEDBACK (Đặc tả 6)
// ══════════════════════════════════════════════════════════════════

export interface ReviewDetailScoresDto {
  expertise?: number | null;
  punctuality?: number | null;
  communication?: number | null;
  problemSolving?: number | null;
}

export interface CreateReviewRequest {
  rating: number; // 1-5
  comment: string; // >= 10 chars
  detailScores?: ReviewDetailScoresDto;
  isAnonymous?: boolean;
}

export interface ReviewDetailResponse {
  id: string;
  bookingId: string;
  expertProfileId: string;
  userId: string;
  reviewerName: string;
  rating: number;
  comment?: string | null;
  detailScores?: ReviewDetailScoresDto | null;
  isAnonymous: boolean;
  isPublished: boolean;
  isFlaggedForReview: boolean;
  expertReply?: string | null;
  expertRepliedAt?: string | null;
  createdAt: string;
}

export interface ReviewEligibilityResponse {
  canReview: boolean;
  alreadyReviewed: boolean;
  reviewDeadline?: string | null;
  remainingSeconds?: number | null;
  message?: string | null;
}

// ══════════════════════════════════════════════════════════════════
// KHIẾU NẠI & TRANH CHẤP ESCROW (Đặc tả 7)
// ══════════════════════════════════════════════════════════════════

export type DisputeReasonCode =
  | 'WRONG_TAX_LAW_ADVICE'
  | 'UNPROFESSIONAL_BEHAVIOR'
  | 'EARLY_DISCONNECT'
  | 'NETWORK_ISSUE'
  | 'OTHER';

export interface CreateDisputeRequest {
  reason: DisputeReasonCode | string;
  description: string;
  evidenceUrls?: string[];
}

export interface ExpertRespondDisputeRequest {
  response: string;
  evidenceUrls?: string[];
}

export interface DisputeDetailResponse {
  id: string;
  bookingId: string;
  bookingCode: string;
  totalFee: number;
  userId: string;
  taxpayerFullName: string;
  taxpayerPhone?: string | null;
  expertUserId: string;
  expertFullName: string;
  reason: string;
  description: string;
  evidenceUrls: string[];
  status: 'PENDING_EXPERT_RESPONSE' | 'PENDING_ADMIN_REVIEW' | 'RESOLVED' | string;
  expertResponse?: string | null;
  expertEvidenceUrls: string[];
  expertRespondedAt?: string | null;
  expertResponseDeadline?: string | null;
  expertRemainingSeconds?: number | null;
  adminDecisionType?: 'FULL_REFUND' | 'SETTLE_EXPERT' | 'PARTIAL' | string | null;
  adminResolution?: string | null;
  refundRatePercent?: number | null;
  userRefundAmount: number;
  expertSettlementAmount: number;
  platformFeeAmount: number;
  adminNotes?: string | null;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DisputeEligibilityResponse {
  canDispute: boolean;
  alreadyDisputed: boolean;
  disputeDeadline?: string | null;
  remainingSeconds?: number | null;
  message?: string | null;
}

export const formatDisputeReason = (reason: string): string => {
  switch (reason) {
    case 'WRONG_TAX_LAW_ADVICE':
      return 'Tư vấn sai luật thuế / gây rủi ro pháp lý';
    case 'UNPROFESSIONAL_BEHAVIOR':
      return 'Thái độ thiếu chuyên nghiệp / xúc phạm';
    case 'EARLY_DISCONNECT':
      return 'Chuyên gia rời phòng sớm / không đủ thời lượng';
    case 'NETWORK_ISSUE':
      return 'Sự cố kết nối từ phía chuyên gia';
    case 'OTHER':
    default:
      return 'Lý do khác';
  }
};

export const formatDisputeStatus = (
  status?: string | null
): { label: string; color: string; bg: string } => {
  switch (status) {
    case 'PENDING_EXPERT_RESPONSE':
      return { label: 'Chờ chuyên gia giải trình', color: '#D97706', bg: '#FEF3C7' };
    case 'PENDING_ADMIN_REVIEW':
      return { label: 'Ban quản trị đang xử lý', color: '#2563EB', bg: '#EFF6FF' };
    case 'RESOLVED':
      return { label: 'Đã giải quyết', color: '#059669', bg: '#ECFDF5' };
    default:
      return { label: status || 'Đang xử lý', color: '#6B7280', bg: '#F3F4F6' };
  }
};


