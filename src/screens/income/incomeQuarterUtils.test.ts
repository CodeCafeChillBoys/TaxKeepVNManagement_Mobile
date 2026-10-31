import { groupMonthsByQuarter, findCompanyMonths } from './incomeQuarterUtils';
import { IncomeCompanyGroup, IncomeMonthItem } from '../../types/income';

const m = (month: number, income: number, insurance = 1_000, tax = 100): IncomeMonthItem => ({
  id: `m${month}`,
  userId: 'u1',
  organizationName: 'Công ty A',
  taxIdNumber: '0108925471',
  month,
  year: 2025,
  totalTaxableIncome: income,
  insuranceDeducted: insurance,
  taxAlreadyDeducted: tax,
  payslipFileUrl: null,
  createdAt: '2025-01-01T00:00:00Z',
});

describe('groupMonthsByQuarter', () => {
  it('gộp tháng thành quý, cộng 3 cột và có dòng tổng cộng', () => {
    const r = groupMonthsByQuarter([m(1, 10), m(2, 20), m(3, 30), m(4, 40)], 2025);
    expect(r.quarters).toHaveLength(2);
    expect(r.quarters[0]).toMatchObject({
      quarter: 1,
      label: '01 – 03/2025',
      income: 60,
      insurance: 3_000,
      tax: 300,
      monthCount: 3,
    });
    expect(r.quarters[1]).toMatchObject({ quarter: 2, label: '04 – 06/2025', income: 40, monthCount: 1 });
    expect(r.total).toEqual({ income: 100, insurance: 4_000, tax: 400 });
  });

  it('chỉ có quý nào có tháng đã khai, xếp theo thứ tự quý và tháng', () => {
    const r = groupMonthsByQuarter([m(12, 5), m(10, 5), m(1, 5)], 2025);
    expect(r.quarters.map((q) => q.quarter)).toEqual([1, 4]);
    expect(r.quarters[1].months.map((x) => x.month)).toEqual([10, 12]);
    expect(r.quarters[1].label).toBe('10 – 12/2025');
  });

  it('không có tháng nào thì rỗng, tổng bằng 0', () => {
    expect(groupMonthsByQuarter([], 2025)).toEqual({ quarters: [], total: { income: 0, insurance: 0, tax: 0 } });
  });
});

describe('findCompanyMonths', () => {
  const groups: IncomeCompanyGroup[] = [
    { organizationName: 'CÔNG TY CỔ PHẦN CÔNG NGHỆ FPT', taxIdNumber: '0101248141', totalIncomeCompany: 30, details: [m(1, 30)] },
    { organizationName: 'Tập đoàn BMST', taxIdNumber: null, totalIncomeCompany: 9, details: [m(2, 9)] },
  ];

  it('khớp khi cùng MST và cùng tên (tên so không phân biệt dấu, hoa thường)', () => {
    const r = findCompanyMonths(groups, { companyTaxCode: '0101-248 141', companyName: 'Cong ty Co phan Cong nghe FPT' });
    expect(r.map((x) => x.month)).toEqual([1]);
  });

  it('cùng MST nhưng khác tên công ty thì KHÔNG ghép (tránh lấy nhầm phiếu lương công ty khác)', () => {
    expect(findCompanyMonths(groups, { companyTaxCode: '0101248141', companyName: 'Cong ty Co phan Dich vu So ABC' })).toEqual([]);
  });

  it('cùng tên nhưng khác MST thì KHÔNG ghép', () => {
    expect(findCompanyMonths(groups, { companyTaxCode: '0999999999', companyName: 'CÔNG TY CỔ PHẦN CÔNG NGHỆ FPT' })).toEqual([]);
  });

  it('một bên không có MST thì chỉ cần khớp tên', () => {
    expect(findCompanyMonths(groups, { companyTaxCode: '0314589027', companyName: 'tập đoàn bmst' }).map((x) => x.month)).toEqual([2]);
    expect(findCompanyMonths(groups, { companyTaxCode: '', companyName: 'Tap doan BMST' }).map((x) => x.month)).toEqual([2]);
  });

  it('không tìm thấy thì trả mảng rỗng', () => {
    expect(findCompanyMonths(groups, { companyTaxCode: '0999999999', companyName: 'Không có' })).toEqual([]);
  });
});
