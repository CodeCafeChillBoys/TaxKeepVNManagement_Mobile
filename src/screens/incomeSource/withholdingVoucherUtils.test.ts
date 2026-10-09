import {
  WITHHOLDING_VOUCHER,
  fromVoucherDocument,
  validateVoucherForm,
  toCrossCheckRequest,
  toVoucherConfirmRequest,
  isExtractionFinished,
  VoucherFormValues,
} from './withholdingVoucherUtils';
import { DocumentReviewResponse } from '../../types/expense';

const doc: DocumentReviewResponse = {
  id: 'd1',
  periodId: 'p1',
  docTypeCode: 'WITHHOLDING_VOUCHER',
  fileUrl: 'https://x/v.pdf',
  sellerName: 'CÔNG TY CỔ PHẦN CÔNG NGHỆ FPT',
  sellerTaxCode: '0101248141',
  sellerAddress: 'Hà Nội',
  invoiceSeries: 'CT/2025/E',
  invoiceNumber: '0000001',
  invoiceDate: '2026-01-10',
  buyerName: 'Hà Huy Huy',
  extractedYear: 2025,
  totalAmount: 2_692_304,
  totalIncome: 282_692_304,
  taxWithheld: 2_692_304,
  insuranceDeducted: 28_980_000,
  isYearValid: true,
  isIdentityValid: true,
  status: 'EXTRACTED',
  createdAt: '2026-01-10T00:00:00Z',
  items: [],
};

const validForm = (): VoucherFormValues => ({
  companyName: 'CÔNG TY CỔ PHẦN CÔNG NGHỆ FPT',
  companyTaxCode: '0101248141',
  taxYear: '2025',
  totalIncome: '282.692.304',
  taxWithheld: '2.692.304',
  insuranceDeducted: '28.980.000',
});

describe('fromVoucherDocument', () => {
  it('điền form từ kết quả bóc tách, định dạng tiền có dấu chấm', () => {
    expect(fromVoucherDocument(doc, 2026)).toEqual(validForm());
  });

  it('dùng năm dự phòng và để trống tiền khi chứng từ chưa có số', () => {
    const v = fromVoucherDocument(
      { ...doc, extractedYear: null, totalIncome: null, taxWithheld: null, insuranceDeducted: null, sellerName: null },
      2026
    );
    expect(v.taxYear).toBe('2026');
    expect(v.companyName).toBe('');
    expect(v.totalIncome).toBe('');
    expect(v.taxWithheld).toBe('');
    expect(v.insuranceDeducted).toBe('');
  });
});

describe('validateVoucherForm', () => {
  it('form hợp lệ thì không có lỗi', () => {
    expect(validateVoucherForm(validForm())).toEqual({});
  });

  it('bắt buộc tên công ty và mã số thuế', () => {
    const e = validateVoucherForm({ ...validForm(), companyName: '  ', companyTaxCode: '' });
    expect(e.companyName).toBeTruthy();
    expect(e.companyTaxCode).toBeTruthy();
  });

  it('năm phải là 4 chữ số hợp lệ', () => {
    expect(validateVoucherForm({ ...validForm(), taxYear: '25' }).taxYear).toBeTruthy();
  });

  it('bắt buộc nhập đủ 3 số tiền', () => {
    const e = validateVoucherForm({ ...validForm(), totalIncome: '', taxWithheld: '', insuranceDeducted: '' });
    expect(e.totalIncome).toBeTruthy();
    expect(e.taxWithheld).toBeTruthy();
    expect(e.insuranceDeducted).toBeTruthy();
  });

  it('thuế đã khấu trừ không được lớn hơn tổng thu nhập', () => {
    const e = validateVoucherForm({ ...validForm(), totalIncome: '1.000', taxWithheld: '2.000' });
    expect(e.taxWithheld).toBeTruthy();
  });
});

describe('toCrossCheckRequest', () => {
  it('chuyển form sang body cross-check', () => {
    expect(toCrossCheckRequest(validForm())).toEqual({
      companyName: 'CÔNG TY CỔ PHẦN CÔNG NGHỆ FPT',
      taxYear: 2025,
      certificateTotalIncome: 282_692_304,
      certificateTaxWithheld: 2_692_304,
      certificateInsuranceDeducted: 28_980_000,
    });
  });
});

describe('toVoucherConfirmRequest', () => {
  it('luôn gửi loại chứng từ khấu trừ kèm 3 số tiền đã đối chiếu', () => {
    const body = toVoucherConfirmRequest(validForm(), doc);
    expect(body.docTypeCode).toBe(WITHHOLDING_VOUCHER);
    expect(body.sellerName).toBe('CÔNG TY CỔ PHẦN CÔNG NGHỆ FPT');
    expect(body.sellerTaxCode).toBe('0101248141');
    expect(body.extractedYear).toBe(2025);
    expect(body.totalIncome).toBe(282_692_304);
    expect(body.taxWithheld).toBe(2_692_304);
    expect(body.insuranceDeducted).toBe(28_980_000);
    expect(body.invoiceNumber).toBe('0000001');
    expect(body.isIdentityValid).toBe(true);
  });
});

describe('isExtractionFinished', () => {
  it('chỉ dừng chờ khi đã EXTRACTED hoặc FAILED', () => {
    expect(isExtractionFinished('EXTRACTED')).toBe(true);
    expect(isExtractionFinished('FAILED')).toBe(true);
    expect(isExtractionFinished('UPLOADED')).toBe(false);
  });
});
