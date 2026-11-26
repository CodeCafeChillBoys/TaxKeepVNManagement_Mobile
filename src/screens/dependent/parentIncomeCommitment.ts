/**
 * Cam kết thu nhập cha/mẹ — ngưỡng hiển thị FE (khớp seed BE hiện tại).
 * BE vẫn là nơi kiểm tra cuối cùng qua SystemConfig.
 *
 * Chuẩn: bắt cam kết khi đã đạt/vượt ngưỡng tuổi lao động
 * (Nam >= 62, Nữ >= 60).
 */
export const PARENT_MALE_MAX_AGE = 62;
export const PARENT_FEMALE_MAX_AGE = 60;
export const PARENT_MONTHLY_INCOME_LIMIT_VND = 1_000_000;

export const PARENT_GROUP_RETIRED = 'PARENT_RETIRED';
export const PARENT_GROUP_DISABLED = 'PARENT_DISABLED';

export type DependentGenderApi = 'MALE' | 'FEMALE' | 'OTHER';

export const GENDER_OPTIONS: { value: DependentGenderApi; label: string }[] = [
  { value: 'MALE', label: 'Nam' },
  { value: 'FEMALE', label: 'Nữ' },
  { value: 'OTHER', label: 'Khác' },
];

export function formatIncomeLimitVnd(amount = PARENT_MONTHLY_INCOME_LIMIT_VND): string {
  return `${amount.toLocaleString('vi-VN')} VND`;
}

/** Tuổi theo ngày sinh tính đến asOf (mặc định hôm nay local). */
export function ageYearsFromBirthParts(
  birthDay: string,
  birthMonth: string,
  birthYear: string,
  asOf: Date = new Date()
): number {
  const y = parseInt(birthYear, 10);
  const m = parseInt(birthMonth, 10);
  const d = parseInt(birthDay, 10);
  if (!y || !m || !d) return 0;
  let age = asOf.getFullYear() - y;
  const monthDiff = asOf.getMonth() + 1 - m;
  if (monthDiff < 0 || (monthDiff === 0 && asOf.getDate() < d)) {
    age--;
  }
  return Math.max(0, age);
}

function isParentMaleOrFemale(relationship: string, gender: string): boolean {
  if (relationship.trim().toUpperCase() !== 'PARENT') return false;
  const g = gender.trim().toUpperCase();
  return g === 'MALE' || g === 'FEMALE';
}

/** Đã đạt/vượt ngưỡng tuổi lao động theo giới tính. */
export function isParentAtOrOverWorkingAgeThreshold(
  gender: string,
  ageYears: number
): boolean {
  const g = gender.trim().toUpperCase();
  if (g === 'MALE') return ageYears >= PARENT_MALE_MAX_AGE;
  if (g === 'FEMALE') return ageYears >= PARENT_FEMALE_MAX_AGE;
  return false;
}

/**
 * BE bắt buộc cam kết khi PARENT + Nam/Nữ đã đạt/vượt ngưỡng tuổi.
 */
export function needsParentIncomeCommitment(
  relationship: string,
  gender: string,
  ageYears: number
): boolean {
  if (!isParentMaleOrFemale(relationship, gender)) return false;
  return isParentAtOrOverWorkingAgeThreshold(gender, ageYears);
}

/**
 * Hiện checkbox khi:
 * PARENT + Nam/Nữ + đã đạt/vượt ngưỡng tuổi + nhóm PARENT_RETIRED.
 */
export function showParentIncomeCommitmentCheckbox(
  relationship: string,
  gender: string,
  ageYears: number,
  groupCode: string
): boolean {
  if (!needsParentIncomeCommitment(relationship, gender, ageYears)) return false;
  return groupCode.trim().toUpperCase() === PARENT_GROUP_RETIRED;
}

/**
 * PARENT_DISABLED (đã đạt ngưỡng) → tự true.
 * PARENT_RETIRED (đã đạt ngưỡng) → theo tick.
 * Còn lại → false.
 */
export function resolveConfirmIncomeBelowThreshold(
  relationship: string,
  gender: string,
  ageYears: number,
  groupCode: string,
  userChecked: boolean
): boolean {
  if (!needsParentIncomeCommitment(relationship, gender, ageYears)) return false;
  const group = groupCode.trim().toUpperCase();
  if (group === PARENT_GROUP_DISABLED) return true;
  if (group === PARENT_GROUP_RETIRED) return userChecked;
  return false;
}

/** PARENT + OTHER: FE cảnh báo trước khi gọi API. */
export function isParentOtherGenderBlocked(relationship: string, gender: string): boolean {
  return (
    relationship.trim().toUpperCase() === 'PARENT' && gender.trim().toUpperCase() === 'OTHER'
  );
}

export function parentIncomeCommitmentLabel(
  limitVnd = PARENT_MONTHLY_INCOME_LIMIT_VND
): string {
  return `Tôi cam kết thu nhập hàng tháng của cha/mẹ không vượt quá ${formatIncomeLimitVnd(limitVnd)}.`;
}
