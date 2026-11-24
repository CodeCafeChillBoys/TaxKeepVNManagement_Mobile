import {
  getGroupKeyFromDocTypeCode,
  groupExpensesByAiClassification,
  calculateExpenseMetrics,
  calculateExpenseDeductionSummary,
  getExpenseMonth,
  filterExpensesByMonth,
  filterExpensesByCategory,
  getStatusLabel,
  requiresReimbursementConfirmation,
} from './expenseGroupUtils';
import { ExpenseOcrResult } from '../../types/expense';

describe('expenseGroupUtils', () => {
  describe('getGroupKeyFromDocTypeCode', () => {
    it('should map medical codes to TO_VIEN_PHI', () => {
      expect(getGroupKeyFromDocTypeCode('MEDICAL_EXPENSE_INVOICE')).toBe('TO_VIEN_PHI');
      expect(getGroupKeyFromDocTypeCode('VIEN_PHI_BENH_VIEN')).toBe('TO_VIEN_PHI');
    });

    it('should map tuition codes to TO_GIAO_DUC', () => {
      expect(getGroupKeyFromDocTypeCode('TUITION_FEE_INVOICE')).toBe('TO_GIAO_DUC');
      expect(getGroupKeyFromDocTypeCode('EDUCATION_FEE_INVOICE')).toBe('TO_GIAO_DUC');
    });

    it('should map charity codes to TO_TU_THIEN', () => {
      expect(getGroupKeyFromDocTypeCode('CHARITY_DONATION_RECEIPT')).toBe('TO_TU_THIEN');
      expect(getGroupKeyFromDocTypeCode('TU_THIEN_NHAN_DAO')).toBe('TO_TU_THIEN');
    });

    it('should map insurance codes to TO_BAO_HIEM', () => {
      expect(getGroupKeyFromDocTypeCode('INSURANCE_PREMIUM_RECEIPT')).toBe('TO_BAO_HIEM');
      expect(getGroupKeyFromDocTypeCode('BAO_HIEM_NHAN_THO')).toBe('TO_BAO_HIEM');
    });

    it('should map unknown or other codes to TO_KHAC', () => {
      expect(getGroupKeyFromDocTypeCode('SALES_INVOICE')).toBe('TO_KHAC');
      expect(getGroupKeyFromDocTypeCode('VAT_INVOICE')).toBe('TO_KHAC');
      expect(getGroupKeyFromDocTypeCode(null)).toBe('TO_KHAC');
      expect(getGroupKeyFromDocTypeCode(undefined)).toBe('TO_KHAC');
    });
  });

  describe('groupExpensesByAiClassification', () => {
    const mockList: ExpenseOcrResult[] = [
      {
        documentId: 'doc-1',
        docTypeCode: 'MEDICAL_EXPENSE_INVOICE',
        totalAmount: 1500000,
        status: 'CONFIRMED',
      },
      {
        documentId: 'doc-2',
        docTypeCode: 'MEDICAL_EXPENSE_INVOICE',
        totalAmount: 500000,
        status: 'EXTRACTED',
      },
      {
        documentId: 'doc-3',
        docTypeCode: 'TUITION_FEE_INVOICE',
        totalAmount: 8000000,
        status: 'CONFIRMED',
      },
      {
        documentId: 'doc-4',
        docTypeCode: 'CHARITY_DONATION_RECEIPT',
        totalAmount: 2000000,
        status: 'CONFIRMED',
      },
    ];

    it('should correctly group expenses into their respective groups', () => {
      const groups = groupExpensesByAiClassification(mockList, false);
      expect(groups).toHaveLength(3); // TO_VIEN_PHI, TO_GIAO_DUC, TO_TU_THIEN

      const medGroup = groups.find((g) => g.key === 'TO_VIEN_PHI');
      expect(medGroup).toBeDefined();
      expect(medGroup?.items).toHaveLength(2);
      expect(medGroup?.totalAmount).toBe(2000000);
      expect(medGroup?.confirmedAmount).toBe(1500000);
      expect(medGroup?.totalCount).toBe(2);
      expect(medGroup?.confirmedCount).toBe(1);

      const tuitionGroup = groups.find((g) => g.key === 'TO_GIAO_DUC');
      expect(tuitionGroup).toBeDefined();
      expect(tuitionGroup?.items).toHaveLength(1);
      expect(tuitionGroup?.totalAmount).toBe(8000000);
      expect(tuitionGroup?.confirmedAmount).toBe(8000000);

      const charityGroup = groups.find((g) => g.key === 'TO_TU_THIEN');
      expect(charityGroup).toBeDefined();
      expect(charityGroup?.items).toHaveLength(1);
      expect(charityGroup?.totalAmount).toBe(2000000);
    });

    it('should return all 6 groups when includeEmptyGroups is true', () => {
      const groups = groupExpensesByAiClassification([], true);
      expect(groups).toHaveLength(6);
      expect(groups.every((g) => g.items.length === 0)).toBe(true);
    });

    it('should return empty list when expenses are empty and includeEmptyGroups is false', () => {
      const groups = groupExpensesByAiClassification([], false);
      expect(groups).toHaveLength(0);
    });
  });

  describe('calculateExpenseMetrics', () => {
    it('should correctly compute metrics', () => {
      const mockList: ExpenseOcrResult[] = [
        { documentId: '1', totalAmount: 1000000, status: 'CONFIRMED' },
        { documentId: '2', totalAmount: 2000000, status: 'CONFIRMED' },
        { documentId: '3', totalAmount: 500000, status: 'EXTRACTED' },
      ];

      const metrics = calculateExpenseMetrics(mockList);
      expect(metrics.totalDocs).toBe(3);
      expect(metrics.confirmedDocs).toBe(2);
      expect(metrics.pendingDocs).toBe(1);
      expect(metrics.totalAmount).toBe(3500000);
      expect(metrics.totalConfirmedAmount).toBe(3000000);
    });

    it('should return zeros for empty list', () => {
      const metrics = calculateExpenseMetrics([]);
      expect(metrics.totalDocs).toBe(0);
      expect(metrics.confirmedDocs).toBe(0);
      expect(metrics.pendingDocs).toBe(0);
      expect(metrics.totalAmount).toBe(0);
      expect(metrics.totalConfirmedAmount).toBe(0);
    });
  });
  describe('Month and Category filters', () => {
    const mockExpenses: ExpenseOcrResult[] = [
      {
        documentId: 'doc-1',
        docTypeCode: 'MEDICAL_EXPENSE_INVOICE',
        docTypeName: 'Hóa đơn viện phí',
        invoiceDate: '2026-03-15',
        status: 'CONFIRMED',
      },
      {
        documentId: 'doc-2',
        docTypeCode: 'TUITION_FEE_INVOICE',
        docTypeName: 'Học phí đào tạo',
        invoiceDate: '10/05/2026',
        status: 'EXTRACTED',
      },
      {
        documentId: 'doc-3',
        docTypeCode: 'CHARITY_DONATION_RECEIPT',
        docTypeName: 'Ủng hộ từ thiện',
        createdAt: '2026-08-20T10:00:00Z',
        status: 'CONFIRMED',
      },
    ];

    it('should correctly extract month from invoiceDate and createdAt', () => {
      expect(getExpenseMonth(mockExpenses[0])).toBe(3);
      expect(getExpenseMonth(mockExpenses[1])).toBe(5);
      expect(getExpenseMonth(mockExpenses[2])).toBe(8);
      expect(getExpenseMonth({} as any)).toBeNull();
    });

    it('should filter expenses by month correctly', () => {
      expect(filterExpensesByMonth(mockExpenses, 'ALL')).toHaveLength(3);
      expect(filterExpensesByMonth(mockExpenses, 3)).toHaveLength(1);
      expect(filterExpensesByMonth(mockExpenses, 3)[0].documentId).toBe('doc-1');
      expect(filterExpensesByMonth(mockExpenses, 5)).toHaveLength(1);
      expect(filterExpensesByMonth(mockExpenses, 12)).toHaveLength(0);
    });

    it('should filter expenses by category from DB correctly', () => {
      expect(filterExpensesByCategory(mockExpenses, 'ALL')).toHaveLength(3);
      expect(filterExpensesByCategory(mockExpenses, 'MEDICAL_EXPENSE_INVOICE')).toHaveLength(1);
      expect(filterExpensesByCategory(mockExpenses, 'Học phí đào tạo')).toHaveLength(1);
      expect(filterExpensesByCategory(mockExpenses, 'TO_TU_THIEN')).toHaveLength(1);
      expect(filterExpensesByCategory(mockExpenses, 'NON_EXISTENT')).toHaveLength(0);
    });
  });

  describe('getStatusLabel', () => {
    it('maps known statuses and never leaks raw unknown enum strings', () => {
      expect(getStatusLabel('CONFIRMED')).toContain('Đã duyệt');
      expect(getStatusLabel('EXTRACTED')).toContain('Chờ soát xét');
      expect(getStatusLabel('UPLOADED')).toContain('Đang xử lý');
      expect(getStatusLabel('RAW_UNKNOWN_BACKEND_STATUS')).toBe('Chờ kiểm tra');
      expect(getStatusLabel(undefined)).toBe('Chờ kiểm tra');
    });
  });

  describe('requiresReimbursementConfirmation', () => {
    it('returns true only for Medical and Education invoices', () => {
      expect(requiresReimbursementConfirmation('MEDICAL_RECEIPT')).toBe(true);
      expect(requiresReimbursementConfirmation('MEDICAL_EXPENSE_INVOICE')).toBe(true);
      expect(requiresReimbursementConfirmation('VIEN_PHI_BENH_VIEN')).toBe(true);
      expect(requiresReimbursementConfirmation('TUITION_RECEIPT')).toBe(true);
      expect(requiresReimbursementConfirmation('TUITION_FEE_INVOICE')).toBe(true);
      expect(requiresReimbursementConfirmation('EDUCATION_EXPENSE_INVOICE')).toBe(true);
      expect(requiresReimbursementConfirmation('CUSTOM_DOC', 'Hóa đơn học phí đại học')).toBe(true);
      expect(requiresReimbursementConfirmation('CUSTOM_DOC', 'Chi phí khám chữa bệnh y tế')).toBe(true);
    });

    it('returns false for Charity, Insurance, Withholding, and other invoice types', () => {
      expect(requiresReimbursementConfirmation('DONATION_VOUCHER')).toBe(false);
      expect(requiresReimbursementConfirmation('CHARITY_DONATION_RECEIPT', 'Ủng hộ từ thiện')).toBe(false);
      expect(requiresReimbursementConfirmation('INSURANCE_PREMIUM_RECEIPT')).toBe(false);
      expect(requiresReimbursementConfirmation('WITHHOLDING_VOUCHER', 'Chứng từ khấu trừ thuế TNCN')).toBe(false);
      expect(requiresReimbursementConfirmation('SALES_INVOICE', 'Hóa đơn bán hàng')).toBe(false);
      expect(requiresReimbursementConfirmation('VAT_INVOICE')).toBe(false);
      expect(requiresReimbursementConfirmation(null, null)).toBe(false);
    });

    it('returns false for Medical and Education invoices in tax year 2025 or earlier, and true from 2026 onward', () => {
      expect(requiresReimbursementConfirmation('MEDICAL_RECEIPT', 'Sức khỏe', 2025)).toBe(false);
      expect(requiresReimbursementConfirmation('MEDICAL_RECEIPT', 'Sức khỏe', 2024)).toBe(false);
      expect(requiresReimbursementConfirmation('TUITION_RECEIPT', 'Giáo dục', 2025)).toBe(false);
      expect(requiresReimbursementConfirmation('CUSTOM_DOC', 'Hóa đơn học phí đại học', 2025)).toBe(false);
      expect(requiresReimbursementConfirmation('CUSTOM_DOC', 'Chi phí khám chữa bệnh y tế', 2023)).toBe(false);

      expect(requiresReimbursementConfirmation('MEDICAL_RECEIPT', 'Sức khỏe', 2026)).toBe(true);
      expect(requiresReimbursementConfirmation('MEDICAL_RECEIPT', 'Sức khỏe', 2027)).toBe(true);
      expect(requiresReimbursementConfirmation('TUITION_RECEIPT', 'Giáo dục', 2026)).toBe(true);
      expect(requiresReimbursementConfirmation('CUSTOM_DOC', 'Hóa đơn học phí đại học', 2026)).toBe(true);

      // Respects PIT_NEW_LAW_FROM_YEAR override when provided
      expect(
        requiresReimbursementConfirmation('MEDICAL_RECEIPT', 'Sức khỏe', 2026, { PIT_NEW_LAW_FROM_YEAR: '2027' })
      ).toBe(false);
      expect(
        requiresReimbursementConfirmation('MEDICAL_RECEIPT', 'Sức khỏe', 2027, { PIT_NEW_LAW_FROM_YEAR: '2027' })
      ).toBe(true);
    });
  });

  describe('calculateExpenseDeductionSummary', () => {
    it('tính đúng tổng khấu trừ năm 2026 theo quy tắc BE (Y tế lấy từ bảng kê KCB CONFIRMED, Học phí & Từ thiện từ hóa đơn CONFIRMED)', () => {
      const docs: ExpenseOcrResult[] = [
        // Hóa đơn y tế 870k nhưng bảng kê KCB chỉ được giảm trừ 120k
        {
          documentId: 'med-1',
          docTypeCode: 'MEDICAL_RECEIPT',
          totalAmount: 870000,
          isNotReimbursed: true,
          status: 'CONFIRMED',
          medicalStatement: {
            id: 'ms-1',
            documentId: 'med-1',
            fileUrl: 'https://cdn.test/ms1.jpg',
            status: 'CONFIRMED',
            totalEligibleAmount: 120000,
            validationErrors: [],
            lines: [],
          },
        },
        // Hóa đơn y tế đã duyệt nhưng thiếu bảng kê -> không tính, đếm vào medicalExcludedCount
        {
          documentId: 'med-2',
          docTypeCode: 'MEDICAL_RECEIPT',
          totalAmount: 500000,
          isNotReimbursed: true,
          status: 'CONFIRMED',
          medicalStatement: null,
        },
        // Hóa đơn học phí chờ soát xét -> không tính
        {
          documentId: 'edu-pending',
          docTypeCode: 'EDUCATION_RECEIPT',
          totalAmount: 10954025,
          status: 'EXTRACTED',
        },
        // Hóa đơn học phí đã duyệt -> tính
        {
          documentId: 'edu-ok',
          docTypeCode: 'EDUCATION_RECEIPT',
          totalAmount: 5000000,
          status: 'CONFIRMED',
        },
        // Từ thiện đã duyệt -> tính
        {
          documentId: 'charity-1',
          docTypeCode: 'DONATION_VOUCHER',
          totalAmount: 1000000,
          status: 'CONFIRMED',
        },
        // Chứng từ khấu trừ thuế TNCN -> không tính vào khấu trừ chi phí
        {
          documentId: 'voucher-1',
          docTypeCode: 'WITHHOLDING_VOUCHER',
          taxWithheld: 4000000,
          totalAmount: 4000000,
          status: 'CONFIRMED',
        },
      ];

      const summary = calculateExpenseDeductionSummary(docs, 2026);
      expect(summary.appliesMedicalAndEducation).toBe(true);
      expect(summary.medicalDeduction).toBe(120000);
      expect(summary.educationDeduction).toBe(5000000);
      expect(summary.charityDeduction).toBe(1000000);
      expect(summary.totalDeduction).toBe(6120000);
      expect(summary.medicalExcludedCount).toBe(1);
    });

    it('áp đúng mức trần năm 23tr Y tế và 24tr Học phí (hỗ trợ override từ systemConfigs)', () => {
      const docs: ExpenseOcrResult[] = [
        {
          documentId: 'med-cap',
          docTypeCode: 'MEDICAL_RECEIPT',
          totalAmount: 30000000,
          isNotReimbursed: true,
          status: 'CONFIRMED',
          medicalStatement: {
            id: 'ms-cap',
            documentId: 'med-cap',
            fileUrl: 'https://cdn.test/ms.jpg',
            status: 'CONFIRMED',
            totalEligibleAmount: 28000000,
            validationErrors: [],
            lines: [],
          },
        },
        {
          documentId: 'edu-cap',
          docTypeCode: 'EDUCATION_RECEIPT',
          totalAmount: 30000000,
          status: 'CONFIRMED',
        },
      ];

      const summary = calculateExpenseDeductionSummary(docs, 2026);
      expect(summary.medicalDeduction).toBe(23000000);
      expect(summary.isMedicalCapped).toBe(true);
      expect(summary.educationDeduction).toBe(24000000);
      expect(summary.isEducationCapped).toBe(true);
      expect(summary.totalDeduction).toBe(47000000);

      const custom = calculateExpenseDeductionSummary(docs, 2026, {
        PIT_MEDICAL_MAX_YEARLY: '25000000',
        PIT_EDUCATION_MAX_YEARLY: '26000000',
      });
      expect(custom.totalDeduction).toBe(51000000);
    });

    it('trước năm 2026 chỉ tính Từ thiện, không tính Y tế và Học phí theo luật cũ', () => {
      const docs: ExpenseOcrResult[] = [
        {
          documentId: 'med-2025',
          docTypeCode: 'MEDICAL_RECEIPT',
          totalAmount: 1000000,
          status: 'CONFIRMED',
          medicalStatement: {
            id: 'ms-2025',
            documentId: 'med-2025',
            fileUrl: 'https://cdn.test/ms.jpg',
            status: 'CONFIRMED',
            totalEligibleAmount: 1000000,
            validationErrors: [],
            lines: [],
          },
        },
        {
          documentId: 'edu-2025',
          docTypeCode: 'EDUCATION_RECEIPT',
          totalAmount: 5000000,
          status: 'CONFIRMED',
        },
        {
          documentId: 'charity-2025',
          docTypeCode: 'DONATION_VOUCHER',
          totalAmount: 2000000,
          status: 'CONFIRMED',
        },
      ];

      const summary = calculateExpenseDeductionSummary(docs, 2025);
      expect(summary.appliesMedicalAndEducation).toBe(false);
      expect(summary.medicalDeduction).toBe(0);
      expect(summary.educationDeduction).toBe(0);
      expect(summary.charityDeduction).toBe(2000000);
      expect(summary.totalDeduction).toBe(2000000);
    });
  });
});
