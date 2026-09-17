import type { ApiResponse } from '../../api/authApi';
import type { OcrImagePart, UserCccdOcrResponseDto } from '../../api/ocrApi';
import type { OcrExtractedFields } from '../../types/ocr';
import { mapUserCccdToFields } from './ocrUtils';

export type RegisterOcrSuccess = {
  ok: true;
  fields: OcrExtractedFields;
};

export type RegisterOcrFailure = {
  ok: false;
  kind: 'blurry' | 'invalidCitizenId' | 'server';
  message?: string;
};

export type RegisterOcrResult = RegisterOcrSuccess | RegisterOcrFailure;

export type ExtractUserCccdFn = (
  file: OcrImagePart,
  backFile?: OcrImagePart,
  signal?: AbortSignal
) => Promise<ApiResponse<UserCccdOcrResponseDto>>;

function toImagePart(uri: string, name: string): OcrImagePart {
  return { uri, name, type: 'image/jpeg' };
}

export function getOcrAxiosErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const data = (error as { response?: { data?: { errors?: { errorCode?: string } } } })
    .response?.data;
  const code = data?.errors?.errorCode;
  return typeof code === 'string' && code.length > 0 ? code : null;
}

export function getOcrAxiosErrorMessage(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const message = (error as { response?: { data?: { message?: string } }; message?: string })
    .response?.data?.message;
  if (typeof message === 'string' && message.length > 0) return message;
  const fallback = (error as { message?: string }).message;
  return typeof fallback === 'string' ? fallback : undefined;
}

/**
 * Đăng ký: POST /api/v1/auth/cccd-extractions → map fields.
 * Inject `extractUserCccd` để test (mặc định dùng ocrApi ở screen).
 */
export async function runRegisterOcrExtract(options: {
  frontUri: string;
  backUri?: string | null;
  signal?: AbortSignal;
  extractUserCccd: ExtractUserCccdFn;
}): Promise<RegisterOcrResult> {
  const { frontUri, backUri, signal, extractUserCccd } = options;

  try {
    const response = await extractUserCccd(
      toImagePart(frontUri, 'front.jpg'),
      backUri ? toImagePart(backUri, 'back.jpg') : undefined,
      signal
    );

    if (!response.success || !response.data) {
      return {
        ok: false,
        kind: 'server',
        message: response.message,
      };
    }

    const { fields } = mapUserCccdToFields(response.data);
    return { ok: true, fields };
  } catch (error: unknown) {
    if (error && typeof error === 'object' && (error as { name?: string }).name === 'AbortError') {
      throw error;
    }

    const code = getOcrAxiosErrorCode(error);
    const message = getOcrAxiosErrorMessage(error);

    if (code === 'UNREADABLE_IMAGE') {
      return { ok: false, kind: 'blurry', message };
    }
    if (code === 'INVALID_CITIZEN_ID') {
      return { ok: false, kind: 'invalidCitizenId', message };
    }
    return { ok: false, kind: 'server', message };
  }
}
