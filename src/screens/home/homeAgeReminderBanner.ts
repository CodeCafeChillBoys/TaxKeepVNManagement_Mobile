import type {
  AgeReminderItemDto,
  DependentCatalog,
  DependentItem,
} from '../../api/dependentDocumentApi';
import { findCatalogGroup, uiTabForGroup } from '../dependent/dependentGroupUtils';

type MaybeCatalog = DependentCatalog | null | undefined;

// BE có thể đổi mốc tuổi trong mã trạng thái (TURNING_18_SOON, TURNING_22_SOON...) nên so theo mẫu
const TURNING_SOON_RE = /^TURNING_(\d+)_SOON$/;
const ALREADY_PENDING_RE = /^ALREADY_(\d+)_PENDING_ACTION$/;

export function isTurningSoonStatus(status?: string | null): boolean {
  return TURNING_SOON_RE.test(String(status || '').trim().toUpperCase());
}

export function isAlreadyPendingStatus(status?: string | null): boolean {
  return ALREADY_PENDING_RE.test(String(status || '').trim().toUpperCase());
}

/** Mốc tuổi trong mã trạng thái nhắc chuyển nhóm; không khớp mẫu thì null. */
export function transitionAgeFromStatus(status?: string | null): number | null {
  const s = String(status || '').trim().toUpperCase();
  const m = TURNING_SOON_RE.exec(s) || ALREADY_PENDING_RE.exec(s);
  return m ? parseInt(m[1], 10) : null;
}

const isStudyingGroup = (catalog: MaybeCatalog, code?: string | null): boolean =>
  Boolean(findCatalogGroup(catalog, code)?.requireStudying);

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
 * NPT đã chuyển sang nhóm đang đi học (cờ requireStudying trong catalog) nhưng chưa upload minh chứng
 * → vẫn hiện banner đến khi isProfileComplete = true.
 */
export function buildPendingUploadAgeReminders(
  dependents: DependentItem[],
  catalog: MaybeCatalog,
  options?: { now?: Date }
): AgeReminderItemDto[] {
  const now = options?.now ?? new Date();

  return dependents
    .filter((dep) => !dep.isProfileComplete && isStudyingGroup(catalog, dep.currentGroup))
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
        recommendedGroup: dep.currentGroup,
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

export function isReminderAwaitingUploadOnly(item: AgeReminderItemDto, catalog: MaybeCatalog): boolean {
  return item.requiredAction === 'UPLOAD_STUDENT_CARD' || isStudyingGroup(catalog, item.currentGroup);
}

/** Chỉ cho đổi nhóm từ nhắc nhở khi BE có gợi ý nhóm đích. */
export function canChangeGroupFromReminder(item: AgeReminderItemDto): boolean {
  return Boolean(String(item.recommendedGroup || '').trim());
}

export function proofNavFromAgeReminder(
  item: AgeReminderItemDto,
  catalog: MaybeCatalog
): {
  screen: 'ProofDocuments';
  params: { dependentId: string; groupIndex: number; requiredDocuments: string[] };
} {
  return {
    screen: 'ProofDocuments',
    params: {
      dependentId: item.dependentId,
      groupIndex: Math.max(0, uiTabForGroup(catalog, item.recommendedGroup || item.currentGroup)),
      requiredDocuments: ['STUDENT_CARD'],
    },
  };
}
