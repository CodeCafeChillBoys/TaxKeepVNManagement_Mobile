export interface InvoiceLineItem {
  id?: number | string;
  itemOrder: number;
  itemName: string;
  unit?: string | null;
  quantity?: number | null;
  unitPrice?: number | null;
  totalPrice?: number | null;
}

export interface BoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ExtractedFieldItem {
  fieldName: string;
  fieldLabel?: string;
  extractedValue: string;
  confidenceScore: number;
  boundingBox?: BoundingBox | null;
  isCrucial?: boolean;
}

export type OpticalQualityIssueCode =
  | 'IMAGE_BLURRY'
  | 'EXCESSIVE_GLARE'
  | 'CROPPED_EDGES'
  | 'LOW_RESOLUTION'
  | 'POOR_LIGHTING';

export interface OpticalQualityEvaluation {
  qualityScore: number;
  requiredThreshold: number;
  qualityIssues: OpticalQualityIssueCode[];
  isPassedQuality: boolean;
}

export type ValidationErrorCode =
  | 'ERR_DOCUMENT_NOT_FOUND'
  | 'ERR_INVALID_STATUS'
  | 'ERR_CORRUPTED_FILE'
  | 'ERR_UNREADABLE_IMAGE'
  | 'ERR_UNAUTHORIZED'
  | 'ERR_YEAR_MISMATCH'
  | 'ERR_INVALID_DOC_TYPE'
  | 'ERR_IDENTITY_MISMATCH'
  | 'ERR_TAX_PERIOD_LOCKED'
  | 'ERR_IMAGE_QUALITY_TOO_LOW'
  | 'ERR_NOT_TAX_DOCUMENT'
  | 'ERR_DUPLICATE_DOCUMENT'
  | 'ERR_FUTURE_DATE'
  | 'ERR_DUPLICATE_FILE_HASH';

export interface ValidationErrorItem {
  code: ValidationErrorCode | string;
  field?: string;
  message: string;
  severity?: 'error' | 'warning';
}

export interface ValidationStatus {
  isYearValid?: boolean;
  isDocTypeValid?: boolean;
  isIdentityValid?: boolean;
  isPassedThreshold?: boolean;
  hasCrucialLowConfidence?: boolean;
}

export interface ExpenseOcrResult {
  id?: string;
  documentId?: string;
  periodId?: string;
  userId?: string;
  docTypeCode?: string | null;
  docTypeName?: string | null;
  fileUrl?: string;
  originalFilename?: string;
  
  // Bên bán (Bệnh viện / Cơ sở đào tạo / Nhà cung cấp)
  sellerName?: string | null;
  sellerTaxCode?: string | null;
  sellerAddress?: string | null;
  sellerPhone?: string | null;
  
  // Thông tin hóa đơn & tra cứu
  invoiceSeries?: string | null;
  invoiceNumber?: string | null;
  invoiceDate?: string | null; // YYYY-MM-DD
  extractedYear?: number | null;
  lookupUrl?: string | null;
  lookupCode?: string | null;
  
  // Bên mua (Người nộp thuế / Thân nhân / Học sinh)
  buyerName?: string | null;
  buyerTaxCode?: string | null;
  buyerIdCard?: string | null;
  buyerAddress?: string | null;
  paymentMethod?: string | null;
  
  // Tài chính
  totalAmount?: number | null;
  totalAmountInWords?: string | null;
  
  // Danh sách dòng mặt hàng / viện phí
  items?: InvoiceLineItem[];
  
  // Đánh giá OCR AI & Thẩm định ngưỡng 3 tầng
  overallConfidence?: number;
  appliedThreshold?: number;
  isPassedThreshold?: boolean;
  hasCrucialLowConfidence?: boolean;
  fields?: ExtractedFieldItem[];
  qualityEvaluation?: OpticalQualityEvaluation;
  
  // Đối soát ma trận lỗi
  validationStatus?: ValidationStatus;
  validationErrors?: ValidationErrorItem[];
  
  // Cam kết thuế TNCN: Chưa được bồi hoàn từ bảo hiểm hoặc tài trợ khác
  isNotReimbursed?: boolean | null;

  status: 'UPLOADED' | 'EXTRACTED' | 'CONFIRMED' | 'FAILED' | 'REJECTED';
  createdAt?: string;
}

export interface TaxPeriodItem {
  periodId: string;
  taxYear: number;
  status: 'DRAFT' | 'SUBMITTED' | 'CLOSED' | string;
  createdAt: string;
}

export interface TaxDocumentTypeItem {
  code: string;
  name: string;
  description?: string;
  isTaxEligible: boolean;
  categoryGroup?: string;
}

export interface BatchUploadResponse {
  periodId: string;
  totalUploaded: number;
  documents: Array<{
    id: string;
    userId: string;
    periodId: string;
    docTypeCode?: string | null;
    originalFilename?: string;
    fileUrl: string;
    status: string;
    createdAt: string;
  }>;
}

export interface ConfirmDocumentReviewRequest {
  docTypeCode?: string | null;
  invoiceSeries?: string | null;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  sellerName?: string | null;
  sellerTaxCode?: string | null;
  sellerAddress?: string | null;
  sellerPhone?: string | null;
  buyerName?: string | null;
  buyerTaxCode?: string | null;
  buyerIdCard?: string | null;
  buyerAddress?: string | null;
  paymentMethod?: string | null;
  totalAmount?: number | null;
  totalAmountInWords?: string | null;
  lookupUrl?: string | null;
  lookupCode?: string | null;
  extractedYear?: number | null;
  isYearValid?: boolean;
  isIdentityValid?: boolean;
  isNotReimbursed?: boolean | null;
  items?: InvoiceLineItem[];
}

export interface DocumentQueryParameters {
  page?: number;
  size?: number;
  search?: string;
  sort?: string;
  status?: 'UPLOADED' | 'EXTRACTED' | 'CONFIRMED' | 'FAILED' | string;
  docTypeCode?: 'SALES_INVOICE' | 'VAT_INVOICE' | 'WITHHOLDING_VOUCHER' | string;
}

export interface DocumentItemResponse {
  id: number;
  itemOrder: number;
  itemName: string;
  unit?: string | null;
  quantity?: number | null;
  unitPrice?: number | null;
  totalPrice?: number | null;
}

export interface DocumentReviewResponse {
  id: string;
  periodId: string;
  docTypeCode?: string | null;
  docTypeName?: string | null;
  isTaxEligible?: boolean | null;
  fileUrl: string;
  originalFilename?: string | null;
  invoiceSeries?: string | null;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  sellerName?: string | null;
  sellerTaxCode?: string | null;
  sellerAddress?: string | null;
  sellerPhone?: string | null;
  buyerName?: string | null;
  buyerTaxCode?: string | null;
  buyerIdCard?: string | null;
  buyerAddress?: string | null;
  paymentMethod?: string | null;
  totalAmount?: number | null;
  totalAmountInWords?: string | null;
  lookupUrl?: string | null;
  lookupCode?: string | null;
  extractedYear?: number | null;
  isYearValid?: boolean | null;
  isIdentityValid?: boolean | null;
  isNotReimbursed?: boolean | null;
  status: 'UPLOADED' | 'EXTRACTED' | 'CONFIRMED' | 'FAILED' | string;
  createdAt: string;
  items: DocumentItemResponse[];
}

export interface PagedResult<T> {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}
