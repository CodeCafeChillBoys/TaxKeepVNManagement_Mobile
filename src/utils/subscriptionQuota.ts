/** Mã lỗi BE trả về khi vượt hạn mức gói (SubscriptionQuotaService) */
export const QUOTA_ERROR_CODES = [
  'AI_QUESTION_QUOTA_EXCEEDED',
  'OCR_QUOTA_EXCEEDED',
  'INCOME_SOURCE_LIMIT_EXCEEDED',
  'DEPENDENT_LIMIT_EXCEEDED',
  'EXPORT_PDF_NOT_ALLOWED',
  'EXPORT_ZIP_NOT_ALLOWED',
] as const;

export type QuotaErrorCode = (typeof QUOTA_ERROR_CODES)[number];

export interface QuotaError {
  code: QuotaErrorCode;
  message: string;
}

const TITLES: Record<QuotaErrorCode, string> = {
  AI_QUESTION_QUOTA_EXCEEDED: 'Hết lượt hỏi trợ lý thuế',
  OCR_QUOTA_EXCEEDED: 'Hết lượt quét chứng từ',
  INCOME_SOURCE_LIMIT_EXCEEDED: 'Đã đủ số nguồn thu nhập',
  DEPENDENT_LIMIT_EXCEEDED: 'Đã đủ số người phụ thuộc',
  EXPORT_PDF_NOT_ALLOWED: 'Gói hiện tại chưa hỗ trợ tải tờ khai',
  EXPORT_ZIP_NOT_ALLOWED: 'Gói hiện tại chưa hỗ trợ tải trọn bộ chứng từ',
};

export function quotaTitle(code: QuotaErrorCode): string {
  return TITLES[code];
}

/** Lỗi axios có phải do vượt hạn mức gói không */
export function quotaErrorFrom(error: any): QuotaError | null {
  const data = error?.response?.data;
  const code = data?.errorCode;
  if (!QUOTA_ERROR_CODES.includes(code)) return null;
  return {
    code,
    message: (typeof data?.message === 'string' && data.message.trim()) || 'Bạn đã dùng hết hạn mức của gói hiện tại.',
  };
}

type Listener = (e: QuotaError) => void;
let listener: Listener | null = null;

/** Một hộp thoại "Nâng cấp gói" dùng chung cho cả app đăng ký ở đây */
export function onQuotaExceeded(fn: Listener): () => void {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}

export function emitQuotaExceeded(e: QuotaError): void {
  listener?.(e);
}
