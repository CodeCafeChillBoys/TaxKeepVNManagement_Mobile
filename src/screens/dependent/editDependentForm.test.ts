import {
  buildUpdateDependentPayload,
  clampBirthDay,
  dependentDetailToFormState,
  hasIdentityFieldChange,
  isEditDependentFormDirty,
  isValidCalendarDate,
  needsIdentityChangeConfirm,
  splitEffectiveMonth,
} from './editDependentForm';
import { SEED_CATALOG } from './seedCatalog.test.fixture';

describe('splitEffectiveMonth', () => {
  it('tách YYYY-MM hợp lệ', () => {
    expect(splitEffectiveMonth('2026-03')).toEqual({ year: '2026', month: '03' });
  });
});

describe('dependentDetailToFormState', () => {
  it('map chi tiết API sang form và chọn nhóm hợp lệ với quan hệ', () => {
    const state = dependentDetailToFormState({
      fullName: 'Nguyễn Văn A',
      relationship: 'parent',
      currentGroup: 'PARENT_RETIRED',
      birthDate: '1960-05-15',
      citizenId: '079060001234',
      effectiveFromMonth: '2026-01',
      effectiveToMonth: '2026-12',
      note: 'ghi chú',
    });
    expect(state.fullName).toBe('Nguyễn Văn A');
    expect(state.relationship).toBe('PARENT');
    expect(state.currentGroup).toBe('PARENT_RETIRED');
    expect(state.birthDay).toBe('15');
    expect(state.birthMonth).toBe('05');
    expect(state.birthYear).toBe('1960');
    expect(state.citizenId).toBe('079060001234');
  });

  it('có catalog: nhóm không thuộc quan hệ thì chọn nhóm đầu của quan hệ', () => {
    const state = dependentDetailToFormState(
      { relationship: 'PARENT', currentGroup: 'CHILD_UNDER_18', birthDate: '1960-05-15' },
      SEED_CATALOG
    );
    expect(state.currentGroup).toBe('PARENT_DISABLED');
  });

  it('chưa có catalog: giữ nhóm từ API', () => {
    const state = dependentDetailToFormState(
      { relationship: 'PARENT', currentGroup: 'NEW_GROUP', birthDate: '1960-05-15' },
      null
    );
    expect(state.currentGroup).toBe('NEW_GROUP');
  });
});

describe('isEditDependentFormDirty', () => {
  const base = dependentDetailToFormState({
    fullName: 'A',
    relationship: 'CHILD',
    currentGroup: 'CHILD_UNDER_18',
    birthDate: '2015-01-01',
    birthCertNumber: 'BC1',
    effectiveFromMonth: '2026-01',
    effectiveToMonth: '2026-12',
  });

  it('false khi giống baseline', () => {
    expect(isEditDependentFormDirty(base, base)).toBe(false);
  });

  it('true khi đổi tên', () => {
    expect(isEditDependentFormDirty({ ...base, fullName: 'B' }, base)).toBe(true);
  });
});

describe('buildUpdateDependentPayload', () => {
  it('từ chối CCCD sai định dạng 12 số khi có nhập CCCD', () => {
    const state = dependentDetailToFormState({
      fullName: 'Nguyễn Văn B',
      relationship: 'CHILD',
      currentGroup: 'CHILD_OVER_18_STUDYING',
      birthDate: '2000-01-01',
      citizenId: '123',
      effectiveFromMonth: '2026-01',
      effectiveToMonth: '2026-12',
    });
    const res = buildUpdateDependentPayload(state);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toMatch(/CCCD/);
  });

  it('từ chối khi thiếu cả CCCD và Giấy khai sinh (khớp BE IDENTIFIER_REQUIRED)', () => {
    const state = dependentDetailToFormState({
      fullName: 'Nguyễn Văn Không Giấy',
      relationship: 'CHILD',
      currentGroup: 'CHILD_UNDER_18',
      birthDate: '2018-06-01',
      effectiveFromMonth: '2026-01',
      effectiveToMonth: '2026-12',
    });
    const res = buildUpdateDependentPayload(state);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toMatch(/CCCD|Giấy khai sinh/);
  });

  it('build payload thành công cho trẻ dưới 14 tuổi và giữ chuỗi rỗng để BE xóa trường tùy chọn', () => {
    const state = dependentDetailToFormState({
      fullName: 'Nguyễn Văn C',
      relationship: 'CHILD',
      currentGroup: 'CHILD_UNDER_18',
      birthDate: '2018-06-01',
      birthCertNumber: 'KS001',
      effectiveFromMonth: '2026-01',
      effectiveToMonth: '2026-12',
    });
    const res = buildUpdateDependentPayload(state);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.payload.birthCertNumber).toBe('KS001');
      expect(res.payload.citizenId).toBe('');
      expect(res.payload.taxIdNumber).toBe('');
      expect(res.payload.note).toBe('');
      expect(res.payload.birthDate).toBe('2018-06-01T00:00:00Z');
    }
  });

  it('giữ đồng thời cả CCCD và GKS khi người dùng nhập cả hai (không bỏ rơi ô còn lại)', () => {
    const state = dependentDetailToFormState({
      fullName: 'Nguyễn Văn D',
      relationship: 'CHILD',
      currentGroup: 'CHILD_UNDER_18',
      birthDate: '2018-06-01',
      citizenId: '079218001234',
      birthCertNumber: 'KS002',
      effectiveFromMonth: '2026-01',
      effectiveToMonth: '2026-12',
    });
    const res = buildUpdateDependentPayload(state);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.payload.citizenId).toBe('079218001234');
      expect(res.payload.birthCertNumber).toBe('KS002');
    }
  });

  it('API birthDate có giờ UTC vẫn parse đúng → người >= 14 dùng CCCD', () => {
    const state = dependentDetailToFormState({
      fullName: 'Nguyễn Văn Adult',
      relationship: 'CHILD',
      currentGroup: 'CHILD_OVER_18_STUDYING',
      birthDate: '2000-05-15T00:00:00Z',
      citizenId: '079200001234',
      effectiveFromMonth: '2026-01',
      effectiveToMonth: '2026-12',
    });
    expect(state.birthYear).toBe('2000');
    expect(state.birthMonth).toBe('05');
    expect(state.birthDay).toBe('15');
    const res = buildUpdateDependentPayload(state);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.payload.citizenId).toBe('079200001234');
      expect(res.payload.birthCertNumber).toBe('');
    }
  });

  it('từ chối khi vượt quá MaxLength của BE (fullName > 150, birthCert > 50, note > 500)', () => {
    const baseState = dependentDetailToFormState({
      fullName: 'Nguyễn Văn E',
      relationship: 'CHILD',
      currentGroup: 'CHILD_UNDER_18',
      birthDate: '2018-06-01',
      birthCertNumber: 'KS003',
      effectiveFromMonth: '2026-01',
      effectiveToMonth: '2026-12',
    });
    expect(buildUpdateDependentPayload({ ...baseState, fullName: 'A'.repeat(151) }).ok).toBe(false);
    expect(buildUpdateDependentPayload({ ...baseState, birthCertNumber: 'B'.repeat(51) }).ok).toBe(false);
    expect(buildUpdateDependentPayload({ ...baseState, note: 'C'.repeat(501) }).ok).toBe(false);
  });
});

describe('ngày sinh lịch', () => {
  it('31/02 không hợp lệ, năm nhuận 29/02 hợp lệ', () => {
    expect(isValidCalendarDate('2026', '02', '31')).toBe(false);
    expect(isValidCalendarDate('2026', '02', '29')).toBe(false);
    expect(isValidCalendarDate('2024', '02', '29')).toBe(true);
  });

  it('đổi sang tháng 2 thì hạ ngày 31 xuống 28 hoặc 29', () => {
    expect(clampBirthDay('31', '02', '2026')).toBe('28');
    expect(clampBirthDay('31', '02', '2024')).toBe('29');
  });

  it('payload từ chối ngày sinh không tồn tại', () => {
    const state = dependentDetailToFormState({
      fullName: 'A',
      relationship: 'CHILD',
      currentGroup: 'CHILD_UNDER_18',
      birthDate: '2018-06-01',
      birthCertNumber: 'KS1',
      effectiveFromMonth: '2026-01',
      effectiveToMonth: '2026-12',
    });
    const res = buildUpdateDependentPayload({ ...state, birthMonth: '02', birthDay: '31' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toMatch(/không tồn tại/);
  });
});

describe('nhân thân', () => {
  const base = dependentDetailToFormState({
    fullName: 'Nguyễn Văn A',
    relationship: 'CHILD',
    currentGroup: 'CHILD_UNDER_18',
    birthDate: '2015-01-01',
    birthCertNumber: 'KS1',
    effectiveFromMonth: '2026-01',
    effectiveToMonth: '2026-12',
  });

  it('đổi hoa thường tên không tính là đổi nhân thân', () => {
    expect(hasIdentityFieldChange({ ...base, fullName: 'nguyễn văn a' }, base)).toBe(false);
  });

  it('đổi tên tính là đổi nhân thân', () => {
    expect(hasIdentityFieldChange({ ...base, fullName: 'Trần B' }, base)).toBe(true);
  });

  it('chỉ hỏi xác nhận khi ACTIVE và có đổi nhân thân', () => {
    expect(needsIdentityChangeConfirm('ACTIVE', true)).toBe(true);
    expect(needsIdentityChangeConfirm('ACTIVE', false)).toBe(false);
    expect(needsIdentityChangeConfirm('PENDING_DOCUMENTS', true)).toBe(false);
  });
});
