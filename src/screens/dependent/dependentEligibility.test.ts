import {
  ageAtEffectiveFrom,
  ageYearsAt,
  ELIGIBILITY_CLEARED_TOAST,
  filterEligibleGroups,
  filterEligibleRelationships,
  isAge14OrOlderAtEffective,
  isGroupEligibleFor,
  mapUiGroupToBackendEnum,
  reconcileEligibilitySelection,
  sanitizeOcrEligibility,
} from './dependentEligibility';

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

  describe('group matrix (relationship only — age FE validate off)', () => {
    it('group 1–3 only CHILD (any age)', () => {
      expect(isGroupEligibleFor(0, 'CHILD', 17)).toBe(true);
      expect(isGroupEligibleFor(0, 'CHILD', 18)).toBe(true);
      expect(isGroupEligibleFor(0, 'PARENT', 10)).toBe(false);
      expect(isGroupEligibleFor(1, 'CHILD', 17)).toBe(true);
      expect(isGroupEligibleFor(1, 'CHILD', 18)).toBe(true);
      expect(isGroupEligibleFor(2, 'CHILD', 5)).toBe(true);
      expect(isGroupEligibleFor(2, 'SPOUSE', 40)).toBe(false);
    });

    it('group 4 SPOUSE/PARENT (any age)', () => {
      expect(isGroupEligibleFor(3, 'PARENT', 30)).toBe(true);
      expect(isGroupEligibleFor(3, 'SPOUSE', 18)).toBe(true);
      expect(isGroupEligibleFor(3, 'PARENT', 17)).toBe(true);
      expect(isGroupEligibleFor(3, 'CHILD', 40)).toBe(false);
    });

    it('group 5 OTHER only', () => {
      expect(isGroupEligibleFor(4, 'OTHER_DEPENDENT', 10)).toBe(true);
      expect(isGroupEligibleFor(4, 'CHILD', 10)).toBe(false);
    });

    it('CHILD sees groups 1–3; PARENT sees group 4', () => {
      expect(filterEligibleGroups('CHILD', 10).map((g) => g.index)).toEqual([0, 1, 2]);
      expect(filterEligibleGroups('CHILD', 30).map((g) => g.index)).toEqual([0, 1, 2]);
      expect(filterEligibleGroups('PARENT', 30).map((g) => g.index)).toEqual([3]);
    });
  });

  describe('filterEligibleRelationships', () => {
    it('all relationships available regardless of age', () => {
      const vals = filterEligibleRelationships(10).map((r) => r.value);
      expect(vals).toEqual(['CHILD', 'SPOUSE', 'PARENT', 'OTHER_DEPENDENT']);
    });
  });

  describe('reconcileEligibilitySelection (Q6)', () => {
    it('clears group 1 when PARENT (relationship mismatch)', () => {
      const r = reconcileEligibilitySelection(
        { relationship: 'PARENT', selectedGroupIdx: 0 },
        30
      );
      expect(r.clearedGroup).toBe(true);
      expect(r.next.selectedGroupIdx).toBe(-1);
      expect(r.next.relationship).toBe('PARENT');
    });

    it('keeps PARENT + group 4 even under 18 (age off)', () => {
      const r = reconcileEligibilitySelection(
        { relationship: 'PARENT', selectedGroupIdx: 3 },
        10
      );
      expect(r.clearedRelationship).toBe(false);
      expect(r.next.relationship).toBe('PARENT');
      expect(r.next.selectedGroupIdx).toBe(3);
    });
  });

  describe('sanitizeOcrEligibility (Q9)', () => {
    it('keeps group 1 for CHILD any age (age off)', () => {
      const s = sanitizeOcrEligibility(
        { relationship: 'CHILD', selectedGroupIdx: 0 },
        30
      );
      expect(s.dropped).toBe(false);
      expect(s.selectedGroupIdx).toBe(0);
      expect(s.relationship).toBe('CHILD');
    });
  });

  describe('CCCD threshold (Q7)', () => {
    it('uses age at effective', () => {
      expect(isAge14OrOlderAtEffective(14)).toBe(true);
      expect(isAge14OrOlderAtEffective(13)).toBe(false);
    });
  });

  describe('mapUiGroupToBackendEnum', () => {
    it('maps without silent override of SPOUSE vs PARENT on group 4', () => {
      expect(mapUiGroupToBackendEnum(3, 'SPOUSE')).toEqual({
        relationship: 'SPOUSE',
        currentGroup: 'SPOUSE_RETIRED',
      });
      expect(mapUiGroupToBackendEnum(3, 'PARENT')).toEqual({
        relationship: 'PARENT',
        currentGroup: 'PARENT_RETIRED',
      });
      expect(mapUiGroupToBackendEnum(3, 'CHILD')).toBeNull();
    });
  });

  it('exports toast copy', () => {
    expect(ELIGIBILITY_CLEARED_TOAST).toMatch(/hiệu lực/i);
  });
});
