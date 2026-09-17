import { runDependentOcrExtract } from './scanIdentityDependentExtract';

describe('scanIdentityDependentExtract', () => {
  const front = 'file:///front.jpg';
  const back = 'file:///back.jpg';
  const taskId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  const pollSuccess = (data: Record<string, unknown>) => ({
    success: true,
    message: 'ok',
    data: {
      taskId,
      success: true,
      statusCode: 200,
      message: 'done',
      data: {
        isReadable: true,
        fullName: 'NGUYỄN VĂN B',
        citizenId: '079301001111',
        birthDate: '2005-01-01',
        gender: 'MALE',
        suggestedGroup: 'CHILD_OVER_18_STUDENT',
        ...data,
      },
    },
  });

  it('creates task then polls and maps fields including suggestedGroup', async () => {
    const phases: string[] = [];
    const createDependentOcrTask = jest.fn().mockResolvedValue({
      success: true,
      data: { taskId, checkStatusUrl: `/api/v1/ocr/tasks/${taskId}` },
    });
    const pollOcrTask = jest.fn().mockResolvedValue(pollSuccess({}));

    const result = await runDependentOcrExtract({
      frontUri: front,
      backUri: back,
      createDependentOcrTask,
      pollOcrTask,
      onPhase: (p: string) => phases.push(p),
    });

    expect(createDependentOcrTask).toHaveBeenCalledWith(
      expect.objectContaining({ uri: front }),
      expect.objectContaining({ uri: back }),
      undefined
    );
    expect(pollOcrTask).toHaveBeenCalledWith(
      taskId,
      expect.objectContaining({ intervalMs: 2000, timeoutMs: 30000 })
    );
    expect(phases).toEqual(['uploading', 'extracting']);
    expect(result).toEqual({
      ok: true,
      fields: expect.objectContaining({
        fullName: 'NGUYỄN VĂN B',
        citizenId: '079301001111',
        dateOfBirth: '2005-01-01',
        suggestedGroup: 'CHILD_OVER_18_STUDENT',
        gender: 'Nam',
      }),
    });
  });

  it('maps birth certificate documentNumber when no CCCD', async () => {
    const createDependentOcrTask = jest.fn().mockResolvedValue({
      success: true,
      data: { taskId },
    });
    const pollOcrTask = jest.fn().mockResolvedValue(
      pollSuccess({
        citizenId: null,
        documentNumber: 'GKS-001',
        birthDate: '2015-06-01',
        suggestedGroup: 'CHILD_UNDER_18',
      })
    );

    const result = await runDependentOcrExtract({
      frontUri: front,
      createDependentOcrTask,
      pollOcrTask,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.fields.documentNumber).toBe('GKS-001');
      expect(result.fields.citizenId).toBe('');
    }
  });

  it('returns blurry when isReadable is false', async () => {
    const createDependentOcrTask = jest.fn().mockResolvedValue({
      success: true,
      data: { taskId },
    });
    const pollOcrTask = jest.fn().mockResolvedValue({
      success: true,
      data: {
        success: true,
        data: { isReadable: false, unreadableReason: 'Ảnh mờ' },
      },
    });

    const result = await runDependentOcrExtract({
      frontUri: front,
      createDependentOcrTask,
      pollOcrTask,
    });

    expect(result).toEqual({
      ok: false,
      kind: 'blurry',
      message: 'Ảnh mờ',
    });
  });

  it('returns server when msg.success is false', async () => {
    const createDependentOcrTask = jest.fn().mockResolvedValue({
      success: true,
      data: { taskId },
    });
    const pollOcrTask = jest.fn().mockResolvedValue({
      success: true,
      data: { success: false, message: 'AI lỗi', data: null },
    });

    const result = await runDependentOcrExtract({
      frontUri: front,
      createDependentOcrTask,
      pollOcrTask,
    });

    expect(result).toEqual({
      ok: false,
      kind: 'server',
      message: 'AI lỗi',
    });
  });

  it('returns timeout when poll throws OcrPollTimeoutError', async () => {
    const createDependentOcrTask = jest.fn().mockResolvedValue({
      success: true,
      data: { taskId },
    });
    const timeoutErr = new Error('OCR poll timed out');
    timeoutErr.name = 'OcrPollTimeoutError';
    const pollOcrTask = jest.fn().mockRejectedValue(timeoutErr);

    const result = await runDependentOcrExtract({
      frontUri: front,
      createDependentOcrTask,
      pollOcrTask,
    });

    expect(result).toEqual({
      ok: false,
      kind: 'timeout',
      message: expect.stringMatching(/hết thời gian|timeout/i),
    });
  });

  it('rethrows AbortError', async () => {
    const abortErr = new Error('Aborted');
    abortErr.name = 'AbortError';
    const createDependentOcrTask = jest.fn().mockRejectedValue(abortErr);
    const pollOcrTask = jest.fn();

    await expect(
      runDependentOcrExtract({
        frontUri: front,
        createDependentOcrTask,
        pollOcrTask,
      })
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(pollOcrTask).not.toHaveBeenCalled();
  });
});
