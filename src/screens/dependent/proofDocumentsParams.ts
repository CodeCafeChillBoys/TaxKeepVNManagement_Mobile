import type { DependentCatalog, DependentItem } from '../../api/dependentDocumentApi';
import type { RootStackParamList } from '../../navigation/types';
import { uiTabForGroup } from './dependentGroupUtils';
import { isSameProofDocType } from './proofDocumentLawExplanation';

/** Mã BE trả trong missingDocuments / requiredDocuments khi nhóm chưa có rule giấy tờ. */
export const RULES_NOT_CONFIGURED_CODE = 'RULES_NOT_CONFIGURED';

/** NPT-07: ưu tiên checklist từ PATCH response qua nav params. */

export function resolveProofDocumentsChecklist(options: {
  requiredDocuments?: string[] | null;
  fallbackDocTypes: string[];
}): string[] {
  const fromParams = options.requiredDocuments?.filter((d) => d && String(d).trim());
  if (fromParams && fromParams.length > 0) {
    return fromParams.map((d) => d.trim());
  }
  return options.fallbackDocTypes;
}

/**
 * Tham số mở màn Ảnh minh chứng cho một người phụ thuộc đã lưu.
 * Dùng chung cho màn Người phụ thuộc và mục "Cần xử lý" ở Home để cả hai đòi đúng giấy tờ của nhóm hiện tại.
 */
export function buildProofDocumentsParams(
  dep: DependentItem,
  catalog: DependentCatalog | null | undefined
): NonNullable<RootStackParamList['ProofDocuments']> {
  const groupIdx = Math.max(0, uiTabForGroup(catalog, dep.currentGroup));
  return {
    groupIndex: groupIdx,
    dependentId: dep.id,
    dependentData: {
      fullName: dep.fullName,
      citizenId: dep.citizenId || '',
      birthCertNumber: dep.birthCertNumber || '',
      dateOfBirth: dep.birthDate,
      relationship: dep.relationship || '',
      effectiveFromMonth: dep.effectiveFromMonth || '2026-01',
      effectiveToMonth: dep.effectiveToMonth || '2026-12',
      groupId: groupIdx + 1,
      groupCode: dep.currentGroup,
    },
  };
}

/**
 * File cần upload khi bấm Lưu: chỉ file người dùng vừa chọn cho các ô đang hiển thị.
 * Bỏ qua file đồng bộ từ server (có docId) để không tải lại giấy tờ đã lưu (gây bản ghi trùng, chạy OCR lại).
 */
export function selectNewUploads<T extends { docId?: string | null }>(
  selectedFiles: Record<string, T>,
  activeDocKeys: string[]
): [string, T][] {
  return Object.entries(selectedFiles).filter(([key, file]) => activeDocKeys.includes(key) && !file?.docId);
}

/**
 * Ô còn giữ giấy cũ nộp trước khi đổi thông tin nhân thân (needsReupload) mà chưa chọn ảnh mới.
 * Các giấy này BE không còn tính, nên phải nộp lại trước khi lưu.
 */
export function listDocsNeedingReupload<D extends { key: string }>(
  activeDocs: D[],
  selectedFiles: Record<string, { docId?: string | null; needsReupload?: boolean } | undefined>
): D[] {
  return activeDocs.filter((d) => {
    const f = selectedFiles[d.key];
    return !!f?.needsReupload && !!f.docId;
  });
}

/**
 * Rule giấy tờ (từ DB) hiển thị ở tab đang chọn.
 * - Có NPT thuộc tab này: chỉ lấy rule đúng currentGroup của NPT (vd nhóm cha mẹ hết tuổi lao động).
 * - Không có NPT: lấy mọi rule có targetGroup thuộc tab, bỏ trùng docType.
 * Không đoán mã nhóm hay mã giấy tờ trong app; tab tính qua catalog.
 * Catalog chưa về (hoặc chưa có nhóm của NPT) thì vẫn lấy theo nhóm của NPT.
 */
export function selectRulesForTab<T extends { targetGroup: string; docType: string }>(
  rules: T[],
  groupIdx: number,
  currentGroup: string | null | undefined,
  catalog: DependentCatalog | null | undefined
): T[] {
  const current = currentGroup?.toUpperCase();
  const currentTab = current ? uiTabForGroup(catalog, current) : -1;
  if (current && (currentTab === groupIdx || currentTab === -1)) {
    return rules.filter((r) => r.targetGroup?.toUpperCase() === current);
  }
  const seen = new Set<string>();
  return rules.filter((r) => {
    const code = r.docType?.toUpperCase();
    if (!code || seen.has(code) || uiTabForGroup(catalog, r.targetGroup) !== groupIdx) return false;
    seen.add(code);
    return true;
  });
}

type SlotRule = { docType: string; isMandatory: boolean; alternativeGroup?: string | null };

/** Một ô upload: 1 rule, hoặc nhiều rule bắt buộc cùng alternativeGroup (chỉ cần nộp 1). */
export interface DocSlot<R extends SlotRule> {
  key: string;
  alternativeGroup: string | null;
  isMandatory: boolean;
  rules: R[];
}

const altKey = (r: SlotRule): string => String(r.alternativeGroup || '').trim().toUpperCase();

/**
 * Gộp rule thành ô upload. Rule bắt buộc cùng alternativeGroup thành một ô "Nộp 1 trong các giấy tờ",
 * rule còn lại mỗi rule một ô. Ô bắt buộc đứng trước, giữ thứ tự rule trong từng nhóm.
 */
export function buildDocSlots<R extends SlotRule>(rules: R[]): DocSlot<R>[] {
  const slots: DocSlot<R>[] = [];
  const byAlt = new Map<string, DocSlot<R>>();
  for (const rule of rules) {
    const alt = altKey(rule);
    if (rule.isMandatory && alt) {
      const existing = byAlt.get(alt);
      if (existing) {
        existing.rules.push(rule);
        continue;
      }
      const slot: DocSlot<R> = {
        key: `alt_${alt.toLowerCase()}`,
        alternativeGroup: alt,
        isMandatory: true,
        rules: [rule],
      };
      byAlt.set(alt, slot);
      slots.push(slot);
      continue;
    }
    slots.push({
      key: `rule_${String(rule.docType || '').toLowerCase()}`,
      alternativeGroup: null,
      isMandatory: Boolean(rule.isMandatory),
      rules: [rule],
    });
  }
  return [...slots].sort((a, b) => Number(b.isMandatory) - Number(a.isMandatory));
}

/** Ô đủ khi đã có ít nhất 1 giấy hợp lệ thuộc ô. */
export function isDocSlotSatisfied<R extends SlotRule>(
  slot: DocSlot<R>,
  uploadedDocTypes: (string | null | undefined)[]
): boolean {
  return slot.rules.some((r) => uploadedDocTypes.some((d) => isSameProofDocType(d, r.docType)));
}

/**
 * Checklist từ BE (requiredDocuments) → rule của nhóm. Mã thuộc một alternativeGroup thì kéo theo
 * các rule bắt buộc cùng nhóm để người dùng được chọn loại giấy. Bỏ mã RULES_NOT_CONFIGURED.
 * Mã không có rule thì tạo rule bắt buộc tạm từ chính mã đó.
 */
export function expandChecklistToRules<R extends SlotRule & { targetGroup?: string }>(
  codes: string[],
  groupRules: R[],
  makeFallback: (docType: string) => R
): R[] {
  const out: R[] = [];
  const has = (docType: string) => out.some((r) => isSameProofDocType(r.docType, docType));
  for (const code of codes) {
    if (!code || code.trim().toUpperCase() === RULES_NOT_CONFIGURED_CODE) continue;
    const rule = groupRules.find((r) => isSameProofDocType(r.docType, code));
    if (!rule) {
      if (!has(code)) out.push(makeFallback(code));
      continue;
    }
    const alt = altKey(rule);
    const related = alt && rule.isMandatory
      ? groupRules.filter((r) => r.isMandatory && altKey(r) === alt)
      : [rule];
    related.forEach((r) => {
      if (!has(r.docType)) out.push(r);
    });
  }
  return out;
}
