import type { AxiosInstance, AxiosRequestConfig } from 'axios';
import { apiClient } from './apiClient';
import type { OcrImagePart } from './ocrApi';
import {
  IncomeCompanyGroup,
  IncomeMonthItem,
  IncomeUpsertRequest,
  PayslipOcrData,
} from '../types/income';

/**
 * Thu nhập theo tháng — BE `api/v1/incomes` + OCR phiếu lương `api/v1/ocr/incomes/direct-extractions`.
 * Khác `incomeSourceApi` (mỗi nơi chi trả 1 dòng/năm, quyết toán hiện đang dùng).
 */
export function createIncomeApi(http: AxiosInstance) {
  async function getMyIncomes(year: number): Promise<IncomeCompanyGroup[]> {
    const res = await http.get('/api/v1/incomes/my-incomes', { params: { year } });
    return res.data?.data ?? [];
  }

  async function getById(id: string): Promise<IncomeMonthItem> {
    const res = await http.get(`/api/v1/incomes/${id}`);
    return res.data?.data;
  }

  async function create(body: IncomeUpsertRequest): Promise<IncomeMonthItem> {
    const res = await http.post('/api/v1/incomes', body);
    return res.data?.data;
  }

  async function update(id: string, body: IncomeUpsertRequest): Promise<IncomeMonthItem> {
    const res = await http.put(`/api/v1/incomes/${id}`, body);
    return res.data?.data;
  }

  async function remove(id: string): Promise<void> {
    await http.delete(`/api/v1/incomes/${id}`);
  }

  /**
   * OCR phiếu lương. Response bị bọc 2 lớp:
   * ApiResponse { data: AI response { success, statusCode, message, data: PayslipOcrData } }.
   * Ảnh được BE lưu lên storage khi OCR thành công → `payslipFileUrl` có sẵn trong kết quả.
   */
  async function extractPayslip(
    file: OcrImagePart,
    targetMonth?: number,
    targetYear?: number,
    signal?: AbortSignal
  ): Promise<PayslipOcrData> {
    const form = new FormData();
    form.append('File', {
      uri: file.uri,
      name: file.name ?? 'payslip.jpg',
      type: file.type ?? 'image/jpeg',
    } as unknown as Blob);
    if (targetMonth) form.append('TargetMonth', String(targetMonth));
    if (targetYear) form.append('TargetYear', String(targetYear));

    const config: AxiosRequestConfig = {
      // Gemini OCR thường 20–60s; mặc định apiClient chỉ 15s
      timeout: 120000,
      signal,
      headers: { 'Content-Type': undefined as unknown as string },
    };
    const res = await http.post('/api/v1/ocr/incomes/direct-extractions', form, config);

    const inner = res.data?.data;
    if (inner && inner.success === false) {
      throw new Error(inner.message || 'Không bóc tách được phiếu lương.');
    }
    const data = inner?.data as PayslipOcrData | null | undefined;
    if (!data) {
      throw new Error('Không đọc được dữ liệu từ ảnh phiếu lương. Vui lòng chụp rõ hơn hoặc nhập tay.');
    }
    return data;
  }

  return { getMyIncomes, getById, create, update, remove, extractPayslip };
}

export const incomeApi = createIncomeApi(apiClient);
