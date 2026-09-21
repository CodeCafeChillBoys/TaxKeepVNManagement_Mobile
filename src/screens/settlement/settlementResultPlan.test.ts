import {

  canShowPrimaryExport,

  formatDossierStatusLabel,

  getSettlementResultDisclaimer,

} from './settlementResultPlan';



describe('settlementResultPlan (F3-FE-04)', () => {

  it('returns LI-04 disclaimer', () => {

    expect(getSettlementResultDisclaimer()).toMatch(/tham khảo/i);

  });



  it('hides export for provisional', () => {

    expect(canShowPrimaryExport('LOCKED', true)).toBe(false);

  });



  it('shows export for locked non-provisional', () => {

    expect(canShowPrimaryExport('LOCKED', false)).toBe(true);

  });



  it('labels provisional as Tạm tính', () => {

    expect(formatDossierStatusLabel('CALCULATED', true)).toBe('Tạm tính');

  });

});

