import {
  PERMISSION_LABELS,
  getPermissionLabel,
  extractPermissionCode,
  humanizePermissionMessage,
  isTaxPeriodLocked403,
  parseForbiddenError,
  onPermissionDenied,
  emitPermissionDenied,
  __resetPermissionToastCooldownForTest,
} from './permissionError';
import { toFriendlyError } from './friendlyError';
import { parseBackendError } from '../screens/expense/expenseValidationUtils';

describe('permissionError (403 Forbidden & RBAC Vietnamese mapping)', () => {
  beforeEach(() => {
    __resetPermissionToastCooldownForTest();
  });

  it('ánh xạ đầy đủ toàn bộ mã phân quyền BE (67 quyền) sang tiếng Việt rõ ràng', () => {
    const codes = Object.keys(PERMISSION_LABELS);
    expect(codes.length).toBeGreaterThanOrEqual(67);
    for (const code of codes) {
      const label = getPermissionLabel(code);
      expect(label).toBeTruthy();
      expect(label).not.toBe(code);
    }
    expect(getPermissionLabel('document.upload')).toContain('Tải lên');
    expect(getPermissionLabel('dependent.document_manage')).toContain('người phụ thuộc');
    expect(getPermissionLabel('settlement.export_pdf')).toContain('PDF');
    expect(getPermissionLabel('medical_category.view')).toContain('chi phí y tế');
    expect(getPermissionLabel('tax_chat.use')).toContain('Trợ lý thuế');
  });

  it('bóc tách và dịch đúng lỗi 403 từ BE HasPermissionAttribute', () => {
    const axios403 = {
      response: {
        status: 403,
        data: {
          success: false,
          message: 'Bạn không có quyền thực hiện tính năng này (Yêu cầu quyền: document.upload).',
          errors: { errorCode: 'FORBIDDEN' },
        },
      },
    };

    expect(extractPermissionCode(axios403)).toBe('document.upload');
    expect(isTaxPeriodLocked403(axios403)).toBe(false);

    const parsed = parseForbiddenError(axios403);
    expect(parsed).not.toBeNull();
    expect(parsed?.isPermissionDenied).toBe(true);
    expect(parsed?.isTaxPeriodLocked).toBe(false);
    expect(parsed?.title).toBe('Không có quyền truy cập');
    expect(parsed?.message).toContain('Tải lên hóa đơn, chứng từ thuế');
    expect(parsed?.message).not.toContain('document.upload');
  });

  it('phân biệt rõ 403 do thiếu quyền RBAC và 403 do kỳ tính thuế đã nộp/khóa', () => {
    const rbac403 = {
      response: {
        status: 403,
        data: {
          success: false,
          message: 'Bạn không có quyền thực hiện tính năng này (Yêu cầu quyền: tax_period.manage).',
          errors: { errorCode: 'FORBIDDEN' },
        },
      },
    };
    const locked403 = {
      response: {
        status: 403,
        data: {
          success: false,
          message: 'The tax filing for this year has already been submitted and is locked.',
          errors: { errorCode: 'FORBIDDEN' },
        },
      },
    };

    const rbacParsed = parseBackendError(rbac403);
    expect(rbacParsed.title).toBe('Không có quyền truy cập');
    expect(rbacParsed.message).toContain('Khởi tạo và cập nhật kỳ tính thuế');

    const lockedParsed = parseBackendError(locked403);
    expect(lockedParsed.title).toBe('Kỳ tính thuế đã khóa');
    expect(lockedParsed.message).toContain('đã hoàn tất quyết toán');
  });

  it('giữ câu tiếng Việt nghiệp vụ từ BE ForbiddenException và xử lý fallback cho 403 tiếng Anh', () => {
    const owner403 = {
      response: {
        status: 403,
        data: {
          success: false,
          message: 'Bạn không có quyền hủy lịch hẹn này.',
          errors: { errorCode: 'FORBIDDEN' },
        },
      },
    };
    expect(parseForbiddenError(owner403)?.message).toBe('Bạn không có quyền hủy lịch hẹn này.');

    const english403 = {
      response: {
        status: 403,
        data: { title: 'Forbidden', status: 403 },
      },
    };
    const friendly = toFriendlyError(english403);
    expect(friendly.title).toBe('Không có quyền truy cập');
    expect(friendly.message).toContain('không có quyền thực hiện');
    expect(friendly.message).not.toMatch(/forbidden/i);

    expect(
      humanizePermissionMessage('Không thể thực hiện (Yêu cầu quyền: booking.create).')
    ).toBe('Không thể thực hiện (Tìm kiếm chuyên gia và đặt lịch hẹn tư vấn thuế).');
  });

  it('phát sự kiện Toast toàn cục và chống spam lặp trong thời gian cooldown', () => {
    const received: string[] = [];
    const unsubscribe = onPermissionDenied((e) => received.push(e.message));

    const err1 = parseForbiddenError({
      response: {
        status: 403,
        data: {
          message: 'Bạn không có quyền thực hiện tính năng này (Yêu cầu quyền: income.view).',
          errors: { errorCode: 'FORBIDDEN' },
        },
      },
    })!;
    const err2 = parseForbiddenError({
      response: {
        status: 403,
        data: {
          message: 'Bạn không có quyền thực hiện tính năng này (Yêu cầu quyền: dependent.view).',
          errors: { errorCode: 'FORBIDDEN' },
        },
      },
    })!;

    emitPermissionDenied(err1);
    emitPermissionDenied(err1); // Trùng ngay lập tức -> bỏ qua
    emitPermissionDenied(err2); // Khác quyền -> vẫn phát

    unsubscribe();
    expect(received).toHaveLength(2);
    expect(received[0]).toContain('các khoản thu nhập');
    expect(received[1]).toContain('người phụ thuộc');
  });
});
