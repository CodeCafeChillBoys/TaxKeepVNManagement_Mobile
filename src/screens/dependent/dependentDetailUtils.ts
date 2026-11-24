import { getDocTypeLabel } from '../../api/dependentDocHelpers';
import { buildDocSlots, isDocSlotSatisfied, RULES_NOT_CONFIGURED_CODE } from './proofDocumentsParams';
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

type MissingDocRule = {
  targetGroup: string;
  docType: string;
  isMandatory: boolean;
  isActive?: boolean;
  docName?: string | null;
  alternativeGroup?: string | null;
};

const upper = (s?: string | null): string => String(s || '').trim().toUpperCase();

function activeGroupRules<R extends MissingDocRule>(rules: R[], currentGroup?: string | null): R[] {
  const group = upper(currentGroup);
  if (!group || !Array.isArray(rules)) return [];
  return rules.filter((r) => r.isActive !== false && upper(r.targetGroup) === group);
}

/**
 * Tính danh sách mã giấy tờ bắt buộc còn thiếu dựa trên cả phản hồi BE (missingDocuments)
 * lẫn danh mục quy tắc giấy tờ bắt buộc của nhóm NPT trong DB (dependent-rules).
 * Tránh trường hợp mới tải 2/3 giấy tờ bắt buộc nhưng vẫn báo "Đủ hồ sơ".
 * Rule cùng alternativeGroup chỉ cần nộp 1: đã có 1 giấy thì cả nhóm coi là đủ, thiếu thì trả mã rule đầu.
 */
export function computeMissingMandatoryDocTypes(
  detail: {
    currentGroup?: string | null;
    missingDocuments?: string[] | null;
    documents?: Array<{ docType?: string | null; isCurrent?: boolean | null }> | null;
  } | null | undefined,
  rules: MissingDocRule[] = []
): string[] {
  if (!detail) return [];

  const currentDocs = Array.isArray(detail.documents)
    ? detail.documents.filter((d) => d && d.isCurrent !== false && d.docType)
    : [];
  const uploadedTypes = currentDocs.map((d) => d.docType);
  const groupRules = activeGroupRules(rules, detail.currentGroup);
  const slots = buildDocSlots(groupRules);
  const slotOf = (docType: string) =>
    slots.find((s) => s.rules.some((r) => isSameProofDocType(r.docType, docType)));

  const seen = new Set<string>();
  const missing: string[] = [];

  const pushIfMissing = (docType?: string | null) => {
    const clean = String(docType || '').trim();
    if (!clean) return;
    if (upper(clean) === RULES_NOT_CONFIGURED_CODE) {
      if (!seen.has(RULES_NOT_CONFIGURED_CODE)) {
        seen.add(RULES_NOT_CONFIGURED_CODE);
        missing.push(clean);
      }
      return;
    }
    const slot = slotOf(clean);
    const key = slot ? slot.key : normalizeProofDocTypeCode(clean);
    if (seen.has(key)) return;
    const satisfied = slot
      ? isDocSlotSatisfied(slot, uploadedTypes)
      : currentDocs.some((doc) => isSameProofDocType(doc.docType, clean));
    if (satisfied) return;
    seen.add(key);
    missing.push(clean);
  };

  if (Array.isArray(detail.missingDocuments)) {
    detail.missingDocuments.forEach(pushIfMissing);
  }

  slots.filter((s) => s.isMandatory).forEach((s) => pushIfMissing(s.rules[0].docType));

  return missing;
}

/**
 * Nhãn một mã giấy tờ còn thiếu: RULES_NOT_CONFIGURED → câu báo chưa cấu hình;
 * mã thuộc alternativeGroup → "Thiếu 1 trong: A / B"; còn lại là docName của rule.
 */
export function describeMissingDoc(
  docType: string,
  rules: MissingDocRule[],
  currentGroup?: string | null
): string {
  if (upper(docType) === RULES_NOT_CONFIGURED_CODE) return getDocTypeLabel(docType);
  const groupRules = activeGroupRules(rules, currentGroup);
  const rule = groupRules.find((r) => isSameProofDocType(r.docType, docType));
  const alt = upper(rule?.alternativeGroup);
  if (rule && rule.isMandatory && alt) {
    const names = groupRules
      .filter((r) => r.isMandatory && upper(r.alternativeGroup) === alt)
      .map((r) => getDocTypeLabel(r.docType, r.docName));
    if (names.length > 1) return `Thiếu 1 trong: ${names.join(' / ')}`;
  }
  return getDocTypeLabel(docType, rule?.docName);
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
