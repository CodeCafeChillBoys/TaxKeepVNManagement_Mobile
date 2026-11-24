/**
 * Helpers nhóm NPT theo catalog từ BE (GET /dependents/catalog) + map lỗi lifecycle (PRD npt-lifecycle §5.1 / §8).
 * Không viết cứng mã nhóm: nhãn, quan hệ, cấp nhóm đều lấy từ catalog.
 */
import type { CatalogGroup, DependentCatalog } from '../../api/dependentDocumentApi';

export type DependentRelationshipCode = string;

type MaybeCatalog = DependentCatalog | null | undefined;

const upper = (s?: string | null): string => String(s || '').trim().toUpperCase();

export function findCatalogGroup(catalog: MaybeCatalog, code?: string | null): CatalogGroup | undefined {
  const c = upper(code);
  if (!c || !catalog) return undefined;
  return catalog.groups.find((g) => upper(g.code) === c);
}

/** Nhóm thuộc quan hệ, sắp theo displayOrder. */
export function groupsForRelationship(
  catalog: MaybeCatalog,
  relationship: DependentRelationshipCode
): CatalogGroup[] {
  const rel = upper(relationship);
  if (!rel || !catalog) return [];
  return catalog.groups
    .filter((g) => upper(g.relationshipCode) === rel)
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

/** Tên nhóm trong catalog; không có thì trả lại mã. */
export function groupName(catalog: MaybeCatalog, code?: string | null): string {
  return findCatalogGroup(catalog, code)?.name || String(code || '');
}

/** Tên quan hệ trong catalog; không có thì trả lại mã. */
export function relationshipName(catalog: MaybeCatalog, code?: string | null): string {
  const c = upper(code);
  return catalog?.relationships.find((r) => upper(r.code) === c)?.name || String(code || '');
}

/** Đổi mã nhóm trong câu API thành tên nhóm (mã dài thay trước để không cắt nhầm mã con). */
export function humanizeGroupCodes(catalog: MaybeCatalog, text?: string | null): string {
  if (!text) return '';
  if (!catalog) return text;
  return [...catalog.groups]
    .filter((g) => g.code)
    .sort((a, b) => b.code.length - a.code.length)
    .reduce((out, g) => out.split(g.code).join(g.name || g.code), text);
}

/** Nhóm có thể đổi sang: cùng quan hệ, khác nhóm hiện tại, không thấp hơn cấp hiện tại (BE chặn hạ nhóm). */
export function filterChangeGroupOptions(
  catalog: MaybeCatalog,
  relationship: DependentRelationshipCode,
  currentGroup: string
): string[] {
  const current = findCatalogGroup(catalog, currentGroup);
  const currentLevel = current?.level ?? 0;
  return groupsForRelationship(catalog, relationship)
    .filter((g) => upper(g.code) !== upper(currentGroup) && g.level >= currentLevel)
    .map((g) => g.code);
}

/**
 * Tab "Nhóm 1–5" (theo luật) của một nhóm catalog, xếp theo thuộc tính chứ không theo mã nhóm.
 * Mã quan hệ CHILD / SPOUSE / PARENT là phân loại của luật (con; vợ chồng, cha mẹ) nên được so trực tiếp.
 */
export function uiTabForCatalogGroup(group: CatalogGroup): number {
  const rel = upper(group.relationshipCode);
  // Con: tách 3 tab theo cờ khuyết tật / đi học; không cờ (con dưới tuổi giới hạn) là tab đầu
  if (rel === 'CHILD') {
    if (group.requireDisabled) return 2;
    if (group.requireStudying) return 1;
    return 0;
  }
  // Vợ/chồng và cha/mẹ chung một tab theo luật
  if (rel === 'SPOUSE' || rel === 'PARENT') return 3;
  return 4;
}

/** Tab UI của mã nhóm; mã không có trong catalog thì -1. */
export function uiTabForGroup(catalog: MaybeCatalog, code?: string | null): number {
  const group = findCatalogGroup(catalog, code);
  return group ? uiTabForCatalogGroup(group) : -1;
}

function getErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const data = (error as { response?: { data?: { errors?: { errorCode?: string } } } })
    .response?.data;
  const code = data?.errors?.errorCode;
  return typeof code === 'string' && code.length > 0 ? code : null;
}

function getHttpStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;
  const status = (error as { response?: { status?: number } }).response?.status;
  return typeof status === 'number' ? status : null;
}

function isNetworkError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { message?: string; code?: string };
  if (e.code === 'ECONNABORTED' || e.code === 'ERR_NETWORK') return true;
  if (typeof e.message === 'string' && /network/i.test(e.message)) return true;
  return getHttpStatus(error) == null && !getErrorCode(error);
}

export function mapDependentLifecycleError(error: unknown): string {
  const code = getErrorCode(error);
  if (code === 'SAME_GROUP') return 'Người phụ thuộc đã ở nhóm này.';
  // BE liệt kê mã hợp lệ lấy từ DB trong message; UI chỉ báo chung, không lộ mã
  if (code === 'INVALID_GROUP') return 'Nhóm điều kiện không hợp lệ.';
  if (code === 'GROUP_RELATIONSHIP_MISMATCH') {
    return 'Nhóm không khớp quan hệ hiện tại.';
  }
  if (code === 'GROUP_AGE_MISMATCH') {
    return 'Nhóm không khớp tuổi tại ngày bắt đầu hiệu lực giảm trừ.';
  }
  if (code === 'RULES_NOT_CONFIGURED') {
    return 'Nhóm này chưa được cấu hình danh mục giấy tờ, vui lòng liên hệ hỗ trợ.';
  }

  const status = getHttpStatus(error);
  if (status === 403) return 'Bạn không có quyền với người phụ thuộc này.';
  if (status === 404) return 'Không tìm thấy người phụ thuộc.';

  if (isNetworkError(error)) return 'Không kết nối được. Thử lại.';

  const message = (error as { response?: { data?: { message?: string } }; message?: string })
    ?.response?.data?.message;
  if (typeof message === 'string' && message.trim()) return message.trim();

  return 'Không thể thực hiện. Vui lòng thử lại.';
}
