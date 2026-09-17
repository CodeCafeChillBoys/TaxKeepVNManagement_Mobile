import {
  aliasSuggestedGroup,
  mapExtractedDependentToFields,
  mapToDependentFill,
  mapUserCccdToFields,
  normalizeGender,
  normalizeOcrForForm,
} from './ocrUtils';

describe('ocrUtils mappers', () => {
  describe('normalizeGender', () => {
    it('maps MALE/FEMALE and Vietnamese labels to Nam/Nữ', () => {
      expect(normalizeGender('MALE')).toBe('Nam');
      expect(normalizeGender('FEMALE')).toBe('Nữ');
      expect(normalizeGender('Nam')).toBe('Nam');
      expect(normalizeGender('Nữ')).toBe('Nữ');
      expect(normalizeGender('male')).toBe('Nam');
      expect(normalizeGender('')).toBe('');
      expect(normalizeGender(null)).toBe('');
      expect(normalizeGender('OTHER')).toBe('');
    });
  });

  describe('aliasSuggestedGroup (PRD §8.4)', () => {
    it('maps CHILD_OVER_18_STUDENT to idx 1 with CHILD', () => {
      expect(aliasSuggestedGroup('CHILD_OVER_18_STUDENT')).toEqual({
        selectedGroupIdx: 1,
        relationship: 'CHILD',
      });
    });

    it('maps known codes per alias table', () => {
      expect(aliasSuggestedGroup('CHILD_UNDER_18')).toEqual({
        selectedGroupIdx: 0,
        relationship: 'CHILD',
      });
      expect(aliasSuggestedGroup('CHILD_OVER_18_STUDYING')).toEqual({
        selectedGroupIdx: 1,
        relationship: 'CHILD',
      });
      expect(aliasSuggestedGroup('DISABLED_DEPENDENT')).toEqual({
        selectedGroupIdx: 2,
        relationship: 'CHILD',
      });
      expect(aliasSuggestedGroup('CHILD_OVER_18_DISABLED')).toEqual({
        selectedGroupIdx: 2,
        relationship: 'CHILD',
      });
      expect(aliasSuggestedGroup('SPOUSE')).toEqual({
        selectedGroupIdx: 3,
        relationship: 'SPOUSE',
      });
      expect(aliasSuggestedGroup('ELDERLY_PARENT')).toEqual({
        selectedGroupIdx: 3,
        relationship: 'PARENT',
      });
      expect(aliasSuggestedGroup('PARENT_RETIRED')).toEqual({
        selectedGroupIdx: 3,
        relationship: 'PARENT',
      });
      expect(aliasSuggestedGroup('SPOUSE_OR_PARENTS')).toEqual({
        selectedGroupIdx: 3,
      });
      expect(aliasSuggestedGroup('OTHER')).toEqual({
        selectedGroupIdx: 4,
        relationship: 'OTHER_DEPENDENT',
      });
      expect(aliasSuggestedGroup('OTHER_DEPENDENT')).toEqual({
        selectedGroupIdx: 4,
        relationship: 'OTHER_DEPENDENT',
      });
      expect(aliasSuggestedGroup('OTHER_HELPLESS')).toEqual({
        selectedGroupIdx: 4,
        relationship: 'OTHER_DEPENDENT',
      });
    });

    it('returns null for empty or unknown codes', () => {
      expect(aliasSuggestedGroup('')).toBeNull();
      expect(aliasSuggestedGroup(null)).toBeNull();
      expect(aliasSuggestedGroup('WEIRD_CODE')).toBeNull();
    });
  });

  describe('mapUserCccdToFields', () => {
    it('maps auth CCCD DTO to review fields and OcrFormFill', () => {
      const mapped = mapUserCccdToFields({
        fullName: 'NGUYỄN VĂN A',
        citizenId: '079-30100-1234',
        dateOfBirth: '12/05/1990',
        gender: 'MALE',
        address: '  123   Lê Lợi  ',
        isAvailable: false,
        warning: 'Số CCCD này đã được đăng ký tài khoản trong hệ thống.',
      });

      expect(mapped.fields).toMatchObject({
        fullName: 'NGUYỄN VĂN A',
        citizenId: '079301001234',
        dateOfBirth: '12/05/1990',
        address: '123 Lê Lợi',
        gender: 'Nam',
        isAvailable: false,
        warning: 'Số CCCD này đã được đăng ký tài khoản trong hệ thống.',
      });
      expect(mapped.fill).toEqual({
        fullName: 'Nguyễn Văn A',
        citizenId: '079301001234',
        dateOfBirth: '1990-05-12',
        address: '123 Lê Lợi',
        isAvailable: false,
        warning: 'Số CCCD này đã được đăng ký tài khoản trong hệ thống.',
      });
    });
  });

  describe('mapExtractedDependentToFields', () => {
    it('maps dependent DTO with residencePlace preferred over originPlace', () => {
      const fields = mapExtractedDependentToFields({
        fullName: 'TRẦN THỊ B',
        citizenId: null,
        birthDate: '2015-03-20',
        gender: 'FEMALE',
        residencePlace: 'Q1, TP.HCM',
        originPlace: 'Hue',
        issueDate: '2016-01-01',
        documentNumber: 'GKS-001',
        suggestedGroup: 'CHILD_UNDER_18',
        isReadable: true,
      });

      expect(fields.fullName).toBe('TRẦN THỊ B');
      expect(fields.dateOfBirth).toBe('2015-03-20');
      expect(fields.gender).toBe('Nữ');
      expect(fields.address).toBe('Q1, TP.HCM');
      expect(fields.documentNumber).toBe('GKS-001');
      expect(fields.suggestedGroup).toBe('CHILD_UNDER_18');
      expect(fields.citizenId).toBe('');
    });

    it('falls back to originPlace when residencePlace missing', () => {
      const fields = mapExtractedDependentToFields({
        fullName: 'A',
        birthDate: '2010-01-01',
        originPlace: 'Da Nang',
        isReadable: true,
      });
      expect(fields.address).toBe('Da Nang');
    });
  });

  describe('mapToDependentFill', () => {
    const asOf = new Date('2026-09-17T00:00:00Z');

    it('uses citizenId when age >= 14 and CCCD has 12 digits', () => {
      const fill = mapToDependentFill(
        {
          fullName: 'NGUYỄN VĂN C',
          citizenId: '079301001111',
          dateOfBirth: '2005-01-01',
          address: '',
          gender: 'Nam',
          issueDate: '',
        },
        'CHILD_OVER_18_STUDENT',
        asOf
      );

      expect(fill.fullName).toBe('Nguyễn Văn C');
      expect(fill.birthDate).toBe('2005-01-01');
      expect(fill.citizenId).toBe('079301001111');
      expect(fill.birthCertNumber).toBeUndefined();
      expect(fill.selectedGroupIdx).toBe(1);
      expect(fill.relationship).toBe('CHILD');
      expect(fill.suggestedGroup).toBe('CHILD_OVER_18_STUDENT');
    });

    it('uses birthCertNumber when age < 14', () => {
      const fill = mapToDependentFill(
        {
          fullName: 'BÉ NA',
          citizenId: '',
          dateOfBirth: '2015-06-01',
          address: '',
          gender: 'Nữ',
          issueDate: '',
          documentNumber: 'GKS-77',
        },
        'CHILD_UNDER_18',
        asOf
      );

      expect(fill.birthCertNumber).toBe('GKS-77');
      expect(fill.citizenId).toBeUndefined();
      expect(fill.selectedGroupIdx).toBe(0);
      expect(fill.relationship).toBe('CHILD');
    });

    it('uses birthCertNumber when no 12-digit CCCD even if age >= 14', () => {
      const fill = mapToDependentFill(
        {
          fullName: 'A',
          citizenId: '123',
          dateOfBirth: '2000-01-01',
          address: '',
          gender: '',
          issueDate: '',
          documentNumber: 'GKS-9',
        },
        undefined,
        asOf
      );

      expect(fill.birthCertNumber).toBe('GKS-9');
      expect(fill.citizenId).toBeUndefined();
      expect(fill.selectedGroupIdx).toBeUndefined();
      expect(fill.relationship).toBeUndefined();
    });

    it('does not set relationship for SPOUSE_OR_PARENTS', () => {
      const fill = mapToDependentFill(
        {
          fullName: 'A',
          citizenId: '079301001234',
          dateOfBirth: '1960-01-01',
          address: '',
          gender: '',
          issueDate: '',
        },
        'SPOUSE_OR_PARENTS',
        asOf
      );

      expect(fill.selectedGroupIdx).toBe(3);
      expect(fill.relationship).toBeUndefined();
    });
  });

  describe('normalizeOcrForForm', () => {
    it('passes through isAvailable and warning when present', () => {
      const fill = normalizeOcrForForm({
        fullName: 'NGUYỄN VĂN A',
        citizenId: '079 301001234',
        dateOfBirth: '12/05/1990',
        address: '  Ha  Noi ',
        gender: 'Nam',
        issueDate: '',
        isAvailable: false,
        warning: 'trùng',
      });

      expect(fill).toEqual({
        fullName: 'Nguyễn Văn A',
        citizenId: '079301001234',
        dateOfBirth: '1990-05-12',
        address: 'Ha Noi',
        isAvailable: false,
        warning: 'trùng',
      });
    });
  });
});
