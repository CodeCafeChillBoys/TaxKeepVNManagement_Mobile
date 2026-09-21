/**

 * Pure helpers for SettlementResult (F3-FE-04).

 */

import { SETTLEMENT_LI04_DISCLAIMER } from './settlementReviewPlan';



export function getSettlementResultDisclaimer(): string {

  return SETTLEMENT_LI04_DISCLAIMER;

}



/** MVP: tạm tính không hiện CTA tải/khóa chính thức (Q-10). */

export function canShowPrimaryExport(status: string, isProvisional: boolean): boolean {

  if (isProvisional) return false;

  return status === 'LOCKED' || status === 'CONFIRMED';

}



export function formatDossierStatusLabel(status: string, isProvisional: boolean): string {

  if (isProvisional) return 'Tạm tính';

  const map: Record<string, string> = {

    DRAFT: 'Nháp',

    CALCULATED: 'Đã tính',

    CONFIRMED: 'Đã xác nhận',

    LOCKED: 'Đã khóa',

  };

  return map[status] ?? status;

}


