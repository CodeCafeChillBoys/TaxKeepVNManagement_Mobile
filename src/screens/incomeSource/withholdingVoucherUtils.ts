import type { ConfirmDocumentReviewRequest, DocumentReviewResponse } from '../../types/expense';
import type { IncomeSourceCrossCheckRequest } from '../../api/incomeSourceApi';
import { formatMoneyInput, parseMoney } from '../income/incomeFormUtils';

/**
 * Chứng từ khấu trừ thuế TNCN (luồng riêng ở Nơi chi trả, không dùng chung màn hoá đơn chi phí).
 * Luồng: tạo kỳ thuế → upload → chờ bóc tách → cross-check với bảng incomes → khớp mới confirm.
 */
export const WITHHOLDING_VOUCHER = 'WITHHOLDING_VOUCHER';

export type VoucherFormValues = {
  companyName: string;
  companyTaxCode: string;
  taxYear: string;
  totalIncome: string;
  taxWithheld: string;
  insuranceDeducted: string;
};
export type VoucherFormField = keyof VoucherFormValues;
export type VoucherFormErrors = Partial<Record<VoucherFormField, string>>;

function moneyToInput(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '';
  return formatMoneyInput(String(Math.round(Number(n))));
}

export function fromVoucherDocument(doc: DocumentReviewResponse, fallbackYear: number): VoucherFormValues {
  return {
    companyName: doc.sellerName ?? '',
    companyTaxCode: doc.sellerTaxCode ?? '',
    taxYear: String(doc.extractedYear ?? fallbackYear),
    totalIncome: moneyToInput(doc.totalIncome),
    taxWithheld: moneyToInput(doc.taxWithheld),
    insuranceDeducted: moneyToInput(doc.insuranceDeducted),
  };
}

export function validateVoucherForm(v: VoucherFormValues): VoucherFormErrors {
  const e: VoucherFormErrors = {};
  if (!v.companyName.trim()) e.companyName = 'Vui lòng nhập tên tổ chức chi trả.';
  if (!v.companyTaxCode.trim()) e.companyTaxCode = 'Vui lòng nhập mã số thuế tổ chức chi trả.';
  const year = v.taxYear.trim();
  if (!/^\d{4}$/.test(year) || Number(year) < 2000 || Number(year) > 2100) e.taxYear = 'Năm không hợp lệ.';

  const income = parseMoney(v.totalIncome);
  const tax = parseMoney(v.taxWithheld);
  if (income == null) e.totalIncome = 'Vui lòng nhập tổng thu nhập chịu thuế.';
  if (tax == null) e.taxWithheld = 'Vui lòng nhập số thuế đã khấu trừ (không có thì nhập 0).';
  else if (income != null && tax > income) e.taxWithheld = 'Thuế đã khấu trừ không được lớn hơn tổng thu nhập.';
  if (parseMoney(v.insuranceDeducted) == null) e.insuranceDeducted = 'Vui lòng nhập bảo hiểm đã trừ (không có thì nhập 0).';
  return e;
}

export function toCrossCheckRequest(v: VoucherFormValues): IncomeSourceCrossCheckRequest {
  return {
    companyName: v.companyName.trim(),
    taxYear: Number(v.taxYear.trim()),
    certificateTotalIncome: parseMoney(v.totalIncome) ?? 0,
    certificateTaxWithheld: parseMoney(v.taxWithheld) ?? 0,
    certificateInsuranceDeducted: parseMoney(v.insuranceDeducted) ?? 0,
  };
}

export function toVoucherConfirmRequest(
  v: VoucherFormValues,
  doc: DocumentReviewResponse
): ConfirmDocumentReviewRequest {
  return {
    docTypeCode: WITHHOLDING_VOUCHER,
    sellerName: v.companyName.trim(),
    sellerTaxCode: v.companyTaxCode.trim(),
    sellerAddress: doc.sellerAddress ?? null,
    sellerPhone: doc.sellerPhone ?? null,
    invoiceSeries: doc.invoiceSeries ?? null,
    invoiceNumber: doc.invoiceNumber ?? null,
    invoiceDate: doc.invoiceDate ?? null,
    buyerName: doc.buyerName ?? null,
    buyerTaxCode: doc.buyerTaxCode ?? null,
    buyerIdCard: doc.buyerIdCard ?? null,
    buyerAddress: doc.buyerAddress ?? null,
    paymentMethod: doc.paymentMethod ?? null,
    totalAmount: doc.totalAmount ?? null,
    totalAmountInWords: doc.totalAmountInWords ?? null,
    lookupUrl: doc.lookupUrl ?? null,
    lookupCode: doc.lookupCode ?? null,
    extractedYear: Number(v.taxYear.trim()),
    isYearValid: doc.isYearValid ?? true,
    isIdentityValid: doc.isIdentityValid ?? true,
    isNotReimbursed: doc.isNotReimbursed ?? true,
    items: (doc.items ?? []).map((it, idx) => ({
      itemOrder: it.itemOrder || idx + 1,
      itemName: it.itemName,
      unit: it.unit ?? null,
      quantity: it.quantity ?? null,
      unitPrice: it.unitPrice ?? null,
      totalPrice: it.totalPrice ?? null,
    })),
    totalIncome: parseMoney(v.totalIncome) ?? 0,
    taxWithheld: parseMoney(v.taxWithheld) ?? 0,
    insuranceDeducted: parseMoney(v.insuranceDeducted) ?? 0,
  };
}

export function isExtractionFinished(status?: string | null): boolean {
  return status === 'EXTRACTED' || status === 'FAILED';
}
