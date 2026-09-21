import { create } from 'zustand';
import { storageHelper } from '../api/apiClient';
import { ExpenseOcrResult, TaxPeriodItem, TaxDocumentTypeItem } from '../types/expense';
import { expenseApi } from '../api/expenseApi';

const EXPENSE_STORAGE_KEY = 'taxkeep_expense_store_v6';

export const DEFAULT_DOCUMENT_TYPES: TaxDocumentTypeItem[] = [
  {
    code: 'MEDICAL_EXPENSE_INVOICE',
    name: 'Hóa đơn viện phí y tế',
    isTaxEligible: true,
  },
  {
    code: 'EDUCATION_EXPENSE_INVOICE',
    name: 'Hóa đơn học phí giáo dục',
    isTaxEligible: true,
  },
  {
    code: 'DONATION_VOUCHER',
    name: 'Chứng từ đóng góp từ thiện',
    isTaxEligible: true,
  },
  {
    code: 'INSURANCE_PREMIUM_RECEIPT',
    name: 'Bảo hiểm nhân thọ / hưu trí',
    isTaxEligible: true,
  },
  {
    code: 'SALES_INVOICE',
    name: 'Hóa đơn bán hàng',
    isTaxEligible: true,
  },
  {
    code: 'VAT_INVOICE',
    name: 'Hóa đơn GTGT',
    isTaxEligible: true,
  },
  {
    code: 'WITHHOLDING_VOUCHER',
    name: 'Chứng từ khấu trừ thuế TNCN',
    isTaxEligible: true,
  },
];

interface ExpenseState {
  selectedYear: number | null;
  availableYears: number[];
  periods: Record<number, TaxPeriodItem>;
  documents: Record<number, ExpenseOcrResult[]>;
  documentTypes: TaxDocumentTypeItem[];
  isDocumentTypesLoading: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  setSelectedYear: (year: number | null) => void;
  addYear: (year: number) => void;
  removeYear: (year: number) => void;
  initPeriodForYear: (year: number, userId?: string) => Promise<TaxPeriodItem>;
  fetchDocumentTypes: (isTaxEligible?: boolean) => Promise<TaxDocumentTypeItem[]>;
  addOrUpdateDocument: (year: number, document: ExpenseOcrResult) => Promise<void>;
  confirmDocument: (
    year: number,
    documentId: string,
    updatedFields?: Partial<ExpenseOcrResult>
  ) => Promise<void>;
  removeDocument: (year: number, documentId: string) => Promise<void>;
  clearAllExpenses: () => Promise<void>;
  saveToStorage: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
}

export const useExpenseStore = create<ExpenseState>((set, get) => ({
  selectedYear: null,
  availableYears: [],
  periods: {},
  documents: {},
  documentTypes: DEFAULT_DOCUMENT_TYPES,
  isDocumentTypesLoading: false,
  isLoading: false,
  error: null,

  setSelectedYear: (year: number | null) => {
    set({ selectedYear: year });
  },

  addYear: (year: number) => {
    const { availableYears, documents } = get();
    if (!availableYears.includes(year)) {
      const updatedYears = [year, ...availableYears].sort((a, b) => b - a);
      const updatedDocs = { ...documents, [year]: documents[year] || [] };
      set({ availableYears: updatedYears, selectedYear: year, documents: updatedDocs });
      get().saveToStorage();
    } else {
      set({ selectedYear: year });
    }
  },

  removeYear: (year: number) => {
    const { availableYears, selectedYear, documents, periods } = get();
    const updatedYears = availableYears.filter((y) => y !== year);
    const nextSelectedYear =
      selectedYear === year
        ? (updatedYears.length > 0 ? updatedYears[0] : null)
        : selectedYear;

    const updatedDocs = { ...documents };
    delete updatedDocs[year];
    const updatedPeriods = { ...periods };
    delete updatedPeriods[year];

    set({
      availableYears: updatedYears,
      selectedYear: nextSelectedYear,
      documents: updatedDocs,
      periods: updatedPeriods,
    });
    get().saveToStorage();
  },

  initPeriodForYear: async (year: number, userId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const period = await expenseApi.initOrGetPeriod(year, userId);
      set((state) => {
        const updatedPeriods = { ...state.periods, [year]: period };
        const updatedDocs = {
          ...state.documents,
          [year]: state.documents[year] || [],
        };
        return {
          periods: updatedPeriods,
          documents: updatedDocs,
          isLoading: false,
        };
      });
      // Lưu lại trạng thái
      get().saveToStorage();
      return period;
    } catch (err: any) {
      console.warn(`Lỗi khi khởi tạo TaxPeriod cho năm ${year}:`, err);
      // Tạo fallback local period object nếu API có trục trặc mạng
      const localPeriod: TaxPeriodItem = {
        periodId: `period-${year}-${Date.now()}`,
        taxYear: year,
        status: 'DRAFT',
        createdAt: new Date().toISOString(),
      };
      set((state) => ({
        periods: { ...state.periods, [year]: localPeriod },
        documents: { ...state.documents, [year]: state.documents[year] || [] },
        isLoading: false,
      }));
      return localPeriod;
    }
  },

  fetchDocumentTypes: async (isTaxEligible?: boolean) => {
    set({ isDocumentTypesLoading: true });
    try {
      const types = await expenseApi.getTaxDocumentTypes(isTaxEligible);
      if (Array.isArray(types) && types.length > 0) {
        set({ documentTypes: types, isDocumentTypesLoading: false });
        get().saveToStorage();
        return types;
      }
      set({ isDocumentTypesLoading: false });
      return get().documentTypes;
    } catch (err) {
      console.warn('Lỗi khi tải danh sách loại chứng từ thuế từ API:', err);
      set({ isDocumentTypesLoading: false });
      return get().documentTypes;
    }
  },

  addOrUpdateDocument: async (year: number, document: ExpenseOcrResult) => {
    const numYear = Number(year);
    set((state) => {
      const currentList = state.documents[numYear] || [];
      const docId = document.documentId || `doc-${Date.now()}`;
      const docToSave = { ...document, documentId: docId, extractedYear: numYear };

      const existingIndex = currentList.findIndex((d) => d.documentId === docId);
      let updatedList: ExpenseOcrResult[];

      if (existingIndex >= 0) {
        updatedList = [...currentList];
        updatedList[existingIndex] = { ...updatedList[existingIndex], ...docToSave };
      } else {
        updatedList = [docToSave, ...currentList];
      }

      // Đảm bảo năm luôn có trong availableYears và cập nhật selectedYear
      const updatedYears = state.availableYears.includes(numYear)
        ? state.availableYears
        : [numYear, ...state.availableYears].sort((a, b) => b - a);

      return {
        availableYears: updatedYears,
        selectedYear: numYear,
        documents: {
          ...state.documents,
          [numYear]: updatedList,
        },
      };
    });

    await get().saveToStorage();
  },

  confirmDocument: async (
    year: number,
    documentId: string,
    updatedFields?: Partial<ExpenseOcrResult>
  ) => {
    set((state) => {
      const currentList = state.documents[year] || [];
      const updatedList = currentList.map((doc) => {
        if (doc.documentId === documentId) {
          return {
            ...doc,
            ...updatedFields,
            status: 'CONFIRMED' as const,
          };
        }
        return doc;
      });

      return {
        documents: {
          ...state.documents,
          [year]: updatedList,
        },
      };
    });

    await get().saveToStorage();
  },

  removeDocument: async (year: number, documentId: string) => {
    set((state) => {
      const currentList = state.documents[year] || [];
      const updatedList = currentList.filter((doc) => doc.documentId !== documentId);
      return {
        documents: {
          ...state.documents,
          [year]: updatedList,
        },
      };
    });

    await get().saveToStorage();
  },

  clearAllExpenses: async () => {
    set({
      documents: {},
      availableYears: [],
      selectedYear: null,
      periods: {},
      documentTypes: DEFAULT_DOCUMENT_TYPES,
    });
    try {
      await storageHelper.removeItem(EXPENSE_STORAGE_KEY);
      await storageHelper.removeItem('taxkeep_expense_store_v1');
      await storageHelper.removeItem('taxkeep_expense_store_v2');
      await storageHelper.removeItem('taxkeep_expense_store_v3');
      await storageHelper.removeItem('taxkeep_expense_store_v4');
      await storageHelper.removeItem('taxkeep_expense_store_v5');
    } catch (e) {
      console.warn('Lỗi clear storage:', e);
    }
  },

  saveToStorage: async () => {
    try {
      const { availableYears, periods, documents, selectedYear, documentTypes } = get();
      const payload = JSON.stringify({
        availableYears,
        periods,
        documents,
        selectedYear,
        documentTypes,
      });
      await storageHelper.setItem(EXPENSE_STORAGE_KEY, payload);
    } catch (e) {
      console.warn('Lỗi lưu useExpenseStore vào storage:', e);
    }
  },

  loadFromStorage: async () => {
    try {
      const dataStr = await storageHelper.getItem(EXPENSE_STORAGE_KEY);
      if (dataStr) {
        const parsed = JSON.parse(dataStr);
        const loadedYears = Array.isArray(parsed.availableYears) ? parsed.availableYears : [];
        const nextSelected =
          parsed.selectedYear !== undefined &&
          parsed.selectedYear !== null &&
          loadedYears.includes(parsed.selectedYear)
            ? parsed.selectedYear
            : loadedYears.length > 0
            ? loadedYears[0]
            : null;

        set({
          availableYears: loadedYears,
          periods: parsed.periods || {},
          documents: parsed.documents || {},
          selectedYear: nextSelected,
          documentTypes:
            Array.isArray(parsed.documentTypes) && parsed.documentTypes.length > 0
              ? parsed.documentTypes
              : DEFAULT_DOCUMENT_TYPES,
        });
      } else {
        set({
          availableYears: [],
          selectedYear: null,
          periods: {},
          documents: {},
          documentTypes: DEFAULT_DOCUMENT_TYPES,
        });
      }
    } catch (e) {
      console.warn('Lỗi tải useExpenseStore từ storage:', e);
    }
  },
}));
