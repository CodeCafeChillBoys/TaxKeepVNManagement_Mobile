import { deadlineDisplay } from './homeDeadlineCountdown';
import type { TaxDeadlineCountdown } from '../../types/taxSettlement';

const c = (daysRemaining: number, urgencyLevel: TaxDeadlineCountdown['urgencyLevel']): TaxDeadlineCountdown => ({
  taxYear: 2025,
  deadlineDate: '2026-04-30',
  deadlineFormatted: '30/04/2026',
  daysRemaining,
  reminderMessage: '',
  urgencyLevel,
  isOverdue: false,
  reminderMilestones: [60, 30, 15, 7, 3, 1],
});

describe('deadlineDisplay', () => {
  it('còn nhiều ngày: hiện số ngày, tone normal, dòng phụ có hạn nộp', () => {
    expect(deadlineDisplay(c(120, 'NORMAL'))).toEqual({
      headline: 'Còn 120 ngày',
      meta: 'Hạn nộp quyết toán năm 2025: 30/04/2026',
      tone: 'normal',
    });
  });

  it('WARNING → warning, CRITICAL → danger', () => {
    expect(deadlineDisplay(c(20, 'WARNING')).tone).toBe('warning');
    expect(deadlineDisplay(c(5, 'CRITICAL')).tone).toBe('danger');
  });

  it('đúng ngày hạn: "Hôm nay là hạn chót", màu đỏ', () => {
    expect(deadlineDisplay(c(0, 'CRITICAL'))).toMatchObject({ headline: 'Hôm nay là hạn chót', tone: 'danger' });
  });
});
