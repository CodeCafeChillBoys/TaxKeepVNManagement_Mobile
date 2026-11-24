/**
 * Eligibility: tuổi tại ngày bắt đầu hiệu lực → lọc quan hệ / nhóm NPT.
 * Grill Q1–Q12 (2026-09-20). Quan hệ và nhóm lấy từ catalog BE, tab "Nhóm 1–5" tính qua uiTabForGroup.
 */

import type { CatalogGroup, DependentCatalog } from '../../api/dependentDocumentApi';
import { groupsForRelationship, uiTabForCatalogGroup } from './dependentGroupUtils';

export type RelationshipCode = string;

type MaybeCatalog = DependentCatalog | null | undefined;

/** UI group index 0..4 (Nhóm 1..5). */
export type ConditionGroupIndex = 0 | 1 | 2 | 3 | 4;

/** Tiêu đề / mô tả 5 tab theo luật (nội dung luật, không phải mã nhóm). */
export const CONDITION_GROUP_OPTIONS = [
  {
    index: 0 as ConditionGroupIndex,
    title: 'Nhóm 1: Con dưới 18 tuổi',
    subtitle: 'Độ tuổi tại ngày hiệu lực < 18 tuổi.',
  },
  {
    index: 1 as ConditionGroupIndex,
    title: 'Nhóm 2: Con từ 18 tuổi trở lên đang đi học',
    subtitle: 'Đủ 18 tuổi trở lên tại ngày hiệu lực và còn đang theo học.',
  },
  {
    index: 2 as ConditionGroupIndex,
    title: 'Nhóm 3: Con bị khuyết tật / Mất khả năng lao động',
    subtitle: 'Quan hệ Con — mọi độ tuổi (khuyết tật / mất khả năng lao động).',
  },
  {
    index: 3 as ConditionGroupIndex,
    title: 'Nhóm 4: Vợ / Chồng hoặc Cha / Mẹ',
    subtitle: 'Vợ, chồng, cha mẹ — đủ 18 tuổi trở lên tại ngày hiệu lực.',
  },
  {
    index: 4 as ConditionGroupIndex,
    title: 'Nhóm 5: Cá nhân không nơi nương tựa khác',
    subtitle: 'Anh, chị, em ruột, ông bà, cô dì chú bác, cháu ruột.',
  },
];

export type RelationshipOption = { value: string; label: string };

/** Danh sách quan hệ từ catalog, sắp theo displayOrder. */
export function relationshipOptions(catalog: MaybeCatalog): RelationshipOption[] {
  if (!catalog) return [];
  return [...catalog.relationships]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((r) => ({ value: r.code, label: r.name || r.code }));
}

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

/** Nhóm catalog của quan hệ thuộc tab UI đang chọn (1 nhóm thì chọn luôn, nhiều nhóm thì mở picker). */
export function selectGroupsForTab(
  catalog: MaybeCatalog,
  groupIndex: number,
  relationship: string
): CatalogGroup[] {
  if (groupIndex < 0 || !relationship) return [];
  return groupsForRelationship(catalog, relationship).filter(
    (g) => uiTabForCatalogGroup(g) === groupIndex
  );
}

/**
 * Tab UI hợp lệ với quan hệ khi quan hệ có ít nhất 1 nhóm thuộc tab đó.
 * Demo: bỏ ràng buộc tuổi tại hiệu lực (BE vẫn validate nếu bật).
 */
export function isGroupEligibleFor(
  catalog: MaybeCatalog,
  groupIndex: number,
  relationship: string,
  _ageAtEffective: number
): boolean {
  return selectGroupsForTab(catalog, groupIndex, relationship).length > 0;
}

export function filterEligibleGroups(
  catalog: MaybeCatalog,
  relationship: string,
  ageAtEffective: number
): typeof CONDITION_GROUP_OPTIONS {
  return CONDITION_GROUP_OPTIONS.filter((g) =>
    isGroupEligibleFor(catalog, g.index, relationship, ageAtEffective)
  );
}

export function filterEligibleRelationships(
  catalog: MaybeCatalog,
  ageAtEffective: number
): RelationshipOption[] {
  return relationshipOptions(catalog).filter(
    (r) => filterEligibleGroups(catalog, r.value, ageAtEffective).length > 0
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
  catalog: MaybeCatalog,
  current: EligibilitySelection,
  ageAtEffective: number
): { next: EligibilitySelection; clearedGroup: boolean; clearedRelationship: boolean } {
  let relationship = current.relationship;
  let selectedGroupIdx = current.selectedGroupIdx;
  let clearedRelationship = false;
  let clearedGroup = false;

  const relOk = filterEligibleRelationships(catalog, ageAtEffective).some(
    (r) => r.value === relationship
  );
  if (!relOk) {
    relationship = '';
    selectedGroupIdx = -1;
    clearedRelationship = Boolean(current.relationship);
    clearedGroup = current.selectedGroupIdx >= 0;
    return {
      next: { relationship, selectedGroupIdx },
      clearedGroup,
      clearedRelationship,
    };
  }

  if (!isGroupEligibleFor(catalog, selectedGroupIdx, relationship, ageAtEffective)) {
    selectedGroupIdx = -1;
    clearedGroup = current.selectedGroupIdx >= 0;
  }

  return {
    next: { relationship, selectedGroupIdx },
    clearedGroup,
    clearedRelationship,
  };
}

/** OCR: giữ field khác; bỏ nhóm/quan hệ nếu không hợp lệ với tuổi tại hiệu lực. */
export function sanitizeOcrEligibility(
  catalog: MaybeCatalog,
  patch: { relationship?: string; selectedGroupIdx?: number },
  ageAtEffective: number,
  fallbackRelationship = ''
): { relationship?: string; selectedGroupIdx?: number; dropped: boolean } {
  let relationship = patch.relationship;
  let selectedGroupIdx = patch.selectedGroupIdx;
  let dropped = false;

  if (relationship) {
    const relOk = filterEligibleRelationships(catalog, ageAtEffective).some(
      (r) => r.value === relationship
    );
    if (!relOk) {
      relationship = undefined;
      selectedGroupIdx = undefined;
      dropped = true;
      return { relationship, selectedGroupIdx, dropped };
    }
  }

  if (typeof selectedGroupIdx === 'number') {
    const rel = relationship || fallbackRelationship;
    if (!isGroupEligibleFor(catalog, selectedGroupIdx, rel, ageAtEffective)) {
      selectedGroupIdx = undefined;
      dropped = true;
    }
  }

  return { relationship, selectedGroupIdx, dropped };
}

export const ELIGIBILITY_CLEARED_TOAST =
  'Lựa chọn quan hệ/nhóm không còn phù hợp với tuổi tại ngày hiệu lực. Vui lòng chọn lại.';

export const GROUP_NOT_CONFIGURED_MESSAGE = 'Nhóm này chưa được cấu hình giấy tờ.';

/** Giao nhóm của tab với danh sách nhóm đã có rule active (GET /dependents/groups). */
export function intersectConfiguredGroups(
  candidates: CatalogGroup[],
  configuredCodes: string[]
): CatalogGroup[] {
  const configured = new Set(configuredCodes.map((c) => String(c || '').toUpperCase()));
  return candidates.filter((g) => configured.has(g.code.toUpperCase()));
}
