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
  hasExistingReview?: boolean
): boolean {
  if (isExpertView) return false;
  if (hasExistingReview) return false;
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
