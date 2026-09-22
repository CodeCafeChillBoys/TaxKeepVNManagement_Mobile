import { config } from '../constants/config';
import axios from 'axios';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { apiClient } from './apiClient';
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

  // 1. Ưu tiên Base64 có sẵn (từ camera/thư viện ảnh)
  if (file.base64 && file.base64.length > 50) {
    let cleanBase64 = file.base64;
    if (cleanBase64.includes(',')) {
      cleanBase64 = cleanBase64.split(',')[1];
    }
    return { base64: cleanBase64.trim(), mimeType };
  }

  // 2. Nếu là Data URL
  if (file.uri.startsWith('data:')) {
    const parts = file.uri.split(',');
    const match = file.uri.match(/data:(.*?);base64/);
    if (match && match[1] && match[1] !== 'application/octet-stream') {
      mimeType = match[1];
    }
    return { base64: parts[1] || '', mimeType };
  }

  // 3. Nếu trên Native (Android / iOS): đọc trực tiếp file hệ thống qua FileSystem (an toàn cho file:// và content://)
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

  // 4. Fallback (Web): dùng fetch & FileReader
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
    console.warn('Không thể đọc file sang Base64 qua fetch, thử phương thức fallback:', err);
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
    validationErrors: [],
    status: (doc.status as any) || 'EXTRACTED',
    createdAt: doc.createdAt,
  };
}

export const CATEGORY_NAMES: Record<string, string> = {};

/**
 * Sanitize filename for Supabase Storage - removes Vietnamese/Unicode characters.
 * Supabase S3 rejects storage keys containing non-ASCII characters.
 */
function sanitizeFileName(name: string): string {
  const VIET_MAP: Record<string, string> = {
    '\u00e0':'a','\u00e1':'a','\u00e2':'a','\u00e3':'a','\u00e4':'a','\u00e5':'a',
    '\u00e8':'e','\u00e9':'e','\u00ea':'e','\u00eb':'e',
    '\u00ec':'i','\u00ed':'i','\u00ee':'i','\u00ef':'i',
    '\u00f2':'o','\u00f3':'o','\u00f4':'o','\u00f5':'o','\u00f6':'o',
    '\u00f9':'u','\u00fa':'u','\u00fb':'u','\u00fc':'u',
    '\u00fd':'y','\u00ff':'y',
    '\u00c0':'A','\u00c1':'A','\u00c2':'A','\u00c3':'A','\u00c4':'A','\u00c5':'A',
    '\u00c8':'E','\u00c9':'E','\u00ca':'E','\u00cb':'E',
    '\u00cc':'I','\u00cd':'I','\u00ce':'I','\u00cf':'I',
    '\u00d2':'O','\u00d3':'O','\u00d4':'O','\u00d5':'O','\u00d6':'O',
    '\u00d9':'U','\u00da':'U','\u00db':'U','\u00dc':'U',
    '\u00dd':'Y',
    // Vietnamese specific
    '\u0103':'a','\u0102':'A','\u0111':'d','\u0110':'D',
    '\u01a1':'o','\u01a0':'O','\u01b0':'u','\u01af':'U',
    '\u1ea1':'a','\u1ea3':'a','\u1ea5':'a','\u1ea7':'a','\u1ea9':'a','\u1eab':'a','\u1ead':'a','\u1eaf':'a','\u1eb1':'a','\u1eb3':'a','\u1eb5':'a','\u1eb7':'a',
    '\u1eA0':'A','\u1eA2':'A','\u1eA4':'A','\u1eA6':'A','\u1eA8':'A','\u1eAa':'A','\u1eAc':'A','\u1eAe':'A','\u1eB0':'A','\u1eB2':'A','\u1eB4':'A','\u1eB6':'A',
    '\u1eb9':'e','\u1ebb':'e','\u1ebd':'e','\u1ebf':'e','\u1ec1':'e','\u1ec3':'e','\u1ec5':'e','\u1ec7':'e',
    '\u1eB8':'E','\u1eBa':'E','\u1eBc':'E','\u1eBe':'E','\u1eC0':'E','\u1eC2':'E','\u1eC4':'E','\u1eC6':'E',
    '\u1ec9':'i','\u1ecb':'i','\u1ec8':'I','\u1eca':'I',
    '\u1ecd':'o','\u1ecf':'o','\u1ed1':'o','\u1ed3':'o','\u1ed5':'o','\u1ed7':'o','\u1ed9':'o','\u1edb':'o','\u1edd':'o','\u1edf':'o','\u1ee1':'o','\u1ee3':'o',
    '\u1ecc':'O','\u1ece':'O','\u1ed0':'O','\u1ed2':'O','\u1ed4':'O','\u1ed6':'O','\u1ed8':'O','\u1eda':'O','\u1edc':'O','\u1ede':'O','\u1ee0':'O','\u1ee2':'O',
    '\u1ee5':'u','\u1ee7':'u','\u1ee9':'u','\u1eeb':'u','\u1eed':'u','\u1eef':'u','\u1ef1':'u',
    '\u1ee4':'U','\u1ee6':'U','\u1ee8':'U','\u1eea':'U','\u1eec':'U','\u1eee':'U','\u1ef0':'U',
    '\u1ef3':'y','\u1ef5':'y','\u1ef7':'y','\u1ef9':'y',
    '\u1ef2':'Y','\u1ef4':'Y','\u1ef6':'Y','\u1ef8':'Y',
  };
  const dotIdx = name.lastIndexOf('.');
  const ext = dotIdx !== -1 ? name.slice(dotIdx).toLowerCase() : '';
  const base = dotIdx !== -1 ? name.slice(0, dotIdx) : name;
  const sanitized = base
    .split('')
    .map((c) => VIET_MAP[c] ?? c)
    .join('')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return (sanitized || 'invoice') + ext;
}

export const expenseApi = {
  /**
   * Khởi tạo hoặc lấy kỳ tính thuế theo năm (POST /api/v1/tax-periods)
   */
  async initOrGetPeriod(taxYear: number, userId?: string): Promise<TaxPeriodItem> {
    const res = await apiClient.post<ApiResponse<TaxPeriodItem>>('/api/v1/tax-periods', {
      taxYear,
      userId: userId || undefined,
    });
    return res.data.data!;
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
    files: Array<{ uri: string; name?: string; type?: string }>
  ): Promise<BatchUploadResponse> {
    const formData = new FormData();

    for (const file of files) {
      if (Platform.OS === 'web') {
        try {
          // Trên web: fetch blob từ URI (data: hoặc blob: URL) và append đúng chuẩn
          const response = await fetch(file.uri);
          const blob = await response.blob();
          formData.append('files', blob, sanitizeFileName(file.name || 'expense_invoice.jpg'));
        } catch {
          formData.append('files', {
            uri: file.uri,
            name: sanitizeFileName(file.name || 'expense_invoice.jpg'),
            type: file.type || 'image/jpeg',
          } as any);
        }
      } else {
        formData.append('files', {
          uri: file.uri,
          name: sanitizeFileName(file.name || 'expense_invoice.jpg'),
          type: file.type || 'image/jpeg',
        } as any);
      }
    }

    const res = await apiClient.post<ApiResponse<BatchUploadResponse>>(
      `/api/v1/tax-periods/${periodId}/documents/upload`,
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
   * Bóc tách OCR trực tiếp đồng bộ (Direct Sync OCR)
   * Sử dụng AI Engine (Google Gemini Multimodal Vision) để bóc tách hóa đơn chuẩn xác
   */
  async extractDocumentDirectSync(
    file: { uri: string; name?: string; type?: string },
    configuredTypes?: TaxDocumentTypeItem[]
  ): Promise<ExpenseOcrResult> {
    try {
      const { base64, mimeType } = await getFileBase64AndMime(file);

      const docTypeListStr =
        configuredTypes && configuredTypes.length > 0
          ? configuredTypes
              .map((t) => `- '${t.code}': ${t.name} (${t.isTaxEligible ? 'Đủ điều kiện giảm trừ thuế TNCN' : 'Không giảm trừ'}).`)
              .join('\n')
          : '- Áp dụng mã loại chứng từ chuẩn theo danh mục hệ thống.';

      const prompt = `Bạn là AI chuyên gia phân loại và bóc tách chứng từ tài chính / hóa đơn giảm trừ thuế thu nhập cá nhân tại Việt Nam.

DANH SÁCH DANH MỤC HỢP LỆ THEO CẤU HÌNH HỆ THỐNG:
${docTypeListStr}
- 'UNSUPPORTED': Hóa đơn thương mại, mua sắm, ăn uống, dịch vụ thông thường không thuộc diện giảm trừ thuế cá nhân.
- 'NOT_TAX_DOCUMENT': Tệp tin không phải hóa đơn/chứng từ tài chính (ảnh chân dung, phong cảnh, meme...).

NHIỆM VỤ:
Trích xuất chi tiết toàn bộ các trường thông tin từ hóa đơn/chứng từ trong ảnh.
Trả về DUY NHẤT một đối tượng JSON chuẩn xác với các trường sau:
{
  "isTaxDocument": true,
  "docTypeCode": "MA_LOAI_CHUNG_TU_PHU_HOP",
  "classificationReason": "Lý do phân loại ngắn gọn",
  "sellerName": "Tên cơ quan, tổ chức, doanh nghiệp hoặc đơn vị phát hành chứng từ",
  "sellerTaxCode": "Mã số thuế bên bán (nếu có)",
  "sellerAddress": "Địa chỉ bên bán (nếu có)",
  "sellerPhone": "Số điện thoại bên bán (nếu có)",
  "invoiceSeries": "Ký hiệu hóa đơn / Mẫu số (ví dụ: 1C26TBH, 2C24TLL...)",
  "invoiceNumber": "Số hóa đơn (ví dụ: 0008261)",
  "invoiceDate": "Ngày hóa đơn theo định dạng YYYY-MM-DD",
  "extractedYear": 2026,
  "lookupUrl": "Đường dẫn tra cứu hóa đơn trực tuyến (nếu có)",
  "lookupCode": "Mã số tra cứu / Mã bí mật (nếu có)",
  "buyerName": "Tên người mua / Bệnh nhân / Học sinh / Người nộp thuế",
  "buyerIdCard": "Số CMND/CCCD của người mua (nếu có)",
  "buyerTaxCode": "Mã số thuế cá nhân người mua (nếu có)",
  "buyerAddress": "Địa chỉ người mua (nếu có)",
  "paymentMethod": "Hình thức thanh toán (Tiền mặt / Chuyển khoản / Thẻ)",
  "totalAmount": 240000,
  "totalAmountInWords": "Hai trăm bốn mươi nghìn đồng",
  "items": [
    {
      "itemOrder": 1,
      "itemName": "Tên hàng hóa / dịch vụ / mục khám / học phí",
      "unit": "Lần / Cái / Tháng / Hộp",
      "quantity": 1,
      "unitPrice": 120000,
      "totalPrice": 120000
    }
  ],
  "overallConfidence": 0.95
}
Lưu ý quan trọng: "totalAmount", "quantity", "unitPrice", "totalPrice" phải là số thực (number). Chỉ trả về JSON thuần túy, không thêm lời dẫn.`;

      const apiKey = config.geminiApiKey;
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

      const geminiPayload = {
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64,
                },
              },
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          response_mime_type: 'application/json',
          temperature: 0.1,
        },
      };

      const aiResponse = await axios.post(geminiUrl, geminiPayload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 45000,
      });

      const candidates = aiResponse?.data?.candidates;
      if (candidates && candidates.length > 0) {
        const textOutput = candidates[0]?.content?.parts?.[0]?.text;
        if (textOutput) {
          const raw = JSON.parse(textOutput);

          const items: InvoiceLineItem[] = Array.isArray(raw.items)
            ? raw.items.map((it: any, idx: number) => {
                const qty = Number(it.quantity) || 1;
                const price = Number(it.unitPrice || it.unit_price) || 0;
                const total = Number(it.totalPrice || it.line_total || it.amount) || qty * price;
                return {
                  itemOrder: Number(it.itemOrder) || idx + 1,
                  itemName: String(it.itemName || it.description || `Mục ${idx + 1}`),
                  unit: it.unit || it.unit_of_measure || 'Lần',
                  quantity: qty,
                  unitPrice: price,
                  totalPrice: total,
                };
              })
            : [];

          let calcTotal = Number(raw.totalAmount ?? raw.total_amount ?? 0);
          if (calcTotal === 0 && items.length > 0) {
            calcTotal = items.reduce((acc, curr) => acc + (curr.totalPrice || 0), 0);
          }

          const docTypeCode = raw.docTypeCode || (configuredTypes?.[0]?.code ?? 'MEDICAL_EXPENSE_INVOICE');
          let docTypeName = 'Chứng từ chi phí';
          if (configuredTypes && configuredTypes.length > 0) {
            const matched = configuredTypes.find((t) => t.code === docTypeCode);
            if (matched) {
              docTypeName = matched.name;
            }
          }
          if (docTypeName === 'Chứng từ chi phí' && CATEGORY_NAMES[docTypeCode]) {
            docTypeName = CATEGORY_NAMES[docTypeCode];
          }

          const invoiceDateStr = raw.invoiceDate ? String(raw.invoiceDate).trim() : '';
          let extractedYearNum = raw.extractedYear ? Number(raw.extractedYear) : undefined;
          if (!extractedYearNum && invoiceDateStr.length >= 4) {
            const yr = parseInt(invoiceDateStr.slice(0, 4), 10);
            if (!isNaN(yr)) extractedYearNum = yr;
          }

          const result: ExpenseOcrResult = {
            documentId: `doc-${Date.now()}`,
            fileUrl: file.uri,
            originalFilename: file.name || 'expense_document.jpg',
            docTypeCode,
            docTypeName,
            sellerName: raw.sellerName || raw.seller_name || raw.merchantName,
            sellerTaxCode: raw.sellerTaxCode || raw.seller_tax_code,
            sellerAddress: raw.sellerAddress || raw.seller_address,
            sellerPhone: raw.sellerPhone || raw.seller_phone,
            invoiceSeries: raw.invoiceSeries || raw.invoice_series,
            invoiceNumber: raw.invoiceNumber || raw.invoice_number,
            invoiceDate: invoiceDateStr || undefined,
            extractedYear: extractedYearNum,
            lookupUrl: raw.lookupUrl || raw.lookup_url,
            lookupCode: raw.lookupCode || raw.lookup_code,
            buyerName: raw.buyerName || raw.buyer_name,
            buyerIdCard: raw.buyerIdCard || raw.buyer_id_card,
            buyerTaxCode: raw.buyerTaxCode || raw.buyer_tax_code,
            buyerAddress: raw.buyerAddress || raw.buyer_address,
            paymentMethod: raw.paymentMethod || raw.payment_method || 'Chuyển khoản',
            totalAmount: calcTotal,
            totalAmountInWords: raw.totalAmountInWords || raw.total_amount_in_words,
            items,
            overallConfidence: Number(raw.overallConfidence) || 0.95,
            appliedThreshold: 0.8,
            isPassedThreshold: (Number(raw.overallConfidence) || 0.95) >= 0.8,
            hasCrucialLowConfidence: false,
            fields: [],
            qualityEvaluation: {
              qualityScore: 0.95,
              requiredThreshold: 0.75,
              qualityIssues: [],
              isPassedQuality: true,
            },
            validationStatus: {
              isYearValid: true,
              isDocTypeValid: raw.isTaxDocument !== false && docTypeCode !== 'NOT_TAX_DOCUMENT',
              isIdentityValid: true,
              isPassedThreshold: true,
            },
            validationErrors: [],
            status: 'EXTRACTED',
            createdAt: new Date().toISOString(),
          };

          return result;
        }
      }
      throw new Error('AI không phản hồi dữ liệu trích xuất hợp lệ từ hình ảnh.');
    } catch (aiErr: any) {
      const errDetails = aiErr?.response?.data || aiErr?.message;
      console.warn('Lỗi khi trích xuất qua AI Gemini Multimodal:', errDetails);
      throw new Error(
        `Không thể bóc tách nội dung hóa đơn qua AI: ${
          aiErr?.response?.data?.error?.message || aiErr?.message || 'Lỗi xử lý hình ảnh'
        }`
      );
    }
  },

  /**
   * Xác nhận và lưu trữ chính thức dữ liệu chứng từ sau khi review (PUT /api/v1/tax-periods/{periodId}/documents/{documentId}/confirm)
   */
  async confirmDocumentReview(
    periodId: string,
    documentId: string,
    data: ConfirmDocumentReviewRequest
  ): Promise<any> {
    const res = await apiClient.put<ApiResponse<any>>(
      `/api/v1/tax-periods/${periodId}/documents/${documentId}/confirm`,
      data
    );
    return res.data;
  },

  /**
   * Kích hoạt lại bóc tách OCR cho một chứng từ cụ thể (chỉ cho phép khi ở trạng thái UPLOADED)
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
   * Lấy danh sách chứng từ theo kỳ tính thuế (hỗ trợ phân trang, tìm kiếm, lọc theo DocType/Status, sắp xếp)
   * GET /api/v1/tax-periods/{periodId}/documents?page=1&size=10&docTypeCode=VAT_INVOICE&status=CONFIRMED&search=congty
   */
  async getDocumentsByPeriod(
    periodId: string,
    query?: DocumentQueryParameters
  ): Promise<PagedResult<DocumentReviewResponse>> {
    const res = await apiClient.get<ApiResponse<PagedResult<DocumentReviewResponse>>>(
      `/api/v1/tax-periods/${periodId}/documents`,
      { params: query }
    );
    return res.data.data!;
  },

  /**
   * Xem thông tin chi tiết của một chứng từ cụ thể theo ID (kèm thông tin DocType và các dòng chi tiết Items)
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
};