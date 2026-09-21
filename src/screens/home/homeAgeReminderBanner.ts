import type { AgeReminderItemDto, DependentItem } from '../../api/dependentDocumentApi';
import { groupCodeToIndex } from '../dependent/dependentGroupUtils';

const STUDYING_GROUPS = new Set(['CHILD_OVER_18_STUDYING', 'CHILD_STUDYING']);

function daysUntilTurning18(birthDateIso: string, now: Date): number | null {
  const iso = (birthDateIso || '').slice(0, 10);
  const parts = iso.split('-');
  if (parts.length !== 3) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  if (!y || !m || !d) return null;
  const turning18 = new Date(y + 18, m - 1, d);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((turning18.getTime() - now.getTime()) / msPerDay);
}

/**
 * NPT đã chuyển Nhóm 2 nhưng chưa upload minh chứng → vẫn hiện banner
 * đến khi isProfileComplete = true.
 */
export function buildPendingUploadAgeReminders(
  dependents: DependentItem[],
  options?: { now?: Date }
): AgeReminderItemDto[] {
  const now = options?.now ?? new Date();

  return dependents
    .filter(
      (dep) =>
        !dep.isProfileComplete && STUDYING_GROUPS.has((dep.currentGroup || '').toUpperCase())
    )
    .map((dep) => {
      const daysRemaining = daysUntilTurning18(dep.birthDate, now) ?? -1;
      const turning18Date = (() => {
        const iso = (dep.birthDate || '').slice(0, 10);
        const [y, m, d] = iso.split('-').map((x) => parseInt(x, 10));
        if (!y || !m || !d) return '';
        return `${y + 18}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      })();

      const status = daysRemaining >= 0 ? 'TURNING_18_SOON' : 'ALREADY_18_PENDING_ACTION';
      const message =
        daysRemaining >= 0
          ? `Người phụ thuộc ${dep.fullName} sẽ tròn 18 tuổi vào ngày ${turning18Date.split('-').reverse().join('/') || '—'}. Vui lòng bổ sung giấy tờ sinh viên để hoàn tất chuyển nhóm.`
          : `Người phụ thuộc ${dep.fullName} đã chuyển sang nhóm đang học. Vui lòng bổ sung giấy tờ sinh viên để hoàn tất hồ sơ.`;

      return {
        dependentId: dep.id,
        fullName: dep.fullName,
        birthDate: (dep.birthDate || '').slice(0, 10),
        currentGroup: dep.currentGroup,
        recommendedGroup: 'CHILD_OVER_18_STUDYING',
        transitionStatus: status,
        turning18Date,
        daysRemaining,
        message,
        requiredAction: 'UPLOAD_STUDENT_CARD',
      } satisfies AgeReminderItemDto;
    });
}

/** Gộp reminder API (chưa đổi nhóm) + NPT đã đổi nhóm nhưng chưa upload. */
export function mergeAgeTransitionReminders(
  apiReminders: AgeReminderItemDto[],
  pendingUploadReminders: AgeReminderItemDto[]
): AgeReminderItemDto[] {
  const byId = new Map<string, AgeReminderItemDto>();
  for (const item of apiReminders) {
    byId.set(item.dependentId, item);
  }
  for (const item of pendingUploadReminders) {
    const existing = byId.get(item.dependentId);
    // Pending upload thắng: đã PATCH, CTA chỉ cần upload.
    byId.set(item.dependentId, existing ? { ...existing, ...item } : item);
  }
  return Array.from(byId.values()).sort((a, b) => a.daysRemaining - b.daysRemaining);
}

export function isReminderAwaitingUploadOnly(item: AgeReminderItemDto): boolean {
  return (
    item.requiredAction === 'UPLOAD_STUDENT_CARD' ||
    STUDYING_GROUPS.has((item.currentGroup || '').toUpperCase())
  );
}

export function proofNavFromAgeReminder(item: AgeReminderItemDto): {
  screen: 'ProofDocuments';
  params: { dependentId: string; groupIndex: number; requiredDocuments: string[] };
} {
  return {
    screen: 'ProofDocuments',
    params: {
      dependentId: item.dependentId,
      groupIndex: groupCodeToIndex(item.recommendedGroup || item.currentGroup),
      requiredDocuments: ['STUDENT_CARD'],
    },
  };
}
