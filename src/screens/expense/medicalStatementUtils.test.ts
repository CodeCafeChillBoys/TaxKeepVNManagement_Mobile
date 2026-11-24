import {
  validateStatementFile,
  isMedicalReceipt,
  shouldShowMedicalStatementImage,
  getStatementStatusMeta,
  getDeductionReasonLabel,
  getStatementErrorLabel,
  normalizeStatementErrors,
  isLineExcluded,
  summarizeStatementLines,
} from './medicalStatementUtils';
import { parseBackendError } from './expenseValidationUtils';
import { MedicalStatementLine } from '../../types/expense';

const line = (p: Partial<MedicalStatementLine>): MedicalStatementLine => ({
  id: 1, lineOrder: 1, itemName: 'x', quantity: 1, unitPrice: 0, totalAmount: 0,
  insurancePaid: 0, patientCoPay: 0, patientSelfPay: 0, deductionStatus: 'ELIGIBLE',
  isEligibleDeduction: true, eligibleAmount: 0, ...p,
});

describe('medicalStatementUtils', () => {
  it('kiểm tra đuôi tệp và dung lượng giống BE', () => {
    expect(validateStatementFile({ name: 'bang_ke.PDF', size: 1000 })).toBeNull();
    expect(validateStatementFile({ name: 'bang_ke.jpeg' })).toBeNull();
    expect(validateStatementFile({ name: 'bang_ke.heic', size: 10 })).toContain('JPG');
    expect(validateStatementFile({ name: 'a.png', size: 10 * 1024 * 1024 + 1 })).toContain('10MB');
  });

  it('chỉ nhận hóa đơn viện phí làm chứng từ mẹ', () => {
    expect(isMedicalReceipt(' medical_receipt ')).toBe(true);
    expect(isMedicalReceipt('MEDICAL_COST_STATEMENT')).toBe(false);
    expect(isMedicalReceipt(null)).toBe(false);
  });

  it('chỉ hiển thị ảnh bảng kê khi đã có fileUrl và OCR bóc tách thành công (EXTRACTED/CONFIRMED)', () => {
    const base = { id: 's1', documentId: 'd1', fileUrl: 'https://cdn.test/bk.jpg', validationErrors: [], lines: [] };
    expect(shouldShowMedicalStatementImage({ ...base, status: 'EXTRACTED' })).toBe(true);
    expect(shouldShowMedicalStatementImage({ ...base, status: 'CONFIRMED' })).toBe(true);
    expect(shouldShowMedicalStatementImage({ ...base, status: 'UPLOADED' })).toBe(false);
    expect(shouldShowMedicalStatementImage({ ...base, status: 'FAILED' })).toBe(false);
    expect(shouldShowMedicalStatementImage({ ...base, fileUrl: '', status: 'CONFIRMED' })).toBe(false);
    expect(shouldShowMedicalStatementImage(null)).toBe(false);
  });

  it('map đầy đủ mã lý do không được giảm trừ từ BE & AI sang tiếng Việt', () => {
    expect(getStatementStatusMeta('FAILED').variant).toBe('destructive');
    expect(getStatementStatusMeta(undefined).label).toBe('Chưa tải bảng kê');

    // Mã từ BE MedicalDeductionReason & AI medical_statement_prompt.py
    expect(getDeductionReasonLabel('IN_COVERAGE_COPAY')).toContain('đồng chi trả');
    expect(getDeductionReasonLabel('TREATMENT_EXPENSE_SELF_PAY')).toContain('khám chữa bệnh');
    expect(getDeductionReasonLabel('OUT_OF_COVERAGE')).toContain('ngoài phạm vi thanh toán BHYT');
    expect(getDeductionReasonLabel('EXCLUDED_UNREADABLE')).toContain('không đủ căn cứ');
    expect(getDeductionReasonLabel('NEED_REVIEW_UNREADABLE')).toContain('không đọc rõ');
    expect(getDeductionReasonLabel('excluded_vip_room')).toContain('Phòng dịch vụ');
    expect(getDeductionReasonLabel('EXCLUDED_COSMETIC_SURGERY')).toContain('thẩm mỹ');
    expect(getDeductionReasonLabel('EXCLUDED_SKIN_CARE_SPA')).toContain('spa');
    expect(getDeductionReasonLabel('EXCLUDED_FUNCTIONAL_FOOD')).toContain('Thực phẩm chức năng');

    // Chuỗi ghép mã + giải thích tiếng Việt hoặc mã lạ không bị lộ raw UPPER_SNAKE_CASE
    expect(getDeductionReasonLabel('EXCLUDED_COSMETIC_SURGERY: Nâng mũi thẩm mỹ')).toContain('Nâng mũi thẩm mỹ');
    expect(getDeductionReasonLabel('EXCLUDED_COSMETIC_SURGERY: Nâng mũi thẩm mỹ')).not.toContain('EXCLUDED_COSMETIC_SURGERY');
    expect(getDeductionReasonLabel('EXCLUDED_PLASTIC_BOTOX')).toContain('thẩm mỹ');
    expect(getDeductionReasonLabel('UNKNOWN_CODE')).toBe('Không thuộc danh mục chi phí y tế được giảm trừ thuế');
    expect(getDeductionReasonLabel('UNKNOWN_CODE')).not.toContain('UNKNOWN_CODE');

    // Dòng loại trừ không có deductionReason vẫn có thông báo tiếng Việt rõ ràng
    expect(
      getDeductionReasonLabel(null, line({ isEligibleDeduction: false, deductionStatus: 'EXCLUDED', patientSelfPay: 500000 }))
    ).toContain('tự trả');
    expect(
      getDeductionReasonLabel('', line({ isEligibleDeduction: false, deductionStatus: 'EXCLUDED' }))
    ).toContain('Không thuộc danh mục');
    expect(isLineExcluded(line({ isEligibleDeduction: true, deductionStatus: 'EXCLUDED' }))).toBe(true);
  });

  it('map đầy đủ mã lỗi, cross-check issues và thông báo tiếng Anh của BE/AI sang tiếng Việt', () => {
    // BE DocumentOcrConsumerBackgroundService
    expect(getStatementErrorLabel('ERR_NOT_MEDICAL_STATEMENT')).toContain('không phải bảng kê');
    expect(getStatementErrorLabel('ERR_MEDICAL_STATEMENT_NO_LINES')).toContain('Không đọc được dòng chi phí');

    // BE MedicalCrossCheckIssue
    expect(getStatementErrorLabel('PATIENT_NAME_MISMATCH')).toContain('Họ tên người bệnh');
    expect(getStatementErrorLabel('PATIENT_IDCARD_MISMATCH')).toContain('CCCD/CMND');
    expect(getStatementErrorLabel('TOTAL_AMOUNT_MISMATCH')).toContain('Số tiền người bệnh thực trả');
    expect(getStatementErrorLabel('SERVICE_ITEM_MISMATCH')).toContain('Mục khám/dịch vụ');
    expect(getStatementErrorLabel('PATIENT_NOT_TAXPAYER_OR_DEPENDENT')).toContain('Khoản 3b Điều 49');

    // AI expense_ocr_service check_medical_statement_amounts & validation_errors
    expect(getStatementErrorLabel('UNKNOWN_SECTION')).toContain('nhóm mục');
    expect(getStatementErrorLabel('LINE_SUM_MISMATCH')).toContain('Tổng tiền trên một số dòng');
    expect(getStatementErrorLabel('SUMMARY_MISMATCH')).toContain('Số liệu tổng kết');
    expect(getStatementErrorLabel('ERR_IMAGE_QUALITY_TOO_LOW')).toContain('Chất lượng ảnh');
    expect(getStatementErrorLabel('Document income year is 2025 but filing year is 2026.')).toBe(
      'Năm trên bảng kê (2025) không khớp với kỳ tính thuế đang kê khai (2026).'
    );
    expect(getStatementErrorLabel('Invoice date cannot be greater than the current date.')).toContain('ngày hiện tại');
    expect(
      getStatementErrorLabel('AI Engine could not parse the document. The image quality may be too blurry or illegible.')
    ).toContain('Chất lượng ảnh');

    // BE MedicalCrossCheckHelper nhúng enum DependentStatus trong câu tiếng Việt
    expect(
      getStatementErrorLabel(
        "Người bệnh là người phụ thuộc 'Phạm Minh' nhưng trạng thái hồ sơ đang là 'PENDING_DOCUMENTS'. Cần hoàn tất hồ sơ."
      )
    ).toContain("'Thiếu giấy tờ minh chứng'");
    expect(getStatementErrorLabel('Họ tên không khớp')).toBe('Họ tên không khớp');

    // Loại bỏ trùng lặp sau khi dịch
    expect(
      normalizeStatementErrors([
        'ERR_IMAGE_QUALITY_TOO_LOW',
        'Image quality is too low for accurate tax document extraction. Please capture or upload a clearer document.',
      ])
    ).toHaveLength(1);
  });

  it('parseBackendError map đúng lỗi API tải bảng kê (errors.errorCode từ GlobalExceptionMiddleware)', () => {
    const notReceipt = parseBackendError({
      response: {
        status: 400,
        data: {
          success: false,
          message: 'The parent document must be a medical receipt.',
          errors: { errorCode: 'ERR_NOT_MEDICAL_RECEIPT' },
        },
      },
    });
    expect(notReceipt.message).toContain('Hóa đơn viện phí');

    const notConfigured = parseBackendError({
      response: {
        status: 400,
        data: {
          success: false,
          message: 'Configure the medical statement document type before uploading.',
          errors: { errorCode: 'ERR_MEDICAL_STATEMENT_TYPE_NOT_CONFIGURED' },
        },
      },
    });
    expect(notConfigured.message).toContain('chưa cấu hình');
  });

  it('cộng tiền được giảm trừ và bị loại trừ', () => {
    const s = summarizeStatementLines([
      line({ isEligibleDeduction: true, eligibleAmount: 300000 }),
      line({ isEligibleDeduction: true, eligibleAmount: 200000 }),
      line({ isEligibleDeduction: false, deductionStatus: 'EXCLUDED', patientCoPay: 0, patientSelfPay: 1500000 }),
    ]);
    expect(s).toEqual({ eligibleAmount: 500000, eligibleCount: 2, excludedAmount: 1500000, excludedCount: 1 });
    expect(summarizeStatementLines(undefined).eligibleCount).toBe(0);
  });
});
