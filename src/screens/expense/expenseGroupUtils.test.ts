import {
  getGroupKeyFromDocTypeCode,
  groupExpensesByAiClassification,
  calculateExpenseMetrics,
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

    it('should return all 5 groups when includeEmptyGroups is true', () => {
      const groups = groupExpensesByAiClassification([], true);
      expect(groups).toHaveLength(5);
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
});
