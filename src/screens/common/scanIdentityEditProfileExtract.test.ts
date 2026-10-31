import type { ApiResponse } from '../../api/authApi';
import type { OcrExtractResponseMessage } from '../../api/ocrApi';
import {
  CCCD_PROFILE_MISMATCH_MESSAGE,
  runEditProfileOcrExtract,
} from './scanIdentityEditProfileExtract';

describe('scanIdentityEditProfileExtract', () => {
  const front = 'file:///front.jpg';
  const locked = '079301001234';

  const successMsg = (data: Record<string, unknown>): ApiResponse<OcrExtractResponseMessage> => ({
    success: true,
    message: 'ok',
    data: {
      taskId: 't1',
      success: true,
      statusCode: 200,
      message: 'done',
      data: {
        isReadable: true,
        fullName: 'NGUYỄN VĂN A',
        citizenId: '079301001234',
        birthDate: '1990-05-12',
        gender: 'MALE',
        residencePlace: 'Ha Noi',
        ...data,
      },
    },
  });

  it('maps direct-extractions nested payload to review fields', async () => {
    const extractDirect = jest.fn().mockResolvedValue(successMsg({}));

    const result = await runEditProfileOcrExtract({
      frontUri: front,
      lockedCitizenId: locked,
      extractDirect,
    });

    expect(extractDirect).toHaveBeenCalledWith(
      expect.objectContaining({ uri: front }),
      undefined,
      undefined
    );
    expect(result).toEqual({
      ok: true,
      citizenIdMismatch: false,
      fields: expect.objectContaining({
        fullName: 'NGUYỄN VĂN A',
        citizenId: '079301001234',
        dateOfBirth: '1990-05-12',
        gender: 'Nam',
        address: 'Ha Noi',
      }),
    });
  });

  it('flags citizenIdMismatch when OCR CCCD differs from lockedCitizenId', async () => {
    const extractDirect = jest.fn().mockResolvedValue(
      successMsg({ citizenId: '079301009999' })
    );

    const result = await runEditProfileOcrExtract({
      frontUri: front,
      lockedCitizenId: locked,
      extractDirect,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.citizenIdMismatch).toBe(true);
      expect(result.mismatchMessage).toBe(CCCD_PROFILE_MISMATCH_MESSAGE);
    }
  });

  it('does not flag mismatch when lockedCitizenId is missing', async () => {
    const extractDirect = jest.fn().mockResolvedValue(
      successMsg({ citizenId: '079301009999' })
    );

    const result = await runEditProfileOcrExtract({
      frontUri: front,
      extractDirect,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.citizenIdMismatch).toBe(false);
    }
  });

  it('returns blurry when isReadable is false', async () => {
    const extractDirect = jest.fn().mockResolvedValue({
      success: true,
      data: {
        success: true,
        data: {
          isReadable: false,
          unreadableReason: 'Ảnh bị lóa',
          fullName: null,
        },
      },
    });

    const result = await runEditProfileOcrExtract({
      frontUri: front,
      lockedCitizenId: locked,
      extractDirect,
    });

    expect(result).toEqual({
      ok: false,
      kind: 'blurry',
      message: 'Ảnh bị lóa',
    });
  });

  it('returns server when outer or msg success is false', async () => {
    const extractDirect = jest.fn().mockResolvedValue({
      success: true,
      data: {
        success: false,
        message: 'AI failed',
        data: null,
      },
    });

    const result = await runEditProfileOcrExtract({
      frontUri: front,
      extractDirect,
    });

    expect(result).toEqual({
      ok: false,
      kind: 'server',
      message: 'AI failed',
    });
  });

  it('never calls auth cccd-extractions — only extractDirect', async () => {
    const extractDirect = jest.fn().mockResolvedValue(successMsg({}));
    const extractUserCccd = jest.fn();

    await runEditProfileOcrExtract({
      frontUri: front,
      lockedCitizenId: locked,
      extractDirect,
    });

    expect(extractDirect).toHaveBeenCalled();
    expect(extractUserCccd).not.toHaveBeenCalled();
  });

  it('rethrows AbortError', async () => {
    const abortErr = new Error('Aborted');
    abortErr.name = 'AbortError';
    const extractDirect = jest.fn().mockRejectedValue(abortErr);

    await expect(
      runEditProfileOcrExtract({ frontUri: front, extractDirect })
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});
