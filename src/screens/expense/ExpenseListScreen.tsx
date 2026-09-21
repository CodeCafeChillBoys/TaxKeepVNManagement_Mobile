import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { HeaderMotif } from '../../components/common/HeaderMotif';
import { RootNavigationProp } from '../../navigation/types';
import { ExpenseOcrResult } from '../../types/expense';
import { formatCurrencyVND } from './expenseValidationUtils';
import { useAuthStore } from '../../stores/useAuthStore';
import { useExpenseStore } from '../../stores/useExpenseStore';
import {
  groupExpensesByAiClassification,
  calculateExpenseMetrics,
  ExpenseGroup,
} from './expenseGroupUtils';
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
} from '../../components/ui';

export const ExpenseListScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const { user } = useAuthStore();

  const {
    selectedYear,
    availableYears,
    documents,
    periods,
    setSelectedYear,
    addYear,
    removeYear,
    initPeriodForYear,
    removeDocument,
    loadFromStorage,
  } = useExpenseStore();

  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [selectedGroupTab, setSelectedGroupTab] = useState<string>('ALL');
  const [showAddYearModal, setShowAddYearModal] = useState<boolean>(false);
  const [newYearInput, setNewYearInput] = useState<string>('');

  // Tải dữ liệu lưu trữ khi mở màn hình
  useFocusEffect(
    useCallback(() => {
      loadFromStorage();
      if (selectedYear) {
        initPeriodForYear(selectedYear, user?.id);
      }
    }, [selectedYear, user?.id])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFromStorage();
    if (selectedYear) {
      await initPeriodForYear(selectedYear, user?.id);
    }
    setRefreshing(false);
  };

  const currentPeriod = selectedYear ? periods[selectedYear] : undefined;
  const allCurrentExpenses: ExpenseOcrResult[] = selectedYear ? documents[selectedYear] || [] : [];

  // Thống kê tổng thể
  const metrics = calculateExpenseMetrics(allCurrentExpenses);

  // Gom nhóm theo Tổ do AI phân loại
  const groupedExpenses = groupExpensesByAiClassification(allCurrentExpenses, false);

  // Lọc theo Tab Tổ
  const displayGroups =
    selectedGroupTab === 'ALL'
      ? groupedExpenses
      : groupedExpenses.filter((g) => g.key === selectedGroupTab);

  // Xử lý tạo năm mới
  const handleAddNewYear = async () => {
    const yr = parseInt(newYearInput.trim(), 10);
    const currentYear = new Date().getFullYear();
    if (isNaN(yr) || yr < 2015 || yr > currentYear + 1) {
      if (Platform.OS === 'web') {
        window.alert(`Năm không hợp lệ: Vui lòng nhập năm từ 2015 đến ${currentYear + 1}.`);
      } else {
        Alert.alert('Năm không hợp lệ', `Vui lòng nhập năm từ 2015 đến ${currentYear + 1}.`);
      }
      return;
    }

    addYear(yr);
    await initPeriodForYear(yr, user?.id);
    setNewYearInput('');
    setShowAddYearModal(false);
  };

  // Xóa kỳ thuế khỏi danh sách
  const handleDeleteYear = (yr: number) => {
    if (Platform.OS === 'web') {
      const ok = window.confirm(
        `Bạn có chắc chắn muốn xóa kỳ quyết toán năm ${yr}? Toàn bộ hóa đơn thuộc năm này sẽ bị gỡ bỏ.`
      );
      if (ok) {
        removeYear(yr);
      }
    } else {
      Alert.alert(
        'Xóa kỳ tính thuế',
        `Bạn có chắc chắn muốn xóa kỳ quyết toán năm ${yr}? Toàn bộ hóa đơn thuộc năm này sẽ bị gỡ bỏ.`,
        [
          { text: 'Hủy', style: 'cancel' },
          {
            text: 'Xóa kỳ năm',
            style: 'destructive',
            onPress: () => removeYear(yr),
          },
        ]
      );
    }
  };

  // Điều hướng tải lên hóa đơn mới
  const handleNavigateUpload = () => {
    if (!selectedYear) {
      setShowAddYearModal(true);
      return;
    }
    navigation.navigate('ExpenseUpload', {
      targetYear: selectedYear,
      periodId: currentPeriod?.periodId,
    });
  };

  // Xem chi tiết / Soát xét chứng từ
  const handleViewDetail = (doc: ExpenseOcrResult) => {
    navigation.navigate('ExpenseReview', {
      ocrResult: doc,
      periodId: currentPeriod?.periodId,
      isReadOnly: true, // Action xem chi tiết chỉ cho phép xem thông tin, không cho chỉnh sửa
    });
  };

  // Xóa chứng từ
  const handleDeleteDoc = (docId?: string) => {
    if (!docId || !selectedYear) return;
    if (Platform.OS === 'web') {
      const ok = window.confirm('Bạn có chắc chắn muốn xóa chứng từ chi phí này khỏi kỳ thuế?');
      if (ok) {
        removeDocument(selectedYear, docId);
      }
    } else {
      Alert.alert('Xác nhận xóa', 'Bạn có chắc chắn muốn xóa chứng từ chi phí này khỏi kỳ thuế?', [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: () => removeDocument(selectedYear, docId),
        },
      ]);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <HeaderMotif
        title="HÓA ĐƠN CHI PHÍ"
        onBack={() => navigation.goBack()}
      />

      {/* NẾU CHƯA CÓ KỲ NĂM NÀO HOẶC CHƯA CHỌN NĂM -> BƯỚC 1: KHỞI TẠO KỲ TÍNH THUẾ */}
      {availableYears.length === 0 || !selectedYear ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[theme.colors.primary]}
            />
          }
        >
          <Card style={styles.initialCard}>
            <CardContent style={styles.initialCardContent}>
              <View style={styles.initialIconCircle}>
                <Ionicons name="calendar-outline" size={44} color="#8B1E1E" />
              </View>

              <Badge variant="secondary" style={styles.stepBadge}>
                BƯỚC 1: KHỞI TẠO KỲ QUYẾT TOÁN
              </Badge>

              <Text style={styles.initialTitle}>Chưa có kỳ quyết toán thuế</Text>
              <Text style={styles.initialDesc}>
                Hệ thống chưa có kỳ tính thuế nào. Vui lòng tạo kỳ quyết toán (ví dụ: năm 2026, 2025...) để bắt đầu quản lý và đối soát hóa đơn chi phí hợp lệ được trừ thuế TNCN.
              </Text>

              {/* LỘ TRÌNH QUY TRÌNH 5 BƯỚC */}
              <View style={styles.roadmapBox}>
                <Text style={styles.roadmapTitle}>Quy trình chuẩn xử lý chứng từ thuế:</Text>

                <View style={styles.roadmapItem}>
                  <View style={[styles.roadmapNumCircle, styles.roadmapNumActive]}>
                    <Text style={styles.roadmapNumTextActive}>1</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.roadmapStepTitle}>Tạo kỳ tính thuế mới</Text>
                    <Text style={styles.roadmapStepDesc}>Khởi tạo năm kê khai quyết toán thuế TNCN</Text>
                  </View>
                </View>

                <View style={styles.roadmapItem}>
                  <View style={styles.roadmapNumCircle}>
                    <Text style={styles.roadmapNumText}>2</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.roadmapStepTitle}>Tải lên hóa đơn chi phí</Text>
                    <Text style={styles.roadmapStepDesc}>Chụp ảnh hoặc tải lên hóa đơn điện tử / PDF</Text>
                  </View>
                </View>

                <View style={styles.roadmapItem}>
                  <View style={styles.roadmapNumCircle}>
                    <Text style={styles.roadmapNumText}>3</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.roadmapStepTitle}>Hệ thống tự động nhận diện & phân loại</Text>
                    <Text style={styles.roadmapStepDesc}>Tự động nhận diện viện phí, học phí, từ thiện, bảo hiểm...</Text>
                  </View>
                </View>

                <View style={styles.roadmapItem}>
                  <View style={styles.roadmapNumCircle}>
                    <Text style={styles.roadmapNumText}>4</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.roadmapStepTitle}>Kiểm tra & Xác nhận thông tin</Text>
                    <Text style={styles.roadmapStepDesc}>Kiểm tra thông tin trước khi lưu chính thức</Text>
                  </View>
                </View>

                <View style={styles.roadmapItem}>
                  <View style={styles.roadmapNumCircle}>
                    <Text style={styles.roadmapNumText}>5</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.roadmapStepTitle}>Tổng hợp & Báo cáo chi phí được trừ</Text>
                    <Text style={styles.roadmapStepDesc}>Tự động tính mức khấu trừ hợp lệ vào hồ sơ quyết toán</Text>
                  </View>
                </View>
              </View>

              <Button
                variant="default"
                size="lg"
                onPress={() => setShowAddYearModal(true)}
                style={styles.initialActionBtn}
                icon={<Ionicons name="add-circle" size={20} color="#FFFFFF" />}
              >
                + Khởi tạo kỳ tính thuế ngay
              </Button>
            </CardContent>
          </Card>
        </ScrollView>
      ) : (
        <>
          {/* THANH CHỌN KỲ TÍNH THUẾ THEO NĂM (CHỈ HIỂN THỊ NĂM ĐÃ TẠO) */}
          <View style={styles.yearBarContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.yearScroll}>
              {availableYears.map((yr) => {
                const isSelected = yr === selectedYear;
                const hasDocs = (documents[yr] || []).length;
                return (
                  <View key={yr} style={[styles.yearChip, isSelected && styles.yearChipActive]}>
                    <TouchableOpacity
                      activeOpacity={0.75}
                      onPress={() => setSelectedYear(yr)}
                      style={styles.yearChipInner}
                    >
                      <Text style={[styles.yearChipText, isSelected && styles.yearChipTextActive]}>
                        Kỳ năm {yr}
                      </Text>
                      {hasDocs > 0 && (
                        <View style={[styles.yearChipBadge, isSelected && styles.yearChipBadgeActive]}>
                          <Text style={[styles.yearChipBadgeText, isSelected && styles.yearChipBadgeTextActive]}>
                            {hasDocs}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                    {isSelected && (
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => handleDeleteYear(yr)}
                        style={styles.yearChipDeleteBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="close" size={13} color="#FFFFFF" />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}

              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => setShowAddYearModal(true)}
                style={styles.addYearBtn}
              >
                <Ionicons name="add" size={14} color={theme.colors.primary} />
                <Text style={styles.addYearBtnText}>Năm mới</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[theme.colors.primary]}
              />
            }
          >
            {/* THẺ TỔNG QUAN HÓA ĐƠN CHI PHÍ & KPI (Shadcn Card) */}
            <Card style={styles.summaryCard}>
              <CardHeader style={styles.summaryCardHeader}>
                <View style={styles.periodHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.periodKpiLabel}>TỔNG CHI PHÍ ĐƯỢC TRỪ THUẾ</Text>
                    <Text style={styles.periodKpiYear}>KỲ QUYẾT TOÁN NĂM {selectedYear}</Text>
                  </View>
                  <Badge
                    variant={currentPeriod?.status === 'SUBMITTED' ? 'success' : 'secondary'}
                    style={styles.periodBadge}
                  >
                    {currentPeriod?.status === 'SUBMITTED' ? 'ĐÃ NỘP HỒ SƠ' : 'ĐANG LẬP HỒ SƠ'}
                  </Badge>
                </View>
              </CardHeader>

              <CardContent style={styles.summaryCardContent}>
                <View style={styles.kpiHeroBox}>
                  <Text style={styles.kpiHeroLabel}>Tổng chi phí giảm trừ đã xác nhận</Text>
                  <Text style={styles.kpiHeroAmount}>
                    {formatCurrencyVND(metrics.totalConfirmedAmount)}
                  </Text>
                  <Text style={styles.kpiHeroSub}>
                    Đối chiếu theo danh mục chi phí hợp lý của Luật Thuế TNCN
                  </Text>
                </View>

                <View style={styles.kpiGrid}>
                  <View style={styles.kpiGridItem}>
                    <View style={styles.kpiIconWrapTeal}>
                      <Ionicons name="checkmark-done" size={18} color="#0F766E" />
                    </View>
                    <View style={{ marginLeft: 8 }}>
                      <Text style={styles.kpiGridVal}>{metrics.confirmedDocs}</Text>
                      <Text style={styles.kpiGridLbl}>Đã duyệt</Text>
                    </View>
                  </View>

                  <View style={styles.kpiGridDivider} />

                  <View style={styles.kpiGridItem}>
                    <View style={styles.kpiIconWrapAmber}>
                      <Ionicons name="hourglass-outline" size={18} color="#D97706" />
                    </View>
                    <View style={{ marginLeft: 8 }}>
                      <Text style={styles.kpiGridVal}>{metrics.pendingDocs}</Text>
                      <Text style={styles.kpiGridLbl}>Chờ soát xét</Text>
                    </View>
                  </View>

                  <View style={styles.kpiGridDivider} />

                  <View style={styles.kpiGridItem}>
                    <View style={styles.kpiIconWrapIndigo}>
                      <Ionicons name="folder-outline" size={18} color="#4338CA" />
                    </View>
                    <View style={{ marginLeft: 8 }}>
                      <Text style={styles.kpiGridVal}>{groupedExpenses.length}</Text>
                      <Text style={styles.kpiGridLbl}>Nhóm chi phí</Text>
                    </View>
                  </View>
                </View>
              </CardContent>

              {/* DUY NHẤT 1 BUTTON TẢI LÊN / THÊM HÓA ĐƠN Ở THẺ TỔNG QUAN */}
              <CardFooter style={styles.summaryCardFooter}>
                <Button
                  variant="default"
                  size="default"
                  onPress={handleNavigateUpload}
                  style={{ flex: 1 }}
                  icon={<Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" />}
                >
                  {allCurrentExpenses.length > 0 ? 'Tải lên thêm hóa đơn chi phí' : 'Tải lên hóa đơn chi phí'}
                </Button>
              </CardFooter>
            </Card>

            {/* THANH TAB LỌC THEO NHÓM CHI PHÍ (Chỉ hiển thị khi có chứng từ) */}
            {allCurrentExpenses.length > 0 && (
              <View style={styles.groupTabsSection}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <Tabs value={selectedGroupTab} onValueChange={setSelectedGroupTab}>
                    <TabsList style={styles.tabsListCustom}>
                      <TabsTrigger value="ALL" style={styles.tabTriggerItem}>
                        Tất cả các nhóm ({allCurrentExpenses.length})
                      </TabsTrigger>
                      <TabsTrigger value="TO_VIEN_PHI" style={styles.tabTriggerItem}>
                        🩺 Viện phí
                      </TabsTrigger>
                      <TabsTrigger value="TO_GIAO_DUC" style={styles.tabTriggerItem}>
                        🎓 Học phí
                      </TabsTrigger>
                      <TabsTrigger value="TO_TU_THIEN" style={styles.tabTriggerItem}>
                        💖 Từ thiện
                      </TabsTrigger>
                      <TabsTrigger value="TO_BAO_HIEM" style={styles.tabTriggerItem}>
                        🛡️ Bảo hiểm
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </ScrollView>
              </View>
            )}

            {/* DANH SÁCH CÁC HÓA ĐƠN CHI PHÍ (GOM NHÓM THEO PHÂN LOẠI) */}
            <View style={styles.groupListContainer}>
              {displayGroups.length === 0 ? (
                <Card style={styles.emptyCard}>
                  <CardContent style={styles.emptyCardContent}>
                    <View style={styles.emptyIconCircle}>
                      <Ionicons name="document-text-outline" size={48} color={theme.colors.primary} />
                    </View>

                    <Text style={styles.emptyTitle}>
                      Chưa có hóa đơn chi phí trong kỳ năm {selectedYear}
                    </Text>
                    <Text style={styles.emptySubtitle}>
                      Hãy tải lên hóa đơn để hệ thống tự động ghi nhận và phân loại vào các nhóm chi phí giảm trừ thuế.
                    </Text>

                    <Button
                      variant="default"
                      size="lg"
                      onPress={handleNavigateUpload}
                      style={styles.emptyActionBtn}
                      icon={<Ionicons name="cloud-upload" size={18} color="#FFFFFF" />}
                    >
                      Tải lên hóa đơn ngay
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                displayGroups.map((group: ExpenseGroup) => (
                  <View key={group.key} style={styles.groupSection}>
                    {/* HEADER NHÓM CHỨNG TỪ */}
                    <View style={styles.groupHeaderRow}>
                      <View style={styles.groupTitleLeft}>
                        <View
                          style={[
                            styles.groupIconCircle,
                            { backgroundColor: `${group.color}15` },
                          ]}
                        >
                          <Ionicons name={group.icon as any} size={20} color={group.color} />
                        </View>
                        <View style={{ marginLeft: 10, flex: 1 }}>
                          <Text style={styles.groupNameText}>{group.name}</Text>
                          <Text style={styles.groupDescText}>{group.description}</Text>
                        </View>
                      </View>

                      <View style={styles.groupTitleRight}>
                        <Badge variant={group.badgeVariant} style={{ alignSelf: 'flex-end' }}>
                          {group.items.length} HĐ
                        </Badge>
                        <Text style={styles.groupSubtotalText}>
                          {formatCurrencyVND(group.totalAmount)}
                        </Text>
                      </View>
                    </View>

                    {/* DANH SÁCH THẺ HÓA ĐƠN TRONG NHÓM */}
                    {group.items.map((doc: ExpenseOcrResult, index: number) => {
                      const isConfirmed = doc.status === 'CONFIRMED';
                      return (
                        <Card key={doc.documentId || index} style={styles.docItemCard}>
                          <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => handleViewDetail(doc)}
                          >
                            <CardHeader style={styles.docCardHeader}>
                              <View style={styles.docCardTopRow}>
                                <View style={styles.aiClassBadgeWrap}>
                                  <Badge variant={group.badgeVariant}>
                                    {group.shortName}
                                  </Badge>
                                  {doc.overallConfidence ? (
                                    <Text style={styles.confidenceMiniText}>
                                      • Độ chuẩn xác {(doc.overallConfidence * 100).toFixed(0)}%
                                    </Text>
                                  ) : null}
                                </View>

                                <Badge
                                  variant={isConfirmed ? 'success' : 'warning'}
                                  style={{ alignSelf: 'flex-start' }}
                                >
                                  {isConfirmed ? '✓ ĐÃ DUYỆT' : '⏳ CHỜ DUYỆT'}
                                </Badge>
                              </View>

                              <Text style={styles.docSellerName} numberOfLines={2}>
                                {doc.sellerName || 'Đơn vị phát hành chưa rõ'}
                              </Text>
                            </CardHeader>

                            <CardContent style={styles.docCardContent}>
                              <View style={styles.docMetaRow}>
                                <View style={styles.docMetaItem}>
                                  <Ionicons name="receipt-outline" size={14} color="#64748B" />
                                  <Text style={styles.docMetaText}>
                                    Số HĐ: {doc.invoiceNumber || '---'}
                                  </Text>
                                </View>
                                <View style={styles.docMetaItem}>
                                  <Ionicons name="calendar-outline" size={14} color="#64748B" />
                                  <Text style={styles.docMetaText}>
                                    Ngày: {doc.invoiceDate || '---'}
                                  </Text>
                                </View>
                              </View>

                              {doc.items && doc.items.length > 0 && (
                                <View style={styles.docLinesBrief}>
                                  <Ionicons name="list-outline" size={14} color="#64748B" />
                                  <Text style={styles.docLinesText} numberOfLines={1}>
                                    {doc.items.length} dòng kê: {doc.items[0].itemName}
                                    {doc.items.length > 1 ? ` (+${doc.items.length - 1} mục)` : ''}
                                  </Text>
                                </View>
                              )}
                            </CardContent>

                            <CardFooter style={styles.docCardFooter}>
                              <View>
                                <Text style={styles.docAmountLabel}>
                                  {isConfirmed ? 'Số tiền đã duyệt' : 'Số tiền hóa đơn'}
                                </Text>
                                <Text style={styles.docAmountVal}>
                                  {formatCurrencyVND(doc.totalAmount || 0)}
                                </Text>
                              </View>

                              <View style={styles.docActionRow}>
                                <TouchableOpacity
                                  activeOpacity={0.7}
                                  onPress={() => handleDeleteDoc(doc.documentId)}
                                  style={styles.docDeleteBtn}
                                >
                                  <Ionicons name="trash-outline" size={16} color="#DC2626" />
                                </TouchableOpacity>

                                <Button
                                  variant="outline"
                                  size="sm"
                                  onPress={() => handleViewDetail(doc)}
                                  icon={<Ionicons name="eye-outline" size={14} color="#0F172A" />}
                                >
                                  Chi tiết
                                </Button>
                              </View>
                            </CardFooter>
                          </TouchableOpacity>
                        </Card>
                      );
                    })}
                  </View>
                ))
              )}
            </View>

            <View style={{ height: 30 }} />
          </ScrollView>
        </>
      )}

      {/* MODAL THÊM KỲ THUẾ MỚI */}
      <Modal visible={showAddYearModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            <CardHeader>
              <CardTitle>Khởi tạo Kỳ Quyết toán Thuế</CardTitle>
              <CardDescription>
                Nhập năm tính thuế bạn muốn kê khai và quản lý hóa đơn (Ví dụ: 2026):
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TextInput
                placeholder="Nhập 4 chữ số năm (VD: 2026)"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                maxLength={4}
                value={newYearInput}
                onChangeText={setNewYearInput}
                style={styles.modalInput}
              />
            </CardContent>
            <CardFooter style={{ justifyContent: 'flex-end', gap: 10 }}>
              <Button
                variant="ghost"
                size="sm"
                onPress={() => {
                  setNewYearInput('');
                  setShowAddYearModal(false);
                }}
              >
                Hủy
              </Button>
              <Button variant="default" size="sm" onPress={handleAddNewYear}>
                Khởi tạo kỳ năm
              </Button>
            </CardFooter>
          </Card>
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
  yearBarContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  yearScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  yearChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  yearChipActive: {
    backgroundColor: '#8B1E1E',
    borderColor: '#8B1E1E',
  },
  yearChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  yearChipTextActive: {
    color: '#FFFFFF',
  },
  yearChipBadge: {
    marginLeft: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  yearChipBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  yearChipBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  yearChipBadgeTextActive: {
    color: '#FFFFFF',
  },
  addYearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    gap: 2,
  },
  addYearBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
    paddingTop: 6,
  },
  summaryCard: {
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  summaryCardHeader: {
    backgroundColor: '#FAFAF9',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 10,
  },
  periodHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  periodKpiLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  periodKpiYear: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  periodBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  summaryCardContent: {
    paddingVertical: 12,
  },
  kpiHeroBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  kpiHeroLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  kpiHeroAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: '#8B1E1E',
    marginTop: 3,
  },
  kpiHeroSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 3,
    textAlign: 'center',
  },
  kpiGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingHorizontal: 4,
  },
  kpiGridItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  kpiGridDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 4,
  },
  kpiIconWrapTeal: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiIconWrapAmber: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiIconWrapIndigo: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#E0E7FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiGridVal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  kpiGridLbl: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  summaryCardFooter: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
  },
  groupTabsSection: {
    marginBottom: 12,
  },
  tabsListCustom: {
    backgroundColor: '#E2E8F0',
    padding: 3,
  },
  tabTriggerItem: {
    paddingHorizontal: 12,
  },
  groupListContainer: {
    marginTop: 2,
  },
  groupSection: {
    marginBottom: 16,
  },
  groupHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  groupTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  groupIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  groupDescText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  groupTitleRight: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  groupSubtotalText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  docItemCard: {
    marginVertical: 4,
    borderColor: '#E2E8F0',
  },
  docCardHeader: {
    paddingBottom: 4,
  },
  docCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  aiClassBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  confidenceMiniText: {
    fontSize: 11,
    color: '#64748B',
    marginLeft: 6,
  },
  docSellerName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  docCardContent: {
    paddingVertical: 4,
  },
  docMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  docMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  docMetaText: {
    fontSize: 12,
    color: '#64748B',
  },
  docLinesBrief: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  docLinesText: {
    fontSize: 11,
    color: '#475569',
    flex: 1,
  },
  docCardFooter: {
    paddingVertical: 8,
  },
  docAmountLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  docAmountVal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#8B1E1E',
  },
  docActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  docDeleteBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
  },
  emptyCard: {
    marginTop: 8,
    borderColor: '#E2E8F0',
  },
  emptyCardContent: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  emptyIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#FFEBEE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  emptyActionBtn: {
    marginTop: 18,
    width: '100%',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#0F172A',
    fontWeight: '600',
  },
  yearChipInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  yearChipDeleteBtn: {
    marginLeft: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialCard: {
    borderColor: '#E2E8F0',
    marginTop: 6,
    backgroundColor: '#FFFFFF',
  },
  initialCardContent: {
    alignItems: 'center',
    paddingVertical: 26,
    paddingHorizontal: 16,
  },
  initialIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  stepBadge: {
    marginBottom: 10,
  },
  initialTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 6,
  },
  initialDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  roadmapBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 22,
  },
  roadmapTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 12,
  },
  roadmapItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  roadmapNumCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roadmapNumActive: {
    backgroundColor: '#8B1E1E',
  },
  roadmapNumText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  roadmapNumTextActive: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  roadmapStepTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  roadmapStepDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  initialActionBtn: {
    width: '100%',
  },
});
