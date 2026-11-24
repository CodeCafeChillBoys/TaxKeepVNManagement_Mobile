import {
  ageAtEffectiveFrom,
  ageYearsAt,
  CONDITION_GROUP_OPTIONS,
  ELIGIBILITY_CLEARED_TOAST,
  filterEligibleGroups,
  filterEligibleRelationships,
  intersectConfiguredGroups,
  isAge14OrOlderAtEffective,
  isGroupEligibleFor,
  reconcileEligibilitySelection,
  relationshipOptions,
  sanitizeOcrEligibility,
  selectGroupsForTab,
} from './dependentEligibility';
import { SEED_CATALOG } from './seedCatalog.test.fixture';
import type { DependentCatalog } from '../../api/dependentDocumentApi';

const C = SEED_CATALOG;

describe('dependentEligibility', () => {
  describe('ageYearsAt / ageAtEffectiveFrom', () => {
    it('counts 18 on birthday at as-of (Q8)', () => {
      // Born 2008-01-01, as-of 2026-01-01 → 18
      expect(ageYearsAt(2008, 1, 1, new Date(2026, 0, 1))).toBe(18);
      // Day before birthday still 17
      expect(ageYearsAt(2008, 1, 2, new Date(2026, 0, 1))).toBe(17);
    });

    it('age at effectiveFrom month uses day 1 of that month', () => {
      // DOB 1995-10-20, effective 2026-01 → 30
      expect(ageAtEffectiveFrom('20', '10', '1995', '2026-01')).toBe(30);
    });
  });

  describe('CONDITION_GROUP_OPTIONS', () => {
    it('keeps 5 law tabs without hard-coded group codes', () => {
      expect(CONDITION_GROUP_OPTIONS.map((g) => g.index)).toEqual([0, 1, 2, 3, 4]);
      CONDITION_GROUP_OPTIONS.forEach((g) => expect(g).not.toHaveProperty('code'));
    });
  });

  describe('group matrix (relationship only — age FE validate off)', () => {
    it('group 1–3 only CHILD (any age)', () => {
      expect(isGroupEligibleFor(C, 0, 'CHILD', 17)).toBe(true);
      expect(isGroupEligibleFor(C, 0, 'CHILD', 18)).toBe(true);
      expect(isGroupEligibleFor(C, 0, 'PARENT', 10)).toBe(false);
      expect(isGroupEligibleFor(C, 1, 'CHILD', 17)).toBe(true);
      expect(isGroupEligibleFor(C, 2, 'CHILD', 5)).toBe(true);
      expect(isGroupEligibleFor(C, 2, 'SPOUSE', 40)).toBe(false);
    });

    it('group 4 SPOUSE/PARENT (any age)', () => {
      expect(isGroupEligibleFor(C, 3, 'PARENT', 30)).toBe(true);
      expect(isGroupEligibleFor(C, 3, 'SPOUSE', 18)).toBe(true);
      expect(isGroupEligibleFor(C, 3, 'CHILD', 40)).toBe(false);
    });

    it('group 5 OTHER only', () => {
      expect(isGroupEligibleFor(C, 4, 'OTHER_DEPENDENT', 10)).toBe(true);
      expect(isGroupEligibleFor(C, 4, 'CHILD', 10)).toBe(false);
    });

    it('CHILD sees groups 1–3; PARENT sees group 4', () => {
      expect(filterEligibleGroups(C, 'CHILD', 10).map((g) => g.index)).toEqual([0, 1, 2]);
      expect(filterEligibleGroups(C, 'PARENT', 30).map((g) => g.index)).toEqual([3]);
    });

    it('nothing is eligible before the catalog loads', () => {
      expect(isGroupEligibleFor(null, 0, 'CHILD', 10)).toBe(false);
      expect(filterEligibleRelationships(null, 10)).toEqual([]);
    });
  });

  describe('relationshipOptions / filterEligibleRelationships', () => {
    it('lists relationships from catalog with catalog names', () => {
      expect(relationshipOptions(C)).toEqual([
        { value: 'CHILD', label: 'Con' },
        { value: 'SPOUSE', label: 'Vợ/chồng' },
        { value: 'PARENT', label: 'Cha/mẹ' },
        { value: 'OTHER_DEPENDENT', label: 'Cá nhân khác không nơi nương tựa' },
      ]);
    });

    it('drops relationships without any group', () => {
      const catalog: DependentCatalog = {
        relationships: [...C.relationships, { code: 'GRANDCHILD', name: 'Cháu', displayOrder: 5 }],
        groups: C.groups,
      };
      expect(filterEligibleRelationships(catalog, 10).map((r) => r.value)).toEqual([
        'CHILD',
        'SPOUSE',
        'PARENT',
        'OTHER_DEPENDENT',
      ]);
    });
  });

  describe('selectGroupsForTab', () => {
    it('returns one group when the tab has one group for the relationship', () => {
      expect(selectGroupsForTab(C, 0, 'CHILD').map((g) => g.code)).toEqual(['CHILD_UNDER_18']);
      expect(selectGroupsForTab(C, 4, 'OTHER_DEPENDENT').map((g) => g.code)).toEqual(['OTHER_HELPLESS']);
    });

    it('returns several groups for tab 4 (sub-group picker)', () => {
      expect(selectGroupsForTab(C, 3, 'PARENT').map((g) => g.code)).toEqual([
        'PARENT_DISABLED',
        'PARENT_RETIRED',
      ]);
    });

    it('returns empty on mismatch', () => {
      expect(selectGroupsForTab(C, 3, 'CHILD')).toEqual([]);
      expect(selectGroupsForTab(C, -1, 'CHILD')).toEqual([]);
      expect(selectGroupsForTab(C, 0, '')).toEqual([]);
    });
  });

  describe('intersectConfiguredGroups', () => {
    it('keeps only groups that have active rules', () => {
      const candidates = selectGroupsForTab(C, 3, 'PARENT');
      expect(intersectConfiguredGroups(candidates, ['PARENT_DISABLED']).map((g) => g.code)).toEqual([
        'PARENT_DISABLED',
      ]);
      expect(intersectConfiguredGroups(candidates, [])).toEqual([]);
    });
  });

  describe('reconcileEligibilitySelection (Q6)', () => {
    it('clears group 1 when PARENT (relationship mismatch)', () => {
      const r = reconcileEligibilitySelection(C, { relationship: 'PARENT', selectedGroupIdx: 0 }, 30);
      expect(r.clearedGroup).toBe(true);
      expect(r.next.selectedGroupIdx).toBe(-1);
      expect(r.next.relationship).toBe('PARENT');
    });

    it('keeps PARENT + group 4 even under 18 (age off)', () => {
      const r = reconcileEligibilitySelection(C, { relationship: 'PARENT', selectedGroupIdx: 3 }, 10);
      expect(r.clearedRelationship).toBe(false);
      expect(r.next.relationship).toBe('PARENT');
      expect(r.next.selectedGroupIdx).toBe(3);
    });

    it('clears a relationship that is no longer in the catalog', () => {
      const r = reconcileEligibilitySelection(C, { relationship: 'REMOVED', selectedGroupIdx: 4 }, 10);
      expect(r.clearedRelationship).toBe(true);
      expect(r.next).toEqual({ relationship: '', selectedGroupIdx: -1 });
    });
  });

  describe('sanitizeOcrEligibility (Q9)', () => {
    it('keeps group 1 for CHILD any age (age off)', () => {
      const s = sanitizeOcrEligibility(C, { relationship: 'CHILD', selectedGroupIdx: 0 }, 30);
      expect(s.dropped).toBe(false);
      expect(s.selectedGroupIdx).toBe(0);
      expect(s.relationship).toBe('CHILD');
    });

    it('uses fallback relationship when OCR gives only the tab', () => {
      expect(sanitizeOcrEligibility(C, { selectedGroupIdx: 3 }, 30, 'PARENT').dropped).toBe(false);
      expect(sanitizeOcrEligibility(C, { selectedGroupIdx: 3 }, 30, 'CHILD').dropped).toBe(true);
    });
  });

  describe('CCCD threshold (Q7)', () => {
    it('uses age at effective', () => {
      expect(isAge14OrOlderAtEffective(14)).toBe(true);
      expect(isAge14OrOlderAtEffective(13)).toBe(false);
    });
  });

  it('exports toast copy', () => {
    expect(ELIGIBILITY_CLEARED_TOAST).toMatch(/hiệu lực/i);
  });
});
