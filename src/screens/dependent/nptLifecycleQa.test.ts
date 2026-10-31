/**
 * NPT-08 — Map QA checklist cases to seam assertions (PRD npt-lifecycle §9).
 */
import {
  buildHomeReminderChangeGroupPlan,
  runHomeReminderChangeGroup,
} from '../home/homeReminderChangeGroup';
import {
  buildManualChangeGroupPlan,
  runManualChangeGroup,
} from './manualChangeGroup';
import { buildSoftDeletePlan, runSoftDeleteDependent } from './softDeleteDependent';
import { resolveProofDocumentsChecklist } from './proofDocumentsParams';
import { filterChangeGroupOptions } from './dependentGroupUtils';

describe('NPT-08 QA checklist (automated seams)', () => {
  describe('Case 1 — Reminder cancel dialog', () => {
    it('builds confirm plan without calling PATCH (cancel = no API)', () => {
      const plan = buildHomeReminderChangeGroupPlan({
        dependentId: 'dep-1',
        fullName: 'Be A',
        recommendedGroup: 'CHILD_OVER_18_STUDYING',
      });
      expect(plan.dependentId).toBe('dep-1');
      expect(plan.newGroup).toBe('CHILD_OVER_18_STUDYING');
      // Screen only calls run* after user confirms — cancel never reaches here.
    });
  });

  describe('Case 2 — Reminder confirm → PATCH → ProofDocuments', () => {
    it('returns navigation only after successful PATCH', async () => {
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
      expect(updateDependentGroup).toHaveBeenCalled();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.navigation.params.groupIndex).toBe(1);
      expect(result.navigation.params.requiredDocuments).toEqual(['STUDENT_CARD']);
    });
  });

  describe('Case 3 — Reminder when BE down', () => {
    it('returns network message and no navigation', async () => {
      const updateDependentGroup = jest.fn().mockRejectedValue({
        message: 'Network Error',
      });
      const result = await runHomeReminderChangeGroup({
        dependentId: 'dep-1',
        newGroup: 'CHILD_OVER_18_STUDYING',
        updateDependentGroup,
      });
      expect(result).toEqual({
        ok: false,
        message: 'Không kết nối được. Thử lại.',
      });
    });
  });

  describe('Case 4 — Manual change group', () => {
    it('PATCHes and navigates to ProofDocuments', async () => {
      const updateDependentGroup = jest.fn().mockResolvedValue({
        success: true,
        message: 'ok',
        data: {
          dependentId: 'dep-1',
          previousGroup: 'CHILD_UNDER_18',
          currentGroup: 'CHILD_OVER_18_DISABLED',
          status: 'PENDING_DOCUMENTS',
          isProfileComplete: false,
          requiredDocuments: ['DISABILITY_CERTIFICATE'],
          documents: [],
        },
      });
      const result = await runManualChangeGroup({
        dependentId: 'dep-1',
        newGroup: 'CHILD_OVER_18_DISABLED',
        updateDependentGroup,
      });
      expect(result.ok).toBe(true);
    });
  });

  describe('Case 5 — Picker same Relationship only', () => {
    it('never offers SPOUSE groups for CHILD', () => {
      const options = filterChangeGroupOptions('CHILD', 'CHILD_UNDER_18');
      expect(options.every((g) => g.startsWith('CHILD_'))).toBe(true);
      expect(options).not.toContain('SPOUSE_DISABLED');
    });
  });

  describe('Case 6 — Delete from detail with reason', () => {
    it('sends reason and refreshList', async () => {
      const plan = buildSoftDeletePlan({
        dependentId: 'dep-1',
        fullName: 'A',
      });
      expect(plan.reasonOptional).toBe(true);
      const deleteDependent = jest.fn().mockResolvedValue({
        success: true,
        message: 'Đã vô hiệu hóa',
        data: { dependentId: 'dep-1', status: 'INACTIVE', isDeleted: true },
      });
      const result = await runSoftDeleteDependent({
        dependentId: 'dep-1',
        reason: 'Không còn NPT',
        deleteDependent,
      });
      expect(deleteDependent).toHaveBeenCalledWith('dep-1', {
        reason: 'Không còn NPT',
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.refreshList).toBe(true);
    });
  });

  describe('Case 7 — Delete from list menu without reason', () => {
    it('DELETEs with undefined body and refreshList', async () => {
      const deleteDependent = jest.fn().mockResolvedValue({
        success: true,
        message: 'ok',
        data: { dependentId: 'dep-1', status: 'INACTIVE', isDeleted: true },
      });
      const result = await runSoftDeleteDependent({
        dependentId: 'dep-1',
        deleteDependent,
      });
      expect(deleteDependent).toHaveBeenCalledWith('dep-1', undefined);
      expect(result.ok).toBe(true);
    });
  });

  describe('Case 8 — Delete forbidden', () => {
    it('maps 403', async () => {
      const deleteDependent = jest.fn().mockRejectedValue({
        response: { status: 403, data: {} },
      });
      const result = await runSoftDeleteDependent({
        dependentId: 'other',
        deleteDependent,
      });
      expect(result).toEqual({
        ok: false,
        message: 'Bạn không có quyền với người phụ thuộc này.',
      });
    });
  });

  describe('Case 9 — No restore UI contract', () => {
    it('soft-delete plan warns irreversible on app', () => {
      const plan = buildSoftDeletePlan({
        dependentId: 'dep-1',
        fullName: 'A',
      });
      expect(plan.confirmMessage).toMatch(/không thể khôi phục/i);
    });
  });

  describe('NPT-07 checklist params', () => {
    it('prefers PATCH requiredDocuments', () => {
      expect(
        resolveProofDocumentsChecklist({
          requiredDocuments: ['STUDENT_CARD'],
          fallbackDocTypes: ['BIRTH_CERTIFICATE'],
        })
      ).toEqual(['STUDENT_CARD']);
    });
  });
});
