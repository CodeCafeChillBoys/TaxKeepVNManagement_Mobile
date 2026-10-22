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
  const { code: rawCode, message: extractedMsg, status } = extractErrorInfo(err);
  let rawMsg = extractedMsg || '';

  const upperCode = String(rawCode).toUpperCase();
  const upperMsg = rawMsg.toUpperCase();

  // 1. Phân loại theo mã lỗi đặc trưng nghiệp vụ tư vấn & biểu phí
  if (upperCode === 'FEE_OUT_OF_RANGE' || upperMsg.includes('FEE_OUT_OF_RANGE') || upperMsg.includes('NẰM TRONG KHOẢNG')) {
    return {
      title: 'Mức phí ngoài khung quy định',
      message:
        cleanRawTechnicalStrings(rawMsg) ||
        'Mức phí bạn đề xuất chưa nằm trong khung giá sàn và trần quy định của sàn tư vấn. Vui lòng điều chỉnh lại.',
    };
  }

  if (upperCode === 'FEE_PROPOSAL_REQUIRED' || upperMsg.includes('FEE_PROPOSAL_REQUIRED')) {
    return {
      title: 'Chưa nhập biểu phí',
      message: 'Vui lòng nhập mức phí tư vấn cho ít nhất một hình thức hỗ trợ trước khi tiếp tục.',
    };
  }

  if (upperCode === 'ACTIVE_APPLICATION_EXISTS' || upperMsg.includes('ACTIVE_APPLICATION_EXISTS')) {
    return {
      title: 'Hồ sơ đang chờ xét duyệt',
      message: 'Bạn đã có hồ sơ đang trong quá trình xét duyệt. Vui lòng chờ phản hồi từ ban quản trị trước khi tạo yêu cầu mới.',
    };
  }

  if (upperCode === 'FULLNAME_MISMATCH' || upperMsg.includes('FULLNAME_MISMATCH')) {
    return {
      title: 'Thông tin chưa trùng khớp',
      message: 'Họ và tên trong hồ sơ chưa trùng khớp với họ và tên trên tài khoản hệ thống của bạn.',
    };
  }

  if (upperCode === 'CERTIFICATE_REQUIRED' || upperMsg.includes('CERTIFICATE_REQUIRED')) {
    return {
      title: 'Cần chứng chỉ hành nghề',
      message: 'Hồ sơ bắt buộc phải có ít nhất một chứng chỉ hành nghề hợp lệ để được xét duyệt.',
    };
  }

  if (upperCode === 'CERTIFICATE_EXPIRED' || upperMsg.includes('CERTIFICATE_EXPIRED')) {
    return {
      title: 'Chứng chỉ hết hạn',
      message: cleanRawTechnicalStrings(rawMsg) || 'Chứng chỉ hành nghề đính kèm đã hết hạn sử dụng. Vui lòng cập nhật chứng chỉ còn hiệu lực.',
    };
  }

  if (upperCode === 'INVALID_SPECIALIZATION' || upperMsg.includes('INVALID_SPECIALIZATION')) {
    return {
      title: 'Lĩnh vực không khả dụng',
      message: 'Lĩnh vực chuyên môn bạn chọn không hợp lệ hoặc đã ngừng áp dụng. Vui lòng chọn lĩnh vực khác.',
    };
  }

  if (upperCode === 'USER_NOT_ACTIVE' || upperMsg.includes('USER_NOT_ACTIVE')) {
    return {
      title: 'Tài khoản chưa sẵn sàng',
      message: 'Tài khoản của bạn hiện chưa ở trạng thái hoạt động để thực hiện thao tác này.',
    };
  }

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

  if (
    upperCode === 'SLOT_ALREADY_BOOKED' ||
    upperMsg.includes('SLOT_ALREADY_BOOKED') ||
    upperMsg.includes('ĐÃ CÓ KHÁCH HÀNG ĐẶT') ||
    upperMsg.includes('KHÁCH HÀNG ĐẶT') ||
    upperMsg.includes('ĐÃ ĐƯỢC ĐẶT')
  ) {
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

  if (upperCode === 'FORBIDDEN' || status === 403) {
    return {
      title: 'Không có quyền thao tác',
      message: 'Tài khoản của bạn không có quyền thực hiện thao tác này.',
    };
  }

  if (upperCode === 'NOT_FOUND' || status === 404) {
    return {
      title: 'Không tìm thấy dữ liệu',
      message: 'Thông tin yêu cầu không tồn tại hoặc đã được cập nhật.',
    };
  }

  // 2. Xử lý lỗi kết nối mạng, timeout
  if (
    upperCode === 'ERR_NETWORK' ||
    upperCode === 'ECONNABORTED' ||
    upperCode === 'ETIMEDOUT' ||
    upperMsg.includes('NETWORK ERROR') ||
    upperMsg.includes('TIMEOUT')
  ) {
    return {
      title: 'Lỗi kết nối',
      message: 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại đường truyền mạng của bạn.',
    };
  }

  // 3. Chặn các lỗi nội bộ máy chủ (500) hoặc ngoại lệ cơ sở dữ liệu để luôn dùng thông điệp thân thiện
  if (
    status === 500 ||
    upperCode === 'INTERNAL_SERVER_ERROR' ||
    upperMsg.includes('FOREIGN KEY') ||
    upperMsg.includes('ENTITY CHANGES') ||
    upperMsg.includes('INTERNAL SERVER ERROR') ||
    upperMsg.includes('DBUPDATE') ||
    upperMsg.includes('EXCEPTION')
  ) {
    const isCustom =
      Boolean(defaultMessage) &&
      defaultMessage !== 'Hệ thống chưa thể xử lý yêu cầu lúc này. Vui lòng thử lại sau.';
    return {
      title: defaultTitle,
      message: isCustom
        ? defaultMessage
        : 'Hệ thống đang gặp sự cố tạm thời khi xử lý yêu cầu. Vui lòng thử lại sau giây lát.',
    };
  }

  // 4. Làm sạch thông điệp tiếng Việt từ Backend nếu có
  if (rawMsg.trim()) {
    const cleaned = cleanRawTechnicalStrings(rawMsg);
    if (cleaned && !cleaned.toLowerCase().includes('request failed with status code')) {
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
 * Bóc tách mã lỗi, thông điệp và trạng thái từ mọi định dạng response (JSON object, stringified JSON, ProblemDetails)
 */
function extractErrorInfo(err: any): { code: string; message: string; status?: number } {
  let beData = err?.response?.data;
  const status = err?.response?.status || err?.status;

  // Nếu beData là chuỗi JSON, thử parse sang object
  if (typeof beData === 'string') {
    const trimmed = beData.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        beData = JSON.parse(trimmed);
      } catch {
        // Parse thất bại, giữ nguyên
      }
    } else if (trimmed.startsWith('<html') || trimmed.startsWith('<!DOCTYPE')) {
      return {
        code: 'GATEWAY_ERROR',
        message: 'Máy chủ phản hồi chậm hoặc đang bảo trì. Vui lòng thử lại sau ít phút.',
        status,
      };
    }
  }

  // Trích xuất mã lỗi
  const code =
    beData?.errors?.errorCode ||
    beData?.errorCode ||
    beData?.code ||
    err?.code ||
    '';

  // Trích xuất thông điệp từ danh sách validation errors (ASP.NET ModelState dictionary)
  let message = '';
  if (beData?.errors && typeof beData.errors === 'object' && !Array.isArray(beData.errors)) {
    const errorValues = Object.values(beData.errors);
    for (const val of errorValues) {
      if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'string') {
        message = val[0];
        break;
      } else if (typeof val === 'string' && val.trim()) {
        message = val;
        break;
      }
    }
  } else if (Array.isArray(beData?.errors) && beData.errors.length > 0) {
    message = typeof beData.errors[0] === 'string' ? beData.errors[0] : '';
  }

  // Nếu chưa có message từ errors, lấy từ message, detail hoặc error
  if (!message) {
    message = beData?.message || beData?.detail || beData?.error || '';
  }

  // Nếu chưa có và title không phải lỗi tiếng Anh kỹ thuật mặc định
  if (!message && beData?.title) {
    const t = String(beData.title).trim();
    const isGenericEng =
      t.toLowerCase().includes('validation errors') ||
      t.toLowerCase() === 'bad request' ||
      t.toLowerCase() === 'internal server error';
    if (!isGenericEng) {
      message = t;
    }
  }

  // Nếu vẫn chưa có, kiểm tra nếu err.message chứa chuỗi JSON
  if (!message && typeof err?.message === 'string') {
    const trimmedMsg = err.message.trim();
    if (trimmedMsg.startsWith('{') && trimmedMsg.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmedMsg);
        message = parsed?.message || parsed?.detail || '';
      } catch {
        // bỏ qua
      }
    } else if (!trimmedMsg.includes('Request failed with status code')) {
      message = trimmedMsg;
    }
  }

  return {
    code: String(code || ''),
    message: typeof message === 'string' ? message : '',
    status,
  };
}

/**
 * Lược bỏ các mã kỹ thuật, BR-..., dấu ngoặc IT, đường dẫn URL nếu vô tình lọt vào chuỗi
 */
export function cleanRawTechnicalStrings(text: string): string {
  if (!text) return '';
  return text
    .replace(/ONLINE_MEETING/gi, 'Họp trực tuyến (Gọi video)')
    .replace(/VOICE_CALL/gi, 'Gọi thoại trực tiếp')
    .replace(/CHAT/gi, 'Nhắn tin tư vấn')
    .replace(/TAX_AGENT/gi, 'Đại lý thuế')
    .replace(/\(BR-[\w\d.-]+\)/gi, '')
    .replace(/BR-[\w\d.-]+/gi, '')
    .replace(/\[\w+Exception\]/gi, '')
    .replace(/System\.\w+Exception:?/gi, '')
    .replace(/AxiosError:?/gi, '')
    .replace(/Request failed with status code \d+/gi, '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/undefined/gi, '')
    .replace(/NaN/gi, '')
    .replace(/\{"[^"]+":\s*[^}]+\}/g, '')
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

/**
 * Chuẩn hóa ghi chú xác thực chứng chỉ sang ngôn ngữ tiếng Việt tự nhiên,
 * ngắn gọn và loại bỏ hoàn toàn các thuật ngữ thuần IT (AI, OCR, TAX_AGENT, Độ tin cậy...).
 */
export function formatCertVerificationNote(note?: string | null, status?: string): string {
  if (!note || typeof note !== 'string') return '';
  const trimmed = note.trim();
  if (!trimmed) return '';

  const upper = trimmed.toUpperCase();

  // 1. Trường hợp bị từ chối thẩm định hoặc có nội dung từ chối
  if (
    status === 'Rejected' ||
    upper.includes('TỪ CHỐI') ||
    upper.includes('REJECT') ||
    upper.includes('KHÔNG PHẢI') ||
    upper.includes('KHÔNG KHỚP') ||
    upper.includes('KHÔNG TRÙNG') ||
    upper.includes('KHÔNG HỢP LỆ')
  ) {
    return cleanRawTechnicalStrings(
      trimmed.replace(/^AI từ chối:\s*/i, '').replace(/^AI reject:\s*/i, '')
    );
  }

  // 2. Nhận diện các ghi chú sinh tự động xác thực thành công chứa thuật ngữ kỹ thuật
  if (
    upper.includes('AI TỰ ĐỘNG') ||
    upper.includes('TAX_AGENT') ||
    upper.includes('ĐỘ TIN CẬY') ||
    upper.includes('OCR') ||
    upper.includes('RABBITMQ') ||
    upper.includes('KHỚP HỌ TÊN')
  ) {
    return 'Chứng chỉ hợp lệ, thông tin trùng khớp với hồ sơ chuyên gia.';
  }

  return cleanRawTechnicalStrings(trimmed);
}

/**
 * Định dạng số nguyên thành chuỗi có dấu chấm phân cách hàng nghìn (VD: 200000 -> "200.000")
 */
export function formatThousands(value?: string | number | null): string {
  if (value === undefined || value === null || value === '') return '';
  const cleanDigits = String(value).replace(/\D/g, '');
  if (!cleanDigits) return '';
  return cleanDigits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Trích xuất giá trị số nguyên từ chuỗi đã định dạng có dấu chấm (VD: "200.000" -> 200000)
 */
export function parseThousands(value?: string | number | null): number {
  if (typeof value === 'number') return isNaN(value) ? 0 : Math.round(value);
  if (!value) return 0;
  const cleanDigits = String(value).replace(/\D/g, '');
  return parseInt(cleanDigits, 10) || 0;
}

/**
 * Định dạng số tiền có dấu chấm kèm đơn vị VNĐ (VD: 200000 -> "200.000 VNĐ")
 */
export function formatVndWithDots(value?: string | number | null): string {
  const num = parseThousands(value);
  return `${formatThousands(num)} VNĐ`;
}


