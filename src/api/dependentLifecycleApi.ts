import type { AxiosInstance } from 'axios';
import { apiClient } from './apiClient';
import type { ApiResponse } from './authApi';

export type UpdateDependentGroupRequest = {
  newGroup: string;
  note?: string | null;
};

export type DependentDocumentDto = {
  docId: string;
  docType: string;
  fileUrl?: string | null;
  fileMimeType?: string | null;
  isReadable?: boolean;
  uploadedAt?: string;
};

export type UpdateDependentGroupResponse = {
  dependentId: string;
  taxpayerId?: string;
  fullName?: string;
  birthDate?: string;
  citizenId?: string | null;
  birthCertNumber?: string | null;
  taxIdNumber?: string | null;
  relationship?: string;
  effectiveFromMonth?: string;
  effectiveToMonth?: string;
  note?: string | null;
  createdAt?: string;
  updatedAt?: string;
  previousGroup: string;
  currentGroup: string;
  status: string;
  isProfileComplete: boolean;
  requiredDocuments: string[];
  documents: DependentDocumentDto[];
};

export type DeleteDependentRequest = {
  reason?: string | null;
};

export type DeleteDependentResponse = {
  dependentId: string;
  fullName?: string;
  relationship?: string;
  currentGroup?: string;
  status: string;
  isDeleted: boolean;
  reason?: string | null;
  deletedAt?: string;
};

export function createDependentLifecycleApi(http: AxiosInstance) {
  async function updateDependentGroup(
    dependentId: string,
    request: UpdateDependentGroupRequest
  ): Promise<ApiResponse<UpdateDependentGroupResponse>> {
    const body: UpdateDependentGroupRequest = {
      newGroup: request.newGroup,
    };
    if (request.note != null && request.note !== undefined) {
      body.note = request.note;
    }
    const res = await http.patch<ApiResponse<UpdateDependentGroupResponse>>(
      `/api/v1/dependents/${dependentId}/group`,
      body
    );
    return res.data;
  }

  async function deleteDependent(
    dependentId: string,
    request?: DeleteDependentRequest
  ): Promise<ApiResponse<DeleteDependentResponse>> {
    const data =
      request?.reason != null && String(request.reason).length > 0
        ? { reason: request.reason }
        : undefined;
    const res = await http.delete<ApiResponse<DeleteDependentResponse>>(
      `/api/v1/dependents/${dependentId}`,
      { data }
    );
    return res.data;
  }

  return {
    updateDependentGroup,
    deleteDependent,
  };
}

export const dependentLifecycleApi = createDependentLifecycleApi(apiClient);
