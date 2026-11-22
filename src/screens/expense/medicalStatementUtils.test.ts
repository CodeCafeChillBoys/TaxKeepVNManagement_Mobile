import {
  validateStatementFile,
  isMedicalReceipt,
  getStatementStatusMeta,
  getDeductionReasonLabel,
  getStatementErrorLabel,
  summarizeStatementLines,
} from './medicalStatementUtils';
import { MedicalStatementLine } from '../../types/expense';

const line = (p: Partial<MedicalStatementLine>): MedicalStatementLine => ({
  id: 1, lineOrder: 1, itemName: 'x', quantity: 1, unitPrice: 0, totalAmount: 0,
  insurancePaid: 0, patientCoPay: 0, patientSelfPay: 0, deductionStatus: 'ELIGIBLE',
  isEligibleDeduction: true, eligibleAmount: 0, ...p,
});

describe('medicalStatementUtils', () => {
  it('kiểm tra đuôi tệp và dung lượng giống BE', () => {
    expect(validateStatementFile({ name: 'bang_ke.PDF', size: 1000 })).toBeNull();
    expect(validateStatementFile({ name: 'bang_ke.jpeg' })).toBeNull();
    expect(validateStatementFile({ name: 'bang_ke.heic', size: 10 })).toContain('JPG');
    expect(validateStatementFile({ name: 'a.png', size: 10 * 1024 * 1024 + 1 })).toContain('10MB');
  });

  it('chỉ nhận hóa đơn viện phí làm chứng từ mẹ', () => {
    expect(isMedicalReceipt(' medical_receipt ')).toBe(true);
    expect(isMedicalReceipt('MEDICAL_COST_STATEMENT')).toBe(false);
    expect(isMedicalReceipt(null)).toBe(false);
  });

  it('nhãn trạng thái, lý do và lỗi', () => {
    expect(getStatementStatusMeta('FAILED').variant).toBe('destructive');
    expect(getStatementStatusMeta(undefined).label).toBe('Chưa tải bảng kê');
    expect(getDeductionReasonLabel('excluded_vip_room')).toBe('Phòng dịch vụ theo yêu cầu');
    expect(getDeductionReasonLabel('UNKNOWN_CODE')).toBe('UNKNOWN_CODE');
    expect(getStatementErrorLabel('ERR_NOT_MEDICAL_STATEMENT')).toContain('không phải bảng kê');
    expect(getStatementErrorLabel('Họ tên không khớp')).toBe('Họ tên không khớp');
  });

  it('cộng tiền được giảm trừ và bị loại trừ', () => {
    const s = summarizeStatementLines([
      line({ isEligibleDeduction: true, eligibleAmount: 300000 }),
      line({ isEligibleDeduction: true, eligibleAmount: 200000 }),
      line({ isEligibleDeduction: false, patientCoPay: 0, patientSelfPay: 1500000 }),
    ]);
    expect(s).toEqual({ eligibleAmount: 500000, eligibleCount: 2, excludedAmount: 1500000, excludedCount: 1 });
    expect(summarizeStatementLines(undefined).eligibleCount).toBe(0);
  });
});
