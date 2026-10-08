import {
  emptyIncomeForm,
  parseMoney,
  formatMoneyInput,
  validateIncomeForm,
  toIncomeRequest,
  fromIncomeItem,
  fromPayslipOcr,
  isLowConfidence,
  findDuplicateMonth,
  extractApiErrorMessage,
} from './incomeFormUtils';
import { IncomeCompanyGroup, IncomeMonthItem } from '../../types/income';

const item: IncomeMonthItem = {
  id: 'm1',
  userId: 'u1',
  organizationName: 'Công ty A',
  taxIdNumber: '0100109106',
  month: 3,
  year: 2026,
  totalTaxableIncome: 30_000_000,
  insuranceDeducted: 3_150_000,
  taxAlreadyDeducted: 1_200_000,
  payslipFileUrl: 'https://x/p.jpg',
  createdAt: '2026-04-01T00:00:00Z',
};

const validForm = () => ({
  ...emptyIncomeForm(2026, 3),
  organizationName: 'Công ty A',
  taxIdNumber: '0100109106',
  totalTaxableIncome: '30.000.000',
  insuranceDeducted: '3.150.000',
  taxAlreadyDeducted: '1.200.000',
});

describe('parseMoney / formatMoneyInput', () => {
  it('đọc số tiền có dấu chấm, phẩy, khoảng trắng, chữ đ', () => {
    expect(parseMoney('30.000.000')).toBe(30_000_000);
    expect(parseMoney('30,000,000 đ')).toBe(30_000_000);
    expect(parseMoney(' 0 ')).toBe(0);
  });
  it('ô trống hoặc không có chữ số → null', () => {
    expect(parseMoney('')).toBeNull();
    expect(parseMoney('   ')).toBeNull();
    expect(parseMoney('abc')).toBeNull();
  });
  it('định dạng khi gõ: nhóm hàng nghìn bằng dấu chấm', () => {
    expect(formatMoneyInput('30000000')).toBe('30.000.000');
    expect(formatMoneyInput('30.0000')).toBe('300.000');
    expect(formatMoneyInput('')).toBe('');
    expect(formatMoneyInput('00012')).toBe('12');
  });
});

describe('validateIncomeForm', () => {
  it('form hợp lệ không có lỗi', () => {
    expect(validateIncomeForm(validForm())).toEqual({});
  });
  it('bắt buộc tên tổ chức, thu nhập, bảo hiểm', () => {
    const e = validateIncomeForm({ ...validForm(), organizationName: ' ', totalTaxableIncome: '', insuranceDeducted: '' });
    expect(Object.keys(e).sort()).toEqual(['insuranceDeducted', 'organizationName', 'totalTaxableIncome']);
  });
  it('tháng phải 1–12, năm 4 chữ số', () => {
    expect(validateIncomeForm({ ...validForm(), month: '13' }).month).toBeTruthy();
    expect(validateIncomeForm({ ...validForm(), month: '0' }).month).toBeTruthy();
    expect(validateIncomeForm({ ...validForm(), year: '26' }).year).toBeTruthy();
  });
  it('mã số thuế: trống được; có thì 10 số hoặc 10 số + "-" + 3 số', () => {
    expect(validateIncomeForm({ ...validForm(), taxIdNumber: '' }).taxIdNumber).toBeUndefined();
    expect(validateIncomeForm({ ...validForm(), taxIdNumber: '0100109106-001' }).taxIdNumber).toBeUndefined();
    expect(validateIncomeForm({ ...validForm(), taxIdNumber: '12345' }).taxIdNumber).toBeTruthy();
  });
  it('thuế đã khấu trừ để trống được (coi là 0)', () => {
    expect(validateIncomeForm({ ...validForm(), taxAlreadyDeducted: '' })).toEqual({});
  });
});

describe('chuyển đổi form ↔ API', () => {
  it('toIncomeRequest ra đúng kiểu số, MST trống → null', () => {
    expect(toIncomeRequest({ ...validForm(), taxIdNumber: '  ', taxAlreadyDeducted: '' })).toEqual({
      organizationName: 'Công ty A',
      taxIdNumber: null,
      month: 3,
      year: 2026,
      totalTaxableIncome: 30_000_000,
      insuranceDeducted: 3_150_000,
      taxAlreadyDeducted: 0,
      payslipFileUrl: null,
    });
  });
  it('fromIncomeItem rồi toIncomeRequest giữ nguyên dữ liệu', () => {
    const { id, userId, createdAt, ...rest } = item;
    expect(toIncomeRequest(fromIncomeItem(item))).toEqual(rest);
  });
});

describe('fromPayslipOcr', () => {
  it('điền form từ kết quả OCR', () => {
    const f = fromPayslipOcr(
      { ...item, thresholdValidation: null },
      { month: 1, year: 2026 }
    );
    expect(f).toMatchObject({
      organizationName: 'Công ty A',
      month: '3',
      year: '2026',
      totalTaxableIncome: '30.000.000',
      insuranceDeducted: '3.150.000',
      payslipFileUrl: 'https://x/p.jpg',
    });
  });
  it('tháng/năm OCR không hợp lệ thì lấy tháng/năm người dùng chọn', () => {
    const f = fromPayslipOcr({ ...item, month: 0, year: 0 }, { month: 5, year: 2026 });
    expect(f.month).toBe('5');
    expect(f.year).toBe('2026');
  });
});

describe('isLowConfidence', () => {
  it('khớp tên trường dù AI trả camelCase hay snake_case', () => {
    expect(isLowConfidence('totalTaxableIncome', ['total_taxable_income'])).toBe(true);
    expect(isLowConfidence('insuranceDeducted', ['insuranceDeducted'])).toBe(true);
    expect(isLowConfidence('organizationName', ['taxIdNumber'])).toBe(false);
    expect(isLowConfidence('organizationName', [])).toBe(false);
  });
});

describe('findDuplicateMonth', () => {
  const groups: IncomeCompanyGroup[] = [
    { organizationName: 'Công ty A', taxIdNumber: '0100109106', totalIncomeCompany: 30_000_000, details: [item] },
  ];

  it('phát hiện trùng cùng MST + tháng + năm', () => {
    expect(findDuplicateMonth(groups, validForm())?.id).toBe('m1');
  });
  it('không có MST thì so tên tổ chức (không phân biệt hoa thường, khoảng trắng)', () => {
    const g: IncomeCompanyGroup[] = [{ ...groups[0], taxIdNumber: null, details: [{ ...item, taxIdNumber: null }] }];
    expect(findDuplicateMonth(g, { ...validForm(), taxIdNumber: '', organizationName: '  công ty a ' })?.id).toBe('m1');
  });
  it('khác tháng hoặc đang sửa chính bản ghi đó thì không tính trùng', () => {
    expect(findDuplicateMonth(groups, { ...validForm(), month: '4' })).toBeNull();
    expect(findDuplicateMonth(groups, validForm(), 'm1')).toBeNull();
  });
});

describe('extractApiErrorMessage', () => {
  it('lấy message của BE', () => {
    expect(extractApiErrorMessage({ response: { status: 400, data: { message: 'Dữ liệu không hợp lệ.' } } }, 'x')).toBe(
      'Dữ liệu không hợp lệ.'
    );
  });
  it('bóc thông báo của AI nằm trong chuỗi JSON', () => {
    const inner = JSON.stringify({ success: false, message: 'Lỗi', errors: [{ message: 'Ảnh không phải phiếu lương.' }] });
    const err = { response: { status: 422, data: { message: `AI Service trả về lỗi: ${inner}` } } };
    expect(extractApiErrorMessage(err, 'x')).toBe('Ảnh không phải phiếu lương.');
  });
  it('mất kết nối hoặc lỗi lạ thì dùng câu dự phòng / Error.message', () => {
    expect(extractApiErrorMessage({ message: 'Network Error' }, 'Dự phòng')).toBe(
      'Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.'
    );
    expect(extractApiErrorMessage(new Error('Không đọc được dữ liệu'), 'x')).toBe('Không đọc được dữ liệu');
    expect(extractApiErrorMessage(null, 'Dự phòng')).toBe('Dự phòng');
  });
});
