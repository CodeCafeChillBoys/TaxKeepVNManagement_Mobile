/**

 * Pure helpers for SettlementReview (F3-FE-03).

 */

export const SETTLEMENT_LI04_DISCLAIMER =

  'Kết quả trên chỉ mang tính tham khảo, không thay thế quyết định của cơ quan thuế. Vui lòng đối chiếu trên cổng thuế điện tử (eTax) trước khi nộp hồ sơ chính thức.';



export const BLOCKING_WARNING_CODES = ['W-PAYER_NOT_DECLARED', 'W-STALE'] as const;



export type CanConfirmInput = {

  commitmentAccepted: boolean;

  isStale: boolean;

  blockingWarningCodes?: string[];

};



export type CanConfirmPlan =

  | { ok: true }

  | { ok: false; message: string };



export function canConfirmSettlement(input: CanConfirmInput): CanConfirmPlan {

  if (input.isStale) {

    return {

      ok: false,

      message: 'Dữ liệu hồ sơ đã thay đổi. Vui lòng bấm Làm mới trước khi xác nhận.',

    };

  }

  const blockers = input.blockingWarningCodes ?? [];

  if (blockers.includes('W-PAYER_NOT_DECLARED')) {

    return {

      ok: false,

      message: 'Còn đơn vị chi trả chưa khai báo. Vui lòng bổ sung tại mục Nơi chi trả thu nhập.',

    };

  }

  if (!input.commitmentAccepted) {

    return {

      ok: false,

      message: 'Vui lòng tick cam kết nội dung quyết toán trước khi xác nhận.',

    };

  }

  return { ok: true };

}



/** Nháp mới cần collect → calculate (orchestration PRD). */

export function shouldAutoPrepareOnLoad(status: string): boolean {

  return status === 'DRAFT';

}


