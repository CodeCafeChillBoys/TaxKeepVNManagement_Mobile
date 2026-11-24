import {
  buildEffectivePeriodUpdatePayload,
  formatPeriodShort,
  isBeforeBirthMonth,
  shiftYearMonth,
} from './editEffectivePeriod';

describe('formatPeriodShort / shiftYearMonth', () => {
  it('định dạng Ttháng/năm', () => {
    expect(formatPeriodShort('2026-01')).toBe('T1/2026');
    expect(formatPeriodShort('2026-12')).toBe('T12/2026');
  });

  it('dịch tháng sang năm kế', () => {
    expect(shiftYearMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftYearMonth('2026-01', -1)).toBe('2025-12');
  });
});

describe('isBeforeBirthMonth', () => {
  it('tháng trước tháng sinh thì true, đúng tháng sinh thì false', () => {
    expect(isBeforeBirthMonth('2015-09', '2015-10-15')).toBe(true);
    expect(isBeforeBirthMonth('2015-10', '2015-10-15T00:00:00Z')).toBe(false);
    expect(isBeforeBirthMonth('2016-01', '2015-10-15')).toBe(false);
  });
});

describe('buildEffectivePeriodUpdatePayload', () => {
  const childDetail = {
    fullName: 'Nguyễn Thị Lan',
    relationship: 'CHILD',
    currentGroup: 'CHILD_UNDER_18',
    birthDate: '2015-10-15T00:00:00Z',
    birthCertNumber: '068204005531',
    effectiveFromMonth: '2026-01',
    effectiveToMonth: '2026-12',
  };

  it('đổi kỳ hiệu lực, không gửi quan hệ/nhóm, cho phép tháng quá khứ sau tháng sinh', () => {
    const res = buildEffectivePeriodUpdatePayload(childDetail, '2015-11', '2016-06');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.payload.effectiveFromMonth).toBe('2015-11');
      expect(res.payload.birthCertNumber).toBe('068204005531');
      expect(res.payload).not.toHaveProperty('relationship');
      expect(res.payload).not.toHaveProperty('currentGroup');
    }
  });

  it('từ > đến → lỗi', () => {
    const res = buildEffectivePeriodUpdatePayload(childDetail, '2026-12', '2026-03');
    expect(res.ok).toBe(false);
  });

  it('tháng bắt đầu trước tháng sinh → lỗi', () => {
    const res = buildEffectivePeriodUpdatePayload(childDetail, '2015-09', '2016-12');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toMatch(/trước tháng sinh \(10\/2015\)/);
  });

  it('người >= 14 cần CCCD 12 số', () => {
    const res = buildEffectivePeriodUpdatePayload(
      {
        fullName: 'Adult',
        birthDate: '2000-01-01T00:00:00Z',
        citizenId: '123',
      },
      '2026-03',
      '2026-12'
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toMatch(/CCCD/);
  });
});
