/**
 * Pure helpers for SettlementHome (F3-FE-02) — testable without mounting screen.
 */
export function canSelectTaxYear(taxYear: number, nowYear: number = new Date().getFullYear()): boolean {
  return taxYear <= nowYear;
}

export type StartSettlementPlan =
  | { ok: true; taxYear: number }
  | { ok: false; message: string };

export function planStartSettlement(taxYear: number, nowYear?: number): StartSettlementPlan {
  if (!canSelectTaxYear(taxYear, nowYear)) {
    return { ok: false, message: 'Không được chọn năm tính thuế trong tương lai.' };
  }
  return { ok: true, taxYear };
}

const CONTINUABLE_STATUSES = new Set(['DRAFT', 'CALCULATED', 'CONFIRMED']);

export function buildTaxYearOptions(nowYear: number, count = 5): number[] {
  return Array.from({ length: count }, (_, i) => nowYear - i);
}

export function findContinuableDossier<
  T extends { id: string; taxYear: number; status: string; version: number }
>(dossiers: T[], taxYear: number): T | null {
  const candidates = dossiers
    .filter((d) => d.taxYear === taxYear && CONTINUABLE_STATUSES.has(d.status))
    .sort((a, b) => b.version - a.version);
  return candidates[0] ?? null;
}

export function mapSettlementCreateError(error: unknown): string {
  const data = (error as { response?: { data?: { errors?: { errorCode?: string }; message?: string } } })
    ?.response?.data;
  const code = data?.errors?.errorCode;
  if (code === 'E-NO_DATA' || code === 'E_NO_DATA') {
    return 'Năm này chưa có dữ liệu đơn vị chi trả hoặc người phụ thuộc.';
  }
  if (code === 'E-RULESET_NOT_FOUND' || code === 'INVALID_TAX_YEAR') {
    return data?.message?.trim() || 'Không thể tạo hồ sơ cho năm đã chọn.';
  }
  if (typeof data?.message === 'string' && data.message.trim()) return data.message.trim();
  return 'Không thể tạo hồ sơ quyết toán. Thử lại.';
}
