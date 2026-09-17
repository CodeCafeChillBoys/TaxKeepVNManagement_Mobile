import {
  applyEditProfileOcrResult,
  buildEditProfileScanParams,
} from './applyEditProfileOcrResult';

describe('applyEditProfileOcrResult', () => {
  it('returns fullName, dateOfBirth, address and never includes citizenId', () => {
    const plan = applyEditProfileOcrResult({
      fullName: 'Nguyễn Văn A',
      citizenId: '079301009999',
      dateOfBirth: '1990-05-12',
      address: 'Ha Noi',
    });

    expect(plan.fields).toEqual({
      fullName: 'Nguyễn Văn A',
      dateOfBirth: '1990-05-12',
      address: 'Ha Noi',
    });
    expect(plan.fields).not.toHaveProperty('citizenId');
    expect(plan.alertTitle).toBe('Đã điền thông tin từ căn cước công dân.');
    expect(plan.alertMessage).toMatch(/lưu hồ sơ/i);
  });
});

describe('buildEditProfileScanParams', () => {
  it('passes lockedCitizenId with editProfile source', () => {
    expect(buildEditProfileScanParams('079301001234')).toEqual({
      source: 'editProfile',
      hasExistingData: true,
      lockedCitizenId: '079301001234',
    });
  });
});
