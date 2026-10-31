import type {
  ExtractedDependentDataDto,
  UserCccdOcrResponseDto,
} from '../../api/ocrApi';
import {
  OcrDependentFill,
  OcrExtractedFields,
  OcrFieldKey,
  OcrFormFill,
} from '../../types/ocr';

export const OCR_MAX_BYTES = 10 * 1024 * 1024;
export const OCR_MIN_PX = 600;

/** Dữ liệu mẫu — chỉ dùng test / demo; screen không import sau OCR-04. */
export const MOCK_OCR_EXTRACT: OcrExtractedFields = {
  fullName: 'NGUYỄN VĂN AN',
  citizenId: '079301001234',
  dateOfBirth: '12/05/1990',
  address: '123 Lê Lợi, Phường Bến Nghé, Quận 1',
  gender: 'Nam',
  issueDate: '',
};

export const MOCK_LOW_CONFIDENCE_FIELDS: OcrFieldKey[] = ['address'];

export function isAcceptedImage(fileName?: string | null, mimeType?: string | null): boolean {
  const mime = (mimeType || '').toLowerCase();
  if (mime === 'image/jpeg' || mime === 'image/jpg' || mime === 'image/png') return true;
  const name = (fileName || '').toLowerCase();
  return /\.(jpe?g|png)$/.test(name);
}

export function toTitleCaseVi(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function stripCitizenId(raw: string): string {
  return raw.replace(/[\s-]/g, '');
}

/** Hiển thị dd/MM/yyyy → form yyyy-MM-dd. Giữ nguyên nếu đã là ISO date. */
export function toIsoDate(raw: string): string {
  const value = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = value.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (!match) return value;
  const day = match[1].padStart(2, '0');
  const month = match[2].padStart(2, '0');
  return `${match[3]}-${month}-${day}`;
}

export function collapseSpaces(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

/** MALE/FEMALE/Nam/Nữ → Nam | Nữ | '' */
export function normalizeGender(raw?: string | null): string {
  if (!raw) return '';
  const value = raw.trim().toLowerCase();
  if (value === 'male' || value === 'nam') return 'Nam';
  if (value === 'female' || value === 'nữ' || value === 'nu') return 'Nữ';
  return '';
}

export type SuggestedGroupAlias = {
  selectedGroupIdx: number;
  relationship?: string;
};

/**
 * Alias suggestedGroup AI/BE → idx form TaxRegistration (PRD §8.4).
 *
 * | Input | Idx | relationship |
 * | CHILD_UNDER_18 | 0 | CHILD |
 * | CHILD_OVER_18_STUDYING \| CHILD_OVER_18_STUDENT | 1 | CHILD |
 * | DISABLED_DEPENDENT \| CHILD_OVER_18_DISABLED | 2 | CHILD |
 * | SPOUSE | 3 | SPOUSE |
 * | ELDERLY_PARENT \| PARENT_RETIRED | 3 | PARENT |
 * | SPOUSE_OR_PARENTS | 3 | (không set) |
 * | OTHER \| OTHER_DEPENDENT \| OTHER_HELPLESS | 4 | OTHER_DEPENDENT |
 */
export function aliasSuggestedGroup(
  code?: string | null
): SuggestedGroupAlias | null {
  if (!code || !code.trim()) return null;
  switch (code.trim()) {
    case 'CHILD_UNDER_18':
      return { selectedGroupIdx: 0, relationship: 'CHILD' };
    case 'CHILD_OVER_18_STUDYING':
    case 'CHILD_OVER_18_STUDENT':
      return { selectedGroupIdx: 1, relationship: 'CHILD' };
    case 'DISABLED_DEPENDENT':
    case 'CHILD_OVER_18_DISABLED':
      return { selectedGroupIdx: 2, relationship: 'CHILD' };
    case 'SPOUSE':
      return { selectedGroupIdx: 3, relationship: 'SPOUSE' };
    case 'ELDERLY_PARENT':
    case 'PARENT_RETIRED':
      return { selectedGroupIdx: 3, relationship: 'PARENT' };
    case 'SPOUSE_OR_PARENTS':
      return { selectedGroupIdx: 3 };
    case 'OTHER':
    case 'OTHER_DEPENDENT':
    case 'OTHER_HELPLESS':
      return { selectedGroupIdx: 4, relationship: 'OTHER_DEPENDENT' };
    default:
      return null;
  }
}

export function normalizeOcrForForm(fields: OcrExtractedFields): OcrFormFill {
  const fill: OcrFormFill = {
    fullName: toTitleCaseVi(fields.fullName),
    citizenId: stripCitizenId(fields.citizenId),
    dateOfBirth: toIsoDate(fields.dateOfBirth),
    address: collapseSpaces(fields.address),
  };
  if (fields.isAvailable !== undefined) fill.isAvailable = fields.isAvailable;
  if (fields.warning !== undefined) fill.warning = fields.warning;
  return fill;
}

export function mapUserCccdToFields(dto: UserCccdOcrResponseDto): {
  fields: OcrExtractedFields;
  fill: OcrFormFill;
} {
  const citizenId = stripCitizenId(dto.citizenId ?? '');
  const fields: OcrExtractedFields = {
    fullName: (dto.fullName ?? '').trim(),
    citizenId,
    dateOfBirth: (dto.dateOfBirth ?? '').trim(),
    address: collapseSpaces(dto.address ?? ''),
    gender: normalizeGender(dto.gender),
    issueDate: '',
    isAvailable: dto.isAvailable,
    warning: dto.warning ?? null,
  };
  return { fields, fill: normalizeOcrForForm(fields) };
}

export function mapExtractedDependentToFields(
  dto: ExtractedDependentDataDto
): OcrExtractedFields {
  const addressRaw = dto.residencePlace || dto.originPlace || '';
  return {
    fullName: (dto.fullName ?? '').trim(),
    citizenId: stripCitizenId(dto.citizenId ?? ''),
    dateOfBirth: (dto.birthDate ?? '').trim(),
    address: collapseSpaces(addressRaw),
    gender: normalizeGender(dto.gender),
    issueDate: (dto.issueDate ?? '').trim(),
    documentNumber: dto.documentNumber?.trim() || undefined,
    suggestedGroup: dto.suggestedGroup?.trim() || undefined,
  };
}

function calculateAgeYears(isoOrDisplayDate: string, asOf: Date): number | null {
  const iso = toIsoDate(isoOrDisplayDate);
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const birth = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  let age = asOf.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = asOf.getUTCMonth() - birth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && asOf.getUTCDate() < birth.getUTCDate())) {
    age -= 1;
  }
  return age;
}

/**
 * Map review fields → OcrDependentFill.
 * Tuổi ≥ 14 + CCCD 12 số → citizenId; ngược lại / thiếu CCCD → birthCertNumber từ documentNumber.
 */
export function mapToDependentFill(
  fields: OcrExtractedFields,
  suggestedGroup?: string | null,
  asOf: Date = new Date()
): OcrDependentFill {
  const birthDate = toIsoDate(fields.dateOfBirth);
  const citizenId = stripCitizenId(fields.citizenId);
  const age = calculateAgeYears(birthDate, asOf);
  const hasValidCccd = citizenId.length === 12;
  const useCitizenId = hasValidCccd && age !== null && age >= 14;

  const groupCode = suggestedGroup ?? fields.suggestedGroup;
  const alias = aliasSuggestedGroup(groupCode);

  const fill: OcrDependentFill = {
    fullName: toTitleCaseVi(fields.fullName),
    birthDate,
  };

  if (useCitizenId) {
    fill.citizenId = citizenId;
  } else if (fields.documentNumber?.trim()) {
    fill.birthCertNumber = fields.documentNumber.trim();
  }

  if (groupCode) fill.suggestedGroup = groupCode;
  if (alias) {
    fill.selectedGroupIdx = alias.selectedGroupIdx;
    if (alias.relationship) fill.relationship = alias.relationship;
  }

  return fill;
}
