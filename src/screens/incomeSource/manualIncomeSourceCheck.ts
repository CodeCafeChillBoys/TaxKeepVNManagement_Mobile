import type { IncomeSourceCrossCheckResult } from '../../api/incomeSourceApi';

/** Lệch tối đa cho phép do làm tròn — cùng mức BE dùng trong cross-check */
const TOLERANCE = 1000;

export type ManualCheckOutcome =
  | { status: 'no-monthly' }
  | { status: 'match' }
  | { status: 'mismatch'; messages: string[] };

const vnd = (n: number) => `${Math.round(n).toLocaleString('vi-VN')} đ`;

/**
 * Khai tay nơi chi trả ở tab Theo năm: so số khai với tổng thu nhập các tháng (kết quả cross-check).
 * Chỉ so thu nhập + thuế — form năm không có ô bảo hiểm nên bỏ qua phần bảo hiểm.
 */
export function evaluateManualIncomeSource(
  result: IncomeSourceCrossCheckResult,
  declared: { income: number; tax: number }
): ManualCheckOutcome {
  const sumIncome = Number(result.summedTotalIncome) || 0;
  const sumTax = Number(result.summedTaxWithheld) || 0;
  const sumInsurance = Number(result.summedInsuranceDeducted) || 0;

  if (sumIncome === 0 && sumTax === 0 && sumInsurance === 0) return { status: 'no-monthly' };

  const messages: string[] = [];
  if (Math.abs(declared.income - sumIncome) > TOLERANCE) {
    messages.push(
      `Tổng thu nhập: khai ${vnd(declared.income)}, các tháng đã nhập ${vnd(sumIncome)} (lệch ${vnd(Math.abs(declared.income - sumIncome))})`
    );
  }
  if (Math.abs(declared.tax - sumTax) > TOLERANCE) {
    messages.push(
      `Thuế đã khấu trừ: khai ${vnd(declared.tax)}, các tháng đã nhập ${vnd(sumTax)} (lệch ${vnd(Math.abs(declared.tax - sumTax))})`
    );
  }
  return messages.length ? { status: 'mismatch', messages } : { status: 'match' };
}
