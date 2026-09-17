import {
  canConfirmOcrReview,
  createEmptyOcrFields,
  evaluateOcrImageAsset,
  WEB_CAMERA_UNAVAILABLE_MESSAGE,
} from './scanIdentityCore';
import type { OcrExtractedFields } from '../../types/ocr';

describe('scanIdentityCore', () => {
  describe('createEmptyOcrFields', () => {
    it('does not seed mock Nguyễn Văn An data', () => {
      const fields = createEmptyOcrFields();
      expect(fields.fullName).toBe('');
      expect(fields.citizenId).toBe('');
      expect(JSON.stringify(fields)).not.toContain('NGUYỄN VĂN AN');
      expect(JSON.stringify(fields)).not.toContain('079301001234');
    });
  });

  describe('evaluateOcrImageAsset', () => {
    const base = {
      uri: 'file:///a.jpg',
      fileName: 'a.jpg',
      mimeType: 'image/jpeg',
      fileSize: 200 * 1024,
      width: 1200,
      height: 800,
    };

    it('accepts a clear JPG/PNG of sufficient size', () => {
      expect(evaluateOcrImageAsset(base)).toEqual({ ok: true });
    });

    it('rejects unsupported format', () => {
      expect(evaluateOcrImageAsset({ ...base, fileName: 'a.gif', mimeType: 'image/gif' })).toEqual({
        ok: false,
        reason: 'format',
      });
    });

    it('rejects files over 10MB', () => {
      expect(evaluateOcrImageAsset({ ...base, fileSize: 11 * 1024 * 1024 })).toEqual({
        ok: false,
        reason: 'tooLarge',
      });
    });

    it('rejects images under 600px on a side', () => {
      expect(evaluateOcrImageAsset({ ...base, width: 500, height: 800 })).toEqual({
        ok: false,
        reason: 'tooSmall',
      });
    });

    it('flags stub files under 28KB as blurry without posting', () => {
      expect(evaluateOcrImageAsset({ ...base, fileSize: 20 * 1024 })).toEqual({
        ok: false,
        reason: 'blurry',
      });
    });
  });

  describe('canConfirmOcrReview (PRD §7.1)', () => {
    const filled: OcrExtractedFields = {
      fullName: 'Nguyễn Văn A',
      citizenId: '079301001234',
      dateOfBirth: '1990-05-12',
      address: 'HN',
      gender: 'Nam',
      issueDate: '',
    };

    it('register requires fullName, 12-digit citizenId, dateOfBirth', () => {
      expect(canConfirmOcrReview(filled, 'register')).toBe(true);
      expect(
        canConfirmOcrReview({ ...filled, citizenId: '123' }, 'register')
      ).toBe(false);
      expect(canConfirmOcrReview({ ...filled, fullName: '' }, 'register')).toBe(false);
    });

    it('editProfile requires fullName and dateOfBirth only', () => {
      expect(
        canConfirmOcrReview({ ...filled, citizenId: '' }, 'editProfile')
      ).toBe(true);
      expect(
        canConfirmOcrReview({ ...filled, dateOfBirth: '' }, 'editProfile')
      ).toBe(false);
    });

    it('dependent requires fullName, dateOfBirth, and CCCD 12 or documentNumber', () => {
      expect(canConfirmOcrReview(filled, 'dependent')).toBe(true);
      expect(
        canConfirmOcrReview(
          { ...filled, citizenId: '', documentNumber: 'GKS-1' },
          'dependent'
        )
      ).toBe(true);
      expect(
        canConfirmOcrReview({ ...filled, citizenId: '', documentNumber: '' }, 'dependent')
      ).toBe(false);
    });

    it('does not require viewing low-confidence fields', () => {
      // lowConfidence ignored — always empty path after BE without confidence
      expect(canConfirmOcrReview(filled, 'register')).toBe(true);
    });
  });

  describe('WEB_CAMERA_UNAVAILABLE_MESSAGE', () => {
    it('tells user to use library or enter manually', () => {
      expect(WEB_CAMERA_UNAVAILABLE_MESSAGE).toMatch(/thư viện/i);
      expect(WEB_CAMERA_UNAVAILABLE_MESSAGE).toMatch(/nhập tay/i);
    });
  });
});
