/**
 * Chuyển đổi mã lỗi và thông điệp kỹ thuật từ máy chủ sang ngôn ngữ tiếng Việt
 * tự nhiên, chuyên nghiệp và lịch sự cho người nộp thuế và chuyên gia.
 * Loại bỏ hoàn toàn các thuật ngữ thuần IT hoặc mã quy tắc nội bộ.
 */

export interface FriendlyErrorResult {
  title: string;
  message: string;
}

export function toFriendlyConsultationError(
  err: any,
  defaultTitle = 'Thông báo',
  defaultMessage = 'Hệ thống chưa thể xử lý yêu cầu lúc này. Vui lòng thử lại sau.'
): FriendlyErrorResult {
  const beData = err?.response?.data;
  const rawCode =
    beData?.errors?.errorCode ||
    beData?.errorCode ||
    err?.code ||
    '';
  let rawMsg =
    beData?.message ||
    err?.message ||
    '';

  if (typeof rawMsg !== 'string') {
    rawMsg = '';
  }

  // 1. Phân loại theo mã lỗi đặc trưng
  const upperCode = String(rawCode).toUpperCase();
  const upperMsg = rawMsg.toUpperCase();

  if (upperCode === 'SLOT_OVERLAP' || upperMsg.includes('SLOT_OVERLAP') || upperMsg.includes('BỊ TRÙNG')) {
    return {
      title: 'Khung giờ bị trùng',
      message: 'Khung giờ làm việc này đang trùng hoặc đè lên một khung giờ khác đã có trong lịch của bạn. Vui lòng chọn mốc thời gian khác.',
    };
  }

  if (upperCode === 'MAX_DAILY_SLOTS_EXCEEDED' || upperMsg.includes('MAX_DAILY_SLOTS_EXCEEDED') || upperMsg.includes('GIỚI HẠN TỐI ĐA')) {
    return {
      title: 'Đạt giới hạn trong ngày',
      message: cleanRawTechnicalStrings(rawMsg) || 'Bạn đã đạt giới hạn số lượng khung giờ làm việc tối đa trong ngày theo chính sách của sàn.',
    };
  }

  if (upperCode === 'SLOT_ALREADY_BOOKED' || upperMsg.includes('SLOT_ALREADY_BOOKED') || upperMsg.includes('ĐÃ CÓ KHÁCH HÀNG ĐẶT')) {
    return {
      title: 'Khung giờ đã có khách',
      message: 'Khung giờ này đã được khách hàng đặt hẹn. Bạn không thể chỉnh sửa, tắt hoặc xóa lúc này.',
    };
  }

  if (upperCode === 'SLOT_HOLDING' || upperMsg.includes('SLOT_HOLDING') || upperMsg.includes('TẠM GIỮ')) {
    return {
      title: 'Đang giữ chỗ thanh toán',
      message: 'Khung giờ đang được khách hàng tạm giữ trong 10 phút để thanh toán. Vui lòng kiểm tra lại sau khi phiên giữ chỗ kết thúc.',
    };
  }

  if (upperCode === 'SELF_BOOKING_NOT_ALLOWED' || upperMsg.includes('SELF_BOOKING')) {
    return {
      title: 'Không hợp lệ',
      message: 'Bạn không thể tự đặt lịch tư vấn với chính mình.',
    };
  }

  if (upperCode === 'INTERNAL_SERVER_ERROR' || err?.response?.status === 500) {
    return {
      title: defaultTitle,
      message: 'Hệ thống đang gặp sự cố tạm thời khi xử lý yêu cầu. Vui lòng thử lại sau giây lát.',
    };
  }

  if (upperCode === 'ROOM_NOT_OPEN_YET' || upperMsg.includes('ROOM_NOT_OPEN_YET')) {
    return {
      title: 'Phòng tư vấn chưa mở',
      message: cleanRawTechnicalStrings(rawMsg) || 'Phòng tư vấn trực tuyến sẽ mở trước giờ hẹn 10 phút. Vui lòng quay lại đúng giờ.',
    };
  }

  if (upperCode === 'NO_SHOW_EARLY' || upperMsg.includes('NO_SHOW_EARLY')) {
    return {
      title: 'Chưa đủ điều kiện',
      message: cleanRawTechnicalStrings(rawMsg) || 'Chỉ được phép báo vắng mặt sau khi đã quá 15 phút so với giờ bắt đầu buổi hẹn.',
    };
  }

  if (upperCode === 'USER_ALREADY_CHECKED_IN' || upperMsg.includes('USER_ALREADY_CHECKED_IN')) {
    return {
      title: 'Khách hàng đã vào phòng',
      message: 'Khách hàng đã có mặt trong phòng tư vấn, không thể báo vắng mặt.',
    };
  }

  if (upperCode === 'EXPERT_ALREADY_CHECKED_IN' || upperMsg.includes('EXPERT_ALREADY_CHECKED_IN')) {
    return {
      title: 'Chuyên gia đã vào phòng',
      message: 'Chuyên gia đã có mặt trong phòng tư vấn, không thể báo vắng mặt.',
    };
  }

  if (upperCode === 'NOTES_REQUIRED' || upperMsg.includes('NOTES_REQUIRED')) {
    return {
      title: 'Cần biên bản tóm tắt',
      message: 'Vui lòng nhập biên bản tóm tắt giải pháp tư vấn (tối thiểu 10 ký tự) trước khi kết thúc ca.',
    };
  }

  if (upperCode === 'REASON_REQUIRED' || upperMsg.includes('REASON_REQUIRED')) {
    return {
      title: 'Cần nêu rõ lý do',
      message: 'Vui lòng nhập lý do tối thiểu 5 ký tự để hệ thống thông báo đến đối tác.',
    };
  }

  if (upperCode === 'FORBIDDEN' || err?.response?.status === 403) {
    return {
      title: 'Không có quyền thao tác',
      message: 'Tài khoản của bạn không có quyền thực hiện thao tác này.',
    };
  }

  if (upperCode === 'NOT_FOUND' || err?.response?.status === 404) {
    return {
      title: 'Không tìm thấy dữ liệu',
      message: 'Thông tin yêu cầu không tồn tại hoặc đã được cập nhật.',
    };
  }

  // 2. Làm sạch thông điệp tiếng Việt từ Backend nếu có
  if (rawMsg.trim()) {
    const cleaned = cleanRawTechnicalStrings(rawMsg);
    if (cleaned) {
      return {
        title: defaultTitle,
        message: cleaned,
      };
    }
  }

  return {
    title: defaultTitle,
    message: defaultMessage,
  };
}

/**
 * Lược bỏ các mã kỹ thuật, BR-..., dấu ngoặc IT, đường dẫn URL nếu vô tình lọt vào chuỗi
 */
export function cleanRawTechnicalStrings(text: string): string {
  if (!text) return '';
  return text
    .replace(/\(BR-[\w\d.-]+\)/gi, '')
    .replace(/BR-[\w\d.-]+/gi, '')
    .replace(/\[\w+Exception\]/gi, '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/undefined/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Định dạng trạng thái hoàn tiền sang tiếng Việt dễ hiểu
 */
export function formatRefundStatus(status?: string | null): string {
  switch (status?.toUpperCase()) {
    case 'REFUNDED':
      return 'Đã hoàn tất hoàn tiền';
    case 'PROCESSING':
      return 'Đang xử lý hoàn tiền';
    case 'FAILED':
      return 'Hoàn tiền gặp sự cố';
    case 'NONE':
    default:
      return 'Không phát sinh';
  }
}
