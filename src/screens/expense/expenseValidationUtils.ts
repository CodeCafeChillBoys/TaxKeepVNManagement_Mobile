import {
  ExtractedFieldItem,
  InvoiceLineItem,
  ValidationErrorItem,
  ValidationErrorCode,
} from '../../types/expense';

/** Danh sách 4 trường cốt lõi theo mục 6.3 của đặc tả */
export const CRUCIAL_FIELD_NAMES = [
  'total_amount',
  'seller_tax_code',
  'buyer_id_card',
  'invoice_number',
];

/** Định dạng tiền tệ VND */
export function formatCurrencyVND(amount?: number | string | null): string {
  if (amount === null || amount === undefined || amount === '') return '0 ₫';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '0 ₫';
  return `${new Intl.NumberFormat('vi-VN').format(Math.round(num))} ₫`;
}

/** Tính tổng tiền từ danh sách các mặt hàng / dòng viện phí */
export function calculateItemsTotal(items: InvoiceLineItem[]): number {
  if (!items || items.length === 0) return 0;
  return items.reduce((acc, item) => {
    const total =
      item.totalPrice !== undefined && item.totalPrice !== null
        ? Number(item.totalPrice)
        : (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
    return acc + (isNaN(total) ? 0 : total);
  }, 0);
}

/**
 * Kiểm tra xem có trường cốt lõi nào có điểm tin cậy dưới ngưỡng quy định hay không (Mục 6.3)
 */
export function validateCrucialFields(
  fields: ExtractedFieldItem[] = [],
  appliedThreshold: number = 0.8
): {
  isPassed: boolean;
  hasCrucialLowConfidence: boolean;
  lowConfidenceCrucialFields: string[];
} {
  const lowFields: string[] = [];

  for (const field of fields) {
    const normalizedName = field.fieldName.toLowerCase().replace(/([A-Z])/g, '_$1').toLowerCase();
    const isCrucial =
      field.isCrucial ||
      CRUCIAL_FIELD_NAMES.some(
        (name) => normalizedName.includes(name) || name.includes(normalizedName)
      );

    if (isCrucial && field.confidenceScore < appliedThreshold) {
      lowFields.push(field.fieldLabel || field.fieldName);
    }
  }

  const hasCrucialLowConfidence = lowFields.length > 0;
  return {
    isPassed: !hasCrucialLowConfidence,
    hasCrucialLowConfidence,
    lowConfidenceCrucialFields: lowFields,
  };
}

/**
 * Ánh xạ chi tiết 13 kịch bản lỗi từ Validation Matrix (Mục 9 đặc tả)
 * sang tiêu đề, thông điệp người dùng và gợi ý khắc phục.
 */
export function getValidationMatrixErrorDetails(code: ValidationErrorCode | string): {
  title: string;
  message: string;
  actionHint: string;
  isFatal: boolean;
} {
  switch (code) {
    case 'ERR_DOCUMENT_NOT_FOUND':
      return {
        title: 'Không tìm thấy chứng từ',
        message: 'Chứng từ không tồn tại trên hệ thống hoặc bạn không có quyền truy cập.',
        actionHint: 'Vui lòng kiểm tra lại danh sách chứng từ trong kỳ kê khai.',
        isFatal: true,
      };

    case 'ERR_INVALID_STATUS':
      return {
        title: 'Trạng thái chứng từ không hợp lệ',
        message: 'Chứng từ đã được bóc tách xong hoặc đã xác nhận, không thể tải đè.',
        actionHint: 'Bạn có thể xem lại chi tiết hoặc tải lên chứng từ mới.',
        isFatal: true,
      };

    case 'ERR_CORRUPTED_FILE':
      return {
        title: 'Tệp tin bị lỗi',
        message: 'Hệ thống không thể mở nội dung hoặc tệp tin rỗng không có dữ liệu.',
        actionHint: 'Vui lòng kiểm tra lại tệp ảnh hoặc tải lại từ nguồn gốc.',
        isFatal: true,
      };

    case 'ERR_UNREADABLE_IMAGE':
      return {
        title: 'Hình ảnh quá mờ hoặc lóa sáng',
        message: 'Chất lượng hình ảnh chưa rõ nét khiến hệ thống không thể đọc được chữ.',
        actionHint: 'Vui lòng chụp lại ảnh rõ nét, ngay ngắn và đầy đủ 4 góc của chứng từ.',
        isFatal: true,
      };

    case 'ERR_UNAUTHORIZED':
      return {
        title: 'Phiên đăng nhập hết hạn',
        message: 'Phiên làm việc của bạn đã hết thời gian hiệu lực. Vui lòng đăng nhập lại.',
        actionHint: 'Vui lòng đăng nhập lại tài khoản để tiếp tục thao tác.',
        isFatal: true,
      };

    case 'ERR_YEAR_MISMATCH':
      return {
        title: 'Sai lệch năm tính thuế',
        message: 'Năm lập trên hóa đơn không khớp với năm tính thuế đang kê khai.',
        actionHint: 'Chi phí chỉ được trừ trong đúng kỳ tính thuế phát sinh theo quy định.',
        isFatal: false,
      };

    case 'ERR_INVALID_DOC_TYPE':
      return {
        title: 'Loại chứng từ không được giảm trừ',
        message: 'Hóa đơn thuộc mục chi tiêu sinh hoạt không đủ điều kiện giảm trừ thuế (ăn uống, giải trí...).',
        actionHint: 'Chỉ các hóa đơn y tế, học phí, từ thiện, bảo hiểm hợp lệ mới được trừ thuế.',
        isFatal: false,
      };

    case 'ERR_IDENTITY_MISMATCH':
      return {
        title: 'Thông tin người mua không khớp',
        message: 'Họ tên hoặc CCCD trên hóa đơn không khớp với người nộp thuế hoặc người phụ thuộc.',
        actionHint: 'Vui lòng kiểm tra lại tên người mua/bệnh nhân/học sinh trên hóa đơn.',
        isFatal: false,
      };

    case 'ERR_TAX_PERIOD_LOCKED':
      return {
        title: 'Kỳ tính thuế đã nộp hồ sơ',
        message: 'Kỳ tính thuế này đã được nộp chính thức nên không thể chỉnh sửa thêm.',
        actionHint: 'Nếu cần điều chỉnh số liệu, vui lòng tạo kỳ kê khai bổ sung.',
        isFatal: true,
      };

    case 'ERR_IMAGE_QUALITY_TOO_LOW':
      return {
        title: 'Chất lượng ảnh chưa đạt yêu cầu',
        message: 'Ảnh chụp bị mờ, rung tay, lóa đèn flash hoặc bị che khuất viền hóa đơn.',
        actionHint: 'Vui lòng đặt hóa đơn phẳng phiu và chụp lại trong môi trường đủ ánh sáng.',
        isFatal: false,
      };

    case 'ERR_NOT_TAX_DOCUMENT':
      return {
        title: 'Không phải chứng từ thuế hợp lệ',
        message: 'Hình ảnh tải lên không phải là hóa đơn tài chính hoặc chứng từ phục vụ giảm trừ thuế.',
        actionHint: 'Vui lòng chỉ tải lên ảnh hóa đơn hoặc biên lai hợp lệ.',
        isFatal: true,
      };

    case 'ERR_DUPLICATE_DOCUMENT':
      return {
        title: 'Hóa đơn đã được kê khai trước đó',
        message: 'Hóa đơn này đã được bạn kê khai trong kỳ tính thuế.',
        actionHint: 'Vui lòng không nộp trùng lặp một hóa đơn nhiều lần.',
        isFatal: true,
      };

    case 'ERR_FUTURE_DATE':
      return {
        title: 'Ngày lập hóa đơn không hợp lệ',
        message: 'Ngày ghi trên hóa đơn không thể lớn hơn ngày hiện tại.',
        actionHint: 'Vui lòng kiểm tra và chỉnh sửa lại ngày lập hóa đơn chính xác.',
        isFatal: false,
      };

    case 'ERR_DUPLICATE_FILE_HASH':
      return {
        title: 'Tệp tin đã tồn tại trên hệ thống',
        message: 'Tệp tin này giống hệt với một hóa đơn bạn đã tải lên trước đó.',
        actionHint: 'Vui lòng chọn tệp hóa đơn khác.',
        isFatal: true,
      };

    default:
      return {
        title: 'Cảnh báo đối soát hóa đơn',
        message: 'Có sai lệch hoặc cần kiểm tra lại thông tin trên chứng từ.',
        actionHint: 'Vui lòng rà soát lại trước khi xác nhận.',
        isFatal: false,
      };
  }
}
