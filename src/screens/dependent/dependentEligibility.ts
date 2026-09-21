/**
 * Eligibility: tuổi tại ngày bắt đầu hiệu lực → lọc quan hệ / nhóm NPT.
 * Grill Q1–Q12 (2026-09-20).
 */

export type RelationshipCode = 'CHILD' | 'SPOUSE' | 'PARENT' | 'OTHER_DEPENDENT';

/** UI group index 0..4 (Nhóm 1..5). */
export type ConditionGroupIndex = 0 | 1 | 2 | 3 | 4;

export const RELATIONSHIP_OPTIONS = [
  { value: 'CHILD' as const, label: 'Con đẻ, con nuôi, con riêng' },
  { value: 'SPOUSE' as const, label: 'Vợ hoặc Chồng' },
  { value: 'PARENT' as const, label: 'Cha mẹ đẻ, cha mẹ vợ/chồng, cha mẹ nuôi' },
  { value: 'OTHER_DEPENDENT' as const, label: 'Cá nhân khác không nơi nương tựa' },
];

export const CONDITION_GROUP_OPTIONS = [
  {
    index: 0 as ConditionGroupIndex,
    code: 'CHILD_UNDER_18',
    title: 'Nhóm 1: Con dưới 18 tuổi',
    subtitle: 'Độ tuổi tại ngày hiệu lực < 18 tuổi.',
  },
  {
    index: 1 as ConditionGroupIndex,
    code: 'CHILD_OVER_18_STUDYING',
    title: 'Nhóm 2: Con từ 18 tuổi trở lên đang đi học',
    subtitle: 'Đủ 18 tuổi trở lên tại ngày hiệu lực và còn đang theo học.',
  },
  {
    index: 2 as ConditionGroupIndex,
    code: 'DISABLED_DEPENDENT',
    title: 'Nhóm 3: Con bị khuyết tật / Mất khả năng lao động',
    subtitle: 'Quan hệ Con — mọi độ tuổi (khuyết tật / mất khả năng lao động).',
  },
  {
    index: 3 as ConditionGroupIndex,
    code: 'SPOUSE_OR_PARENTS',
    title: 'Nhóm 4: Vợ / Chồng hoặc Cha / Mẹ',
    subtitle: 'Vợ, chồng, cha mẹ — đủ 18 tuổi trở lên tại ngày hiệu lực.',
  },
  {
    index: 4 as ConditionGroupIndex,
    code: 'OTHER_DEPENDENT',
    title: 'Nhóm 5: Cá nhân không nơi nương tựa khác',
    subtitle: 'Anh, chị, em ruột, ông bà, cô dì chú bác, cháu ruột.',
  },
];

/** Tuổi tại `asOf` (thường = ngày 01 của tháng hiệu lực). Q8: đủ N trong ngày sinh nhật → age >= N. */
export function ageYearsAt(
  birthYear: number,
  birthMonth: number,
  birthDay: number,
  asOf: Date
): number {
  if (!birthYear || !birthMonth || !birthDay) return 0;
  let age = asOf.getFullYear() - birthYear;
  const m = asOf.getMonth() + 1 - birthMonth;
  if (m < 0 || (m === 0 && asOf.getDate() < birthDay)) {
    age--;
  }
  return Math.max(0, age);
}

/** Tháng hiệu lực YYYY-MM → Date as-of = ngày 1 tháng đó (local). */
export function effectiveMonthToAsOfDate(effectiveFromMonth: string): Date | null {
  const m = /^(\d{4})-(\d{2})$/.exec(effectiveFromMonth.trim());
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  if (mo < 1 || mo > 12) return null;
  return new Date(y, mo - 1, 1);
}

export function ageAtEffectiveFrom(
  birthDay: string,
  birthMonth: string,
  birthYear: string,
  effectiveFromMonth: string
): number {
  const asOf = effectiveMonthToAsOfDate(effectiveFromMonth);
  if (!asOf) return 0;
  return ageYearsAt(
    parseInt(birthYear, 10),
    parseInt(birthMonth, 10),
    parseInt(birthDay, 10),
    asOf
  );
}

export function isAge14OrOlderAtEffective(ageAtEffective: number): boolean {
  return ageAtEffective >= 14;
}

/**
 * Nhóm UI index hợp lệ với quan hệ.
 * Demo: bỏ ràng buộc tuổi tại hiệu lực (BE vẫn validate nếu bật).
 */
export function isGroupEligibleFor(
  groupIndex: number,
  relationship: string,
  _ageAtEffective: number
): boolean {
  const rel = relationship as RelationshipCode;
  switch (groupIndex) {
    case 0:
    case 1:
    case 2:
      return rel === 'CHILD';
    case 3:
      return rel === 'SPOUSE' || rel === 'PARENT';
    case 4:
      return rel === 'OTHER_DEPENDENT';
    default:
      return false;
  }
}

export function filterEligibleGroups(
  relationship: string,
  ageAtEffective: number
): typeof CONDITION_GROUP_OPTIONS {
  return CONDITION_GROUP_OPTIONS.filter((g) =>
    isGroupEligibleFor(g.index, relationship, ageAtEffective)
  );
}

export function filterEligibleRelationships(ageAtEffective: number): typeof RELATIONSHIP_OPTIONS {
  return RELATIONSHIP_OPTIONS.filter((r) =>
    filterEligibleGroups(r.value, ageAtEffective).length > 0
  );
}

export type EligibilitySelection = {
  relationship: string;
  selectedGroupIdx: number;
};

/**
 * Sau khi đổi tuổi/hiệu lực/quan hệ/nhóm: nếu selection invalid → clear phần hỏng.
 * Q6: xóa nhóm (và quan hệ nếu quan hệ cũng không còn hợp lệ).
 */
export function reconcileEligibilitySelection(
  current: EligibilitySelection,
  ageAtEffective: number
): { next: EligibilitySelection; clearedGroup: boolean; clearedRelationship: boolean } {
  let relationship = current.relationship;
  let selectedGroupIdx = current.selectedGroupIdx;
  let clearedRelationship = false;
  let clearedGroup = false;

  const relOk = filterEligibleRelationships(ageAtEffective).some((r) => r.value === relationship);
  if (!relOk) {
    relationship = '';
    selectedGroupIdx = -1;
    clearedRelationship = true;
    clearedGroup = current.selectedGroupIdx >= 0;
    return {
      next: { relationship, selectedGroupIdx },
      clearedGroup,
      clearedRelationship,
    };
  }

  if (!isGroupEligibleFor(selectedGroupIdx, relationship, ageAtEffective)) {
    selectedGroupIdx = -1;
    clearedGroup = true;
  }

  return {
    next: { relationship, selectedGroupIdx },
    clearedGroup,
    clearedRelationship,
  };
}

/** OCR: giữ field khác; bỏ nhóm/quan hệ nếu không hợp lệ với tuổi tại hiệu lực. */
export function sanitizeOcrEligibility(
  patch: { relationship?: string; selectedGroupIdx?: number },
  ageAtEffective: number
): { relationship?: string; selectedGroupIdx?: number; dropped: boolean } {
  let relationship = patch.relationship;
  let selectedGroupIdx = patch.selectedGroupIdx;
  let dropped = false;

  if (relationship) {
    const relOk = filterEligibleRelationships(ageAtEffective).some((r) => r.value === relationship);
    if (!relOk) {
      relationship = undefined;
      selectedGroupIdx = undefined;
      dropped = true;
      return { relationship, selectedGroupIdx, dropped };
    }
  }

  if (typeof selectedGroupIdx === 'number') {
    const rel = relationship || 'CHILD';
    if (!isGroupEligibleFor(selectedGroupIdx, rel, ageAtEffective)) {
      selectedGroupIdx = undefined;
      dropped = true;
    }
  }

  return { relationship, selectedGroupIdx, dropped };
}

/** Map UI group index + relationship → BE CurrentGroup enum (không silent override quan hệ). */
export function mapUiGroupToBackendEnum(
  selectedGroupIdx: number,
  relationship: string
): { relationship: string; currentGroup: string } | null {
  if (selectedGroupIdx < 0 || !relationship) return null;

  switch (selectedGroupIdx) {
    case 0:
      return relationship === 'CHILD'
        ? { relationship: 'CHILD', currentGroup: 'CHILD_UNDER_18' }
        : null;
    case 1:
      return relationship === 'CHILD'
        ? { relationship: 'CHILD', currentGroup: 'CHILD_OVER_18_STUDYING' }
        : null;
    case 2:
      return relationship === 'CHILD'
        ? { relationship: 'CHILD', currentGroup: 'CHILD_OVER_18_DISABLED' }
        : null;
    case 3:
      if (relationship === 'SPOUSE') {
        return { relationship: 'SPOUSE', currentGroup: 'SPOUSE_RETIRED' };
      }
      if (relationship === 'PARENT') {
        return { relationship: 'PARENT', currentGroup: 'PARENT_RETIRED' };
      }
      return null;
    case 4:
      return relationship === 'OTHER_DEPENDENT'
        ? { relationship: 'OTHER_DEPENDENT', currentGroup: 'OTHER_HELPLESS' }
        : null;
    default:
      return null;
  }
}

export const ELIGIBILITY_CLEARED_TOAST =
  'Lựa chọn quan hệ/nhóm không còn phù hợp với tuổi tại ngày hiệu lực. Vui lòng chọn lại.';
