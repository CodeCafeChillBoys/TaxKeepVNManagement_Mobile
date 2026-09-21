import {
  buildHomeReminderChangeGroupPlan,
  runHomeReminderChangeGroup,
} from './homeReminderChangeGroup';

describe('homeReminderChangeGroup', () => {
  const reminder = {
    dependentId: 'dep-1',
    fullName: 'Nguyen Van B',
    recommendedGroup: 'CHILD_OVER_18_STUDYING',
  };

  describe('buildHomeReminderChangeGroupPlan', () => {
    it('builds confirm copy from reminder recommendedGroup', () => {
      const plan = buildHomeReminderChangeGroupPlan(reminder);
      expect(plan.dependentId).toBe('dep-1');
      expect(plan.newGroup).toBe('CHILD_OVER_18_STUDYING');
      expect(plan.confirmTitle).toMatch(/chuyển nhóm/i);
      expect(plan.confirmMessage).toContain('Nguyen Van B');
      expect(plan.confirmMessage).toContain('CHILD_OVER_18_STUDYING');
    });
  });

  describe('runHomeReminderChangeGroup', () => {
    it('PATCHes then returns ProofDocuments navigation params', async () => {
      const updateDependentGroup = jest.fn().mockResolvedValue({
        success: true,
        message: 'ok',
        data: {
          dependentId: 'dep-1',
          previousGroup: 'CHILD_UNDER_18',
          currentGroup: 'CHILD_OVER_18_STUDYING',
          status: 'PENDING_DOCUMENTS',
          isProfileComplete: false,
          requiredDocuments: ['STUDENT_CARD'],
          documents: [],
        },
      });

      const result = await runHomeReminderChangeGroup({
        dependentId: 'dep-1',
        newGroup: 'CHILD_OVER_18_STUDYING',
        updateDependentGroup,
      });

      expect(updateDependentGroup).toHaveBeenCalledWith('dep-1', {
        newGroup: 'CHILD_OVER_18_STUDYING',
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.navigation).toEqual({
        screen: 'ProofDocuments',
        params: {
          dependentId: 'dep-1',
          groupIndex: 1,
          requiredDocuments: ['STUDENT_CARD'],
        },
      });
    });

    it('returns failure without navigation when PATCH fails', async () => {
      const updateDependentGroup = jest.fn().mockRejectedValue({
        response: {
          status: 400,
          data: { errors: { errorCode: 'SAME_GROUP' } },
        },
      });

      const result = await runHomeReminderChangeGroup({
        dependentId: 'dep-1',
        newGroup: 'CHILD_OVER_18_STUDYING',
        updateDependentGroup,
      });

      expect(result).toEqual({
        ok: false,
        message: 'Người phụ thuộc đã ở nhóm này.',
      });
    });

    it('returns failure when API success=false', async () => {
      const updateDependentGroup = jest.fn().mockResolvedValue({
        success: false,
        message: 'Lỗi BE',
        data: null,
      });

      const result = await runHomeReminderChangeGroup({
        dependentId: 'dep-1',
        newGroup: 'CHILD_OVER_18_STUDYING',
        updateDependentGroup,
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.message).toMatch(/Lỗi BE|thử lại/i);
    });
  });
});
