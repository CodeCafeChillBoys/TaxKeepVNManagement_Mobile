import type { ApiResponse } from '../../api/authApi';
import type {
  DeleteDependentRequest,
  DeleteDependentResponse,
} from '../../api/dependentLifecycleApi';
import { mapDependentLifecycleError } from './dependentGroupUtils';

export type SoftDeleteInput = {
  dependentId: string;
  fullName: string;
};

export type SoftDeleteConfirmPlan = {
  dependentId: string;
  confirmTitle: string;
  confirmMessage: string;
  reasonOptional: true;
};

export type SoftDeleteResult =
  | { ok: true; refreshList: true; toastMessage: string }
  | { ok: false; message: string };

export type DeleteDependentFn = (
  dependentId: string,
  request?: DeleteDependentRequest
) => Promise<ApiResponse<DeleteDependentResponse>>;

export function buildSoftDeletePlan(input: SoftDeleteInput): SoftDeleteConfirmPlan {
  return {
    dependentId: input.dependentId,
    confirmTitle: 'Vô hiệu hóa người phụ thuộc',
    confirmMessage: `Bạn sắp vô hiệu hóa "${input.fullName}". Người phụ thuộc sẽ không còn hiển thị trong danh sách. Thao tác không thể khôi phục trên ứng dụng.`,
    reasonOptional: true,
  };
}

export async function runSoftDeleteDependent(options: {
  dependentId: string;
  reason?: string;
  deleteDependent: DeleteDependentFn;
}): Promise<SoftDeleteResult> {
  const { dependentId, reason, deleteDependent } = options;
  try {
    const trimmed = reason?.trim();
    const res = await deleteDependent(
      dependentId,
      trimmed ? { reason: trimmed } : undefined
    );
    if (!res.success) {
      return {
        ok: false,
        message: res.message?.trim() || 'Không thể thực hiện. Vui lòng thử lại.',
      };
    }
    return {
      ok: true,
      refreshList: true,
      toastMessage: res.message?.trim() || 'Đã vô hiệu hóa người phụ thuộc thành công.',
    };
  } catch (error: unknown) {
    return { ok: false, message: mapDependentLifecycleError(error) };
  }
}
