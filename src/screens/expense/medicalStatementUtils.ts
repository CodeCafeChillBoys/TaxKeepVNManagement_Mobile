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

const REASON_LABELS: Record<string, string> = {
  IN_COVERAGE_COPAY: 'Phần đồng chi trả BHYT',
  TREATMENT_EXPENSE_SELF_PAY: 'Chi phí điều trị tự trả',
  EXCLUDED_COSMETIC_SURGERY: 'Phẫu thuật thẩm mỹ',
  EXCLUDED_SKIN_CARE_SPA: 'Chăm sóc da, spa',
  EXCLUDED_FUNCTIONAL_FOOD: 'Thực phẩm chức năng',
  EXCLUDED_VIP_ROOM: 'Phòng dịch vụ theo yêu cầu',
  NEED_REVIEW_UNREADABLE: 'Không đọc rõ, cần kiểm tra lại',
};

export const getDeductionReasonLabel = (code?: string | null) =>
  code ? REASON_LABELS[code.trim().toUpperCase()] || code : '';

const ERROR_LABELS: Record<string, string> = {
  ERR_NOT_MEDICAL_STATEMENT: 'Tệp tải lên không phải bảng kê chi phí khám chữa bệnh.',
  ERR_MEDICAL_STATEMENT_NO_LINES: 'Không đọc được dòng chi phí nào trên bảng kê. Vui lòng chụp rõ hơn.',
};

/** BE trả lẫn mã lỗi và câu tiếng Việt: mã thì dịch, câu thì giữ nguyên */
export const getStatementErrorLabel = (err: string) => ERROR_LABELS[err.trim()] || err;

export function summarizeStatementLines(lines: MedicalStatementLine[] = []) {
  return lines.reduce(
    (acc, l) => {
      if (l.isEligibleDeduction) {
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
