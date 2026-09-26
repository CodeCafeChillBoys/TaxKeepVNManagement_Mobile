import { create } from 'zustand';
import { storageHelper } from '../api/apiClient';
import { ExpenseOcrResult, TaxPeriodItem, TaxDocumentTypeItem } from '../types/expense';
import { expenseApi } from '../api/expenseApi';

const EXPENSE_STORAGE_KEY = 'taxkeep_expense_store_v6';

// Danh mục loại chứng từ được tải trực tiếp từ DB của admin qua API /tax-document-types
export const DEFAULT_DOCUMENT_TYPES: TaxDocumentTypeItem[] = [];

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
  initPeriodForYear: (year: number, userId?: string) => Promise<TaxPeriodItem | null>;
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
  documentTypes: [],
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

      // Tải danh sách chứng từ từ server cho kỳ tính thuế này
      let serverDocs: ExpenseOcrResult[] | null = null;
      try {
        if (period?.periodId) {
          const docsPaged = await expenseApi.getDocumentsByPeriod(period.periodId, { size: 100 });
          const docList = Array.isArray(docsPaged) ? docsPaged : (docsPaged as any)?.items || [];
          if (Array.isArray(docList) && docList.length > 0) {
            serverDocs = docList.map((doc: any) => ({
              id: doc.id,
              documentId: doc.id,
              periodId: doc.periodId,
              docTypeCode: doc.docTypeCode,
              docTypeName:
                doc.docTypeName ||
                get().documentTypes.find((t) => t.code === doc.docTypeCode)?.name ||
                (doc.docTypeCode ? doc.docTypeCode : 'Chứng từ chi phí'),
              fileUrl: doc.fileUrl,
              originalFilename: doc.originalFilename || 'invoice.jpg',
              sellerName: doc.sellerName,
              sellerTaxCode: doc.sellerTaxCode,
              sellerAddress: doc.sellerAddress,
              sellerPhone: doc.sellerPhone,
              invoiceSeries: doc.invoiceSeries,
              invoiceNumber: doc.invoiceNumber,
              invoiceDate: doc.invoiceDate,
              extractedYear: doc.extractedYear || year,
              lookupUrl: doc.lookupUrl,
              lookupCode: doc.lookupCode,
              buyerName: doc.buyerName,
              buyerTaxCode: doc.buyerTaxCode,
              buyerIdCard: doc.buyerIdCard,
              buyerAddress: doc.buyerAddress,
              paymentMethod: doc.paymentMethod || 'Chuyển khoản',
              totalAmount: doc.totalAmount ?? 0,
              totalAmountInWords: doc.totalAmountInWords,
              items: (doc.items || []).map((it: any, idx: number) => ({
                itemOrder: it.itemOrder || idx + 1,
                itemName: it.itemName,
                unit: it.unit,
                quantity: it.quantity,
                unitPrice: it.unitPrice,
                totalPrice: it.totalPrice,
              })),
              overallConfidence: 0.95,
              appliedThreshold: 0.8,
              isPassedThreshold: true,
              hasCrucialLowConfidence: false,
              fields: [],
              qualityEvaluation: {
                qualityScore: 0.95,
                requiredThreshold: 0.75,
                qualityIssues: [],
                isPassedQuality: true,
              },
              validationStatus: {
                isYearValid: doc.isYearValid ?? true,
                isDocTypeValid: doc.isTaxEligible ?? true,
                isIdentityValid: doc.isIdentityValid ?? true,
                isPassedThreshold: true,
              },
              validationErrors: [],
              isNotReimbursed: doc.isNotReimbursed ?? false,
              status:
                doc.status === 'CONFIRMED'
                  ? 'CONFIRMED'
                  : doc.status === 'FAILED' &&
                    (doc.sellerName || (doc.totalAmount !== undefined && doc.totalAmount !== null && Number(doc.totalAmount) > 0))
                  ? 'EXTRACTED'
                  : doc.status || 'EXTRACTED',
              createdAt: doc.createdAt,
            }));
          }
        }
      } catch (fetchErr) {
        console.warn(`Không thể tải documents từ server cho kỳ ${period?.periodId}:`, fetchErr);
      }

      set((state) => {
        const updatedPeriods = { ...state.periods, [year]: period };
        const updatedYears = state.availableYears.includes(year)
          ? state.availableYears
          : [year, ...state.availableYears].sort((a, b) => b - a);

        const currentYearDocs = state.documents[year] || [];
        let finalDocs = currentYearDocs;
        if (serverDocs !== null) {
          const serverDocIds = new Set(serverDocs.map((d) => d.documentId));
          const localOnlyDocs = currentYearDocs.filter(
            (d) => d.documentId && !serverDocIds.has(d.documentId) && d.documentId.startsWith('doc-')
          );
          finalDocs = [...serverDocs, ...localOnlyDocs];
        }

        return {
          periods: updatedPeriods,
          documents: {
            ...state.documents,
            [year]: finalDocs,
          },
          availableYears: updatedYears,
          selectedYear: state.selectedYear || year,
          isLoading: false,
        };
      });

      get().saveToStorage();
      return period;
    } catch {
      set({
        isLoading: false,
        error: `Chưa tạo được hồ sơ quyết toán năm ${year}. Kiểm tra kết nối mạng rồi thử lại.`,
      });
      return null;
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
    } catch {
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
