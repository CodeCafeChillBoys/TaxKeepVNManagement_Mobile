import { MedicalStatement, MedicalStatementLine } from '../../types/expense';

/** Mã loại chứng từ của hóa đơn viện phí mẹ (BE: DocumentTypeCodes.MedicalReceipt) */
export const MEDICAL_RECEIPT_CODE = 'MEDICAL_RECEIPT';

export const MAX_STATEMENT_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.pdf'];

export const isMedicalReceipt = (docTypeCode?: string | null) =>
  (docTypeCode || '').trim().toUpperCase() === MEDICAL_RECEIPT_CODE;

/** Trùng với kiểm tra của BE (đuôi tệp + 10MB) để báo lỗi trước khi gửi */
export function validateStatementFile(file: { name?: string; size?: number | null }): string | null {
  const name = (file.name || '').toLowerCase();
  if (!ALLOWED_EXT.some((ext) => name.endsWith(ext))) {
    return 'Chỉ nhận ảnh JPG, PNG hoặc tệp PDF.';
  }
  if (file.size != null && file.size > MAX_STATEMENT_SIZE) {
    return 'Tệp vượt quá 10MB. Vui lòng chụp lại hoặc nén tệp.';
  }
  return null;
}

export const isStatementProcessing = (s?: MedicalStatement | null) => s?.status === 'UPLOADED';

/**
 * Hiển thị ảnh bảng kê chi phí KCB sau khi tải lên và AI bóc tách thành công (EXTRACTED hoặc CONFIRMED).
 */
export const shouldShowMedicalStatementImage = (s?: MedicalStatement | null): boolean =>
  Boolean(s?.fileUrl && (s.status === 'EXTRACTED' || s.status === 'CONFIRMED'));

export function getStatementStatusMeta(status?: string | null): {
  label: string;
  variant: 'success' | 'warning' | 'destructive' | 'secondary';
} {
  switch (status) {
    case 'UPLOADED':
      return { label: 'AI đang bóc tách', variant: 'secondary' };
    case 'EXTRACTED':
      return { label: 'Đã bóc tách', variant: 'warning' };
    case 'CONFIRMED':
      return { label: 'Đã xác nhận', variant: 'success' };
    case 'FAILED':
      return { label: 'Không hợp lệ', variant: 'destructive' };
    default:
      return { label: 'Chưa tải bảng kê', variant: 'secondary' };
  }
}

const VIETNAMESE_CHAR_REGEX =
  /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

const REASON_LABELS: Record<string, string> = {
  // Hợp lệ giảm trừ (BE MedicalDeductionReason + AI medical_statement_prompt.py)
  IN_COVERAGE_COPAY: 'Phần đồng chi trả trong phạm vi BHYT',
  TREATMENT_EXPENSE_SELF_PAY: 'Chi phí khám chữa bệnh tự chi trả hợp lệ',

  // Loại trừ — ngoài phạm vi BHYT (AI medical_statement_prompt.py mục 7a)
  OUT_OF_COVERAGE: 'Chi phí ngoài phạm vi thanh toán BHYT (không được giảm trừ)',
  EXCLUDED_OUT_OF_COVERAGE: 'Chi phí ngoài phạm vi thanh toán BHYT (không được giảm trừ)',
  OUT_OF_INSURANCE_COVERAGE: 'Chi phí ngoài phạm vi thanh toán BHYT (không được giảm trừ)',

  // Loại trừ — thẩm mỹ, làm đẹp (BE MedicalDeductionReason + AI prompt)
  EXCLUDED_COSMETIC_SURGERY: 'Phẫu thuật thẩm mỹ, làm đẹp (không được giảm trừ)',
  EXCLUDED_COSMETIC: 'Dịch vụ thẩm mỹ, làm đẹp (không được giảm trừ)',
  COSMETIC_SURGERY: 'Phẫu thuật thẩm mỹ, làm đẹp (không được giảm trừ)',
  EXCLUDED_BEAUTY: 'Dịch vụ thẩm mỹ, làm đẹp (không được giảm trừ)',
  EXCLUDED_BEAUTY_SERVICE: 'Dịch vụ thẩm mỹ, làm đẹp (không được giảm trừ)',
  EXCLUDED_AESTHETIC: 'Dịch vụ thẩm mỹ, làm đẹp (không được giảm trừ)',
  EXCLUDED_ESTHETIC: 'Dịch vụ thẩm mỹ, làm đẹp (không được giảm trừ)',
  EXCLUDED_DENTAL_COSMETIC: 'Nha khoa thẩm mỹ (không được giảm trừ)',
  EXCLUDED_COSMETIC_DENTAL: 'Nha khoa thẩm mỹ (không được giảm trừ)',

  // Loại trừ — chăm sóc da, spa
  EXCLUDED_SKIN_CARE_SPA: 'Chăm sóc da, spa làm đẹp (không được giảm trừ)',
  EXCLUDED_SKIN_CARE: 'Chăm sóc da, spa làm đẹp (không được giảm trừ)',
  EXCLUDED_SPA: 'Chăm sóc da, spa làm đẹp (không được giảm trừ)',
  SKIN_CARE_SPA: 'Chăm sóc da, spa làm đẹp (không được giảm trừ)',

  // Loại trừ — thực phẩm chức năng, bồi bổ
  EXCLUDED_FUNCTIONAL_FOOD: 'Thực phẩm chức năng, bồi bổ (không được giảm trừ)',
  FUNCTIONAL_FOOD: 'Thực phẩm chức năng, bồi bổ (không được giảm trừ)',
  EXCLUDED_SUPPLEMENT: 'Thực phẩm chức năng, sản phẩm bổ sung (không được giảm trừ)',
  EXCLUDED_HEALTH_SUPPLEMENT: 'Thực phẩm chức năng, sản phẩm bổ sung (không được giảm trừ)',
  EXCLUDED_NUTRITION: 'Sản phẩm dinh dưỡng, bồi bổ (không được giảm trừ)',
  EXCLUDED_VITAMIN: 'Vitamin, thực phẩm chức năng (không được giảm trừ)',

  // Loại trừ — phòng dịch vụ, tiện ích tự chọn
  EXCLUDED_VIP_ROOM: 'Phòng dịch vụ, tiện ích tự chọn (không được giảm trừ)',
  VIP_ROOM: 'Phòng dịch vụ, tiện ích tự chọn (không được giảm trừ)',
  EXCLUDED_SERVICE_ROOM: 'Phòng dịch vụ, giường theo yêu cầu (không được giảm trừ)',
  EXCLUDED_ROOM_UPGRADE: 'Phụ thu phòng dịch vụ theo yêu cầu (không được giảm trừ)',
  EXCLUDED_PERSONAL_AMENITY: 'Tiện ích cá nhân tự chọn (không được giảm trừ)',
  EXCLUDED_AMENITY: 'Tiện ích cá nhân tự chọn (không được giảm trừ)',
  EXCLUDED_UTILITY: 'Dịch vụ tiện ích ngoài khám chữa bệnh (không được giảm trừ)',

  // Loại trừ — mờ / không đủ căn cứ (BE MedicalDeductionReason + AI prompt)
  EXCLUDED_UNREADABLE: 'Chữ mờ hoặc thiếu thông tin, không đủ căn cứ giảm trừ',
  NEED_REVIEW_UNREADABLE: 'Thông tin mờ, không đọc rõ để xác minh giảm trừ',
  UNREADABLE: 'Thông tin mờ, không đọc rõ để xác minh giảm trừ',
  EXCLUDED_INSUFFICIENT_EVIDENCE: 'Thiếu thông tin căn cứ hợp lệ để tính giảm trừ',

  // Loại trừ — tự trả / ngoài danh mục y tế
  EXCLUDED_SELF_PAY: 'Phần chi phí tự trả ngoài danh mục được giảm trừ',
  SELF_PAY_OUT_OF_COVERAGE: 'Phần chi phí tự trả ngoài phạm vi BHYT',
  SELF_PAY_NOT_ELIGIBLE: 'Phần chi phí tự trả không đủ điều kiện giảm trừ',
  EXCLUDED_NON_MEDICAL: 'Không thuộc chi phí khám bệnh, chữa bệnh theo quy định',
  NON_MEDICAL: 'Không thuộc chi phí khám bệnh, chữa bệnh theo quy định',
  EXCLUDED_OTHER: 'Không thuộc danh mục chi phí y tế được giảm trừ thuế',
  EXCLUDED: 'Không thuộc danh mục chi phí y tế được giảm trừ thuế',
  NOT_ELIGIBLE: 'Không thuộc danh mục chi phí y tế được giảm trừ thuế',
  INELIGIBLE: 'Không thuộc danh mục chi phí y tế được giảm trừ thuế',
};

const normalizeCodeKey = (raw: string) =>
  raw
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');

function inferDeductionReasonFromCode(upperKey: string): string | null {
  if (REASON_LABELS[upperKey]) return REASON_LABELS[upperKey];
  if (/(COSMETIC|BEAUTY|AESTHETIC|ESTHETIC|PLASTIC|FILLER|BOTOX)/.test(upperKey)) {
    return 'Dịch vụ thẩm mỹ, làm đẹp (không được giảm trừ)';
  }
  if (/(SPA|SKIN_CARE|SKINCARE)/.test(upperKey)) {
    return 'Chăm sóc da, spa làm đẹp (không được giảm trừ)';
  }
  if (/(FUNCTIONAL_FOOD|SUPPLEMENT|VITAMIN|NUTRITION|TONIC)/.test(upperKey)) {
    return 'Thực phẩm chức năng, bồi bổ (không được giảm trừ)';
  }
  if (/(VIP|ROOM|BED|AMENITY|UTILITY|MEAL|PARKING)/.test(upperKey)) {
    return 'Phòng dịch vụ, tiện ích tự chọn (không được giảm trừ)';
  }
  if (/(UNREADABLE|BLUR|UNCLEAR|ILLEGIBLE|LOW_CONFIDENCE)/.test(upperKey)) {
    return 'Chữ mờ hoặc không đọc rõ để xác minh giảm trừ';
  }
  if (/(OUT_OF_COVERAGE|NON_COVERED|NOT_COVERED|OUT_OF_BHYT|OUT_OF_INSURANCE)/.test(upperKey)) {
    return 'Chi phí ngoài phạm vi thanh toán BHYT (không được giảm trừ)';
  }
  if (/(DENTAL)/.test(upperKey)) {
    return 'Dịch vụ nha khoa thẩm mỹ (không được giảm trừ)';
  }
  if (/(NON_MEDICAL|NOT_MEDICAL|NON_TREATMENT)/.test(upperKey)) {
    return 'Không thuộc chi phí khám bệnh, chữa bệnh theo quy định';
  }
  if (/(SELF_PAY)/.test(upperKey) && upperKey.startsWith('EXCLUDED')) {
    return 'Phần chi phí tự trả ngoài danh mục được giảm trừ';
  }
  if (/(IN_COVERAGE|COPAY)/.test(upperKey)) {
    return 'Phần đồng chi trả trong phạm vi BHYT';
  }
  if (/(TREATMENT)/.test(upperKey) && !upperKey.startsWith('EXCLUDED')) {
    return 'Chi phí khám chữa bệnh tự chi trả hợp lệ';
  }
  if (upperKey.startsWith('EXCLUDED') || upperKey.includes('NOT_ELIGIBLE') || upperKey.includes('INELIGIBLE')) {
    return 'Không thuộc danh mục chi phí y tế được giảm trừ thuế';
  }
  return null;
}

export function isLineExcluded(
  line?: Pick<MedicalStatementLine, 'isEligibleDeduction' | 'deductionStatus'> | null
): boolean {
  if (!line) return false;
  return !line.isEligibleDeduction || String(line.deductionStatus || '').trim().toUpperCase() === 'EXCLUDED';
}

/**
 * Chuyển đổi mã/chuỗi lý do phân loại giảm trừ (deductionReason từ BE & AI) sang tiếng Việt thân thiện,
 * không bao giờ hiển thị mã tiếng Anh dạng UPPER_SNAKE_CASE lên giao diện.
 */
export function getDeductionReasonLabel(
  code?: string | null,
  line?: Pick<MedicalStatementLine, 'isEligibleDeduction' | 'deductionStatus' | 'patientCoPay' | 'patientSelfPay'> | null
): string {
  const excluded = isLineExcluded(line);
  const raw = (code || '').trim();

  if (!raw) {
    if (!excluded) return '';
    if ((line?.patientSelfPay || 0) > 0 && (line?.patientCoPay || 0) === 0) {
      return 'Chi phí tự trả ngoài danh mục được giảm trừ thuế';
    }
    return 'Không thuộc danh mục chi phí y tế được giảm trừ thuế';
  }

  // 1. Khớp trực tiếp theo mã chuẩn (hoặc suy luận theo nhóm mã)
  const upperKey = normalizeCodeKey(raw);
  if (REASON_LABELS[upperKey]) {
    return REASON_LABELS[upperKey];
  }

  // 2. Xử lý chuỗi ghép dạng "CODE: giải thích" hoặc "CODE - giải thích"
  const compoundMatch = raw.match(/^([A-Z0-9_]{3,})\s*[:\-–]\s*(.+)$/i);
  if (compoundMatch) {
    const [, prefixRaw, suffixRaw] = compoundMatch;
    const prefixKey = normalizeCodeKey(prefixRaw);
    const mappedPrefix = inferDeductionReasonFromCode(prefixKey);
    const suffix = suffixRaw.trim();
    if (mappedPrefix) {
      if (VIETNAMESE_CHAR_REGEX.test(suffix) && !suffix.toLowerCase().includes(mappedPrefix.toLowerCase())) {
        return `${mappedPrefix}: ${suffix}`;
      }
      return mappedPrefix;
    }
    if (VIETNAMESE_CHAR_REGEX.test(suffix)) {
      return suffix;
    }
  }

  // 3. Nếu BE/AI đã trả câu tiếng Việt có dấu -> thay thế mã tiếng Anh nhúng bên trong (nếu có) và giữ nguyên câu
  if (VIETNAMESE_CHAR_REGEX.test(raw)) {
    return raw.replace(/\b[A-Z][A-Z0-9_]{2,}\b/g, (token) => REASON_LABELS[token] || token);
  }

  // 4. Suy luận theo từ khóa từ mã tiếng Anh
  const inferred = inferDeductionReasonFromCode(upperKey);
  if (inferred) {
    return inferred;
  }

  // 5. Fallback an toàn hoàn toàn tiếng Việt
  if (line && !excluded) {
    return 'Chi phí khám chữa bệnh hợp lệ';
  }
  return 'Không thuộc danh mục chi phí y tế được giảm trừ thuế';
}

const DEPENDENT_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Bản nháp',
  PENDING: 'Đang chờ duyệt',
  PENDING_REVIEW: 'Đang chờ duyệt',
  PENDING_DOCUMENTS: 'Thiếu giấy tờ minh chứng',
  INACTIVE: 'Chưa kích hoạt',
  EXPIRED: 'Đã hết hiệu lực',
  REJECTED: 'Bị từ chối',
  ACTIVE: 'Đang hoạt động',
};

const ERROR_LABELS: Record<string, string> = {
  // BE DocumentOcrConsumerBackgroundService.cs
  ERR_NOT_MEDICAL_STATEMENT: 'Tệp tải lên không phải bảng kê chi phí khám bệnh, chữa bệnh (Mẫu 01/KBCB).',
  ERR_MEDICAL_STATEMENT_NO_LINES: 'Không đọc được dòng chi phí nào trên bảng kê. Vui lòng chụp lại rõ nét hơn.',

  // BE MedicalCrossCheckIssue.cs
  PATIENT_NAME_MISMATCH: 'Họ tên người bệnh trên bảng kê không trùng khớp với hóa đơn viện phí.',
  PATIENT_IDCARD_MISMATCH: 'Số CCCD/CMND người bệnh trên bảng kê không trùng khớp với hóa đơn viện phí.',
  TOTAL_AMOUNT_MISMATCH: 'Số tiền người bệnh thực trả trên bảng kê không khớp với tổng tiền trên hóa đơn viện phí.',
  SERVICE_ITEM_MISMATCH: 'Mục khám/dịch vụ trên hóa đơn viện phí không tìm thấy mục tương ứng trên bảng kê.',
  PATIENT_NOT_TAXPAYER_OR_DEPENDENT:
    'Người bệnh trên bảng kê không phải Người nộp thuế hoặc Người phụ thuộc hợp lệ (Khoản 3b Điều 49 NĐ 253/2026/NĐ-CP).',

  // AI Service expense_ocr_service.py (check_medical_statement_amounts)
  UNKNOWN_SECTION: 'Có dòng chi phí không xác định được nhóm mục trên bảng kê.',
  LINE_SUM_MISMATCH: 'Tổng tiền trên một số dòng chi phí không khớp với các cột thanh toán.',
  SUMMARY_MISMATCH: 'Số liệu tổng kết trên bảng kê không khớp với tổng các dòng chi phí chi tiết.',

  // BE TaxPeriodService.MedicalStatement.cs & ErrorConstants.cs
  ERR_NOT_MEDICAL_RECEIPT: 'Chỉ có thể tải bảng kê cho hóa đơn thuộc loại Hóa đơn viện phí.',
  ERR_MEDICAL_STATEMENT_TYPE_NOT_CONFIGURED:
    'Hệ thống chưa cấu hình loại chứng từ bảng kê chi phí KCB. Vui lòng liên hệ quản trị viên.',
  ERR_NOT_TAX_DOCUMENT: 'Tệp tải lên không được nhận diện là bảng kê hoặc chứng từ y tế hợp lệ.',
  NOT_TAX_DOCUMENT: 'Tệp tải lên không được nhận diện là bảng kê hoặc chứng từ y tế hợp lệ.',
  ERR_INVALID_DOC_TYPE: 'Loại chứng từ này không thuộc danh mục được giảm trừ thuế TNCN theo quy định.',
  INVALID_DOC_TYPE: 'Loại chứng từ này không thuộc danh mục được giảm trừ thuế TNCN theo quy định.',
  DOC_TYPE_MISMATCH: 'Loại chứng từ tải lên không đúng định dạng bảng kê chi phí KCB.',
  ERR_YEAR_MISMATCH: 'Năm trên bảng kê không khớp với kỳ tính thuế đang kê khai.',
  ERR_FUTURE_DATE: 'Ngày khám hoặc ngày lập bảng kê không được lớn hơn ngày hiện tại.',
  ERR_NO_FIELDS_EXTRACTED: 'Không trích xuất được thông tin nào từ bảng kê. Vui lòng chụp lại rõ nét hơn.',
  ERR_IMAGE_QUALITY_TOO_LOW:
    'Chất lượng ảnh quá mờ hoặc lóa sáng, không thể đọc chính xác bảng kê. Vui lòng chụp lại rõ nét hơn.',
  ERR_IMAGE_QUALITY_LOW:
    'Chất lượng ảnh quá mờ hoặc lóa sáng, không thể đọc chính xác bảng kê. Vui lòng chụp lại rõ nét hơn.',
  ERR_UNREADABLE_IMAGE: 'Hình ảnh quá mờ hoặc không rõ chữ. Vui lòng chụp lại bảng kê đầy đủ 4 góc.',
  ERR_UNREADABLE: 'Không thể đọc được nội dung bảng kê. Vui lòng chụp lại rõ nét hơn.',
  UNREADABLE_IMAGE: 'Hình ảnh quá mờ hoặc không rõ chữ. Vui lòng chụp lại bảng kê rõ nét hơn.',
  ERR_CORRUPTED_FILE: 'Tệp bảng kê bị hỏng hoặc định dạng không hợp lệ. Vui lòng chọn tệp khác.',
  ERR_INVALID_FILE: 'Tệp bảng kê không hợp lệ. Vui lòng kiểm tra và tải lại.',
  INVALID_FILE: 'Tệp bảng kê không hợp lệ. Vui lòng kiểm tra và tải lại.',
  ERR_INVALID_STATUS: 'Hóa đơn hoặc bảng kê đã được xác nhận nên không thể chỉnh sửa hoặc tải đè.',
  ERR_DUPLICATE_DOCUMENT: 'Hóa đơn này đã có bảng kê. Vui lòng xóa bảng kê cũ trước khi tải bảng mới.',
  DUPLICATE_DOCUMENT: 'Hóa đơn này đã có bảng kê. Vui lòng xóa bảng kê cũ trước khi tải bảng mới.',
  ERR_IDENTITY_MISMATCH: 'Thông tin người bệnh trên bảng kê không khớp với người nộp thuế hoặc người phụ thuộc.',
  IDENTITY_MISMATCH: 'Thông tin người bệnh trên bảng kê không khớp với người nộp thuế hoặc người phụ thuộc.',
  ERR_TAX_PERIOD_LOCKED: 'Kỳ tính thuế này đã nộp quyết toán và bị khóa, không thể chỉnh sửa.',
  FILES_REQUIRED: 'Vui lòng chọn hoặc chụp ảnh bảng kê chi phí KCB trước khi tải lên.',
  UNSUPPORTED_FORMAT: 'Định dạng tệp không hợp lệ. Chỉ chấp nhận ảnh JPG, PNG hoặc tệp PDF.',
  FILE_SIZE_EXCEEDED: 'Dung lượng tệp vượt quá 10MB. Vui lòng chọn tệp nhỏ hơn.',
  OCR_QUOTA_EXCEEDED: 'Bạn đã hết lượt quét OCR trong gói hiện tại. Vui lòng nâng cấp gói để tiếp tục.',
  QUOTA_EXCEEDED: 'Bạn đã hết lượt quét OCR trong gói hiện tại. Vui lòng nâng cấp gói để tiếp tục.',
  ERR_INTERNAL_SERVER: 'Hệ thống đang tạm gián đoạn khi xử lý bảng kê. Vui lòng thử lại sau.',
  ERR_INTERNAL_AI: 'Hệ thống AI gặp sự cố khi bóc tách bảng kê. Vui lòng thử lại sau.',
  ERR_SYSTEM: 'Hệ thống đang tạm gián đoạn khi xử lý bảng kê. Vui lòng thử lại sau.',
  ERR_AI_API: 'Hệ thống AI đang tạm bận. Vui lòng thử tải lại bảng kê sau ít phút.',
  ERR_CONSUMER_EXCEPTION: 'Hệ thống gặp sự cố khi tiếp nhận kết quả bóc tách bảng kê. Vui lòng thử lại.',
  AI_CONNECTION_ERROR: 'Không thể kết nối đến hệ thống AI để đọc bảng kê. Vui lòng thử lại sau.',
  AI_SERVICE_ERROR: 'Hệ thống AI gặp lỗi khi phân tích bảng kê. Vui lòng thử lại sau.',
  OCR_SERVICE_ERROR: 'Hệ thống đọc chứng từ gặp lỗi tạm thời. Vui lòng thử lại sau.',
  OCR_EXTRACTION_FAILED: 'Không thể bóc tách nội dung bảng kê. Vui lòng chụp lại rõ nét hơn.',
};

function translateEnglishStatementMessage(raw: string): string | null {
  const lower = raw.toLowerCase();

  // "Document income year is 2025 but filing year is 2026."
  const yearMatch = raw.match(/year is\s*(\d{4}).*?filing year is\s*(\d{4})/i);
  if (yearMatch) {
    return `Năm trên bảng kê (${yearMatch[1]}) không khớp với kỳ tính thuế đang kê khai (${yearMatch[2]}).`;
  }

  if (lower.includes('invoice date cannot be greater than the current date')) {
    return ERROR_LABELS.ERR_FUTURE_DATE;
  }
  if (lower.includes('not recognized as a valid tax document')) {
    return ERROR_LABELS.ERR_NOT_TAX_DOCUMENT;
  }
  if (lower.includes('does not qualify for tax relief') || lower.includes('does not qualify for')) {
    return ERROR_LABELS.ERR_INVALID_DOC_TYPE;
  }
  if (
    lower.includes('image quality is too low') ||
    lower.includes('could not parse the document') ||
    lower.includes('too blurry') ||
    lower.includes('illegible')
  ) {
    return ERROR_LABELS.ERR_IMAGE_QUALITY_TOO_LOW;
  }
  if (lower.includes('parent document must be a medical receipt')) {
    return ERROR_LABELS.ERR_NOT_MEDICAL_RECEIPT;
  }
  if (lower.includes('configure the medical statement document type')) {
    return ERROR_LABELS.ERR_MEDICAL_STATEMENT_TYPE_NOT_CONFIGURED;
  }
  if (lower.includes('medical statement already exists')) {
    return ERROR_LABELS.ERR_DUPLICATE_DOCUMENT;
  }
  if (lower.includes('already been extracted or verified')) {
    return ERROR_LABELS.ERR_INVALID_STATUS;
  }
  if (lower.includes('validation failed for tax document')) {
    return 'Không thể xác thực tính hợp lệ của bảng kê chi phí KCB.';
  }
  if (lower.includes('processing failed')) {
    return ERROR_LABELS.ERR_INTERNAL_AI;
  }
  return null;
}

function humanizeEmbeddedEnums(vietnameseText: string): string {
  // Dịch mã trạng thái hồ sơ NPT bị BE chèn nguyên bản tiếng Anh (VD: trạng thái hồ sơ đang là 'PENDING_DOCUMENTS')
  return vietnameseText
    .replace(
      /['"]([A-Z][A-Z0-9_]{2,})['"]/g,
      (full, token: string) => {
        if (DEPENDENT_STATUS_LABELS[token]) return `'${DEPENDENT_STATUS_LABELS[token]}'`;
        if (ERROR_LABELS[token]) return ERROR_LABELS[token];
        if (REASON_LABELS[token]) return REASON_LABELS[token];
        return full;
      }
    )
    .replace(/\b(PATIENT_NAME_MISMATCH|PATIENT_IDCARD_MISMATCH|TOTAL_AMOUNT_MISMATCH|SERVICE_ITEM_MISMATCH|PATIENT_NOT_TAXPAYER_OR_DEPENDENT|UNKNOWN_SECTION|LINE_SUM_MISMATCH|SUMMARY_MISMATCH|ERR_[A-Z0-9_]+)\b/g, (token) =>
      ERROR_LABELS[token] || token
    );
}

/**
 * Chuyển đổi mọi mã lỗi, thông điệp tiếng Anh từ AI/BE hoặc cảnh báo đối chiếu chéo
 * trên bảng kê KCB sang tiếng Việt rõ ràng, không lộ mã kỹ thuật.
 */
export function getStatementErrorLabel(err?: string | null): string {
  const raw = (err || '').trim();
  if (!raw) return '';

  const upperKey = normalizeCodeKey(raw);
  if (ERROR_LABELS[upperKey]) {
    return ERROR_LABELS[upperKey];
  }

  // Chuỗi dạng "ERR_CODE: chi tiết"
  const compoundMatch = raw.match(/^([A-Z0-9_]{3,})\s*[:\-–]\s*(.+)$/i);
  if (compoundMatch) {
    const [, prefixRaw, suffixRaw] = compoundMatch;
    const mappedPrefix = ERROR_LABELS[normalizeCodeKey(prefixRaw)];
    const suffix = suffixRaw.trim();
    if (mappedPrefix) {
      if (VIETNAMESE_CHAR_REGEX.test(suffix)) {
        return humanizeEmbeddedEnums(suffix);
      }
      return mappedPrefix;
    }
  }

  // Dịch các câu lỗi tiếng Anh cố định từ AI Service / BE
  const translatedEn = translateEnglishStatementMessage(raw);
  if (translatedEn) {
    return translatedEn;
  }

  // Nếu BE đã trả câu tiếng Việt -> chuẩn hóa các mã enum nhúng (như 'DRAFT', 'PENDING_DOCUMENTS')
  if (VIETNAMESE_CHAR_REGEX.test(raw)) {
    return humanizeEmbeddedEnums(raw);
  }

  // Fallback an toàn cho mọi chuỗi tiếng Anh / mã lỗi chưa biết
  return 'Bảng kê có thông tin không hợp lệ hoặc cần kiểm tra lại trước khi xác nhận.';
}

/**
 * Dịch và loại bỏ trùng lặp danh sách lỗi đối chiếu của bảng kê chi phí KCB.
 */
export function normalizeStatementErrors(errors?: string[] | null): string[] {
  if (!Array.isArray(errors) || errors.length === 0) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of errors) {
    const translated = getStatementErrorLabel(item);
    if (translated && !seen.has(translated)) {
      seen.add(translated);
      result.push(translated);
    }
  }
  return result;
}

export function summarizeStatementLines(lines: MedicalStatementLine[] = []) {
  return lines.reduce(
    (acc, l) => {
      if (!isLineExcluded(l)) {
        acc.eligibleAmount += l.eligibleAmount || 0;
        acc.eligibleCount += 1;
      } else {
        acc.excludedAmount += (l.patientCoPay || 0) + (l.patientSelfPay || 0);
        acc.excludedCount += 1;
      }
      return acc;
    },
    { eligibleAmount: 0, eligibleCount: 0, excludedAmount: 0, excludedCount: 0 }
  );
}
