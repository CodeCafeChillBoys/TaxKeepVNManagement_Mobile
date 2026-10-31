import type { OcrFormFill } from '../../types/ocr';

export const REGISTER_OCR_CITIZEN_ID_TAKEN =
  'Số căn cước công dân này đã được đăng ký.';

export type RegisterOcrApplyPlan = {
  fields: {
    fullName: string;
    citizenId: string;
    dateOfBirth: string;
    address: string;
  };
  citizenIdError?: string;
  alertTitle: string;
  alertMessage: string;
};

/** Kế hoạch điền form Đăng ký từ ocrResult (OCR-08). */
export function applyRegisterOcrResult(result: OcrFormFill): RegisterOcrApplyPlan {
  const plan: RegisterOcrApplyPlan = {
    fields: {
      fullName: result.fullName,
      citizenId: result.citizenId,
      dateOfBirth: result.dateOfBirth,
      address: result.address,
    },
    alertTitle: 'Đã điền thông tin từ căn cước công dân.',
    alertMessage: 'Vui lòng kiểm tra lại trước khi đăng ký.',
  };

  if (result.isAvailable === false) {
    plan.citizenIdError =
      result.warning?.trim() || REGISTER_OCR_CITIZEN_ID_TAKEN;
  }

  return plan;
}
