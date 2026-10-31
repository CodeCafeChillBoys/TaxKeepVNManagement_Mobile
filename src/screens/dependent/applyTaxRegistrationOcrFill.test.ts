import {
  applyTaxRegistrationOcrFill,
  buildDependentScanParams,
  isTaxRegistrationFormDirty,
  parseBirthDateParts,
} from './applyTaxRegistrationOcrFill';

describe('parseBirthDateParts', () => {
  it('parses ISO yyyy-MM-dd', () => {
    expect(parseBirthDateParts('2005-01-15')).toEqual({
      birthDay: '15',
      birthMonth: '01',
      birthYear: '2005',
    });
  });

  it('parses dd/MM/yyyy', () => {
    expect(parseBirthDateParts('15/06/2018')).toEqual({
      birthDay: '15',
      birthMonth: '06',
      birthYear: '2018',
    });
  });

  it('returns null for invalid date', () => {
    expect(parseBirthDateParts('')).toBeNull();
    expect(parseBirthDateParts('not-a-date')).toBeNull();
  });
});

describe('applyTaxRegistrationOcrFill', () => {
  it('fills name, birth parts, and citizenId without touching group when idx missing', () => {
    const plan = applyTaxRegistrationOcrFill({
      fullName: 'Nguyễn Văn B',
      birthDate: '2005-01-15',
      citizenId: '079301001111',
      suggestedGroup: 'WEIRD',
    });

    expect(plan.patch.fullName).toBe('Nguyễn Văn B');
    expect(plan.patch.birthDay).toBe('15');
    expect(plan.patch.birthMonth).toBe('01');
    expect(plan.patch.birthYear).toBe('2005');
    expect(plan.patch.citizenId).toBe('079301001111');
    expect(plan.patch.birthCertNumber).toBeUndefined();
    expect(plan.patch.selectedGroupIdx).toBeUndefined();
    expect(plan.patch.relationship).toBeUndefined();
    expect(plan.alertMessage).toMatch(/kiểm tra trước khi tiếp tục/i);
  });

  it('fills birthCertNumber and group/relationship when provided', () => {
    const plan = applyTaxRegistrationOcrFill({
      fullName: 'Bé Na',
      birthDate: '2015-06-01',
      birthCertNumber: 'GKS-77',
      selectedGroupIdx: 0,
      relationship: 'CHILD',
      suggestedGroup: 'CHILD_UNDER_18',
    });

    expect(plan.patch.birthCertNumber).toBe('GKS-77');
    expect(plan.patch.citizenId).toBeUndefined();
    expect(plan.patch.selectedGroupIdx).toBe(0);
    expect(plan.patch.relationship).toBe('CHILD');
  });

  it('sets group idx 1 for studying alias path when fill already mapped', () => {
    const plan = applyTaxRegistrationOcrFill({
      fullName: 'A',
      birthDate: '2005-01-01',
      citizenId: '079301001111',
      selectedGroupIdx: 1,
      relationship: 'CHILD',
    });

    expect(plan.patch.selectedGroupIdx).toBe(1);
    expect(plan.patch.relationship).toBe('CHILD');
  });
});

describe('buildDependentScanParams / isTaxRegistrationFormDirty', () => {
  it('builds ScanIdentity dependent params from dirty flag', () => {
    expect(buildDependentScanParams(true)).toEqual({
      source: 'dependent',
      hasExistingData: true,
    });
    expect(buildDependentScanParams(false)).toEqual({
      source: 'dependent',
      hasExistingData: false,
    });
  });

  it('detects dirty form when name or ids changed from defaults', () => {
    expect(
      isTaxRegistrationFormDirty({
        fullName: '',
        citizenId: '',
        birthCertNumber: '',
      })
    ).toBe(false);
    expect(
      isTaxRegistrationFormDirty({
        fullName: 'A',
        citizenId: '',
        birthCertNumber: '',
      })
    ).toBe(true);
  });
});
