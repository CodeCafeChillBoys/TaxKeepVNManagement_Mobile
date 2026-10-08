/**
 * Giải trình kết quả quyết toán cho người dùng / hội đồng — logic thuần, không phụ thuộc RN.
 * Dữ liệu lấy từ TaxSettlementPreview do BE trả; FE chỉ diễn giải lại, không tính thuế khác BE.
 */
import { BracketCalculationDetail } from '../../types/taxSettlement';

export type BracketBreakdownRow = {
  bracketNo: number;
  fromMonthly: number;
  toMonthly: number | null;
  rate: number;
  /** Phần thu nhập tính thuế/tháng rơi vào bậc này */
  portion: number;
  /** Thuế/tháng của riêng phần đó */
  tax: number;
};

/**
 * Lũy tiến từng phần (giống tiền điện): phần thu nhập trong khoảng của bậc nào thì nhân thuế suất bậc đó.
 * Kết quả bằng công thức rút gọn BE đang dùng (TNTT × thuế suất − số trừ nhanh).
 */
export function computeBracketBreakdown(
  taxableMonthly: number,
  brackets: BracketCalculationDetail[]
): { rows: BracketBreakdownRow[]; totalMonthly: number } {
  if (!(taxableMonthly > 0)) return { rows: [], totalMonthly: 0 };

  const rows: BracketBreakdownRow[] = [...brackets]
    .sort((a, b) => a.fromMonthly - b.fromMonthly)
    .map((b) => {
      const upper = b.toMonthly == null ? taxableMonthly : Math.min(taxableMonthly, b.toMonthly);
      const portion = Math.max(0, upper - b.fromMonthly);
      return {
        bracketNo: b.bracketNo,
        fromMonthly: b.fromMonthly,
        toMonthly: b.toMonthly,
        rate: b.rate,
        portion,
        tax: Math.round(portion * b.rate),
      };
    })
    .filter((r) => r.portion > 0);

  return { rows, totalMonthly: rows.reduce((sum, r) => sum + r.tax, 0) };
}

/** "YYYY-MM" .. "YYYY-MM" → "MM/YYYY – MM/YYYY" giới hạn trong năm tính thuế; ngoài năm / sai định dạng → null. */
export function clampMonthRangeToYear(from: string, to: string, taxYear: number): string | null {
  const parse = (s: string) => {
    const m = /^(\d{4})-(\d{1,2})$/.exec(String(s ?? '').trim());
    return m ? { year: Number(m[1]), month: Number(m[2]) } : null;
  };
  const f = parse(from);
  const t = parse(to);
  if (!f || !t) return null;

  const startMonth = f.year < taxYear ? 1 : f.year === taxYear ? f.month : 13;
  const endMonth = t.year > taxYear ? 12 : t.year === taxYear ? t.month : 0;
  if (startMonth > endMonth) return null;

  const mm = (n: number) => String(n).padStart(2, '0');
  return `${mm(startMonth)}/${taxYear} – ${mm(endMonth)}/${taxYear}`;
}

const RELATIONSHIP_LABELS: Record<string, string> = {
  CHILD: 'Con',
  SPOUSE: 'Vợ/chồng',
  PARENT: 'Cha/mẹ',
  OTHER_DEPENDENT: 'Người khác đang nuôi dưỡng',
};

export function relationshipLabel(relationship: string): string {
  return RELATIONSHIP_LABELS[relationship] ?? relationship;
}

/** Chú thích viết tắt hiển thị cuối màn hình quyết toán. */
export const SETTLEMENT_GLOSSARY: { term: string; meaning: string }[] = [
  { term: 'TNTT', meaning: 'Thu nhập tính thuế = Tổng thu nhập chịu thuế − Tổng các khoản giảm trừ.' },
  { term: 'NPT', meaning: 'Người phụ thuộc đã đăng ký giảm trừ gia cảnh (con, vợ/chồng, cha/mẹ…).' },
  { term: 'Giảm trừ gia cảnh', meaning: 'Khoản trừ cho bản thân người nộp thuế và cho mỗi NPT, tính theo số tháng.' },
  { term: 'BHXH, BHYT, BHTN', meaning: 'Bảo hiểm xã hội, y tế, thất nghiệp bắt buộc — số tiền do tổ chức chi trả đã trích, được trừ khỏi thu nhập.' },
  { term: 'Thuế khấu trừ', meaning: 'Thuế TNCN tổ chức chi trả đã tạm khấu trừ trong năm, dùng để so với số thuế phải nộp.' },
  { term: 'Lũy tiến từng phần', meaning: 'Mỗi phần thu nhập nằm trong khoảng của bậc nào thì chịu thuế suất bậc đó, giống cách tính tiền điện.' },
];
