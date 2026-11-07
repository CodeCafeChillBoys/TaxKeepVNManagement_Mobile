import { cleanRawTechnicalStrings, toFriendlyConsultationError, FriendlyErrorResult } from './consultationFriendlyErrors';

const BANNED_TECHNICAL_PATTERNS: Array<[RegExp, string]> = [
  [/\bnetwork\s*error\b/gi, 'Không thể kết nối mạng'],
  [/\bfailed\s*to\s*fetch\b/gi, 'Không thể kết nối máy chủ'],
  [/\btimeout(\s+of\s+\d+ms\s+exceeded)?\b/gi, 'Quá thời gian phản hồi'],
  [/\binternal\s+server\s+error\b/gi, 'Hệ thống đang bận xử lý'],
  [/\bbad\s+gateway\b/gi, 'Hệ thống đang bảo trì tạm thời'],
  [/\bservice\s+unavailable\b/gi, 'Hệ thống đang tạm ngưng phục vụ'],
  [/\bunauthorized\b/gi, 'Phiên làm việc đã hết hạn'],
  [/\bforbidden\b/gi, 'Không có quyền thực hiện thao tác này'],
  [/\bbad\s+request\b/gi, 'Thông tin gửi lên chưa hợp lệ'],
  [/\bnot\s+found\b/gi, 'Không tìm thấy dữ liệu yêu cầu'],
  [/\bpayload\b/gi, 'dữ liệu'],
  [/\btoken\b/gi, 'phiên xác thực'],
  [/\bsession\b/gi, 'phiên làm việc'],
  [/\bvalidate\b|\bvalidation\b/gi, 'kiểm tra dữ liệu'],
  [/\bparse\b/gi, 'đọc dữ liệu'],
  [/\bocr\b/gi, 'nhận diện giấy tờ'],
  [/\btaxai\b/gi, 'hệ thống xử lý'],
  [/\bserver\b/gi, 'hệ thống'],
  [/\bapi\b/gi, 'hệ thống'],
  [/\brequest\b/gi, 'yêu cầu'],
  [/\bstatus\s*(code)?\s*\d{3}\b/gi, ''],
  [/\bnull\b|\bundefined\b/gi, ''],
];

/**
 * Làm sạch triệt để các thuật ngữ kỹ thuật (IT) khỏi thông điệp hiển thị cho người nộp thuế.
 */
export function sanitizeUiMessage(raw?: string | null, fallback = ''): string {
  if (!raw || typeof raw !== 'string') return fallback;
  let cleaned = cleanRawTechnicalStrings(raw);
  for (const [pattern, replacement] of BANNED_TECHNICAL_PATTERNS) {
    cleaned = cleaned.replace(pattern, replacement);
  }
  cleaned = cleaned
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,;!?])/g, '$1')
    .trim();

  if (!cleaned) return fallback;
  // Chặn các chuỗi lỗi tiếng Anh thuần kỹ thuật còn sót
  if (/^(error|typeerror|syntaxerror|referenceerror|abort|aborted|canceled|cancelled)/i.test(cleaned)) {
    return fallback;
  }
  return cleaned;
}

/**
 * Chuyển mọi lỗi phát sinh từ mạng, máy chủ hoặc kiểm tra biểu mẫu thành tiêu đề + nội dung
 * tiếng Việt trang trọng, ngắn gọn (tiêu đề 4–7 từ, nội dung 1–2 câu).
 */
export function toFriendlyError(
  err: unknown,
  titleOrOptions: string | { fallbackTitle?: string; fallbackMessage?: string } = 'Chưa thể thực hiện yêu cầu',
  messageArg = 'Hệ thống đang bận xử lý. Vui lòng kiểm tra lại thông tin hoặc thử lại sau ít phút.'
): FriendlyErrorResult {
  const defaultTitle =
    typeof titleOrOptions === 'string'
      ? titleOrOptions
      : titleOrOptions.fallbackTitle ?? 'Chưa thể thực hiện yêu cầu';
  const defaultMessage =
    typeof titleOrOptions === 'string' ? messageArg : titleOrOptions.fallbackMessage ?? messageArg;
  const anyErr = err as any;
  const status: number | undefined = anyErr?.response?.status ?? anyErr?.status;
  const code = String(anyErr?.code || anyErr?.response?.data?.errorCode || '').toUpperCase();

  if (status === 401) {
    return {
      title: 'Phiên đăng nhập đã hết hạn',
      message: 'Vui lòng đăng nhập lại để tiếp tục kê khai và tra cứu hồ sơ thuế.',
    };
  }
  if (status === 413) {
    return {
      title: 'Tệp đính kèm quá lớn',
      message: 'Dung lượng ảnh hoặc tài liệu vượt mức cho phép. Vui lòng chọn tệp nhỏ hơn 10 MB.',
    };
  }
  if (status === 429) {
    return {
      title: 'Thao tác quá nhanh',
      message: 'Bạn vừa gửi nhiều yêu cầu liên tiếp. Vui lòng chờ ít phút rồi thực hiện lại.',
    };
  }
  if (
    code === 'ERR_NETWORK' ||
    code === 'ECONNABORTED' ||
    code === 'ETIMEDOUT' ||
    /network\s*error|timeout|failed\s*to\s*fetch/i.test(String(anyErr?.message || ''))
  ) {
    return {
      title: 'Kết nối mạng bị gián đoạn',
      message: 'Không thể liên lạc với hệ thống lúc này. Vui lòng kiểm tra Wi-Fi hoặc dữ liệu di động rồi thử lại.',
    };
  }

  const base = toFriendlyConsultationError(anyErr, defaultTitle, defaultMessage);
  return {
    title: sanitizeUiMessage(base.title, defaultTitle),
    message: sanitizeUiMessage(base.message, defaultMessage),
  };
}

/**
 * Trả về chuỗi thông báo lỗi tiếng Việt ngắn gọn để truyền trực tiếp vào `toast.error(...)`.
 */
export function toFriendlyErrorMessage(
  err: unknown,
  fallbackMessage = 'Chưa thể hoàn tất thao tác lúc này. Vui lòng thử lại sau ít phút.'
): string {
  return toFriendlyError(err, 'Chưa thể thực hiện', fallbackMessage).message;
}

