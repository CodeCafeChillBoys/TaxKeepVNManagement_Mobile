import { shouldShowHomeButton } from './homeButtonUtils';

describe('shouldShowHomeButton', () => {
  it('hiện khi bấm lùi chưa về Trang chủ (màn trước không phải Home)', () => {
    expect(shouldShowHomeButton('IncomeMonthForm', true, 'IncomeSourceList')).toBe(true);
    expect(shouldShowHomeButton('WithholdingVoucher', true, 'IncomeSourceList')).toBe(true);
    expect(shouldShowHomeButton('SettlementDetail', true, 'SettlementList')).toBe(true);
  });

  it('ẩn khi bấm lùi là về thẳng Trang chủ (màn trước là Home)', () => {
    expect(shouldShowHomeButton('IncomeSourceList', true, 'Home')).toBe(false);
    expect(shouldShowHomeButton('ExpenseList', true, 'Home')).toBe(false);
  });

  it('ẩn khi không có màn phía trước (nút lùi tự về Trang chủ)', () => {
    expect(shouldShowHomeButton('IncomeSourceList', true, undefined)).toBe(false);
  });

  it('ẩn ở chính màn Trang chủ', () => {
    expect(shouldShowHomeButton('Home', true, undefined)).toBe(false);
  });

  it('ẩn ở các màn trước khi đăng nhập', () => {
    expect(shouldShowHomeButton('Register', false, 'Login')).toBe(false);
    expect(shouldShowHomeButton('VerifyPending', false, 'Register')).toBe(false);
    expect(shouldShowHomeButton('ScanIdentity', false, 'Register')).toBe(false);
  });
});
