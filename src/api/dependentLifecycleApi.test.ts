import type { AxiosInstance } from 'axios';

jest.mock('./apiClient', () => ({
  apiClient: { patch: jest.fn(), delete: jest.fn() },
}));

import { createDependentLifecycleApi } from './dependentLifecycleApi';

function createHttpMock() {
  return {
    patch: jest.fn(),
    delete: jest.fn(),
  } as unknown as AxiosInstance & { patch: jest.Mock; delete: jest.Mock };
}

describe('dependentLifecycleApi', () => {
  describe('updateDependentGroup', () => {
    it('PATCHes /api/v1/dependents/{id}/group with newGroup and returns ApiResponse data', async () => {
      const http = createHttpMock();
      const dependentId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
      const body = {
        success: true,
        message: 'Chuyển nhóm thành công',
        data: {
          dependentId,
          previousGroup: 'CHILD_UNDER_18',
          currentGroup: 'CHILD_OVER_18_STUDYING',
          status: 'PENDING_DOCUMENTS',
          isProfileComplete: false,
          requiredDocuments: ['STUDENT_CARD'],
          documents: [],
          fullName: 'Nguyen Van B',
          relationship: 'CHILD',
        },
      };
      http.patch.mockResolvedValue({ data: body, status: 200 });

      const api = createDependentLifecycleApi(http);
      const result = await api.updateDependentGroup(dependentId, {
        newGroup: 'CHILD_OVER_18_STUDYING',
      });

      expect(result).toEqual(body);
      expect(http.patch).toHaveBeenCalledWith(
        `/api/v1/dependents/${dependentId}/group`,
        { newGroup: 'CHILD_OVER_18_STUDYING' }
      );
    });

    it('sends optional note when provided', async () => {
      const http = createHttpMock();
      http.patch.mockResolvedValue({
        data: { success: true, message: 'ok', data: {} },
        status: 200,
      });

      const api = createDependentLifecycleApi(http);
      await api.updateDependentGroup('id-1', {
        newGroup: 'CHILD_OVER_18_DISABLED',
        note: 'Chuyển sang khuyết tật',
      });

      expect(http.patch).toHaveBeenCalledWith('/api/v1/dependents/id-1/group', {
        newGroup: 'CHILD_OVER_18_DISABLED',
        note: 'Chuyển sang khuyết tật',
      });
    });
  });

  describe('deleteDependent', () => {
    it('DELETEs /api/v1/dependents/{id} and returns ApiResponse data', async () => {
      const http = createHttpMock();
      const dependentId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
      const body = {
        success: true,
        message: 'Đã vô hiệu hóa',
        data: {
          dependentId,
          fullName: 'Nguyen Van B',
          status: 'INACTIVE',
          isDeleted: true,
          deletedAt: '2026-09-19T00:00:00Z',
        },
      };
      http.delete.mockResolvedValue({ data: body, status: 200 });

      const api = createDependentLifecycleApi(http);
      const result = await api.deleteDependent(dependentId);

      expect(result).toEqual(body);
      expect(http.delete).toHaveBeenCalledWith(`/api/v1/dependents/${dependentId}`, {
        data: undefined,
      });
    });

    it('sends optional reason in DELETE body', async () => {
      const http = createHttpMock();
      http.delete.mockResolvedValue({
        data: { success: true, message: 'ok', data: { isDeleted: true } },
        status: 200,
      });

      const api = createDependentLifecycleApi(http);
      await api.deleteDependent('id-2', { reason: 'Không còn là NPT' });

      expect(http.delete).toHaveBeenCalledWith('/api/v1/dependents/id-2', {
        data: { reason: 'Không còn là NPT' },
      });
    });
  });
});
