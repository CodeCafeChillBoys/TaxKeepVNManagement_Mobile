import { apiClient } from './apiClient';

export interface IncomeSourceItem {
  id: string;
  taxpayerId: string;
  companyName: string;
  companyTaxCode: string;
  companyTaxId?: string;
  taxYear: number;
  totalIncome: number;
  taxWithheld: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface IncomeSourceListResponse {
  items: IncomeSourceItem[];
  pagination: PaginationMeta;
}

export interface IncomeSourceSummaryDto {
  taxYear: number;
  totalIncome: number;
  totalTaxWithheld: number;
  totalSources: number;
}

export interface IncomeSourceCreateDto {
  companyName: string;
  companyTaxCode: string;
  companyTaxId?: string;
  taxYear: number;
  totalIncome: number;
  taxWithheld: number;
}

export interface IncomeSourceUpdateDto {
  companyName: string;
  companyTaxCode: string;
  companyTaxId?: string;
  taxYear: number;
  totalIncome: number;
  taxWithheld: number;
  isActive?: boolean;
}

export interface QueryParameters {
  page?: number;
  size?: number;
  search?: string;
  sort?: string;
  taxYear?: number;
  isActive?: boolean;
}

/** Body POST /api/v1/income-sources/cross-check — số liệu trên chứng từ khấu trừ */
export interface IncomeSourceCrossCheckRequest {
  companyName: string;
  taxYear: number;
  certificateTotalIncome: number;
  certificateTaxWithheld: number;
  certificateInsuranceDeducted: number;
}

/** Kết quả đối chiếu chứng từ với tổng thu nhập theo tháng (bảng incomes) */
export interface IncomeSourceCrossCheckResult {
  isMatch: boolean;
  summedTotalIncome: number;
  summedTaxWithheld: number;
  summedInsuranceDeducted: number;
  diffTotalIncome: number;
  diffTaxWithheld: number;
  diffInsuranceDeducted: number;
  mismatchMessages: string[];
}

export const incomeSourceApi = {
  // Lấy danh sách nơi chi trả thu nhập
  async getAll(params?: QueryParameters): Promise<IncomeSourceListResponse> {
    try {
      const response = await apiClient.get('/api/v1/income-sources', { params });
      return response.data?.data || response.data;
    } catch (err: any) {
      console.warn('incomeSourceApi.getAll error:', err?.response?.data || err?.message);
      return {
        items: [],
        pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 1 },
      };
    }
  },

  // Lấy bảng tổng hợp thu nhập theo năm tính thuế
  async getSummary(taxYear: number = 2026): Promise<IncomeSourceSummaryDto> {
    try {
      const response = await apiClient.get('/api/v1/income-sources/summary', {
        params: { taxYear },
      });
      return response.data?.data || response.data;
    } catch (err: any) {
      console.warn('incomeSourceApi.getSummary error:', err?.response?.data || err?.message);
      return {
        taxYear,
        totalIncome: 0,
        totalTaxWithheld: 0,
        totalSources: 0,
      };
    }
  },

  // Lấy thông tin chi tiết một nơi chi trả theo ID
  async getById(id: string): Promise<IncomeSourceItem> {
    const response = await apiClient.get(`/api/v1/income-sources/${id}`);
    return response.data?.data || response.data;
  },

  // Khai báo nơi chi trả thu nhập mới
  async create(dto: IncomeSourceCreateDto): Promise<IncomeSourceItem> {
    const response = await apiClient.post('/api/v1/income-sources', dto);
    return response.data?.data || response.data;
  },

  // Cập nhật thông tin nơi chi trả thu nhập
  async update(id: string, dto: IncomeSourceUpdateDto): Promise<IncomeSourceItem> {
    const response = await apiClient.put(`/api/v1/income-sources/${id}`, dto);
    return response.data?.data || response.data;
  },

  // Xóa nơi chi trả thu nhập
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/v1/income-sources/${id}`);
  },

  // Đối chiếu số trên chứng từ khấu trừ với tổng thu nhập các tháng đã nhập (chỉ đọc, không lưu)
  async crossCheck(dto: IncomeSourceCrossCheckRequest): Promise<IncomeSourceCrossCheckResult> {
    const response = await apiClient.post('/api/v1/income-sources/cross-check', dto);
    return response.data?.data || response.data;
  },
};
