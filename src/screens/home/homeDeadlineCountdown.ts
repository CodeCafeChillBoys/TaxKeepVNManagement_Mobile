import type { TaxDeadlineCountdown } from '../../types/taxSettlement';

export type DeadlineTone = 'normal' | 'warning' | 'danger';

/** Số lớn + dòng phụ + mức màu cho khối đếm ngược hạn nộp quyết toán trên Home. */
export function deadlineDisplay(c: TaxDeadlineCountdown): {
  headline: string;
  meta: string;
  tone: DeadlineTone;
} {
  const meta = `Hạn nộp quyết toán năm ${c.taxYear}: ${c.deadlineFormatted}`;
  if (c.daysRemaining <= 0) return { headline: 'Hôm nay là hạn chót', meta, tone: 'danger' };
  const tone: DeadlineTone =
    c.urgencyLevel === 'CRITICAL' ? 'danger' : c.urgencyLevel === 'WARNING' ? 'warning' : 'normal';
  return { headline: `Còn ${c.daysRemaining} ngày`, meta, tone };
}
