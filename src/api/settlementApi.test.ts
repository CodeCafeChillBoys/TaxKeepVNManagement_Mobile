import type { AxiosInstance } from 'axios';

jest.mock('./apiClient', () => ({
  apiClient: { post: jest.fn(), get: jest.fn(), patch: jest.fn() },
}));

import { createSettlementApi } from './settlementApi';

function createHttpMock() {
  return {
    post: jest.fn(),
    get: jest.fn(),
    patch: jest.fn(),
  } as unknown as AxiosInstance & {
    post: jest.Mock;
    get: jest.Mock;
    patch: jest.Mock;
  };
}

describe('settlementApi (F3-FE-01)', () => {
  it('POSTs create dossier to /api/v1/settlements/dossiers', async () => {
    const http = createHttpMock();
    const body = {
      success: true,
      message: 'ok',
      data: { id: 'd1', taxYear: 2026, version: 1, status: 'DRAFT', isStale: false, isProvisional: true },
    };
    http.post.mockResolvedValue({ data: body });

    const api = createSettlementApi(http);
    const result = await api.createDossier({ taxYear: 2026 });

    expect(result).toEqual(body);
    expect(http.post).toHaveBeenCalledWith('/api/v1/settlements/dossiers', {
      taxYear: 2026,
    });
  });

  it('GETs rule-context for dossier', async () => {
    const http = createHttpMock();
    const id = 'dossier-uuid';
    const body = {
      success: true,
      message: 'ok',
      data: { documentNumber: 'QD-2026', cutOffDate: '2026-12-31', pdfUrl: '/pdf' },
    };
    http.get.mockResolvedValue({ data: body });
    const api = createSettlementApi(http);
    const result = await api.getRuleContext(id);
    expect(result).toEqual(body);
    expect(http.get).toHaveBeenCalledWith(
      `/api/v1/settlements/dossiers/${id}/rule-context`
    );
  });

  it('GETs list with taxYear query', async () => {
    const http = createHttpMock();
    http.get.mockResolvedValue({ data: { success: true, message: 'ok', data: [] } });
    const api = createSettlementApi(http);
    await api.listDossiers(2026);
    expect(http.get).toHaveBeenCalledWith('/api/v1/settlements/dossiers', {
      params: { taxYear: 2026 },
    });
  });

  it('POSTs collect/calculate/confirm/export and PATCHes item', async () => {
    const http = createHttpMock();
    http.post.mockResolvedValue({ data: { success: true, data: {} } });
    http.patch.mockResolvedValue({ data: { success: true, data: {} } });
    const api = createSettlementApi(http);
    const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

    await api.collect(id);
    await api.calculate(id);
    await api.confirm(id, { commitmentAccepted: true });
    await api.exportDossier(id);
    await api.patchItem(id, 'item-1', { isIncluded: false, excludeReason: 'privacy' });

    expect(http.post.mock.calls.map((c) => c[0])).toEqual([
      `/api/v1/settlements/dossiers/${id}/collect`,
      `/api/v1/settlements/dossiers/${id}/calculate`,
      `/api/v1/settlements/dossiers/${id}/confirm`,
      `/api/v1/settlements/dossiers/${id}/export`,
    ]);
    expect(http.patch).toHaveBeenCalledWith(
      `/api/v1/settlements/dossiers/${id}/items/item-1`,
      { isIncluded: false, excludeReason: 'privacy' }
    );
  });
});
