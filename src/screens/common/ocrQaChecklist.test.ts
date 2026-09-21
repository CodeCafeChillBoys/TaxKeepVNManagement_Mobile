/**
 * OCR-11 — Automated mapping of QA checklist cases to seam-level assertions.
 * Live E2E with real CCCD photos remains manual; this suite locks behavioral contracts.
 */
import { applyRegisterOcrResult } from '../auth/applyRegisterOcrResult';
import { applyEditProfileOcrResult, buildEditProfileScanParams } from '../profile/applyEditProfileOcrResult';
import {
  applyTaxRegistrationOcrFill,
  buildDependentScanParams,
  isTaxRegistrationFormDirty,
} from '../dependent/applyTaxRegistrationOcrFill';
import { aliasSuggestedGroup, mapToDependentFill } from '../common/ocrUtils';
import {
  WEB_CAMERA_UNAVAILABLE_MESSAGE,
  canConfirmOcrReview,
  createEmptyOcrFields,
  evaluateOcrImageAsset,
} from '../common/scanIdentityCore';
import { runRegisterOcrExtract } from '../common/scanIdentityRegisterExtract';
import {
  CCCD_PROFILE_MISMATCH_MESSAGE,
  runEditProfileOcrExtract,
} from '../common/scanIdentityEditProfileExtract';
import { runDependentOcrExtract } from '../common/scanIdentityDependentExtract';

describe('OCR-11 QA checklist (automated seams)', () => {
  describe('Case 1 — Register + CCCD rõ, số chưa có DB', () => {
    it('maps extraction to four form fields and allows confirm', async () => {
      const extractUserCccd = jest.fn().mockResolvedValue({
        success: true,
        data: {
          fullName: 'NGUYỄN VĂN A',
          citizenId: '079301001234',
          dateOfBirth: '1990-05-12',
          gender: 'MALE',
          address: 'Ha Noi',
          isAvailable: true,
          warning: null,
        },
      });

      const extracted = await runRegisterOcrExtract({
        frontUri: 'file:///cccd.jpg',
        extractUserCccd,
      });
      expect(extracted.ok).toBe(true);
      if (!extracted.ok) return;

      expect(canConfirmOcrReview(extracted.fields, 'register')).toBe(true);
      const plan = applyRegisterOcrResult({
        fullName: 'Nguyễn Văn A',
        citizenId: '079301001234',
        dateOfBirth: '1990-05-12',
        address: 'Ha Noi',
        isAvailable: true,
      });
      expect(plan.fields).toEqual({
        fullName: 'Nguyễn Văn A',
        citizenId: '079301001234',
        dateOfBirth: '1990-05-12',
        address: 'Ha Noi',
      });
      expect(plan.citizenIdError).toBeUndefined();
    });
  });

  describe('Case 2 — Register + CCCD đã register', () => {
    it('keeps fill and sets citizenIdError from warning', async () => {
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

      const extracted = await runRegisterOcrExtract({
        frontUri: 'file:///cccd.jpg',
        extractUserCccd,
      });
      expect(extracted.ok).toBe(true);
      if (!extracted.ok) return;
      expect(extracted.fields.isAvailable).toBe(false);
      expect(canConfirmOcrReview(extracted.fields, 'register')).toBe(true);

      const plan = applyRegisterOcrResult({
        fullName: 'A',
        citizenId: '079301001234',
        dateOfBirth: '1990-01-01',
        address: '',
        isAvailable: false,
        warning: extracted.fields.warning,
      });
      expect(plan.citizenIdError).toContain('đã được đăng ký');
    });
  });

  describe('Case 3 — Register + GKS / không 12 số', () => {
    it('maps INVALID_CITIZEN_ID to invalidCitizenId outcome', async () => {
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
        frontUri: 'file:///gks.jpg',
        extractUserCccd,
      });
      expect(result).toEqual({
        ok: false,
        kind: 'invalidCitizenId',
        message: expect.stringMatching(/12 số/i),
      });
    });
  });

  describe('Case 4 — EditProfile + đúng CCCD khóa', () => {
    it('updates name/dob/address plan without citizenId; scan passes locked id', async () => {
      const extractDirect = jest.fn().mockResolvedValue({
        success: true,
        data: {
          success: true,
          data: {
            isReadable: true,
            fullName: 'NGUYỄN VĂN A',
            citizenId: '079301001234',
            birthDate: '1990-05-12',
            gender: 'MALE',
            residencePlace: 'Ha Noi',
          },
        },
      });

      const extracted = await runEditProfileOcrExtract({
        frontUri: 'file:///cccd.jpg',
        lockedCitizenId: '079301001234',
        extractDirect,
      });
      expect(extracted.ok).toBe(true);
      if (!extracted.ok) return;
      expect(extracted.citizenIdMismatch).toBe(false);
      expect(canConfirmOcrReview(extracted.fields, 'editProfile')).toBe(true);

      const plan = applyEditProfileOcrResult({
        fullName: 'Nguyễn Văn A',
        citizenId: '079301009999',
        dateOfBirth: '1990-05-12',
        address: 'Ha Noi',
      });
      expect(plan.fields).not.toHaveProperty('citizenId');
      expect(buildEditProfileScanParams('079301001234').lockedCitizenId).toBe('079301001234');
    });
  });

  describe('Case 5 — EditProfile + sai CCCD', () => {
    it('flags mismatch banner message and still allows confirm', async () => {
      const extractDirect = jest.fn().mockResolvedValue({
        success: true,
        data: {
          success: true,
          data: {
            isReadable: true,
            fullName: 'A',
            citizenId: '079301009999',
            birthDate: '1990-01-01',
            gender: 'Nam',
            residencePlace: 'HN',
          },
        },
      });

      const extracted = await runEditProfileOcrExtract({
        frontUri: 'file:///other.jpg',
        lockedCitizenId: '079301001234',
        extractDirect,
      });
      expect(extracted.ok).toBe(true);
      if (!extracted.ok) return;
      expect(extracted.citizenIdMismatch).toBe(true);
      expect(extracted.mismatchMessage).toBe(CCCD_PROFILE_MISMATCH_MESSAGE);
      expect(canConfirmOcrReview(extracted.fields, 'editProfile')).toBe(true);
    });
  });

  describe('Case 6 — NPT + CCCD', () => {
    it('sync extract success, fills citizenId, aliases studying group to idx 1', async () => {
      const extractDirect = jest.fn().mockResolvedValue({
        success: true,
        data: {
          success: true,
          data: {
            isReadable: true,
            fullName: 'NGUYỄN VĂN B',
            citizenId: '079301001111',
            birthDate: '2005-01-01',
            gender: 'MALE',
            suggestedGroup: 'CHILD_OVER_18_STUDENT',
          },
        },
      });

      const extracted = await runDependentOcrExtract({
        frontUri: 'file:///npt.jpg',
        extractDirect,
      });
      expect(extracted.ok).toBe(true);
      if (!extracted.ok) return;

      expect(aliasSuggestedGroup(extracted.fields.suggestedGroup)).toEqual({
        selectedGroupIdx: 1,
        relationship: 'CHILD',
      });
      const fill = mapToDependentFill(
        extracted.fields,
        extracted.fields.suggestedGroup,
        new Date('2026-09-17T00:00:00Z')
      );
      const plan = applyTaxRegistrationOcrFill(fill);
      expect(plan.patch.citizenId).toBe('079301001111');
      expect(plan.patch.selectedGroupIdx).toBe(1);
      expect(plan.patch.relationship).toBe('CHILD');
    });
  });

  describe('Case 7 — NPT + GKS', () => {
    it('fills birthCertNumber when no 12-digit CCCD', async () => {
      const extractDirect = jest.fn().mockResolvedValue({
        success: true,
        data: {
          success: true,
          data: {
            isReadable: true,
            fullName: 'BÉ NA',
            citizenId: null,
            birthDate: '2015-06-01',
            documentNumber: 'GKS-77',
            suggestedGroup: 'CHILD_UNDER_18',
            gender: 'FEMALE',
          },
        },
      });

      const extracted = await runDependentOcrExtract({
        frontUri: 'file:///gks.jpg',
        extractDirect,
      });
      expect(extracted.ok).toBe(true);
      if (!extracted.ok) return;
      expect(canConfirmOcrReview(extracted.fields, 'dependent')).toBe(true);

      const fill = mapToDependentFill(
        extracted.fields,
        extracted.fields.suggestedGroup,
        new Date('2026-09-17T00:00:00Z')
      );
      const plan = applyTaxRegistrationOcrFill(fill);
      expect(plan.patch.birthCertNumber).toBe('GKS-77');
      expect(plan.patch.citizenId).toBeUndefined();
      expect(plan.patch.selectedGroupIdx).toBe(0);
    });
  });

  describe('Case 8 — NPT request timeout', () => {
    it('returns timeout outcome (dialog + nhập tay path)', async () => {
      const timeoutErr = Object.assign(new Error('timeout of 120000ms exceeded'), {
        code: 'ECONNABORTED',
      });
      const extractDirect = jest.fn().mockRejectedValue(timeoutErr);

      const result = await runDependentOcrExtract({
        frontUri: 'file:///npt.jpg',
        extractDirect,
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.kind).toBe('timeout');
      expect(result.message).toMatch(/hết thời gian/i);
    });
  });

  describe('Case 9 — Hủy giữa uploading', () => {
    it('rethrows AbortError so screen returns to source without fill', async () => {
      const abortErr = new Error('Aborted');
      abortErr.name = 'AbortError';
      const extractDirect = jest.fn().mockRejectedValue(abortErr);

      await expect(
        runDependentOcrExtract({
          frontUri: 'file:///npt.jpg',
          extractDirect,
        })
      ).rejects.toMatchObject({ name: 'AbortError' });
      expect(createEmptyOcrFields().fullName).toBe('');
    });
  });

  describe('Case 10 — Web camera không silent mock', () => {
    it('exposes library/manual message and never seeds mock identity', () => {
      expect(WEB_CAMERA_UNAVAILABLE_MESSAGE).toMatch(/thư viện/i);
      expect(WEB_CAMERA_UNAVAILABLE_MESSAGE).toMatch(/nhập tay/i);
      const empty = createEmptyOcrFields();
      expect(JSON.stringify(empty)).not.toContain('NGUYỄN VĂN AN');
      expect(JSON.stringify(empty)).not.toContain('079301001234');
    });

    it('ScanIdentityScreen does not import MOCK_OCR_EXTRACT', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('fs') as typeof import('fs');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const path = require('path') as typeof import('path');
      const src = fs.readFileSync(path.join(__dirname, 'ScanIdentityScreen.tsx'), 'utf8');
      expect(src).not.toMatch(/MOCK_OCR_EXTRACT/);
      expect(src).not.toMatch(/startMockExtract/);
      expect(src).toMatch(/WEB_CAMERA_UNAVAILABLE_MESSAGE/);
    });
  });

  describe('Case 11 — Overwrite form dirty', () => {
    it('marks form dirty so ScanIdentity can open overwrite dialog', () => {
      expect(
        isTaxRegistrationFormDirty({
          fullName: 'Đã nhập',
          citizenId: '',
          birthCertNumber: '',
        })
      ).toBe(true);
      expect(buildDependentScanParams(true)).toEqual({
        source: 'dependent',
        hasExistingData: true,
      });
      expect(buildEditProfileScanParams('079301001234').hasExistingData).toBe(true);
    });
  });

  describe('Case 12 — Nhập tay bỏ qua', () => {
    it('keeps empty fields contract for skip/manual path', () => {
      const fields = createEmptyOcrFields();
      expect(fields.fullName).toBe('');
      expect(fields.citizenId).toBe('');
      expect(
        isTaxRegistrationFormDirty({
          fullName: fields.fullName,
          citizenId: fields.citizenId,
          birthCertNumber: '',
        })
      ).toBe(false);
    });
  });

  describe('Client blur gate (môi trường ảnh mờ)', () => {
    it('rejects stub file <28KB before POST', () => {
      expect(
        evaluateOcrImageAsset({
          uri: 'file:///tiny.jpg',
          fileName: 'tiny.jpg',
          mimeType: 'image/jpeg',
          fileSize: 10 * 1024,
          width: 1200,
          height: 800,
        })
      ).toEqual({ ok: false, reason: 'blurry' });
    });
  });
});
