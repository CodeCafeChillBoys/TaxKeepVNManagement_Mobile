/**
 * Ánh xạ toàn bộ mã phân quyền (RBAC Permission Codes) và lỗi 403 Forbidden từ Backend
 * sang thông báo tiếng Việt thân thiện, đồng thời phát sự kiện Toast dùng chung toàn app.
 *
 * Nguồn tham chiếu BE:
 * - TaxKeepVN.Infrastructure/Migrations/Seed/seed_permissions.sql (65 quyền hệ thống)
 * - MedicalEligibleCategoryController.cs (medical_category.view, admin.medical_category.manage)
 * - Attributes/HasPermissionAttribute.cs (403 + "Yêu cầu quyền: {permission}")
 * - Middlewares/GlobalExceptionMiddleware.cs (ForbiddenException -> 403 FORBIDDEN)
 */

export const PERMISSION_LABELS: Record<string, string> = {
  // ── Quyết toán thuế TNCN ──────────────────────────────────────────────────
  'settlement.view': 'Xem hồ sơ và kết quả quyết toán thuế',
  'settlement.calculate': 'Tính toán và dự thảo quyết toán thuế TNCN',
  'settlement.confirm': 'Xác nhận và lưu hồ sơ quyết toán chính thức',
  'settlement.export_pdf': 'Xuất tờ khai quyết toán mẫu 02/QTT-TNCN ra PDF',
  'settlement.export_package': 'Đóng gói hồ sơ quyết toán và chứng từ gốc (ZIP)',
  'settlement.policy_manage': 'Cập nhật bậc thuế lũy tiến và chính sách giảm trừ',
  'settlement.schedule_manage': 'Quản lý hạn chót và lịch nhắc nhở quyết toán',

  // ── Kỳ tính thuế & Chứng từ ───────────────────────────────────────────────
  'tax_period.view': 'Xem danh sách kỳ tính thuế và tài liệu đính kèm',
  'tax_period.manage': 'Khởi tạo và cập nhật kỳ tính thuế',
  'tax_period.submit': 'Nộp hồ sơ quyết toán kỳ tính thuế',
  'document.upload': 'Tải lên hóa đơn, chứng từ thuế (ảnh/PDF)',
  'document.view': 'Xem danh sách và chi tiết hóa đơn, chứng từ thuế',
  'document.delete': 'Xóa chứng từ thuế trong kỳ',
  'document.review': 'Kiểm tra và xác nhận thông tin chứng từ thuế',
  'document.ocr': 'Nhận diện và trích xuất thông tin chứng từ tự động',
  'medical_category.view': 'Xem danh mục chi phí y tế được giảm trừ',
  'admin.medical_category.manage': 'Quản trị danh mục chi phí y tế được giảm trừ',

  // ── Người phụ thuộc ───────────────────────────────────────────────────────
  'dependent.view': 'Xem danh sách và chi tiết người phụ thuộc',
  'dependent.manage': 'Thêm mới, cập nhật và xóa người phụ thuộc',
  'dependent.document_manage': 'Tải lên và quản lý giấy tờ chứng minh người phụ thuộc',
  'dependent.reminder_view': 'Xem cảnh báo và nhắc nhở mốc tuổi người phụ thuộc',
  'dependent.rule_manage': 'Quản lý danh mục quy định giấy tờ người phụ thuộc',

  // ── Quản lý thu nhập ──────────────────────────────────────────────────────
  'income.view': 'Xem danh sách và chi tiết các khoản thu nhập',
  'income.manage': 'Thêm mới, cập nhật và xóa khoản thu nhập cá nhân',
  'income_source.manage': 'Quản lý danh mục nguồn thu nhập',

  // ── Tư vấn & Lịch hẹn ─────────────────────────────────────────────────────
  'booking.create': 'Tìm kiếm chuyên gia và đặt lịch hẹn tư vấn thuế',
  'booking.view': 'Xem danh sách và chi tiết lịch hẹn tư vấn',
  'booking.cancel': 'Hủy lịch hẹn tư vấn theo chính sách hoàn tiền',
  'consultation.join': 'Tham gia phòng họp tư vấn trực tuyến',
  'consultation.complete': 'Xác nhận hoàn thành buổi tư vấn thuế',
  'review.create': 'Đánh giá và nhận xét chất lượng buổi tư vấn',
  'review.view': 'Xem danh sách đánh giá công khai của chuyên gia',

  // ── Nghiệp vụ Chuyên gia ──────────────────────────────────────────────────
  'expert.apply': 'Nộp hồ sơ đăng ký trở thành chuyên gia tư vấn',
  'expert.slot_manage': 'Quản lý khung giờ nhận lịch tư vấn',
  'expert.booking_manage': 'Tiếp nhận, chấp nhận hoặc từ chối lịch hẹn từ khách hàng',
  'expert.review_reply': 'Phản hồi đánh giá của khách hàng',
  'expert.wallet_view': 'Xem ví thu nhập chuyên gia và quỹ chờ giải ngân',
  'expert.withdraw': 'Yêu cầu rút tiền từ ví thu nhập về tài khoản ngân hàng',

  // ── Khiếu nại & Tranh chấp ────────────────────────────────────────────────
  'dispute.create': 'Gửi khiếu nại buổi tư vấn và yêu cầu bồi hoàn',
  'dispute.view': 'Xem chi tiết khiếu nại và tiến trình xử lý',
  'dispute.expert_respond': 'Chuyên gia gửi giải trình về khiếu nại',
  'dispute.admin_resolve': 'Quản trị viên phân xử khiếu nại và quyết định hoàn tiền',

  // ── Ví điện tử & Thanh toán ───────────────────────────────────────────────
  'wallet.view': 'Xem số dư ví và lịch sử biến động số dư',
  'wallet.topup': 'Nạp tiền vào ví qua cổng thanh toán',
  'wallet.user_withdraw': 'Yêu cầu rút tiền từ ví cá nhân về tài khoản ngân hàng',
  'payment.pay': 'Thanh toán lịch hẹn tư vấn qua cổng thanh toán hoặc ví',
  'admin.withdrawal_manage': 'Quản trị viên duyệt và xử lý lệnh rút tiền',

  // ── Gói dịch vụ ───────────────────────────────────────────────────────────
  'subscription.view': 'Xem thông tin gói dịch vụ và gói đang sử dụng',
  'subscription.purchase': 'Đăng ký mua hoặc nâng cấp gói dịch vụ',
  'admin.subscription_plan.manage': 'Quản trị danh mục gói dịch vụ',
  'admin.user_subscription.manage': 'Quản trị thuê bao người dùng',

  // ── Trợ lý AI & Tri thức thuế ─────────────────────────────────────────────
  'tax_chat.use': 'Đặt câu hỏi và nhận tư vấn từ Trợ lý thuế',
  'admin.ai_key.manage': 'Quản trị khóa kết nối hệ thống AI',
  'admin.prompt_template.manage': 'Quản trị mẫu hướng dẫn hệ thống AI',
  'admin.tax_rule.manage': 'Quản trị tài liệu và quy tắc luật thuế',

  // ── Quản trị Chuyên gia ───────────────────────────────────────────────────
  'admin.expert_app.view': 'Xem danh sách hồ sơ đăng ký chuyên gia tư vấn',
  'admin.expert_app.audit': 'Thẩm định và phê duyệt hồ sơ chuyên gia',
  'admin.specialization.manage': 'Quản trị danh mục lĩnh vực chuyên môn thuế',
  'admin.fee_config.manage': 'Cấu hình bảng phí tư vấn chuẩn',
  'admin.certificate_config.manage': 'Cấu hình danh mục loại chứng chỉ chuyên gia',
  'admin.search_config.manage': 'Cấu hình tìm kiếm và xếp hạng chuyên gia',
  'admin.platform_policy.manage': 'Cấu hình chính sách nền tảng',

  // ── Hệ thống & Cấu hình ───────────────────────────────────────────────────
  'admin.role_permission.manage': 'Quản trị vai trò và phân quyền tính năng',
  'admin.system_config.manage': 'Quản trị cấu hình tham số hệ thống',
  'admin.url_rule.manage': 'Quản trị quy tắc kiểm tra đường dẫn an toàn',
  'admin.review.moderate': 'Kiểm duyệt đánh giá người dùng',
  'admin.notification.manage': 'Quản trị và gửi thông báo hệ thống',
};

export interface PermissionDeniedError {
  isPermissionDenied: boolean;
  isTaxPeriodLocked: boolean;
  permissionCode?: string;
  permissionName?: string;
  title: string;
  message: string;
}

const VIETNAMESE_CHAR_REGEX =
  /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

const PERMISSION_IN_MESSAGE_REGEX =
  /(?:yêu\s*cầu\s*quyền|required\s*permission|missing\s*permission)\s*[:\-]?\s*['"`]?([a-z0-9_]+(?:\.[a-z0-9_]+)+)['"`]?/i;

export function getPermissionLabel(code?: string | null): string | null {
  if (!code) return null;
  const normalized = code.trim().toLowerCase();
  return PERMISSION_LABELS[normalized] || null;
}

/**
 * Thay thế mọi mã quyền tiếng Anh dạng `document.upload` nhúng trong câu thông báo của BE
 * sang mô tả tiếng Việt thân thiện.
 */
export function humanizePermissionMessage(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(
      /\(\s*(?:Yêu cầu quyền|Required permission)\s*:\s*([a-z0-9_.]+)\s*\)/gi,
      (_full, code: string) => {
        const label = getPermissionLabel(code);
        return label ? `(${label})` : '';
      }
    )
    .replace(/\b([a-z0-9_]+(?:\.[a-z0-9_]+)+)\b/gi, (token) => {
      const label = getPermissionLabel(token);
      return label || token;
    })
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+\./g, '.')
    .trim();
}

function extractRawDataAndMessage(err: any): {
  status?: number;
  errorCode: string;
  rawMessage: string;
  explicitPermission?: string;
} {
  const status: number | undefined = err?.response?.status ?? err?.status;
  let data = err?.response?.data;

  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        data = JSON.parse(trimmed);
      } catch {
        // giữ nguyên chuỗi
      }
    }
  }

  const errorCode = String(
    (data && typeof data === 'object' ? data.errorCode || data.errors?.errorCode || data.code : '') ||
      err?.errorCode ||
      ''
  )
    .trim()
    .toUpperCase();

  const rawMessage = String(
    (data && typeof data === 'object' ? data.message || data.detail || data.title : '') ||
      (typeof data === 'string' ? data : '') ||
      err?.message ||
      ''
  ).trim();

  const explicitPermission =
    data && typeof data === 'object'
      ? data.permission || data.requiredPermission || data.errors?.permission || undefined
      : undefined;

  return { status, errorCode, rawMessage, explicitPermission };
}

export function extractPermissionCode(err: any): string | undefined {
  const { rawMessage, explicitPermission } = extractRawDataAndMessage(err);
  if (typeof explicitPermission === 'string' && explicitPermission.trim()) {
    return explicitPermission.trim().toLowerCase();
  }
  const match = rawMessage.match(PERMISSION_IN_MESSAGE_REGEX);
  if (match?.[1]) {
    return match[1].trim().toLowerCase();
  }
  return undefined;
}

export function isTaxPeriodLocked403(err: any): boolean {
  const { status, errorCode, rawMessage } = extractRawDataAndMessage(err);
  if (errorCode === 'ERR_TAX_PERIOD_LOCKED') return true;
  if (status !== 403 && errorCode !== 'FORBIDDEN') return false;
  // Nếu là lỗi thiếu quyền RBAC thì tuyệt đối không coi là kỳ thuế đã khóa
  if (PERMISSION_IN_MESSAGE_REGEX.test(rawMessage)) return false;
  const lower = rawMessage.toLowerCase();
  return (
    (lower.includes('tax filing') && (lower.includes('submitted') || lower.includes('locked'))) ||
    (lower.includes('kỳ tính thuế') && (lower.includes('đã nộp') || lower.includes('đã khóa'))) ||
    (lower.includes('hồ sơ quyết toán') && lower.includes('đã khóa'))
  );
}

/**
 * Phân tích lỗi 403 Forbidden / FORBIDDEN từ Backend thành tiêu đề + thông báo tiếng Việt rõ ràng.
 * Trả về `null` nếu lỗi không phải 403/FORBIDDEN.
 */
export function parseForbiddenError(err: any): PermissionDeniedError | null {
  if (!err) return null;

  // Tái sử dụng kết quả đã phân tích từ apiClient interceptor nếu có
  if (err.permissionError && typeof err.permissionError === 'object') {
    return err.permissionError as PermissionDeniedError;
  }

  const { status, errorCode, rawMessage } = extractRawDataAndMessage(err);
  if (status !== 403 && errorCode !== 'FORBIDDEN') {
    return null;
  }

  // 1. Trường hợp 403 do kỳ tính thuế đã nộp và khóa (TaxPeriodService)
  if (isTaxPeriodLocked403(err)) {
    return {
      isPermissionDenied: false,
      isTaxPeriodLocked: true,
      title: 'Kỳ tính thuế đã khóa',
      message:
        'Hồ sơ kỳ tính thuế này đã hoàn tất quyết toán và nộp cho cơ quan thuế. Bạn không thể thêm hoặc chỉnh sửa chứng từ.',
    };
  }

  // 2. Trường hợp 403 do thiếu quyền RBAC ([HasPermission("...")])
  const permissionCode = extractPermissionCode(err);
  if (permissionCode) {
    const permissionName = getPermissionLabel(permissionCode) || undefined;
    return {
      isPermissionDenied: true,
      isTaxPeriodLocked: false,
      permissionCode,
      permissionName,
      title: 'Không có quyền truy cập',
      message: permissionName
        ? `Tài khoản của bạn chưa được cấp quyền: ${permissionName}. Vui lòng liên hệ quản trị viên.`
        : 'Tài khoản của bạn chưa được cấp quyền thực hiện tính năng này. Vui lòng liên hệ quản trị viên.',
    };
  }

  // 3. Trường hợp 403 từ ForbiddenException có sẵn câu tiếng Việt nghiệp vụ (sở hữu dữ liệu, vai trò chuyên gia/admin...)
  if (rawMessage && VIETNAMESE_CHAR_REGEX.test(rawMessage)) {
    const cleaned = humanizePermissionMessage(rawMessage);
    if (cleaned) {
      return {
        isPermissionDenied: true,
        isTaxPeriodLocked: false,
        title: 'Không có quyền thực hiện',
        message: cleaned,
      };
    }
  }

  // 4. Fallback cho mọi 403 tiếng Anh hoặc không có body (VD: ASP.NET default 403)
  return {
    isPermissionDenied: true,
    isTaxPeriodLocked: false,
    title: 'Không có quyền truy cập',
    message:
      'Tài khoản của bạn không có quyền thực hiện thao tác này. Vui lòng liên hệ quản trị viên nếu cần hỗ trợ.',
  };
}

// ── Event bus dùng chung để ToastProvider tự động hiển thị toast khi BE trả 403 ──
type PermissionDeniedListener = (err: PermissionDeniedError) => void;
const listeners = new Set<PermissionDeniedListener>();

const TOAST_COOLDOWN_MS = 3000;
let lastEmitKey = '';
let lastEmitTime = 0;

export function onPermissionDenied(fn: PermissionDeniedListener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function emitPermissionDenied(err: PermissionDeniedError): void {
  const now = Date.now();
  const key = `${err.title}|${err.permissionCode || err.message}`;
  if (key === lastEmitKey && now - lastEmitTime < TOAST_COOLDOWN_MS) {
    return;
  }
  lastEmitKey = key;
  lastEmitTime = now;
  listeners.forEach((fn) => {
    try {
      fn(err);
    } catch {
      // Không để lỗi listener làm gián đoạn luồng API
    }
  });
}

/** Dùng trong unit test để reset bộ nhớ chống trùng lặp toast */
export function __resetPermissionToastCooldownForTest(): void {
  lastEmitKey = '';
  lastEmitTime = 0;
}
