// Hàm thuần cho upload minh chứng người phụ thuộc (không import react-native để test được bằng jest).

export const DOC_TYPE_OPTIONS = [
  { value: 'BIRTH_CERTIFICATE', label: 'Giấy khai sinh (Bản sao)' },
  { value: 'CITIZEN_CARD', label: 'Thẻ Căn cước / CCCD' },
  { value: 'CITIZEN_ID', label: 'Căn cước công dân (Bản sao)' },
  { value: 'STUDENT_DOCUMENT', label: 'Thẻ sinh viên / Giấy xác nhận trường' },
  { value: 'STUDENT_CARD', label: 'Thẻ HSSV / Giấy xác nhận trường' },
  { value: 'DISABILITY_OR_INCAPACITY_CERT', label: 'Giấy xác nhận khuyết tật / mất NLHV dân sự' },
  { value: 'DISABILITY_CERTIFICATE', label: 'Giấy xác nhận khuyết tật' },
  { value: 'MARRIAGE_CERTIFICATE', label: 'Giấy chứng nhận kết hôn' },
  { value: 'LABOR_INCAPACITY_DOC', label: 'Giấy tờ chứng minh suy giảm khả năng LĐ (≥81%)' },
  { value: 'TAXPAYER_BIRTH_CERT', label: 'Giấy khai sinh của NNT (chứng minh quan hệ)' },
  { value: 'SPOUSE_BIRTH_CERT', label: 'Giấy khai sinh của vợ/chồng (chứng minh quan hệ)' },
  { value: 'RELATIONSHIP_CERTIFICATE', label: 'Giấy tờ chứng minh quan hệ (Hộ khẩu)' },
  { value: 'SUPPORT_COMMITMENT_FORM', label: 'Bản cam kết nuôi dưỡng trực tiếp' },
  { value: 'OTHER', label: 'Giấy tờ minh chứng hợp pháp khác' },
];

export const UNKNOWN_DOC_TYPE_LABEL = 'Giấy tờ minh chứng khác';

export const RULES_NOT_CONFIGURED_LABEL =
  'Nhóm này chưa được cấu hình danh mục giấy tờ, vui lòng liên hệ hỗ trợ';

// Tên giấy tờ lấy từ rule trong DB (docName do admin nhập) — ưu tiên hơn nhãn dựng sẵn trong app
const dbDocNames = new Map<string, string>();

export const registerDocNames = (rules: { docType?: string; docName?: string | null }[]): void => {
  for (const r of rules) {
    const name = r.docName?.trim();
    if (r.docType && name) dbDocNames.set(r.docType.toUpperCase(), name);
  }
};

export const clearDocNames = (): void => dbDocNames.clear();

export const getDocTypeLabel = (docType?: string | null, docName?: string | null): string => {
  if (docName?.trim()) return docName.trim();
  if (!docType) return UNKNOWN_DOC_TYPE_LABEL;
  const code = docType.toUpperCase();
  // BE trả mã này trong missingDocuments khi nhóm chưa có rule giấy tờ
  if (code === 'RULES_NOT_CONFIGURED') return RULES_NOT_CONFIGURED_LABEL;
  const fromDb = dbDocNames.get(code);
  if (fromDb) return fromDb;
  const found = DOC_TYPE_OPTIONS.find((opt) => opt.value === code);
  // Mã mới chưa có tên: không hiện mã thô lên UI
  return found ? found.label : UNKNOWN_DOC_TYPE_LABEL;
};

// BE trả "Dữ liệu đầu vào không hợp lệ." kèm lý do cụ thể trong errors — ưu tiên lý do cụ thể
export const extractUploadErrorMessage = (data: any, fallback: string): string => {
  const errors = data?.errors;
  if (errors && typeof errors === 'object' && !Array.isArray(errors)) {
    for (const [key, value] of Object.entries(errors)) {
      if (key === 'errorCode') continue;
      const first = Array.isArray(value) ? value.find((v) => typeof v === 'string' && v.trim()) : value;
      if (typeof first === 'string' && first.trim()) return first.trim();
    }
  }
  if (Array.isArray(errors)) {
    const first = errors.find((v) => typeof v === 'string' && v.trim());
    if (first) return first.trim();
  }
  if (typeof data?.message === 'string' && data.message.trim()) return data.message.trim();
  return fallback;
};

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'application/pdf': 'pdf',
};

const extOf = (s?: string | null): string | undefined => {
  const m = (s || '').split('?')[0].match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : undefined;
};

// Tên file gửi lên phải có đuôi khớp file thật: iOS hay trả fileName "IMG_1.HEIC" trong khi file đã là JPEG
export const resolveUploadFileName = (name: string | undefined, uri?: string, mimeType?: string): string => {
  const realExt = extOf(uri) || (mimeType ? MIME_EXT[mimeType.toLowerCase()] : undefined);
  const base = (name || 'minh_chung').replace(/\.[a-z0-9]+$/i, '');
  if (!realExt) return name || base;
  return extOf(name) === realExt ? (name as string) : `${base}.${realExt}`;
};
