import type { ApiResponse } from '../../api/authApi';
import type {
  UpdateDependentGroupRequest,
  UpdateDependentGroupResponse,
} from '../../api/dependentLifecycleApi';
import type { DependentCatalog } from '../../api/dependentDocumentApi';
import {
  filterChangeGroupOptions,
  mapDependentLifecycleError,
  uiTabForGroup,
} from './dependentGroupUtils';
import type { ProofDocumentsNav } from '../home/homeReminderChangeGroup';

export type ManualChangeGroupInput = {
  dependentId: string;
  fullName: string;
  relationship: string;
  currentGroup: string;
  /** Tuổi tại ngày bắt đầu hiệu lực — lọc nhóm theo grill Q4. */
  ageAtEffective?: number;
  catalog: DependentCatalog | null | undefined;
};

export type ManualChangeGroupPlan = {
  dependentId: string;
  fullName: string;
  currentGroup: string;
  options: string[];
  canChange: boolean;
};

export type ManualChangeGroupResult =
  | { ok: true; navigation: ProofDocumentsNav }
  | { ok: false; message: string };

export type UpdateDependentGroupFn = (
  dependentId: string,
  request: UpdateDependentGroupRequest
) => Promise<ApiResponse<UpdateDependentGroupResponse>>;

export function buildManualChangeGroupPlan(
  input: ManualChangeGroupInput
): ManualChangeGroupPlan {
  const options = filterChangeGroupOptions(
    input.catalog,
    input.relationship,
    input.currentGroup
  );
  return {
    dependentId: input.dependentId,
    fullName: input.fullName,
    currentGroup: input.currentGroup,
    options,
    canChange: options.length > 0,
  };
}

export async function runManualChangeGroup(options: {
  dependentId: string;
  newGroup: string;
  note?: string | null;
  updateDependentGroup: UpdateDependentGroupFn;
  catalog: DependentCatalog | null | undefined;
}): Promise<ManualChangeGroupResult> {
  const { dependentId, newGroup, note, updateDependentGroup, catalog } = options;
  try {
    const trimmedNote = typeof note === 'string' ? note.trim() : undefined;
    const request: UpdateDependentGroupRequest = trimmedNote
      ? { newGroup, note: trimmedNote }
      : { newGroup };
    const res = await updateDependentGroup(dependentId, request);
    if (!res.success || !res.data) {
      return {
        ok: false,
        message: res.message?.trim() || 'Không thể thực hiện. Vui lòng thử lại.',
      };
    }
    const currentGroup = res.data.currentGroup || newGroup;
    return {
      ok: true,
      navigation: {
        screen: 'ProofDocuments',
        params: {
          dependentId,
          groupIndex: Math.max(0, uiTabForGroup(catalog, currentGroup)),
          requiredDocuments: res.data.requiredDocuments ?? [],
        },
      },
    };
  } catch (error: unknown) {
    return { ok: false, message: mapDependentLifecycleError(error) };
  }
}
