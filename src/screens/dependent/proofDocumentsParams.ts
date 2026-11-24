import type { DependentItem } from '../../api/dependentDocumentApi';
import type { RootStackParamList } from '../../navigation/types';
import { groupCodeToIndex } from './dependentGroupUtils';

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
export function buildProofDocumentsParams(dep: DependentItem): NonNullable<RootStackParamList['ProofDocuments']> {
  const groupIdx = groupCodeToIndex(dep.currentGroup);
  return {
    groupIndex: groupIdx,
    dependentId: dep.id,
    dependentData: {
      fullName: dep.fullName,
      citizenId: dep.citizenId || '',
      birthCertNumber: dep.birthCertNumber || '',
      dateOfBirth: dep.birthDate,
      relationship: dep.relationship || 'CHILD',
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
 * - Có NPT thuộc tab này: chỉ lấy rule đúng currentGroup của NPT (vd PARENT_RETIRED).
 * - Không có NPT: lấy mọi rule có targetGroup thuộc tab, bỏ trùng docType.
 * Không đoán mã nhóm hay mã giấy tờ trong app.
 */
export function selectRulesForTab<T extends { targetGroup: string; docType: string }>(
  rules: T[],
  groupIdx: number,
  currentGroup?: string | null
): T[] {
  const current = currentGroup?.toUpperCase();
  if (current && groupCodeToIndex(current) === groupIdx) {
    return rules.filter((r) => r.targetGroup?.toUpperCase() === current);
  }
  const seen = new Set<string>();
  return rules.filter((r) => {
    const code = r.docType?.toUpperCase();
    if (!code || seen.has(code) || groupCodeToIndex(r.targetGroup?.toUpperCase()) !== groupIdx) return false;
    seen.add(code);
    return true;
  });
}
