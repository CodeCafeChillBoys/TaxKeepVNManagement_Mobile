import * as FileSystem from 'expo-file-system/legacy';
import { apiClient } from './apiClient';
import type { ApiResponse } from './authApi';
import { config } from '../constants/config';
import type {
  TaxSettlementExportPdfRequest,
  TaxSettlementExportRequest,
  TaxSettlementExportZipRequest,
  TaxSettlementListItem,
  TaxSettlementPackageZipResponse,
  TaxSettlementPreview,
  TaxSettlementPreviewRequest,
} from '../types/taxSettlement';

const BASE = '/api/v1/tax-settlements';

function unwrap<T>(res: { data: ApiResponse<T> }, fallbackMsg: string): T {
  const body = res.data;
  if (!body?.success || body.data === undefined || body.data === null) {
    throw new Error(body?.message || body?.errorCode || fallbackMsg);
  }
  return body.data;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode(...slice);
  }
  // btoa available on RN / Hermes
  return globalThis.btoa(binary);
}

function parseFileName(contentDisposition: string | undefined, fallback: string): string {
  if (!contentDisposition) return fallback;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1].trim());
    } catch {
      return utf8[1].trim();
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(contentDisposition);
  return plain?.[1]?.trim() || fallback;
}

function emptyToNull(v?: string | null): string | null {
  const t = (v ?? '').trim();
  return t ? t : null;
}

function toPdfBody(req?: TaxSettlementExportPdfRequest | null): TaxSettlementExportPdfRequest {
  return {
    taxOfficeName: emptyToNull(req?.taxOfficeName),
    taxCode: emptyToNull(req?.taxCode),
    bankAccountNumber: emptyToNull(req?.bankAccountNumber),
    bankName: emptyToNull(req?.bankName),
    contactAddress: emptyToNull(req?.contactAddress),
    phoneNumber: emptyToNull(req?.phoneNumber),
    email: emptyToNull(req?.email),
  };
}

function toZipBody(req?: TaxSettlementExportZipRequest | null): TaxSettlementExportZipRequest {
  return {
    ...toPdfBody(req),
    note: emptyToNull(req?.note),
  };
}

function resolveDownloadUrl(downloadUrl: string): string {
  if (/^https?:\/\//i.test(downloadUrl)) return downloadUrl;
  const base = config.apiBaseUrl.replace(/\/+$/, '');
  const path = downloadUrl.startsWith('/') ? downloadUrl : `/${downloadUrl}`;
  return `${base}${path}`;
}

function toBase64(data: unknown): string {
  if (typeof data === 'string') {
    // RN/axios đôi khi trả binary string hoặc đã là base64
    if (/^[A-Za-z0-9+/=\r\n]+$/.test(data) && data.length % 4 === 0 && data.length > 64) {
      return data.replace(/\s/g, '');
    }
    return globalThis.btoa(data);
  }
  if (data instanceof ArrayBuffer) {
    return arrayBufferToBase64(data);
  }
  if (ArrayBuffer.isView(data)) {
    return arrayBufferToBase64(
      data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
    );
  }
  throw new Error('Phản hồi file không hợp lệ.');
}

async function saveBinaryToDevice(
  data: unknown,
  fileName: string,
  mimeType: string
): Promise<SavedBinaryFile> {
  const root = FileSystem.documentDirectory || FileSystem.cacheDirectory;
  if (!root) throw new Error('Không ghi được file trên thiết bị này.');
  const dir = `${root}taxkeep-exports/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const safeName = fileName.replace(/[^\w.\-()+]/g, '_');
  const uri = `${dir}${safeName}`;
  const base64 = toBase64(data);
  if (!base64 || base64.length < 8) {
    throw new Error('File rỗng hoặc không đọc được từ máy chủ.');
  }
  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return { uri, fileName: safeName, mimeType };
}

export type SavedBinaryFile = {
  uri: string;
  fileName: string;
  mimeType: string;
};

export const taxSettlementApi = {
  /** POST /api/v1/tax-settlements/preview — xem trước, không lưu DB */
  async preview(request: TaxSettlementPreviewRequest): Promise<TaxSettlementPreview> {
    const res = await apiClient.post<ApiResponse<TaxSettlementPreview>>(`${BASE}/preview`, {
      taxYear: request.taxYear,
      cutoffDate: request.cutoffDate || null,
      charityDeduction: request.charityDeduction ?? 0,
    });
    return unwrap(res, 'Không tính được xem trước quyết toán.');
  },

  /** POST /api/v1/tax-settlements/export — chốt LOCKED */
  async export(request: TaxSettlementExportRequest): Promise<TaxSettlementPreview> {
    const res = await apiClient.post<ApiResponse<TaxSettlementPreview>>(`${BASE}/export`, {
      taxYear: request.taxYear,
      cutoffDate: request.cutoffDate || null,
      charityDeduction: request.charityDeduction ?? 0,
      selectedIncomeSourceIds: request.selectedIncomeSourceIds ?? null,
      note: request.note ?? null,
    });
    return unwrap(res, 'Không chốt được hồ sơ quyết toán.');
  },

  /** GET /api/v1/tax-settlements */
  async getList(): Promise<TaxSettlementListItem[]> {
    const res = await apiClient.get<ApiResponse<TaxSettlementListItem[]>>(BASE);
    return unwrap(res, 'Không tải được danh sách hồ sơ quyết toán.');
  },

  /** GET /api/v1/tax-settlements/{id} */
  async getById(id: string): Promise<TaxSettlementPreview> {
    const res = await apiClient.get<ApiResponse<TaxSettlementPreview>>(`${BASE}/${id}`);
    return unwrap(res, 'Không tải được chi tiết hồ sơ quyết toán.');
  },

  /**
   * POST /api/v1/tax-settlements/{id}/export-pdf
   * Binary PDF → ghi cache → trả URI để chia sẻ / mở.
   */
  async exportPdf(
    id: string,
    request?: TaxSettlementExportPdfRequest | null
  ): Promise<SavedBinaryFile> {
    const res = await apiClient.post(`${BASE}/${id}/export-pdf`, toPdfBody(request), {
      responseType: 'arraybuffer',
      timeout: 90000,
      headers: { Accept: 'application/pdf' },
      transformResponse: [(data) => data],
    });

    const fileName = parseFileName(
      res.headers?.['content-disposition'] || res.headers?.['Content-Disposition'],
      `ToKhai_02_QTT_TNCN_${id.slice(0, 8)}.pdf`
    );
    return saveBinaryToDevice(res.data, fileName, 'application/pdf');
  },

  /** POST /api/v1/tax-settlements/{id}/export-zip → JSON + signed URL */
  async exportZip(
    id: string,
    request?: TaxSettlementExportZipRequest | null
  ): Promise<TaxSettlementPackageZipResponse> {
    const res = await apiClient.post<ApiResponse<TaxSettlementPackageZipResponse>>(
      `${BASE}/${id}/export-zip`,
      toZipBody(request),
      { timeout: 120000 }
    );
    return unwrap(res, 'Không đóng gói được hồ sơ ZIP.');
  },

  /**
   * GET /api/v1/tax-settlements/download/{token} (AllowAnonymous)
   * 410 = hết hạn → ném error với status 410.
   */
  async downloadByUrl(downloadUrl: string, preferredName?: string): Promise<SavedBinaryFile> {
    const absolute = resolveDownloadUrl(downloadUrl);
    const res = await apiClient.get(absolute, {
      responseType: 'arraybuffer',
      timeout: 120000,
      headers: { Accept: 'application/pdf, application/zip, */*' },
      transformResponse: [(data) => data],
      // absolute URL — axios vẫn dùng baseURL nếu relative; đã absolute nên OK
      validateStatus: (s) => s >= 200 && s < 300,
    });

    const contentType = String(
      res.headers?.['content-type'] || res.headers?.['Content-Type'] || 'application/octet-stream'
    );
    const isZip = contentType.includes('zip') || (preferredName || '').toLowerCase().endsWith('.zip');
    const fallback = preferredName || (isZip ? 'HoSo_QuyetToan.zip' : 'ToKhai.pdf');
    const fileName = parseFileName(
      res.headers?.['content-disposition'] || res.headers?.['Content-Disposition'],
      fallback
    );
    const mime = isZip
      ? 'application/zip'
      : contentType.split(';')[0].trim() || 'application/octet-stream';
    return saveBinaryToDevice(res.data, fileName, mime);
  },
};
