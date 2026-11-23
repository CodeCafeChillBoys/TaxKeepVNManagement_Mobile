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
 * Mã giấy tờ chứng minh quan hệ của Nhóm 4 theo quan hệ với người nộp thuế.
 * Vợ/chồng và cha mẹ vợ/chồng nộp giấy kết hôn; cha mẹ đẻ nộp giấy khai sinh của người nộp thuế
 * (khớp DependentService.GetMissingDocuments của BE và OCR so loại BIRTH_CERTIFICATE).
 */
export function relationDocTypeFor(relationship?: string | null): string {
  const rel = (relationship || '').toUpperCase();
  return rel === 'SPOUSE' || rel === 'PARENT_IN_LAW' ? 'MARRIAGE_CERTIFICATE' : 'BIRTH_CERTIFICATE';
}
