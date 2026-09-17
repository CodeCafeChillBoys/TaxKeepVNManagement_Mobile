import type { ApiResponse } from '../../api/authApi';
import type {
  DependentOcrTaskAccepted,
  OcrExtractResponseMessage,
  OcrImagePart,
  PollOcrTaskOptions,
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

export type CreateDependentOcrTaskFn = (
  file: OcrImagePart,
  backFile?: OcrImagePart,
  signal?: AbortSignal
) => Promise<ApiResponse<DependentOcrTaskAccepted>>;

export type PollOcrTaskFn = (
  taskId: string,
  options?: PollOcrTaskOptions
) => Promise<ApiResponse<OcrExtractResponseMessage>>;

function toImagePart(uri: string, name: string): OcrImagePart {
  return { uri, name, type: 'image/jpeg' };
}

function isPollTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.name === 'OcrPollTimeoutError';
}

/**
 * NPT: POST /ocr/dependents → poll GET /ocr/tasks/{id} → map fields (PRD §6.0 / §6.3).
 */
export async function runDependentOcrExtract(options: {
  frontUri: string;
  backUri?: string | null;
  signal?: AbortSignal;
  intervalMs?: number;
  timeoutMs?: number;
  createDependentOcrTask: CreateDependentOcrTaskFn;
  pollOcrTask: PollOcrTaskFn;
  onPhase?: (phase: DependentOcrPhase) => void;
}): Promise<DependentOcrResult> {
  const {
    frontUri,
    backUri,
    signal,
    intervalMs = 2000,
    timeoutMs = 30000,
    createDependentOcrTask,
    pollOcrTask,
    onPhase,
  } = options;

  try {
    onPhase?.('uploading');
    const accepted = await createDependentOcrTask(
      toImagePart(frontUri, 'front.jpg'),
      backUri ? toImagePart(backUri, 'back.jpg') : undefined,
      signal
    );

    const taskId = accepted.data?.taskId;
    if (!accepted.success || !taskId) {
      return {
        ok: false,
        kind: 'server',
        message: accepted.message || 'Không tạo được tác vụ OCR.',
      };
    }

    onPhase?.('extracting');
    const outer = await pollOcrTask(taskId, { intervalMs, timeoutMs, signal });
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
    if (isPollTimeoutError(error)) {
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
