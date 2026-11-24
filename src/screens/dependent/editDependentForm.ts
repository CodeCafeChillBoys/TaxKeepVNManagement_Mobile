import { parseBirthDateParts } from './applyTaxRegistrationOcrFill';
import { groupsForRelationship } from './dependentGroupUtils';
import { ageAtEffectiveFrom, isAge14OrOlderAtEffective } from './dependentEligibility';
import { isBeforeBirthMonth } from './editEffectivePeriod';

export type EditDependentFormState = {
  fullName: string;
  relationship: string;
  currentGroup: string;
  birthDay: string;
  birthMonth: string;
  birthYear: string;
  citizenId: string;
  birthCertNumber: string;
  taxIdNumber: string;
  effectiveFromMonth: string;
  effectiveToMonth: string;
  note: string;
};

export type UpdateDependentPayload = {
  fullName: string;
  birthDate: string;
  citizenId?: string;
  birthCertNumber?: string;
  taxIdNumber?: string;
  effectiveFromMonth: string;
  effectiveToMonth: string;
  note?: string;
  confirmIdentityChange?: boolean;
};

/** Có đổi họ tên / ngày sinh / số giấy tờ (trim, tên không phân biệt hoa thường). */
export function hasIdentityFieldChange(
  current: EditDependentFormState,
  baseline: EditDependentFormState | null
): boolean {
  if (!baseline) return false;
  const nameChanged =
    current.fullName.trim().toLowerCase() !== baseline.fullName.trim().toLowerCase();
  const birthChanged =
    `${current.birthYear}-${current.birthMonth}-${current.birthDay}` !==
    `${baseline.birthYear}-${baseline.birthMonth}-${baseline.birthDay}`;
  const citizenChanged = current.citizenId.trim() !== baseline.citizenId.trim();
  const certChanged = current.birthCertNumber.trim() !== baseline.birthCertNumber.trim();
  return nameChanged || birthChanged || citizenChanged || certChanged;
}

/** Hồ sơ ACTIVE đổi nhân thân thì phải hỏi xác nhận trước khi gửi. */
export function needsIdentityChangeConfirm(
  status: string | null | undefined,
  identityChanged: boolean
): boolean {
  return identityChanged && String(status || '').toUpperCase() === 'ACTIVE';
}

export function splitEffectiveMonth(raw?: string | null): { year: string; month: string } {
  const m = /^(\d{4})-(\d{2})$/.exec(String(raw || '').trim());
  if (!m) {
    const now = new Date();
    return {
      year: String(now.getFullYear()),
      month: String(now.getMonth() + 1).padStart(2, '0'),
    };
  }
  return { year: m[1], month: m[2] };
}

/** Map chi tiết API → state form sửa hồ sơ NPT. */
export function dependentDetailToFormState(detail: any): EditDependentFormState {
  const birth =
    parseBirthDateParts(String(detail?.birthDate || '')) || {
      birthDay: '01',
      birthMonth: '01',
      birthYear: String(new Date().getFullYear() - 10),
    };
  const relationship = String(detail?.relationship || 'CHILD').toUpperCase();
  const groups = groupsForRelationship(relationship);
  let currentGroup = String(detail?.currentGroup || '').toUpperCase();
  if (!currentGroup || !groups.includes(currentGroup)) {
    currentGroup = groups[0] || '';
  }
  return {
    fullName: String(detail?.fullName || ''),
    relationship,
    currentGroup,
    birthDay: birth.birthDay,
    birthMonth: birth.birthMonth,
    birthYear: birth.birthYear,
    citizenId: String(detail?.citizenId || ''),
    birthCertNumber: String(detail?.birthCertNumber || ''),
    taxIdNumber: String(detail?.taxIdNumber || ''),
    effectiveFromMonth: String(detail?.effectiveFromMonth || '').trim() || `${new Date().getFullYear()}-01`,
    effectiveToMonth: String(detail?.effectiveToMonth || '').trim() || `${new Date().getFullYear()}-12`,
    note: String(detail?.note || ''),
  };
}

export function isEditDependentFormDirty(
  current: EditDependentFormState,
  baseline: EditDependentFormState | null
): boolean {
  if (!baseline) return false;
  return (
    current.fullName.trim() !== baseline.fullName.trim() ||
    current.relationship !== baseline.relationship ||
    current.currentGroup !== baseline.currentGroup ||
    current.birthDay !== baseline.birthDay ||
    current.birthMonth !== baseline.birthMonth ||
    current.birthYear !== baseline.birthYear ||
    current.citizenId.trim() !== baseline.citizenId.trim() ||
    current.birthCertNumber.trim() !== baseline.birthCertNumber.trim() ||
    current.taxIdNumber.trim() !== baseline.taxIdNumber.trim() ||
    current.effectiveFromMonth !== baseline.effectiveFromMonth ||
    current.effectiveToMonth !== baseline.effectiveToMonth ||
    current.note.trim() !== baseline.note.trim()
  );
}

/** Số ngày của tháng. Tháng 2 năm nhuận có 29 ngày. */
export function daysInMonth(year: number, month: number): number {
  if (!year || month < 1 || month > 12) return 31;
  return new Date(year, month, 0).getDate();
}

export function isValidCalendarDate(year: string, month: string, day: string): boolean {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!y || m < 1 || m > 12 || d < 1) return false;
  return d <= daysInMonth(y, m);
}

/** Nếu ngày không tồn tại trong tháng (vd 31/02) thì hạ về ngày cuối tháng. */
export function clampBirthDay(day: string, month: string, year: string): string {
  const max = daysInMonth(Number(year), Number(month));
  const d = Number(day);
  if (!d || d < 1) return '01';
  return String(Math.min(d, max)).padStart(2, '0');
}

export type BuildUpdateResult =
  | { ok: true; payload: UpdateDependentPayload }
  | { ok: false; message: string };

/** Validate + dựng body PUT /dependents/{id}. */
export function buildUpdateDependentPayload(state: EditDependentFormState): BuildUpdateResult {
  const fullName = state.fullName.trim();
  if (!fullName) return { ok: false, message: 'Vui lòng nhập họ và tên người phụ thuộc.' };

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(state.effectiveFromMonth)) {
    return { ok: false, message: 'Tháng bắt đầu không đúng định dạng YYYY-MM.' };
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(state.effectiveToMonth)) {
    return { ok: false, message: 'Tháng kết thúc không đúng định dạng YYYY-MM.' };
  }
  if (state.effectiveFromMonth > state.effectiveToMonth) {
    return { ok: false, message: 'Tháng bắt đầu phải nhỏ hơn hoặc bằng tháng kết thúc.' };
  }
  if (!isValidCalendarDate(state.birthYear, state.birthMonth, state.birthDay)) {
    return { ok: false, message: 'Ngày sinh không tồn tại. Vui lòng chọn lại.' };
  }
  const birthIso = `${state.birthYear}-${state.birthMonth}-${state.birthDay}`;
  if (isBeforeBirthMonth(state.effectiveFromMonth, birthIso)) {
    return {
      ok: false,
      message: `Tháng bắt đầu không được trước tháng sinh (${state.birthMonth}/${state.birthYear}).`,
    };
  }

  const age = ageAtEffectiveFrom(
    state.birthDay,
    state.birthMonth,
    state.birthYear,
    state.effectiveFromMonth
  );
  const needCitizenId = isAge14OrOlderAtEffective(age);
  const citizenId = state.citizenId.trim();
  const birthCertNumber = state.birthCertNumber.trim();

  if (needCitizenId) {
    if (!/^\d{12}$/.test(citizenId)) {
      return { ok: false, message: 'Số CCCD phải đúng 12 chữ số.' };
    }
  } else if (!birthCertNumber) {
    return { ok: false, message: 'Vui lòng nhập số giấy khai sinh.' };
  }

  const taxIdNumber = state.taxIdNumber.trim();
  if (taxIdNumber && !/^\d{10}$|^\d{12}$/.test(taxIdNumber)) {
    return { ok: false, message: 'Mã số thuế chỉ được 10 hoặc 12 chữ số.' };
  }

  const birthDate = `${state.birthYear}-${state.birthMonth}-${state.birthDay}T00:00:00Z`;

  return {
    ok: true,
    payload: {
      fullName,
      birthDate,
      citizenId: needCitizenId ? citizenId : undefined,
      birthCertNumber: needCitizenId ? undefined : birthCertNumber,
      taxIdNumber: taxIdNumber || undefined,
      effectiveFromMonth: state.effectiveFromMonth,
      effectiveToMonth: state.effectiveToMonth,
      note: state.note.trim() || undefined,
    },
  };
}
