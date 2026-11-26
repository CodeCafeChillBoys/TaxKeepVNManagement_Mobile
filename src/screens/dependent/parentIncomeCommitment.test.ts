import {
  ageYearsFromBirthParts,
  isParentOtherGenderBlocked,
  needsParentIncomeCommitment,
  PARENT_FEMALE_MAX_AGE,
  PARENT_MALE_MAX_AGE,
  parentIncomeCommitmentLabel,
  resolveConfirmIncomeBelowThreshold,
  showParentIncomeCommitmentCheckbox,
} from './parentIncomeCommitment';

describe('parentIncomeCommitment', () => {
  const asOf = new Date(2026, 10, 26); // 26/11/2026

  describe('ageYearsFromBirthParts', () => {
    it('tính tuổi đúng trước/sau sinh nhật', () => {
      expect(ageYearsFromBirthParts('27', '11', '1965', asOf)).toBe(60);
      expect(ageYearsFromBirthParts('26', '11', '1965', asOf)).toBe(61);
      expect(ageYearsFromBirthParts('25', '11', '1964', asOf)).toBe(62);
    });
  });

  describe('needsParentIncomeCommitment', () => {
    it('chỉ áp dụng PARENT khi đã đạt/vượt ngưỡng theo giới tính', () => {
      expect(needsParentIncomeCommitment('PARENT', 'MALE', PARENT_MALE_MAX_AGE - 1)).toBe(false);
      expect(needsParentIncomeCommitment('PARENT', 'MALE', PARENT_MALE_MAX_AGE)).toBe(true);
      expect(needsParentIncomeCommitment('PARENT', 'MALE', PARENT_MALE_MAX_AGE + 1)).toBe(true);
      expect(needsParentIncomeCommitment('PARENT', 'FEMALE', PARENT_FEMALE_MAX_AGE - 1)).toBe(false);
      expect(needsParentIncomeCommitment('PARENT', 'FEMALE', PARENT_FEMALE_MAX_AGE)).toBe(true);
      expect(needsParentIncomeCommitment('PARENT', 'OTHER', 70)).toBe(false);
      expect(needsParentIncomeCommitment('CHILD', 'MALE', 70)).toBe(false);
    });
  });

  describe('showParentIncomeCommitmentCheckbox', () => {
    it('chỉ hiện PARENT_RETIRED khi đã đạt ngưỡng', () => {
      expect(
        showParentIncomeCommitmentCheckbox('PARENT', 'MALE', PARENT_MALE_MAX_AGE, 'PARENT_RETIRED')
      ).toBe(true);
      expect(
        showParentIncomeCommitmentCheckbox('PARENT', 'MALE', PARENT_MALE_MAX_AGE - 1, 'PARENT_RETIRED')
      ).toBe(false);
      expect(
        showParentIncomeCommitmentCheckbox('PARENT', 'MALE', 70, 'PARENT_DISABLED')
      ).toBe(false);
      expect(showParentIncomeCommitmentCheckbox('PARENT', '', 70, 'PARENT_RETIRED')).toBe(false);
    });
  });

  describe('resolveConfirmIncomeBelowThreshold', () => {
    it('DISABLED tự true khi đạt ngưỡng; RETIRED theo tick; dưới ngưỡng thì false', () => {
      expect(
        resolveConfirmIncomeBelowThreshold('PARENT', 'FEMALE', 70, 'PARENT_DISABLED', false)
      ).toBe(true);
      expect(
        resolveConfirmIncomeBelowThreshold('PARENT', 'FEMALE', 50, 'PARENT_DISABLED', false)
      ).toBe(false);
      expect(
        resolveConfirmIncomeBelowThreshold('PARENT', 'FEMALE', 70, 'PARENT_RETIRED', false)
      ).toBe(false);
      expect(
        resolveConfirmIncomeBelowThreshold('PARENT', 'FEMALE', 70, 'PARENT_RETIRED', true)
      ).toBe(true);
    });
  });

  describe('isParentOtherGenderBlocked', () => {
    it('chặn PARENT + OTHER', () => {
      expect(isParentOtherGenderBlocked('PARENT', 'OTHER')).toBe(true);
      expect(isParentOtherGenderBlocked('PARENT', 'MALE')).toBe(false);
    });
  });

  describe('parentIncomeCommitmentLabel', () => {
    it('có nội dung cam kết và số tiền', () => {
      expect(parentIncomeCommitmentLabel()).toContain('1.000.000');
      expect(parentIncomeCommitmentLabel()).toContain('cam kết thu nhập');
    });
  });
});
