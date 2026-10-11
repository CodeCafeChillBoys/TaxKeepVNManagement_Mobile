import {
  formatVnd,
  formatBookingStatus,
  formatSessionType,
  formatVietnameseDate,
  formatTimeRange,
  formatExpertApplicationStatus,
  formatCertStatus,
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
    it('handles all 9 booking status states correctly', () => {
      expect(formatBookingStatus('PENDING_PAYMENT').label).toBe('Chờ thanh toán');
      expect(formatBookingStatus('EXPIRED_UNPAID').label).toBe('Hết hạn giữ chỗ');
      expect(formatBookingStatus('AWAITING_EXPERT_APPROVAL').label).toBe('Chờ chuyên gia duyệt');
      expect(formatBookingStatus('CONFIRMED').label).toBe('Đã xác nhận');
      expect(formatBookingStatus('REJECTED_BY_EXPERT').label).toBe('Chuyên gia từ chối');
      expect(formatBookingStatus('EXPIRED_NO_RESPONSE').label).toBe('Quá hạn phản hồi');
      expect(formatBookingStatus('CANCELLED_BY_USER').label).toBe('Bạn đã hủy');
      expect(formatBookingStatus('CANCELLED_BY_EXPERT').label).toBe('Chuyên gia hủy');
      expect(formatBookingStatus('COMPLETED').label).toBe('Đã hoàn thành');
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
});
