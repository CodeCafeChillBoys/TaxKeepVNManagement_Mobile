import { toIsoDate } from '../common/ocrUtils';

/**
 * Partial update body cho PUT /api/v1/dependents/{id} khi chỉ đổi thời gian hiệu lực.
 * Khớp UpdateDependentRequest (BE): tất cả trường khác để null để BE tự giữ nguyên dữ liệu DB
 * và không kích hoạt logic đổi thông tin nhân thân (isIdentityChanged = false).
 */
export type EffectivePeriodUpdatePayload = {
  effectiveFromMonth: string;
  effectiveToMonth: string;
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

/**
 * Dựng body PUT chỉ đổi kỳ hiệu lực (partial update khớp BE).
 * Không gửi thông tin nhân thân / quan hệ / nhóm.
 */
export function buildEffectivePeriodUpdatePayload(
  detail: any,
  effectiveFromMonth: string,
  effectiveToMonth: string
): BuildPeriodUpdateResult {
  if (String(detail?.status || '').trim().toUpperCase() === 'INACTIVE') {
    return {
      ok: false,
      message: 'Hồ sơ người phụ thuộc đã ngừng hiệu lực, không thể chỉnh sửa thời gian hiệu lực.',
    };
  }

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

  return {
    ok: true,
    payload: {
      effectiveFromMonth: from,
      effectiveToMonth: to,
    },
  };
}
