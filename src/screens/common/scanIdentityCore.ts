import type { OcrExtractedFields, ScanIdentitySource } from '../../types/ocr';
import { isAcceptedImage, OCR_MAX_BYTES, OCR_MIN_PX, stripCitizenId } from './ocrUtils';

export const OCR_BLUR_MAX_BYTES = 28 * 1024;

export const WEB_CAMERA_UNAVAILABLE_MESSAGE =
  'Trên web hãy chọn ảnh từ thư viện hoặc nhập tay.';

export const OCR_NOT_WIRED_MESSAGE = 'OCR_NOT_WIRED';

export type OcrImageEvalInput = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  width?: number | null;
  height?: number | null;
};

export type OcrImageEvalResult =
  | { ok: true }
  | { ok: false; reason: 'format' | 'tooLarge' | 'tooSmall' | 'blurry' };

export function createEmptyOcrFields(): OcrExtractedFields {
  return {
    fullName: '',
    citizenId: '',
    dateOfBirth: '',
    address: '',
    gender: '',
    issueDate: '',
  };
}

export function evaluateOcrImageAsset(asset: OcrImageEvalInput): OcrImageEvalResult {
  if (!isAcceptedImage(asset.fileName, asset.mimeType)) {
    return { ok: false, reason: 'format' };
  }
  if (asset.fileSize != null && asset.fileSize > OCR_MAX_BYTES) {
    return { ok: false, reason: 'tooLarge' };
  }
  const width = asset.width ?? 0;
  const height = asset.height ?? 0;
  if ((width > 0 && width < OCR_MIN_PX) || (height > 0 && height < OCR_MIN_PX)) {
    return { ok: false, reason: 'tooSmall' };
  }
  if (asset.fileSize != null && asset.fileSize < OCR_BLUR_MAX_BYTES) {
    return { ok: false, reason: 'blurry' };
  }
  return { ok: true };
}

export function canConfirmOcrReview(
  fields: OcrExtractedFields,
  source: ScanIdentitySource
): boolean {
  const fullNameOk = fields.fullName.trim().length > 0;
  const dobOk = fields.dateOfBirth.trim().length > 0;
  const citizenId = stripCitizenId(fields.citizenId);
  const hasCccd12 = citizenId.length === 12;
  const hasDocNumber = Boolean(fields.documentNumber?.trim());

  if (source === 'register') {
    return fullNameOk && dobOk && hasCccd12;
  }
  if (source === 'editProfile') {
    return fullNameOk && dobOk;
  }
  // dependent
  return fullNameOk && dobOk && (hasCccd12 || hasDocNumber);
}

/** Stub extract — OCR-05/06/07 gắn API thật. */
export async function stubRunExtract(
  _frontUri: string,
  _backUri?: string | null,
  signal?: AbortSignal
): Promise<OcrExtractedFields> {
  if (signal?.aborted) {
    const err = new Error('Aborted');
    err.name = 'AbortError';
    throw err;
  }
  throw new Error(OCR_NOT_WIRED_MESSAGE);
}
