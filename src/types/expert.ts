export type CertificateType = 'CPA' | 'TAX_AGENT' | 'LAWYER' | 'CHIEF_ACCOUNTANT';

export interface VerifiedCertificate {
  id: string;
  type: CertificateType;
  name: string;
  issuer: string;
  issueYear: number;
  isVerified: boolean;
}

export type ExpertSpecialty =
  | 'TNCN_MULTI_INCOME' // Quyết toán TNCN nhiều nguồn
  | 'DEPENDENT_DEDUCTION' // Giảm trừ gia cảnh & người phụ thuộc
  | 'FOREIGN_INCOME' // Thuế chuyên gia nước ngoài & thu nhập toàn cầu
  | 'STOCK_CRYPTO' // Đầu tư chứng khoán, tiền số & tài sản số
  | 'BUSINESS_HOUSEHOLD' // Hộ kinh doanh cá thể & khoán thuế
  | 'TAX_AUDIT_RISK'; // Rà soát rủi ro & giải trình thuế

export interface ExpertProfile {
  id: string;
  fullName: string;
  title: string; // ví dụ: "Chuyên gia Thuế cao cấp", "Luật sư Thuế"
  avatar?: string;
  rating: number; // 4.9
  reviewCount: number; // 128
  experienceYears: number; // 12
  feePerSession: number; // 350.000 đ
  sessionDurationMinutes: number; // 45 phút
  verifiedCertificates: VerifiedCertificate[];
  specialties: ExpertSpecialty[];
  specialtyLabels: string[];
  bio: string;
  completedSessions: number;
  responseRatePercent: number; // 99%
  isAvailableToday: boolean;
  status: 'ACTIVE' | 'BUSY' | 'OFFLINE';
}

export interface ConsultationSlot {
  id: string;
  expertId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  isAvailable: boolean;
}

export type BookingStatus =
  | 'PENDING_PAYMENT' // Chờ thanh toán (hold 10p)
  | 'CONFIRMED' // Đã xác nhận & đang chờ đến giờ
  | 'IN_PROGRESS' // Đang diễn ra phiên 1-1
  | 'COMPLETED' // Đã hoàn thành (chờ khiếu nại 24h)
  | 'CANCELLED' // Đã hủy
  | 'DISPUTED'; // Đang tranh chấp

export type EscrowStatus =
  | 'HELD' // Tiền đang tạm giữ an toàn trong quỹ Escrow
  | 'RELEASED' // Đã giải ngân cho chuyên gia
  | 'REFUNDED' // Đã hoàn trả cho khách hàng
  | 'FROZEN'; // Đóng băng do có khiếu nại

export interface AttachedDocument {
  id: string;
  name: string;
  size: number;
  uri: string;
  type: string;
}

export interface ConsultationBooking {
  bookingId: string;
  expertId: string;
  expertName: string;
  expertTitle: string;
  date: string; // YYYY-MM-DD
  timeSlot: string; // 14:00 - 14:45
  topic: string;
  problemDescription: string;
  attachedFiles: AttachedDocument[];
  expertFee: number;
  platformFee: number;
  discountAmount: number;
  totalAmount: number;
  status: BookingStatus;
  escrowStatus: EscrowStatus;
  meetingUrl?: string;
  createdAt: string;
  completedAt?: string;
  hasReviewed?: boolean;
}

export interface ExpertReview {
  id: string;
  bookingId: string;
  clientName: string;
  rating: number; // 1-5
  date: string;
  comment: string;
  tags?: string[];
  expertReply?: {
    date: string;
    comment: string;
  };
}
