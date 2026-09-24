import { config } from '../constants/config';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { apiClient, storageHelper } from './apiClient';
import type { ApiResponse } from './authApi';
import {
  BatchUploadResponse,
  ConfirmDocumentReviewRequest,
  DocumentItemResponse,
  DocumentQueryParameters,
  DocumentReviewResponse,
  ExpenseOcrResult,
  InvoiceLineItem,
  PagedResult,
  TaxDocumentTypeItem,
  TaxPeriodItem,
} from '../types/expense';

/**
 * Chuyển đổi file từ URI sang Base64 và MIME type trên cả Web và Mobile
 */
async function getFileBase64AndMime(file: {
  uri: string;
  name?: string;
  type?: string;
  base64?: string;
}): Promise<{ base64: string; mimeType: string }> {
  let mimeType = 'image/jpeg';
  const fileName = (file.name || '').toLowerCase();
  if (fileName.endsWith('.png')) mimeType = 'image/png';
  else if (fileName.endsWith('.pdf')) mimeType = 'application/pdf';
  else if (fileName.endsWith('.webp')) mimeType = 'image/webp';
  else if (fileName.endsWith('.heic')) mimeType = 'image/heic';
  else if (fileName.endsWith('.heif')) mimeType = 'image/heif';
  else if (file.type && file.type.startsWith('image/')) mimeType = file.type;
  else if (file.type === 'application/pdf') mimeType = 'application/pdf';

  // 1. Base64 có sẵn
  if (file.base64 && file.base64.length > 50) {
    let cleanBase64 = file.base64;
    if (cleanBase64.includes(',')) {
      cleanBase64 = cleanBase64.split(',')[1];
    }
    return { base64: cleanBase64.trim(), mimeType };
  }

  // 2. Data URL
  if (file.uri.startsWith('data:')) {
    const parts = file.uri.split(',');
    const match = file.uri.match(/data:(.*?);base64/);
    if (match && match[1] && match[1] !== 'application/octet-stream') {
      mimeType = match[1];
    }
    return { base64: parts[1] || '', mimeType };
  }

  // 3. Native (Android / iOS)
  if (Platform.OS !== 'web') {
    try {
      const base64 = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (base64 && base64.length > 50) {
        return { base64: base64.trim(), mimeType };
      }
    } catch (fsErr) {
      console.warn('Không thể đọc Base64 qua FileSystem:', fsErr);
    }
  }

  // 4. Web fallback
  try {
    const response = await fetch(file.uri);
    const blob = await response.blob();
    if (
      blob.type &&
      (blob.type.startsWith('image/') || blob.type === 'application/pdf') &&
      blob.type !== 'application/octet-stream'
    ) {
      mimeType = blob.type;
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve({ base64, mimeType });
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn('Không thể đọc file sang Base64 qua fetch:', err);
    throw err;
  }
}

/**
 * Chuyển đổi dữ liệu DocumentReviewResponse từ backend sang ExpenseOcrResult dùng trong giao diện Review và Danh sách
 */
export function mapDocumentReviewToOcrResult(
  doc: DocumentReviewResponse,
  fallbackYear?: number,
  documentTypes?: TaxDocumentTypeItem[]
): ExpenseOcrResult {
  const matchedType = documentTypes?.find((t) => t.code === doc.docTypeCode);
  const docTypeCode = doc.docTypeCode || '';
  const docTypeName = doc.docTypeName || matchedType?.name || (doc.docTypeCode ? doc.docTypeCode : 'Chứng từ chi phí');

  return {
    id: doc.id,
    documentId: doc.id,
    periodId: doc.periodId,
    docTypeCode,
    docTypeName,
    fileUrl: doc.fileUrl,
    originalFilename: doc.originalFilename || 'expense_document.jpg',
    sellerName: doc.sellerName || undefined,
    sellerTaxCode: doc.sellerTaxCode || undefined,
    sellerAddress: doc.sellerAddress || undefined,
    sellerPhone: doc.sellerPhone || undefined,
    invoiceSeries: doc.invoiceSeries || undefined,
    invoiceNumber: doc.invoiceNumber || undefined,
    invoiceDate: doc.invoiceDate || undefined,
    extractedYear: doc.extractedYear || fallbackYear || new Date().getFullYear(),
    lookupUrl: doc.lookupUrl || undefined,
    lookupCode: doc.lookupCode || undefined,
    buyerName: doc.buyerName || undefined,
    buyerIdCard: doc.buyerIdCard || undefined,
    buyerTaxCode: doc.buyerTaxCode || undefined,
    buyerAddress: doc.buyerAddress || undefined,
    paymentMethod: doc.paymentMethod || 'Chuyển khoản',
    totalAmount: doc.totalAmount ?? 0,
    totalAmountInWords: doc.totalAmountInWords || undefined,
    isNotReimbursed: doc.isNotReimbursed ?? false,
    items: (doc.items || []).map((it, idx) => ({
      itemOrder: it.itemOrder || idx + 1,
      itemName: it.itemName,
      unit: it.unit || null,
      quantity: it.quantity ?? 1,
      unitPrice: it.unitPrice ?? 0,
      totalPrice: it.totalPrice ?? (it.quantity ?? 1) * (it.unitPrice ?? 0),
    })),
    overallConfidence: 0.95,
    appliedThreshold: 0.8,
    isPassedThreshold: true,
    hasCrucialLowConfidence: false,
    fields: [],
    qualityEvaluation: {
      qualityScore: 0.95,
      requiredThreshold: 0.75,
      qualityIssues: [],
      isPassedQuality: true,
    },
    validationStatus: {
      isYearValid: doc.isYearValid ?? true,
      isDocTypeValid: doc.isTaxEligible ?? true,
      isIdentityValid: doc.isIdentityValid ?? true,
      isPassedThreshold: true,
    },
    validationErrors: (() => {
      const errs: any[] = [];
      if (doc.isIdentityValid === false) {
        errs.push({
          code: 'ERR_IDENTITY_MISMATCH',
          field: 'buyer_name',
          message: 'Thông tin người mua trên hóa đơn (' + (doc.buyerName || 'Trống') + ') không khớp với Người nộp thuế hoặc Người phụ thuộc đã đăng ký.',
          severity: 'error',
        });
      }
      if (doc.isYearValid === false) {
        errs.push({
          code: 'ERR_YEAR_MISMATCH',
          field: 'invoice_date',
          message: 'Năm lập trên hóa đơn (' + (doc.extractedYear || 'N/A') + ') không khớp với năm tính thuế đang kê khai.',
          severity: 'warning',
        });
      }
      if (doc.isTaxEligible === false) {
        errs.push({
          code: 'ERR_INVALID_DOC_TYPE',
          field: 'doc_type_code',
          message: 'Loại chứng từ này không thuộc danh mục được xét giảm trừ thuế theo quy định.',
          severity: 'warning',
        });
      }
      return errs;
    })(),
    status: (doc.status as any) || 'EXTRACTED',
    createdAt: doc.createdAt,
  };
}

export const CATEGORY_NAMES: Record<string, string> = {};

/**
 * Sanitize filename cho Backend & Supabase Storage.
 * Backend BE chỉ chấp nhận .jpg, .jpeg, .png, .pdf
 */
function sanitizeFileName(name: string, mimeType?: string): { sanitizedName: string; validMime: string } {
  const VIET_MAP: Record<string, string> = {
    'à':'a','á':'a','â':'a','ã':'a','ä':'a','å':'a',
    'è':'e','é':'e','ê':'e','ë':'e',
    'ì':'i','í':'i','î':'i','ï':'i',
    'ò':'o','ó':'o','ô':'o','õ':'o','ö':'o',
    'ù':'u','ú':'u','û':'u','ü':'u',
    'ý':'y','ÿ':'y',
    'À':'A','Á':'A','Â':'A','Ã':'A','Ä':'A','Å':'A',
    'È':'E','É':'E','Ê':'E','Ë':'E',
    'Ì':'I','Í':'I','Î':'I','Ï':'I',
    'Ò':'O','Ó':'O','Ô':'O','Õ':'O','Ö':'O',
    'Ù':'U','Ú':'U','Û':'U','Ü':'U',
    'Ý':'Y',
    'ă':'a','Ă':'A','đ':'d','Đ':'D',
    'ơ':'o','Ơ':'O','ư':'u','Ư':'U',
    'ạ':'a','ả':'a','ấ':'a','ầ':'a','ẩ':'a','ẫ':'a','ậ':'a','ắ':'a','ằ':'a','ẳ':'a','ẵ':'a','ặ':'a',
    'Ạ':'A','Ả':'A','Ấ':'A','Ầ':'A','Ẩ':'A','Ẫ':'A','Ậ':'A','Ắ':'A','Ằ':'A','Ẳ':'A','Ẵ':'A','Ặ':'A',
    'ẹ':'e','ẻ':'e','ẽ':'e','ế':'e','ề':'e','ể':'e','ễ':'e','ệ':'e',
    'Ẹ':'E','Ẻ':'E','Ẽ':'E','Ế':'E','Ề':'E','Ể':'E','Ễ':'E','Ệ':'E',
    'ỉ':'i','ị':'i','Ỉ':'I','Ị':'I',
    'ọ':'o','ỏ':'o','ố':'o','ồ':'o','ổ':'o','ỗ':'o','ộ':'o','ớ':'o','ờ':'o','ở':'o','ỡ':'o','ợ':'o',
    'Ọ':'O','Ỏ':'O','Ố':'O','Ồ':'O','Ổ':'O','Ỗ':'O','Ộ':'O','Ớ':'O','Ờ':'O','Ở':'O','Ỡ':'O','Ợ':'O',
    'ụ':'u','ủ':'u','ứ':'u','ừ':'u','ử':'u','ữ':'u','ự':'u',
    'Ụ':'U','Ủ':'U','Ứ':'U','Ừ':'U','Ử':'U','Ữ':'U','Ự':'U',
    'ỳ':'y','ỷ':'y','ỹ':'y','ỵ':'y',
    'Ỳ':'Y','Ỷ':'Y','Ỹ':'Y','Ỵ':'Y',
  };

  const dotIdx = name.lastIndexOf('.');
  let ext = dotIdx !== -1 ? name.slice(dotIdx).toLowerCase() : '';
  const base = dotIdx !== -1 ? name.slice(0, dotIdx) : name;
  const sanitized = base
    .split('')
    .map((c) => VIET_MAP[c] ?? c)
    .join('')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  let validMime = mimeType || 'image/jpeg';
  const allowedExts = ['.jpg', '.jpeg', '.png', '.pdf'];
  if (!allowedExts.includes(ext)) {
    if (validMime === 'application/pdf') {
      ext = '.pdf';
    } else if (validMime === 'image/png') {
      ext = '.png';
    } else {
      ext = '.jpg';
      validMime = 'image/jpeg';
    }
  } else {
    if (ext === '.pdf') validMime = 'application/pdf';
    else if (ext === '.png') validMime = 'image/png';
    else validMime = 'image/jpeg';
  }

  const finalName = (sanitized || 'invoice_' + Date.now()) + ext;
  return { sanitizedName: finalName, validMime };
}

/**
 * Lấy UserId từ store hoặc storage để gửi kèm request
 */
async function resolveUserId(userId?: string): Promise<string | undefined> {
  if (userId) return userId;
  try {
    const { useAuthStore } = await import('../stores/useAuthStore');
    const storeUserId = useAuthStore.getState().user?.id;
    if (storeUserId) return storeUserId;
  } catch {}

  try {
    const userDataStr = await storageHelper.getItem(config.storageKeys.userData);
    if (userDataStr) {
      const user = JSON.parse(userDataStr);
      if (user?.id) return user.id;
    }
  } catch {}

  try {
    const token = await storageHelper.getItem(config.storageKeys.accessToken);
    if (token) {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payloadStr = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
        const payload = JSON.parse(payloadStr);
        return payload.userId || payload.sub;
      }
    }
  } catch {}

  return undefined;
}

export const expenseApi = {
  /**
   * Khởi tạo hoặc lấy kỳ tính thuế theo năm (POST /api/v1/tax-periods)
   * BE TaxPeriodController yêu cầu cả TaxYear và UserId trong body
   */
  async initOrGetPeriod(taxYear: number, userId?: string): Promise<TaxPeriodItem> {
    const effectiveUserId = await resolveUserId(userId);
    const res = await apiClient.post<ApiResponse<TaxPeriodItem>>('/api/v1/tax-periods', {
      taxYear,
      userId: effectiveUserId,
    });
    return res.data.data!;
  },

  /**
   * Alias tương thích với các màn hình gọi createOrGetTaxPeriod
   */
  async createOrGetTaxPeriod(taxYear: number, userId?: string): Promise<TaxPeriodItem> {
    return this.initOrGetPeriod(taxYear, userId);
  },

  /**
   * Lấy danh sách các loại chứng từ thuế (GET /api/v1/tax-document-types)
   */
  async getTaxDocumentTypes(isTaxEligible?: boolean): Promise<TaxDocumentTypeItem[]> {
    const params = isTaxEligible !== undefined ? { isTaxEligible } : {};
    const res = await apiClient.get<ApiResponse<TaxDocumentTypeItem[]>>(
      '/api/v1/tax-document-types',
      { params }
    );
    return res.data.data || [];
  },

  /**
   * Tải lên danh sách hóa đơn theo đợt (POST /api/v1/tax-periods/{periodId}/documents/upload)
   */
  async batchUploadDocuments(
    periodId: string,
    files: Array<{ uri: string; name?: string; type?: string; base64?: string }>
  ): Promise<BatchUploadResponse> {
    const formData = new FormData();

    for (const file of files) {
      const { sanitizedName, validMime } = sanitizeFileName(file.name || 'expense_invoice.jpg', file.type);

      if (Platform.OS === 'web') {
        try {
          const response = await fetch(file.uri);
          const blob = await response.blob();
          formData.append('files', blob, sanitizedName);
        } catch {
          formData.append('files', {
            uri: file.uri,
            name: sanitizedName,
            type: validMime,
          } as any);
        }
      } else {
        formData.append('files', {
          uri: file.uri,
          name: sanitizedName,
          type: validMime,
        } as any);
      }
    }

    const res = await apiClient.post<ApiResponse<BatchUploadResponse>>(
      `${config.apiBaseUrl}/api/v1/tax-periods/${periodId}/documents/upload`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        transformRequest: (data) => data,
        timeout: 60000,
      }
    );

    if (!res.data?.success || !res.data?.data) {
      throw new Error(res.data?.message || 'Upload thất bại');
    }
    return res.data.data;
  },

  /**
   * Tải lên một hóa đơn đơn lẻ (gọi batchUploadDocuments với 1 phần tử)
   */
  async uploadDocument(
    periodId: string,
    file: { uri: string; name?: string; type?: string; base64?: string },
    docTypeCode?: string
  ): Promise<BatchUploadResponse> {
    return this.batchUploadDocuments(periodId, [file]);
  },

  /**
   * Xác nhận và lưu trữ chính thức dữ liệu chứng từ sau khi review
   * PUT /api/v1/tax-periods/{periodId}/documents/{documentId}/confirm
   */
  async confirmDocumentReview(
    periodId: string,
    documentId: string,
    data: ConfirmDocumentReviewRequest
  ): Promise<DocumentReviewResponse> {
    const res = await apiClient.put<ApiResponse<DocumentReviewResponse>>(
      `/api/v1/tax-periods/${periodId}/documents/${documentId}/confirm`,
      data
    );
    return res.data.data!;
  },

  /**
   * Kích hoạt lại bóc tách OCR cho một chứng từ cụ thể (khi ở trạng thái UPLOADED hoặc FAILED)
   * POST /api/v1/tax-periods/{periodId}/documents/{documentId}/extract
   */
  async triggerDocumentOcr(
    periodId: string,
    documentId: string
  ): Promise<ApiResponse<object>> {
    const res = await apiClient.post<ApiResponse<object>>(
      `/api/v1/tax-periods/${periodId}/documents/${documentId}/extract`
    );
    return res.data;
  },

  /**
   * Lấy danh sách chứng từ theo kỳ tính thuế (GET /api/v1/tax-periods/{periodId}/documents)
   * Backend trả về ApiResponse<List<DocumentReviewResponseDto>>
   */
  async getDocumentsByPeriod(
    periodId: string,
    query?: DocumentQueryParameters
  ): Promise<DocumentReviewResponse[]> {
    const res = await apiClient.get<ApiResponse<any>>(
      `/api/v1/tax-periods/${periodId}/documents`,
      { params: query }
    );
    const raw = res.data?.data;
    if (Array.isArray(raw)) {
      return raw;
    }
    if (raw && Array.isArray(raw.items)) {
      return raw.items;
    }
    return [];
  },

  /**
   * Xem thông tin chi tiết của một chứng từ theo ID
   * GET /api/v1/tax-periods/{periodId}/documents/{documentId}
   */
  async getDocumentById(
    periodId: string,
    documentId: string
  ): Promise<DocumentReviewResponse> {
    const res = await apiClient.get<ApiResponse<DocumentReviewResponse>>(
      `/api/v1/tax-periods/${periodId}/documents/${documentId}`
    );
    return res.data.data!;
  },

  /**
   * Nộp và khóa kỳ tính thuế (POST /api/v1/tax-periods/{periodId}/submit)
   */
  async submitTaxPeriod(periodId: string): Promise<TaxPeriodItem> {
    const res = await apiClient.post<ApiResponse<TaxPeriodItem>>(
      `/api/v1/tax-periods/${periodId}/submit`
    );
    return res.data.data!;
  },
};
