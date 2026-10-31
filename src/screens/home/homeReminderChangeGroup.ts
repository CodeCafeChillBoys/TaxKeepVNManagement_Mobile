import type { ApiResponse } from '../../api/authApi';
import type {
  UpdateDependentGroupRequest,
  UpdateDependentGroupResponse,
} from '../../api/dependentLifecycleApi';
import {
  groupCodeToIndex,
  groupCodeToTitle,
  mapDependentLifecycleError,
} from '../dependent/dependentGroupUtils';

export type HomeReminderInput = {
  dependentId: string;
  fullName: string;
  recommendedGroup: string;
};

export type HomeReminderConfirmPlan = {
  dependentId: string;
  newGroup: string;
  newGroupLabel: string;
  confirmTitle: string;
  confirmMessage: string;
};

export type ProofDocumentsNav = {
  screen: 'ProofDocuments';
  params: {
    dependentId: string;
    groupIndex: number;
    requiredDocuments?: string[];
  };
};

export type HomeReminderChangeResult =
  | { ok: true; navigation: ProofDocumentsNav }
  | { ok: false; message: string };

export type UpdateDependentGroupFn = (
  dependentId: string,
  request: UpdateDependentGroupRequest
) => Promise<ApiResponse<UpdateDependentGroupResponse>>;

export function buildHomeReminderChangeGroupPlan(
  reminder: HomeReminderInput
): HomeReminderConfirmPlan {
  const newGroupLabel = groupCodeToTitle(reminder.recommendedGroup);
  return {
    dependentId: reminder.dependentId,
    newGroup: reminder.recommendedGroup,
    newGroupLabel,
    confirmTitle: 'Xác nhận chuyển nhóm',
    confirmMessage: `Chuyển người phụ thuộc “${reminder.fullName}” sang nhóm mới? Hồ sơ sẽ cần bổ sung giấy tờ theo nhóm này.`,
  };
}

export async function runHomeReminderChangeGroup(options: {
  dependentId: string;
  newGroup: string;
  updateDependentGroup: UpdateDependentGroupFn;
}): Promise<HomeReminderChangeResult> {
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
    // Đã ở nhóm đích (xác nhận lần 2 / race) → vẫn mở upload thay vì báo lỗi.
    const code =
      error &&
      typeof error === 'object' &&
      (error as { response?: { data?: { errors?: { errorCode?: string } } } }).response?.data
        ?.errors?.errorCode;
    if (code === 'SAME_GROUP') {
      return {
        ok: true,
        navigation: {
          screen: 'ProofDocuments',
          params: {
            dependentId,
            groupIndex: groupCodeToIndex(newGroup),
            requiredDocuments: ['STUDENT_CARD'],
          },
        },
      };
    }
    return { ok: false, message: mapDependentLifecycleError(error) };
  }
}
