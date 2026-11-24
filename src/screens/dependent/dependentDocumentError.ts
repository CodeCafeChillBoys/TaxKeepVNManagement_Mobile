import { parseForbiddenError } from '../../utils/permissionError';

export interface ParsedDependentUploadError {
  code: string;
  title: string;
  message: string;
  hint: string;
}

const DOC_TYPE_VI_MAP: Record<string, string> = {
  BIRTH_CERTIFICATE: 'Giấy khai sinh',
  CITIZEN_ID: 'Căn cước công dân',
  CITIZEN_CARD: 'Căn cước công dân',
  CCCD: 'Căn cước công dân',
  STUDENT_CARD: 'Thẻ sinh viên / Giấy xác nhận trường',
  STUDENT_DOCUMENT: 'Thẻ sinh viên / Giấy xác nhận trường',
  DISABILITY_CERTIFICATE: 'Giấy xác nhận khuyết tật',
  DISABILITY_OR_INCAPACITY_CERT: 'Giấy xác nhận khuyết tật / mất NLHV dân sự',
  MARRIAGE_CERTIFICATE: 'Giấy chứng nhận kết hôn',
  RELATIONSHIP_CERTIFICATE: 'Giấy tờ chứng minh quan hệ (Hộ khẩu / CT07)',
  RESIDENCE_CT07: 'Giấy xác nhận thông tin cư trú (CT07)',
  CT07: 'Giấy xác nhận thông tin cư trú (CT07)',
  SUPPORT_COMMITMENT_FORM: 'Bản cam kết nuôi dưỡng trực tiếp',
  TAXPAYER_BIRTH_CERT: 'Giấy khai sinh của người nộp thuế',
  SPOUSE_BIRTH_CERT: 'Giấy khai sinh của vợ/chồng',
  LABOR_INCAPACITY_DOC: 'Giấy tờ chứng minh suy giảm khả năng lao động',
  OTHER: 'Giấy tờ minh chứng khác',
};

const VIETNAMESE_CHAR_REGEX =
  /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

/**
 * Thay thế các mã enum tiếng Anh (VD: BIRTH_CERTIFICATE, CITIZEN_ID, CCCD...)
 * trong thông điệp BE trả về bằng tên tiếng Việt dễ hiểu.
 */
export function humanizeDocumentTypeCodes(text: string): string {
  if (!text) return '';
  let result = text;
  const sortedCodes = Object.keys(DOC_TYPE_VI_MAP).sort((a, b) => b.length - a.length);
  for (const code of sortedCodes) {
    const regex = new RegExp(`\\b${code}\\b`, 'gi');
    result = result.replace(regex, DOC_TYPE_VI_MAP[code]);
  }
  return result;
}

function isCleanVietnameseMessage(msg: string): boolean {
  if (!msg || !msg.trim()) return false;
  if (!VIETNAMESE_CHAR_REGEX.test(msg)) return false;
  if (/\{[\s\S]*\}|exception|stacktrace|http\s*\d{3}|axios|system\./i.test(msg)) {
    return false;
  }
  return true;
}

function extractRawErrorMeta(err: unknown): {
  status?: number;
  code: string;
  rawMessage: string;
  isTimeout: boolean;
  isNetwork: boolean;
} {
  if (!err || typeof err !== 'object') {
    return {
      code: '',
      rawMessage: typeof err === 'string' ? err : '',
      isTimeout: false,
      isNetwork: false,
    };
  }

  const e = err as Record<string, any>;
  const response = e.response;
  const data = response?.data;
  const status: number | undefined =
    typeof e.httpStatus === 'number'
      ? e.httpStatus
      : typeof response?.status === 'number'
      ? response.status
      : undefined;

  const code = String(
    e.errorCode ||
      data?.errorCode ||
      data?.errors?.errorCode ||
      ''
  )
    .trim()
    .toUpperCase();

  const modelStateFirstError =
    data?.errors?.File?.[0] ||
    data?.errors?.DocType?.[0] ||
    (Array.isArray(data?.errors) ? data.errors[0] : undefined);

  const rawMessage = String(
    e.rawMessage ||
      data?.message ||
      modelStateFirstError ||
      e.message ||
      ''
  ).trim();

  const lowerMsg = rawMessage.toLowerCase();
  const isTimeout =
    e.code === 'ECONNABORTED' ||
    e.code === 'ETIMEDOUT' ||
    code === 'TIMEOUT' ||
    lowerMsg.includes('timeout') ||
    lowerMsg.includes('quá thời gian');

  const isNetwork =
    !status &&
    (e.code === 'ERR_NETWORK' ||
      lowerMsg.includes('network error') ||
      lowerMsg.includes('failed to fetch') ||
      Boolean(e.request && !response));

  return { status, code, rawMessage, isTimeout, isNetwork };
}

/**
 * Ánh xạ đầy đủ toàn bộ mã lỗi BE ở luồng POST /api/v1/dependents/{dependentId}/documents
 * (DependentDocumentController, DependentDocumentService, OcrService, GlobalExceptionMiddleware)
 * sang tiêu đề, mô tả cụ thể tiếng Việt và gợi ý khắc phục.
 */
export function parseDependentUploadError(err: unknown): ParsedDependentUploadError {
  const { status, code, rawMessage, isTimeout, isNetwork } = extractRawErrorMeta(err);
  const lowerMsg = rawMessage.toLowerCase();
  const humanized = humanizeDocumentTypeCodes(rawMessage);

  // 1. Timeout khi gọi AI OCR
  if (isTimeout) {
    return {
      code: 'TIMEOUT',
      title: 'Quá thời gian đọc giấy tờ',
      message:
        'Hệ thống mất quá nhiều thời gian để đọc ảnh giấy tờ này. Vui lòng chụp ảnh rõ nét, dung lượng vừa phải rồi thử tải lên lại.',
      hint: 'Kiểm tra kết nối mạng ổn định trước khi thử lại.',
    };
  }

  // 2. Mất kết nối mạng
  if (isNetwork) {
    return {
      code: 'NETWORK_ERROR',
      title: 'Không có kết nối mạng',
      message: 'Không thể kết nối đến máy chủ lúc này. Vui lòng kiểm tra Wi-Fi hoặc dữ liệu di động.',
      hint: 'Thử tải lên lại sau khi kết nối ổn định.',
    };
  }

  // 3. Phiên đăng nhập hết hạn (401 / INVALID_TOKEN)
  if (status === 401 || code === 'INVALID_TOKEN' || code === 'UNAUTHORIZED') {
    return {
      code: code || 'UNAUTHORIZED',
      title: 'Phiên đăng nhập đã hết hạn',
      message: 'Phiên làm việc của bạn đã hết hạn. Vui lòng đăng nhập lại để tiếp tục tải giấy tờ minh chứng.',
      hint: 'Đăng nhập lại tài khoản của bạn.',
    };
  }

  // 4. Không có quyền (403 / FORBIDDEN — phân quyền RBAC hoặc sở hữu hồ sơ)
  if (status === 403 || code === 'FORBIDDEN') {
    const forbidden = parseForbiddenError(err);
    return {
      code: 'FORBIDDEN',
      title: forbidden?.title || 'Không có quyền cập nhật hồ sơ',
      message:
        forbidden?.message ||
        (isCleanVietnameseMessage(humanized)
          ? humanized
          : 'Bạn không có quyền tải giấy tờ cho hồ sơ người phụ thuộc này.'),
      hint: forbidden?.permissionCode
        ? 'Liên hệ quản trị viên để được cấp quyền thực hiện tính năng này.'
        : 'Kiểm tra lại đúng tài khoản người nộp thuế đã khai báo hồ sơ.',
    };
  }

  // 5. Không tìm thấy hồ sơ NPT (404 / NOT_FOUND)
  if (status === 404 || code === 'NOT_FOUND') {
    return {
      code: 'NOT_FOUND',
      title: 'Không tìm thấy hồ sơ người phụ thuộc',
      message: isCleanVietnameseMessage(humanized)
        ? humanized
        : 'Hồ sơ người phụ thuộc không tồn tại hoặc đã bị vô hiệu hóa.',
      hint: 'Quay lại danh sách người phụ thuộc để kiểm tra lại hồ sơ.',
    };
  }

  // 6. Thiếu tệp tải lên (FILE_MISSING)
  if (code === 'FILE_MISSING' || lowerMsg.includes('chọn tệp chứng từ') || lowerMsg.includes('cung cấp tệp ảnh')) {
    return {
      code: 'FILE_MISSING',
      title: 'Chưa có tệp minh chứng',
      message: 'Vui lòng chụp ảnh hoặc chọn tệp chứng từ trước khi tải lên.',
      hint: 'Bấm vào khung bên trên để chọn ảnh hoặc tệp PDF.',
    };
  }

  // 7. Vượt dung lượng 10MB (FILE_SIZE_EXCEEDED / 413)
  if (code === 'FILE_SIZE_EXCEEDED' || status === 413 || lowerMsg.includes('10mb')) {
    return {
      code: 'FILE_SIZE_EXCEEDED',
      title: 'Dung lượng tệp vượt quá 10MB',
      message: 'Tệp tải lên vượt quá giới hạn tối đa 10MB của hệ thống.',
      hint: 'Vui lòng nén ảnh hoặc chụp lại tệp có dung lượng nhỏ hơn 10MB.',
    };
  }

  // 8. Sai định dạng tệp (INVALID_FILE_TYPE)
  if (code === 'INVALID_FILE_TYPE' || lowerMsg.includes('định dạng tệp không hợp lệ')) {
    return {
      code: 'INVALID_FILE_TYPE',
      title: 'Định dạng tệp không được hỗ trợ',
      message: 'Hệ thống chỉ hỗ trợ ảnh JPG, JPEG, PNG hoặc tài liệu PDF.',
      hint: 'Vui lòng chọn lại ảnh JPG/PNG hoặc tệp PDF hợp lệ.',
    };
  }

  // 9. Loại giấy tờ không hợp lệ (INVALID_DOC_TYPE)
  if (code === 'INVALID_DOC_TYPE') {
    return {
      code: 'INVALID_DOC_TYPE',
      title: 'Loại giấy tờ không hợp lệ',
      message: isCleanVietnameseMessage(humanized)
        ? humanized
        : 'Loại giấy tờ minh chứng không thuộc danh mục hợp lệ theo quy định thuế.',
      hint: 'Vui lòng thử lại hoặc quay lại danh sách người phụ thuộc để tải lại danh mục giấy tờ.',
    };
  }

  // 10. Ảnh quá mờ / lóa sáng / không đọc được (UNREADABLE_DOCUMENT / UNREADABLE_IMAGE)
  if (
    code === 'UNREADABLE_DOCUMENT' ||
    code === 'UNREADABLE_IMAGE' ||
    lowerMsg.includes('không đạt chuẩn chất lượng') ||
    lowerMsg.includes('không thể đọc được')
  ) {
    return {
      code: code || 'UNREADABLE_DOCUMENT',
      title: 'Ảnh giấy tờ chưa đủ rõ nét',
      message: isCleanVietnameseMessage(humanized)
        ? humanized
        : 'Ảnh giấy tờ bị mờ, lóa sáng hoặc khuất chữ nên hệ thống chưa thể đọc được.',
      hint: 'Đặt giấy tờ phẳng phiu ở nơi đủ ánh sáng, chụp rõ 4 góc và thử tải lên lại.',
    };
  }

  // 11. Sai loại giấy tờ so với mục đang nộp (DOC_TYPE_MISMATCH)
  if (code === 'DOC_TYPE_MISMATCH' || lowerMsg.includes('loại giấy tờ tải lên không khớp')) {
    return {
      code: 'DOC_TYPE_MISMATCH',
      title: 'Sai loại giấy tờ minh chứng',
      message: isCleanVietnameseMessage(humanized)
        ? humanized
        : 'Ảnh giấy tờ bạn tải lên không khớp với loại chứng từ yêu cầu ở bước này.',
      hint: 'Vui lòng chọn đúng ảnh của loại giấy tờ đang hiển thị ở bước hiện tại.',
    };
  }

  // 12. Sai thông tin người phụ thuộc: Họ tên / CCCD / Năm sinh (IDENTITY_MISMATCH)
  if (
    code === 'IDENTITY_MISMATCH' ||
    lowerMsg.includes('không trùng khớp với hồ sơ người phụ thuộc') ||
    lowerMsg.includes('không khớp với số cccd người phụ thuộc') ||
    lowerMsg.includes('không khớp với ngày sinh đã đăng ký')
  ) {
    return {
      code: 'IDENTITY_MISMATCH',
      title: 'Thông tin trên giấy tờ không khớp hồ sơ',
      message: isCleanVietnameseMessage(humanized)
        ? humanized
        : 'Họ tên, số CCCD hoặc ngày sinh trên ảnh không trùng khớp với thông tin người phụ thuộc đã khai báo.',
      hint: 'Kiểm tra lại xem bạn có chọn nhầm ảnh của người khác không và tải lại đúng giấy tờ của người phụ thuộc.',
    };
  }

  // 13. Lỗi dịch vụ AI OCR (OCR_SERVICE_ERROR / OCR_EXTRACTION_FAILED / AI_CONNECTION_ERROR)
  if (code === 'AI_CONNECTION_ERROR' || lowerMsg.includes('kết nối tới dịch vụ ai')) {
    return {
      code: 'AI_CONNECTION_ERROR',
      title: 'Dịch vụ AI đọc giấy tờ đang gián đoạn',
      message: 'Hệ thống tạm thời không kết nối được tới dịch vụ đọc thông tin giấy tờ AI.',
      hint: 'Vui lòng chờ ít phút rồi bấm thử tải lên lại.',
    };
  }

  if (code === 'OCR_SERVICE_ERROR' || code === 'OCR_EXTRACTION_FAILED' || lowerMsg.includes('ai bóc tách thất bại')) {
    return {
      code: code || 'OCR_EXTRACTION_FAILED',
      title: 'Không thể bóc tách thông tin từ ảnh',
      message:
        code === 'OCR_EXTRACTION_FAILED' && isCleanVietnameseMessage(humanized)
          ? humanized
          : 'Hệ thống chưa thể trích xuất thông tin từ hình ảnh này. Ảnh có thể bị nghiêng, mờ hoặc không phải giấy tờ hợp lệ.',
      hint: 'Chụp lại ảnh rõ nét, ngay ngắn hơn rồi thử tải lên lại.',
    };
  }

  // 14. Lỗi máy chủ 500+
  if ((typeof status === 'number' && status >= 500) || code === 'INTERNAL_SERVER_ERROR') {
    return {
      code: 'INTERNAL_SERVER_ERROR',
      title: 'Hệ thống đang tạm bận',
      message: 'Máy chủ tạm thời gặp sự cố khi xác thực và lưu trữ giấy tờ của bạn.',
      hint: 'Vui lòng thử tải lên lại sau ít phút.',
    };
  }

  // 15. Fallback an toàn: giữ thông báo tiếng Việt hợp lệ từ BE nếu có
  if (isCleanVietnameseMessage(humanized)) {
    return {
      code: code || 'UPLOAD_FAILED',
      title: 'Tải giấy tờ chưa thành công',
      message: humanized,
      hint: 'Vui lòng kiểm tra lại ảnh giấy tờ và thử tải lên lại.',
    };
  }

  return {
    code: code || 'UPLOAD_FAILED',
    title: 'Tải giấy tờ chưa thành công',
    message: 'Chưa thể tải lên và xác thực giấy tờ này lúc này. Vui lòng kiểm tra lại ảnh và thử lại.',
    hint: 'Đảm bảo ảnh rõ nét, đúng loại giấy tờ và kết nối mạng ổn định.',
  };
}

export interface StepDocumentLike {
  key: string;
  isMandatory: boolean;
}

/**
 * Tìm bước đầu tiên chưa upload để tự động mở đúng bước cần làm tiếp.
 * Nếu tất cả đã upload, trả về 0 để người dùng xem lại từ đầu.
 */
export function findInitialPendingStepIndex(
  docs: StepDocumentLike[],
  uploadedKeys: Record<string, boolean>
): number {
  if (!docs || docs.length === 0) return 0;
  const firstPending = docs.findIndex((d) => !uploadedKeys[d.key]);
  return firstPending >= 0 ? firstPending : 0;
}

/**
 * Kiểm tra người dùng có được phép chuyển sang bước targetIndex hay không:
 * - Luôn cho phép quay lại bước trước hoặc bước hiện tại.
 * - Muốn đi tiếp vượt qua bước i thì bước i phải đã upload thành công HOẶC là bước tùy chọn.
 */
export function canNavigateToProofStep(
  targetIndex: number,
  docs: StepDocumentLike[],
  uploadedKeys: Record<string, boolean>,
  skippedKeys: Record<string, boolean> = {}
): boolean {
  if (targetIndex < 0 || targetIndex >= docs.length) return false;
  for (let i = 0; i < targetIndex; i++) {
    const doc = docs[i];
    if (doc.isMandatory && !uploadedKeys[doc.key]) {
      return false;
    }
    if (!doc.isMandatory && !uploadedKeys[doc.key] && !skippedKeys[doc.key]) {
      // Cho phép đi qua chứng từ tùy chọn khi người dùng bấm Bỏ qua hoặc chọn bước sau
      continue;
    }
  }
  return true;
}

/**
 * Kiểm tra toàn bộ các chứng từ bắt buộc trên màn đã được upload thành công hay chưa.
 */
export function areAllMandatoryStepsUploaded(
  docs: StepDocumentLike[],
  uploadedKeys: Record<string, boolean>,
  isServerProfileComplete = false
): boolean {
  if (isServerProfileComplete) return true;
  const mandatory = docs.filter((d) => d.isMandatory);
  if (mandatory.length === 0) return true;
  return mandatory.every((d) => Boolean(uploadedKeys[d.key]));
}
