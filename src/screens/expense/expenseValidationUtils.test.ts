import {
  formatCurrencyVND,
  calculateItemsTotal,
  validateCrucialFields,
  getValidationMatrixErrorDetails,
} from './expenseValidationUtils';

describe('expenseValidationUtils', () => {
  describe('formatCurrencyVND', () => {
    it('formats numeric values with Vietnamese Dong symbol', () => {
      expect(formatCurrencyVND(1250000)).toBe('1.250.000 ₫');
      expect(formatCurrencyVND(0)).toBe('0 ₫');
      expect(formatCurrencyVND('250000')).toBe('250.000 ₫');
    });

    it('handles null, undefined and invalid input gracefully', () => {
      expect(formatCurrencyVND(null)).toBe('0 ₫');
      expect(formatCurrencyVND(undefined)).toBe('0 ₫');
      expect(formatCurrencyVND('not_a_number')).toBe('0 ₫');
    });
  });

  describe('calculateItemsTotal', () => {
    it('sums totalPrice from items array correctly', () => {
      const items = [
        { itemOrder: 1, itemName: 'Khám bệnh', quantity: 1, unitPrice: 250000, totalPrice: 250000 },
        { itemOrder: 2, itemName: 'Thuốc kháng sinh', quantity: 2, unitPrice: 85000, totalPrice: 170000 },
      ];
      expect(calculateItemsTotal(items)).toBe(420000);
    });

    it('falls back to quantity * unitPrice if totalPrice is missing', () => {
      const items = [
        { itemOrder: 1, itemName: 'Sách giáo trình', quantity: 3, unitPrice: 50000 },
      ];
      expect(calculateItemsTotal(items)).toBe(150000);
    });

    it('returns 0 for empty array', () => {
      expect(calculateItemsTotal([])).toBe(0);
    });
  });

  describe('validateCrucialFields (Section 6.3 spec)', () => {
    it('passes when all crucial fields meet applied threshold', () => {
      const fields = [
        { fieldName: 'total_amount', extractedValue: '1250000', confidenceScore: 0.95 },
        { fieldName: 'seller_tax_code', extractedValue: '0302221111', confidenceScore: 0.88 },
        { fieldName: 'buyer_id_card', extractedValue: '054204007454', confidenceScore: 0.92 },
        { fieldName: 'invoice_number', extractedValue: '0082621', confidenceScore: 0.86 },
      ];
      const result = validateCrucialFields(fields, 0.85);
      expect(result.isPassed).toBe(true);
      expect(result.hasCrucialLowConfidence).toBe(false);
      expect(result.lowConfidenceCrucialFields).toHaveLength(0);
    });

    it('fails when even one crucial field has confidence below threshold', () => {
      const fields = [
        { fieldName: 'total_amount', extractedValue: '1250000', confidenceScore: 0.95 },
        { fieldName: 'seller_tax_code', extractedValue: '0302221111', confidenceScore: 0.72 }, // LOW!
        { fieldName: 'buyer_id_card', extractedValue: '054204007454', confidenceScore: 0.92 },
        { fieldName: 'invoice_number', extractedValue: '0082621', confidenceScore: 0.86 },
      ];
      const result = validateCrucialFields(fields, 0.85);
      expect(result.isPassed).toBe(false);
      expect(result.hasCrucialLowConfidence).toBe(true);
      expect(result.lowConfidenceCrucialFields).toContain('seller_tax_code');
    });
  });

  describe('getValidationMatrixErrorDetails (13 scenarios)', () => {
    it('returns correct metadata for ERR_YEAR_MISMATCH (Scenario 5)', () => {
      const details = getValidationMatrixErrorDetails('ERR_YEAR_MISMATCH');
      expect(details.title).toContain('năm tính thuế');
      expect(details.isFatal).toBe(false);
    });

    it('returns correct metadata for ERR_INVALID_DOC_TYPE (Scenario 6)', () => {
      const details = getValidationMatrixErrorDetails('ERR_INVALID_DOC_TYPE');
      expect(details.title).toContain('không được giảm trừ');
      expect(details.isFatal).toBe(false);
    });

    it('returns correct metadata for ERR_NOT_TAX_DOCUMENT (Scenario 10)', () => {
      const details = getValidationMatrixErrorDetails('ERR_NOT_TAX_DOCUMENT');
      expect(details.title).toContain('Không phải chứng từ thuế');
      expect(details.isFatal).toBe(true);
    });

    it('returns correct metadata for ERR_IMAGE_QUALITY_TOO_LOW (Scenario 9)', () => {
      const details = getValidationMatrixErrorDetails('ERR_IMAGE_QUALITY_TOO_LOW');
      expect(details.title).toContain('Chất lượng ảnh');
      expect(details.isFatal).toBe(false);
    });
  });
});
