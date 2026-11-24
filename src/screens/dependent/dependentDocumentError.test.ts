import {
  humanizeDocumentTypeCodes,
  parseDependentUploadError,
  findInitialPendingStepIndex,
  canNavigateToProofStep,
  areAllMandatoryStepsUploaded,
} from './dependentDocumentError';

describe('dependentDocumentError', () => {
  describe('humanizeDocumentTypeCodes', () => {
    it('replaces BE enum codes with clear Vietnamese document names', () => {
      const raw =
        "Loại giấy tờ tải lên không khớp. Bạn đang nộp minh chứng 'BIRTH_CERTIFICATE' nhưng ảnh là 'CITIZEN_ID'.";
      const result = humanizeDocumentTypeCodes(raw);
      expect(result).toContain('Giấy khai sinh');
      expect(result).toContain('Căn cước công dân');
      expect(result).not.toContain('BIRTH_CERTIFICATE');
      expect(result).not.toContain('CITIZEN_ID');
    });
  });

  describe('parseDependentUploadError', () => {
    it('maps DOC_TYPE_MISMATCH and humanizes enum codes', () => {
      const parsed = parseDependentUploadError({
        response: {
          status: 400,
          data: {
            errorCode: 'DOC_TYPE_MISMATCH',
            message:
              "Loại giấy tờ tải lên không khớp. Bạn đang nộp minh chứng 'STUDENT_CARD' nhưng ảnh là 'CCCD'.",
          },
        },
      });
      expect(parsed.code).toBe('DOC_TYPE_MISMATCH');
      expect(parsed.title).toBe('Sai loại giấy tờ minh chứng');
      expect(parsed.message).toContain('Thẻ sinh viên');
      expect(parsed.message).toContain('Căn cước công dân');
    });

    it('maps IDENTITY_MISMATCH and keeps exact Vietnamese mismatch detail from BE', () => {
      const msg =
        "Họ và tên trên giấy tờ ('NGUYỄN VĂN B') không trùng khớp với hồ sơ người phụ thuộc ('Phạm Minh').";
      const parsed = parseDependentUploadError({
        response: {
          status: 400,
          data: {
            errors: { errorCode: 'IDENTITY_MISMATCH' },
            message: msg,
          },
        },
      });
      expect(parsed.code).toBe('IDENTITY_MISMATCH');
      expect(parsed.title).toBe('Thông tin trên giấy tờ không khớp hồ sơ');
      expect(parsed.message).toBe(msg);
    });

    it('maps UNREADABLE_DOCUMENT cleanly', () => {
      const parsed = parseDependentUploadError({
        response: {
          status: 400,
          data: {
            errorCode: 'UNREADABLE_DOCUMENT',
            message: 'Ảnh giấy tờ không đạt chuẩn chất lượng (quá mờ hoặc lóa sáng): Ảnh bị mờ nhòe',
          },
        },
      });
      expect(parsed.code).toBe('UNREADABLE_DOCUMENT');
      expect(parsed.title).toBe('Ảnh giấy tờ chưa đủ rõ nét');
      expect(parsed.message).toContain('Ảnh bị mờ nhòe');
    });

    it('maps OCR_SERVICE_ERROR without leaking raw JSON from AI service', () => {
      const parsed = parseDependentUploadError({
        response: {
          status: 400,
          data: {
            errorCode: 'OCR_SERVICE_ERROR',
            message: 'Dịch vụ AI bóc tách thất bại: {"detail":"Internal error"}',
          },
        },
      });
      expect(parsed.code).toBe('OCR_SERVICE_ERROR');
      expect(parsed.message).not.toContain('{"detail"');
      expect(parsed.message).not.toContain('Internal error');
    });

    it('maps AI_CONNECTION_ERROR without leaking English exception details', () => {
      const parsed = parseDependentUploadError({
        response: {
          status: 400,
          data: {
            errorCode: 'AI_CONNECTION_ERROR',
            message: 'Không thể kết nối tới dịch vụ AI Service: Connection refused',
          },
        },
      });
      expect(parsed.code).toBe('AI_CONNECTION_ERROR');
      expect(parsed.message).not.toContain('Connection refused');
    });

    it('maps FILE_SIZE_EXCEEDED, INVALID_FILE_TYPE, FORBIDDEN, NOT_FOUND, TIMEOUT, and NETWORK', () => {
      expect(
        parseDependentUploadError({
          response: { status: 400, data: { errorCode: 'FILE_SIZE_EXCEEDED' } },
        }).title
      ).toContain('10MB');
      expect(
        parseDependentUploadError({
          response: { status: 400, data: { errorCode: 'INVALID_FILE_TYPE' } },
        }).code
      ).toBe('INVALID_FILE_TYPE');
      expect(
        parseDependentUploadError({ response: { status: 403, data: {} } }).code
      ).toBe('FORBIDDEN');
      expect(
        parseDependentUploadError({ response: { status: 404, data: {} } }).code
      ).toBe('NOT_FOUND');
      expect(
        parseDependentUploadError({ code: 'ECONNABORTED', message: 'timeout of 120000ms exceeded' }).code
      ).toBe('TIMEOUT');
      expect(
        parseDependentUploadError({ code: 'ERR_NETWORK', message: 'Network Error' }).code
      ).toBe('NETWORK_ERROR');
    });
  });

  describe('step navigation helpers', () => {
    const docs = [
      { key: 'a', isMandatory: true },
      { key: 'b', isMandatory: false },
      { key: 'c', isMandatory: true },
    ];

    it('finds first pending step and falls back to 0 when all uploaded', () => {
      expect(findInitialPendingStepIndex(docs, {})).toBe(0);
      expect(findInitialPendingStepIndex(docs, { a: true })).toBe(1);
      expect(findInitialPendingStepIndex(docs, { a: true, b: true, c: true })).toBe(0);
    });

    it('blocks jumping past an un-uploaded mandatory step but allows moving past uploaded or optional steps', () => {
      expect(canNavigateToProofStep(1, docs, {})).toBe(false);
      expect(canNavigateToProofStep(1, docs, { a: true })).toBe(true);
      expect(canNavigateToProofStep(2, docs, { a: true })).toBe(true);
    });

    it('checks whether all mandatory steps are complete', () => {
      expect(areAllMandatoryStepsUploaded(docs, { a: true })).toBe(false);
      // Không được báo "Đủ hồ sơ" khi bước bắt buộc còn thiếu dù server trả isProfileComplete=true
      expect(areAllMandatoryStepsUploaded(docs, { a: true }, true)).toBe(false);
      expect(areAllMandatoryStepsUploaded(docs, { a: true, c: true })).toBe(true);
      expect(areAllMandatoryStepsUploaded([], {}, true)).toBe(true);
    });
  });
});
