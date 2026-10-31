import { applyRegisterOcrResult } from './applyRegisterOcrResult';

describe('applyRegisterOcrResult', () => {
  const base = {
    fullName: 'Nguyễn Văn A',
    citizenId: '079301001234',
    dateOfBirth: '1990-05-12',
    address: 'Ha Noi',
  };

  it('returns the four form fields to fill', () => {
    const plan = applyRegisterOcrResult(base);

    expect(plan.fields).toEqual({
      fullName: 'Nguyễn Văn A',
      citizenId: '079301001234',
      dateOfBirth: '1990-05-12',
      address: 'Ha Noi',
    });
    expect(plan.citizenIdError).toBeUndefined();
    expect(plan.alertTitle).toBe('Đã điền thông tin từ căn cước công dân.');
  });

  it('sets citizenIdError when isAvailable is false', () => {
    const plan = applyRegisterOcrResult({
      ...base,
      isAvailable: false,
      warning: 'Số CCCD này đã được đăng ký tài khoản trong hệ thống.',
    });

    expect(plan.fields.citizenId).toBe('079301001234');
    expect(plan.citizenIdError).toBe(
      'Số CCCD này đã được đăng ký tài khoản trong hệ thống.'
    );
  });

  it('uses default citizenId error when unavailable without warning', () => {
    const plan = applyRegisterOcrResult({
      ...base,
      isAvailable: false,
      warning: null,
    });

    expect(plan.citizenIdError).toBe(
      'Số căn cước công dân này đã được đăng ký.'
    );
  });

  it('does not set citizenIdError when isAvailable is true', () => {
    const plan = applyRegisterOcrResult({
      ...base,
      isAvailable: true,
      warning: null,
    });

    expect(plan.citizenIdError).toBeUndefined();
  });
});
