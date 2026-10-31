export type OcrFieldKey =
  | 'fullName'
  | 'citizenId'
  | 'dateOfBirth'
  | 'address'
  | 'gender'
  | 'issueDate';

export type OcrFieldStatus = 'confident' | 'check' | 'unreadable';

export const SCAN_IDENTITY_SOURCES = ['register', 'editProfile', 'dependent'] as const;

export type ScanIdentitySource = (typeof SCAN_IDENTITY_SOURCES)[number];

export function isScanIdentitySource(value: string): value is ScanIdentitySource {
  return (SCAN_IDENTITY_SOURCES as readonly string[]).includes(value);
}

export interface OcrExtractedFields {
  fullName: string;
  citizenId: string;
  dateOfBirth: string;
  address: string;
  gender: string;
  issueDate: string;
  /** Số GKS / giấy tờ khác — dùng review NPT */
  documentNumber?: string;
  suggestedGroup?: string;
  isAvailable?: boolean;
  warning?: string | null;
}

/** Điền Register / EditProfile sau “Dùng thông tin này” */
export interface OcrFormFill {
  fullName: string;
  citizenId: string;
  dateOfBirth: string;
  address: string;
  isAvailable?: boolean;
  warning?: string | null;
}

/** Điền TaxRegistration sau quét NPT */
export interface OcrDependentFill {
  fullName: string;
  birthDate: string;
  citizenId?: string;
  birthCertNumber?: string;
  suggestedGroup?: string;
  relationship?: string;
  selectedGroupIdx?: number;
}

export const OCR_FIELD_META: {
  key: OcrFieldKey;
  label: string;
  usedInRegister: boolean;
  required: boolean;
  placeholder: string;
}[] = [
  {
    key: 'fullName',
    label: 'Họ và tên',
    usedInRegister: true,
    required: true,
    placeholder: 'Nhập họ và tên trên căn cước',
  },
  {
    key: 'citizenId',
    label: 'Số căn cước công dân',
    usedInRegister: true,
    required: true,
    placeholder: 'Nhập 12 chữ số',
  },
  {
    key: 'dateOfBirth',
    label: 'Ngày sinh',
    usedInRegister: true,
    required: true,
    placeholder: 'dd/MM/yyyy',
  },
  {
    key: 'address',
    label: 'Địa chỉ thường trú',
    usedInRegister: true,
    required: false,
    placeholder: 'Nhập địa chỉ trên căn cước',
  },
  {
    key: 'gender',
    label: 'Giới tính',
    usedInRegister: false,
    required: false,
    placeholder: 'Nam / Nữ',
  },
  {
    key: 'issueDate',
    label: 'Ngày cấp',
    usedInRegister: false,
    required: false,
    placeholder: 'dd/MM/yyyy',
  },
];
