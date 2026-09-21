import {

  canConfirmSettlement,

  shouldAutoPrepareOnLoad,

} from './settlementReviewPlan';



describe('settlementReviewPlan (F3-FE-03)', () => {

  it('blocks confirm when stale', () => {

    expect(

      canConfirmSettlement({

        commitmentAccepted: true,

        isStale: true,

      })

    ).toEqual({ ok: false, message: expect.stringMatching(/Làm mới/i) });

  });



  it('blocks confirm without commitment', () => {

    expect(

      canConfirmSettlement({

        commitmentAccepted: false,

        isStale: false,

      })

    ).toEqual({ ok: false, message: expect.stringMatching(/cam kết/i) });

  });



  it('blocks confirm when payer not declared', () => {

    expect(

      canConfirmSettlement({

        commitmentAccepted: true,

        isStale: false,

        blockingWarningCodes: ['W-PAYER_NOT_DECLARED'],

      })

    ).toEqual({ ok: false, message: expect.stringMatching(/chi trả/i) });

  });



  it('allows confirm when valid', () => {

    expect(

      canConfirmSettlement({

        commitmentAccepted: true,

        isStale: false,

        blockingWarningCodes: ['W-INCOME_DOC_MISSING'],

      })

    ).toEqual({ ok: true });

  });



  it('auto-prepare only for DRAFT', () => {

    expect(shouldAutoPrepareOnLoad('DRAFT')).toBe(true);

    expect(shouldAutoPrepareOnLoad('CALCULATED')).toBe(false);

  });

});

