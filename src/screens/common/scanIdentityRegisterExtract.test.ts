import type { UserCccdOcrResponseDto } from '../../api/ocrApi';
import { getOcrAxiosErrorCode, runRegisterOcrExtract } from './scanIdentityRegisterExtract';

describe('scanIdentityRegisterExtract', () => {
  describe('getOcrAxiosErrorCode', () => {
    it('reads errorCode from ApiResponse.errors', () => {
      const error = {
        response: {
          status: 400,
          data: {
            success: false,
            message: 'Ảnh mờ',
            errors: { errorCode: 'UNREADABLE_IMAGE' },
          },
        },
      };
      expect(getOcrAxiosErrorCode(error)).toBe('UNREADABLE_IMAGE');
    });

    it('returns null when no code', () => {
      expect(getOcrAxiosErrorCode(new Error('network'))).toBeNull();
    });
  });

  describe('runRegisterOcrExtract', () => {
    const front = 'file:///front.jpg';
    const back = 'file:///back.jpg';

    it('maps successful CCCD extraction to review fields including availability', async () => {
      const dto: UserCccdOcrResponseDto = {
        fullName: 'NGUYỄN VĂN A',
        citizenId: '079301001234',
        dateOfBirth: '1990-05-12',
        gender: 'MALE',
        address: 'Ha Noi',
        isAvailable: true,
        warning: null,
      };
      const extractUserCccd = jest.fn().mockResolvedValue({
        success: true,
        message: 'ok',
        data: dto,
      });

      const result = await runRegisterOcrExtract({
        frontUri: front,
        backUri: back,
        extractUserCccd,
      });

      expect(extractUserCccd).toHaveBeenCalledWith(
        expect.objectContaining({ uri: front }),
        expect.objectContaining({ uri: back }),
        undefined
      );
      expect(result).toEqual({
        ok: true,
        fields: expect.objectContaining({
          fullName: 'NGUYỄN VĂN A',
          citizenId: '079301001234',
          gender: 'Nam',
          isAvailable: true,
        }),
      });
    });

    it('keeps isAvailable false and warning for duplicate CCCD', async () => {
      const extractUserCccd = jest.fn().mockResolvedValue({
        success: true,
        data: {
          fullName: 'A',
          citizenId: '079301001234',
          dateOfBirth: '1990-01-01',
          gender: 'Nam',
          address: '',
          isAvailable: false,
          warning: 'Số CCCD này đã được đăng ký tài khoản trong hệ thống.',
        },
      });

      const result = await runRegisterOcrExtract({
        frontUri: front,
        extractUserCccd,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.fields.isAvailable).toBe(false);
        expect(result.fields.warning).toContain('đã được đăng ký');
      }
    });

    it('maps UNREADABLE_IMAGE to blurry outcome', async () => {
      const extractUserCccd = jest.fn().mockRejectedValue({
        response: {
          status: 400,
          data: {
            message: 'Ảnh giấy tờ không thể đọc được: mờ',
            errors: { errorCode: 'UNREADABLE_IMAGE' },
          },
        },
      });

      const result = await runRegisterOcrExtract({
        frontUri: front,
        extractUserCccd,
      });

      expect(result).toEqual({
        ok: false,
        kind: 'blurry',
        message: 'Ảnh giấy tờ không thể đọc được: mờ',
      });
    });

    it('maps INVALID_CITIZEN_ID for GKS / missing 12 digits', async () => {
      const extractUserCccd = jest.fn().mockRejectedValue({
        response: {
          status: 400,
          data: {
            message: 'Không thể nhận diện được số CCCD 12 số hợp lệ từ hình ảnh tải lên.',
            errors: { errorCode: 'INVALID_CITIZEN_ID' },
          },
        },
      });

      const result = await runRegisterOcrExtract({
        frontUri: front,
        extractUserCccd,
      });

      expect(result).toEqual({
        ok: false,
        kind: 'invalidCitizenId',
        message: 'Không thể nhận diện được số CCCD 12 số hợp lệ từ hình ảnh tải lên.',
      });
    });

    it('maps other failures to server outcome', async () => {
      const extractUserCccd = jest.fn().mockRejectedValue(new Error('Network Error'));

      const result = await runRegisterOcrExtract({
        frontUri: front,
        extractUserCccd,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.kind).toBe('server');
      }
    });

    it('rethrows AbortError so caller can ignore', async () => {
      const abortErr = new Error('Aborted');
      abortErr.name = 'AbortError';
      const extractUserCccd = jest.fn().mockRejectedValue(abortErr);

      await expect(
        runRegisterOcrExtract({ frontUri: front, extractUserCccd })
      ).rejects.toMatchObject({ name: 'AbortError' });
    });
  });
});
