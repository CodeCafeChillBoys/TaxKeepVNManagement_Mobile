import type { ApiResponse } from '../../api/authApi';
import type {
  OcrExtractResponseMessage,
  OcrImagePart,
} from '../../api/ocrApi';
import type { OcrExtractedFields } from '../../types/ocr';
import { mapExtractedDependentToFields } from './ocrUtils';
import {
  getOcrAxiosErrorCode,
  getOcrAxiosErrorMessage,
} from './scanIdentityRegisterExtract';

export const DEPENDENT_OCR_TIMEOUT_MESSAGE =
  'Đã hết thời gian chờ đọc giấy tờ. Vui lòng thử lại hoặc nhập tay.';

export type DependentOcrSuccess = {
  ok: true;
  fields: OcrExtractedFields;
};

export type DependentOcrFailure = {
  ok: false;
  kind: 'blurry' | 'server' | 'timeout';
  message?: string;
};

export type DependentOcrResult = DependentOcrSuccess | DependentOcrFailure;

export type DependentOcrPhase = 'uploading' | 'extracting';

export type ExtractDirectFn = (
  file: OcrImagePart,
  backFile?: OcrImagePart,
  signal?: AbortSignal
) => Promise<ApiResponse<OcrExtractResponseMessage>>;

function toImagePart(uri: string, name: string): OcrImagePart {
  return { uri, name, type: 'image/jpeg' };
}

function isTimeoutError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: string }).code;
  if (code === 'ECONNABORTED') return true;
  const message = (error as { message?: string }).message ?? '';
  return /timeout/i.test(message);
}

/**
 * NPT: POST /api/v1/ocr/direct-extractions (đồng bộ) — tránh timeout poll RabbitMQ 30s.
 * Queue async vẫn còn trên BE cho tích hợp khác; FE dùng sync vì Gemini thường > 30s.
 */
export async function runDependentOcrExtract(options: {
  frontUri: string;
  backUri?: string | null;
  signal?: AbortSignal;
  extractDirect: ExtractDirectFn;
  onPhase?: (phase: DependentOcrPhase) => void;
}): Promise<DependentOcrResult> {
  const { frontUri, backUri, signal, extractDirect, onPhase } = options;

  try {
    onPhase?.('uploading');
    onPhase?.('extracting');
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

    return {
      ok: true,
      fields: mapExtractedDependentToFields(msg.data),
    };
  } catch (error: unknown) {
    if (error && typeof error === 'object' && (error as { name?: string }).name === 'AbortError') {
      throw error;
    }
    if (isTimeoutError(error)) {
      return { ok: false, kind: 'timeout', message: DEPENDENT_OCR_TIMEOUT_MESSAGE };
    }

    const code = getOcrAxiosErrorCode(error);
    const message = getOcrAxiosErrorMessage(error);
    if (code === 'UNREADABLE_IMAGE' || code === 'UNREADABLE_DOCUMENT') {
      return { ok: false, kind: 'blurry', message };
    }
    return { ok: false, kind: 'server', message };
  }
}
