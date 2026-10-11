import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  Modal,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { HeaderMotif } from '../../components/common/HeaderMotif';
import { DrumPatternBackdrop } from '../../components/brand/DrumPatternBackdrop';
import { RootNavigationProp, RootStackParamList } from '../../navigation/types';
import { ExpenseOcrResult, InvoiceLineItem, ValidationErrorItem } from '../../types/expense';
import {
  formatCurrencyVND,
  calculateItemsTotal,
  validateCrucialFields,
  getValidationMatrixErrorDetails,
} from './expenseValidationUtils';
import { expenseApi } from '../../api/expenseApi';
import { useExpenseStore } from '../../stores/useExpenseStore';
import {
  getGroupKeyFromDocTypeCode,
  getGroupMetadata,
  getDocumentTypeIcon,
  isWithholdingDocType,
} from './expenseGroupUtils';
import { incomeSourceApi, IncomeSourceCrossCheckResult } from '../../api/incomeSourceApi';
import { formatMoneyInput, parseMoney } from '../income/incomeFormUtils';
import {
  Card,
  Badge,
  Separator,
  useToast,
} from '../../components/ui';
import { Dialog } from '../../components/common/Dialog';
import { parseBackendError } from './expenseValidationUtils';

type TabType = 'KIEM_TRA' | 'THONG_TIN';

export const ExpenseReviewScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, any>>();
  const initialData: ExpenseOcrResult = route.params?.ocrResult || {};
  const periodIdParam = route.params?.periodId || initialData.periodId;

  const { toast } = useToast();
  const {
    addOrUpdateDocument,
    removeDocument,
    setSelectedYear,
    documentTypes,
    fetchDocumentTypes,
    systemConfigs,
    fetchSystemConfigs,
    getThresholdForCategory,
    getCrucialFieldsForCategory,
    documents,
    selectedYear,
    periods,
  } = useExpenseStore();

  const activeTaxYear = selectedYear || initialData.extractedYear || new Date().getFullYear();
  const activePeriod = periods[activeTaxYear];
  const isPeriodSubmitted = activePeriod?.status === 'SUBMITTED';

  const isConfirmed = initialData.status === 'CONFIRMED';
  const isRouteReadOnly = Boolean(route.params?.isReadOnly || isConfirmed || isPeriodSubmitted);

  const [currentDocTypeCode, setCurrentDocTypeCode] = useState<string>(
    initialData.docTypeCode || (documentTypes && documentTypes.length > 0 ? documentTypes[0].code : '')
  );
  const [showDocTypeModal, setShowDocTypeModal] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<TabType>('KIEM_TRA');

  useEffect(() => {
    fetchDocumentTypes();
    fetchSystemConfigs();
  }, [fetchDocumentTypes, fetchSystemConfigs]);

  // Kiểm tra tính tồn tại của chứng từ trên máy chủ, nếu đã xóa trong DB thì quay lại
  useEffect(() => {
    const isGuid = (val?: string) => !!val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
    if (isGuid(periodIdParam) && isGuid(initialData.documentId)) {
      expenseApi.getDocumentById(periodIdParam!, initialData.documentId!).catch(async (err) => {
        if (err?.response?.status === 404) {
          toast.error('Chứng từ này đã bị xóa hoặc không còn tồn tại trong hệ thống.', 'Chứng từ không tồn tại');
          if (selectedYear && initialData.documentId) {
            await removeDocument(selectedYear, initialData.documentId);
          }
          navigation.goBack();
        }
      });
    }
  }, [periodIdParam, initialData.documentId]);

  const groupKey = getGroupKeyFromDocTypeCode(currentDocTypeCode);
  const groupMeta = getGroupMetadata(groupKey);
  const currentDocTypeItem = documentTypes.find((t) => t.code === currentDocTypeCode);
  const currentDocTypeName = currentDocTypeItem?.name || initialData.docTypeName || groupMeta.name;

  // Xác định linh hoạt loại chứng từ có phải là Chứng từ khấu trừ thuế TNCN hay không
  const isWithholding = useMemo(
    () => isWithholdingDocType(currentDocTypeCode, currentDocTypeName),
    [currentDocTypeCode, currentDocTypeName]
  );

  // Form state chung
  const [sellerName, setSellerName] = useState<string>(initialData.sellerName || '');
  const [sellerTaxCode, setSellerTaxCode] = useState<string>(initialData.sellerTaxCode || '');
  const [sellerAddress, setSellerAddress] = useState<string>(initialData.sellerAddress || '');
  const [sellerPhone, setSellerPhone] = useState<string>(initialData.sellerPhone || '');
  const [invoiceSeries, setInvoiceSeries] = useState<string>(initialData.invoiceSeries || '');
  const [invoiceNumber, setInvoiceNumber] = useState<string>(initialData.invoiceNumber || '');
  const [invoiceDate, setInvoiceDate] = useState<string>(initialData.invoiceDate || '');
  const [lookupUrl, setLookupUrl] = useState<string>(initialData.lookupUrl || '');
  const [lookupCode, setLookupCode] = useState<string>(initialData.lookupCode || '');
  const [buyerName, setBuyerName] = useState<string>(initialData.buyerName || '');
  const [buyerIdCard, setBuyerIdCard] = useState<string>(initialData.buyerIdCard || '');
  const [buyerAddress, setBuyerAddress] = useState<string>(initialData.buyerAddress || '');

  // Form state riêng cho Hóa đơn thông thường
  const [paymentMethod, setPaymentMethod] = useState<string>(initialData.paymentMethod || 'Chuyển khoản');
  const [items, setItems] = useState<InvoiceLineItem[]>(initialData.items || []);
  const [isNotReimbursed, setIsNotReimbursed] = useState<boolean>(initialData.isNotReimbursed ?? true);

  // Form state riêng cho Chứng từ khấu trừ thuế TNCN
  const [buyerTaxCode, setBuyerTaxCode] = useState<string>(initialData.buyerTaxCode || '');
  const [incomeYear, setIncomeYear] = useState<string>(
    String(initialData.incomeYear || initialData.extractedYear || activeTaxYear)
  );
  const [totalIncomeStr, setTotalIncomeStr] = useState<string>(
    initialData.totalIncome != null ? formatMoneyInput(String(Math.round(Number(initialData.totalIncome)))) : ''
  );
  const [taxWithheldStr, setTaxWithheldStr] = useState<string>(
    initialData.taxWithheld != null ? formatMoneyInput(String(Math.round(Number(initialData.taxWithheld)))) : ''
  );
  const [insuranceDeductedStr, setInsuranceDeductedStr] = useState<string>(
    initialData.insuranceDeducted != null ? formatMoneyInput(String(Math.round(Number(initialData.insuranceDeducted)))) : ''
  );

  // State đối chiếu số liệu (Cross-check) với thu nhập theo tháng
  const [checkingCrossCheck, setCheckingCrossCheck] = useState<boolean>(false);
  const [crossCheckResult, setCrossCheckResult] = useState<IncomeSourceCrossCheckResult | null>(
    route.params?.crossCheckResult || (initialData as any).crossCheckResult || null
  );
  const [crossCheckError, setCrossCheckError] = useState<string | null>(null);

  const [saving, setSaving] = useState<boolean>(false);
  const [invoiceImageUri, setInvoiceImageUri] = useState<string | undefined>(
    initialData.fileUrl || initialData.originalFileUri
  );
  const [invoiceImageFailed, setInvoiceImageFailed] = useState<boolean>(false);

  // Item modal state (chỉ dùng cho hóa đơn)
  const [itemModalVisible, setItemModalVisible] = useState<boolean>(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [itemFormName, setItemFormName] = useState<string>('');
  const [itemFormUnit, setItemFormUnit] = useState<string>('');
  const [itemFormQty, setItemFormQty] = useState<string>('1');
  const [itemFormPrice, setItemFormPrice] = useState<string>('0');

  const itemsSum = calculateItemsTotal(items);
  const [totalAmount, setTotalAmount] = useState<number>(() => {
    if (initialData.totalAmount !== undefined && initialData.totalAmount !== null && Number(initialData.totalAmount) > 0) {
      return Number(initialData.totalAmount);
    }
    return calculateItemsTotal(initialData.items || []);
  });

  // Modal confirm action states
  const [showSaveConfirmModal, setShowSaveConfirmModal] = useState<boolean>(false);
  const [deleteItemIndex, setDeleteItemIndex] = useState<number | null>(null);

  // Khi chuyển sang loại chứng từ khác không phải khấu trừ thuế thì xóa kết quả đối chiếu
  useEffect(() => {
    if (!isWithholding) {
      setCrossCheckResult(null);
      setCrossCheckError(null);
    }
  }, [isWithholding]);

  // Truy vấn ngưỡng trực tiếp từ API Backend (test-resolve) nếu có kết nối mạng
  const [serverResolvedThreshold, setServerResolvedThreshold] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (currentDocTypeCode) {
      expenseApi
        .resolveThreshold(currentDocTypeCode)
        .then((res) => {
          if (isMounted && res && typeof res.resolved_threshold === 'number') {
            setServerResolvedThreshold(res.resolved_threshold);
          }
        })
        .catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, [currentDocTypeCode]);

  // Ngưỡng trích xuất OCR động lấy từ cấu hình Admin
  const dynamicThreshold = useMemo(() => {
    if (serverResolvedThreshold !== null) {
      return serverResolvedThreshold;
    }
    return getThresholdForCategory(currentDocTypeCode);
  }, [serverResolvedThreshold, getThresholdForCategory, currentDocTypeCode, systemConfigs]);

  // Danh sách trường cốt lõi theo cấu hình Admin
  const effectiveCrucialFields = useMemo(() => {
    if (isWithholding) {
      return [
        'seller_name',
        'seller_tax_code',
        'buyer_name',
        'buyer_id_card',
        'total_income',
        'tax_withheld',
      ];
    }
    return getCrucialFieldsForCategory(currentDocTypeCode);
  }, [getCrucialFieldsForCategory, currentDocTypeCode, systemConfigs, isWithholding]);

  const effectiveConfidence = initialData.overallConfidence !== undefined ? initialData.overallConfidence : 0.95;

  const crucialCheck = useMemo(() => {
    return validateCrucialFields(initialData.fields || [], dynamicThreshold, effectiveCrucialFields);
  }, [initialData.fields, dynamicThreshold, effectiveCrucialFields]);

  const isPassedThreshold = effectiveConfidence >= dynamicThreshold && !crucialCheck.hasCrucialLowConfidence;

  // Ánh xạ nhãn tiếng Việt cho các trường cốt lõi
  const CRUCIAL_FIELD_LABELS: Record<string, string> = {
    total_amount: 'Tổng tiền thanh toán',
    seller_tax_code: isWithholding ? 'Mã số thuế tổ chức chi trả' : 'Mã số thuế bên bán',
    buyer_id_card: isWithholding ? 'Số CCCD người nộp thuế' : 'Số CCCD người mua',
    invoice_number: isWithholding ? 'Số chứng từ khấu trừ' : 'Số hóa đơn',
    seller_name: isWithholding ? 'Tổ chức chi trả thu nhập' : 'Tên đơn vị bán',
    invoice_date: isWithholding ? 'Ngày cấp chứng từ' : 'Ngày lập hóa đơn',
    buyer_name: isWithholding ? 'Họ tên người nộp thuế' : 'Họ tên người mua',
    buyer_tax_code: 'Mã số thuế cá nhân',
    total_income: 'Tổng thu nhập chịu thuế',
    tax_withheld: 'Số thuế đã khấu trừ',
  };

  const crucialDisplayItems = useMemo(() => {
    return effectiveCrucialFields.map((fieldKey) => {
      const normKey = fieldKey.trim().toLowerCase();
      const label = CRUCIAL_FIELD_LABELS[normKey] || fieldKey;
      const matchingField = (initialData.fields || []).find((f) => {
        const fNorm = f.fieldName.toLowerCase().replace(/([A-Z])/g, '_$1').toLowerCase();
        return fNorm.includes(normKey) || normKey.includes(fNorm);
      });
      const isLowConfidence = matchingField
        ? matchingField.confidenceScore < dynamicThreshold
        : (crucialCheck.lowConfidenceCrucialFields || []).some(
            (lf) => lf.toLowerCase().includes(normKey) || normKey.includes(lf.toLowerCase())
          );

      return {
        key: fieldKey,
        label,
        isLowConfidence,
      };
    });
  }, [effectiveCrucialFields, initialData.fields, dynamicThreshold, crucialCheck, isWithholding]);

  const isDuplicate = useMemo(() => {
    const year = isWithholding
      ? (parseInt(incomeYear.trim(), 10) || selectedYear || initialData.extractedYear || new Date().getFullYear())
      : (selectedYear || initialData.extractedYear || new Date().getFullYear());
    const currentYearDocs = documents[year] || [];
    const normInv = invoiceNumber.trim().toLowerCase();
    const normSeller = sellerTaxCode.trim().toLowerCase();
    if (!normInv || !normSeller) return false;

    return currentYearDocs.some(
      (d) =>
        (d.documentId !== initialData.documentId && d.id !== initialData.id) &&
        d.invoiceNumber?.trim().toLowerCase() === normInv &&
        d.sellerTaxCode?.trim().toLowerCase() === normSeller
    );
  }, [documents, selectedYear, initialData, invoiceNumber, sellerTaxCode, isWithholding, incomeYear]);

  const isIdentityMismatch = initialData.validationStatus?.isIdentityValid === false;
  const isValidationBlocked = isDuplicate || isIdentityMismatch;
  const isReadOnly = Boolean(isRouteReadOnly || isValidationBlocked);

  const validationErrors = useMemo<ValidationErrorItem[]>(() => {
    const list = [...(initialData.validationErrors || [])];

    if (initialData.validationStatus?.isIdentityValid === false && !list.some((e) => e.code === 'ERR_IDENTITY_MISMATCH')) {
      list.push({
        code: 'ERR_IDENTITY_MISMATCH',
        field: 'buyer_name',
        message: 'Thông tin cá nhân trên chứng từ (' + (buyerName.trim() || initialData.buyerName || 'Trống') + ') không khớp với Người nộp thuế hoặc bất kỳ Người phụ thuộc nào đã đăng ký.',
        severity: 'error',
      });
    }

    if (isDuplicate && !list.some((e) => e.code === 'ERR_DUPLICATE_DOCUMENT')) {
      list.push({
        code: 'ERR_DUPLICATE_DOCUMENT',
        field: 'invoice_number',
        message: (isWithholding ? 'Chứng từ số ' : 'Hóa đơn số ') + invoiceNumber.trim() + ' (MST: ' + sellerTaxCode.trim() + ') đã tồn tại trong kỳ tính thuế này.',
        severity: 'error',
      });
    }

    return list;
  }, [initialData, buyerName, isDuplicate, invoiceNumber, sellerTaxCode, isWithholding]);

  // Xử lý dòng hàng hóa/dịch vụ (cho Hóa đơn)
  const handleOpenItemModal = (index?: number) => {
    if (isReadOnly) return;
    if (index !== undefined && items[index]) {
      setEditingItemIndex(index);
      setItemFormName(items[index].itemName);
      setItemFormUnit(items[index].unit || '');
      setItemFormQty(String(items[index].quantity || 1));
      setItemFormPrice(String(items[index].unitPrice || 0));
    } else {
      setEditingItemIndex(null);
      setItemFormName('');
      setItemFormUnit('Lần');
      setItemFormQty('1');
      setItemFormPrice('');
    }
    setItemModalVisible(true);
  };

  const handleSaveItem = () => {
    if (!itemFormName.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên dịch vụ / khoản mục.');
      return;
    }
    const qty = parseFloat(itemFormQty) || 1;
    const price = parseFloat(itemFormPrice) || 0;
    const newItem: InvoiceLineItem = {
      itemOrder: editingItemIndex !== null ? items[editingItemIndex].itemOrder : items.length + 1,
      itemName: itemFormName.trim(),
      unit: itemFormUnit.trim() || 'Lần',
      quantity: qty,
      unitPrice: price,
      totalPrice: qty * price,
    };
    if (editingItemIndex !== null) {
      const updated = [...items];
      updated[editingItemIndex] = newItem;
      setItems(updated);
    } else {
      setItems([...items, newItem]);
    }
    setItemModalVisible(false);
  };

  const handleDeleteItem = (index: number) => {
    if (isReadOnly) return;
    setDeleteItemIndex(index);
  };

  // Hàm gọi đối chiếu thu nhập theo tháng
  const handleCrossCheck = async (options?: { silent?: boolean }) => {
    const isSilent = !!options?.silent;
    const compName = sellerName.trim();
    const taxYr = parseInt(incomeYear.trim(), 10) || activeTaxYear;
    const inc = parseMoney(totalIncomeStr);
    const tax = parseMoney(taxWithheldStr);
    const ins = parseMoney(insuranceDeductedStr);

    if (!compName) {
      if (!isSilent) toast.warning('Vui lòng nhập tên tổ chức chi trả để thực hiện đối chiếu.', 'Thiếu thông tin');
      return;
    }
    if (!taxYr || isNaN(taxYr) || taxYr < 2000 || taxYr > 2100) {
      if (!isSilent) toast.warning('Năm tính thuế không hợp lệ.', 'Năm không hợp lệ');
      return;
    }
    if (inc === null) {
      if (!isSilent) toast.warning('Vui lòng nhập tổng thu nhập chịu thuế [17].', 'Thiếu số liệu');
      return;
    }

    setCheckingCrossCheck(true);
    setCrossCheckError(null);
    try {
      const res = await incomeSourceApi.crossCheck({
        companyName: compName,
        taxYear: taxYr,
        certificateTotalIncome: inc,
        certificateTaxWithheld: tax ?? 0,
        certificateInsuranceDeducted: ins ?? 0,
      });
      setCrossCheckResult(res);
      if (!isSilent) {
        if (res.isMatch) {
          toast.success('Số liệu chứng từ khớp với dữ liệu hệ thống!', 'Đối chiếu khớp 100%');
        } else {
          toast.warning(
            res.mismatchMessages && res.mismatchMessages.length > 0
              ? res.mismatchMessages[0]
              : 'Số liệu chứng từ có chênh lệch so với thu nhập đã khai theo tháng.',
            'Số liệu chưa khớp'
          );
        }
      }
    } catch (err: any) {
      const parsed = parseBackendError(err);
      setCrossCheckError(parsed.message);
      if (!isSilent) {
        toast.error(parsed.message, parsed.title);
      }
    } finally {
      setCheckingCrossCheck(false);
    }
  };

  // Tự động đối chiếu số liệu ngay khi mở màn hình (áp dụng cho cả soát xét và xem lại sau khi duyệt) nếu chưa có kết quả
  useEffect(() => {
    if (isWithholding && !crossCheckResult && !checkingCrossCheck) {
      const compName = sellerName.trim();
      const taxYr = parseInt(incomeYear.trim(), 10) || activeTaxYear;
      const inc = parseMoney(totalIncomeStr);
      if (compName && taxYr && inc !== null) {
        handleCrossCheck({ silent: true });
      }
    }
  }, [isWithholding]);

  // Tự động đối chiếu lại theo thời gian thực (debounce 700ms) khi người dùng chỉnh sửa thông tin tài chính
  useEffect(() => {
    if (!isWithholding || isReadOnly) return;
    const compName = sellerName.trim();
    const taxYr = parseInt(incomeYear.trim(), 10) || activeTaxYear;
    const inc = parseMoney(totalIncomeStr);
    if (!compName || !taxYr || inc === null) return;

    const timer = setTimeout(() => {
      handleCrossCheck({ silent: true });
    }, 700);

    return () => clearTimeout(timer);
  }, [sellerName, incomeYear, totalIncomeStr, taxWithheldStr, insuranceDeductedStr, isWithholding, isReadOnly]);

  // Thực thi Xác nhận và Lưu chứng từ
  const executeConfirm = async () => {
    if (isReadOnly) return;

    if (isPeriodSubmitted) {
      toast.error(
        `Kỳ quyết toán thuế năm ${activeTaxYear} đã hoàn tất và bị khóa. Không thể chỉnh sửa chứng từ.`,
        'Kỳ tính thuế đã khóa'
      );
      return;
    }

    if (isIdentityMismatch) {
      toast.error(
        'Thông tin cá nhân trên chứng từ ("' + (buyerName.trim() || initialData.buyerName || 'Chưa rõ') + '") không khớp với Người nộp thuế hoặc Người phụ thuộc trong hồ sơ.',
        'Họ tên không khớp'
      );
      return;
    }

    if (isDuplicate) {
      toast.error(
        (isWithholding ? 'Chứng từ số ' : 'Hóa đơn số ') + invoiceNumber.trim() + ' của đơn vị có MST ' + sellerTaxCode.trim() + ' đã tồn tại trong kỳ tính thuế này.',
        'Chứng từ bị trùng lặp'
      );
      return;
    }

    // Validate riêng biệt theo loại
    if (isWithholding) {
      // 1. Validate Chứng từ khấu trừ thuế TNCN
      const missingVoucherFields: string[] = [];
      if (!sellerName.trim()) missingVoucherFields.push('Tên tổ chức chi trả');
      if (!sellerTaxCode.trim()) missingVoucherFields.push('Mã số thuế tổ chức chi trả');
      if (!buyerName.trim()) missingVoucherFields.push('Họ và tên người nộp thuế');
      if (!buyerIdCard.trim()) missingVoucherFields.push('Số CCCD người nộp thuế');

      const yrNum = parseInt(incomeYear.trim(), 10);
      if (!incomeYear.trim() || isNaN(yrNum) || yrNum < 2000 || yrNum > 2100) {
        missingVoucherFields.push('Năm tính thuế thu nhập hợp lệ (VD: 2024, 2025)');
      }

      const parsedInc = parseMoney(totalIncomeStr);
      const parsedTax = parseMoney(taxWithheldStr);
      const parsedIns = parseMoney(insuranceDeductedStr);

      if (parsedInc === null || parsedInc <= 0) {
        missingVoucherFields.push('Tổng thu nhập chịu thuế [17] (> 0)');
      }
      if (parsedTax === null || parsedTax < 0) {
        missingVoucherFields.push('Thuế TNCN đã khấu trừ [19] (>= 0)');
      } else if (parsedInc !== null && parsedTax > parsedInc) {
        toast.error('Thuế đã khấu trừ không thể lớn hơn tổng thu nhập chịu thuế.', 'Sai lệch số liệu');
        return;
      }
      if (parsedIns === null || parsedIns < 0) {
        missingVoucherFields.push('Bảo hiểm bắt buộc đã trừ [14] (>= 0)');
      }

      if (missingVoucherFields.length > 0) {
        setActiveTab('THONG_TIN');
        toast.error(
          `Vui lòng bổ sung các thông tin bắt buộc: ${missingVoucherFields.join(', ')}.`,
          'Thiếu thông tin chứng từ'
        );
        return;
      }
    } else {
      // 2. Validate Hóa đơn chi phí
      if (currentDocTypeItem && !currentDocTypeItem.isTaxEligible) {
        toast.error(
          `Loại chứng từ '${currentDocTypeItem.name}' không thuộc diện được giảm trừ thuế TNCN theo quy định. Vui lòng chọn danh mục hợp lệ.`,
          'Danh mục không được giảm trừ'
        );
        return;
      }

      const missingBuyerFields: string[] = [];
      if (!buyerName.trim()) missingBuyerFields.push('Họ và tên');
      if (!buyerIdCard.trim()) missingBuyerFields.push('Số CCCD');
      if (!buyerAddress.trim()) missingBuyerFields.push('Địa chỉ');
      if (!paymentMethod.trim()) missingBuyerFields.push('Hình thức thanh toán');

      if (missingBuyerFields.length > 0) {
        setActiveTab('THONG_TIN');
        toast.error(
          `Vui lòng điền đầy đủ thông tin người thanh toán: ${missingBuyerFields.join(', ')}.`,
          'Thiếu thông tin người thanh toán'
        );
        return;
      }

      if (totalAmount <= 0) {
        toast.error('Tổng tiền thanh toán của hóa đơn phải lớn hơn 0.', 'Số tiền không hợp lệ');
        return;
      }
    }

    setSaving(true);
    try {
      const cleanDate = invoiceDate.trim();
      const validDate = cleanDate.match(/^\d{4}-\d{2}-\d{2}$/) ? cleanDate : undefined;
      const currentTaxYear = new Date().getFullYear();

      // Xác định năm quyết toán: Với chứng từ khấu trừ lấy từ incomeYear (thời điểm trả thu nhập), với hóa đơn lấy từ ngày lập
      const targetDocYear = isWithholding
        ? (parseInt(incomeYear.trim(), 10) || Number(initialData.extractedYear) || currentTaxYear)
        : (validDate ? parseInt(validDate.substring(0, 4), 10) : Number(initialData.extractedYear) || currentTaxYear);

      const finalDocId = initialData.documentId || `doc-${Date.now()}`;
      const isGuid = (val?: string) => !!val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

      if (isGuid(periodIdParam) && isGuid(initialData.documentId)) {
        try {
          if (isWithholding) {
            // Payload cho Chứng từ khấu trừ thuế TNCN
            const parsedInc = parseMoney(totalIncomeStr) ?? 0;
            const parsedTax = parseMoney(taxWithheldStr) ?? 0;
            const parsedIns = parseMoney(insuranceDeductedStr) ?? 0;

            await expenseApi.confirmDocumentReview(periodIdParam!, initialData.documentId!, {
              docTypeCode: currentDocTypeCode ? currentDocTypeCode.trim().toUpperCase() : 'WITHHOLDING_VOUCHER',
              sellerName: sellerName.trim() || null,
              sellerTaxCode: sellerTaxCode.trim() || null,
              sellerAddress: sellerAddress.trim() || null,
              sellerPhone: sellerPhone.trim() || null,
              invoiceSeries: invoiceSeries.trim() || null,
              invoiceNumber: invoiceNumber.trim() || null,
              invoiceDate: validDate,
              extractedYear: targetDocYear,
              incomeYear: targetDocYear,
              lookupUrl: lookupUrl.trim() || null,
              lookupCode: lookupCode.trim() || null,
              buyerName: buyerName.trim() || null,
              buyerTaxCode: buyerTaxCode.trim() || null,
              buyerIdCard: buyerIdCard.trim() || null,
              buyerAddress: buyerAddress.trim() || null,
              paymentMethod: null,
              totalAmount: null,
              totalIncome: parsedInc,
              taxWithheld: parsedTax,
              insuranceDeducted: parsedIns,
              isYearValid: initialData.validationStatus?.isYearValid ?? true,
              isIdentityValid: initialData.validationStatus?.isIdentityValid ?? true,
              isNotReimbursed: true,
              items: [],
            });
          } else {
            // Payload cho Hóa đơn chi phí
            await expenseApi.confirmDocumentReview(periodIdParam!, initialData.documentId!, {
              docTypeCode: currentDocTypeCode ? currentDocTypeCode.trim().toUpperCase() : null,
              sellerName: sellerName.trim() || null,
              sellerTaxCode: sellerTaxCode.trim() || null,
              sellerAddress: sellerAddress.trim() || null,
              sellerPhone: sellerPhone.trim() || null,
              invoiceSeries: invoiceSeries.trim() || null,
              invoiceNumber: invoiceNumber.trim() || null,
              invoiceDate: validDate,
              extractedYear: targetDocYear,
              incomeYear: targetDocYear,
              lookupUrl: lookupUrl.trim() || null,
              lookupCode: lookupCode.trim() || null,
              buyerName: buyerName.trim() || null,
              buyerTaxCode: buyerTaxCode.trim() || null,
              buyerIdCard: buyerIdCard.trim() || null,
              buyerAddress: buyerAddress.trim() || null,
              paymentMethod: paymentMethod.trim() || null,
              totalAmount: totalAmount || null,
              isYearValid: initialData.validationStatus?.isYearValid ?? true,
              isIdentityValid: initialData.validationStatus?.isIdentityValid ?? true,
              isNotReimbursed: isNotReimbursed,
              items: items.map((it, idx) => ({
                itemOrder: it.itemOrder || idx + 1,
                itemName: it.itemName,
                unit: it.unit || null,
                quantity: it.quantity ?? null,
                unitPrice: it.unitPrice ?? null,
                totalPrice: it.totalPrice ?? null,
              })),
            });
          }
        } catch (apiErr: any) {
          setSaving(false);
          const parsed = parseBackendError(apiErr);
          toast.error(parsed.message, parsed.title);
          return;
        }
      }

      const confirmedDocument: ExpenseOcrResult = {
        ...initialData,
        documentId: finalDocId,
        docTypeCode: currentDocTypeCode ? currentDocTypeCode.trim().toUpperCase() : (isWithholding ? 'WITHHOLDING_VOUCHER' : null),
        docTypeName: currentDocTypeName,
        sellerName: sellerName.trim() || (isWithholding ? 'Tổ chức chi trả thu nhập' : 'Đơn vị phát hành'),
        sellerTaxCode: sellerTaxCode.trim(),
        sellerAddress: sellerAddress.trim(),
        sellerPhone: sellerPhone.trim(),
        invoiceSeries: invoiceSeries.trim(),
        invoiceNumber: invoiceNumber.trim(),
        invoiceDate: validDate || invoiceDate.trim(),
        extractedYear: targetDocYear,
        incomeYear: isWithholding ? targetDocYear : undefined,
        lookupUrl: lookupUrl.trim(),
        lookupCode: lookupCode.trim(),
        buyerName: buyerName.trim(),
        buyerTaxCode: buyerTaxCode.trim(),
        buyerIdCard: buyerIdCard.trim(),
        buyerAddress: buyerAddress.trim(),
        paymentMethod: isWithholding ? null : paymentMethod.trim(),
        totalAmount: isWithholding ? null : totalAmount,
        totalIncome: isWithholding ? (parseMoney(totalIncomeStr) ?? 0) : undefined,
        taxWithheld: isWithholding ? (parseMoney(taxWithheldStr) ?? 0) : undefined,
        insuranceDeducted: isWithholding ? (parseMoney(insuranceDeductedStr) ?? 0) : undefined,
        items: isWithholding ? [] : items,
        isNotReimbursed: isWithholding ? true : isNotReimbursed,
        appliedThreshold: dynamicThreshold,
        overallConfidence: effectiveConfidence,
        isPassedThreshold: isPassedThreshold,
        crossCheckResult: crossCheckResult || null,
        status: 'CONFIRMED',
      };

      await addOrUpdateDocument(targetDocYear, confirmedDocument);
      setSelectedYear(targetDocYear);
      setSaving(false);

      if (isWithholding) {
        toast.success(`Chứng từ khấu trừ đã được lưu vào hồ sơ quyết toán năm ${targetDocYear}.`, 'Xác nhận thành công');
      } else {
        toast.success(`Hóa đơn đã được lưu vào danh mục "${groupMeta.name}".`, 'Xác nhận thành công');
      }
      navigation.navigate('ExpenseList');
    } catch (err: any) {
      setSaving(false);
      Alert.alert('Lỗi xác nhận', err?.message || 'Không thể xác nhận chứng từ.');
    }
  };

  const handleConfirmReview = () => {
    if (isReadOnly) {
      toast.warning('Chứng từ này đã được duyệt hoặc hồ sơ đã khóa, không thể chỉnh sửa.', 'Thông báo');
      return;
    }

    if (isPeriodSubmitted) {
      toast.error(
        `Kỳ quyết toán thuế năm ${activeTaxYear} đã hoàn tất và bị khóa. Không thể chỉnh sửa chứng từ.`,
        'Kỳ tính thuế đã khóa'
      );
      return;
    }

    if (isIdentityMismatch) {
      toast.error(
        'Thông tin cá nhân trên chứng từ không khớp với Người nộp thuế hoặc Người phụ thuộc trong hồ sơ.',
        'Họ tên không khớp'
      );
      return;
    }

    if (isDuplicate) {
      toast.error(
        (isWithholding ? 'Chứng từ số ' : 'Hóa đơn số ') + invoiceNumber.trim() + ' của đơn vị có MST ' + sellerTaxCode.trim() + ' đã tồn tại trong kỳ tính thuế này.',
        'Chứng từ bị trùng lặp'
      );
      return;
    }

    if (isWithholding) {
      const missingVoucherFields: string[] = [];
      if (!sellerName.trim()) missingVoucherFields.push('Tên tổ chức chi trả');
      if (!sellerTaxCode.trim()) missingVoucherFields.push('Mã số thuế tổ chức chi trả');
      if (!buyerName.trim()) missingVoucherFields.push('Họ và tên người nộp thuế');
      if (!buyerIdCard.trim()) missingVoucherFields.push('Số CCCD người nộp thuế');

      const yrNum = parseInt(incomeYear.trim(), 10);
      if (!incomeYear.trim() || isNaN(yrNum) || yrNum < 2000 || yrNum > 2100) {
        missingVoucherFields.push('Năm tính thuế thu nhập hợp lệ (VD: 2024, 2025)');
      }

      const parsedInc = parseMoney(totalIncomeStr);
      const parsedTax = parseMoney(taxWithheldStr);
      const parsedIns = parseMoney(insuranceDeductedStr);

      if (parsedInc === null || parsedInc <= 0) {
        missingVoucherFields.push('Tổng thu nhập chịu thuế [17] (> 0)');
      }
      if (parsedTax === null || parsedTax < 0) {
        missingVoucherFields.push('Thuế TNCN đã khấu trừ [19] (>= 0)');
      } else if (parsedInc !== null && parsedTax > parsedInc) {
        toast.error('Thuế đã khấu trừ không thể lớn hơn tổng thu nhập chịu thuế.', 'Sai lệch số liệu');
        return;
      }
      if (parsedIns === null || parsedIns < 0) {
        missingVoucherFields.push('Bảo hiểm bắt buộc đã trừ [14] (>= 0)');
      }

      if (missingVoucherFields.length > 0) {
        setActiveTab('THONG_TIN');
        toast.error(
          `Vui lòng bổ sung các thông tin bắt buộc: ${missingVoucherFields.join(', ')}.`,
          'Thiếu thông tin chứng từ'
        );
        return;
      }
    } else {
      if (currentDocTypeItem && !currentDocTypeItem.isTaxEligible) {
        toast.error(
          `Loại chứng từ '${currentDocTypeItem.name}' không thuộc diện được giảm trừ thuế TNCN theo quy định. Vui lòng chọn danh mục hợp lệ.`,
          'Danh mục không được giảm trừ'
        );
        return;
      }

      const missingBuyerFields: string[] = [];
      if (!buyerName.trim()) missingBuyerFields.push('Họ và tên');
      if (!buyerIdCard.trim()) missingBuyerFields.push('Số CCCD');
      if (!buyerAddress.trim()) missingBuyerFields.push('Địa chỉ');
      if (!paymentMethod.trim()) missingBuyerFields.push('Hình thức thanh toán');

      if (missingBuyerFields.length > 0) {
        setActiveTab('THONG_TIN');
        toast.error(
          `Vui lòng điền đầy đủ thông tin người thanh toán: ${missingBuyerFields.join(', ')}.`,
          'Thiếu thông tin người thanh toán'
        );
        return;
      }

      if (totalAmount <= 0) {
        toast.error('Tổng tiền thanh toán của hóa đơn phải lớn hơn 0.', 'Số tiền không hợp lệ');
        return;
      }
    }

    // Tất cả thông tin hợp lệ -> mở modal confirm
    setShowSaveConfirmModal(true);
  };

  const FieldInput = ({
    label, value, onChange, placeholder, keyboardType = 'default', readOnly = false, required = false,
  }: {
    label: string; value: string; onChange?: (v: string) => void;
    placeholder?: string; keyboardType?: any; readOnly?: boolean; required?: boolean;
  }) => (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>
        {label} {required && <Text style={{ color: '#DC2626' }}>*</Text>}
      </Text>
      <TextInput
        editable={!isReadOnly && !readOnly}
        style={[
          styles.textInput,
          (isReadOnly || readOnly) && styles.readOnlyInput,
          required && !value.trim() && !isReadOnly && { borderColor: '#FCA5A5' },
        ]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        keyboardType={keyboardType}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <DrumPatternBackdrop variant="soft" />
      <HeaderMotif
        title={
          isReadOnly
            ? (isWithholding ? 'CHI TIẾT CHỨNG TỪ KHẤU TRỪ' : 'CHI TIẾT HÓA ĐƠN')
            : (isWithholding ? 'SOÁT XÉT CHỨNG TỪ KHẤU TRỪ' : 'SOÁT XÉT HÓA ĐƠN')
        }
        onBack={() => navigation.goBack()}
      />

      {/* STICKY HEADER: Số tiền/Thuế + Danh mục + Trạng thái */}
      <View style={styles.stickyHeader}>
        <View style={styles.stickyLeft}>
          <View style={[styles.stickyIconCircle, { backgroundColor: `${groupMeta.color}20` }]}>
            <Ionicons name={groupMeta.icon as any} size={18} color={groupMeta.color} />
          </View>
          <View style={{ marginLeft: 8, flex: 1 }}>
            <Text style={styles.stickyCategory} numberOfLines={1}>{groupMeta.shortName}</Text>
            <Text style={styles.stickySellerName} numberOfLines={1}>
              {sellerName || (isWithholding ? 'Chưa có tên tổ chức chi trả' : 'Chưa có tên đơn vị')}
            </Text>
          </View>
        </View>
        <View style={styles.stickyRight}>
          {isWithholding ? (
            <>
              <Text style={styles.stickyAmount}>
                {formatCurrencyVND(parseMoney(taxWithheldStr) ?? initialData.taxWithheld ?? 0)}
              </Text>
              <Text style={styles.stickySubText}>Thuế đã khấu trừ</Text>
            </>
          ) : (
            <Text style={styles.stickyAmount}>{formatCurrencyVND(totalAmount)}</Text>
          )}
          <Badge variant={isConfirmed ? 'success' : 'warning'} style={{ alignSelf: 'flex-end', marginTop: 2 }}>
            {isConfirmed ? 'Đã duyệt' : 'Chờ soát xét'}
          </Badge>
        </View>
      </View>

      {/* 2 TABS: Kiểm tra & Xác nhận / Thông tin chi tiết */}
      <View style={styles.tabBar}>
        {([
          { key: 'KIEM_TRA', label: 'Kiểm tra & Xác nhận', icon: 'shield-checkmark-outline' },
          { key: 'THONG_TIN', label: isWithholding ? 'Thông tin chứng từ' : 'Thông tin hóa đơn', icon: 'reader-outline' },
        ] as { key: TabType; label: string; icon: string }[]).map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]}
            onPress={() => setActiveTab(tab.key)}
            activeOpacity={0.7}
          >
            <Ionicons name={tab.icon as any} size={14} color={activeTab === tab.key ? '#8B1E1E' : '#94A3B8'} />
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ===== TAB 1: KIỂM TRA & XÁC NHẬN ===== */}
        {activeTab === 'KIEM_TRA' && (
          <View>
            {/* Banner kỳ đã nộp / khóa */}
            {isPeriodSubmitted && (
              <View style={styles.lockedPeriodBanner}>
                <Ionicons name="lock-closed" size={20} color="#DC2626" />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.lockedPeriodTitle}>Kỳ quyết toán thuế đã khóa</Text>
                  <Text style={styles.lockedPeriodDesc}>
                    Kỳ tính thuế năm {activeTaxYear} đã nộp quyết toán cho cơ quan thuế. Hồ sơ đã khóa, chế độ chỉ xem.
                  </Text>
                </View>
                <Badge variant="destructive">Đã khóa</Badge>
              </View>
            )}

            {/* Banner đã duyệt */}
            {!isPeriodSubmitted && isRouteReadOnly && (
              <View style={styles.confirmedBanner}>
                <Ionicons name="shield-checkmark" size={20} color="#16A34A" />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.confirmedBannerTitle}>
                    {isWithholding ? 'Chứng từ khấu trừ đã được duyệt' : 'Hóa đơn đã được duyệt chính thức'}
                  </Text>
                  <Text style={styles.confirmedBannerDesc}>Đã lưu vào hồ sơ thuế. Chế độ chỉ xem.</Text>
                </View>
                <Badge variant="success">Đã xác nhận</Badge>
              </View>
            )}

            {!isPeriodSubmitted && isValidationBlocked && (
              <View style={styles.validationBlockedBanner}>
                <Ionicons name="lock-closed" size={20} color="#B91C1C" />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.validationBlockedTitle}>
                    {isWithholding ? 'Không thể chỉnh sửa chứng từ' : 'Không thể chỉnh sửa hóa đơn'}
                  </Text>
                  <Text style={styles.validationBlockedDesc}>
                    {isIdentityMismatch
                      ? 'Thông tin cá nhân trên chứng từ không khớp với người nộp thuế hoặc người phụ thuộc.'
                      : 'Chứng từ bị trùng mã số thuế và số chứng từ trong cùng kỳ tính thuế.'}
                  </Text>
                </View>
                <Badge variant="destructive">Đã khóa</Badge>
              </View>
            )}

            {/* Ảnh gốc chứng từ / hóa đơn */}
            {invoiceImageUri && !invoiceImageFailed ? (
              <Card style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="image-outline" size={15} color="#475569" />
                  <Text style={styles.cardHeaderTitle}>
                    {isWithholding ? 'Ảnh chứng từ khấu trừ gốc' : 'Ảnh hóa đơn gốc'}
                  </Text>
                </View>
                <Image
                  source={{ uri: invoiceImageUri }}
                  style={styles.invoiceImage}
                  resizeMode="contain"
                  onError={() => {
                    if (initialData.originalFileUri && invoiceImageUri !== initialData.originalFileUri) {
                      setInvoiceImageUri(initialData.originalFileUri);
                      return;
                    }
                    setInvoiceImageFailed(true);
                  }}
                />
              </Card>
            ) : invoiceImageFailed ? (
              <Card style={styles.card}>
                <View style={styles.imageErrorBox}>
                  <Ionicons name="image-outline" size={28} color="#94A3B8" />
                  <Text style={styles.imageErrorText}>Không tải được ảnh chứng từ gốc.</Text>
                </View>
              </Card>
            ) : null}

            {/* Đánh giá mức độ tin cậy AI */}
            <Card style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="stats-chart-outline" size={15} color="#475569" />
                <Text style={styles.cardHeaderTitle}>Mức độ tin cậy thông tin nhận diện</Text>
                <Badge variant={isPassedThreshold ? 'success' : 'warning'}>
                  {isPassedThreshold ? 'Đạt yêu cầu' : 'Cần xem lại'}
                </Badge>
              </View>
              <View style={styles.confidenceBar}>
                <View style={[styles.confidenceFill, {
                  width: `${Math.min(100, Math.round(effectiveConfidence * 100))}%`,
                  backgroundColor: isPassedThreshold ? '#16A34A' : '#D97706',
                }]} />
              </View>
              <Text style={styles.confidencePct}>
                {Math.round(effectiveConfidence * 100)}% / Ngưỡng {Math.round(dynamicThreshold * 100)}%
              </Text>

              {/* Các điểm kiểm tra trường cốt lõi */}
              <View style={styles.checkGrid}>
                {crucialDisplayItems.map((item) => (
                  <View key={item.key} style={styles.checkItem}>
                    <Ionicons
                      name={item.isLowConfidence ? 'alert-circle-outline' : 'checkmark-circle-outline'}
                      size={14}
                      color={item.isLowConfidence ? '#D97706' : '#16A34A'}
                    />
                    <Text style={styles.checkText}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </Card>

            {/* Cảnh báo lỗi / Xác nhận hợp lệ */}
            {validationErrors.length > 0 ? (
              <Card style={[styles.card, styles.cardWarning]}>
                <View style={styles.cardHeader}>
                  <Ionicons name="warning-outline" size={15} color="#D97706" />
                  <Text style={[styles.cardHeaderTitle, { color: '#92400E' }]}>Lưu ý khi xét duyệt ({validationErrors.length})</Text>
                </View>
                {validationErrors.map((err, idx) => {
                  const details = getValidationMatrixErrorDetails(err.code);
                  return (
                    <View key={idx} style={styles.errorItem}>
                      <Text style={styles.errorItemTitle}>{details.title}</Text>
                      <Text style={styles.errorItemMsg}>{details.message}</Text>
                      <Text style={styles.errorItemHint}>💡 {details.actionHint}</Text>
                    </View>
                  );
                })}
              </Card>
            ) : (
              <Card style={[styles.card, styles.cardSuccess]}>
                <View style={styles.cardHeader}>
                  <Ionicons name="checkmark-done-circle-outline" size={15} color="#16A34A" />
                  <Text style={[styles.cardHeaderTitle, { color: '#15803D' }]}>
                    {isWithholding ? 'Chứng từ đáp ứng điều kiện quyết toán thuế' : 'Hóa đơn đáp ứng điều kiện giảm trừ thuế'}
                  </Text>
                </View>
                <Text style={styles.successDesc}>
                  Đúng kỳ tính thuế {incomeYear || initialData.extractedYear || new Date().getFullYear()}, thông tin pháp lý đầy đủ và minh bạch.
                </Text>
              </Card>
            )}

            {/* PHẦN DÀNH RIÊNG CHO CHỨNG TỪ KHẤU TRỪ: Tóm tắt nghĩa vụ thuế TNCN & Đối chiếu */}
            {isWithholding ? (
              <>
                {/* Tóm tắt 3 chỉ tiêu tài chính cốt lõi */}
                <Card style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Ionicons name="wallet-outline" size={15} color="#475569" />
                    <Text style={styles.cardHeaderTitle}>Nghĩa vụ thuế TNCN trên chứng từ</Text>
                  </View>
                  <View style={styles.voucherSummaryGrid}>
                    <View style={styles.voucherSummaryRow}>
                      <Text style={styles.voucherSummaryLabel}>[17] Tổng thu nhập chịu thuế:</Text>
                      <Text style={styles.voucherSummaryValue}>
                        {formatCurrencyVND(parseMoney(totalIncomeStr) ?? initialData.totalIncome ?? 0)}
                      </Text>
                    </View>
                    <Separator style={{ marginVertical: 6 }} />
                    <View style={styles.voucherSummaryRow}>
                      <Text style={[styles.voucherSummaryLabel, { color: '#8B1E1E', fontWeight: '700' }]}>
                        [19] Thuế TNCN đã khấu trừ:
                      </Text>
                      <Text style={[styles.voucherSummaryValue, { color: '#8B1E1E', fontSize: 15, fontWeight: '800' }]}>
                        {formatCurrencyVND(parseMoney(taxWithheldStr) ?? initialData.taxWithheld ?? 0)}
                      </Text>
                    </View>
                    <Separator style={{ marginVertical: 6 }} />
                    <View style={styles.voucherSummaryRow}>
                      <Text style={styles.voucherSummaryLabel}>[14] Bảo hiểm trừ lương:</Text>
                      <Text style={styles.voucherSummaryValue}>
                        {formatCurrencyVND(parseMoney(insuranceDeductedStr) ?? initialData.insuranceDeducted ?? 0)}
                      </Text>
                    </View>
                  </View>
                </Card>

                {/* Khối đối chiếu với thu nhập theo tháng */}
                <Card style={styles.card}>
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.cardHeaderLeft}>
                      <Ionicons name="git-compare-outline" size={15} color="#475569" />
                      <Text style={styles.cardHeaderTitle} numberOfLines={1}>Đối chiếu với thu nhập theo tháng</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleCrossCheck()}
                      disabled={checkingCrossCheck}
                      style={styles.crossCheckBtn}
                    >
                      {checkingCrossCheck ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="refresh-outline" size={13} color="#fff" />
                          <Text style={styles.crossCheckBtnText}>Đối chiếu lại</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.commitDesc}>
                    Hệ thống tự động đối chiếu số liệu trên chứng từ này với tổng các khoản thu nhập bạn đã khai theo tháng tại đơn vị "{sellerName || 'Tổ chức chi trả'}".
                  </Text>

                  {/* Kết quả đối chiếu */}
                  {checkingCrossCheck ? (
                    <View style={styles.crossCheckLoadingBox}>
                      <ActivityIndicator size="small" color="#8B1E1E" />
                      <Text style={styles.crossCheckLoadingText}>
                        Đang tự động đối chiếu số liệu với hệ thống thu nhập...
                      </Text>
                    </View>
                  ) : crossCheckResult ? (
                    crossCheckResult.isMatch ? (
                      <View style={styles.crossCheckMatchBox}>
                        <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
                        <View style={{ flex: 1, marginLeft: 8 }}>
                          <Text style={styles.crossCheckMatchTitle}>Số liệu hoàn toàn trùng khớp (100%)</Text>
                          <Text style={styles.crossCheckMatchDesc}>
                            Tổng thu nhập, thuế đã khấu trừ và bảo hiểm trên chứng từ trùng khớp chính xác với thu nhập theo tháng đã khai trong hệ thống.
                          </Text>
                          <View style={styles.crossCheckTable}>
                            <View style={styles.crossCheckTableRow}>
                              <Text style={styles.crossCheckTableColHeader}>Chỉ tiêu</Text>
                              <Text style={styles.crossCheckTableColHeader}>Chứng từ</Text>
                              <Text style={styles.crossCheckTableColHeader}>Hệ thống</Text>
                            </View>
                            <View style={styles.crossCheckTableRow}>
                              <Text style={styles.crossCheckTableCol}>Thu nhập [17]:</Text>
                              <Text style={styles.crossCheckTableColVal}>{formatCurrencyVND(parseMoney(totalIncomeStr) ?? initialData.totalIncome ?? 0)}</Text>
                              <Text style={styles.crossCheckTableColVal}>{formatCurrencyVND(crossCheckResult.summedTotalIncome ?? (crossCheckResult as any).monthlyTotalIncome ?? 0)}</Text>
                            </View>
                            <View style={styles.crossCheckTableRow}>
                              <Text style={styles.crossCheckTableCol}>Thuế TNCN [19]:</Text>
                              <Text style={styles.crossCheckTableColVal}>{formatCurrencyVND(parseMoney(taxWithheldStr) ?? initialData.taxWithheld ?? 0)}</Text>
                              <Text style={styles.crossCheckTableColVal}>{formatCurrencyVND(crossCheckResult.summedTaxWithheld ?? (crossCheckResult as any).monthlyTaxWithheld ?? 0)}</Text>
                            </View>
                            <View style={styles.crossCheckTableRow}>
                              <Text style={styles.crossCheckTableCol}>Bảo hiểm [14]:</Text>
                              <Text style={styles.crossCheckTableColVal}>{formatCurrencyVND(parseMoney(insuranceDeductedStr) ?? initialData.insuranceDeducted ?? 0)}</Text>
                              <Text style={styles.crossCheckTableColVal}>{formatCurrencyVND(crossCheckResult.summedInsuranceDeducted ?? (crossCheckResult as any).monthlyInsuranceDeducted ?? 0)}</Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.crossCheckMismatchBox}>
                        <Ionicons name="alert-circle" size={20} color="#D97706" />
                        <View style={{ flex: 1, marginLeft: 8 }}>
                          <Text style={styles.crossCheckMismatchTitle}>Phát hiện chênh lệch số liệu</Text>
                          {crossCheckResult.mismatchMessages && crossCheckResult.mismatchMessages.map((msg, i) => (
                            <Text key={i} style={styles.crossCheckMismatchItem}>• {msg}</Text>
                          ))}
                          <View style={styles.crossCheckTable}>
                            <View style={styles.crossCheckTableRow}>
                              <Text style={styles.crossCheckTableColHeader}>Chỉ tiêu</Text>
                              <Text style={styles.crossCheckTableColHeader}>Chứng từ</Text>
                              <Text style={styles.crossCheckTableColHeader}>Đã khai</Text>
                            </View>
                            <View style={styles.crossCheckTableRow}>
                              <Text style={styles.crossCheckTableCol}>Thu nhập [17]:</Text>
                              <Text style={styles.crossCheckTableColVal}>{formatCurrencyVND(parseMoney(totalIncomeStr) ?? initialData.totalIncome ?? 0)}</Text>
                              <Text style={styles.crossCheckTableColVal}>{formatCurrencyVND(crossCheckResult.summedTotalIncome ?? (crossCheckResult as any).monthlyTotalIncome ?? 0)}</Text>
                            </View>
                            <View style={styles.crossCheckTableRow}>
                              <Text style={styles.crossCheckTableCol}>Thuế TNCN [19]:</Text>
                              <Text style={styles.crossCheckTableColVal}>{formatCurrencyVND(parseMoney(taxWithheldStr) ?? initialData.taxWithheld ?? 0)}</Text>
                              <Text style={styles.crossCheckTableColVal}>{formatCurrencyVND(crossCheckResult.summedTaxWithheld ?? (crossCheckResult as any).monthlyTaxWithheld ?? 0)}</Text>
                            </View>
                            <View style={styles.crossCheckTableRow}>
                              <Text style={styles.crossCheckTableCol}>Bảo hiểm [14]:</Text>
                              <Text style={styles.crossCheckTableColVal}>{formatCurrencyVND(parseMoney(insuranceDeductedStr) ?? initialData.insuranceDeducted ?? 0)}</Text>
                              <Text style={styles.crossCheckTableColVal}>{formatCurrencyVND(crossCheckResult.summedInsuranceDeducted ?? (crossCheckResult as any).monthlyInsuranceDeducted ?? 0)}</Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    )
                  ) : crossCheckError ? (
                    <View style={styles.crossCheckErrorBox}>
                      <Ionicons name="alert-circle-outline" size={18} color="#DC2626" />
                      <Text style={styles.crossCheckErrorText}>{crossCheckError}</Text>
                    </View>
                  ) : (
                    <View style={styles.crossCheckPendingBox}>
                      <Ionicons name="information-circle-outline" size={16} color="#64748B" />
                      <Text style={styles.crossCheckPendingText}>
                        Hệ thống đang chuẩn bị đối chiếu tự động với bảng thu nhập theo tháng đã khai.
                      </Text>
                    </View>
                  )}
                </Card>
              </>
            ) : (
              /* PHẦN DÀNH RIÊNG CHO HÓA ĐƠN: Cam kết chưa bồi hoàn */
              <Card style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="shield-checkmark-outline" size={15} color="#475569" />
                  <Text style={styles.cardHeaderTitle}>Xác nhận điều kiện giảm trừ thuế</Text>
                </View>
                <Text style={styles.commitDesc}>
                  Theo quy định thuế TNCN, chi phí chỉ được giảm trừ khi chưa được bảo hiểm hoặc tổ chức khác bồi hoàn toàn bộ.
                </Text>
                <TouchableOpacity
                  disabled={isReadOnly}
                  onPress={() => setIsNotReimbursed(!isNotReimbursed)}
                  style={[styles.commitBox, isNotReimbursed ? styles.commitBoxChecked : styles.commitBoxUnchecked]}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={isNotReimbursed ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={isNotReimbursed ? '#8B1E1E' : '#94A3B8'}
                  />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.commitTitle, isNotReimbursed && { color: '#8B1E1E', fontWeight: '700' }]}>
                      Tôi xác nhận khoản chi phí này chưa được bồi hoàn từ bảo hiểm hoặc nguồn khác
                    </Text>
                    <Text style={styles.commitStatus}>
                      {isNotReimbursed ? '✓ Đủ điều kiện giảm trừ thuế TNCN' : '⚠ Nếu đã bồi hoàn, sẽ không được tính giảm trừ'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </Card>
            )}
          </View>
        )}

        {/* ===== TAB 2: THÔNG TIN CHI TIẾT (PHÂN NHÁNH RÕ RỆT) ===== */}
        {activeTab === 'THONG_TIN' && (
          <View>
            {/* 1. Loại chứng từ (Chung, kèm nút đổi loại) */}
            <Card style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardHeaderLeft}>
                  <Ionicons name="albums-outline" size={15} color="#475569" />
                  <Text style={styles.cardHeaderTitle} numberOfLines={1}>
                    {isWithholding ? 'Loại chứng từ khấu trừ' : 'Loại hóa đơn chi phí'}
                  </Text>
                </View>
                {!isReadOnly && (
                  <TouchableOpacity onPress={() => setShowDocTypeModal(true)} style={styles.changeCategoryBtn}>
                    <Ionicons name="swap-horizontal" size={13} color="#8B1E1E" />
                    <Text style={styles.changeCategoryText}>Đổi loại</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.docTypeRow}>
                <View style={[styles.docTypeIcon, { backgroundColor: `${groupMeta.color}20` }]}>
                  <Ionicons name={getDocumentTypeIcon(currentDocTypeCode, currentDocTypeName) as any} size={18} color={groupMeta.color} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.docTypeName}>{currentDocTypeName}</Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                    <Badge variant={isWithholding ? 'default' : (currentDocTypeItem?.isTaxEligible !== false ? 'teal' : 'secondary')}>
                      {isWithholding ? 'Khấu trừ thuế TNCN' : (currentDocTypeItem?.isTaxEligible !== false ? 'Được giảm trừ thuế' : 'Không giảm trừ')}
                    </Badge>
                  </View>
                </View>
              </View>
            </Card>

            {/* PHÂN NHÁNH FORM: CHỨNG TỪ KHẤU TRỪ VS HÓA ĐƠN */}
            {isWithholding ? (
              /* ================= FORM CHỨNG TỪ KHẤU TRỪ THUẾ TNCN ================= */
              <>
                {/* 2. Tổ chức chi trả thu nhập */}
                <Card style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Ionicons name="business-outline" size={15} color="#475569" />
                    <Text style={styles.cardHeaderTitle}>Tổ chức chi trả thu nhập</Text>
                  </View>
                  <FieldInput
                    label="Tên tổ chức chi trả thu nhập"
                    value={sellerName}
                    onChange={setSellerName}
                    placeholder="Công ty Cổ phần / Cơ quan / Tổ chức chi trả"
                    required
                  />
                  <FieldInput
                    label="Mã số thuế tổ chức chi trả"
                    value={sellerTaxCode}
                    onChange={setSellerTaxCode}
                    placeholder="Ví dụ: 0101234567"
                    keyboardType="numeric"
                    required
                  />
                  <FieldInput
                    label="Địa chỉ tổ chức chi trả"
                    value={sellerAddress}
                    onChange={setSellerAddress}
                    placeholder="Địa chỉ trụ sở tổ chức chi trả"
                  />
                  <FieldInput
                    label="Số điện thoại liên hệ"
                    value={sellerPhone}
                    onChange={setSellerPhone}
                    placeholder="Số điện thoại"
                    keyboardType="phone-pad"
                  />
                </Card>

                {/* 3. Thông tin chứng từ khấu trừ */}
                <Card style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Ionicons name="receipt-outline" size={15} color="#475569" />
                    <Text style={styles.cardHeaderTitle}>Thông tin chứng từ khấu trừ thuế</Text>
                  </View>
                  <View style={styles.rowInputs}>
                    <View style={{ flex: 1, marginRight: 6 }}>
                      <FieldInput
                        label="Ký hiệu mẫu"
                        value={invoiceSeries}
                        onChange={setInvoiceSeries}
                        placeholder="VD: C24TTC"
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: 6 }}>
                      <FieldInput
                        label="Số chứng từ"
                        value={invoiceNumber}
                        onChange={setInvoiceNumber}
                        placeholder="VD: 0001234"
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                  <View style={styles.rowInputs}>
                    <View style={{ flex: 1, marginRight: 6 }}>
                      <FieldInput
                        label="Ngày cấp chứng từ (YYYY-MM-DD)"
                        value={invoiceDate}
                        onChange={setInvoiceDate}
                        placeholder={`${new Date().getFullYear()}-01-15`}
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: 6 }}>
                      <FieldInput
                        label="Năm tính thuế thu nhập"
                        value={incomeYear}
                        onChange={setIncomeYear}
                        placeholder="VD: 2024"
                        keyboardType="numeric"
                        required
                      />
                    </View>
                  </View>
                  <FieldInput
                    label="Đường dẫn tra cứu điện tử"
                    value={lookupUrl}
                    onChange={setLookupUrl}
                    placeholder="https://..."
                  />
                  <FieldInput
                    label="Mã tra cứu chứng từ"
                    value={lookupCode}
                    onChange={setLookupCode}
                    placeholder="Mã tra cứu"
                  />
                </Card>

                {/* 4. Người nộp thuế (Người được khấu trừ) */}
                <Card style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Ionicons name="person-outline" size={15} color="#475569" />
                    <Text style={styles.cardHeaderTitle}>Người nộp thuế (Người được khấu trừ)</Text>
                  </View>
                  <FieldInput
                    label="Họ và tên người nộp thuế"
                    value={buyerName}
                    onChange={setBuyerName}
                    placeholder="NGUYỄN VĂN AN"
                    required
                  />
                  <View style={styles.rowInputs}>
                    <View style={{ flex: 1, marginRight: 6 }}>
                      <FieldInput
                        label="Số CCCD / CMND"
                        value={buyerIdCard}
                        onChange={setBuyerIdCard}
                        placeholder="12 chữ số"
                        keyboardType="numeric"
                        required
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: 6 }}>
                      <FieldInput
                        label="Mã số thuế cá nhân"
                        value={buyerTaxCode}
                        onChange={setBuyerTaxCode}
                        placeholder="10 chữ số"
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                  <FieldInput
                    label="Địa chỉ thường trú / cư trú"
                    value={buyerAddress}
                    onChange={setBuyerAddress}
                    placeholder="Địa chỉ cư trú"
                  />
                </Card>

                {/* 5. Số liệu tài chính khấu trừ thuế TNCN (3 chỉ tiêu bắt buộc) */}
                <Card style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Ionicons name="cash-outline" size={15} color="#475569" />
                    <Text style={styles.cardHeaderTitle}>Số liệu tài chính khấu trừ thuế TNCN</Text>
                  </View>
                  <Text style={styles.commitDesc}>
                    Nhập đúng các chỉ tiêu được ghi trên chứng từ khấu trừ thuế TNCN mẫu 07/CTKT-TNCN.
                  </Text>

                  {/* Chỉ tiêu [17] */}
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>
                      [17] Tổng thu nhập chịu thuế phải khấu trừ (VNĐ) <Text style={{ color: '#DC2626' }}>*</Text>
                    </Text>
                    <View style={styles.moneyInputWrap}>
                      <TextInput
                        editable={!isReadOnly}
                        style={[styles.textInput, styles.moneyInput, isReadOnly && styles.readOnlyInput]}
                        value={totalIncomeStr}
                        onChangeText={(t) => setTotalIncomeStr(formatMoneyInput(t))}
                        placeholder="0"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                      />
                      <Text style={styles.moneyUnit}>đ</Text>
                    </View>
                  </View>

                  {/* Chỉ tiêu [19] */}
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>
                      [19] Số thuế TNCN đã khấu trừ (VNĐ) <Text style={{ color: '#DC2626' }}>*</Text>
                    </Text>
                    <View style={styles.moneyInputWrap}>
                      <TextInput
                        editable={!isReadOnly}
                        style={[styles.textInput, styles.moneyInput, isReadOnly && styles.readOnlyInput]}
                        value={taxWithheldStr}
                        onChangeText={(t) => setTaxWithheldStr(formatMoneyInput(t))}
                        placeholder="0"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                      />
                      <Text style={styles.moneyUnit}>đ</Text>
                    </View>
                  </View>

                  {/* Chỉ tiêu [14] */}
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>
                      [14] Các khoản đóng BHXH, BHYT, BHTN trừ lương (VNĐ) <Text style={{ color: '#DC2626' }}>*</Text>
                    </Text>
                    <View style={styles.moneyInputWrap}>
                      <TextInput
                        editable={!isReadOnly}
                        style={[styles.textInput, styles.moneyInput, isReadOnly && styles.readOnlyInput]}
                        value={insuranceDeductedStr}
                        onChangeText={(t) => setInsuranceDeductedStr(formatMoneyInput(t))}
                        placeholder="0"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                      />
                      <Text style={styles.moneyUnit}>đ</Text>
                    </View>
                  </View>
                </Card>
              </>
            ) : (
              /* ================= FORM HÓA ĐƠN CHI PHÍ ================= */
              <>
                {/* 2. Đơn vị phát hành (Bên bán) */}
                <Card style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Ionicons name="business-outline" size={15} color="#475569" />
                    <Text style={styles.cardHeaderTitle}>Đơn vị phát hành hóa đơn</Text>
                  </View>
                  <FieldInput label="Tên đơn vị / Người bán" value={sellerName} onChange={setSellerName} placeholder="Tên bệnh viện, trường học, cơ sở..." />
                  <FieldInput label="Mã số thuế" value={sellerTaxCode} onChange={setSellerTaxCode} placeholder="Ví dụ: 0302221111" keyboardType="numeric" />
                  <FieldInput label="Địa chỉ" value={sellerAddress} onChange={setSellerAddress} placeholder="Địa chỉ trụ sở" />
                  <FieldInput label="Số điện thoại" value={sellerPhone} onChange={setSellerPhone} placeholder="Số điện thoại liên hệ" keyboardType="phone-pad" />
                </Card>

                {/* 3. Thông tin hóa đơn */}
                <Card style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Ionicons name="receipt-outline" size={15} color="#475569" />
                    <Text style={styles.cardHeaderTitle}>Thông tin hóa đơn</Text>
                  </View>
                  <View style={styles.rowInputs}>
                    <View style={{ flex: 1, marginRight: 6 }}>
                      <FieldInput label="Ký hiệu mẫu" value={invoiceSeries} onChange={setInvoiceSeries} placeholder="2C26TBH" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 6 }}>
                      <FieldInput label="Số hóa đơn" value={invoiceNumber} onChange={setInvoiceNumber} placeholder="0082621" keyboardType="numeric" />
                    </View>
                  </View>
                  <FieldInput label="Ngày lập (YYYY-MM-DD)" value={invoiceDate} onChange={setInvoiceDate} placeholder={`${new Date().getFullYear()}-03-15`} />
                  <FieldInput label="Tổng tiền thực thanh toán (VNĐ)" value={totalAmount ? String(totalAmount) : ''} onChange={(v) => setTotalAmount(Number(v.replace(/[^0-9]/g,''))||0)} placeholder="Nhập số tiền" keyboardType="numeric" />
                  <FieldInput label="Đường dẫn tra cứu điện tử" value={lookupUrl} onChange={setLookupUrl} placeholder="https://..." />
                  <FieldInput label="Mã tra cứu hóa đơn" value={lookupCode} onChange={setLookupCode} placeholder="Mã tra cứu" />
                </Card>

                {/* 4. Người thanh toán */}
                <Card style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Ionicons name="person-outline" size={15} color="#475569" />
                    <Text style={styles.cardHeaderTitle}>Người thanh toán</Text>
                  </View>
                  <FieldInput label="Họ và tên" value={buyerName} onChange={setBuyerName} placeholder="NGUYỄN VĂN AN" required />
                  <FieldInput label="Số CCCD" value={buyerIdCard} onChange={setBuyerIdCard} placeholder="12 chữ số" keyboardType="numeric" required />
                  <FieldInput label="Địa chỉ" value={buyerAddress} onChange={setBuyerAddress} placeholder="Địa chỉ thường trú" required />
                  <FieldInput label="Hình thức thanh toán" value={paymentMethod} onChange={setPaymentMethod} placeholder="Chuyển khoản / Tiền mặt" required />
                </Card>

                {/* 5. Bảng kê chi tiết */}
                <Card style={styles.card}>
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.cardHeaderLeft}>
                      <Ionicons name="list-outline" size={15} color="#475569" />
                      <Text style={styles.cardHeaderTitle} numberOfLines={1}>
                        Danh sách dịch vụ & Chi phí ({items.length})
                      </Text>
                    </View>
                    {!isReadOnly && (
                      <TouchableOpacity onPress={() => handleOpenItemModal()} style={styles.addItemBtn}>
                        <Ionicons name="add" size={14} color="#fff" />
                        <Text style={styles.addItemBtnText}>Thêm</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {items.length === 0 ? (
                    <Text style={styles.emptyItems}>
                      {isReadOnly ? 'Không có dịch vụ nào.' : "Chưa có dịch vụ. Bấm 'Thêm' để bổ sung."}
                    </Text>
                  ) : (
                    items.map((it, idx) => (
                      <View key={idx} style={styles.itemRow}>
                        <View style={styles.itemOrderBadge}>
                          <Text style={styles.itemOrderText}>{it.itemOrder || idx + 1}</Text>
                        </View>
                        <View style={{ flex: 1, marginHorizontal: 10 }}>
                          <Text style={styles.itemName}>{it.itemName}</Text>
                          <Text style={styles.itemMeta}>
                            {it.quantity} {it.unit || 'lần'} × {formatCurrencyVND(it.unitPrice)}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.itemAmount}>{formatCurrencyVND(it.totalPrice)}</Text>
                          {!isReadOnly && (
                            <View style={styles.itemActions}>
                              <TouchableOpacity onPress={() => handleOpenItemModal(idx)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                                <Ionicons name="pencil-outline" size={14} color="#475569" />
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => handleDeleteItem(idx)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                                <Ionicons name="trash-outline" size={14} color="#EF4444" />
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      </View>
                    ))
                  )}

                  {items.length > 0 && (
                    <>
                      <Separator style={{ marginVertical: 12 }} />
                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Tổng các dòng:</Text>
                        <Text style={styles.totalValue}>{formatCurrencyVND(itemsSum)}</Text>
                      </View>
                      <View style={[styles.totalRow, { marginTop: 4 }]}>
                        <Text style={[styles.totalLabel, { color: '#8B1E1E', fontWeight: '700' }]}>Thực tế thanh toán:</Text>
                        <Text style={[styles.totalValue, { color: '#8B1E1E', fontSize: 16 }]}>{formatCurrencyVND(totalAmount)}</Text>
                      </View>
                      {itemsSum !== totalAmount && (
                        <View style={styles.diffNotice}>
                          <Ionicons name="information-circle-outline" size={14} color="#D97706" />
                          <Text style={styles.diffNoticeText}>
                            Chênh lệch do chiết khấu, bồi thường bảo hiểm hoặc điều chỉnh thực tế.
                          </Text>
                        </View>
                      )}
                    </>
                  )}
                </Card>
              </>
            )}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* STICKY BOTTOM CTA */}
      <View style={styles.stickyBottom}>
        {isReadOnly ? (
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <Ionicons name="arrow-back-outline" size={18} color="#475569" />
            <Text style={styles.backBtnText}>Quay lại danh sách</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.confirmBtn, saving && styles.confirmBtnLoading]}
            onPress={handleConfirmReview}
            disabled={saving}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
            <Text style={styles.confirmBtnText}>
              {saving
                ? 'Đang lưu...'
                : isWithholding
                  ? 'Xác nhận & Lưu chứng từ'
                  : `Xác nhận & Lưu vào "${groupMeta.shortName}"`}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* MODAL THÊM / SỬA DÒNG CHI PHÍ (HÓA ĐƠN) */}
      <Modal visible={itemModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>{editingItemIndex !== null ? 'Sửa khoản mục' : 'Thêm khoản mục'}</Text>
              <TouchableOpacity onPress={() => setItemModalVisible(false)}>
                <Ionicons name="close" size={20} color="#475569" />
              </TouchableOpacity>
            </View>
            <Text style={styles.fieldLabel}>Tên dịch vụ / Khoản mục</Text>
            <TextInput style={styles.textInput} value={itemFormName} onChangeText={setItemFormName} placeholder="Ví dụ: Khám nội tổng quát" placeholderTextColor="#94A3B8" />
            <View style={styles.rowInputs}>
              <View style={{ flex: 1, marginRight: 6 }}>
                <Text style={styles.fieldLabel}>Đơn vị tính</Text>
                <TextInput style={styles.textInput} value={itemFormUnit} onChangeText={setItemFormUnit} placeholder="Lần, Hộp..." placeholderTextColor="#94A3B8" />
              </View>
              <View style={{ flex: 1, marginLeft: 6 }}>
                <Text style={styles.fieldLabel}>Số lượng</Text>
                <TextInput style={styles.textInput} value={itemFormQty} onChangeText={setItemFormQty} keyboardType="numeric" placeholder="1" placeholderTextColor="#94A3B8" />
              </View>
            </View>
            <Text style={styles.fieldLabel}>Đơn giá (VNĐ)</Text>
            <TextInput style={styles.textInput} value={itemFormPrice} onChangeText={setItemFormPrice} keyboardType="numeric" placeholder="0" placeholderTextColor="#94A3B8" />
            <View style={styles.rowInputs}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setItemModalVisible(false)}>
                <Text style={styles.modalBtnCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnConfirm} onPress={handleSaveItem}>
                <Text style={styles.modalBtnConfirmText}>Lưu</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL CHỌN LOẠI CHỨNG TỪ (ĐA TẦNG, HỖ TRỢ TẤT CẢ LOẠI TỪ BACKEND) */}
      <Modal visible={showDocTypeModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '80%' }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Chọn loại hóa đơn & chứng từ</Text>
              <TouchableOpacity onPress={() => setShowDocTypeModal(false)}>
                <Ionicons name="close" size={20} color="#475569" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {documentTypes.map((t) => {
                const isSelected = t.code === currentDocTypeCode;
                const isItemWithholding = isWithholdingDocType(t.code, t.name);
                return (
                  <TouchableOpacity
                    key={t.code}
                    style={[styles.docTypeOption, isSelected && styles.docTypeOptionSelected]}
                    onPress={() => { setCurrentDocTypeCode(t.code); setShowDocTypeModal(false); }}
                  >
                    <View style={[styles.docTypeOptionIcon, { backgroundColor: isSelected ? '#8B1E1E' : '#F1F5F9' }]}>
                      <Ionicons name={getDocumentTypeIcon(t.code, t.name) as any} size={16} color={isSelected ? '#fff' : '#475569'} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                        <Text style={[styles.docTypeOptionName, isSelected && { color: '#8B1E1E', fontWeight: '700' }]}>{t.name}</Text>
                        <Badge
                          variant={isItemWithholding ? 'default' : (t.isTaxEligible ? 'teal' : 'secondary')}
                          style={{ marginTop: 1 }}
                        >
                          {isItemWithholding ? 'Khấu trừ thuế' : (t.isTaxEligible ? 'Được giảm trừ' : 'Không giảm trừ')}
                        </Badge>
                      </View>
                      {t.description ? (
                        <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2, lineHeight: 15 }} numberOfLines={2}>
                          {t.description}
                        </Text>
                      ) : null}
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={18} color="#8B1E1E" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* DIALOG XÁC NHẬN LƯU */}
      <Dialog
        visible={showSaveConfirmModal}
        title={isWithholding ? 'Lưu chứng từ khấu trừ' : 'Lưu hóa đơn'}
        message={
          isWithholding
            ? `Lưu chứng từ của ${sellerName || 'đơn vị chi trả'} vào kỳ thuế năm ${incomeYear}?`
            : `Lưu hóa đơn của ${sellerName || 'đơn vị bán'} vào danh mục ${groupMeta.shortName}?`
        }
        detail={
          isWithholding
            ? `Thuế khấu trừ: ${formatCurrencyVND(parseMoney(taxWithheldStr) ?? 0)}`
            : `Số tiền: ${formatCurrencyVND(totalAmount)}`
        }
        primaryLabel="Lưu"
        secondaryLabel="Kiểm tra lại"
        onPrimary={() => {
          setShowSaveConfirmModal(false);
          executeConfirm();
        }}
        onSecondary={() => setShowSaveConfirmModal(false)}
        onRequestClose={() => setShowSaveConfirmModal(false)}
      />

      {/* DIALOG XÁC NHẬN XÓA MỤC CHI PHÍ */}
      <Dialog
        visible={deleteItemIndex !== null}
        title="Xóa mục chi phí"
        message={`Xóa mục "${deleteItemIndex !== null ? items[deleteItemIndex]?.itemName : ''}"?`}
        primaryLabel="Xóa"
        secondaryLabel="Hủy"
        destructive={true}
        onPrimary={() => {
          if (deleteItemIndex !== null) {
            setItems(items.filter((_, i) => i !== deleteItemIndex));
            setDeleteItemIndex(null);
          }
        }}
        onSecondary={() => setDeleteItemIndex(null)}
        onRequestClose={() => setDeleteItemIndex(null)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  // Sticky header
  stickyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.90)',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  stickyLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  stickyIconCircle: { width: 36, height: 36, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  stickyCategory: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  stickySellerName: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  stickyRight: { alignItems: 'flex-end', justifyContent: 'center' },
  stickyAmount: { fontSize: 16, fontWeight: '800', color: '#8B1E1E' },
  stickySubText: { fontSize: 10, color: '#64748B', fontWeight: '600' },
  // Tabs
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.90)',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingHorizontal: 16,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    gap: 5,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: { borderBottomColor: '#8B1E1E' },
  tabLabel: { fontSize: 12, fontWeight: '600', color: '#94A3B8' },
  tabLabelActive: { color: '#8B1E1E', fontWeight: '700' },
  // Scroll
  scrollContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 },
  // Cards (phẳng, không shadow, bo góc 6)
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    marginBottom: 12,
    shadowOpacity: 0,
    elevation: 0,
  },
  cardWarning: { borderColor: '#FDE68A', backgroundColor: '#FFFBEB' },
  cardSuccess: { borderColor: '#BBF7D0', backgroundColor: '#F0FDF4' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, marginRight: 8 },
  cardHeaderTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A', flexShrink: 1 },
  // Invoice image
  invoiceImage: { width: '100%', height: 220, borderRadius: 6, backgroundColor: '#0F172A' },
  imageErrorBox: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    gap: 8,
  },
  imageErrorText: { fontSize: 12, color: '#64748B' },
  // Confidence
  confidenceBar: { height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden', marginBottom: 4 },
  confidenceFill: { height: '100%', borderRadius: 3 },
  confidencePct: { fontSize: 11, color: '#64748B', marginBottom: 10 },
  checkGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  checkItem: { flexDirection: 'row', alignItems: 'center', gap: 4, width: '47%' },
  checkText: { fontSize: 11, color: '#475569', flex: 1 },
  // Confirmed banner
  lockedPeriodBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 6,
    padding: 12,
    marginBottom: 12,
  },
  lockedPeriodTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#991B1B',
  },
  lockedPeriodDesc: {
    fontSize: 11.5,
    color: '#7F1D1D',
    marginTop: 2,
  },
  confirmedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 6,
    padding: 12,
    marginBottom: 12,
  },
  confirmedBannerTitle: { fontSize: 13, fontWeight: '700', color: '#15803D' },
  confirmedBannerDesc: { fontSize: 11, color: '#16A34A', marginTop: 1 },
  validationBlockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    borderRadius: 6,
    padding: 12,
    marginBottom: 12,
  },
  validationBlockedTitle: { fontSize: 13, fontWeight: '700', color: '#9F1239' },
  validationBlockedDesc: { fontSize: 11, color: '#BE123C', marginTop: 2, lineHeight: 16 },
  // Error items
  errorItem: { marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#FDE68A' },
  errorItemTitle: { fontSize: 12, fontWeight: '700', color: '#92400E' },
  errorItemMsg: { fontSize: 11, color: '#78350F', marginTop: 2 },
  errorItemHint: { fontSize: 11, color: '#D97706', marginTop: 3 },
  successDesc: { fontSize: 12, color: '#15803D', lineHeight: 17 },
  // Commitment
  commitDesc: { fontSize: 11, color: '#64748B', lineHeight: 16, marginBottom: 10 },
  commitBox: { flexDirection: 'row', alignItems: 'flex-start', padding: 12, borderRadius: 6, borderWidth: 1.5 },
  commitBoxChecked: { borderColor: '#8B1E1E', backgroundColor: '#FFF8F8' },
  commitBoxUnchecked: { borderColor: '#CBD5E1', backgroundColor: '#F8FAFC' },
  commitTitle: { fontSize: 12, fontWeight: '600', color: '#0F172A', lineHeight: 17 },
  commitStatus: { fontSize: 11, color: '#64748B', marginTop: 3 },
  // Doc type
  docTypeRow: { flexDirection: 'row', alignItems: 'center' },
  docTypeIcon: { width: 40, height: 40, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  docTypeName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  changeCategoryBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6, borderRadius: 6, backgroundColor: '#FFF8F8', borderWidth: 1, borderColor: '#FECACA', flexShrink: 0 },
  changeCategoryText: { fontSize: 11, fontWeight: '700', color: '#8B1E1E' },
  // Fields
  fieldGroup: { marginBottom: 10 },
  fieldLabel: { fontSize: 11, fontWeight: '600', color: '#475569', marginBottom: 4 },
  textInput: {
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  readOnlyInput: { backgroundColor: '#F8FAFC', color: '#64748B', borderColor: '#F1F5F9' },
  rowInputs: { flexDirection: 'row' },
  // Money Input
  moneyInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  moneyInput: {
    flex: 1,
    paddingRight: 32,
    fontWeight: '700',
    color: '#0F172A',
  },
  moneyUnit: {
    position: 'absolute',
    right: 12,
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  // Voucher Summary Grid
  voucherSummaryGrid: {
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  voucherSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  voucherSummaryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    flex: 1,
  },
  voucherSummaryValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  // Cross check UI
  crossCheckBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#8B1E1E',
  },
  crossCheckBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  crossCheckMatchBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 6,
    padding: 12,
    marginTop: 6,
  },
  crossCheckMatchTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#15803D',
  },
  crossCheckMatchDesc: {
    fontSize: 11.5,
    color: '#166534',
    marginTop: 2,
    lineHeight: 16,
  },
  crossCheckMismatchBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 6,
    padding: 12,
    marginTop: 6,
  },
  crossCheckMismatchTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 4,
  },
  crossCheckMismatchItem: {
    fontSize: 11.5,
    color: '#B45309',
    lineHeight: 16,
    marginBottom: 2,
  },
  crossCheckTable: {
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginTop: 8,
    padding: 8,
  },
  crossCheckTableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  crossCheckTableColHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
    flex: 1,
    textAlign: 'center',
  },
  crossCheckTableCol: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    flex: 1,
  },
  crossCheckTableColVal: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
    textAlign: 'right',
  },
  crossCheckErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 6,
    padding: 10,
    marginTop: 6,
  },
  crossCheckErrorText: {
    fontSize: 11.5,
    color: '#B91C1C',
    flex: 1,
  },
  crossCheckLoadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    padding: 12,
    marginTop: 6,
  },
  crossCheckLoadingText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
    flex: 1,
  },
  crossCheckPendingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    padding: 10,
    marginTop: 6,
  },
  crossCheckPendingText: {
    fontSize: 11,
    color: '#64748B',
    flex: 1,
  },
  // Items (cho Hóa đơn)
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#8B1E1E',
    flexShrink: 0,
  },
  addItemBtnText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  emptyItems: { fontSize: 12, color: '#94A3B8', textAlign: 'center', paddingVertical: 16 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  itemOrderBadge: { width: 24, height: 24, borderRadius: 6, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  itemOrderText: { fontSize: 10, fontWeight: '700', color: '#64748B' },
  itemName: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  itemMeta: { fontSize: 11, color: '#64748B', marginTop: 2 },
  itemAmount: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  itemActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalLabel: { fontSize: 12, fontWeight: '600', color: '#475569' },
  totalValue: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  diffNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: '#FFFBEB', padding: 8, borderRadius: 6, marginTop: 8 },
  diffNoticeText: { flex: 1, fontSize: 11, color: '#92400E', lineHeight: 15 },
  // Sticky bottom
  stickyBottom: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  backBtnText: { fontSize: 14, fontWeight: '600', color: '#475569' },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 6,
    backgroundColor: '#8B1E1E',
  },
  confirmBtnLoading: { backgroundColor: '#B45454' },
  confirmBtnText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 6, borderTopRightRadius: 6, padding: 20, paddingBottom: 34, elevation: 0, shadowOpacity: 0 },
  modalHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  modalBtnCancel: { flex: 1, marginRight: 6, paddingVertical: 12, borderRadius: 6, borderWidth: 1.5, borderColor: '#E2E8F0', alignItems: 'center' },
  modalBtnCancelText: { fontSize: 14, fontWeight: '600', color: '#475569' },
  modalBtnConfirm: { flex: 1, marginLeft: 6, paddingVertical: 12, borderRadius: 6, backgroundColor: '#8B1E1E', alignItems: 'center' },
  modalBtnConfirmText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  // Doc type options in modal
  docTypeOption: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 6, marginBottom: 6, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9' },
  docTypeOptionSelected: { borderColor: '#8B1E1E', backgroundColor: '#FFF8F8' },
  docTypeOptionIcon: { width: 34, height: 34, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  docTypeOptionName: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
});
