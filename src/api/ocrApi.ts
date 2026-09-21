import type { AxiosInstance, AxiosRequestConfig } from 'axios';
import { apiClient } from './apiClient';
import type { ApiResponse } from './authApi';

/** Ảnh multipart kiểu React Native ImagePicker / DocumentPicker */
export type OcrImagePart = {
  uri: string;
  name?: string;
  type?: string;
};

export type UserCccdOcrResponseDto = {
  fullName?: string | null;
  citizenId?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  address?: string | null;
  isAvailable: boolean;
  warning?: string | null;
};

/** Payload bên trong ApiResponse cho direct / poll (PRD §6.0) */
export type ExtractedDependentDataDto = {
  documentType?: string | null;
  citizenId?: string | null;
  fullName?: string | null;
  birthDate?: string | null;
  gender?: string | null;
  nationality?: string | null;
  originPlace?: string | null;
  residencePlace?: string | null;
  expiryDate?: string | null;
  issueDate?: string | null;
  suggestedGroup?: string | null;
  documentNumber?: string | null;
  isReadable: boolean;
  unreadableReason?: string | null;
};

export type OcrExtractResponseMessage = {
  taskId?: string;
  userId?: string | null;
  success: boolean;
  statusCode?: number;
  message?: string;
  data?: ExtractedDependentDataDto | null;
  errors?: unknown;
  processedAt?: string | null;
};

export type DependentOcrTaskAccepted = {
  taskId: string;
  hubUrl?: string;
  signalRGroup?: string;
  listenEvent?: string;
  checkStatusUrl?: string;
  message?: string;
};

export type PollOcrTaskOptions = {
  intervalMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
};

export class OcrPollTimeoutError extends Error {
  constructor(message = 'OCR poll timed out') {
    super(message);
    this.name = 'OcrPollTimeoutError';
  }
}

function createAbortError(): Error {
  const err = new Error('Aborted');
  err.name = 'AbortError';
  return err;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw createAbortError();
  }
}

/**
 * Build FormData: field `File` (bắt buộc), `BackFile` (optional).
 * RN: append object { uri, name, type }.
 */
export function buildOcrFormData(file: OcrImagePart, backFile?: OcrImagePart): FormData {
  const form = new FormData();
  form.append('File', {
    uri: file.uri,
    name: file.name ?? 'front.jpg',
    type: file.type ?? 'image/jpeg',
  } as unknown as Blob);
  if (backFile) {
    form.append('BackFile', {
      uri: backFile.uri,
      name: backFile.name ?? 'back.jpg',
      type: backFile.type ?? 'image/jpeg',
    } as unknown as Blob);
  }
  return form;
}

function multipartConfig(signal?: AbortSignal): AxiosRequestConfig {
  return {
    // Gemini OCR 2 mặt thường 20–60s; 30s cũ gây timeout trên máy thật
    timeout: 120000,
    signal,
    // Bỏ default application/json của apiClient — để runtime gắn multipart boundary
    headers: { 'Content-Type': undefined as unknown as string },
  };
}

function isHttp404(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const status = (error as { response?: { status?: number } }).response?.status;
  return status === 404;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(createAbortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export function createOcrApi(http: AxiosInstance) {
  async function extractUserCccd(
    file: OcrImagePart,
    backFile?: OcrImagePart,
    signal?: AbortSignal
  ): Promise<ApiResponse<UserCccdOcrResponseDto>> {
    const res = await http.post<ApiResponse<UserCccdOcrResponseDto>>(
      '/api/v1/auth/cccd-extractions',
      buildOcrFormData(file, backFile),
      multipartConfig(signal)
    );
    return res.data;
  }

  async function extractDirect(
    file: OcrImagePart,
    backFile?: OcrImagePart,
    signal?: AbortSignal
  ): Promise<ApiResponse<OcrExtractResponseMessage>> {
    const res = await http.post<ApiResponse<OcrExtractResponseMessage>>(
      '/api/v1/ocr/direct-extractions',
      buildOcrFormData(file, backFile),
      multipartConfig(signal)
    );
    return res.data;
  }

  async function createDependentOcrTask(
    file: OcrImagePart,
    backFile?: OcrImagePart,
    signal?: AbortSignal
  ): Promise<ApiResponse<DependentOcrTaskAccepted>> {
    const res = await http.post<ApiResponse<DependentOcrTaskAccepted>>(
      '/api/v1/ocr/dependents',
      buildOcrFormData(file, backFile),
      multipartConfig(signal)
    );
    return res.data;
  }

  async function getOcrTask(
    taskId: string,
    signal?: AbortSignal
  ): Promise<ApiResponse<OcrExtractResponseMessage>> {
    const res = await http.get<ApiResponse<OcrExtractResponseMessage>>(
      `/api/v1/ocr/tasks/${taskId}`,
      multipartConfig(signal)
    );
    return res.data;
  }

  /**
   * Poll GET task. 404 = đang xử lý → chờ interval rồi thử lại.
   * Hết timeoutMs → OcrPollTimeoutError. AbortSignal → AbortError.
   *
   * Parse kết quả (caller): outer = ApiResponse; msg = outer.data (OcrExtractResponseMessage);
   * ok = outer.success && msg?.success && msg.data.
   */
  async function pollOcrTask(
    taskId: string,
    options: PollOcrTaskOptions = {}
  ): Promise<ApiResponse<OcrExtractResponseMessage>> {
    const intervalMs = options.intervalMs ?? 2000;
    const timeoutMs = options.timeoutMs ?? 30000;
    const signal = options.signal;
    const startedAt = Date.now();

    for (;;) {
      throwIfAborted(signal);

      try {
        return await getOcrTask(taskId, signal);
      } catch (error) {
        throwIfAborted(signal);
        if (!isHttp404(error)) {
          throw error;
        }
      }

      if (Date.now() - startedAt >= timeoutMs) {
        throw new OcrPollTimeoutError();
      }

      const remaining = timeoutMs - (Date.now() - startedAt);
      await sleep(Math.min(intervalMs, Math.max(remaining, 0)), signal);

      if (Date.now() - startedAt >= timeoutMs) {
        throw new OcrPollTimeoutError();
      }
    }
  }

  return {
    extractUserCccd,
    extractDirect,
    createDependentOcrTask,
    getOcrTask,
    pollOcrTask,
  };
}

/** Client mặc định: dùng apiClient (JWT interceptor) + timeout 30s / request OCR */
export const ocrApi = createOcrApi(apiClient);
