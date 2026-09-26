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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { HeaderMotif } from '../../components/common/HeaderMotif';
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
import { getGroupKeyFromDocTypeCode, getGroupMetadata, getDocumentTypeIcon } from './expenseGroupUtils';
import {
  Card,
  CardContent,
  Badge,
  Button,
  Separator,
  useToast,
} from '../../components/ui';
import { parseBackendError } from './expenseValidationUtils';

type TabType = 'KIEM_TRA' | 'THONG_TIN';

export const ExpenseReviewScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, any>>();
  const initialData: ExpenseOcrResult = route.params?.ocrResult || {};
  const periodIdParam = route.params?.periodId || initialData.periodId;

  const { toast } = useToast();
  const { addOrUpdateDocument, removeDocument, setSelectedYear, documentTypes, fetchDocumentTypes, documents, selectedYear, periods } = useExpenseStore();

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

  useEffect(() => { fetchDocumentTypes(); }, [fetchDocumentTypes]);

  // Kiểm tra tính tồn tại của chứng từ trên máy chủ, nếu đã xóa trong DB thì quay lại
  useEffect(() => {
    const isGuid = (val?: string) => !!val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
    if (isGuid(periodIdParam) && isGuid(initialData.documentId)) {
      expenseApi.getDocumentById(periodIdParam!, initialData.documentId!).catch(async (err) => {
        if (err?.response?.status === 404) {
          toast.error('Hóa đơn này đã bị xóa hoặc không còn tồn tại trong hệ thống.', 'Chứng từ không tồn tại');
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

  // Form state
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
  const [paymentMethod, setPaymentMethod] = useState<string>(initialData.paymentMethod || 'Chuyển khoản');
  const [items, setItems] = useState<InvoiceLineItem[]>(initialData.items || []);
  const [isNotReimbursed, setIsNotReimbursed] = useState<boolean>(initialData.isNotReimbursed ?? true);
  const [saving, setSaving] = useState<boolean>(false);
  const [invoiceImageUri, setInvoiceImageUri] = useState<string | undefined>(
    initialData.fileUrl || initialData.originalFileUri
  );
  const [invoiceImageFailed, setInvoiceImageFailed] = useState<boolean>(false);

  // Item modal state
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

  const crucialCheck = validateCrucialFields(initialData.fields || [], initialData.appliedThreshold || 0.8);

  const isDuplicate = useMemo(() => {
    const year = selectedYear || initialData.extractedYear || new Date().getFullYear();
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
  }, [documents, selectedYear, initialData, invoiceNumber, sellerTaxCode]);

  const isIdentityMismatch = initialData.validationStatus?.isIdentityValid === false;
  const isValidationBlocked = isDuplicate || isIdentityMismatch;
  const isReadOnly = Boolean(isRouteReadOnly || isValidationBlocked);

  const validationErrors = useMemo<ValidationErrorItem[]>(() => {
    const list = [...(initialData.validationErrors || [])];

    if (initialData.validationStatus?.isIdentityValid === false && !list.some((e) => e.code === 'ERR_IDENTITY_MISMATCH')) {
      list.push({
        code: 'ERR_IDENTITY_MISMATCH',
        field: 'buyer_name',
        message: 'Thông tin người mua trên hóa đơn (' + (buyerName.trim() || initialData.buyerName || 'Trống') + ') không khớp với Người nộp thuế hoặc bất kỳ Người phụ thuộc nào đã đăng ký.',
        severity: 'error',
      });
    }

    if (isDuplicate && !list.some((e) => e.code === 'ERR_DUPLICATE_DOCUMENT')) {
      list.push({
        code: 'ERR_DUPLICATE_DOCUMENT',
        field: 'invoice_number',
        message: 'Hóa đơn số ' + invoiceNumber.trim() + ' (MST người bán: ' + sellerTaxCode.trim() + ') đã tồn tại trong kỳ tính thuế này.',
        severity: 'error',
      });
    }

    return list;
  }, [initialData, buyerName, isDuplicate, invoiceNumber, sellerTaxCode]);

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
    Alert.alert('Xóa khoản mục', 'Xóa dòng chi phí này khỏi bảng kê?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: () => setItems(items.filter((_, i) => i !== index)) },
    ]);
  };

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
        'Thông tin người mua ("' + (buyerName.trim() || initialData.buyerName || 'Chưa rõ') + '") không khớp với Người nộp thuế hoặc bất kỳ Người phụ thuộc nào trong hồ sơ của bạn.',
        'Người mua không khớp'
      );
      return;
    }

    if (isDuplicate) {
      toast.error(
        'Hóa đơn số ' + invoiceNumber.trim() + ' của đơn vị có MST ' + sellerTaxCode.trim() + ' đã tồn tại trong kỳ tính thuế này.',
        'Hóa đơn bị trùng lặp'
      );
      return;
    }

    setSaving(true);
    try {
      const cleanDate = invoiceDate.trim();
      const validDate = cleanDate.match(/^\d{4}-\d{2}-\d{2}$/) ? cleanDate : undefined;
      const currentTaxYear = new Date().getFullYear();
      const cleanYear = validDate ? parseInt(validDate.substring(0, 4), 10) : Number(initialData.extractedYear) || currentTaxYear;
      const finalDocId = initialData.documentId || `doc-${Date.now()}`;
      const isGuid = (val?: string) => !!val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

      if (isGuid(periodIdParam) && isGuid(initialData.documentId)) {
        try {
          await expenseApi.confirmDocumentReview(periodIdParam!, initialData.documentId!, {
            docTypeCode: currentDocTypeCode ? currentDocTypeCode.trim().toUpperCase() : null,
            sellerName: sellerName.trim() || null,
            sellerTaxCode: sellerTaxCode.trim() || null,
            sellerAddress: sellerAddress.trim() || null,
            sellerPhone: sellerPhone.trim() || null,
            invoiceSeries: invoiceSeries.trim() || null,
            invoiceNumber: invoiceNumber.trim() || null,
            invoiceDate: validDate,
            extractedYear: cleanYear,
            lookupUrl: lookupUrl.trim() || null,
            lookupCode: lookupCode.trim() || null,
            buyerName: buyerName.trim() || null,
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
        docTypeCode: currentDocTypeCode ? currentDocTypeCode.trim().toUpperCase() : null,
        docTypeName: currentDocTypeName,
        sellerName: sellerName.trim() || 'Đơn vị phát hành',
        sellerTaxCode: sellerTaxCode.trim(),
        sellerAddress: sellerAddress.trim(),
        sellerPhone: sellerPhone.trim(),
        invoiceSeries: invoiceSeries.trim(),
        invoiceNumber: invoiceNumber.trim(),
        invoiceDate: validDate || invoiceDate.trim(),
        extractedYear: cleanYear,
        lookupUrl: lookupUrl.trim(),
        lookupCode: lookupCode.trim(),
        buyerName: buyerName.trim(),
        buyerIdCard: buyerIdCard.trim(),
        buyerAddress: buyerAddress.trim(),
        paymentMethod: paymentMethod.trim(),
        totalAmount: totalAmount,
        items: items,
        isNotReimbursed: isNotReimbursed,
        status: 'CONFIRMED',
      };

      await addOrUpdateDocument(cleanYear, confirmedDocument);
      setSelectedYear(cleanYear);
      setSaving(false);

      toast.success(`Hóa đơn đã được lưu vào danh mục "${groupMeta.name}".`, 'Xác nhận thành công');
      navigation.navigate('ExpenseList');
    } catch (err: any) {
      setSaving(false);
      Alert.alert('Lỗi xác nhận', err?.message || 'Không thể xác nhận chứng từ.');
    }
  };

  const handleConfirmReview = () => {
    if (isReadOnly) {
      Alert.alert('Thông báo', 'Chứng từ này đã được duyệt, không thể chỉnh sửa.');
      return;
    }
    if (crucialCheck.hasCrucialLowConfidence) {
      Alert.alert(
        'Kiểm tra lại thông tin',
        'Một số thông tin quan trọng chưa rõ ràng. Bạn đã kiểm tra kỹ chưa?',
        [
          { text: 'Kiểm tra lại', style: 'cancel' },
          { text: 'Xác nhận', onPress: executeConfirm },
        ]
      );
    } else {
      executeConfirm();
    }
  };

  const FieldInput = ({
    label, value, onChange, placeholder, keyboardType = 'default', readOnly = false,
  }: {
    label: string; value: string; onChange?: (v: string) => void;
    placeholder?: string; keyboardType?: any; readOnly?: boolean;
  }) => (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        editable={!isReadOnly && !readOnly}
        style={[styles.textInput, (isReadOnly || readOnly) && styles.readOnlyInput]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        keyboardType={keyboardType}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <HeaderMotif
        title={isReadOnly ? 'CHI TIẾT CHỨNG TỪ' : 'SOÁT XÉT HÓA ĐƠN'}
        onBack={() => navigation.goBack()}
      />

      {/* STICKY HEADER: Số tiền + Danh mục + Trạng thái */}
      <View style={styles.stickyHeader}>
        <View style={styles.stickyLeft}>
          <View style={[styles.stickyIconCircle, { backgroundColor: `${groupMeta.color}20` }]}>
            <Ionicons name={groupMeta.icon as any} size={18} color={groupMeta.color} />
          </View>
          <View style={{ marginLeft: 8 }}>
            <Text style={styles.stickyCategory} numberOfLines={1}>{groupMeta.shortName}</Text>
            <Text style={styles.stickySellerName} numberOfLines={1}>{sellerName || 'Chưa có tên đơn vị'}</Text>
          </View>
        </View>
        <View style={styles.stickyRight}>
          <Text style={styles.stickyAmount}>{formatCurrencyVND(totalAmount)}</Text>
          <Badge variant={isConfirmed ? 'success' : 'warning'} style={{ alignSelf: 'flex-end' }}>
            {isConfirmed ? 'Đã duyệt' : 'Chờ soát xét'}
          </Badge>
        </View>
      </View>

      {/* 2 TABS: Kiểm tra & Xác nhận / Thông tin hóa đơn */}
      <View style={styles.tabBar}>
        {([
          { key: 'KIEM_TRA', label: 'Kiểm tra & Xác nhận', icon: 'shield-checkmark-outline' },
          { key: 'THONG_TIN', label: 'Thông tin hóa đơn', icon: 'reader-outline' },
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
                  <Text style={styles.confirmedBannerTitle}>Hóa đơn đã được duyệt chính thức</Text>
                  <Text style={styles.confirmedBannerDesc}>Đã lưu vào hồ sơ thuế. Chế độ chỉ xem.</Text>
                </View>
                <Badge variant="success">Đã xác nhận</Badge>
              </View>
            )}

            {!isPeriodSubmitted && isValidationBlocked && (
              <View style={styles.validationBlockedBanner}>
                <Ionicons name="lock-closed" size={20} color="#B91C1C" />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.validationBlockedTitle}>Không thể chỉnh sửa hóa đơn</Text>
                  <Text style={styles.validationBlockedDesc}>
                    {isIdentityMismatch
                      ? 'Thông tin người mua không khớp với người nộp thuế hoặc người phụ thuộc.'
                      : 'Hóa đơn bị trùng mã số thuế và số hóa đơn trong cùng kỳ tính thuế.'}
                  </Text>
                </View>
                <Badge variant="destructive">Đã khóa</Badge>
              </View>
            )}

            {/* Ảnh hóa đơn */}
            {invoiceImageUri && !invoiceImageFailed ? (
              <Card style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="image-outline" size={15} color="#475569" />
                  <Text style={styles.cardHeaderTitle}>Ảnh hóa đơn gốc</Text>
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
                  <Text style={styles.imageErrorText}>Không tải được ảnh hóa đơn gốc.</Text>
                </View>
              </Card>
            ) : null}

            {/* Đánh giá mức độ tin cậy */}
            <Card style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="stats-chart-outline" size={15} color="#475569" />
                <Text style={styles.cardHeaderTitle}>Mức độ tin cậy thông tin nhận diện</Text>
                <Badge variant={initialData.isPassedThreshold !== false ? 'success' : 'warning'}>
                  {initialData.isPassedThreshold !== false ? 'Đạt yêu cầu' : 'Cần xem lại'}
                </Badge>
              </View>
              <View style={styles.confidenceBar}>
                <View style={[styles.confidenceFill, {
                  width: `${Math.min(100, Math.round((initialData.overallConfidence || 0.92) * 100))}%`,
                  backgroundColor: initialData.isPassedThreshold !== false ? '#16A34A' : '#D97706',
                }]} />
              </View>
              <Text style={styles.confidencePct}>
                {Math.round((initialData.overallConfidence || 0.92) * 100)}% / Ngưỡng {Math.round((initialData.appliedThreshold || 0.8) * 100)}%
              </Text>

              {/* 4 điểm kiểm tra */}
              <View style={styles.checkGrid}>
                {[
                  'Tổng tiền thanh toán',
                  'Mã số thuế bên bán',
                  'Số CCCD người mua',
                  'Số hóa đơn',
                ].map((name) => (
                  <View key={name} style={styles.checkItem}>
                    <Ionicons
                      name={crucialCheck.hasCrucialLowConfidence ? 'alert-circle-outline' : 'checkmark-circle-outline'}
                      size={14}
                      color={crucialCheck.hasCrucialLowConfidence ? '#D97706' : '#16A34A'}
                    />
                    <Text style={styles.checkText}>{name}</Text>
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
                  <Text style={[styles.cardHeaderTitle, { color: '#15803D' }]}>Hóa đơn đáp ứng điều kiện giảm trừ thuế</Text>
                </View>
                <Text style={styles.successDesc}>
                  Đúng năm tính thuế {initialData.extractedYear || new Date().getFullYear()}, đúng danh mục, thông tin đầy đủ và rõ ràng.
                </Text>
              </Card>
            )}

            {/* Cam kết chưa bồi hoàn */}
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
          </View>
        )}

        {/* ===== TAB 2: THÔNG TIN HÓA ĐƠN ===== */}
        {activeTab === 'THONG_TIN' && (
          <View>
            {/* Loại chứng từ */}
            <Card style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardHeader}>
                  <Ionicons name="albums-outline" size={15} color="#475569" />
                  <Text style={styles.cardHeaderTitle}>Loại hóa đơn chi phí</Text>
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
                    <Text style={styles.docTypeCode}>{currentDocTypeCode}</Text>
                    <Badge variant={currentDocTypeItem?.isTaxEligible !== false ? 'teal' : 'secondary'}>
                      {currentDocTypeItem?.isTaxEligible !== false ? 'Được giảm trừ thuế' : 'Không giảm trừ'}
                    </Badge>
                  </View>
                </View>
              </View>
            </Card>

            {/* Đơn vị phát hành (Bên bán) */}
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

            {/* Thông tin hóa đơn */}
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

            {/* Người thanh toán */}
            <Card style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="person-outline" size={15} color="#475569" />
                <Text style={styles.cardHeaderTitle}>Người thanh toán</Text>
              </View>
              <FieldInput label="Họ và tên" value={buyerName} onChange={setBuyerName} placeholder="NGUYỄN VĂN AN" />
              <FieldInput label="Số CCCD" value={buyerIdCard} onChange={setBuyerIdCard} placeholder="12 chữ số" keyboardType="numeric" />
              <FieldInput label="Địa chỉ" value={buyerAddress} onChange={setBuyerAddress} placeholder="Địa chỉ thường trú" />
              <FieldInput label="Hình thức thanh toán" value={paymentMethod} onChange={setPaymentMethod} placeholder="Chuyển khoản / Tiền mặt" />
            </Card>

            {/* Bảng kê chi tiết */}
            <Card style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardHeader}>
                  <Ionicons name="list-outline" size={15} color="#475569" />
                  <Text style={styles.cardHeaderTitle}>Danh sách dịch vụ & Chi phí ({items.length})</Text>
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
              {saving ? 'Đang lưu...' : `Xác nhận & Lưu vào "${groupMeta.shortName}"`}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* MODAL THÊM / SỬA DÒNG CHI PHÍ */}
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

      {/* MODAL CHỌN LOẠI CHỨNG TỪ */}
      <Modal visible={showDocTypeModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '80%' }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Chọn loại hóa đơn</Text>
              <TouchableOpacity onPress={() => setShowDocTypeModal(false)}>
                <Ionicons name="close" size={20} color="#475569" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {documentTypes.map((t) => {
                const isSelected = t.code === currentDocTypeCode;
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
                      <Text style={[styles.docTypeOptionName, isSelected && { color: '#8B1E1E', fontWeight: '700' }]}>{t.name}</Text>
                      <Text style={styles.docTypeOptionCode}>{t.code}</Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={18} color="#8B1E1E" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8F5EE' },
  // Sticky header
  stickyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  stickyLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  stickyIconCircle: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  stickyCategory: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  stickySellerName: { fontSize: 13, fontWeight: '700', color: '#0F172A', maxWidth: 160 },
  stickyRight: { alignItems: 'flex-end', gap: 3 },
  stickyAmount: { fontSize: 16, fontWeight: '800', color: '#8B1E1E' },
  // Tabs
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
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
  scrollContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20 },
  // Cards
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 12,
  },
  cardWarning: { borderColor: '#FDE68A', backgroundColor: '#FFFBEB' },
  cardSuccess: { borderColor: '#BBF7D0', backgroundColor: '#F0FDF4' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  cardHeaderTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A', flex: 1 },
  // Invoice image
  invoiceImage: { width: '100%', height: 220, borderRadius: 8, backgroundColor: '#0F172A' },
  imageErrorBox: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    gap: 8,
  },
  imageErrorText: { fontSize: 12, color: '#64748B' },
  // Confidence
  confidenceBar: { height: 8, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden', marginBottom: 4 },
  confidenceFill: { height: '100%', borderRadius: 4 },
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
    borderRadius: 12,
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
    borderRadius: 10,
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
    borderRadius: 10,
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
  commitBox: { flexDirection: 'row', alignItems: 'flex-start', padding: 12, borderRadius: 10, borderWidth: 1.5 },
  commitBoxChecked: { borderColor: '#8B1E1E', backgroundColor: '#FFF8F8' },
  commitBoxUnchecked: { borderColor: '#CBD5E1', backgroundColor: '#F8FAFC' },
  commitTitle: { fontSize: 12, fontWeight: '600', color: '#0F172A', lineHeight: 17 },
  commitStatus: { fontSize: 11, color: '#64748B', marginTop: 3 },
  // Doc type
  docTypeRow: { flexDirection: 'row', alignItems: 'center' },
  docTypeIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  docTypeName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  docTypeCode: { fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: '#64748B' },
  changeCategoryBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6, borderRadius: 6, backgroundColor: '#FFF8F8', borderWidth: 1, borderColor: '#FECACA' },
  changeCategoryText: { fontSize: 11, fontWeight: '700', color: '#8B1E1E' },
  // Fields
  fieldGroup: { marginBottom: 10 },
  fieldLabel: { fontSize: 11, fontWeight: '600', color: '#475569', marginBottom: 4 },
  textInput: {
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  readOnlyInput: { backgroundColor: '#F8FAFC', color: '#64748B', borderColor: '#F1F5F9' },
  rowInputs: { flexDirection: 'row' },
  // Items
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: '#8B1E1E',
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
    borderRadius: 12,
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
    borderRadius: 12,
    backgroundColor: '#8B1E1E',
    shadowColor: '#8B1E1E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmBtnLoading: { backgroundColor: '#B45454' },
  confirmBtnText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34 },
  modalHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  modalBtnCancel: { flex: 1, marginRight: 6, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: '#E2E8F0', alignItems: 'center' },
  modalBtnCancelText: { fontSize: 14, fontWeight: '600', color: '#475569' },
  modalBtnConfirm: { flex: 1, marginLeft: 6, paddingVertical: 12, borderRadius: 10, backgroundColor: '#8B1E1E', alignItems: 'center' },
  modalBtnConfirmText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  // Doc type options in modal
  docTypeOption: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, marginBottom: 6, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9' },
  docTypeOptionSelected: { borderColor: '#8B1E1E', backgroundColor: '#FFF8F8' },
  docTypeOptionIcon: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  docTypeOptionName: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  docTypeOptionCode: { fontSize: 10, color: '#94A3B8', marginTop: 1 },
});

