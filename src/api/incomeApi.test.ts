import type { AxiosInstance } from 'axios';

jest.mock('./apiClient', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

import { createIncomeApi } from './incomeApi';

function createHttpMock() {
  return {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  } as unknown as AxiosInstance & { get: jest.Mock; post: jest.Mock; put: jest.Mock; delete: jest.Mock };
}

const month = {
  id: 'm1',
  userId: 'u1',
  organizationName: 'Công ty A',
  taxIdNumber: '0100109106',
  month: 3,
  year: 2026,
  totalTaxableIncome: 30_000_000,
  insuranceDeducted: 3_150_000,
  taxAlreadyDeducted: 1_200_000,
  payslipFileUrl: null,
  createdAt: '2026-04-01T00:00:00Z',
};

describe('incomeApi', () => {
  it('getMyIncomes GETs my-incomes theo năm và trả mảng nhóm', async () => {
    const http = createHttpMock();
    const groups = [{ organizationName: 'Công ty A', taxIdNumber: '0100109106', totalIncomeCompany: 30_000_000, details: [month] }];
    http.get.mockResolvedValue({ data: { success: true, data: groups } });

    const result = await createIncomeApi(http).getMyIncomes(2026);

    expect(http.get).toHaveBeenCalledWith('/api/v1/incomes/my-incomes', { params: { year: 2026 } });
    expect(result).toEqual(groups);
  });

  it('getMyIncomes trả mảng rỗng khi data null', async () => {
    const http = createHttpMock();
    http.get.mockResolvedValue({ data: { success: true, data: null } });
    await expect(createIncomeApi(http).getMyIncomes(2026)).resolves.toEqual([]);
  });

  it('create POSTs body và trả bản ghi', async () => {
    const http = createHttpMock();
    http.post.mockResolvedValue({ data: { success: true, data: month } });
    const body = {
      organizationName: 'Công ty A',
      taxIdNumber: '0100109106',
      month: 3,
      year: 2026,
      totalTaxableIncome: 30_000_000,
      insuranceDeducted: 3_150_000,
      taxAlreadyDeducted: 1_200_000,
      payslipFileUrl: null,
    };
    await expect(createIncomeApi(http).create(body)).resolves.toEqual(month);
    expect(http.post).toHaveBeenCalledWith('/api/v1/incomes', body);
  });

  it('update PUTs theo id', async () => {
    const http = createHttpMock();
    http.put.mockResolvedValue({ data: { success: true, data: month } });
    await createIncomeApi(http).update('m1', { ...month });
    expect(http.put.mock.calls[0][0]).toBe('/api/v1/incomes/m1');
  });

  it('remove DELETEs theo id', async () => {
    const http = createHttpMock();
    http.delete.mockResolvedValue({ status: 204 });
    await createIncomeApi(http).remove('m1');
    expect(http.delete).toHaveBeenCalledWith('/api/v1/incomes/m1');
  });

  describe('extractPayslip', () => {
    const file = { uri: 'file:///p.jpg', name: 'p.jpg', type: 'image/jpeg' };

    it('gửi multipart (File, TargetMonth, TargetYear) và bóc 2 lớp envelope', async () => {
      const http = createHttpMock();
      const ocr = { ...month, payslipFileUrl: 'https://x/p.jpg', thresholdValidation: { lowConfidenceFields: [] } };
      http.post.mockResolvedValue({
        data: { success: true, message: 'OK', data: { success: true, statusCode: 200, message: 'Bóc tách thành công', data: ocr } },
      });

      const result = await createIncomeApi(http).extractPayslip(file, 3, 2026);

      const [url, form, cfg] = http.post.mock.calls[0];
      expect(url).toBe('/api/v1/ocr/incomes/direct-extractions');
      expect(form).toBeInstanceOf(FormData);
      expect(cfg.timeout).toBeGreaterThanOrEqual(60000);
      expect(result).toEqual(ocr);
    });

    it('báo lỗi khi AI trả success=false ở lớp trong', async () => {
      const http = createHttpMock();
      http.post.mockResolvedValue({
        data: { success: true, data: { success: false, statusCode: 422, message: 'Không phải phiếu lương', data: null } },
      });
      await expect(createIncomeApi(http).extractPayslip(file)).rejects.toThrow('Không phải phiếu lương');
    });

    it('báo lỗi khi không có dữ liệu', async () => {
      const http = createHttpMock();
      http.post.mockResolvedValue({ data: { success: true, data: { success: true, data: null } } });
      await expect(createIncomeApi(http).extractPayslip(file)).rejects.toThrow(/Không đọc được/);
    });
  });
});
