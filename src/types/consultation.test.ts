import {
  formatVnd,
  formatBookingStatus,
  formatSessionType,
  formatVietnameseDate,
  formatTimeRange,
  formatExpertApplicationStatus,
  formatCertStatus,
  formatEscrowStatus,
  isValidAvatarUrl,
} from './consultation';

describe('consultation domain formatters', () => {
  describe('formatVnd', () => {
    it('formats numbers to VNĐ correctly', () => {
      expect(formatVnd(200000)).toBe('200.000 đ');
      expect(formatVnd(0)).toBe('0 đ');
      expect(formatVnd(null)).toBe('0 đ');
      expect(formatVnd(undefined)).toBe('0 đ');
    });
  });

  describe('formatSessionType', () => {
    it('returns proper labels and icons for all session types', () => {
      expect(formatSessionType('ONLINE_MEETING').label).toBe('Họp trực tuyến');
      expect(formatSessionType('VOICE_CALL').label).toBe('Gọi thoại');
      expect(formatSessionType('CHAT').label).toBe('Nhắn tin');
    });
  });

  describe('formatBookingStatus', () => {
    it('handles all 11 booking status states correctly', () => {
      expect(formatBookingStatus('PENDING_PAYMENT').label).toBe('Chờ thanh toán');
      expect(formatBookingStatus('EXPIRED_UNPAID').label).toBe('Hết hạn giữ chỗ');
      expect(formatBookingStatus('AWAITING_EXPERT_APPROVAL').label).toBe('Chờ chuyên gia duyệt');
      expect(formatBookingStatus('CONFIRMED').label).toBe('Đã xác nhận');
      expect(formatBookingStatus('REJECTED_BY_EXPERT').label).toBe('Chuyên gia từ chối');
      expect(formatBookingStatus('EXPIRED_NO_RESPONSE').label).toBe('Quá hạn phản hồi');
      expect(formatBookingStatus('CANCELLED_BY_USER').label).toBe('Bạn đã hủy');
      expect(formatBookingStatus('CANCELLED_BY_EXPERT').label).toBe('Chuyên gia hủy');
      expect(formatBookingStatus('IN_PROGRESS').label).toBe('Đang tư vấn');
      expect(formatBookingStatus('COMPLETED').label).toBe('Đã hoàn thành');
      expect(formatBookingStatus('SETTLED').label).toBe('Đã quyết toán');
      expect(formatBookingStatus('UNDER_DISPUTE').label).toBe('Đang khiếu nại');
    });
  });

  describe('formatEscrowStatus', () => {
    it('maps all escrow status states correctly', () => {
      expect(formatEscrowStatus('PendingPayment').label).toBe('Chờ thanh toán');
      expect(formatEscrowStatus('HeldInEscrow').label).toBe('Đang tạm giữ bảo đảm');
      expect(formatEscrowStatus('CoolingDown').label).toBe('Chờ kết toán (24h)');
      expect(formatEscrowStatus('Settled').label).toBe('Đã giải ngân');
      expect(formatEscrowStatus('Refunded').label).toBe('Đã hoàn tiền 100%');
      expect(formatEscrowStatus('PartiallyRefunded').label).toBe('Hoàn tiền một phần');
      expect(formatEscrowStatus('Cancelled').label).toBe('Đã hủy');
    });
  });

  describe('formatDisputeReason & formatDisputeStatus', () => {
    it('formats dispute reason codes correctly', () => {
      const { formatDisputeReason, formatDisputeStatus } = require('./consultation');
      expect(formatDisputeReason('WRONG_TAX_LAW_ADVICE')).toBe('Tư vấn sai luật thuế / gây rủi ro pháp lý');
      expect(formatDisputeReason('UNPROFESSIONAL_BEHAVIOR')).toBe('Thái độ thiếu chuyên nghiệp / xúc phạm');
      expect(formatDisputeReason('EARLY_DISCONNECT')).toBe('Chuyên gia rời phòng sớm / không đủ thời lượng');
      expect(formatDisputeReason('NETWORK_ISSUE')).toBe('Sự cố kết nối từ phía chuyên gia');
      expect(formatDisputeReason('OTHER')).toBe('Lý do khác');
      expect(formatDisputeReason('UNKNOWN_CODE')).toBe('Lý do khác');

      expect(formatDisputeStatus('PENDING_EXPERT_RESPONSE').label).toBe('Chờ chuyên gia giải trình');
      expect(formatDisputeStatus('PENDING_ADMIN_REVIEW').label).toBe('Ban quản trị đang xử lý');
      expect(formatDisputeStatus('RESOLVED').label).toBe('Đã giải quyết');
      expect(formatDisputeStatus('UNKNOWN').label).toBe('UNKNOWN');
    });
  });

  describe('formatExpertApplicationStatus', () => {
    it('maps application lifecycle statuses', () => {
      expect(formatExpertApplicationStatus('Draft').label).toBe('Bản nháp');
      expect(formatExpertApplicationStatus('PendingReview').label).toBe('Chờ thẩm định');
      expect(formatExpertApplicationStatus('NeedSupplement').label).toBe('Cần bổ sung');
      expect(formatExpertApplicationStatus('Rejected').label).toBe('Từ chối');
      expect(formatExpertApplicationStatus('Approved').label).toBe('Đã phê duyệt');
    });
  });

  describe('formatCertStatus', () => {
    it('maps certificate verification statuses', () => {
      expect(formatCertStatus('Verified').label).toBe('Hợp lệ');
      expect(formatCertStatus('Rejected').label).toBe('Không hợp lệ');
      expect(formatCertStatus('Expired').label).toBe('Hết hạn');
      expect(formatCertStatus('PendingVerification').label).toBe('Chờ thẩm định');
    });
  });

  describe('formatVietnameseDate & formatTimeRange', () => {
    it('formats date strings', () => {
      expect(formatVietnameseDate('2026-10-15')).toBe('15/10/2026');
      expect(formatVietnameseDate('')).toBe('');
    });

    it('formats time ranges', () => {
      expect(formatTimeRange('09:00:00', '10:00:00')).toBe('09:00 - 10:00');
      expect(formatTimeRange(undefined, undefined)).toBe('');
    });
  });

  describe('isValidAvatarUrl', () => {
    it('rejects fake or dummy storage domains', () => {
      expect(isValidAvatarUrl('https://storage.taxkeep.vn/avatars/expert_sample.jpg')).toBe(false);
      expect(isValidAvatarUrl('http://example.com/pic.jpg')).toBe(false);
      expect(isValidAvatarUrl('')).toBe(false);
      expect(isValidAvatarUrl(null)).toBe(false);
      expect(isValidAvatarUrl('https://validcdn.com/avatar.jpg')).toBe(true);
    });
  });
});
