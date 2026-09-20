/**
 * Helpers nhóm NPT + map lỗi lifecycle (PRD npt-lifecycle §5.1 / §8).
 */

export type DependentRelationshipCode =
  | 'CHILD'
  | 'SPOUSE'
  | 'PARENT'
  | 'OTHER_DEPENDENT'
  | string;

const GROUPS_BY_RELATIONSHIP: Record<string, string[]> = {
  CHILD: ['CHILD_UNDER_18', 'CHILD_OVER_18_STUDYING', 'CHILD_OVER_18_DISABLED'],
  SPOUSE: ['SPOUSE_DISABLED', 'SPOUSE_RETIRED'],
  PARENT: ['PARENT_DISABLED', 'PARENT_RETIRED'],
  OTHER_DEPENDENT: ['OTHER_HELPLESS'],
};

export function groupsForRelationship(relationship: DependentRelationshipCode): string[] {
  return GROUPS_BY_RELATIONSHIP[relationship] ? [...GROUPS_BY_RELATIONSHIP[relationship]] : [];
}

export function filterChangeGroupOptions(
  relationship: DependentRelationshipCode,
  currentGroup: string
): string[] {
  return groupsForRelationship(relationship).filter((g) => g !== currentGroup);
}

/** Map enum CurrentGroup → index LAW_GROUP_SPECS / ProofDocuments (0..4). */
export function groupCodeToIndex(currentGroup?: string): number {
  switch (currentGroup) {
    case 'CHILD_UNDER_18':
      return 0;
    case 'CHILD_OVER_18_STUDYING':
    case 'CHILD_STUDYING':
      return 1;
    case 'CHILD_OVER_18_DISABLED':
    case 'CHILD_DISABLED':
    case 'DISABLED_DEPENDENT':
      return 2;
    case 'SPOUSE_RETIRED':
    case 'SPOUSE_DISABLED':
    case 'PARENT_RETIRED':
    case 'PARENT_DISABLED':
    case 'SPOUSE_OR_PARENTS':
    case 'PARENT':
    case 'SPOUSE':
      return 3;
    case 'OTHER_HELPLESS':
    case 'OTHER_DEPENDENT':
      return 4;
    default:
      return 0;
  }
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
  if (code === 'INVALID_GROUP') return 'Nhóm điều kiện không hợp lệ.';
  if (code === 'GROUP_RELATIONSHIP_MISMATCH') {
    return 'Nhóm không khớp quan hệ hiện tại.';
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
