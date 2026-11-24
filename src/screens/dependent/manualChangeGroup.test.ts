import {
  buildManualChangeGroupPlan,
  runManualChangeGroup,
} from './manualChangeGroup';
import { SEED_CATALOG } from './seedCatalog.test.fixture';

describe('manualChangeGroup', () => {
  it('builds options excluding current group for CHILD', () => {
    const plan = buildManualChangeGroupPlan({
      dependentId: 'dep-1',
      fullName: 'Be Na',
      relationship: 'CHILD',
      currentGroup: 'CHILD_UNDER_18',
      catalog: SEED_CATALOG,
    });
    expect(plan.options).toEqual([
      'CHILD_OVER_18_DISABLED',
      'CHILD_OVER_18_STUDYING',
    ]);
    expect(plan.canChange).toBe(true);
  });

  it('cannot change when no alternate groups', () => {
    const plan = buildManualChangeGroupPlan({
      dependentId: 'dep-2',
      fullName: 'X',
      relationship: 'OTHER_DEPENDENT',
      currentGroup: 'OTHER_HELPLESS',
      catalog: SEED_CATALOG,
    });
    expect(plan.options).toEqual([]);
    expect(plan.canChange).toBe(false);
  });

  it('PATCHes selected group and returns ProofDocuments nav', async () => {
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
      catalog: SEED_CATALOG,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.navigation.params).toEqual({
      dependentId: 'dep-1',
      groupIndex: 2,
      requiredDocuments: ['DISABILITY_CERTIFICATE'],
    });
  });

  it('forwards optional note to updateDependentGroup when provided', async () => {
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

    const result = await runManualChangeGroup({
      dependentId: 'dep-1',
      newGroup: 'CHILD_OVER_18_STUDYING',
      note: '  Con vào đại học  ',
      updateDependentGroup,
      catalog: SEED_CATALOG,
    });

    expect(result.ok).toBe(true);
    expect(updateDependentGroup).toHaveBeenCalledWith('dep-1', {
      newGroup: 'CHILD_OVER_18_STUDYING',
      note: 'Con vào đại học',
    });
  });
});
