import type { ApiResponse } from '../../api/authApi';
import type {
  OcrExtractResponseMessage,
  OcrImagePart,
} from '../../api/ocrApi';
import type { OcrExtractedFields } from '../../types/ocr';
import { mapExtractedDependentToFields, stripCitizenId } from './ocrUtils';
import {
  getOcrAxiosErrorCode,
  getOcrAxiosErrorMessage,
} from './scanIdentityRegisterExtract';

export const CCCD_PROFILE_MISMATCH_MESSAGE =
  'Số CCCD trên ảnh khác hồ sơ. Chỉ cập nhật họ tên, ngày sinh, địa chỉ.';

export type EditProfileOcrSuccess = {
  ok: true;
  fields: OcrExtractedFields;
  citizenIdMismatch: boolean;
  mismatchMessage?: string;
};

export type EditProfileOcrFailure = {
  ok: false;
  kind: 'blurry' | 'server';
  message?: string;
};

export type EditProfileOcrResult = EditProfileOcrSuccess | EditProfileOcrFailure;

export type ExtractDirectFn = (
  file: OcrImagePart,
  backFile?: OcrImagePart,
  signal?: AbortSignal
) => Promise<ApiResponse<OcrExtractResponseMessage>>;

function toImagePart(uri: string, name: string): OcrImagePart {
  return { uri, name, type: 'image/jpeg' };
}

/**
 * Hồ sơ: POST /api/v1/ocr/direct-extractions (không dùng /auth/cccd-extractions).
 * Parse ApiResponse lồng OcrExtractResponseMessage (PRD §6.0).
 */
export async function runEditProfileOcrExtract(options: {
  frontUri: string;
  backUri?: string | null;
  lockedCitizenId?: string | null;
  signal?: AbortSignal;
  extractDirect: ExtractDirectFn;
}): Promise<EditProfileOcrResult> {
  const { frontUri, backUri, lockedCitizenId, signal, extractDirect } = options;

  try {
    const outer = await extractDirect(
      toImagePart(frontUri, 'front.jpg'),
      backUri ? toImagePart(backUri, 'back.jpg') : undefined,
      signal
    );

    const msg = outer.data;
    if (!outer.success || !msg?.success || !msg.data) {
      return {
        ok: false,
        kind: 'server',
        message: msg?.message || outer.message,
      };
    }

    if (msg.data.isReadable === false) {
      return {
        ok: false,
        kind: 'blurry',
        message: msg.data.unreadableReason ?? undefined,
      };
    }

    const fields = mapExtractedDependentToFields(msg.data);
    const locked = stripCitizenId(lockedCitizenId ?? '');
    const scanned = stripCitizenId(fields.citizenId);
    const citizenIdMismatch =
      locked.length > 0 && scanned.length > 0 && locked !== scanned;

    return {
      ok: true,
      fields,
      citizenIdMismatch,
      mismatchMessage: citizenIdMismatch ? CCCD_PROFILE_MISMATCH_MESSAGE : undefined,
    };
  } catch (error: unknown) {
    if (error && typeof error === 'object' && (error as { name?: string }).name === 'AbortError') {
      throw error;
    }

    const code = getOcrAxiosErrorCode(error);
    const message = getOcrAxiosErrorMessage(error);
    if (code === 'UNREADABLE_IMAGE' || code === 'UNREADABLE_DOCUMENT') {
      return { ok: false, kind: 'blurry', message };
    }
    return { ok: false, kind: 'server', message };
  }
}
