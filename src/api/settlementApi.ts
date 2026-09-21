import type { AxiosInstance } from 'axios';
import { apiClient } from './apiClient';
import type { ApiResponse } from './authApi';

export type SettlementDossierDto = {
  id: string;
  taxpayerId: string;
  taxYear: number;
  version: number;
  status: string;
  ruleSetId?: string | null;
  cutOffDate?: string | null;
  isStale: boolean;
  isProvisional: boolean;
  zipFileUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  lockedAt?: string | null;
};

export type CreateSettlementDossierRequest = {
  taxYear: number;
};

export type SettlementRuleContextDto = {
  ruleSetId?: string | null;
  documentNumber?: string | null;
  issuedAt?: string | null;
  cutOffDate?: string | null;
  pdfUrl?: string | null;
};

export function createSettlementApi(http: AxiosInstance) {
  async function createDossier(
    request: CreateSettlementDossierRequest
  ): Promise<ApiResponse<SettlementDossierDto>> {
    const res = await http.post<ApiResponse<SettlementDossierDto>>(
      '/api/v1/settlements/dossiers',
      request
    );
    return res.data;
  }

  async function listDossiers(
    taxYear?: number
  ): Promise<ApiResponse<SettlementDossierDto[]>> {
    const res = await http.get<ApiResponse<SettlementDossierDto[]>>(
      '/api/v1/settlements/dossiers',
      { params: taxYear != null ? { taxYear } : undefined }
    );
    return res.data;
  }

  async function getDossier(
    dossierId: string
  ): Promise<ApiResponse<SettlementDossierDto>> {
    const res = await http.get<ApiResponse<SettlementDossierDto>>(
      `/api/v1/settlements/dossiers/${dossierId}`
    );
    return res.data;
  }

  async function getRuleContext(
    dossierId: string
  ): Promise<ApiResponse<SettlementRuleContextDto>> {
    const res = await http.get<ApiResponse<SettlementRuleContextDto>>(
      `/api/v1/settlements/dossiers/${dossierId}/rule-context`
    );
    return res.data;
  }

  async function collect(dossierId: string): Promise<ApiResponse<unknown>> {
    const res = await http.post(
      `/api/v1/settlements/dossiers/${dossierId}/collect`
    );
    return res.data;
  }

  async function calculate(dossierId: string): Promise<ApiResponse<unknown>> {
    const res = await http.post(
      `/api/v1/settlements/dossiers/${dossierId}/calculate`
    );
    return res.data;
  }

  async function patchItem(
    dossierId: string,
    itemId: string,
    body: { isIncluded: boolean; excludeReason?: string }
  ): Promise<ApiResponse<unknown>> {
    const res = await http.patch(
      `/api/v1/settlements/dossiers/${dossierId}/items/${itemId}`,
      body
    );
    return res.data;
  }

  async function refresh(dossierId: string): Promise<ApiResponse<unknown>> {
    const res = await http.post(
      `/api/v1/settlements/dossiers/${dossierId}/refresh`
    );
    return res.data;
  }

  async function confirm(
    dossierId: string,
    body: { commitmentAccepted: boolean }
  ): Promise<ApiResponse<unknown>> {
    const res = await http.post(
      `/api/v1/settlements/dossiers/${dossierId}/confirm`,
      body
    );
    return res.data;
  }

  async function exportDossier(dossierId: string): Promise<ApiResponse<unknown>> {
    const res = await http.post(
      `/api/v1/settlements/dossiers/${dossierId}/export`
    );
    return res.data;
  }

  async function downloadUrl(dossierId: string): Promise<string> {
    return `/api/v1/settlements/dossiers/${dossierId}/download`;
  }

  return {
    createDossier,
    listDossiers,
    getDossier,
    getRuleContext,
    collect,
    calculate,
    patchItem,
    refresh,
    confirm,
    exportDossier,
    downloadUrl,
  };
}

export const settlementApi = createSettlementApi(apiClient);
