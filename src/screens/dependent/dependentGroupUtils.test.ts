import {
  filterChangeGroupOptions,
  groupName,
  groupsForRelationship,
  humanizeGroupCodes,
  mapDependentLifecycleError,
  relationshipName,
  uiTabForGroup,
} from './dependentGroupUtils';
import { SEED_CATALOG } from './seedCatalog.test.fixture';
import type { DependentCatalog } from '../../api/dependentDocumentApi';

describe('dependentGroupUtils', () => {
  describe('groupsForRelationship', () => {
    it('returns CHILD groups sorted by displayOrder', () => {
      expect(groupsForRelationship(SEED_CATALOG, 'CHILD').map((g) => g.code)).toEqual([
        'CHILD_UNDER_18',
        'CHILD_OVER_18_DISABLED',
        'CHILD_OVER_18_STUDYING',
      ]);
    });

    it('sorts by displayOrder, not by array order', () => {
      const catalog: DependentCatalog = {
        relationships: [],
        groups: [
          { ...SEED_CATALOG.groups[4], displayOrder: 1 },
          { ...SEED_CATALOG.groups[3], displayOrder: 2 },
        ],
      };
      expect(groupsForRelationship(catalog, 'SPOUSE').map((g) => g.code)).toEqual([
        'SPOUSE_RETIRED',
        'SPOUSE_DISABLED',
      ]);
    });

    it('returns empty for unknown relationship or missing catalog', () => {
      expect(groupsForRelationship(SEED_CATALOG, 'UNKNOWN')).toEqual([]);
      expect(groupsForRelationship(null, 'CHILD')).toEqual([]);
    });
  });

  describe('groupName / relationshipName', () => {
    it('returns catalog name', () => {
      expect(groupName(SEED_CATALOG, 'PARENT_RETIRED')).toBe('Cha/Mẹ ngoài độ tuổi lao động');
      expect(groupName(SEED_CATALOG, 'parent_retired')).toBe('Cha/Mẹ ngoài độ tuổi lao động');
      expect(relationshipName(SEED_CATALOG, 'SPOUSE')).toBe('Vợ/chồng');
    });

    it('falls back to the code when not found', () => {
      expect(groupName(SEED_CATALOG, 'NEW_AI_GROUP')).toBe('NEW_AI_GROUP');
      expect(groupName(null, 'CHILD_UNDER_18')).toBe('CHILD_UNDER_18');
      expect(groupName(SEED_CATALOG, undefined)).toBe('');
    });
  });

  describe('filterChangeGroupOptions', () => {
    it('same relationship, excludes current, level >= current', () => {
      expect(filterChangeGroupOptions(SEED_CATALOG, 'CHILD', 'CHILD_UNDER_18')).toEqual([
        'CHILD_OVER_18_DISABLED',
        'CHILD_OVER_18_STUDYING',
      ]);
    });

    it('does not offer a lower level (BE blocks downgrade)', () => {
      expect(filterChangeGroupOptions(SEED_CATALOG, 'CHILD', 'CHILD_OVER_18_STUDYING')).toEqual([
        'CHILD_OVER_18_DISABLED',
      ]);
      expect(filterChangeGroupOptions(SEED_CATALOG, 'PARENT', 'PARENT_RETIRED')).toEqual([]);
      expect(filterChangeGroupOptions(SEED_CATALOG, 'PARENT', 'PARENT_DISABLED')).toEqual([
        'PARENT_RETIRED',
      ]);
    });

    it('returns empty when relationship has a single group', () => {
      expect(filterChangeGroupOptions(SEED_CATALOG, 'OTHER_DEPENDENT', 'OTHER_HELPLESS')).toEqual([]);
    });
  });

  describe('uiTabForGroup', () => {
    it('maps all 8 seed groups by attributes', () => {
      expect(uiTabForGroup(SEED_CATALOG, 'CHILD_UNDER_18')).toBe(0);
      expect(uiTabForGroup(SEED_CATALOG, 'CHILD_OVER_18_STUDYING')).toBe(1);
      expect(uiTabForGroup(SEED_CATALOG, 'CHILD_OVER_18_DISABLED')).toBe(2);
      expect(uiTabForGroup(SEED_CATALOG, 'SPOUSE_DISABLED')).toBe(3);
      expect(uiTabForGroup(SEED_CATALOG, 'SPOUSE_RETIRED')).toBe(3);
      expect(uiTabForGroup(SEED_CATALOG, 'PARENT_DISABLED')).toBe(3);
      expect(uiTabForGroup(SEED_CATALOG, 'PARENT_RETIRED')).toBe(3);
      expect(uiTabForGroup(SEED_CATALOG, 'OTHER_HELPLESS')).toBe(4);
    });

    it('maps new groups added by admin without code changes', () => {
      const catalog: DependentCatalog = {
        relationships: [],
        groups: [
          ...SEED_CATALOG.groups,
          { code: 'FOSTER_CHILD', name: 'Con nuôi', relationshipCode: 'CHILD', requireDisabled: false, requireStudying: false, level: 0, displayOrder: 9 },
          { code: 'GRANDCHILD', name: 'Cháu', relationshipCode: 'GRANDCHILD', requireDisabled: false, requireStudying: false, level: 0, displayOrder: 10 },
        ],
      };
      expect(uiTabForGroup(catalog, 'FOSTER_CHILD')).toBe(0);
      expect(uiTabForGroup(catalog, 'GRANDCHILD')).toBe(4);
    });

    it('returns -1 for codes not in catalog', () => {
      expect(uiTabForGroup(SEED_CATALOG, 'NOPE')).toBe(-1);
      expect(uiTabForGroup(null, 'CHILD_UNDER_18')).toBe(-1);
    });
  });

  describe('mapDependentLifecycleError', () => {
    it('maps SAME_GROUP errorCode to Vietnamese message', () => {
      const err = {
        response: {
          status: 400,
          data: {
            success: false,
            message: 'same',
            errors: { errorCode: 'SAME_GROUP' },
          },
        },
      };
      expect(mapDependentLifecycleError(err)).toBe(
        'Người phụ thuộc đã ở nhóm này.'
      );
    });

    it('maps INVALID_GROUP, GROUP_RELATIONSHIP_MISMATCH, GROUP_AGE_MISMATCH', () => {
      expect(
        mapDependentLifecycleError({
          response: {
            status: 400,
            data: {
              message: 'Nhóm không hợp lệ. Mã hợp lệ: CHILD_UNDER_18, NEW_GROUP',
              errors: { errorCode: 'INVALID_GROUP' },
            },
          },
        })
      ).toBe('Nhóm điều kiện không hợp lệ.');
      expect(
        mapDependentLifecycleError({
          response: {
            status: 400,
            data: { errors: { errorCode: 'GROUP_RELATIONSHIP_MISMATCH' } },
          },
        })
      ).toBe('Nhóm không khớp quan hệ hiện tại.');
      expect(
        mapDependentLifecycleError({
          response: {
            status: 400,
            data: { errors: { errorCode: 'GROUP_AGE_MISMATCH' } },
          },
        })
      ).toMatch(/tuổi.*hiệu lực/i);
    });

    it('maps RULES_NOT_CONFIGURED', () => {
      expect(
        mapDependentLifecycleError({
          response: { status: 400, data: { errors: { errorCode: 'RULES_NOT_CONFIGURED' } } },
        })
      ).toMatch(/chưa được cấu hình danh mục giấy tờ/);
    });

    it('maps 403, 404, and network', () => {
      expect(
        mapDependentLifecycleError({ response: { status: 403, data: {} } })
      ).toBe('Bạn không có quyền với người phụ thuộc này.');
      expect(
        mapDependentLifecycleError({ response: { status: 404, data: {} } })
      ).toBe('Không tìm thấy người phụ thuộc.');
      expect(mapDependentLifecycleError({ message: 'Network Error' })).toBe(
        'Không kết nối được. Thử lại.'
      );
      expect(mapDependentLifecycleError({ code: 'ECONNABORTED' })).toBe(
        'Không kết nối được. Thử lại.'
      );
    });
  });

  describe('humanizeGroupCodes', () => {
    it('replaces group codes with catalog names', () => {
      const raw =
        "chuyển từ nhóm 'CHILD_OVER_18_STUDYING' sang nhóm 'CHILD_UNDER_18'.";
      const out = humanizeGroupCodes(SEED_CATALOG, raw);
      expect(out).toContain('Con từ 18 tuổi trở lên đang đi học');
      expect(out).toContain('Con dưới 18 tuổi');
      expect(out).not.toContain('CHILD_');
    });

    it('replaces longer codes first', () => {
      const catalog: DependentCatalog = {
        relationships: [],
        groups: [
          { code: 'CHILD', name: 'Con', relationshipCode: 'CHILD', requireDisabled: false, requireStudying: false, level: 0, displayOrder: 1 },
          { code: 'CHILD_STUDYING', name: 'Con đi học', relationshipCode: 'CHILD', requireDisabled: false, requireStudying: true, level: 1, displayOrder: 2 },
        ],
      };
      expect(humanizeGroupCodes(catalog, 'CHILD_STUDYING')).toBe('Con đi học');
    });

    it('keeps text when catalog not loaded', () => {
      expect(humanizeGroupCodes(null, 'abc')).toBe('abc');
      expect(humanizeGroupCodes(SEED_CATALOG, null)).toBe('');
    });
  });
});
