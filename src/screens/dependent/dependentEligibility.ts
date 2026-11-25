/**
 * Eligibility: tuổi tại ngày bắt đầu hiệu lực → lọc quan hệ / nhóm NPT.
 * Quan hệ lấy từ GET /dependents/catalog; nhóm chọn được = catalog ∩ GET /dependents/groups?relationship=.
 */

import type { CatalogGroup, DependentCatalog } from '../../api/dependentDocumentApi';
import {
  findCatalogGroup,
  groupsForRelationship,
  uiTabForCatalogGroup,
  uiTabForGroup,
} from './dependentGroupUtils';

export type RelationshipCode = string;

type MaybeCatalog = DependentCatalog | null | undefined;

/** UI group index 0..4 (Nhóm 1..5) — chỉ còn dùng cho màn giải thích luật / ảnh minh chứng. */
export type ConditionGroupIndex = 0 | 1 | 2 | 3 | 4;

/** Một lựa chọn nhóm trên form đăng ký: mã + nhãn từ catalog. */
export type ConditionGroupOption = {
  code: string;
  title: string;
  subtitle: string;
  /** Tab luật 0..4 (phục vụ điều hướng ProofDocuments / OCR cũ). */
  index: number;
};

export type RelationshipOption = { value: string; label: string };

/** Danh sách quan hệ từ catalog, sắp theo displayOrder. */
export function relationshipOptions(catalog: MaybeCatalog): RelationshipOption[] {
  if (!catalog) return [];
  return [...catalog.relationships]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((r) => ({ value: r.code, label: r.name || r.code }));
}

/** Mô tả ngắn từ thuộc tính nhóm catalog (tuổi / đi học / khuyết tật). */
export function buildGroupSubtitle(group: CatalogGroup): string {
  const parts: string[] = [];
  if (group.minAge != null && group.maxAge != null) {
    parts.push(`Từ ${group.minAge} đến dưới ${group.maxAge} tuổi`);
  } else if (group.maxAge != null) {
    parts.push(`Dưới ${group.maxAge} tuổi`);
  } else if (group.minAge != null) {
    parts.push(`Từ ${group.minAge} tuổi trở lên`);
  }
  if (group.requireStudying) parts.push('Đang đi học');
  if (group.requireDisabled) parts.push('Khuyết tật / mất khả năng lao động');
  return parts.join(' · ') || 'Theo quy định hiện hành.';
}

/** Giao nhóm catalog với mã đã có rule (GET /dependents/groups). */
export function intersectConfiguredGroups(
  candidates: CatalogGroup[],
  configuredCodes: string[]
): CatalogGroup[] {
  const configured = new Set(configuredCodes.map((c) => String(c || '').toUpperCase()));
  return candidates.filter((g) => configured.has(g.code.toUpperCase()));
}

/**
 * Nhóm điều kiện để chọn trên UI.
 * - `catalog`: GET /dependents/catalog
 * - `configuredCodes`: GET /dependents/groups?relationship=… (null/undefined = chưa lọc theo rule)
 */
export function conditionGroupOptions(
  catalog: MaybeCatalog,
  relationship: string,
  configuredCodes?: string[] | null
): ConditionGroupOption[] {
  let groups = groupsForRelationship(catalog, relationship);
  if (configuredCodes) {
    groups = intersectConfiguredGroups(groups, configuredCodes);
  }
  return groups.map((g) => ({
    code: g.code,
    title: g.name || g.code,
    subtitle: buildGroupSubtitle(g),
    index: uiTabForCatalogGroup(g),
  }));
}

/** @deprecated Dùng conditionGroupOptions — giữ tên cũ cho chỗ gọi filterEligibleGroups. */
export function filterEligibleGroups(
  catalog: MaybeCatalog,
  relationship: string,
  _ageAtEffective: number,
  configuredCodes?: string[] | null
): ConditionGroupOption[] {
  return conditionGroupOptions(catalog, relationship, configuredCodes);
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

/** Nhóm catalog của quan hệ thuộc tab UI (ảnh minh chứng / giải thích luật). */
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

/** Mã nhóm có trong catalog, đúng quan hệ (và đúng danh sách đã cấu hình nếu truyền vào). */
export function isGroupCodeEligible(
  catalog: MaybeCatalog,
  groupCode: string,
  relationship: string,
  configuredCodes?: string[] | null
): boolean {
  if (!groupCode || !relationship) return false;
  return conditionGroupOptions(catalog, relationship, configuredCodes).some(
    (g) => g.code.toUpperCase() === groupCode.toUpperCase()
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
  /** Mã nhóm catalog đang chọn (vd CHILD_UNDER_18). */
  selectedGroupCode: string;
};

/**
 * Sau khi đổi tuổi/hiệu lực/quan hệ/nhóm: nếu selection invalid → clear phần hỏng.
 */
export function reconcileEligibilitySelection(
  catalog: MaybeCatalog,
  current: EligibilitySelection,
  ageAtEffective: number,
  configuredCodes?: string[] | null
): { next: EligibilitySelection; clearedGroup: boolean; clearedRelationship: boolean } {
  let relationship = current.relationship;
  let selectedGroupCode = current.selectedGroupCode;
  let clearedRelationship = false;
  let clearedGroup = false;

  const relOk = filterEligibleRelationships(catalog, ageAtEffective).some(
    (r) => r.value === relationship
  );
  if (!relOk) {
    relationship = '';
    selectedGroupCode = '';
    clearedRelationship = Boolean(current.relationship);
    clearedGroup = Boolean(current.selectedGroupCode);
    return {
      next: { relationship, selectedGroupCode },
      clearedGroup,
      clearedRelationship,
    };
  }

  if (!isGroupCodeEligible(catalog, selectedGroupCode, relationship, configuredCodes)) {
    selectedGroupCode = '';
    clearedGroup = Boolean(current.selectedGroupCode);
  }

  return {
    next: { relationship, selectedGroupCode },
    clearedGroup,
    clearedRelationship,
  };
}

/** OCR: giữ field khác; bỏ nhóm/quan hệ nếu không hợp lệ. Ưu tiên mã nhóm; tab cũ map sang nhóm đầu tiên của tab. */
export function sanitizeOcrEligibility(
  catalog: MaybeCatalog,
  patch: {
    relationship?: string;
    selectedGroupCode?: string;
    selectedGroupIdx?: number;
  },
  ageAtEffective: number,
  fallbackRelationship = '',
  configuredCodes?: string[] | null
): {
  relationship?: string;
  selectedGroupCode?: string;
  selectedGroupIdx?: number;
  dropped: boolean;
} {
  let relationship = patch.relationship;
  let selectedGroupCode = patch.selectedGroupCode;
  let selectedGroupIdx = patch.selectedGroupIdx;
  let dropped = false;

  if (relationship) {
    const relOk = filterEligibleRelationships(catalog, ageAtEffective).some(
      (r) => r.value === relationship
    );
    if (!relOk) {
      return {
        relationship: undefined,
        selectedGroupCode: undefined,
        selectedGroupIdx: undefined,
        dropped: true,
      };
    }
  }

  const rel = relationship || fallbackRelationship;

  if (!selectedGroupCode && typeof selectedGroupIdx === 'number' && rel) {
    const fromTab = selectGroupsForTab(catalog, selectedGroupIdx, rel);
    const filtered = configuredCodes
      ? intersectConfiguredGroups(fromTab, configuredCodes)
      : fromTab;
    if (filtered[0]) selectedGroupCode = filtered[0].code;
  }

  if (selectedGroupCode) {
    if (!isGroupCodeEligible(catalog, selectedGroupCode, rel, configuredCodes)) {
      selectedGroupCode = undefined;
      selectedGroupIdx = undefined;
      dropped = true;
    } else {
      selectedGroupIdx = Math.max(0, uiTabForGroup(catalog, selectedGroupCode));
    }
  } else if (typeof selectedGroupIdx === 'number') {
    if (!isGroupEligibleFor(catalog, selectedGroupIdx, rel, ageAtEffective)) {
      selectedGroupIdx = undefined;
      dropped = true;
    }
  }

  return { relationship, selectedGroupCode, selectedGroupIdx, dropped };
}

export const ELIGIBILITY_CLEARED_TOAST =
  'Lựa chọn quan hệ/nhóm không còn phù hợp với tuổi tại ngày hiệu lực. Vui lòng chọn lại.';

export const GROUP_NOT_CONFIGURED_MESSAGE = 'Nhóm này chưa được cấu hình giấy tờ.';

/** Tìm nhóm catalog theo mã (helper cho form). */
export function findEligibleGroupOption(
  options: ConditionGroupOption[],
  code?: string | null
): ConditionGroupOption | undefined {
  const c = String(code || '').toUpperCase();
  if (!c) return undefined;
  return options.find((g) => g.code.toUpperCase() === c);
}

/** Nhóm đầu tiên trong catalog (dùng khi không có mã OCR). */
export function firstCatalogGroupCode(catalog: MaybeCatalog, relationship: string): string {
  return groupsForRelationship(catalog, relationship)[0]?.code || '';
}

export function catalogGroupExists(catalog: MaybeCatalog, code?: string | null): boolean {
  return Boolean(findCatalogGroup(catalog, code));
}
