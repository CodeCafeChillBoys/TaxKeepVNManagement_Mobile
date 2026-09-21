import { runDependentOcrExtract } from './scanIdentityDependentExtract';

describe('scanIdentityDependentExtract', () => {
  const front = 'file:///front.jpg';
  const back = 'file:///back.jpg';

  const directSuccess = (data: Record<string, unknown>) => ({
    success: true,
    message: 'ok',
    data: {
      taskId: '00000000-0000-0000-0000-000000000000',
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

  it('calls extractDirect and maps fields including suggestedGroup', async () => {
    const phases: string[] = [];
    const extractDirect = jest.fn().mockResolvedValue(directSuccess({}));

    const result = await runDependentOcrExtract({
      frontUri: front,
      backUri: back,
      extractDirect,
      onPhase: (p: string) => phases.push(p),
    });

    expect(extractDirect).toHaveBeenCalledWith(
      expect.objectContaining({ uri: front }),
      expect.objectContaining({ uri: back }),
      undefined
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
    const extractDirect = jest.fn().mockResolvedValue(
      directSuccess({
        citizenId: null,
        documentNumber: 'GKS-001',
        birthDate: '2015-06-01',
        suggestedGroup: 'CHILD_UNDER_18',
      })
    );

    const result = await runDependentOcrExtract({
      frontUri: front,
      extractDirect,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.fields.documentNumber).toBe('GKS-001');
      expect(result.fields.citizenId).toBe('');
    }
  });

  it('returns blurry when isReadable is false', async () => {
    const extractDirect = jest.fn().mockResolvedValue({
      success: true,
      data: {
        success: true,
        data: { isReadable: false, unreadableReason: 'Ảnh mờ' },
      },
    });

    const result = await runDependentOcrExtract({
      frontUri: front,
      extractDirect,
    });

    expect(result).toEqual({
      ok: false,
      kind: 'blurry',
      message: 'Ảnh mờ',
    });
  });

  it('returns server when msg.success is false', async () => {
    const extractDirect = jest.fn().mockResolvedValue({
      success: true,
      data: { success: false, message: 'AI lỗi', data: null },
    });

    const result = await runDependentOcrExtract({
      frontUri: front,
      extractDirect,
    });

    expect(result).toEqual({
      ok: false,
      kind: 'server',
      message: 'AI lỗi',
    });
  });

  it('returns timeout on axios ECONNABORTED', async () => {
    const timeoutErr = Object.assign(new Error('timeout of 120000ms exceeded'), {
      code: 'ECONNABORTED',
    });
    const extractDirect = jest.fn().mockRejectedValue(timeoutErr);

    const result = await runDependentOcrExtract({
      frontUri: front,
      extractDirect,
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
    const extractDirect = jest.fn().mockRejectedValue(abortErr);

    await expect(
      runDependentOcrExtract({
        frontUri: front,
        extractDirect,
      })
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});
