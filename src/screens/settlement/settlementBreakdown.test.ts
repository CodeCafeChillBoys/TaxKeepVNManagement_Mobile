import {
  computeBracketBreakdown,
  clampMonthRangeToYear,
  relationshipLabel,
} from './settlementBreakdown';
import { BracketCalculationDetail } from '../../types/taxSettlement';

// Biểu 5 bậc 2026 (giống seed PIT_BRACKETS_JSON từ năm 2026)
const brackets2026: BracketCalculationDetail[] = [
  { bracketNo: 1, fromMonthly: 0, toMonthly: 10_000_000, rate: 0.05 },
  { bracketNo: 2, fromMonthly: 10_000_000, toMonthly: 30_000_000, rate: 0.1 },
  { bracketNo: 3, fromMonthly: 30_000_000, toMonthly: 60_000_000, rate: 0.2 },
  { bracketNo: 4, fromMonthly: 60_000_000, toMonthly: 100_000_000, rate: 0.3 },
  { bracketNo: 5, fromMonthly: 100_000_000, toMonthly: null, rate: 0.35 },
].map((b) => ({ ...b, taxableMonthly: 0, taxMonthly: 0, isApplied: false }));

// Số trừ nhanh tương ứng — dùng để đối chiếu công thức rút gọn BE đang dùng
const quickDeduct2026: Record<number, number> = { 1: 0, 2: 500_000, 3: 3_500_000, 4: 9_500_000, 5: 14_500_000 };

function shortcutTax(taxable: number): number {
  const b = [...brackets2026].reverse().find((x) => taxable > x.fromMonthly);
  if (!b) return 0;
  return Math.max(0, Math.round(taxable * b.rate - quickDeduct2026[b.bracketNo]));
}

describe('computeBracketBreakdown', () => {
  it('chia thu nhập vào từng bậc như tiền điện', () => {
    const r = computeBracketBreakdown(11_780_000, brackets2026);
    expect(r.rows).toEqual([
      { bracketNo: 1, fromMonthly: 0, toMonthly: 10_000_000, rate: 0.05, portion: 10_000_000, tax: 500_000 },
      { bracketNo: 2, fromMonthly: 10_000_000, toMonthly: 30_000_000, rate: 0.1, portion: 1_780_000, tax: 178_000 },
    ]);
    expect(r.totalMonthly).toBe(678_000);
  });

  it('tổng các bậc khớp công thức rút gọn ở mọi bậc', () => {
    for (const taxable of [5_000_000, 10_000_000, 25_000_000, 45_000_000, 80_000_000, 150_000_000]) {
      expect(computeBracketBreakdown(taxable, brackets2026).totalMonthly).toBe(shortcutTax(taxable));
    }
  });

  it('thu nhập đúng bằng mốc bậc không sinh dòng bậc kế tiếp', () => {
    const r = computeBracketBreakdown(10_000_000, brackets2026);
    expect(r.rows.map((x) => x.bracketNo)).toEqual([1]);
    expect(r.totalMonthly).toBe(500_000);
  });

  it('bậc cuối không giới hạn', () => {
    const r = computeBracketBreakdown(150_000_000, brackets2026);
    expect(r.rows).toHaveLength(5);
    expect(r.rows[4]).toMatchObject({ bracketNo: 5, portion: 50_000_000, tax: 17_500_000 });
  });

  it('không có thu nhập tính thuế thì không có dòng nào', () => {
    expect(computeBracketBreakdown(0, brackets2026)).toEqual({ rows: [], totalMonthly: 0 });
    expect(computeBracketBreakdown(-5, brackets2026)).toEqual({ rows: [], totalMonthly: 0 });
  });

  it('chịu được biểu thuế không theo thứ tự', () => {
    const shuffled = [...brackets2026].reverse();
    expect(computeBracketBreakdown(11_780_000, shuffled).totalMonthly).toBe(678_000);
  });
});

describe('clampMonthRangeToYear', () => {
  it('giới hạn khoảng tháng trong năm tính thuế', () => {
    expect(clampMonthRangeToYear('2024-05', '2030-12', 2026)).toBe('01/2026 – 12/2026');
    expect(clampMonthRangeToYear('2026-03', '2026-08', 2026)).toBe('03/2026 – 08/2026');
    expect(clampMonthRangeToYear('2025-01', '2026-05', 2026)).toBe('01/2026 – 05/2026');
  });

  it('không nằm trong năm hoặc sai định dạng thì trả null', () => {
    expect(clampMonthRangeToYear('2027-01', '2027-12', 2026)).toBeNull();
    expect(clampMonthRangeToYear('2020-01', '2025-12', 2026)).toBeNull();
    expect(clampMonthRangeToYear('', '2026-12', 2026)).toBeNull();
    expect(clampMonthRangeToYear('abc', '2026-12', 2026)).toBeNull();
  });
});

describe('relationshipLabel', () => {
  it('dịch quan hệ sang tiếng Việt', () => {
    expect(relationshipLabel('CHILD')).toBe('Con');
    expect(relationshipLabel('SPOUSE')).toBe('Vợ/chồng');
    expect(relationshipLabel('PARENT')).toBe('Cha/mẹ');
    expect(relationshipLabel('OTHER_DEPENDENT')).toBe('Người khác đang nuôi dưỡng');
    expect(relationshipLabel('XYZ')).toBe('XYZ');
  });
});
