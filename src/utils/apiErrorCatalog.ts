/**
 * Câu tiếng Việt cho từng errorCode mà BE trả về.
 * Nếu BE đã gửi câu tiếng Việt (có dấu), app ưu tiên câu đó vì thường có số liệu cụ thể.
 * Danh mục này dùng khi BE chỉ trả mã, hoặc câu tiếng Anh.
 */
export const API_ERROR_MESSAGES: Record<string, string> = {
  ACCOUNT_SUSPENDED: 'Tài khoản đang bị tạm khóa. Vui lòng liên hệ quản trị viên.',
  ACTIVE_APPLICATION_EXISTS: 'Bạn đã có hồ sơ đang chờ xét duyệt. Vui lòng đợi kết quả trước khi gửi hồ sơ mới.',
  AI_CONNECTION_ERROR: 'Không kết nối được dịch vụ trợ lý. Vui lòng thử lại sau.',
  AI_QUESTION_QUOTA_EXCEEDED: 'Bạn đã dùng hết số câu hỏi trợ lý trong tháng. Vui lòng nâng cấp gói để tiếp tục.',
  ALREADY_PROCESSED: 'Yêu cầu này đã được xử lý trước đó.',
  ALREADY_REFUNDED: 'Gói này đã được hoàn tiền trước đó.',
  ALREADY_REPLIED: 'Bạn đã phản hồi đánh giá này rồi. Chỉ được phản hồi một lần.',
  APPROVAL_TIMEOUT: 'Đã quá hạn xác nhận lịch. Vui lòng đặt lại.',
  BANK_INFO_REQUIRED: 'Vui lòng nhập đủ tên ngân hàng, số tài khoản và tên chủ tài khoản.',
  CANNOT_CANCEL: 'Lịch này không thể hủy ở trạng thái hiện tại.',
  CANNOT_DELETE_BASIC_PLAN: 'Gói Basic là gói mặc định, không được ngừng bán.',
  CANNOT_DELETE_IN_USE: 'Mục này đang được sử dụng, không thể xóa.',
  CANNOT_EXTEND_FREE_PLAN: 'Không gia hạn được gói miễn phí.',
  CANNOT_MODIFY: 'Hồ sơ ở trạng thái này không thể sửa.',
  CANNOT_REFUND_FREE_PLAN: 'Gói miễn phí không có số tiền để hoàn.',
  CERTIFICATE_CONFIG_EXISTS: 'Mã chứng chỉ này đã có trong hệ thống.',
  CERTIFICATE_EXPIRED: 'Chứng chỉ đã hết hạn. Vui lòng cập nhật chứng chỉ còn hiệu lực.',
  CERTIFICATE_REQUIRED: 'Hồ sơ cần ít nhất một chứng chỉ hành nghề.',
  CITIZEN_ID_ALREADY_EXISTS: 'Số căn cước này đã được đăng ký. Vui lòng đăng nhập.',
  COMMENT_TOO_SHORT: 'Nội dung nhận xét còn quá ngắn.',
  DEPENDENT_PERIOD_OVERLAP: 'Khoảng thời gian của người phụ thuộc bị trùng với hồ sơ đã có.',
  DESCRIPTION_TOO_SHORT: 'Phần mô tả còn quá ngắn.',
  DISPUTE_ALREADY_RESOLVED: 'Khiếu nại này đã được xử lý.',
  DISPUTE_NOT_ALLOWED: 'Không thể gửi khiếu nại cho lịch này.',
  DOC_TYPE_MISMATCH: 'Loại giấy tờ không khớp với yêu cầu.',
  DUPLICATE_CODE: 'Mã này đã tồn tại.',
  DUPLICATE_INCOME: 'Đã có phiếu lương của nơi chi trả này trong tháng đã chọn.',
  DUPLICATE_RULE: 'Quy tắc này đã tồn tại.',
  DUPLICATE_TAX_CODE: 'Mã số thuế này đã được khai báo.',
  EKYC_REQUIRED: 'Tài khoản cần xác thực danh tính trước khi tiếp tục.',
  EMAIL_ALREADY_EXISTS: 'Email này đã được sử dụng. Vui lòng dùng email khác.',
  EMPTY_FILE: 'Tệp tải lên đang trống.',
  EMPTY_REPLY: 'Nội dung phản hồi không được để trống.',
  ERR_DUPLICATE_DOCUMENT: 'Chứng từ này đã được lưu trước đó.',
  ERR_IDENTITY_MISMATCH: 'Thông tin trên chứng từ không khớp với người nộp thuế hoặc người phụ thuộc đã đăng ký.',
  ERR_INVALID_STATUS: 'Trạng thái hiện tại không cho phép thao tác này.',
  ESCROW_NOT_FOUND: 'Không tìm thấy giao dịch tạm giữ tiền của lịch hẹn.',
  EXPERT_ALREADY_CHECKED_IN: 'Chuyên gia đã vào phòng, không thể báo vắng mặt.',
  EXPIRY_DATE_REQUIRED: 'Vui lòng nhập ngày hết hạn của chứng chỉ.',
  EXPIRY_REQUIRED_FOR_TYPE: 'Loại chứng chỉ này bắt buộc có ngày hết hạn.',
  EXPORT_PDF_NOT_ALLOWED: 'Gói hiện tại chưa hỗ trợ xuất PDF. Vui lòng nâng cấp gói.',
  EXPORT_ZIP_NOT_ALLOWED: 'Gói hiện tại chưa hỗ trợ tải ZIP chứng từ. Vui lòng nâng cấp gói.',
  FEE_CONFIG_EXISTS: 'Khung giá cho hình thức và thời lượng này đã có.',
  FEE_OUT_OF_RANGE: 'Mức phí nằm ngoài khung giá sàn và trần quy định.',
  FEE_PROPOSAL_REQUIRED: 'Vui lòng nhập mức phí cho ít nhất một hình thức tư vấn.',
  FILE_MISSING: 'Vui lòng chọn tệp cần tải lên.',
  FILE_SIZE_EXCEEDED: 'Dung lượng tệp vượt quá 10 MB.',
  FILE_TOO_LARGE: 'Dung lượng tệp vượt quá giới hạn cho phép.',
  FILES_REQUIRED: 'Cần ít nhất một tệp chứng từ.',
  FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
  FULLNAME_MISMATCH: 'Họ tên trong hồ sơ chưa trùng với họ tên tài khoản.',
  GROUP_DOWNGRADE_NOT_ALLOWED: 'Không được chuyển người phụ thuộc xuống nhóm điều kiện thấp hơn.',
  GROUP_RELATIONSHIP_MISMATCH: 'Nhóm điều kiện không phù hợp với mối quan hệ đã chọn.',
  HOLD_SLOT_EXPIRED: 'Đã hết thời gian giữ chỗ. Vui lòng chọn lại khung giờ.',
  IDENTIFIER_REQUIRED: 'Vui lòng nhập số căn cước hoặc giấy khai sinh.',
  IDENTITY_MISMATCH: 'Thông tin trên chứng từ không khớp với người nộp thuế hoặc người phụ thuộc đã đăng ký.',
  INSUFFICIENT_BALANCE: 'Số dư không đủ để thực hiện giao dịch.',
  INSUFFICIENT_WALLET_BALANCE: 'Số dư ví không đủ. Vui lòng nạp thêm hoặc chọn cổng thanh toán.',
  INVALID_ACTION: 'Thao tác không hợp lệ.',
  INVALID_AMOUNT: 'Số tiền không hợp lệ.',
  INVALID_BILLING_CYCLE: 'Chu kỳ thanh toán chỉ nhận theo tháng hoặc theo năm.',
  INVALID_BOOKING_STATUS: 'Trạng thái lịch hẹn đã thay đổi, không thực hiện được thao tác này.',
  INVALID_CERTIFICATE_TYPE: 'Loại chứng chỉ không hợp lệ.',
  INVALID_CITIZEN_ID: 'Số căn cước không hợp lệ.',
  INVALID_CODE: 'Mã không hợp lệ hoặc đang để trống.',
  INVALID_CREDENTIALS: 'Số căn cước hoặc mật khẩu không đúng.',
  INVALID_CURRENT_GROUP: 'Nhóm điều kiện hiện tại không hợp lệ.',
  INVALID_CUTOFF_DATE: 'Ngày chốt số liệu không hợp lệ.',
  INVALID_DECISION_TYPE: 'Loại quyết định không hợp lệ.',
  INVALID_DETAIL_SCORE: 'Điểm đánh giá chi tiết không hợp lệ.',
  INVALID_DOC_TYPE: 'Loại giấy tờ không hợp lệ.',
  INVALID_EXPIRY_DATE: 'Ngày hết hạn không hợp lệ.',
  INVALID_FEE_RANGE: 'Khung giá không hợp lệ.',
  INVALID_FILE_TYPE: 'Định dạng tệp không được hỗ trợ. Chỉ nhận PDF, JPG hoặc PNG.',
  INVALID_GROUP: 'Nhóm điều kiện không hợp lệ.',
  INVALID_ISSUE_DATE: 'Ngày cấp không hợp lệ.',
  INVALID_PERIOD: 'Khoảng thời gian không hợp lệ.',
  INVALID_RATING: 'Điểm đánh giá phải từ 1 đến 5 sao.',
  INVALID_REASON: 'Vui lòng nhập lý do rõ ràng hơn.',
  INVALID_REFUND_AMOUNT: 'Số tiền hoàn không hợp lệ.',
  INVALID_REFUND_RATE: 'Tỷ lệ hoàn tiền không hợp lệ.',
  INVALID_RELATIONSHIP: 'Mối quan hệ không hợp lệ.',
  INVALID_SIGNATURE: 'Không xác thực được kết quả thanh toán.',
  INVALID_SPECIALIZATION: 'Lĩnh vực chuyên môn không còn hiệu lực.',
  INVALID_STATUS: 'Trạng thái hiện tại không cho phép thao tác này.',
  INVALID_TAX_CODE: 'Mã số thuế không được để trống.',
  INVALID_TAX_CODE_CHECKSUM: 'Mã số thuế không đúng chữ số kiểm tra.',
  INVALID_TAX_CODE_FORMAT: 'Mã số thuế không đúng định dạng.',
  INVALID_TAX_YEAR: 'Năm tính thuế không hợp lệ.',
  INVALID_TOKEN: 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.',
  LEAD_TIME_VIOLATION: 'Khung giờ này quá gần. Vui lòng chọn giờ bắt đầu muộn hơn.',
  MAX_DAILY_SLOTS_EXCEEDED: 'Đã đạt số khung giờ tối đa trong ngày.',
  MIN_WITHDRAWAL_NOT_MET: 'Số tiền rút chưa đạt mức tối thiểu.',
  MISSING_REQUIRED_FIELDS: 'Vui lòng điền đủ các thông tin bắt buộc.',
  MISSING_TOKEN: 'Phiên đăng nhập đã hết. Vui lòng đăng nhập lại.',
  NON_TAX_DOCUMENT_TYPE: 'Loại chứng từ này không thuộc nhóm được kê khai thuế.',
  NOTES_REQUIRED: 'Vui lòng nhập biên bản tóm tắt trước khi kết thúc buổi tư vấn.',
  NO_SHOW_EARLY: 'Chỉ báo vắng mặt sau 15 phút kể từ giờ hẹn.',
  NOT_FOUND: 'Không tìm thấy dữ liệu yêu cầu.',
  OCR_EXTRACTION_FAILED: 'Không đọc được nội dung chứng từ. Vui lòng chụp lại rõ hơn.',
  OCR_QUOTA_EXCEEDED: 'Bạn đã dùng hết lượt quét chứng từ trong tháng. Vui lòng nâng cấp gói.',
  OCR_SERVICE_ERROR: 'Dịch vụ đọc chứng từ đang bận. Vui lòng thử lại.',
  REASON_REQUIRED: 'Vui lòng nhập lý do.',
  RESOLUTION_REQUIRED: 'Vui lòng nhập nội dung phán quyết.',
  RESPONSE_TOO_SHORT: 'Nội dung phản hồi còn quá ngắn.',
  REVIEW_NOT_ALLOWED: 'Chưa thể gửi đánh giá cho buổi tư vấn này.',
  ROOM_NOT_OPEN_YET: 'Phòng tư vấn chưa đến giờ mở.',
  SAME_GROUP: 'Người phụ thuộc đang ở nhóm điều kiện này rồi.',
  SAME_PASSWORD: 'Mật khẩu mới phải khác mật khẩu hiện tại.',
  SELF_BOOKING_NOT_ALLOWED: 'Bạn không thể tự đặt lịch với chính mình.',
  SLOT_ALREADY_BOOKED: 'Khung giờ đã có khách đặt, không thể sửa hoặc xóa.',
  SLOT_ALREADY_TAKEN: 'Khung giờ vừa được người khác đặt. Vui lòng chọn giờ khác.',
  SLOT_EXPIRED: 'Khung giờ này đã qua, không thể hủy.',
  SLOT_HOLDING: 'Khung giờ đang được giữ để thanh toán. Vui lòng thử lại sau.',
  SLOT_OVERLAP: 'Khung giờ bị trùng với lịch đã có.',
  SLUG_ALREADY_EXISTS: 'Mã gói này đã tồn tại.',
  SPECIALIZATION_CODE_EXISTS: 'Mã lĩnh vực này đã tồn tại.',
  SPECIALIZATION_REQUIRED: 'Vui lòng chọn ít nhất một lĩnh vực chuyên môn.',
  SUBSCRIPTION_NOT_ACTIVE: 'Gói này không còn hiệu lực nên không gia hạn được.',
  TAX_ID_REQUIRED: 'Vui lòng bổ sung mã số thuế.',
  TAX_REGISTRATION_CONFIRMATION_REQUIRED: 'Vui lòng xác nhận đăng ký người phụ thuộc trước khi tiếp tục.',
  UNAUTHORIZED: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  UNDER_DISPUTE: 'Lịch hẹn đang có khiếu nại, chưa thực hiện được thao tác này.',
  UNPAID_BOOKING: 'Lịch hẹn chưa được thanh toán.',
  UNREADABLE_DOCUMENT: 'Không đọc được chứng từ. Vui lòng tải tệp rõ hơn.',
  UNREADABLE_IMAGE: 'Không đọc được ảnh. Vui lòng chụp lại.',
  UNSUPPORTED_FORMAT: 'Định dạng tệp không được hỗ trợ. Chỉ nhận JPG, PNG hoặc PDF.',
  USER_ALREADY_CHECKED_IN: 'Khách đã vào phòng, không thể báo vắng mặt.',
  USER_NOT_ACTIVE: 'Tài khoản chưa ở trạng thái hoạt động.',
  USER_SLOT_CONFLICT: 'Bạn đã có lịch khác trùng khung giờ này.',
  WRONG_CURRENT_PASSWORD: 'Mật khẩu hiện tại không đúng.',
};

const CODE_ALIAS: Record<string, string> = {
  INVALIDCODE: 'INVALID_CODE',
  DUPLICATECODE: 'DUPLICATE_CODE',
  DUPLICATEDOCUMENT: 'ERR_DUPLICATE_DOCUMENT',
  FILESIZEEXCEEDED: 'FILE_SIZE_EXCEEDED',
  FILESREQUIRED: 'FILES_REQUIRED',
  INVALIDDOCUMENTSTATUS: 'ERR_INVALID_STATUS',
  INVALIDTAXYEAR: 'INVALID_TAX_YEAR',
  INVALIDTOKEN: 'INVALID_TOKEN',
  UNSUPPORTEDFORMAT: 'UNSUPPORTED_FORMAT',
};

const VIETNAMESE = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

export function normalizeErrorCode(code?: string | null): string {
  const raw = String(code || '').trim().toUpperCase();
  return CODE_ALIAS[raw] || raw;
}

export function messageForErrorCode(code?: string | null): string | null {
  const key = normalizeErrorCode(code);
  return API_ERROR_MESSAGES[key] ?? null;
}

/** Ưu tiên câu tiếng Việt của BE. Nếu BE trả tiếng Anh hoặc chỉ trả mã thì dùng danh mục. */
export function pickApiErrorMessage(
  code?: string | null,
  message?: string | null,
  fallback = ''
): string {
  const key = normalizeErrorCode(code);
  const msg = String(message || '').trim();
  if (VIETNAMESE.test(msg) && msg.toUpperCase() !== key) return msg;
  const mapped = API_ERROR_MESSAGES[key];
  if (mapped) return mapped;
  if (msg && msg.toUpperCase() !== key && !/^[A-Z0-9_]+$/.test(msg)) return msg;
  return fallback;
}
