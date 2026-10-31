import {
  filterChangeGroupOptions,
  groupCodeToIndex,
  groupsForRelationship,
  humanizeGroupCodes,
  mapDependentLifecycleError,
} from './dependentGroupUtils';

describe('dependentGroupUtils', () => {
  describe('groupsForRelationship', () => {
    it('returns CHILD groups for CHILD relationship', () => {
      expect(groupsForRelationship('CHILD')).toEqual([
        'CHILD_UNDER_18',
        'CHILD_OVER_18_STUDYING',
        'CHILD_OVER_18_DISABLED',
      ]);
    });

    it('returns SPOUSE groups for SPOUSE', () => {
      expect(groupsForRelationship('SPOUSE')).toEqual([
        'SPOUSE_DISABLED',
        'SPOUSE_RETIRED',
      ]);
    });

    it('returns empty for unknown relationship', () => {
      expect(groupsForRelationship('UNKNOWN')).toEqual([]);
    });
  });

  describe('filterChangeGroupOptions', () => {
    it('excludes current group and keeps same relationship only', () => {
      expect(filterChangeGroupOptions('CHILD', 'CHILD_UNDER_18')).toEqual([
        'CHILD_OVER_18_STUDYING',
        'CHILD_OVER_18_DISABLED',
      ]);
    });

    it('returns empty when OTHER_DEPENDENT already OTHER_HELPLESS', () => {
      expect(filterChangeGroupOptions('OTHER_DEPENDENT', 'OTHER_HELPLESS')).toEqual([]);
    });

    it('does not filter by age (FE age validate off)', () => {
      expect(filterChangeGroupOptions('CHILD', 'CHILD_OVER_18_DISABLED', 10)).toEqual([
        'CHILD_UNDER_18',
        'CHILD_OVER_18_STUDYING',
      ]);
      expect(filterChangeGroupOptions('CHILD', 'CHILD_UNDER_18', 30)).toEqual([
        'CHILD_OVER_18_STUDYING',
        'CHILD_OVER_18_DISABLED',
      ]);
      expect(filterChangeGroupOptions('PARENT', 'PARENT_RETIRED', 17)).toEqual([
        'PARENT_DISABLED',
      ]);
    });
  });

  describe('groupCodeToIndex', () => {
    it('maps known codes to LAW_GROUP index 0..4', () => {
      expect(groupCodeToIndex('CHILD_UNDER_18')).toBe(0);
      expect(groupCodeToIndex('CHILD_OVER_18_STUDYING')).toBe(1);
      expect(groupCodeToIndex('CHILD_OVER_18_DISABLED')).toBe(2);
      expect(groupCodeToIndex('SPOUSE_DISABLED')).toBe(3);
      expect(groupCodeToIndex('PARENT_RETIRED')).toBe(3);
      expect(groupCodeToIndex('OTHER_HELPLESS')).toBe(4);
    });

    it('defaults unknown to 0', () => {
      expect(groupCodeToIndex('NOPE')).toBe(0);
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
            data: { errors: { errorCode: 'INVALID_GROUP' } },
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
    it('replaces group enums with user labels', () => {
      const raw =
        "chuyển từ nhóm 'CHILD_OVER_18_STUDYING' sang nhóm 'CHILD_UNDER_18'.";
      expect(raw).not.toContain(humanizeGroupCodes(raw));
      expect(humanizeGroupCodes(raw)).toContain('Nhóm 2:');
      expect(humanizeGroupCodes(raw)).toContain('Nhóm 1:');
      expect(humanizeGroupCodes(raw)).not.toContain('CHILD_');
    });
  });
});
