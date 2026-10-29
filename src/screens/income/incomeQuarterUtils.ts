import type { IncomeCompanyGroup, IncomeMonthItem } from '../../types/income';

export type IncomeTotals = { income: number; insurance: number; tax: number };

export type IncomeQuarter = IncomeTotals & {
  quarter: 1 | 2 | 3 | 4;
  /** "01 – 03/2025" */
  label: string;
  months: IncomeMonthItem[];
  /** Số tháng đã khai trong quý (< 3 là quý chưa đủ tháng) */
  monthCount: number;
};

const pad = (n: number) => String(n).padStart(2, '0');

/** Gộp thu nhập tháng của 1 nơi chi trả thành từng quý (chỉ quý có tháng đã khai) + dòng tổng cộng. */
export function groupMonthsByQuarter(
  months: IncomeMonthItem[],
  year: number
): { quarters: IncomeQuarter[]; total: IncomeTotals } {
  const total: IncomeTotals = { income: 0, insurance: 0, tax: 0 };
  const byQuarter = new Map<number, IncomeMonthItem[]>();

  for (const item of months) {
    const q = Math.ceil(item.month / 3);
    byQuarter.set(q, [...(byQuarter.get(q) ?? []), item]);
    total.income += Number(item.totalTaxableIncome) || 0;
    total.insurance += Number(item.insuranceDeducted) || 0;
    total.tax += Number(item.taxAlreadyDeducted) || 0;
  }

  const quarters = [...byQuarter.entries()]
    .sort(([a], [b]) => a - b)
    .map(([q, items]) => {
      const sorted = [...items].sort((a, b) => a.month - b.month);
      const first = (q - 1) * 3 + 1;
      return {
        quarter: q as IncomeQuarter['quarter'],
        label: `${pad(first)} – ${pad(first + 2)}/${year}`,
        months: sorted,
        monthCount: sorted.length,
        income: sorted.reduce((s, x) => s + (Number(x.totalTaxableIncome) || 0), 0),
        insurance: sorted.reduce((s, x) => s + (Number(x.insuranceDeducted) || 0), 0),
        tax: sorted.reduce((s, x) => s + (Number(x.taxAlreadyDeducted) || 0), 0),
      };
    });

  return { quarters, total };
}

const normTaxCode = (s?: string | null) => String(s ?? '').replace(/[^0-9]/g, '');
/** So tên không phân biệt dấu, hoa thường, khoảng trắng thừa ("Công ty Cổ phần" = "Cong ty Co phan") */
const normName = (s?: string | null) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Tìm thu nhập tháng (bảng incomes) ứng với 1 nơi chi trả trong hồ sơ quyết toán.
 * Phải khớp tên; nếu cả 2 bên đều có MST thì MST cũng phải khớp — tránh lấy nhầm phiếu lương
 * của công ty khác khai trùng MST.
 */
export function findCompanyMonths(
  groups: IncomeCompanyGroup[],
  company: { companyTaxCode?: string | null; companyName?: string | null }
): IncomeMonthItem[] {
  const code = normTaxCode(company.companyTaxCode);
  const name = normName(company.companyName);
  if (!name) return [];
  const match = groups.find((g) => {
    if (normName(g.organizationName) !== name) return false;
    const gCode = normTaxCode(g.taxIdNumber);
    return !code || !gCode || gCode === code;
  });
  return match ? match.details : [];
}
