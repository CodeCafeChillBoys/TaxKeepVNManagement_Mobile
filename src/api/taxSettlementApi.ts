import { apiClient } from './apiClient';
import type { ApiResponse } from './authApi';
import type {
  TaxSettlementExportRequest,
  TaxSettlementListItem,
  TaxSettlementPreview,
  TaxSettlementPreviewRequest,
} from '../types/taxSettlement';

const BASE = '/api/v1/tax-settlements';

function unwrap<T>(res: { data: ApiResponse<T> }, fallbackMsg: string): T {
  const body = res.data;
  if (!body?.success || body.data === undefined || body.data === null) {
    throw new Error(body?.message || body?.errorCode || fallbackMsg);
  }
  return body.data;
}

export const taxSettlementApi = {
  /** POST /api/v1/tax-settlements/preview — xem trước, không lưu DB */
  async preview(request: TaxSettlementPreviewRequest): Promise<TaxSettlementPreview> {
    const res = await apiClient.post<ApiResponse<TaxSettlementPreview>>(`${BASE}/preview`, {
      taxYear: request.taxYear,
      cutoffDate: request.cutoffDate || null,
      charityDeduction: request.charityDeduction ?? 0,
    });
    return unwrap(res, 'Không tính được xem trước quyết toán.');
  },

  /** POST /api/v1/tax-settlements/export — chốt LOCKED */
  async export(request: TaxSettlementExportRequest): Promise<TaxSettlementPreview> {
    const res = await apiClient.post<ApiResponse<TaxSettlementPreview>>(`${BASE}/export`, {
      taxYear: request.taxYear,
      cutoffDate: request.cutoffDate || null,
      charityDeduction: request.charityDeduction ?? 0,
      selectedIncomeSourceIds: request.selectedIncomeSourceIds ?? null,
      note: request.note ?? null,
    });
    return unwrap(res, 'Không chốt được hồ sơ quyết toán.');
  },

  /** GET /api/v1/tax-settlements */
  async getList(): Promise<TaxSettlementListItem[]> {
    const res = await apiClient.get<ApiResponse<TaxSettlementListItem[]>>(BASE);
    return unwrap(res, 'Không tải được danh sách hồ sơ quyết toán.');
  },

  /** GET /api/v1/tax-settlements/{id} */
  async getById(id: string): Promise<TaxSettlementPreview> {
    const res = await apiClient.get<ApiResponse<TaxSettlementPreview>>(`${BASE}/${id}`);
    return unwrap(res, 'Không tải được chi tiết hồ sơ quyết toán.');
  },
};
