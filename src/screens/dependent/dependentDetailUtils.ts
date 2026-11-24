import { groupCodeToIndex } from './dependentGroupUtils';
import { selectRulesForTab } from './proofDocumentsParams';
import { isSameProofDocType, normalizeProofDocTypeCode } from './proofDocumentLawExplanation';

export interface DependentStatusMeta {
  label: string;
  tone: 'success' | 'warning' | 'neutral';
  description: string;
}

export function getDependentStatusMeta(
  status?: string | null,
  isProfileComplete?: boolean,
  missingMandatoryCount = 0
): DependentStatusMeta {
  const normalized = (status || '').trim().toUpperCase();
  if (normalized === 'INACTIVE') {
    return {
      label: 'Ngừng hiệu lực',
      tone: 'neutral',
      description: 'Hồ sơ người phụ thuộc đã được vô hiệu hóa và ngừng tính giảm trừ gia cảnh.',
    };
  }
  if (missingMandatoryCount > 0 || isProfileComplete === false) {
    return {
      label: 'Chờ bổ sung minh chứng',
      tone: 'warning',
      description:
        missingMandatoryCount > 0
          ? `Còn thiếu ${missingMandatoryCount} giấy tờ minh chứng bắt buộc. Vui lòng tải lên đầy đủ để đủ điều kiện tính giảm trừ gia cảnh.`
          : 'Vui lòng tải lên đầy đủ giấy tờ minh chứng bắt buộc để hoàn tất hồ sơ.',
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

/**
 * Tính danh sách mã giấy tờ bắt buộc còn thiếu dựa trên cả phản hồi BE (missingDocuments)
 * lẫn danh mục quy tắc giấy tờ bắt buộc của nhóm NPT trong DB (dependent-rules).
 * Tránh trường hợp mới tải 2/3 giấy tờ bắt buộc nhưng vẫn báo "Đủ hồ sơ".
 */
export function computeMissingMandatoryDocTypes(
  detail: {
    currentGroup?: string | null;
    missingDocuments?: string[] | null;
    documents?: Array<{ docType?: string | null; isCurrent?: boolean | null }> | null;
  } | null | undefined,
  rules: Array<{ targetGroup: string; docType: string; isMandatory: boolean; isActive?: boolean }> = []
): string[] {
  if (!detail) return [];

  const currentDocs = Array.isArray(detail.documents)
    ? detail.documents.filter((d) => d && d.isCurrent !== false && d.docType)
    : [];

  const seenCanonical = new Set<string>();
  const missing: string[] = [];

  const pushIfMissing = (docType?: string | null) => {
    const clean = String(docType || '').trim();
    if (!clean) return;
    const canonical = normalizeProofDocTypeCode(clean);
    if (seenCanonical.has(canonical)) return;
    const alreadyUploaded = currentDocs.some((doc) => isSameProofDocType(doc.docType, clean));
    if (alreadyUploaded) return;
    seenCanonical.add(canonical);
    missing.push(clean);
  };

  if (Array.isArray(detail.missingDocuments)) {
    detail.missingDocuments.forEach(pushIfMissing);
  }

  if (Array.isArray(rules) && rules.length > 0 && detail.currentGroup) {
    const groupIdx = groupCodeToIndex(detail.currentGroup);
    const activeRules = rules.filter((r) => r.isActive !== false);
    const groupRules = selectRulesForTab(activeRules, groupIdx, detail.currentGroup);
    groupRules
      .filter((r) => Boolean(r.isMandatory))
      .forEach((r) => pushIfMissing(r.docType));
  }

  return missing;
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
