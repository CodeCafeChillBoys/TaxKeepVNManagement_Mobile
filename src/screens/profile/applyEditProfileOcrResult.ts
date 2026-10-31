import type { OcrFormFill, ScanIdentitySource } from '../../types/ocr';

export type EditProfileOcrApplyPlan = {
  fields: {
    fullName: string;
    dateOfBirth: string;
    address: string;
  };
  alertTitle: string;
  alertMessage: string;
};

export type EditProfileScanParams = {
  source: Extract<ScanIdentitySource, 'editProfile'>;
  hasExistingData: true;
  lockedCitizenId: string;
};

/** Điền hồ sơ từ OCR — không gồm citizenId (ô khóa). */
export function applyEditProfileOcrResult(result: OcrFormFill): EditProfileOcrApplyPlan {
  return {
    fields: {
      fullName: result.fullName,
      dateOfBirth: result.dateOfBirth,
      address: result.address,
    },
    alertTitle: 'Đã điền thông tin từ căn cước công dân.',
    alertMessage: 'Vui lòng kiểm tra lại trước khi lưu hồ sơ.',
  };
}

/** Params mở ScanIdentity từ EditProfile. */
export function buildEditProfileScanParams(lockedCitizenId: string): EditProfileScanParams {
  return {
    source: 'editProfile',
    hasExistingData: true,
    lockedCitizenId,
  };
}
