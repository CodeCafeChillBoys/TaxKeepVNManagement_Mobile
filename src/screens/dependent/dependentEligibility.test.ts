import {
  ageAtEffectiveFrom,
  ageYearsAt,
  buildGroupSubtitle,
  conditionGroupOptions,
  ELIGIBILITY_CLEARED_TOAST,
  filterEligibleGroups,
  filterEligibleRelationships,
  intersectConfiguredGroups,
  isAge14OrOlderAtEffective,
  isGroupCodeEligible,
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
      expect(ageYearsAt(2008, 1, 1, new Date(2026, 0, 1))).toBe(18);
      expect(ageYearsAt(2008, 1, 2, new Date(2026, 0, 1))).toBe(17);
    });

    it('age at effectiveFrom month uses day 1 of that month', () => {
      expect(ageAtEffectiveFrom('20', '10', '1995', '2026-01')).toBe(30);
    });

    it('isAge14OrOlderAtEffective', () => {
      expect(isAge14OrOlderAtEffective(13)).toBe(false);
      expect(isAge14OrOlderAtEffective(14)).toBe(true);
    });
  });

  describe('conditionGroupOptions (catalog + getGroups)', () => {
    it('lists catalog groups for a relationship with catalog names', () => {
      const opts = conditionGroupOptions(C, 'CHILD');
      expect(opts.map((g) => g.code)).toEqual([
        'CHILD_UNDER_18',
        'CHILD_OVER_18_DISABLED',
        'CHILD_OVER_18_STUDYING',
      ]);
      expect(opts[0].title).toBeTruthy();
      expect(opts[0].title).not.toMatch(/^Nhóm \d/);
      expect(opts.every((g) => typeof g.code === 'string')).toBe(true);
    });

    it('intersects with configured codes from GET /dependents/groups', () => {
      const opts = conditionGroupOptions(C, 'PARENT', ['PARENT_RETIRED']);
      expect(opts.map((g) => g.code)).toEqual(['PARENT_RETIRED']);
    });

    it('returns empty when catalog missing or relationship empty', () => {
      expect(conditionGroupOptions(null, 'CHILD')).toEqual([]);
      expect(conditionGroupOptions(C, '')).toEqual([]);
    });

    it('buildGroupSubtitle uses catalog attributes', () => {
      const under18 = C.groups.find((g) => g.code === 'CHILD_UNDER_18')!;
      expect(buildGroupSubtitle(under18)).toMatch(/tuổi/i);
      const studying = C.groups.find((g) => g.code === 'CHILD_OVER_18_STUDYING')!;
      expect(buildGroupSubtitle(studying)).toMatch(/đi học/i);
    });
  });

  describe('group matrix (relationship only — age FE validate off)', () => {
    it('group 1–3 only CHILD (any age)', () => {
      expect(isGroupEligibleFor(C, 0, 'CHILD', 17)).toBe(true);
      expect(isGroupEligibleFor(C, 0, 'PARENT', 10)).toBe(false);
      expect(isGroupCodeEligible(C, 'CHILD_UNDER_18', 'CHILD')).toBe(true);
      expect(isGroupCodeEligible(C, 'PARENT_RETIRED', 'CHILD')).toBe(false);
    });

    it('filterEligibleGroups returns catalog options for PARENT', () => {
      expect(filterEligibleGroups(C, 'PARENT', 30).map((g) => g.code)).toEqual([
        'PARENT_DISABLED',
        'PARENT_RETIRED',
      ]);
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
    it('clears group code when relationship mismatches', () => {
      const r = reconcileEligibilitySelection(
        C,
        { relationship: 'PARENT', selectedGroupCode: 'CHILD_UNDER_18' },
        30
      );
      expect(r.clearedGroup).toBe(true);
      expect(r.next.selectedGroupCode).toBe('');
      expect(r.next.relationship).toBe('PARENT');
    });

    it('keeps PARENT_RETIRED for PARENT', () => {
      const r = reconcileEligibilitySelection(
        C,
        { relationship: 'PARENT', selectedGroupCode: 'PARENT_RETIRED' },
        10
      );
      expect(r.clearedRelationship).toBe(false);
      expect(r.next.selectedGroupCode).toBe('PARENT_RETIRED');
    });

    it('clears a relationship that is no longer in the catalog', () => {
      const r = reconcileEligibilitySelection(
        C,
        { relationship: 'REMOVED', selectedGroupCode: 'OTHER_HELPLESS' },
        10
      );
      expect(r.clearedRelationship).toBe(true);
      expect(r.next).toEqual({ relationship: '', selectedGroupCode: '' });
    });

    it('clears group when not in configured codes', () => {
      const r = reconcileEligibilitySelection(
        C,
        { relationship: 'PARENT', selectedGroupCode: 'PARENT_RETIRED' },
        30,
        ['PARENT_DISABLED']
      );
      expect(r.clearedGroup).toBe(true);
      expect(r.next.selectedGroupCode).toBe('');
    });
  });

  describe('sanitizeOcrEligibility', () => {
    it('keeps group code from OCR when valid', () => {
      const s = sanitizeOcrEligibility(
        C,
        { relationship: 'CHILD', selectedGroupCode: 'CHILD_UNDER_18' },
        10
      );
      expect(s.selectedGroupCode).toBe('CHILD_UNDER_18');
      expect(s.selectedGroupIdx).toBe(0);
      expect(s.dropped).toBe(false);
    });

    it('maps tab index to first group of that tab', () => {
      const s = sanitizeOcrEligibility(C, { selectedGroupIdx: 0 }, 10, 'CHILD');
      expect(s.selectedGroupCode).toBe('CHILD_UNDER_18');
    });

    it('drops mismatched tab for relationship', () => {
      expect(sanitizeOcrEligibility(C, { selectedGroupIdx: 3 }, 30, 'CHILD').dropped).toBe(true);
      expect(sanitizeOcrEligibility(C, { selectedGroupIdx: 3 }, 30, 'PARENT').dropped).toBe(false);
    });
  });

  it('exports cleared toast copy', () => {
    expect(ELIGIBILITY_CLEARED_TOAST.length).toBeGreaterThan(10);
  });
});
