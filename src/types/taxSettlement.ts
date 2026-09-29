/** Types cho luồng quyết toán thuế TNCN — khớp BE TaxSettlementDtos. */

export interface TaxSettlementPreviewRequest {
  taxYear: number;
  cutoffDate?: string | null;
  charityDeduction?: number;
}

export interface TaxSettlementExportRequest {
  taxYear: number;
  cutoffDate?: string | null;
  charityDeduction?: number;
  selectedIncomeSourceIds?: string[] | null;
  note?: string | null;
}

export interface SettlementIncomeItem {
  incomeSourceId: string;
  companyName: string;
  companyTaxCode: string;
  grossIncome: number;
  taxWithheld: number;
  insuranceDeduction: number;
  isSelected: boolean;
}

export interface SettlementDependentItem {
  dependentId: string;
  fullName: string;
  relationship: string;
  validMonths: number;
  deductionAmount: number;
  effectiveFromMonth: string;
  effectiveToMonth: string;
}

export interface BracketCalculationDetail {
  bracketNo: number;
  fromMonthly: number;
  toMonthly: number | null;
  rate: number;
  taxableMonthly: number;
  taxMonthly: number;
  isApplied: boolean;
}

export interface TaxSettlementPreview {
  dossierId?: string | null;
  taxYear: number;
  cutoffDate: string;
  lawGroupLabel: string;
  incomeItems: SettlementIncomeItem[];
  totalGrossIncome: number;
  totalTaxWithheld: number;
  totalInsuranceDeduction: number;
  dependentItems: SettlementDependentItem[];
  personalDeductionMonthlyRate: number;
  personalDeductionMonths: number;
  personalDeductionAmount: number;
  dependentMonthlyRate: number;
  dependentDeductionPersonMonths: number;
  dependentDeductionAmount: number;
  charityDeduction: number;
  medicalDeduction: number;
  educationDeduction: number;
  totalDeductions: number;
  taxableIncomeYearly: number;
  taxableIncomeMonthly: number;
  bracketDetails: BracketCalculationDetail[];
  appliedBracketNo: number;
  taxPayableMonthly: number;
  taxPayable: number;
  refundAmount: number;
  dueAmount: number;
  summaryMessage: string;
  status: string;
}

export interface TaxSettlementListItem {
  id: string;
  taxYear: number;
  cutoffDate: string;
  taxPayable: number;
  refundAmount: number;
  dueAmount: number;
  status: string;
  lawGroupLabel: string;
  createdAt: string;
  lockedAt?: string | null;
}

export function formatVnd(amount: number | null | undefined): string {
  const n = Number(amount ?? 0);
  return `${n.toLocaleString('vi-VN')} đ`;
}

export function heroOutcome(preview: Pick<TaxSettlementPreview, 'refundAmount' | 'dueAmount'>): {
  label: string;
  amount: number;
  kind: 'refund' | 'due' | 'zero';
} {
  if (preview.refundAmount > 0) {
    return { label: 'ĐƯỢC HOÀN', amount: preview.refundAmount, kind: 'refund' };
  }
  if (preview.dueAmount > 0) {
    return { label: 'CÒN PHẢI NỘP', amount: preview.dueAmount, kind: 'due' };
  }
  return { label: 'KHÔNG PHÁT SINH', amount: 0, kind: 'zero' };
}
