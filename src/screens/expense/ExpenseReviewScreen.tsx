import React, { useState, useEffect } from 'react';
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
import { ExpenseOcrResult, InvoiceLineItem } from '../../types/expense';
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
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Badge,
  Button,
  Tabs,
  TabsList,
  TabsTrigger,
  Separator,
} from '../../components/ui';

type TabType = 'AUDIT' | 'INFO' | 'ITEMS';

export const ExpenseReviewScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, any>>();
  const initialData: ExpenseOcrResult = route.params?.ocrResult || {};
  const periodIdParam = route.params?.periodId || initialData.periodId;

  // Hóa đơn đã duyệt hoặc mở từ action Xem chi tiết -> chế độ Chỉ xem (ReadOnly)
  const isConfirmed = initialData.status === 'CONFIRMED';
  const isReadOnly = Boolean(route.params?.isReadOnly || isConfirmed);

  const { addOrUpdateDocument, setSelectedYear, documentTypes, fetchDocumentTypes } = useExpenseStore();

  const [currentDocTypeCode, setCurrentDocTypeCode] = useState<string>(
    initialData.docTypeCode || (documentTypes && documentTypes.length > 0 ? documentTypes[0].code : 'MEDICAL_EXPENSE_INVOICE')
  );
  const [showDocTypeModal, setShowDocTypeModal] = useState<boolean>(false);

  useEffect(() => {
    fetchDocumentTypes();
  }, [fetchDocumentTypes]);

  const [activeTab, setActiveTab] = useState<TabType>('AUDIT');
  const [selectedFieldBox, setSelectedFieldBox] = useState<string | null>(null);

  // Nhóm Tổ do AI phân loại hoặc người dùng điều chỉnh theo config admin
  const groupKey = getGroupKeyFromDocTypeCode(currentDocTypeCode);
  const groupMeta = getGroupMetadata(groupKey);
  const currentDocTypeItem = documentTypes.find((t) => t.code === currentDocTypeCode);
  const currentDocTypeName = currentDocTypeItem?.name || initialData.docTypeName || groupMeta.name;

  // Form state - Bên bán
  const [sellerName, setSellerName] = useState<string>(initialData.sellerName || '');
  const [sellerTaxCode, setSellerTaxCode] = useState<string>(initialData.sellerTaxCode || '');
  const [sellerAddress, setSellerAddress] = useState<string>(initialData.sellerAddress || '');
  const [sellerPhone, setSellerPhone] = useState<string>(initialData.sellerPhone || '');

  // Form state - Hóa đơn
  const [invoiceSeries, setInvoiceSeries] = useState<string>(initialData.invoiceSeries || '');
  const [invoiceNumber, setInvoiceNumber] = useState<string>(initialData.invoiceNumber || '');
  const [invoiceDate, setInvoiceDate] = useState<string>(initialData.invoiceDate || '');
  const [lookupUrl, setLookupUrl] = useState<string>(initialData.lookupUrl || '');
  const [lookupCode, setLookupCode] = useState<string>(initialData.lookupCode || '');

  // Form state - Bên mua
  const [buyerName, setBuyerName] = useState<string>(initialData.buyerName || '');
  const [buyerIdCard, setBuyerIdCard] = useState<string>(initialData.buyerIdCard || '');
  const [buyerAddress, setBuyerAddress] = useState<string>(initialData.buyerAddress || '');
  const [paymentMethod, setPaymentMethod] = useState<string>(
    initialData.paymentMethod || 'Chuyển khoản'
  );

  // Form state - Chi tiết hàng hóa / Viện phí
  const [items, setItems] = useState<InvoiceLineItem[]>(initialData.items || []);
  const [itemModalVisible, setItemModalVisible] = useState<boolean>(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [itemFormName, setItemFormName] = useState<string>('');
  const [itemFormUnit, setItemFormUnit] = useState<string>('');
  const [itemFormQty, setItemFormQty] = useState<string>('1');
  const [itemFormPrice, setItemFormPrice] = useState<string>('0');
  const [saving, setSaving] = useState<boolean>(false);

  // Tổng tiền tính tự động từ items
  const totalAmount = calculateItemsTotal(items) || initialData.totalAmount || 0;

  // Kiểm tra trường cốt lõi
  const crucialCheck = validateCrucialFields(
    initialData.fields || [],
    initialData.appliedThreshold || 0.8
  );

  // Danh sách lỗi validation
  const validationErrors = initialData.validationErrors || [];

  // Mở modal thêm/sửa hàng hóa
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
    if (isReadOnly) return;
    if (!itemFormName.trim()) {
      if (Platform.OS === 'web') {
        window.alert('Thiếu thông tin: Vui lòng nhập tên dịch vụ / hàng hóa.');
      } else {
        Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên dịch vụ / hàng hóa.');
      }
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
    if (Platform.OS === 'web') {
      const ok = window.confirm('Bạn có chắc chắn muốn xóa dòng chi phí này?');
      if (ok) {
        setItems(items.filter((_, i) => i !== index));
      }
    } else {
      Alert.alert('Xóa mục này', 'Bạn có chắc chắn muốn xóa dòng chi phí này?', [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: () => {
            setItems(items.filter((_, i) => i !== index));
          },
        },
      ]);
    }
  };

  // Xác nhận lưu hóa đơn (Human-in-the-loop Confirm)
  const executeConfirm = async () => {
    if (isReadOnly) {
      if (Platform.OS === 'web') {
        window.alert('Chứng từ này đã được duyệt, không thể chỉnh sửa hoặc lưu lại.');
      } else {
        Alert.alert('Không thể chỉnh sửa', 'Chứng từ này đã được duyệt, không thể chỉnh sửa hoặc lưu lại.');
      }
      return;
    }

    setSaving(true);
    try {
      const cleanDate = invoiceDate.trim();
      const validDate = cleanDate.match(/^\d{4}-\d{2}-\d{2}$/) ? cleanDate : undefined;
      const currentTaxYear = new Date().getFullYear();
      const cleanYear = validDate
        ? parseInt(validDate.substring(0, 4), 10)
        : Number(initialData.extractedYear) || currentTaxYear;
      const finalDocId = initialData.documentId || `doc-${Date.now()}`;

      // 1. Nếu có backend periodId và documentId hợp lệ, gọi API xác nhận chính thức
      const isGuid = (val?: string) =>
        !!val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

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
            items: items.map((it, idx) => ({
              itemOrder: it.itemOrder || idx + 1,
              itemName: it.itemName,
              unit: it.unit || null,
              quantity: Number(it.quantity) || 1,
              unitPrice: Number(it.unitPrice) || 0,
              totalPrice:
                Number(it.totalPrice) ||
                (Number(it.quantity) || 1) * (Number(it.unitPrice) || 0),
            })),
          });
        } catch (apiErr: any) {
          console.warn('Lỗi gọi API confirmDocumentReview:', apiErr);
          const statusCode = apiErr?.response?.status || apiErr?.status;
          const beMsg = apiErr?.response?.data?.message || apiErr?.message;

          // Xử lý các validation đặc thù từ Backend (409 trùng lặp số HĐ & MST, 400 đã duyệt)
          if (statusCode === 409 || statusCode === 400) {
            setSaving(false);
            const displayMsg = beMsg || 'Hóa đơn đã tồn tại hoặc đã được duyệt trước đó.';
            if (Platform.OS === 'web') {
              window.alert(`Không thể xác nhận: ${displayMsg}`);
            } else {
              Alert.alert('Không thể xác nhận', displayMsg);
            }
            return;
          }
        }
      }

      // 2. Lưu vào Store của năm tương ứng
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
        status: 'CONFIRMED',
      };

      await addOrUpdateDocument(cleanYear, confirmedDocument);
      setSelectedYear(cleanYear);

      setSaving(false);

      if (Platform.OS === 'web') {
        window.alert(
          `Xác nhận thành công!\nChứng từ đã được ghi nhận và lưu vào nhóm:\n"${groupMeta.name}".`
        );
        navigation.navigate('ExpenseList');
      } else {
        Alert.alert(
          'Xác nhận thành công!',
          `Chứng từ đã được ghi nhận và lưu vào nhóm:\n"${groupMeta.name}".`,
          [
            {
              text: 'Về danh sách',
              onPress: () => navigation.navigate('ExpenseList'),
            },
          ]
        );
      }
    } catch (err: any) {
      setSaving(false);
      const errMsg = err?.message || 'Không thể xác nhận chứng từ.';
      if (Platform.OS === 'web') {
        window.alert(`Lỗi xác nhận: ${errMsg}`);
      } else {
        Alert.alert('Lỗi xác nhận', errMsg);
      }
    }
  };

  const handleConfirmReview = () => {
    if (isReadOnly) {
      if (Platform.OS === 'web') {
        window.alert('Chứng từ này đã được duyệt, không thể chỉnh sửa.');
      } else {
        Alert.alert('Thông báo', 'Chứng từ này đã được duyệt, không thể chỉnh sửa.');
      }
      return;
    }

    if (crucialCheck.hasCrucialLowConfidence) {
      if (Platform.OS === 'web') {
        const confirmed = window.confirm(
          'Lưu ý kiểm tra thông tin:\nCó thông tin quan trọng cần rà soát lại độ chuẩn xác. Bạn có chắc chắn muốn tiếp tục xác nhận và lưu không?'
        );
        if (confirmed) {
          executeConfirm();
        }
      } else {
        Alert.alert(
          'Lưu ý kiểm tra thông tin',
          'Có thông tin quan trọng cần rà soát lại độ chuẩn xác. Bạn đã kiểm tra kỹ trước khi xác nhận chưa?',
          [
            { text: 'Kiểm tra lại', style: 'cancel' },
            { text: 'Xác nhận lưu', onPress: executeConfirm },
          ]
        );
      }
    } else {
      executeConfirm();
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <HeaderMotif
        title={isReadOnly ? "CHI TIẾT CHỨNG TỪ" : "BÁO CÁO SOÁT XÉT CHỨNG TỪ"}
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* BANNER THÔNG TIN PHÂN LOẠI VÀO NHÓM CHỨNG TỪ */}
        <Card style={styles.aiClassificationCard}>
          <CardContent style={styles.aiClassificationContent}>
            <View
              style={[
                styles.aiClassificationIconCircle,
                { backgroundColor: `${groupMeta.color}15` },
              ]}
            >
              <Ionicons name={groupMeta.icon as any} size={26} color={groupMeta.color} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Badge variant={groupMeta.badgeVariant}>
                  NHÓM CHI PHÍ: {groupMeta.shortName.toUpperCase()}
                </Badge>
              </View>
              <Text style={styles.aiClassificationName}>{groupMeta.name}</Text>
              <Text style={styles.aiClassificationDesc}>
                {groupMeta.description}
              </Text>
            </View>
          </CardContent>
        </Card>

        {/* BANNER THÔNG BÁO KHI Ở CHẾ ĐỘ XEM CHI TIẾT (ĐÃ DUYỆT) */}
        {isReadOnly && (
          <View style={styles.verifiedBanner}>
            <View style={styles.verifiedIconCircle}>
              <Ionicons name="shield-checkmark" size={22} color="#16A34A" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={styles.verifiedBannerTitle}>CHỨNG TỪ ĐÃ ĐƯỢC DUYỆT</Text>
                <Badge variant="default" style={styles.verifiedBadge}>
                  ĐÃ XÁC NHẬN
                </Badge>
              </View>
              <Text style={styles.verifiedBannerDesc}>
                Chứng từ này đã được xác nhận và lưu trữ chính thức vào hồ sơ thuế. Chế độ chỉ xem, không thể chỉnh sửa thông tin.
              </Text>
            </View>
          </View>
        )}

        {/* 3 TABS SHADCN ĐIỀU HƯỚNG */}
        <View style={styles.tabsWrapper}>
          <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as TabType)}>
            <TabsList>
              <TabsTrigger
                value="AUDIT"
                icon={<Ionicons name="shield-checkmark-outline" size={16} color="#475569" />}
              >
                Đối soát chứng từ
              </TabsTrigger>
              <TabsTrigger
                value="INFO"
                icon={<Ionicons name="reader-outline" size={16} color="#475569" />}
              >
                Thông tin HĐ
              </TabsTrigger>
              <TabsTrigger
                value="ITEMS"
                icon={<Ionicons name="list-outline" size={16} color="#475569" />}
              >
                {`Bảng kê (${items.length})`}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </View>

        {/* ===================== TAB 1: ĐỐI SOÁT CHỨNG TỪ & ĐÁNH GIÁ ĐỘ CHUẨN XÁC ===================== */}
        {activeTab === 'AUDIT' && (
          <View>
            {/* Ảnh hóa đơn và vùng thông tin */}
            <Card style={styles.visualCard}>
              <CardHeader>
                <CardTitle>Ảnh hóa đơn & Vùng thông tin</CardTitle>
                <CardDescription>
                  Chạm vào từng mục bên dưới để làm nổi bật vị trí trên chứng từ
                </CardDescription>
              </CardHeader>
              <CardContent>
                <View style={styles.imageWrapper}>
                  <Image
                    source={{
                      uri:
                        initialData.fileUrl ||
                        'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=800&q=80',
                    }}
                    style={styles.documentImage}
                    resizeMode="contain"
                  />

                  {selectedFieldBox && (
                    <View style={styles.highlightBoxOverlay}>
                      <View style={styles.simulatedBox}>
                        <Text style={styles.simulatedBoxText}>{selectedFieldBox}</Text>
                      </View>
                    </View>
                  )}
                </View>

                {/* Danh sách các trường bóc tách có tọa độ */}
                <View style={styles.fieldTagsRow}>
                  {initialData.fields && initialData.fields.length > 0 ? (
                    initialData.fields.map((f) => {
                      const isSelected = selectedFieldBox === f.fieldLabel;
                      return (
                        <TouchableOpacity
                          key={f.fieldName}
                          style={[styles.fieldTag, isSelected && styles.fieldTagSelected]}
                          onPress={() =>
                            setSelectedFieldBox(
                              isSelected ? null : f.fieldLabel || f.fieldName
                            )
                          }
                        >
                          <View
                            style={[
                              styles.fieldConfidenceDot,
                              {
                                backgroundColor:
                                  f.confidenceScore >= (initialData.appliedThreshold || 0.8)
                                    ? theme.colors.success
                                    : theme.colors.error,
                              },
                            ]}
                          />
                          <Text style={styles.fieldTagText}>
                            {f.fieldLabel || f.fieldName} ({Math.round(f.confidenceScore * 100)}%)
                          </Text>
                        </TouchableOpacity>
                      );
                    })
                  ) : (
                    <Text style={styles.noFieldNotice}>
                      Ảnh hóa đơn không có tọa độ chi tiết từng mục.
                    </Text>
                  )}
                </View>
              </CardContent>
            </Card>

            {/* Thẻ Đánh giá Độ chuẩn xác dữ liệu */}
            <Card style={styles.scoreCard}>
              <CardHeader>
                <View style={styles.scoreTopRow}>
                  <View>
                    <CardTitle>Đánh giá mức độ chuẩn xác dữ liệu</CardTitle>
                    <CardDescription>
                      Tiêu chuẩn yêu cầu:{' '}
                      {Math.round((initialData.appliedThreshold || 0.8) * 100)}%
                    </CardDescription>
                  </View>
                  <Badge
                    variant={initialData.isPassedThreshold !== false ? 'success' : 'warning'}
                  >
                    {initialData.isPassedThreshold !== false ? 'ĐẠT TIÊU CHUẨN' : 'CẦN KIỂM TRA LẠI'}
                  </Badge>
                </View>
              </CardHeader>
              <CardContent>
                <View style={styles.meterContainer}>
                  <View style={styles.meterTrack}>
                    <View
                      style={[
                        styles.meterFill,
                        {
                          width: `${Math.min(
                            100,
                            Math.round((initialData.overallConfidence || 0.92) * 100)
                          )}%`,
                          backgroundColor:
                            initialData.isPassedThreshold !== false
                              ? '#16A34A'
                              : '#D97706',
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.meterValText}>
                    {Math.round((initialData.overallConfidence || 0.92) * 100)}%
                  </Text>
                </View>

                {/* Rà soát 4 thông tin quan trọng nhất */}
                <View style={styles.crucialSection}>
                  <Text style={styles.crucialHeader}>
                    Kiểm tra 4 thông tin quan trọng nhất:
                  </Text>
                  <View style={styles.crucialGrid}>
                    {[
                      'Tổng tiền thanh toán',
                      'Mã số thuế bên bán',
                      'CCCD / Mã số thuế người mua',
                      'Số hóa đơn',
                    ].map((name) => (
                      <View key={name} style={styles.crucialItem}>
                        <Ionicons
                          name={
                            crucialCheck.hasCrucialLowConfidence
                              ? 'alert-circle'
                              : 'checkmark-circle'
                          }
                          size={14}
                          color={
                            crucialCheck.hasCrucialLowConfidence ? '#D97706' : '#16A34A'
                          }
                        />
                        <Text style={styles.crucialText}>{name}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </CardContent>
            </Card>

            {/* Banner hiển thị các lưu ý và sai lệch */}
            {validationErrors.length > 0 ? (
              <Card style={styles.errorMatrixCard}>
                <CardHeader>
                  <View style={styles.errorMatrixHeader}>
                    <Ionicons name="warning" size={20} color={theme.colors.error} />
                    <CardTitle style={{ color: theme.colors.error, marginLeft: 8 }}>
                      Danh sách lưu ý & Cảnh báo sai lệch
                    </CardTitle>
                  </View>
                </CardHeader>
                <CardContent>
                  {validationErrors.map((err, idx) => {
                    const details = getValidationMatrixErrorDetails(err.code);
                    return (
                      <View key={idx} style={styles.errorItemBox}>
                        <Text style={styles.errorItemTitle}>{details.title}</Text>
                        <Text style={styles.errorItemMsg}>{details.message}</Text>
                        <Text style={styles.errorItemHint}>Gợi ý: {details.actionHint}</Text>
                      </View>
                    );
                  })}
                </CardContent>
              </Card>
            ) : (
              <Card style={styles.validMatrixCard}>
                <CardContent style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="checkmark-done-circle" size={28} color="#16A34A" />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.validMatrixTitle}>
                      Hóa đơn đáp ứng đầy đủ tiêu chuẩn khấu trừ thuế
                    </Text>
                    <Text style={styles.validMatrixSubtitle}>
                      Khớp năm tính thuế {initialData.extractedYear || new Date().getFullYear()}, đúng danh mục giảm
                      trừ, thông tin rõ ràng đầy đủ.
                    </Text>
                  </View>
                </CardContent>
              </Card>
            )}
          </View>
        )}

        {/* ===================== TAB 2: THÔNG TIN HÓA ĐƠN (HUMAN-IN-THE-LOOP EDIT) ===================== */}
        {activeTab === 'INFO' && (
          <View>
            {/* Khối Loại chứng từ cấu hình */}
            <Card style={styles.formSectionCard}>
              <CardHeader style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <CardTitle>Loại chứng từ & Phân nhóm</CardTitle>
                {!isReadOnly && (
                  <TouchableOpacity
                    onPress={() => setShowDocTypeModal(true)}
                    style={styles.changeDocTypeBtn}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="swap-horizontal" size={14} color={theme.colors.primary} />
                    <Text style={styles.changeDocTypeBtnText}>Thay đổi loại</Text>
                  </TouchableOpacity>
                )}
              </CardHeader>
              <CardContent>
                <View style={styles.docTypeSelectedBox}>
                  <View style={styles.docTypeSelectedIconCircle}>
                    <Ionicons
                      name={getDocumentTypeIcon(currentDocTypeCode, currentDocTypeName) as any}
                      size={20}
                      color={theme.colors.primary}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.docTypeSelectedName}>{currentDocTypeName}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6, flexWrap: 'wrap' }}>
                      <Text style={styles.docTypeCodeMono}>{currentDocTypeCode}</Text>
                      <Badge variant={currentDocTypeItem?.isTaxEligible !== false ? 'teal' : 'secondary'}>
                        {currentDocTypeItem?.isTaxEligible !== false ? 'Đủ điều kiện giảm trừ' : 'Không giảm trừ'}
                      </Badge>
                    </View>
                  </View>
                </View>
              </CardContent>
            </Card>

            {/* Khối bên bán */}
            <Card style={styles.formSectionCard}>
              <CardHeader>
                <CardTitle>Đơn vị phát hành (Bên bán)</CardTitle>
              </CardHeader>
              <CardContent>
                <Text style={styles.fieldLabel}>Tên cơ sở / Bệnh viện / Trường học</Text>
                <TextInput
                  editable={!isReadOnly}
                  style={[styles.textInput, isReadOnly && styles.readOnlyInput]}
                  value={sellerName}
                  onChangeText={setSellerName}
                  placeholder="Nhập tên bên bán"
                />

                <Text style={styles.fieldLabel}>Mã số thuế bên bán</Text>
                <TextInput
                  editable={!isReadOnly}
                  style={[styles.textInput, isReadOnly && styles.readOnlyInput]}
                  value={sellerTaxCode}
                  onChangeText={setSellerTaxCode}
                  placeholder="Ví dụ: 0302221111"
                  keyboardType="numeric"
                />

                <Text style={styles.fieldLabel}>Địa chỉ bên bán</Text>
                <TextInput
                  editable={!isReadOnly}
                  style={[styles.textInput, isReadOnly && styles.readOnlyInput]}
                  value={sellerAddress}
                  onChangeText={setSellerAddress}
                  placeholder="Địa chỉ trụ sở"
                />

                <Text style={styles.fieldLabel}>Số điện thoại liên hệ</Text>
                <TextInput
                  editable={!isReadOnly}
                  style={[styles.textInput, isReadOnly && styles.readOnlyInput]}
                  value={sellerPhone}
                  onChangeText={setSellerPhone}
                  placeholder="Số điện thoại"
                  keyboardType="phone-pad"
                />
              </CardContent>
            </Card>

            {/* Khối hóa đơn */}
            <Card style={styles.formSectionCard}>
              <CardHeader>
                <CardTitle>Thông tin hóa đơn & Tra cứu</CardTitle>
              </CardHeader>
              <CardContent>
                <View style={styles.rowInputs}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.fieldLabel}>Ký hiệu mẫu HĐ</Text>
                    <TextInput
                      editable={!isReadOnly}
                      style={[styles.textInput, isReadOnly && styles.readOnlyInput]}
                      value={invoiceSeries}
                      onChangeText={setInvoiceSeries}
                      placeholder="2C26TBH"
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.fieldLabel}>Số hóa đơn</Text>
                    <TextInput
                      editable={!isReadOnly}
                      style={[styles.textInput, isReadOnly && styles.readOnlyInput]}
                      value={invoiceNumber}
                      onChangeText={setInvoiceNumber}
                      placeholder="0082621"
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <Text style={styles.fieldLabel}>Ngày lập hóa đơn (YYYY-MM-DD)</Text>
                <TextInput
                  editable={!isReadOnly}
                  style={[styles.textInput, isReadOnly && styles.readOnlyInput]}
                  value={invoiceDate}
                  onChangeText={setInvoiceDate}
                  placeholder={`${new Date().getFullYear()}-03-15`}
                />

                <Text style={styles.fieldLabel}>Đường dẫn tra cứu HĐĐT</Text>
                <TextInput
                  editable={!isReadOnly}
                  style={[styles.textInput, isReadOnly && styles.readOnlyInput]}
                  value={lookupUrl}
                  onChangeText={setLookupUrl}
                  placeholder="https://..."
                  autoCapitalize="none"
                />

                <Text style={styles.fieldLabel}>Mã tra cứu hóa đơn</Text>
                <TextInput
                  editable={!isReadOnly}
                  style={[styles.textInput, isReadOnly && styles.readOnlyInput]}
                  value={lookupCode}
                  onChangeText={setLookupCode}
                  placeholder="Nhập mã tra cứu"
                />
              </CardContent>
            </Card>

            {/* Khối người mua */}
            <Card style={styles.formSectionCard}>
              <CardHeader>
                <CardTitle>Người nộp thuế / Thân nhân (Bên mua)</CardTitle>
              </CardHeader>
              <CardContent>
                <Text style={styles.fieldLabel}>Họ và tên người mua / Bệnh nhân</Text>
                <TextInput
                  editable={!isReadOnly}
                  style={[styles.textInput, isReadOnly && styles.readOnlyInput]}
                  value={buyerName}
                  onChangeText={setBuyerName}
                  placeholder="NGUYỄN VĂN AN"
                />

                <Text style={styles.fieldLabel}>Số CCCD người mua</Text>
                <TextInput
                  editable={!isReadOnly}
                  style={[styles.textInput, isReadOnly && styles.readOnlyInput]}
                  value={buyerIdCard}
                  onChangeText={setBuyerIdCard}
                  placeholder="12 chữ số CCCD"
                  keyboardType="numeric"
                />

                <Text style={styles.fieldLabel}>Phương thức thanh toán</Text>
                <TextInput
                  editable={!isReadOnly}
                  style={[styles.textInput, isReadOnly && styles.readOnlyInput]}
                  value={paymentMethod}
                  onChangeText={setPaymentMethod}
                  placeholder="Chuyển khoản / Tiền mặt / Thẻ"
                />
              </CardContent>
            </Card>
          </View>
        )}

        {/* ===================== TAB 3: BẢNG CHI TIẾT HÀNG HÓA / DỊCH VỤ ===================== */}
        {activeTab === 'ITEMS' && (
          <View>
            <Card style={styles.formSectionCard}>
              <CardHeader>
                <View style={styles.itemsHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <CardTitle>Bảng kê chi tiết viện phí / học phí</CardTitle>
                    <CardDescription>
                      Đã ghi nhận {items.length} dòng mục chi phí
                    </CardDescription>
                  </View>
                  {!isReadOnly && (
                    <Button
                      variant="default"
                      size="sm"
                      onPress={() => handleOpenItemModal()}
                      icon={<Ionicons name="add" size={16} color="#FFFFFF" />}
                    >
                      Thêm dòng
                    </Button>
                  )}
                </View>
              </CardHeader>
              <CardContent>
                {items.length === 0 ? (
                  <Text style={styles.noFieldNotice}>
                    {isReadOnly
                      ? 'Không có dòng bảng kê chi tiết.'
                      : "Chưa có dòng kê nào. Bấm 'Thêm dòng' để bổ sung chi tiết."}
                  </Text>
                ) : (
                  items.map((it, idx) => (
                    <View key={idx} style={styles.itemRowCard}>
                      <View style={styles.itemOrderBadge}>
                        <Text style={styles.itemOrderText}>#{it.itemOrder || idx + 1}</Text>
                      </View>

                      <View style={{ flex: 1, marginHorizontal: 10 }}>
                        <Text style={styles.itemNameText}>{it.itemName}</Text>
                        <Text style={styles.itemSubText}>
                          {it.quantity} {it.unit || 'mục'} x {formatCurrencyVND(it.unitPrice)}
                        </Text>
                        <Text style={styles.itemTotalAmount}>
                          {formatCurrencyVND(it.totalPrice)}
                        </Text>
                      </View>

                      {!isReadOnly && (
                        <View style={styles.itemActions}>
                          <TouchableOpacity
                            style={styles.itemIconBtn}
                            onPress={() => handleOpenItemModal(idx)}
                          >
                            <Ionicons name="pencil" size={16} color={theme.colors.primary} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.itemIconBtn}
                            onPress={() => handleDeleteItem(idx)}
                          >
                            <Ionicons name="trash-outline" size={16} color={theme.colors.error} />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  ))
                )}

                <Separator style={{ marginVertical: 14 }} />

                {/* Tổng cộng chi phí */}
                <View style={styles.totalSummaryRow}>
                  <Text style={styles.totalSummaryLabel}>TỔNG CỘNG THANH TOÁN:</Text>
                  <Text style={styles.totalSummaryValue}>{formatCurrencyVND(totalAmount)}</Text>
                </View>
              </CardContent>
            </Card>
          </View>
        )}

        {/* NÚT HÀNH ĐỘNG */}
        <View style={styles.footerActions}>
          {isReadOnly ? (
            <Button
              variant="outline"
              size="lg"
              onPress={() => navigation.goBack()}
              icon={<Ionicons name="arrow-back-outline" size={20} color="#0F172A" />}
              style={styles.backBtn}
            >
              Quay lại danh sách
            </Button>
          ) : (
            <Button
              variant="default"
              size="lg"
              onPress={handleConfirmReview}
              loading={saving}
              icon={<Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />}
              style={styles.confirmBtn}
            >
              {`Xác nhận & Lưu vào ${groupMeta.shortName}`}
            </Button>
          )}
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* Modal Thêm / Sửa Dòng Hàng Hóa */}
      <Modal visible={itemModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingItemIndex !== null ? 'Sửa dòng chi phí' : 'Thêm dòng chi phí'}
              </Text>
              <TouchableOpacity onPress={() => setItemModalVisible(false)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Tên dịch vụ / Hàng hóa / Viện phí</Text>
            <TextInput
              style={styles.textInput}
              value={itemFormName}
              onChangeText={setItemFormName}
              placeholder="Ví dụ: Khám chuyên khoa Nội"
            />

            <View style={styles.rowInputs}>
              <View style={{ flex: 1, marginRight: 6 }}>
                <Text style={styles.fieldLabel}>Đơn vị tính</Text>
                <TextInput
                  style={styles.textInput}
                  value={itemFormUnit}
                  onChangeText={setItemFormUnit}
                  placeholder="Lần, Hộp..."
                />
              </View>
              <View style={{ flex: 1, marginLeft: 6 }}>
                <Text style={styles.fieldLabel}>Số lượng</Text>
                <TextInput
                  style={styles.textInput}
                  value={itemFormQty}
                  onChangeText={setItemFormQty}
                  keyboardType="numeric"
                  placeholder="1"
                />
              </View>
            </View>

            <Text style={styles.fieldLabel}>Đơn giá (VNĐ)</Text>
            <TextInput
              style={styles.textInput}
              value={itemFormPrice}
              onChangeText={setItemFormPrice}
              keyboardType="numeric"
              placeholder="0"
            />

            <View style={styles.modalBtnRow}>
              <Button
                variant="outline"
                size="default"
                onPress={() => setItemModalVisible(false)}
                style={{ flex: 1, marginRight: 8 }}
              >
                Hủy
              </Button>
              <Button
                variant="default"
                size="default"
                onPress={handleSaveItem}
                style={{ flex: 1, marginLeft: 8 }}
              >
                Lưu dòng
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL CHỌN LOẠI CHỨNG TỪ TỪ CẤU HÌNH ADMIN */}
      <Modal
        visible={showDocTypeModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDocTypeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Chọn loại chứng từ</Text>
                <Text style={styles.modalSubtitle}>Đồng bộ từ cấu hình hệ thống của quản trị viên</Text>
              </View>
              <TouchableOpacity onPress={() => setShowDocTypeModal(false)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              {documentTypes.map((t) => {
                const isSelected = currentDocTypeCode === t.code;
                const iconName = getDocumentTypeIcon(t.code, t.name);
                return (
                  <TouchableOpacity
                    key={t.code}
                    style={[styles.modalDocTypeItem, isSelected && styles.modalDocTypeItemSelected]}
                    onPress={() => {
                      setCurrentDocTypeCode(t.code);
                      setShowDocTypeModal(false);
                    }}
                    activeOpacity={0.75}
                  >
                    <View
                      style={[
                        styles.modalDocTypeIconCircle,
                        isSelected && { backgroundColor: theme.colors.primary },
                      ]}
                    >
                      <Ionicons
                        name={iconName as any}
                        size={18}
                        color={isSelected ? '#FFFFFF' : theme.colors.primary}
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text
                        style={[
                          styles.modalDocTypeName,
                          isSelected && styles.modalDocTypeNameSelected,
                        ]}
                      >
                        {t.name}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 6, flexWrap: 'wrap' }}>
                        <Text style={styles.modalDocTypeCode}>{t.code}</Text>
                        <Badge variant={t.isTaxEligible ? 'teal' : 'secondary'}>
                          {t.isTaxEligible ? 'Được giảm trừ' : 'Không giảm trừ'}
                        </Badge>
                      </View>
                    </View>
                    <Ionicons
                      name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={isSelected ? theme.colors.primary : '#CBD5E1'}
                    />
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
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F5EE',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  aiClassificationCard: {
    marginTop: 8,
    marginBottom: 12,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  aiClassificationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  aiClassificationIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiClassificationName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 4,
  },
  aiClassificationDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  tabsWrapper: {
    marginBottom: 12,
  },
  visualCard: {
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  imageWrapper: {
    position: 'relative',
    width: '100%',
    height: 240,
    backgroundColor: '#0F172A',
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentImage: {
    width: '100%',
    height: '100%',
  },
  highlightBoxOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  simulatedBox: {
    borderWidth: 2,
    borderColor: '#FACC15',
    backgroundColor: 'rgba(250, 204, 21, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  simulatedBoxText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  fieldTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
  },
  fieldTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  fieldTagSelected: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  fieldConfidenceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  fieldTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  noFieldNotice: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  scoreCard: {
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  scoreTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  meterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  meterTrack: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  meterFill: {
    height: '100%',
    borderRadius: 5,
  },
  meterValText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    width: 40,
    textAlign: 'right',
  },
  crucialSection: {
    marginTop: 14,
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
  },
  crucialHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  crucialGrid: {
    gap: 6,
  },
  crucialItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  crucialText: {
    fontSize: 12,
    color: '#475569',
  },
  errorMatrixCard: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
    marginBottom: 12,
  },
  errorMatrixHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorItemBox: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#FEE2E2',
  },
  errorItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
  },
  errorItemMsg: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
  errorItemHint: {
    fontSize: 11,
    color: '#8B1E1E',
    marginTop: 2,
    fontStyle: 'italic',
  },
  validMatrixCard: {
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
    marginBottom: 12,
  },
  validMatrixTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#16A34A',
  },
  validMatrixSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  formSectionCard: {
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginTop: 10,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: '#0F172A',
  },
  rowInputs: {
    flexDirection: 'row',
  },
  itemsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  itemOrderBadge: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemOrderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  itemNameText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  itemSubText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  itemTotalAmount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8B1E1E',
    marginTop: 2,
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  itemIconBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  totalSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  totalSummaryLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  totalSummaryValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#8B1E1E',
  },
  footerActions: {
    marginTop: 12,
  },
  confirmBtn: {
    width: '100%',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalBtnRow: {
    flexDirection: 'row',
    marginTop: 20,
  },
  verifiedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
    marginBottom: 12,
  },
  verifiedIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#15803D',
    letterSpacing: 0.3,
  },
  verifiedBadge: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  verifiedBannerDesc: {
    fontSize: 11,
    color: '#166534',
    marginTop: 3,
    lineHeight: 15,
  },
  readOnlyInput: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    color: '#334155',
  },
  backBtn: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderColor: '#CBD5E1',
  },
  changeDocTypeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#FFEBEE',
    gap: 4,
  },
  changeDocTypeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  docTypeSelectedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  docTypeSelectedIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFEBEE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docTypeSelectedName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  docTypeCodeMono: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#64748B',
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  modalDocTypeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  modalDocTypeItemSelected: {
    borderColor: '#8B1E1E',
    backgroundColor: '#FFF8F8',
  },
  modalDocTypeIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#FFEBEE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDocTypeName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  modalDocTypeNameSelected: {
    color: '#8B1E1E',
    fontWeight: '700',
  },
  modalDocTypeCode: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#64748B',
  },
});
