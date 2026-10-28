import type {
  BookingStatus,
  ReviewEligibilityResponse,
  DisputeEligibilityResponse,
} from '../../types/consultation';

/**
 * Kiểm tra xem người nộp thuế có đủ điều kiện gửi đánh giá cho ca tư vấn hay không
 */
export function canUserReview(
  status: BookingStatus | string,
  isExpertView: boolean,
  reviewEligibility?: ReviewEligibilityResponse | null,
  hasExistingReview?: boolean,
  noShowType?: string | null
): boolean {
  if (isExpertView) return false;
  if (hasExistingReview) return false;
  if ((noShowType || '').trim().toUpperCase() === 'USER_NO_SHOW') return false;
  if (status !== 'COMPLETED' && status !== 'SETTLED') return false;
  return reviewEligibility?.canReview ?? true;
}

/**
 * Kiểm tra xem người nộp thuế có đủ điều kiện gửi khiếu nại trong giai đoạn Cool-down hay không
 */
export function canUserDispute(
  status: BookingStatus | string,
  isExpertView: boolean,
  disputeEligibility?: DisputeEligibilityResponse | null,
  hasExistingDispute?: boolean
): boolean {
  if (isExpertView) return false;
  if (hasExistingDispute) return false;
  if (status !== 'COMPLETED') return false;
  return disputeEligibility?.canDispute ?? true;
}

/**
 * Kiểm tra xem người nộp thuế có quyền bấm xác nhận hài lòng để giải ngân sớm hay không
 */
export function canConfirmSatisfaction(
  status: BookingStatus | string,
  isExpertView: boolean,
  disputeEligibility?: DisputeEligibilityResponse | null,
  hasExistingDispute?: boolean
): boolean {
  if (isExpertView) return false;
  if (hasExistingDispute) return false;
  if (status !== 'COMPLETED') return false;
  return disputeEligibility?.canDispute ?? true;
}

/**
 * Kiểm tra xem lịch hẹn tư vấn đã đến thời gian diễn ra chưa.
 * - Trả về false nếu lịch hẹn ở tương lai (chưa đến ngày hoặc chưa đến giờ bắt đầu của ngày hẹn).
 * - Trả về true nếu đã đến hoặc qua giờ bắt đầu của lịch hẹn.
 */
export function isBookingScheduleArrived(
  slotDate?: string,
  startTime?: string,
  refDate = new Date()
): boolean {
  if (!slotDate || !startTime) return false;
  try {
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayStr = `${refDate.getFullYear()}-${pad(refDate.getMonth() + 1)}-${pad(refDate.getDate())}`;

    let cleanDate = slotDate.includes('T') ? slotDate.split('T')[0] : slotDate.trim();
    if (cleanDate.includes('/')) {
      const parts = cleanDate.split('/');
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          cleanDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        } else if (parts[2].length === 4) {
          cleanDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }
    }

    if (cleanDate < todayStr) return true;
    if (cleanDate > todayStr) return false;

    // Trong cùng ngày hẹn: so sánh giờ và phút hiện tại với giờ bắt đầu
    const nowTimeStr = `${pad(refDate.getHours())}:${pad(refDate.getMinutes())}`;
    const timeParts = startTime.trim().split(':');
    const cleanStartTime = `${timeParts[0].padStart(2, '0')}:${(timeParts[1] || '00').padStart(2, '0')}`;

    return cleanStartTime <= nowTimeStr;
  } catch {
    return false;
  }
}

/**
 * Kiểm tra xem người dùng hiện tại có quyền lập biên bản và hoàn tất ca tư vấn hay không.
 * Chỉ chuyên gia phụ trách ca tư vấn mới thấy và sử dụng chức năng này.
 * - Khi ca IN_PROGRESS: Ca đang diễn ra -> Được phép lập biên bản & hoàn tất.
 * - Khi ca CONFIRMED: Chỉ hiển thị khi ĐÃ ĐẾN LỊCH HẸN. Nếu chưa đến lịch hẹn thì ẩn nút.
 * - Khách hàng (isExpertView = false) hoặc trạng thái khác -> không có quyền.
 */
export function canExpertComplete(
  status: BookingStatus | string,
  isExpertView: boolean,
  slotDate?: string,
  startTime?: string,
  refDate = new Date()
): boolean {
  if (!isExpertView) return false;
  if (status === 'IN_PROGRESS') return true;
  if (status !== 'CONFIRMED') return false;

  // Nếu có thông tin lịch hẹn, chỉ cho phép khi đã đến lịch
  if (slotDate && startTime) {
    return isBookingScheduleArrived(slotDate, startTime, refDate);
  }

  return true;
}

/**
 * Kiểm tra hợp lệ dữ liệu đánh giá trước khi gửi lên API
 */
export function validateReviewInput(
  rating: number,
  comment: string
): { valid: boolean; error?: string } {
  if (rating < 1 || rating > 5) {
    return { valid: false, error: 'Số sao đánh giá phải từ 1 đến 5.' };
  }
  if (!comment || comment.trim().length < 10) {
    return { valid: false, error: 'Nhận xét phải có tối thiểu 10 ký tự.' };
  }
  return { valid: true };
}

/**
 * Kiểm tra hợp lệ dữ liệu khiếu nại trước khi gửi lên API
 */
export function validateDisputeInput(
  reason: string,
  description: string
): { valid: boolean; error?: string } {
  if (!reason || !reason.trim()) {
    return { valid: false, error: 'Vui lòng chọn lý do khiếu nại.' };
  }
  if (!description || description.trim().length < 10) {
    return { valid: false, error: 'Mô tả khiếu nại phải có tối thiểu 10 ký tự.' };
  }
  return { valid: true };
}

/**
 * Kiểm tra hợp lệ dữ liệu giải trình chuyên gia trước khi gửi lên API
 */
export function validateExpertResponse(
  response: string
): { valid: boolean; error?: string } {
  if (!response || response.trim().length < 10) {
    return { valid: false, error: 'Nội dung giải trình phải có tối thiểu 10 ký tự.' };
  }
  return { valid: true };
}
