jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

jest.mock('../api/apiClient', () => ({
  apiClient: {
    post: jest.fn(),
    get: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
  storageHelper: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

jest.mock('../api/expenseApi', () => ({
  expenseApi: {
    initOrGetPeriod: jest.fn().mockResolvedValue({
      periodId: 'mock-period-id',
      taxYear: 2026,
      status: 'DRAFT',
      createdAt: '2026-01-01T00:00:00Z',
    }),
    getTaxDocumentTypes: jest.fn().mockResolvedValue([
      { code: 'MEDICAL_EXPENSE_INVOICE', name: 'Hóa đơn viện phí y tế', isTaxEligible: true },
      { code: 'EDUCATION_EXPENSE_INVOICE', name: 'Hóa đơn học phí giáo dục', isTaxEligible: true },
      { code: 'DONATION_VOUCHER', name: 'Chứng từ đóng góp từ thiện', isTaxEligible: true },
    ]),
  },
}));

import { useExpenseStore, DEFAULT_DOCUMENT_TYPES } from './useExpenseStore';

describe('useExpenseStore', () => {
  const currentYear = new Date().getFullYear();
  const nextYear = currentYear + 1;

  beforeEach(async () => {
    await useExpenseStore.getState().clearAllExpenses();
  });

  it('should initialize with default document types and empty tax years', () => {
    const state = useExpenseStore.getState();
    expect(state.selectedYear).toBeNull();
    expect(state.availableYears).toEqual([]);
    expect(state.documents).toEqual({});
    expect(state.documentTypes).toEqual(DEFAULT_DOCUMENT_TYPES);
  });

  it('should fetch document types from API successfully', async () => {
    const { fetchDocumentTypes } = useExpenseStore.getState();
    const types = await fetchDocumentTypes();

    expect(types).toHaveLength(3);
    expect(types[0].code).toBe('MEDICAL_EXPENSE_INVOICE');
    expect(useExpenseStore.getState().documentTypes).toEqual(types);
  });

  it('should allow adding a new year', () => {
    const { addYear } = useExpenseStore.getState();
    addYear(nextYear);

    const state = useExpenseStore.getState();
    expect(state.availableYears).toContain(nextYear);
    expect(state.selectedYear).toBe(nextYear);
    expect(state.documents[nextYear]).toEqual([]);
  });

  it('should allow removing a year', () => {
    const { addYear, removeYear } = useExpenseStore.getState();
    addYear(2025);
    addYear(2026);

    let state = useExpenseStore.getState();
    expect(state.availableYears).toContain(2025);
    expect(state.availableYears).toContain(2026);

    removeYear(2026);
    state = useExpenseStore.getState();
    expect(state.availableYears).not.toContain(2026);
    expect(state.availableYears).toContain(2025);
    expect(state.selectedYear).toBe(2025);
  });

  it('should add and update documents correctly', async () => {
    const { addYear, addOrUpdateDocument, confirmDocument, removeDocument } = useExpenseStore.getState();
    addYear(currentYear);

    await addOrUpdateDocument(currentYear, {
      documentId: 'doc-test-1',
      sellerName: 'Bệnh viện A',
      docTypeCode: 'MEDICAL_EXPENSE_INVOICE',
      totalAmount: 1000000,
      status: 'EXTRACTED',
    });

    let docs = useExpenseStore.getState().documents[currentYear];
    expect(docs).toHaveLength(1);
    expect(docs[0].sellerName).toBe('Bệnh viện A');
    expect(docs[0].status).toBe('EXTRACTED');

    // Confirm document
    await confirmDocument(currentYear, 'doc-test-1', { totalAmount: 1200000 });
    docs = useExpenseStore.getState().documents[currentYear];
    expect(docs[0].status).toBe('CONFIRMED');
    expect(docs[0].totalAmount).toBe(1200000);

    // Remove document
    await removeDocument(currentYear, 'doc-test-1');
    docs = useExpenseStore.getState().documents[currentYear];
    expect(docs).toHaveLength(0);
  });

  describe('dynamic threshold resolution based on admin system configs', () => {
    it('resolves category-specific threshold when configured by admin', () => {
      useExpenseStore.setState({
        systemConfigs: {
          AI_CONFIDENCE_THRESHOLD: '0.80',
          THRESHOLD_MEDICAL_EXPENSE_INVOICE: '0.85',
        },
      });

      const threshold = useExpenseStore.getState().getThresholdForCategory('MEDICAL_EXPENSE_INVOICE');
      expect(threshold).toBe(0.85);
    });

    it('falls back to general AI_CONFIDENCE_THRESHOLD when category has no specific threshold', () => {
      useExpenseStore.setState({
        systemConfigs: {
          AI_CONFIDENCE_THRESHOLD: '0.80',
          THRESHOLD_MEDICAL_EXPENSE_INVOICE: '0.85',
        },
      });

      const threshold = useExpenseStore.getState().getThresholdForCategory('VAT_INVOICE');
      expect(threshold).toBe(0.80);
    });

    it('falls back to safe default 0.80 when no configs are present', () => {
      useExpenseStore.setState({ systemConfigs: {} });

      const threshold = useExpenseStore.getState().getThresholdForCategory('UNKNOWN_TYPE');
      expect(threshold).toBe(0.80);
    });

    it('resolves crucial fields dynamically from admin configs', () => {
      useExpenseStore.setState({
        systemConfigs: {
          CRUCIAL_EXTRACTION_FIELDS: 'total_amount,seller_tax_code,buyer_id_card,invoice_number',
          CRUCIAL_FIELDS_CUSTOM: 'total_amount,seller_tax_code',
        },
      });

      const customFields = useExpenseStore.getState().getCrucialFieldsForCategory('CUSTOM');
      expect(customFields).toEqual(['total_amount', 'seller_tax_code']);

      const defaultFields = useExpenseStore.getState().getCrucialFieldsForCategory('OTHER');
      expect(defaultFields).toEqual(['total_amount', 'seller_tax_code', 'buyer_id_card', 'invoice_number']);
    });
  });
});

