import { toIsoDate } from '../common/ocrUtils';
import {
  ageAtEffectiveFrom,
  isAge14OrOlderAtEffective,
} from './dependentEligibility';
import { parseBirthDateParts } from './applyTaxRegistrationOcrFill';

export type EffectivePeriodUpdatePayload = {
  fullName: string;
  relationship?: string;
  currentGroup?: string;
  birthDate: string;
  citizenId?: string;
  birthCertNumber?: string;
  taxIdNumber?: string;
  effectiveFromMonth: string;
  effectiveToMonth: string;
  note?: string;
};

export type BuildPeriodUpdateResult =
  | { ok: true; payload: EffectivePeriodUpdatePayload }
  | { ok: false; message: string };

/** "2026-01" → "T1/2026" */
export function formatPeriodShort(ym?: string | null): string {
  const raw = String(ym || '').trim();
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(raw);
  if (!m) return raw || '—';
  return `T${Number(m[2])}/${m[1]}`;
}

/** Dịch YYYY-MM thêm `delta` tháng. */
export function shiftYearMonth(ym: string, delta: number): string {
  const m = /^(\d{4})-(\d{2})$/.exec(String(ym || '').trim());
  if (!m) return ym;
  let year = Number(m[1]);
  let month = Number(m[2]) + delta;
  while (month > 12) {
    month -= 12;
    year += 1;
  }
  while (month < 1) {
    month += 12;
    year -= 1;
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** YYYY-MM của tháng sinh. Không đọc được ngày sinh thì null. */
export function birthMonthKey(birthDate?: string | null): string | null {
  const iso = toIsoDate(String(birthDate || '').trim());
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(iso);
  return m ? `${m[1]}-${m[2]}` : null;
}

/** true khi `ym` đứng trước tháng sinh. */
export function isBeforeBirthMonth(ym: string, birthDate?: string | null): boolean {
  const birth = birthMonthKey(birthDate);
  if (!birth || !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(ym || '').trim())) return false;
  return ym.trim() < birth;
}

/** Dựng body PUT chỉ đổi kỳ hiệu lực. Không gửi quan hệ / nhóm. */
export function buildEffectivePeriodUpdatePayload(
  detail: any,
  effectiveFromMonth: string,
  effectiveToMonth: string
): BuildPeriodUpdateResult {
  const from = String(effectiveFromMonth || '').trim();
  const to = String(effectiveToMonth || '').trim();

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(from)) {
    return { ok: false, message: 'Tháng bắt đầu không đúng định dạng YYYY-MM.' };
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(to)) {
    return { ok: false, message: 'Tháng kết thúc không đúng định dạng YYYY-MM.' };
  }
  if (from > to) {
    return { ok: false, message: 'Tháng bắt đầu phải nhỏ hơn hoặc bằng tháng kết thúc.' };
  }
  if (isBeforeBirthMonth(from, detail?.birthDate)) {
    const birth = birthMonthKey(detail?.birthDate);
    const label = birth ? `${birth.slice(5, 7)}/${birth.slice(0, 4)}` : '';
    return {
      ok: false,
      message: `Tháng bắt đầu không được trước tháng sinh (${label}).`,
    };
  }

  const fullName = String(detail?.fullName || '').trim();
  if (!fullName) {
    return { ok: false, message: 'Thiếu họ tên người phụ thuộc.' };
  }

  const birthIso = toIsoDate(String(detail?.birthDate || ''));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthIso)) {
    return { ok: false, message: 'Ngày sinh hồ sơ không hợp lệ, không thể cập nhật kỳ hiệu lực.' };
  }

  const parts = parseBirthDateParts(birthIso);
  const age = parts
    ? ageAtEffectiveFrom(parts.birthDay, parts.birthMonth, parts.birthYear, from)
    : 0;
  const needCitizenId = isAge14OrOlderAtEffective(age);
  const citizenId = String(detail?.citizenId || '').trim();
  const birthCertNumber = String(detail?.birthCertNumber || '').trim();

  if (needCitizenId) {
    if (!/^\d{12}$/.test(citizenId)) {
      return {
        ok: false,
        message: 'Hồ sơ ≥ 14 tuổi nhưng thiếu CCCD 12 số. Vui lòng bổ sung CCCD trước khi đổi kỳ hiệu lực.',
      };
    }
  } else if (!birthCertNumber && !citizenId) {
    return {
      ok: false,
      message: 'Hồ sơ thiếu số giấy khai sinh / định danh. Không thể cập nhật kỳ hiệu lực.',
    };
  }

  const taxIdNumber = String(detail?.taxIdNumber || '').trim();
  const note = String(detail?.note || '').trim();

  const payload: EffectivePeriodUpdatePayload = {
    fullName,
    birthDate: `${birthIso}T00:00:00Z`,
    taxIdNumber: taxIdNumber || undefined,
    effectiveFromMonth: from,
    effectiveToMonth: to,
    note: note || undefined,
  };

  if (needCitizenId) {
    payload.citizenId = citizenId;
  } else if (birthCertNumber) {
    payload.birthCertNumber = birthCertNumber;
  } else if (citizenId) {
    payload.citizenId = citizenId;
  }

  return { ok: true, payload };
}
