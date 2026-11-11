import { messageForErrorCode, pickApiErrorMessage } from './apiErrorCatalog';
import { toFriendlyErrorMessage } from './friendlyError';

describe('apiErrorCatalog', () => {
  it('đổi mã tiếng Anh sang câu tiếng Việt', () => {
    expect(messageForErrorCode('SLUG_ALREADY_EXISTS')).toContain('Mã gói');
    expect(messageForErrorCode('InvalidTaxYear')).toContain('Năm tính thuế');
  });

  it('giữ câu tiếng Việt của BE khi có số liệu cụ thể', () => {
    const be = 'Gói Standard chỉ hỗ trợ tối đa 3 người phụ thuộc (bạn hiện có 3).';
    expect(pickApiErrorMessage('DEPENDENT_LIMIT_EXCEEDED', be)).toBe(be);
  });

  it('không hiện nguyên mã khi BE không gửi câu tiếng Việt', () => {
    const message = toFriendlyErrorMessage({
      response: { status: 400, data: { errorCode: 'CANNOT_DELETE_BASIC_PLAN', message: 'Cannot delete basic plan.' } },
    });
    expect(message).toContain('Basic');
    expect(message).not.toContain('CANNOT_DELETE_BASIC_PLAN');
  });
});
