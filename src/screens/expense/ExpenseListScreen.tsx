import React, { useState, useCallback, useMemo } from 'react';
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
import { expenseApi, mapDocumentReviewToOcrResult } from '../../api/expenseApi';
import { formatCurrencyVND } from './expenseValidationUtils';
import { useAuthStore } from '../../stores/useAuthStore';
import { useExpenseStore } from '../../stores/useExpenseStore';
import {
  groupExpensesByAiClassification,
  calculateExpenseMetrics,
  ExpenseGroup,
  searchExpenses,
  filterExpensesByStatus,
  getStatusLabel,
  getStatusBadgeVariant,
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
} from '../../components/ui';

type StatusFilter = 'ALL' | 'CONFIRMED' | 'EXTRACTED' | 'UPLOADED' | 'FAILED';

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
    addOrUpdateDocument,
    fetchDocumentTypes,
  } = useExpenseStore();

  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [selectedGroupKey, setSelectedGroupKey] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAddYearModal, setShowAddYearModal] = useState<boolean>(false);
  const [newYearInput, setNewYearInput] = useState<string>('');

  useFocusEffect(
    useCallback(() => {
      const syncData = async () => {
        await loadFromStorage();
        const state = useExpenseStore.getState();
        const activeYear = state.selectedYear || (state.availableYears.length > 0 ? state.availableYears[0] : new Date().getFullYear());
        if (!state.selectedYear) setSelectedYear(activeYear);
        await fetchDocumentTypes();
        await initPeriodForYear(activeYear, user?.id);
      };
      syncData();
    }, [user?.id])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFromStorage();
    const state = useExpenseStore.getState();
    const activeYear = state.selectedYear || (state.availableYears.length > 0 ? state.availableYears[0] : new Date().getFullYear());
    await initPeriodForYear(activeYear, user?.id);
    setRefreshing(false);
  };

  const currentPeriod = selectedYear ? periods[selectedYear] : undefined;
  const allCurrentExpenses: ExpenseOcrResult[] = selectedYear ? documents[selectedYear] || [] : [];

  const metrics = calculateExpenseMetrics(allCurrentExpenses);
  const groupedExpenses = groupExpensesByAiClassification(allCurrentExpenses, false);

  // Lọc và tìm kiếm
  const displayExpenses = useMemo(() => {
    let result = allCurrentExpenses;
    if (selectedGroupKey !== 'ALL') {
      const group = groupedExpenses.find((g) => g.key === selectedGroupKey);
      result = group ? group.items : [];
    }
    result = filterExpensesByStatus(result, statusFilter);
    result = searchExpenses(result, searchQuery);
    return result;
  }, [allCurrentExpenses, selectedGroupKey, statusFilter, searchQuery, groupedExpenses]);

  // Group lại sau filter để hiển thị
  const displayGroups = useMemo(() => {
    return groupExpensesByAiClassification(displayExpenses, false);
  }, [displayExpenses]);

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

  const handleDeleteYear = (yr: number) => {
    if (Platform.OS === 'web') {
      const ok = window.confirm(`Xóa toàn bộ hóa đơn năm ${yr}? Hành động này không thể hoàn tác.`);
      if (ok) removeYear(yr);
    } else {
      Alert.alert(
        'Xóa kỳ tính thuế',
        `Xóa toàn bộ hóa đơn năm ${yr}? Hành động này không thể hoàn tác.`,
        [
          { text: 'Hủy', style: 'cancel' },
          { text: 'Xóa', style: 'destructive', onPress: () => removeYear(yr) },
        ]
      );
    }
  };

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

  const handleViewDetail = async (doc: ExpenseOcrResult) => {
    const docId = doc.documentId || doc.id;
    const periodId = currentPeriod?.periodId || doc.periodId;

    if (doc.status === 'UPLOADED') {
      Alert.alert(
        'Đang xử lý',
        'Hóa đơn này đang được hệ thống đọc và nhận diện thông tin. Bạn muốn làm gì?',
        [
          { text: 'Đóng', style: 'cancel' },
          {
            text: 'Kiểm tra lại',
            onPress: async () => {
              if (periodId && docId) {
                try {
                  const detail = await expenseApi.getDocumentById(periodId, docId);
                  if (detail.status === 'EXTRACTED') {
                    const mapped = mapDocumentReviewToOcrResult(detail, selectedYear || undefined);
                    addOrUpdateDocument(selectedYear || new Date().getFullYear(), mapped);
                    navigation.navigate('ExpenseReview', { ocrResult: mapped, periodId, isReadOnly: false });
                    return;
                  }
                  Alert.alert('Thông báo', `Chứng từ vẫn đang được xử lý. Vui lòng thử lại sau.`);
                } catch (e: any) {
                  Alert.alert('Lỗi', e?.message || 'Không thể kiểm tra trạng thái.');
                }
              }
            },
          },
          {
            text: 'Đọc lại ngay',
            onPress: async () => {
              if (periodId && docId) {
                try {
                  await expenseApi.triggerDocumentOcr(periodId, docId);
                  Alert.alert('Đã gửi yêu cầu', 'Hệ thống đang đọc lại thông tin hóa đơn. Kéo xuống để làm mới sau vài giây.');
                } catch (err: any) {
                  Alert.alert('Lỗi', err?.response?.data?.message || err?.message || 'Không thể thực hiện.');
                }
              }
            },
          },
        ]
      );
      return;
    }

    let fullDoc = doc;
    if (periodId && docId && (!doc.items || doc.items.length === 0)) {
      try {
        const detail = await expenseApi.getDocumentById(periodId, docId);
        fullDoc = mapDocumentReviewToOcrResult(detail, selectedYear || undefined);
        addOrUpdateDocument(selectedYear || new Date().getFullYear(), fullDoc);
      } catch (err) {
        console.warn('Không thể tải chi tiết, dùng bản cache:', err);
      }
    }

    navigation.navigate('ExpenseReview', {
      ocrResult: fullDoc,
      periodId,
      isReadOnly: fullDoc.status === 'CONFIRMED',
    });
  };

  const handleDeleteDoc = (docId?: string) => {
    if (!docId || !selectedYear) return;
    if (Platform.OS === 'web') {
      const ok = window.confirm('Xóa chứng từ này khỏi hồ sơ thuế?');
      if (ok) removeDocument(selectedYear, docId);
    } else {
      Alert.alert('Xóa chứng từ', 'Xóa chứng từ này khỏi hồ sơ thuế?', [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Xóa', style: 'destructive', onPress: () => removeDocument(selectedYear, docId) },
      ]);
    }
  };

  // ===================== RENDER =====================
  return (
    <SafeAreaView style={styles.safeArea}>
      <HeaderMotif title="HÓA ĐƠN CHI PHÍ" onBack={() => navigation.goBack()} />

      {/* CHƯA CÓ KỲ NĂM: Màn hình khởi tạo */}
      {availableYears.length === 0 || !selectedYear ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} />}
        >
          <View style={styles.emptyStateWrapper}>
            <View style={styles.emptyStateIconCircle}>
              <Ionicons name="folder-open-outline" size={56} color={theme.colors.primary} />
            </View>
            <Text style={styles.emptyStateTitle}>Chưa có hồ sơ quyết toán thuế</Text>
            <Text style={styles.emptyStateSubtitle}>
              Tạo kỳ kê khai thuế để bắt đầu lưu trữ và quản lý hóa đơn chi phí được giảm trừ thuế TNCN.
            </Text>
            <Button
              variant="default"
              size="default"
              onPress={() => setShowAddYearModal(true)}
              icon={<Ionicons name="add-circle-outline" size={18} color="#fff" />}
              style={styles.emptyStateCta}
            >
              Tạo kỳ kê khai năm {new Date().getFullYear()}
            </Button>
          </View>
        </ScrollView>
      ) : (
        <>
          {/* THANH CHỌN NĂM */}
          <View style={styles.yearBarContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.yearScroll}>
              {availableYears.map((yr) => {
                const isSelected = yr === selectedYear;
                const docCount = (documents[yr] || []).length;
                return (
                  <View key={yr} style={[styles.yearChip, isSelected && styles.yearChipActive]}>
                    <TouchableOpacity activeOpacity={0.75} onPress={() => setSelectedYear(yr)} style={styles.yearChipInner}>
                      <Text style={[styles.yearChipText, isSelected && styles.yearChipTextActive]}>
                        Năm {yr}
                      </Text>
                      {docCount > 0 && (
                        <View style={[styles.yearBadge, isSelected && styles.yearBadgeActive]}>
                          <Text style={[styles.yearBadgeText, isSelected && styles.yearBadgeTextActive]}>{docCount}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                    {isSelected && (
                      <TouchableOpacity
                        onPress={() => handleDeleteYear(yr)}
                        style={styles.yearDeleteBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="close" size={12} color="#fff" />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
              <TouchableOpacity activeOpacity={0.75} onPress={() => setShowAddYearModal(true)} style={styles.addYearBtn}>
                <Ionicons name="add" size={13} color={theme.colors.primary} />
                <Text style={styles.addYearBtnText}>Thêm năm</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} />}
          >
            {/* KPI TỔNG QUAN - Grid 4 ô nhỏ */}
            <View style={styles.kpiRow}>
              <View style={[styles.kpiBox, { borderLeftColor: '#8B1E1E' }]}>
                <Text style={styles.kpiBoxVal}>{formatCurrencyVND(metrics.totalConfirmedAmount)}</Text>
                <Text style={styles.kpiBoxLabel}>Chi phí đã xác nhận</Text>
              </View>
              <View style={styles.kpiSmallGrid}>
                <View style={[styles.kpiSmall, { backgroundColor: '#ECFDF5' }]}>
                  <Text style={[styles.kpiSmallVal, { color: '#16A34A' }]}>{metrics.confirmedDocs}</Text>
                  <Text style={styles.kpiSmallLabel}>Đã duyệt</Text>
                </View>
                <View style={[styles.kpiSmall, { backgroundColor: '#FEF3C7' }]}>
                  <Text style={[styles.kpiSmallVal, { color: '#D97706' }]}>{metrics.pendingDocs}</Text>
                  <Text style={styles.kpiSmallLabel}>Chờ soát</Text>
                </View>
                <View style={[styles.kpiSmall, { backgroundColor: '#F0F9FF' }]}>
                  <Text style={[styles.kpiSmallVal, { color: '#0284C7' }]}>{metrics.processingDocs}</Text>
                  <Text style={styles.kpiSmallLabel}>Đang xử lý</Text>
                </View>
                <View style={[styles.kpiSmall, { backgroundColor: '#FEF2F2' }]}>
                  <Text style={[styles.kpiSmallVal, { color: '#DC2626' }]}>{metrics.failedDocs}</Text>
                  <Text style={styles.kpiSmallLabel}>Cần xem lại</Text>
                </View>
              </View>
            </View>

            {/* NÚT TẢI LÊN */}
            <Button
              variant="default"
              size="default"
              onPress={handleNavigateUpload}
              style={styles.uploadBtn}
              icon={<Ionicons name="cloud-upload-outline" size={18} color="#fff" />}
            >
              {allCurrentExpenses.length > 0 ? 'Tải lên hóa đơn mới' : 'Tải lên hóa đơn đầu tiên'}
            </Button>

            {/* SEARCH & FILTER (chỉ khi có chứng từ) */}
            {allCurrentExpenses.length > 0 && (
              <>
                {/* Thanh tìm kiếm */}
                <View style={styles.searchBar}>
                  <Ionicons name="search-outline" size={16} color="#94A3B8" />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Tìm theo tên cơ sở, số hóa đơn..."
                    placeholderTextColor="#94A3B8"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    returnKeyType="search"
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                      <Ionicons name="close-circle" size={16} color="#94A3B8" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Pills lọc trạng thái */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statusPillsScroll}>
                  <View style={styles.statusPillsRow}>
                    {([
                      { key: 'ALL', label: 'Tất cả', count: allCurrentExpenses.length },
                      { key: 'EXTRACTED', label: 'Chờ soát xét', count: metrics.pendingDocs },
                      { key: 'CONFIRMED', label: 'Đã duyệt', count: metrics.confirmedDocs },
                      { key: 'UPLOADED', label: 'Đang xử lý', count: metrics.processingDocs },
                      { key: 'FAILED', label: 'Cần xem lại', count: metrics.failedDocs },
                    ] as { key: StatusFilter; label: string; count: number }[]).map((pill) => (
                      <TouchableOpacity
                        key={pill.key}
                        style={[styles.statusPill, statusFilter === pill.key && styles.statusPillActive]}
                        onPress={() => setStatusFilter(pill.key)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.statusPillText, statusFilter === pill.key && styles.statusPillTextActive]}>
                          {pill.label} {pill.count > 0 ? `(${pill.count})` : ''}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                {/* Chips nhóm danh mục (động theo DB) */}
                {groupedExpenses.length > 1 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.groupChipsScroll}>
                    <View style={styles.groupChipsRow}>
                      <TouchableOpacity
                        style={[styles.groupChip, selectedGroupKey === 'ALL' && styles.groupChipActive]}
                        onPress={() => setSelectedGroupKey('ALL')}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.groupChipText, selectedGroupKey === 'ALL' && styles.groupChipTextActive]}>
                          Tất cả danh mục
                        </Text>
                      </TouchableOpacity>
                      {groupedExpenses.map((g) => (
                        <TouchableOpacity
                          key={g.key}
                          style={[
                            styles.groupChip,
                            selectedGroupKey === g.key && { ...styles.groupChipActive, borderColor: g.color, backgroundColor: `${g.color}15` },
                          ]}
                          onPress={() => setSelectedGroupKey(g.key)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name={g.icon as any} size={12} color={selectedGroupKey === g.key ? g.color : '#475569'} />
                          <Text style={[
                            styles.groupChipText,
                            selectedGroupKey === g.key && { color: g.color, fontWeight: '700' },
                          ]}>
                            {g.shortName} ({g.items.length})
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                )}
              </>
            )}

            {/* DANH SÁCH CHỨNG TỪ */}
            <View style={styles.docListContainer}>
              {displayGroups.length === 0 ? (
                <View style={styles.noResultBox}>
                  <Ionicons name="document-text-outline" size={44} color="#CBD5E1" />
                  <Text style={styles.noResultTitle}>
                    {searchQuery || statusFilter !== 'ALL' ? 'Không tìm thấy kết quả phù hợp' : 'Chưa có hóa đơn chi phí'}
                  </Text>
                  <Text style={styles.noResultSub}>
                    {searchQuery || statusFilter !== 'ALL'
                      ? 'Thử điều chỉnh bộ lọc hoặc từ khóa tìm kiếm.'
                      : 'Tải lên hóa đơn để bắt đầu theo dõi chi phí giảm trừ thuế.'}
                  </Text>
                  {!(searchQuery || statusFilter !== 'ALL') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onPress={handleNavigateUpload}
                      style={{ marginTop: 12 }}
                      icon={<Ionicons name="add" size={14} color={theme.colors.primary} />}
                    >
                      Tải lên hóa đơn
                    </Button>
                  )}
                </View>
              ) : (
                displayGroups.map((group) => (
                  <View key={group.key} style={styles.groupSection}>
                    {/* HEADER NHÓM */}
                    <View style={styles.groupHeader}>
                      <View style={[styles.groupIconCircle, { backgroundColor: `${group.color}20` }]}>
                        <Ionicons name={group.icon as any} size={16} color={group.color} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={styles.groupName}>{group.shortName}</Text>
                        <Text style={styles.groupSubtitle}>{group.items.length} chứng từ</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.groupAmount}>{formatCurrencyVND(group.totalAmount)}</Text>
                        {group.confirmedCount > 0 && (
                          <Text style={styles.groupConfirmedHint}>{group.confirmedCount} đã duyệt</Text>
                        )}
                      </View>
                    </View>

                    {/* DANH SÁCH THẺ CHỨNG TỪ */}
                    {group.items.map((doc: ExpenseOcrResult, index: number) => {
                      const statusVariant = getStatusBadgeVariant(doc.status);
                      const statusText = getStatusLabel(doc.status);
                      const isConfirmed = doc.status === 'CONFIRMED';
                      return (
                        <Card key={doc.documentId || index} style={styles.docCard}>
                          <TouchableOpacity activeOpacity={0.7} onPress={() => handleViewDetail(doc)}>
                            <View style={styles.docCardBody}>
                              {/* Dòng 1: Trạng thái + Nhóm + Độ chính xác */}
                              <View style={styles.docCardTopRow}>
                                <Badge variant={statusVariant} style={styles.docStatusBadge}>{statusText}</Badge>
                                <View style={styles.docRightMeta}>
                                  {doc.isNotReimbursed && (
                                    <Ionicons name="shield-checkmark-outline" size={13} color="#0F766E" />
                                  )}
                                  {doc.overallConfidence ? (
                                    <Text style={styles.confidenceText}>
                                      {(doc.overallConfidence * 100).toFixed(0)}% chính xác
                                    </Text>
                                  ) : null}
                                </View>
                              </View>

                              {/* Dòng 2: Tên đơn vị - thông tin chính */}
                              <Text style={styles.docSellerName} numberOfLines={2}>
                                {doc.sellerName || 'Chưa có tên đơn vị phát hành'}
                              </Text>

                              {/* Dòng 3: Metadata */}
                              <View style={styles.docMetaRow}>
                                {doc.invoiceNumber ? (
                                  <View style={styles.docMetaItem}>
                                    <Ionicons name="receipt-outline" size={12} color="#94A3B8" />
                                    <Text style={styles.docMetaText}>HĐ {doc.invoiceNumber}</Text>
                                  </View>
                                ) : null}
                                {doc.invoiceDate ? (
                                  <View style={styles.docMetaItem}>
                                    <Ionicons name="calendar-outline" size={12} color="#94A3B8" />
                                    <Text style={styles.docMetaText}>{doc.invoiceDate}</Text>
                                  </View>
                                ) : null}
                                {doc.items && doc.items.length > 0 ? (
                                  <View style={styles.docMetaItem}>
                                    <Ionicons name="list-outline" size={12} color="#94A3B8" />
                                    <Text style={styles.docMetaText}>{doc.items.length} dòng</Text>
                                  </View>
                                ) : null}
                              </View>

                              {/* Dòng 4: Số tiền + Actions */}
                              <View style={styles.docCardFooterRow}>
                                <View>
                                  <Text style={styles.docAmountLabel}>
                                    {isConfirmed ? 'Đã xác nhận' : 'Số tiền'}
                                  </Text>
                                  <Text style={[styles.docAmount, isConfirmed && { color: '#16A34A' }]}>
                                    {formatCurrencyVND(doc.totalAmount || 0)}
                                  </Text>
                                </View>
                                <View style={styles.docActions}>
                                  <TouchableOpacity
                                    onPress={() => handleDeleteDoc(doc.documentId)}
                                    style={styles.docDeleteBtn}
                                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                  >
                                    <Ionicons name="trash-outline" size={15} color="#EF4444" />
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={styles.docDetailBtn}
                                    onPress={() => handleViewDetail(doc)}
                                  >
                                    <Text style={styles.docDetailBtnText}>
                                      {isConfirmed ? 'Xem' : 'Soát xét'}
                                    </Text>
                                    <Ionicons name="chevron-forward" size={13} color={theme.colors.primary} />
                                  </TouchableOpacity>
                                </View>
                              </View>
                            </View>
                          </TouchableOpacity>
                        </Card>
                      );
                    })}
                  </View>
                ))
              )}
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </>
      )}

      {/* MODAL THÊM KỲ THUẾ MỚI */}
      <Modal visible={showAddYearModal} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowAddYearModal(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
            <Text style={styles.modalTitle}>Tạo kỳ kê khai thuế mới</Text>
            <Text style={styles.modalDesc}>
              Nhập năm tính thuế để bắt đầu quản lý hóa đơn chi phí giảm trừ thuế TNCN.
            </Text>
            <TextInput
              placeholder={`Năm quyết toán (VD: ${new Date().getFullYear()})`}
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              maxLength={4}
              value={newYearInput}
              onChangeText={setNewYearInput}
              style={styles.modalInput}
              autoFocus
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => { setNewYearInput(''); setShowAddYearModal(false); }}
              >
                <Text style={styles.modalBtnCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnConfirm} onPress={handleAddNewYear}>
                <Text style={styles.modalBtnConfirmText}>Tạo kỳ</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F5EE',
  },
  // --- Year bar ---
  yearBarContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: '#F8F5EE',
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
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  yearChipActive: {
    backgroundColor: '#8B1E1E',
    borderColor: '#8B1E1E',
  },
  yearChipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  yearChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  yearChipTextActive: {
    color: '#FFFFFF',
  },
  yearBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  yearBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  yearBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#475569',
  },
  yearBadgeTextActive: {
    color: '#FFFFFF',
  },
  yearDeleteBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  addYearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    gap: 2,
  },
  addYearBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8B1E1E',
  },
  // --- Content scroll ---
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
    paddingTop: 8,
  },
  // --- KPI ---
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
    alignItems: 'stretch',
  },
  kpiBox: {
    flex: 1.2,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#8B1E1E',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  kpiBoxVal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#8B1E1E',
    flexShrink: 1,
  },
  kpiBoxLabel: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 3,
    fontWeight: '500',
  },
  kpiSmallGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  kpiSmall: {
    flex: 1,
    minWidth: '45%',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
  },
  kpiSmallVal: {
    fontSize: 16,
    fontWeight: '800',
  },
  kpiSmallLabel: {
    fontSize: 9,
    color: '#64748B',
    marginTop: 1,
    textAlign: 'center',
    fontWeight: '500',
  },
  // --- Upload button ---
  uploadBtn: {
    width: '100%',
    marginBottom: 12,
  },
  // --- Search ---
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    padding: 0,
  },
  // --- Status pills ---
  statusPillsScroll: {
    marginBottom: 8,
  },
  statusPillsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusPillActive: {
    backgroundColor: '#8B1E1E',
    borderColor: '#8B1E1E',
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  statusPillTextActive: {
    color: '#FFFFFF',
  },
  // --- Group chips ---
  groupChipsScroll: {
    marginBottom: 10,
  },
  groupChipsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  groupChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  groupChipActive: {
    borderColor: '#8B1E1E',
    backgroundColor: '#FFF8F8',
  },
  groupChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  groupChipTextActive: {
    color: '#8B1E1E',
    fontWeight: '700',
  },
  // --- Doc list ---
  docListContainer: {
    marginTop: 2,
  },
  groupSection: {
    marginBottom: 16,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 6,
  },
  groupIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  groupSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  groupAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  groupConfirmedHint: {
    fontSize: 10,
    color: '#16A34A',
    marginTop: 1,
  },
  // --- Document Card ---
  docCard: {
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  docCardBody: {
    padding: 14,
  },
  docCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  docStatusBadge: {
    flexShrink: 0,
  },
  docRightMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  confidenceText: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '500',
  },
  docSellerName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 20,
    marginBottom: 6,
  },
  docMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  docMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  docMetaText: {
    fontSize: 11,
    color: '#64748B',
  },
  docCardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  docAmountLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '500',
  },
  docAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 1,
  },
  docActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  docDeleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docDetailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#8B1E1E',
    gap: 3,
  },
  docDetailBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // --- Empty state ---
  emptyStateWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 80,
  },
  emptyStateIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FFEBEE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 24,
  },
  emptyStateCta: {
    width: '100%',
  },
  noResultBox: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  noResultTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#475569',
    textAlign: 'center',
  },
  noResultSub: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 17,
  },
  // --- Modal ---
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  modalDesc: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0F172A',
    marginBottom: 16,
    fontWeight: '600',
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalBtnCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  modalBtnCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  modalBtnConfirm: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#8B1E1E',
    alignItems: 'center',
  },
  modalBtnConfirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
