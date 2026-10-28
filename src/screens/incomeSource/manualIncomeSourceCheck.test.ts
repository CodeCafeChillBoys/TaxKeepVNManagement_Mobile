import { evaluateManualIncomeSource } from './manualIncomeSourceCheck';
import type { IncomeSourceCrossCheckResult } from '../../api/incomeSourceApi';

const result = (summedTotalIncome: number, summedTaxWithheld: number, summedInsuranceDeducted = 0): IncomeSourceCrossCheckResult => ({
  isMatch: false,
  summedTotalIncome,
  summedTaxWithheld,
  summedInsuranceDeducted,
  diffTotalIncome: 0,
  diffTaxWithheld: 0,
  diffInsuranceDeducted: 0,
  mismatchMessages: [],
});

describe('evaluateManualIncomeSource', () => {
  it('chưa có tháng nào của công ty này thì không có gì để đối chiếu', () => {
    expect(evaluateManualIncomeSource(result(0, 0, 0), { income: 200_000_000, tax: 8_000_000 })).toEqual({
      status: 'no-monthly',
    });
  });

  it('khớp thu nhập và thuế với tổng các tháng (bỏ qua bảo hiểm vì form năm không có ô này)', () => {
    expect(
      evaluateManualIncomeSource(result(282_692_304, 2_693_304, 28_980_000), { income: 282_692_304, tax: 2_693_304 })
    ).toEqual({ status: 'match' });
  });

  it('cho lệch tối đa 1.000 đ do làm tròn (giống BE)', () => {
    expect(evaluateManualIncomeSource(result(100_000_500, 0), { income: 100_000_000, tax: 0 }).status).toBe('match');
  });

  it('lệch thì trả câu thông báo cho từng khoản', () => {
    const r = evaluateManualIncomeSource(result(150_000_000, 5_000_000), { income: 200_000_000, tax: 5_000_000 });
    expect(r.status).toBe('mismatch');
    if (r.status !== 'mismatch') return;
    expect(r.messages).toEqual([
      'Tổng thu nhập: khai 200.000.000 đ, các tháng đã nhập 150.000.000 đ (lệch 50.000.000 đ)',
    ]);
  });

  it('lệch cả thuế thì có 2 dòng', () => {
    const r = evaluateManualIncomeSource(result(150_000_000, 5_000_000), { income: 200_000_000, tax: 8_000_000 });
    expect(r.status === 'mismatch' && r.messages).toHaveLength(2);
  });
});
