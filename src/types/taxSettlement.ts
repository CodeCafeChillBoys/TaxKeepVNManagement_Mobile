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

/** POST …/{id}/export-pdf — body optional, BE fallback Profile */
export interface TaxSettlementExportPdfRequest {
  taxOfficeName?: string | null;
  taxCode?: string | null;
  bankAccountNumber?: string | null;
  bankName?: string | null;
  contactAddress?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
}

/** POST …/{id}/export-zip — kế thừa PDF + note */
export interface TaxSettlementExportZipRequest extends TaxSettlementExportPdfRequest {
  note?: string | null;
}

/** Response JSON sau export-zip */
export interface TaxSettlementPackageZipResponse {
  dossierId: string;
  fileName: string;
  downloadUrl: string;
  expiresAt: string;
  fileSizeBytes: number;
  totalDocumentsIncluded: number;
  message: string;
}

export function formatFileSize(bytes: number | null | undefined): string {
  const n = Number(bytes ?? 0);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `~${(n / 1024).toFixed(0)} KB`;
  return `~${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatExpiresAt(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
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
