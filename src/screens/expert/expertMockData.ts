import { ExpertProfile, ConsultationSlot, ConsultationBooking, ExpertReview } from '../../types/expert';

export const MOCK_EXPERTS: ExpertProfile[] = [
  {
    id: 'exp-1',
    fullName: 'Nguyễn Văn Bình',
    title: 'Kiểm toán viên & Chuyên gia Thuế cấp cao',
    rating: 4.95,
    reviewCount: 142,
    experienceYears: 14,
    feePerSession: 450000,
    sessionDurationMinutes: 45,
    verifiedCertificates: [
      {
        id: 'cert-1',
        type: 'CPA',
        name: 'Chứng chỉ Kiểm toán viên Quốc gia (CPA VN)',
        issuer: 'Bộ Tài chính',
        issueYear: 2012,
        isVerified: true,
      },
      {
        id: 'cert-2',
        type: 'TAX_AGENT',
        name: 'Chứng chỉ Hành nghề Dịch vụ Làm thủ tục về Thuế',
        issuer: 'Tổng cục Thuế',
        issueYear: 2014,
        isVerified: true,
      },
    ],
    specialties: ['TNCN_MULTI_INCOME', 'TAX_AUDIT_RISK', 'FOREIGN_INCOME'],
    specialtyLabels: ['TNCN nhiều nguồn', 'Rà soát rủi ro', 'Thu nhập toàn cầu'],
    bio: 'Nguyên Giám đốc tư vấn thuế tại Big4, hơn 14 năm kinh nghiệm đồng hành cùng cá nhân và doanh nghiệp trong tối ưu thuế TNCN hợp pháp và giải trình quyết toán.',
    completedSessions: 268,
    responseRatePercent: 99,
    isAvailableToday: true,
    status: 'ACTIVE',
  },
  {
    id: 'exp-2',
    fullName: 'Trần Thị Mai',
    title: 'Luật sư Thuế & Trọng tài viên',
    rating: 4.9,
    reviewCount: 96,
    experienceYears: 10,
    feePerSession: 390000,
    sessionDurationMinutes: 45,
    verifiedCertificates: [
      {
        id: 'cert-3',
        type: 'LAWYER',
        name: 'Thẻ Luật sư - Đoàn Luật sư TP. Hà Nội',
        issuer: 'Liên đoàn Luật sư Việt Nam',
        issueYear: 2016,
        isVerified: true,
      },
    ],
    specialties: ['DEPENDENT_DEDUCTION', 'TNCN_MULTI_INCOME', 'BUSINESS_HOUSEHOLD'],
    specialtyLabels: ['Giảm trừ gia cảnh', 'Hộ kinh doanh', 'Tranh chấp thuế'],
    bio: 'Chuyên sâu bảo vệ quyền lợi người nộp thuế, xử lý hồ sơ giảm trừ gia cảnh phức tạp, đăng ký người phụ thuộc quá hạn và gỡ vướng quyết toán thuế.',
    completedSessions: 184,
    responseRatePercent: 98,
    isAvailableToday: true,
    status: 'ACTIVE',
  },
  {
    id: 'exp-3',
    fullName: 'Lê Hoàng Nam',
    title: 'Chuyên gia Đại lý Thuế & Kế toán trưởng',
    rating: 4.85,
    reviewCount: 78,
    experienceYears: 8,
    feePerSession: 300000,
    sessionDurationMinutes: 45,
    verifiedCertificates: [
      {
        id: 'cert-4',
        type: 'TAX_AGENT',
        name: 'Chứng chỉ Đại lý Thuế',
        issuer: 'Tổng cục Thuế',
        issueYear: 2018,
        isVerified: true,
      },
      {
        id: 'cert-5',
        type: 'CHIEF_ACCOUNTANT',
        name: 'Chứng chỉ Kế toán trưởng Doanh nghiệp',
        issuer: 'Học viện Tài chính',
        issueYear: 2017,
        isVerified: true,
      },
    ],
    specialties: ['TNCN_MULTI_INCOME', 'STOCK_CRYPTO', 'DEPENDENT_DEDUCTION'],
    specialtyLabels: ['Thuế đầu tư chứng khoán', 'TNCN vãng lai', 'Hoàn thuế'],
    bio: 'Đã hỗ trợ hơn 300 cá nhân tự do (Freelancer), người sáng tạo nội dung số và nhà đầu tư cá nhân kê khai và hoàn thuế TNCN đúng chuẩn.',
    completedSessions: 120,
    responseRatePercent: 97,
    isAvailableToday: false,
    status: 'ACTIVE',
  },
  {
    id: 'exp-4',
    fullName: 'Phạm Minh Đức',
    title: 'Chuyên gia Tư vấn Thuế & Chuyển nhượng Vốn',
    rating: 4.88,
    reviewCount: 65,
    experienceYears: 12,
    feePerSession: 420000,
    sessionDurationMinutes: 45,
    verifiedCertificates: [
      {
        id: 'cert-6',
        type: 'CPA',
        name: 'CPA Việt Nam',
        issuer: 'Bộ Tài chính',
        issueYear: 2015,
        isVerified: true,
      },
    ],
    specialties: ['STOCK_CRYPTO', 'FOREIGN_INCOME', 'TAX_AUDIT_RISK'],
    specialtyLabels: ['Chuyển nhượng vốn', 'Cổ phiếu ESOP', 'Thu nhập nước ngoài'],
    bio: 'Chuyên gia hoạch định thuế tài chính cá nhân, ESOP cho nhân sự công nghệ và xử lý nghĩa vụ thuế phát sinh từ giao dịch xuyên biên giới.',
    completedSessions: 110,
    responseRatePercent: 96,
    isAvailableToday: true,
    status: 'ACTIVE',
  },
];

export const MOCK_SLOTS: Record<string, ConsultationSlot[]> = {
  'exp-1': [
    { id: 's1', expertId: 'exp-1', date: '2026-09-30', startTime: '09:00', endTime: '09:45', isAvailable: true },
    { id: 's2', expertId: 'exp-1', date: '2026-09-30', startTime: '10:30', endTime: '11:15', isAvailable: true },
    { id: 's3', expertId: 'exp-1', date: '2026-09-30', startTime: '14:00', endTime: '14:45', isAvailable: true },
    { id: 's4', expertId: 'exp-1', date: '2026-09-30', startTime: '16:00', endTime: '16:45', isAvailable: false },
    { id: 's5', expertId: 'exp-1', date: '2026-10-01', startTime: '09:30', endTime: '10:15', isAvailable: true },
    { id: 's6', expertId: 'exp-1', date: '2026-10-01', startTime: '15:00', endTime: '15:45', isAvailable: true },
    { id: 's7', expertId: 'exp-1', date: '2026-10-02', startTime: '19:00', endTime: '19:45', isAvailable: true },
  ],
  'exp-2': [
    { id: 's8', expertId: 'exp-2', date: '2026-09-30', startTime: '14:00', endTime: '14:45', isAvailable: true },
    { id: 's9', expertId: 'exp-2', date: '2026-09-30', startTime: '15:30', endTime: '16:15', isAvailable: true },
    { id: 's10', expertId: 'exp-2', date: '2026-10-01', startTime: '10:00', endTime: '10:45', isAvailable: true },
    { id: 's11', expertId: 'exp-2', date: '2026-10-01', startTime: '14:30', endTime: '15:15', isAvailable: true },
  ],
  'exp-3': [
    { id: 's12', expertId: 'exp-3', date: '2026-10-01', startTime: '08:30', endTime: '09:15', isAvailable: true },
    { id: 's13', expertId: 'exp-3', date: '2026-10-01', startTime: '16:00', endTime: '16:45', isAvailable: true },
  ],
  'exp-4': [
    { id: 's14', expertId: 'exp-4', date: '2026-09-30', startTime: '11:00', endTime: '11:45', isAvailable: true },
    { id: 's15', expertId: 'exp-4', date: '2026-10-01', startTime: '19:30', endTime: '20:15', isAvailable: true },
  ],
};

export const MOCK_REVIEWS: Record<string, ExpertReview[]> = {
  'exp-1': [
    {
      id: 'rev-1',
      bookingId: 'BK-8901',
      clientName: 'Hoàng Minh Tuấn',
      rating: 5,
      date: '24/09/2026',
      comment: 'Chuyên gia giải thích rất rõ ràng, chỉ cho tôi cách gom chứng từ khấu trừ 10% và tiết kiệm được gần 18 triệu tiền thuế phải nộp bổ sung.',
      tags: ['Đúng giờ', 'Chuyên môn sâu', 'Tận tâm'],
      expertReply: {
        date: '25/09/2026',
        comment: 'Cảm ơn anh Tuấn. Chúc anh hoàn tất nộp hồ sơ quyết toán đúng hạn trên iCanhan.',
      },
    },
    {
      id: 'rev-2',
      bookingId: 'BK-8722',
      clientName: 'Lê Thu Hương',
      rating: 5,
      date: '18/09/2026',
      comment: 'Tư vấn nhanh gọn, trực diện vấn đề. Giải quyết xong vướng mắc hợp đồng lao động kiêm vãng lai của tôi chỉ trong 30 phút.',
      tags: ['Giải quyết nhanh', 'Rõ ràng'],
    },
  ],
  'exp-2': [
    {
      id: 'rev-3',
      bookingId: 'BK-8605',
      clientName: 'Đặng Quốc Huy',
      rating: 5,
      date: '20/09/2026',
      comment: 'Luật sư Mai hướng dẫn chi tiết hồ sơ chứng minh người phụ thuộc là mẹ kế và bố mất khả năng lao động. Hồ sơ của tôi đã được chi cục thuế chấp thuận.',
      tags: ['Am hiểu pháp lý', 'Hỗ trợ chu đáo'],
    },
  ],
};

export const MOCK_BOOKINGS: ConsultationBooking[] = [
  {
    bookingId: 'BK-2026-9812',
    expertId: 'exp-1',
    expertName: 'Nguyễn Văn Bình',
    expertTitle: 'Kiểm toán viên & Chuyên gia Thuế cấp cao',
    date: '2026-09-30',
    timeSlot: '14:00 - 14:45',
    topic: 'Quyết toán thuế TNCN 2 nguồn thu nhập & chứng từ khấu trừ',
    problemDescription: 'Tôi có thu nhập chính thức tại công ty và thu nhập vãng lai từ hợp đồng dịch vụ. Cần hướng dẫn thủ tục hoàn thuế và đăng ký NPT bổ sung.',
    attachedFiles: [
      {
        id: 'f1',
        name: 'Chung_tu_khau_tru_2026.pdf',
        size: 1420000,
        uri: 'file://mock/chung_tu.pdf',
        type: 'application/pdf',
      },
    ],
    expertFee: 450000,
    platformFee: 0,
    discountAmount: 0,
    totalAmount: 450000,
    status: 'CONFIRMED',
    escrowStatus: 'HELD',
    meetingUrl: 'https://meet.taxkeep.vn/room/TK-9812',
    createdAt: '2026-09-28T09:15:00Z',
  },
  {
    bookingId: 'BK-2026-9430',
    expertId: 'exp-2',
    expertName: 'Trần Thị Mai',
    expertTitle: 'Luật sư Thuế & Trọng tài viên',
    date: '2026-09-25',
    timeSlot: '15:30 - 16:15',
    topic: 'Hồ sơ người phụ thuộc trên 18 tuổi học đại học',
    problemDescription: 'Hướng dẫn xin xác nhận sinh viên và nộp bổ sung giảm trừ gia cảnh cho kỳ quyết toán năm 2026.',
    attachedFiles: [],
    expertFee: 390000,
    platformFee: 0,
    discountAmount: 50000,
    totalAmount: 340000,
    status: 'COMPLETED',
    escrowStatus: 'RELEASED',
    createdAt: '2026-09-24T11:20:00Z',
    completedAt: '2026-09-25T16:15:00Z',
    hasReviewed: true,
  },
];

export const CONSULTATION_TOPICS = [
  'Quyết toán TNCN nhiều nguồn thu nhập',
  'Giảm trừ gia cảnh & Đăng ký người phụ thuộc',
  'Hoàn thuế TNCN & Xử lý chứng từ khấu trừ bị thiếu',
  'Thuế thu nhập chuyển nhượng chứng khoán / BĐS',
  'Nghĩa vụ thuế người nước ngoài & Thu nhập toàn cầu',
  'Rà soát rủi ro thuế & Chuẩn bị giải trình cơ quan thuế',
  'Tư vấn thuế Hộ kinh doanh & Cá nhân kinh doanh',
];

export function getExpertById(expertId: string): ExpertProfile | undefined {
  return MOCK_EXPERTS.find((e) => e.id === expertId);
}

export function getBookingById(bookingId: string): ConsultationBooking | undefined {
  return MOCK_BOOKINGS.find((b) => b.bookingId === bookingId);
}

export function getSlotsForExpert(expertId: string): ConsultationSlot[] {
  return MOCK_SLOTS[expertId] || [];
}

export function getReviewsForExpert(expertId: string): ExpertReview[] {
  return MOCK_REVIEWS[expertId] || [];
}

export function createBooking(newBooking: ConsultationBooking): ConsultationBooking {
  MOCK_BOOKINGS.unshift(newBooking);
  return newBooking;
}

export function updateBooking(bookingId: string, patch: Partial<ConsultationBooking>): ConsultationBooking | undefined {
  const idx = MOCK_BOOKINGS.findIndex((b) => b.bookingId === bookingId);
  if (idx !== -1) {
    MOCK_BOOKINGS[idx] = { ...MOCK_BOOKINGS[idx], ...patch };
    return MOCK_BOOKINGS[idx];
  }
  return undefined;
}

export function addReviewToExpert(expertId: string, review: ExpertReview): void {
  if (!MOCK_REVIEWS[expertId]) {
    MOCK_REVIEWS[expertId] = [];
  }
  MOCK_REVIEWS[expertId].unshift(review);
}

