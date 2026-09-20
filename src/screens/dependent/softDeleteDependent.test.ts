import { buildSoftDeletePlan, runSoftDeleteDependent } from './softDeleteDependent';

describe('softDeleteDependent', () => {
  it('builds confirm dialog with optional reason field', () => {
    const plan = buildSoftDeletePlan({
      dependentId: 'dep-1',
      fullName: 'Nguyen Van B',
    });
    expect(plan.confirmTitle).toMatch(/vô hiệu hóa/i);
    expect(plan.confirmMessage).toContain('Nguyen Van B');
    expect(plan.reasonOptional).toBe(true);
  });

  it('DELETEs without reason and signals list refresh', async () => {
    const deleteDependent = jest.fn().mockResolvedValue({
      success: true,
      message: 'ok',
      data: {
        dependentId: 'dep-1',
        status: 'INACTIVE',
        isDeleted: true,
      },
    });

    const result = await runSoftDeleteDependent({
      dependentId: 'dep-1',
      deleteDependent,
    });

    expect(deleteDependent).toHaveBeenCalledWith('dep-1', undefined);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.refreshList).toBe(true);
    expect(result.toastMessage.length).toBeGreaterThan(0);
  });

  it('sends reason when provided', async () => {
    const deleteDependent = jest.fn().mockResolvedValue({
      success: true,
      message: 'ok',
      data: { dependentId: 'dep-1', status: 'INACTIVE', isDeleted: true },
    });

    await runSoftDeleteDependent({
      dependentId: 'dep-1',
      reason: 'Không còn là NPT',
      deleteDependent,
    });

    expect(deleteDependent).toHaveBeenCalledWith('dep-1', {
      reason: 'Không còn là NPT',
    });
  });

  it('maps 404 without refresh', async () => {
    const deleteDependent = jest.fn().mockRejectedValue({
      response: { status: 404, data: {} },
    });

    const result = await runSoftDeleteDependent({
      dependentId: 'missing',
      deleteDependent,
    });

    expect(result).toEqual({
      ok: false,
      message: 'Không tìm thấy người phụ thuộc.',
    });
  });
});
