import type { OcrDependentFill, ScanIdentitySource } from '../../types/ocr';
import { toIsoDate } from '../common/ocrUtils';

export type TaxRegistrationOcrPatch = {
  fullName: string;
  birthDay?: string;
  birthMonth?: string;
  birthYear?: string;
  citizenId?: string;
  birthCertNumber?: string;
  selectedGroupIdx?: number;
  relationship?: string;
};

export type TaxRegistrationOcrApplyPlan = {
  patch: TaxRegistrationOcrPatch;
  alertTitle: string;
  alertMessage: string;
};

export type DependentScanParams = {
  source: Extract<ScanIdentitySource, 'dependent'>;
  hasExistingData: boolean;
};

export function parseBirthDateParts(
  raw: string
): { birthDay: string; birthMonth: string; birthYear: string } | null {
  const iso = toIsoDate(raw.trim());
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return {
    birthYear: match[1],
    birthMonth: match[2],
    birthDay: match[3],
  };
}

/** Kế hoạch điền form NPT từ ocrDependentFill — không đụng tháng hiệu lực. */
export function applyTaxRegistrationOcrFill(
  fill: OcrDependentFill
): TaxRegistrationOcrApplyPlan {
  const parts = parseBirthDateParts(fill.birthDate);
  const patch: TaxRegistrationOcrPatch = {
    fullName: fill.fullName,
  };

  if (parts) {
    patch.birthDay = parts.birthDay;
    patch.birthMonth = parts.birthMonth;
    patch.birthYear = parts.birthYear;
  }

  if (fill.citizenId?.trim()) {
    patch.citizenId = fill.citizenId.trim();
  }
  if (fill.birthCertNumber?.trim()) {
    patch.birthCertNumber = fill.birthCertNumber.trim();
  }

  if (typeof fill.selectedGroupIdx === 'number') {
    patch.selectedGroupIdx = fill.selectedGroupIdx;
  }
  if (fill.relationship?.trim()) {
    patch.relationship = fill.relationship.trim();
  }

  return {
    patch,
    alertTitle: 'Đã điền thông tin từ giấy tờ',
    alertMessage: 'Đã điền thông tin từ giấy tờ. Vui lòng kiểm tra trước khi tiếp tục.',
  };
}

export function buildDependentScanParams(hasExistingData: boolean): DependentScanParams {
  return {
    source: 'dependent',
    hasExistingData,
  };
}

export function isTaxRegistrationFormDirty(state: {
  fullName: string;
  citizenId: string;
  birthCertNumber: string;
}): boolean {
  return (
    state.fullName.trim().length > 0 ||
    state.citizenId.trim().length > 0 ||
    state.birthCertNumber.trim().length > 0
  );
}
