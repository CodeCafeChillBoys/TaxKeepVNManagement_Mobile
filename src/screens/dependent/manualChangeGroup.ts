import type { ApiResponse } from '../../api/authApi';
import type {
  UpdateDependentGroupRequest,
  UpdateDependentGroupResponse,
} from '../../api/dependentLifecycleApi';
import {
  filterChangeGroupOptions,
  groupCodeToIndex,
  mapDependentLifecycleError,
} from './dependentGroupUtils';
import type { ProofDocumentsNav } from '../home/homeReminderChangeGroup';

export type ManualChangeGroupInput = {
  dependentId: string;
  fullName: string;
  relationship: string;
  currentGroup: string;
  /** Tuổi tại ngày bắt đầu hiệu lực — lọc nhóm theo grill Q4. */
  ageAtEffective?: number;
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
    input.relationship,
    input.currentGroup,
    input.ageAtEffective
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
  updateDependentGroup: UpdateDependentGroupFn;
}): Promise<ManualChangeGroupResult> {
  const { dependentId, newGroup, updateDependentGroup } = options;
  try {
    const res = await updateDependentGroup(dependentId, { newGroup });
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
          groupIndex: groupCodeToIndex(currentGroup),
          requiredDocuments: res.data.requiredDocuments ?? [],
        },
      },
    };
  } catch (error: unknown) {
    return { ok: false, message: mapDependentLifecycleError(error) };
  }
}
