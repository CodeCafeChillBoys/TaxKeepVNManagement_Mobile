/** Thu nhập theo tháng (bảng `incomes`) — khớp BE IncomesController / OCR phiếu lương. */

export interface IncomeMonthItem {
  id: string;
  userId: string;
  organizationName: string;
  taxIdNumber?: string | null;
  month: number;
  year: number;
  totalTaxableIncome: number;
  insuranceDeducted: number;
  taxAlreadyDeducted: number;
  payslipFileUrl?: string | null;
  createdAt: string;
}

/** GET /api/v1/incomes/my-incomes?year= — nhóm theo tổ chức, mỗi tổ chức gồm các tháng. */
export interface IncomeCompanyGroup {
  organizationName: string;
  taxIdNumber?: string | null;
  totalIncomeCompany: number;
  details: IncomeMonthItem[];
}

/** Body POST/PUT /api/v1/incomes */
export interface IncomeUpsertRequest {
  organizationName: string;
  taxIdNumber?: string | null;
  month: number;
  year: number;
  totalTaxableIncome: number;
  insuranceDeducted: number;
  taxAlreadyDeducted: number;
  payslipFileUrl?: string | null;
}

export interface PayslipOcrThreshold {
  appliedThreshold: number;
  overallConfidence: number;
  isPassedThreshold: boolean;
  lowConfidenceFields: string[];
  warningMessage?: string | null;
}

/** Dữ liệu AI đọc từ phiếu lương (lớp `data` trong cùng của response OCR). */
export interface PayslipOcrData {
  organizationName: string;
  taxIdNumber?: string | null;
  month: number;
  year: number;
  totalTaxableIncome: number;
  insuranceDeducted: number;
  taxAlreadyDeducted: number;
  payslipFileUrl?: string | null;
  employeeName?: string | null;
  grossSalary?: number | null;
  netSalary?: number | null;
  thresholdValidation?: PayslipOcrThreshold | null;
}
