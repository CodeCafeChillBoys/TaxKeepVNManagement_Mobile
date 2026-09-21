import {
  buildTaxYearOptions,
  canSelectTaxYear,
  findContinuableDossier,
  mapSettlementCreateError,
  planStartSettlement,
} from './settlementHomePlan';

describe('settlementHomePlan (F3-FE-02)', () => {
  it('rejects future tax year', () => {
    expect(canSelectTaxYear(2099, 2026)).toBe(false);
    expect(planStartSettlement(2099, 2026)).toEqual({
      ok: false,
      message: expect.stringMatching(/tương lai/i),
    });
  });

  it('accepts current or past year', () => {
    expect(planStartSettlement(2026, 2026)).toEqual({ ok: true, taxYear: 2026 });
  });

  it('builds tax year options without future years', () => {
    expect(buildTaxYearOptions(2026, 3)).toEqual([2026, 2025, 2024]);
  });

  it('picks highest-version continuable dossier', () => {
    const picked = findContinuableDossier(
      [
        { id: 'a', taxYear: 2026, status: 'DRAFT', version: 1 },
        { id: 'b', taxYear: 2026, status: 'CALCULATED', version: 2 },
        { id: 'c', taxYear: 2025, status: 'DRAFT', version: 1 },
      ],
      2026
    );
    expect(picked?.id).toBe('b');
  });

  it('maps E-NO_DATA', () => {
    expect(
      mapSettlementCreateError({
        response: { data: { errors: { errorCode: 'E-NO_DATA' } } },
      })
    ).toMatch(/đơn vị chi trả|người phụ thuộc/i);
  });
});
