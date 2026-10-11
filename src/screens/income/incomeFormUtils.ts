/**
 * Logic thuần cho form thu nhập theo tháng (không phụ thuộc React Native) — dễ test.
 */
import {
  IncomeCompanyGroup,
  IncomeMonthItem,
  IncomeUpsertRequest,
  PayslipOcrData,
} from '../../types/income';

/** Giá trị form luôn là chuỗi (đúng như ô nhập); chuyển sang số khi gửi API. */
export type IncomeFormValues = {
  organizationName: string;
  taxIdNumber: string;
  month: string;
  year: string;
  totalTaxableIncome: string;
  insuranceDeducted: string;
  taxAlreadyDeducted: string;
  payslipFileUrl: string | null;
};

export type IncomeFormField = Exclude<keyof IncomeFormValues, 'payslipFileUrl'>;
export type IncomeFormErrors = Partial<Record<IncomeFormField, string>>;

export function emptyIncomeForm(year: number, month?: number): IncomeFormValues {
  return {
    organizationName: '',
    taxIdNumber: '',
    month: month ? String(month) : '',
    year: String(year),
    totalTaxableIncome: '',
    insuranceDeducted: '',
    taxAlreadyDeducted: '',
    payslipFileUrl: null,
  };
}

// ── Tiền ──────────────────────────────────────────────────────────────────────

/** "30.000.000 đ" → 30000000; ô trống / không có chữ số → null. */
export function parseMoney(text: string): number | null {
  const digits = String(text ?? '').replace(/\D/g, '');
  return digits === '' ? null : Number(digits);
}

/** Định dạng khi gõ: chỉ giữ chữ số, nhóm hàng nghìn bằng dấu chấm. */
export function formatMoneyInput(text: string): string {
  const digits = String(text ?? '').replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function moneyToInput(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '';
  return formatMoneyInput(String(Math.round(Number(n))));
}

// ── Kiểm tra ──────────────────────────────────────────────────────────────────

function intInRange(s: string, min: number, max: number): boolean {
  const t = String(s ?? '').trim();
  if (!/^\d+$/.test(t)) return false;
  const n = Number(t);
  return n >= min && n <= max;
}

export function validateIncomeForm(v: IncomeFormValues): IncomeFormErrors {
  const e: IncomeFormErrors = {};
  if (!v.organizationName.trim()) e.organizationName = 'Vui lòng nhập tên tổ chức chi trả.';
  const tax = v.taxIdNumber.trim();
  if (tax && !/^\d{10}(-\d{3})?$/.test(tax)) {
    e.taxIdNumber = 'Mã số thuế gồm 10 chữ số (hoặc 10 số kèm "-" và 3 số chi nhánh).';
  }
  if (!intInRange(v.month, 1, 12)) e.month = 'Tháng phải từ 1 đến 12.';
  if (!intInRange(v.year, 2000, 2100)) e.year = 'Năm phải gồm 4 chữ số.';
  if (parseMoney(v.totalTaxableIncome) == null) e.totalTaxableIncome = 'Vui lòng nhập thu nhập chịu thuế.';
  if (parseMoney(v.insuranceDeducted) == null) e.insuranceDeducted = 'Vui lòng nhập bảo hiểm đã trích (không có thì nhập 0).';
  return e;
}

// ── Chuyển đổi ────────────────────────────────────────────────────────────────

export function toIncomeRequest(v: IncomeFormValues): IncomeUpsertRequest {
  return {
    organizationName: v.organizationName.trim(),
    taxIdNumber: v.taxIdNumber.trim() || null,
    month: Number(v.month),
    year: Number(v.year),
    totalTaxableIncome: parseMoney(v.totalTaxableIncome) ?? 0,
    insuranceDeducted: parseMoney(v.insuranceDeducted) ?? 0,
    taxAlreadyDeducted: parseMoney(v.taxAlreadyDeducted) ?? 0,
    payslipFileUrl: v.payslipFileUrl || null,
  };
}

export function fromIncomeItem(item: IncomeMonthItem): IncomeFormValues {
  return {
    organizationName: item.organizationName ?? '',
    taxIdNumber: item.taxIdNumber ?? '',
    month: String(item.month),
    year: String(item.year),
    totalTaxableIncome: moneyToInput(item.totalTaxableIncome),
    insuranceDeducted: moneyToInput(item.insuranceDeducted),
    taxAlreadyDeducted: moneyToInput(item.taxAlreadyDeducted),
    payslipFileUrl: item.payslipFileUrl ?? null,
  };
}

/** Điền form từ kết quả OCR; tháng/năm OCR không hợp lệ thì giữ tháng/năm người dùng đã chọn. */
export function fromPayslipOcr(
  data: PayslipOcrData,
  fallback: { month?: number; year: number }
): IncomeFormValues {
  const month = data.month >= 1 && data.month <= 12 ? data.month : fallback.month;
  const year = data.year >= 2000 && data.year <= 2100 ? data.year : fallback.year;
  return {
    organizationName: data.organizationName ?? '',
    taxIdNumber: data.taxIdNumber ?? '',
    month: month ? String(month) : '',
    year: String(year),
    totalTaxableIncome: moneyToInput(data.totalTaxableIncome),
    insuranceDeducted: moneyToInput(data.insuranceDeducted),
    taxAlreadyDeducted: moneyToInput(data.taxAlreadyDeducted),
    payslipFileUrl: data.payslipFileUrl ?? null,
  };
}

const normalizeFieldKey = (s: string) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** AI có thể trả tên trường camelCase hoặc snake_case. */
export function isLowConfidence(field: IncomeFormField, lowConfidenceFields: string[] | null | undefined): boolean {
  const key = normalizeFieldKey(field);
  return (lowConfidenceFields ?? []).some((f) => normalizeFieldKey(f) === key);
}

// ── Trùng tháng (BE chưa chặn) ────────────────────────────────────────────────

const sameText = (a?: string | null, b?: string | null) =>
  String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();

/** Tìm bản ghi cùng tổ chức + tháng + năm (so MST nếu cả hai có, ngược lại so tên). Bỏ qua bản ghi đang sửa. */
export function findDuplicateMonth(
  groups: IncomeCompanyGroup[],
  v: IncomeFormValues,
  editingId?: string
): IncomeMonthItem | null {
  const month = Number(v.month);
  const year = Number(v.year);
  const tax = v.taxIdNumber.trim();
  for (const g of groups) {
    for (const d of g.details) {
      if (d.id === editingId || d.month !== month || d.year !== year) continue;
      const sameOrg = tax && d.taxIdNumber ? sameText(tax, d.taxIdNumber) : sameText(v.organizationName, d.organizationName);
      if (sameOrg) return d;
    }
  }
  return null;
}

// ── Lỗi API ───────────────────────────────────────────────────────────────────

/** Thông báo lỗi dễ đọc; bóc message của AI nằm trong chuỗi "AI Service trả về lỗi: {json}". */
export function extractApiErrorMessage(err: unknown, fallback: string): string {
  if (!err || typeof err !== 'object') return fallback;
  const e = err as { response?: { data?: { message?: string } }; message?: string };

  const beMessage = e.response?.data?.message;
  if (beMessage) {
    const jsonStart = beMessage.indexOf('{');
    if (jsonStart >= 0) {
      try {
        const inner = JSON.parse(beMessage.slice(jsonStart));
        return inner?.errors?.[0]?.message || inner?.message || fallback;
      } catch {
        // Không phải JSON hợp lệ → dùng nguyên câu của BE
      }
    }
    return beMessage;
  }

  if (!e.response && e.message === 'Network Error') {
    return 'Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.';
  }
  return e.message || fallback;
}
