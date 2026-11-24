export interface DependentStatusMeta {
  label: string;
  tone: 'success' | 'warning' | 'neutral';
  description: string;
}

export function getDependentStatusMeta(
  status?: string | null,
  isProfileComplete?: boolean
): DependentStatusMeta {
  const normalized = (status || '').trim().toUpperCase();
  if (normalized === 'INACTIVE') {
    return {
      label: 'Ngừng hiệu lực',
      tone: 'neutral',
      description: 'Hồ sơ người phụ thuộc đã được vô hiệu hóa và ngừng tính giảm trừ gia cảnh.',
    };
  }
  if (isProfileComplete || normalized === 'ACTIVE') {
    return {
      label: 'Đủ hồ sơ',
      tone: 'success',
      description: 'Hồ sơ đã đầy đủ giấy tờ minh chứng và đủ điều kiện tính giảm trừ gia cảnh.',
    };
  }
  return {
    label: 'Chờ bổ sung minh chứng',
    tone: 'warning',
    description: 'Vui lòng tải lên đầy đủ giấy tờ minh chứng bắt buộc để hoàn tất hồ sơ.',
  };
}

export function formatDependentDate(isoStr?: string | null): string {
  if (!isoStr) return 'Chưa cập nhật';
  const raw = String(isoStr).split('T')[0];
  const parts = raw.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return raw || 'Chưa cập nhật';
}

export function formatDependentMonth(monthStr?: string | null): string {
  if (!monthStr) return 'Chưa cập nhật';
  const match = /^(\d{4})-(\d{2})/.exec(String(monthStr).trim());
  if (!match) return String(monthStr);
  return `${match[2]}/${match[1]}`;
}

export function formatDependentMonthRange(
  fromMonth?: string | null,
  toMonth?: string | null
): string {
  if (!fromMonth && !toMonth) return 'Chưa cập nhật';
  const fromText = fromMonth ? formatDependentMonth(fromMonth) : '—';
  const toText = toMonth ? formatDependentMonth(toMonth) : '—';
  return `${fromText} → ${toText}`;
}

export function normalizeDependentNote(raw?: string | null): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, 500);
}

export function calculateDependentAge(birthDateStr?: string | null, now: Date = new Date()): number {
  if (!birthDateStr) return 0;
  const raw = String(birthDateStr).split('T')[0];
  const parts = raw.split('-');
  if (parts.length !== 3) return 0;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return 0;

  let age = now.getFullYear() - year;
  const monthDiff = now.getMonth() + 1 - month;
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < day)) {
    age -= 1;
  }
  return Math.max(0, age);
}
