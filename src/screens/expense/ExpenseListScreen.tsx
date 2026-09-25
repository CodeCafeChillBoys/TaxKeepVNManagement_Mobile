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
  filterExpensesByMonth,
  filterExpensesByCategory,
  getExpenseMonth,
  getDocumentTypeIcon,
  getStatusLabel,
  getStatusBadgeVariant,
} from './expenseGroupUtils';
import {
  Card,
  Badge,
  Button,
  useToast,
} from '../../components/ui';

type StatusFilter = 'ALL' | 'CONFIRMED' | 'EXTRACTED' | 'UPLOADED' | 'FAILED';

export const ExpenseListScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const { user } = useAuthStore();
  const { toast } = useToast();

  const {
    selectedYear,
    availableYears,
    documents,
    periods,
    documentTypes,
    isDocumentTypesLoading,
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
  const [selectedMonth, setSelectedMonth] = useState<number | 'ALL'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Modals
  const [showMonthDropdown, setShowMonthDropdown] = useState<boolean>(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState<boolean>(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState<string>('');
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
    await Promise.all([
      fetchDocumentTypes(),
      initPeriodForYear(activeYear, user?.id),
    ]);
    setRefreshing(false);
  };

  const currentPeriod = selectedYear ? periods[selectedYear] : undefined;
  const allCurrentExpenses: ExpenseOcrResult[] = selectedYear ? documents[selectedYear] || [] : [];

  const metrics = calculateExpenseMetrics(allCurrentExpenses);

  // Danh mục được lấy động từ cấu hình Admin (DB) qua documentTypes
  const categoryOptions = useMemo(() => {
    // Đếm số lượng hóa đơn theo docTypeCode trong năm hiện tại
    const counts: Record<string, number> = {};
    allCurrentExpenses.forEach((doc) => {
      const code = (doc.docTypeCode || 'OTHER').toUpperCase();
      counts[code] = (counts[code] || 0) + 1;
    });

    const options = (documentTypes || []).map((t) => ({
      code: t.code,
      name: t.name,
      description: t.description || '',
      icon: getDocumentTypeIcon(t.code, t.name),
      isTaxEligible: t.isTaxEligible,
      categoryGroup: t.categoryGroup,
      count: counts[t.code.toUpperCase()] || 0,
    }));

    // Kiểm tra xem có chứng từ nào chưa nằm trong danh mục admin đã cấu hình
    const registeredCodes = new Set(options.map((o) => o.code.toUpperCase()));
    const unclassifiedCount = allCurrentExpenses.filter(
      (d) => !d.docTypeCode || !registeredCodes.has(d.docTypeCode.toUpperCase())
    ).length;

    if (unclassifiedCount > 0) {
      options.push({
        code: 'OTHER',
        name: 'Khác / Chưa phân loại',
        description: 'Hóa đơn chưa khớp danh mục chuẩn',
        icon: 'folder-outline',
        isTaxEligible: false,
        categoryGroup: undefined,
        count: unclassifiedCount,
      });
    }

    return options;
  }, [documentTypes, allCurrentExpenses]);

  // Lọc danh mục trong modal chọn theo tìm kiếm
  const filteredCategoryOptions = useMemo(() => {
    if (!categorySearchQuery.trim()) return categoryOptions;
    const q = categorySearchQuery.trim().toLowerCase();
    return categoryOptions.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    );
  }, [categoryOptions, categorySearchQuery]);

  // Thống kê số lượng hóa đơn theo từng tháng
  const monthCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    allCurrentExpenses.forEach((doc) => {
      const m = getExpenseMonth(doc);
      if (m !== null) {
        counts[m] = (counts[m] || 0) + 1;
      }
    });
    return counts;
  }, [allCurrentExpenses]);

  const monthOptions = useMemo(() => {
    const list = [];
    for (let m = 1; m <= 12; m++) {
      list.push({
        value: m,
        label: `Tháng ${m < 10 ? '0' + m : m}`,
        count: monthCounts[m] || 0,
      });
    }
    return list;
  }, [monthCounts]);

  // Tên hiển thị của bộ lọc đang chọn
  const selectedMonthLabel = useMemo(() => {
    if (selectedMonth === 'ALL') return 'Tất cả các tháng';
    return `Tháng ${selectedMonth < 10 ? '0' + selectedMonth : selectedMonth}`;
  }, [selectedMonth]);

  const selectedCategoryLabel = useMemo(() => {
    if (selectedCategory === 'ALL') return 'Tất cả danh mục';
    const found = categoryOptions.find((c) => c.code.toUpperCase() === selectedCategory.toUpperCase());
    return found ? found.name : selectedCategory;
  }, [selectedCategory, categoryOptions]);

  // Lọc đa chiều: Category (DB) + Tháng + Trạng thái + Từ khóa
  const displayExpenses = useMemo(() => {
    let result = allCurrentExpenses;
    // 1. Lọc theo danh mục từ cấu hình admin DB
    if (selectedCategory !== 'ALL') {
      result = filterExpensesByCategory(result, selectedCategory);
    }
    // 2. Lọc theo tháng
    if (selectedMonth !== 'ALL') {
      result = filterExpensesByMonth(result, selectedMonth);
    }
    // 3. Lọc theo trạng thái
    result = filterExpensesByStatus(result, statusFilter);
    // 4. Tìm kiếm từ khóa
    result = searchExpenses(result, searchQuery);
    return result;
  }, [allCurrentExpenses, selectedCategory, selectedMonth, statusFilter, searchQuery]);

  // Gom nhóm hiển thị theo Tổ chi phí
  const displayGroups = useMemo(() => {
    return groupExpensesByAiClassification(displayExpenses, false);
  }, [displayExpenses]);

  const hasActiveFilters =
    selectedMonth !== 'ALL' ||
    selectedCategory !== 'ALL' ||
    statusFilter !== 'ALL' ||
    searchQuery.trim().length > 0;

  const handleResetFilters = () => {
    setSelectedMonth('ALL');
    setSelectedCategory('ALL');
    setStatusFilter('ALL');
    setSearchQuery('');
  };

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
    if (periods[yr]?.status === 'SUBMITTED') {
      toast.error(
        `Kỳ tính thuế năm ${yr} đã hoàn tất quyết toán. Không thể xóa kỳ tính thuế đã khóa.`,
        'Kỳ tính thuế đã khóa'
      );
      return;
    }
    if (Platform.OS === 'web') {
      const ok = window.confirm(`Xóa toàn bộ chứng từ năm ${yr}? Hành động này không thể hoàn tác.`);
      if (ok) removeYear(yr);
    } else {
      Alert.alert(
        'Xóa kỳ tính thuế',
        `Xóa toàn bộ chứng từ năm ${yr}? Hành động này không thể hoàn tác.`,
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
    if (currentPeriod?.status === 'SUBMITTED') {
      toast.error(
        `Kỳ tính thuế năm ${selectedYear} đã hoàn tất quyết toán và nộp cho cơ quan thuế. Không thể thêm chứng từ vào kỳ này.`,
        'Kỳ tính thuế đã khóa'
      );
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
    if (currentPeriod?.status === 'SUBMITTED') {
      toast.error(
        'Kỳ tính thuế này đã hoàn tất quyết toán. Không thể xóa chứng từ khỏi hồ sơ đã khóa.',
        'Kỳ tính thuế đã khóa'
      );
      return;
    }
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
              size="lg"
              onPress={() => setShowAddYearModal(true)}
              style={styles.emptyStateCta}
              icon={<Ionicons name="add-circle-outline" size={20} color="#fff" />}
            >
              Tạo kỳ thuế năm {new Date().getFullYear()}
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
            {/* BANNER KỲ ĐÃ QUYẾT TOÁN / KHÓA */}
            {currentPeriod?.status === 'SUBMITTED' && (
              <View style={styles.periodLockedBanner}>
                <Ionicons name="lock-closed" size={18} color="#DC2626" />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.periodLockedTitle}>Hồ sơ thuế năm {selectedYear} đã khóa</Text>
                  <Text style={styles.periodLockedDesc}>
                    Kỳ tính thuế này đã hoàn tất quyết toán và nộp cho cơ quan thuế. Chế độ chỉ xem, không thể thêm hoặc xóa chứng từ.
                  </Text>
                </View>
              </View>
            )}

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

            {/* KHU VỰC TÌM KIẾM & BỘ LỌC ĐA CHIỀU */}
            {allCurrentExpenses.length > 0 && (
              <View style={styles.filterSection}>
                {/* 1. Thanh tìm kiếm */}
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
                    <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close-circle" size={16} color="#94A3B8" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* 2. HÀNG 2 DROPDOWN FILTER: THÁNG & DANH MỤC TỪ ADMIN (DB) */}
                <View style={styles.dropdownRow}>
                  {/* Dropdown 1: Tháng */}
                  <TouchableOpacity
                    style={[styles.dropdownBtn, selectedMonth !== 'ALL' && styles.dropdownBtnActive]}
                    onPress={() => setShowMonthDropdown(true)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.dropdownBtnContent}>
                      <View style={[styles.dropdownIconCircle, selectedMonth !== 'ALL' && styles.dropdownIconCircleActive]}>
                        <Ionicons
                          name="calendar-outline"
                          size={13}
                          color={selectedMonth !== 'ALL' ? '#8B1E1E' : '#64748B'}
                        />
                      </View>
                      <View style={styles.dropdownTextWrap}>
                        <Text style={styles.dropdownLabel}>Theo tháng</Text>
                        <Text
                          style={[styles.dropdownValue, selectedMonth !== 'ALL' && styles.dropdownValueActive]}
                          numberOfLines={1}
                        >
                          {selectedMonthLabel}
                        </Text>
                      </View>
                    </View>
                    <Ionicons
                      name="chevron-down"
                      size={14}
                      color={selectedMonth !== 'ALL' ? '#8B1E1E' : '#94A3B8'}
                    />
                  </TouchableOpacity>

                  {/* Dropdown 2: Danh mục từ Admin (DB) */}
                  <TouchableOpacity
                    style={[styles.dropdownBtn, selectedCategory !== 'ALL' && styles.dropdownBtnActive]}
                    onPress={() => {
                      setCategorySearchQuery('');
                      setShowCategoryDropdown(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.dropdownBtnContent}>
                      <View style={[styles.dropdownIconCircle, selectedCategory !== 'ALL' && styles.dropdownIconCircleActive]}>
                        <Ionicons
                          name="pricetag-outline"
                          size={13}
                          color={selectedCategory !== 'ALL' ? '#8B1E1E' : '#64748B'}
                        />
                      </View>
                      <View style={styles.dropdownTextWrap}>
                        <Text style={styles.dropdownLabel}>Danh mục (DB)</Text>
                        <Text
                          style={[styles.dropdownValue, selectedCategory !== 'ALL' && styles.dropdownValueActive]}
                          numberOfLines={1}
                        >
                          {selectedCategoryLabel}
                        </Text>
                      </View>
                    </View>
                    <Ionicons
                      name="chevron-down"
                      size={14}
                      color={selectedCategory !== 'ALL' ? '#8B1E1E' : '#94A3B8'}
                    />
                  </TouchableOpacity>
                </View>

                {/* 3. Pills lọc trạng thái */}
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

                {/* 4. Tag hiển thị bộ lọc đang kích hoạt */}
                {hasActiveFilters && (
                  <View style={styles.activeFiltersBar}>
                    <Text style={styles.activeFilterLead}>Đang lọc:</Text>
                    {selectedMonth !== 'ALL' && (
                      <TouchableOpacity
                        style={styles.filterChip}
                        onPress={() => setSelectedMonth('ALL')}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="calendar" size={11} color="#8B1E1E" />
                        <Text style={styles.filterChipText}>{selectedMonthLabel}</Text>
                        <Ionicons name="close" size={12} color="#8B1E1E" />
                      </TouchableOpacity>
                    )}
                    {selectedCategory !== 'ALL' && (
                      <TouchableOpacity
                        style={styles.filterChip}
                        onPress={() => setSelectedCategory('ALL')}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="pricetag" size={11} color="#8B1E1E" />
                        <Text style={styles.filterChipText} numberOfLines={1}>
                          {selectedCategoryLabel}
                        </Text>
                        <Ionicons name="close" size={12} color="#8B1E1E" />
                      </TouchableOpacity>
                    )}
                    {statusFilter !== 'ALL' && (
                      <TouchableOpacity
                        style={styles.filterChip}
                        onPress={() => setStatusFilter('ALL')}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.filterChipText}>
                          {getStatusLabel(statusFilter)}
                        </Text>
                        <Ionicons name="close" size={12} color="#8B1E1E" />
                      </TouchableOpacity>
                    )}
                    {searchQuery.trim().length > 0 && (
                      <TouchableOpacity
                        style={styles.filterChip}
                        onPress={() => setSearchQuery('')}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.filterChipText}>"{searchQuery}"</Text>
                        <Ionicons name="close" size={12} color="#8B1E1E" />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={handleResetFilters} style={styles.clearAllBtn} activeOpacity={0.7}>
                      <Text style={styles.clearAllBtnText}>Đặt lại</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* DANH SÁCH CHỨNG TỪ */}
            <View style={styles.docListContainer}>
              {displayGroups.length === 0 ? (
                <View style={styles.noResultBox}>
                  <Ionicons name="document-text-outline" size={44} color="#CBD5E1" />
                  <Text style={styles.noResultTitle}>
                    {hasActiveFilters ? 'Không tìm thấy hóa đơn phù hợp' : 'Chưa có hóa đơn chi phí'}
                  </Text>
                  <Text style={styles.noResultSub}>
                    {hasActiveFilters
                      ? 'Thử thay đổi bộ lọc tháng, danh mục hoặc từ khóa tìm kiếm.'
                      : 'Tải lên hóa đơn để bắt đầu theo dõi chi phí giảm trừ thuế.'}
                  </Text>
                  {hasActiveFilters ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onPress={handleResetFilters}
                      style={{ marginTop: 12 }}
                      icon={<Ionicons name="refresh-outline" size={14} color={theme.colors.primary} />}
                    >
                      Xóa tất cả bộ lọc
                    </Button>
                  ) : (
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

      {/* MODAL DROPDOWN: CHỌN THÁNG */}
      <Modal visible={showMonthDropdown} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMonthDropdown(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.pickerModalCard}>
            <View style={styles.pickerHeader}>
              <View>
                <Text style={styles.pickerTitle}>Lọc theo tháng</Text>
                <Text style={styles.pickerSubtitle}>Năm {selectedYear} • Chọn tháng phát sinh chi phí</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowMonthDropdown(false)}
                style={styles.pickerCloseBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Tùy chọn "Tất cả các tháng" */}
            <TouchableOpacity
              style={[
                styles.pickerOptionRow,
                selectedMonth === 'ALL' && styles.pickerOptionRowActive,
              ]}
              onPress={() => {
                setSelectedMonth('ALL');
                setShowMonthDropdown(false);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.pickerOptionLeft}>
                <Ionicons
                  name={selectedMonth === 'ALL' ? 'radio-button-on' : 'radio-button-off'}
                  size={18}
                  color={selectedMonth === 'ALL' ? '#8B1E1E' : '#94A3B8'}
                />
                <Text style={[styles.pickerOptionText, selectedMonth === 'ALL' && styles.pickerOptionTextActive]}>
                  Tất cả các tháng (Cả năm)
                </Text>
              </View>
              <View style={[styles.pickerCountBadge, selectedMonth === 'ALL' && styles.pickerCountBadgeActive]}>
                <Text style={[styles.pickerCountText, selectedMonth === 'ALL' && styles.pickerCountTextActive]}>
                  {allCurrentExpenses.length} HĐ
                </Text>
              </View>
            </TouchableOpacity>

            <View style={styles.pickerDivider} />

            {/* Lưới 12 tháng */}
            <View style={styles.monthGrid}>
              {monthOptions.map((opt) => {
                const isSelected = selectedMonth === opt.value;
                const hasDocs = opt.count > 0;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.monthGridCell,
                      isSelected && styles.monthGridCellActive,
                      !hasDocs && styles.monthGridCellMuted,
                    ]}
                    onPress={() => {
                      setSelectedMonth(opt.value);
                      setShowMonthDropdown(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.monthCellLabel, isSelected && styles.monthCellLabelActive]}>
                      {opt.label}
                    </Text>
                    <Text style={[styles.monthCellCount, isSelected && styles.monthCellCountActive, hasDocs && styles.monthCellCountBold]}>
                      {hasDocs ? `${opt.count} HĐ` : '—'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* MODAL DROPDOWN: CHỌN DANH MỤC TỪ ADMIN (DB) */}
      <Modal visible={showCategoryDropdown} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCategoryDropdown(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.pickerModalCardLarge}>
            <View style={styles.pickerHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.pickerTitle}>Lọc theo danh mục</Text>
                <Text style={styles.pickerSubtitle}>Cấu hình danh mục chứng từ từ hệ thống quản trị (DB)</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowCategoryDropdown(false)}
                style={styles.pickerCloseBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Ô tìm kiếm danh mục trong modal */}
            <View style={styles.categorySearchBox}>
              <Ionicons name="search" size={15} color="#94A3B8" />
              <TextInput
                style={styles.categorySearchInput}
                placeholder="Tìm danh mục..."
                placeholderTextColor="#94A3B8"
                value={categorySearchQuery}
                onChangeText={setCategorySearchQuery}
              />
              {categorySearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setCategorySearchQuery('')}>
                  <Ionicons name="close-circle" size={15} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>

            {/* Danh sách danh mục cuộn */}
            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={true}>
              {/* Tùy chọn "Tất cả danh mục" */}
              <TouchableOpacity
                style={[
                  styles.pickerCategoryRow,
                  selectedCategory === 'ALL' && styles.pickerCategoryRowActive,
                ]}
                onPress={() => {
                  setSelectedCategory('ALL');
                  setShowCategoryDropdown(false);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.pickerCategoryLeft}>
                  <View style={[styles.catIconWrap, { backgroundColor: '#F1F5F9' }]}>
                    <Ionicons name="apps-outline" size={16} color="#475569" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.pickerCategoryName, selectedCategory === 'ALL' && styles.pickerCategoryNameActive]}>
                      Tất cả danh mục
                    </Text>
                    <Text style={styles.pickerCategorySub}>Hiển thị mọi hóa đơn chi phí</Text>
                  </View>
                </View>
                <View style={[styles.pickerCountBadge, selectedCategory === 'ALL' && styles.pickerCountBadgeActive]}>
                  <Text style={[styles.pickerCountText, selectedCategory === 'ALL' && styles.pickerCountTextActive]}>
                    {allCurrentExpenses.length} HĐ
                  </Text>
                </View>
              </TouchableOpacity>

              {filteredCategoryOptions.map((cat) => {
                const isSelected = selectedCategory.toUpperCase() === cat.code.toUpperCase();
                return (
                  <TouchableOpacity
                    key={cat.code}
                    style={[
                      styles.pickerCategoryRow,
                      isSelected && styles.pickerCategoryRowActive,
                    ]}
                    onPress={() => {
                      setSelectedCategory(cat.code);
                      setShowCategoryDropdown(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.pickerCategoryLeft}>
                      <View style={[styles.catIconWrap, { backgroundColor: '#FEF2F2' }]}>
                        <Ionicons name={cat.icon as any} size={16} color="#8B1E1E" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.pickerCategoryName, isSelected && styles.pickerCategoryNameActive]} numberOfLines={1}>
                          {cat.name}
                        </Text>
                        <View style={styles.categorySubRow}>
                          <Text style={styles.pickerCategorySub} numberOfLines={1}>
                            {cat.code}
                          </Text>
                          {cat.isTaxEligible && (
                            <View style={styles.taxEligiblePill}>
                              <Text style={styles.taxEligiblePillText}>Giảm trừ thuế</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                    <View style={[styles.pickerCountBadge, isSelected && styles.pickerCountBadgeActive]}>
                      <Text style={[styles.pickerCountText, isSelected && styles.pickerCountTextActive]}>
                        {cat.count} HĐ
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.pickerFooter}>
              <Ionicons name="information-circle-outline" size={13} color="#94A3B8" />
              <Text style={styles.pickerFooterText}>
                {isDocumentTypesLoading
                  ? 'Đang đồng bộ danh mục từ cấu hình admin...'
                  : `${categoryOptions.length} danh mục khả dụng từ hệ thống`}
              </Text>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

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
  periodLockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  periodLockedTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#991B1B',
  },
  periodLockedDesc: {
    fontSize: 11.5,
    color: '#7F1D1D',
    marginTop: 2,
    lineHeight: 16,
  },
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
    fontWeight: '700',
  },
  yearBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  yearBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  yearBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  yearBadgeTextActive: {
    color: '#FFFFFF',
  },
  yearDeleteBtn: {
    marginLeft: 2,
    padding: 2,
  },
  addYearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderStyle: 'dashed',
    backgroundColor: '#FFFFFF',
    gap: 3,
  },
  addYearBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  // --- Content ---
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  // --- KPI Grid ---
  kpiRow: {
    marginBottom: 12,
    gap: 8,
  },
  kpiBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  kpiBoxVal: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 26,
  },
  kpiBoxLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  kpiSmallGrid: {
    flexDirection: 'row',
    gap: 6,
  },
  kpiSmall: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  kpiSmallVal: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 18,
  },
  kpiSmallLabel: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
    textAlign: 'center',
  },
  // --- Upload button ---
  uploadBtn: {
    marginBottom: 12,
  },
  // --- Filter section ---
  filterSection: {
    marginBottom: 12,
    gap: 8,
  },
  // --- Search Bar ---
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
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
  // --- Dropdown filter row ---
  dropdownRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dropdownBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dropdownBtnActive: {
    borderColor: '#8B1E1E',
    backgroundColor: '#FFF8F8',
  },
  dropdownBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 7,
    marginRight: 4,
  },
  dropdownIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownIconCircleActive: {
    backgroundColor: '#FEE2E2',
  },
  dropdownTextWrap: {
    flex: 1,
  },
  dropdownLabel: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  dropdownValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginTop: 1,
  },
  dropdownValueActive: {
    color: '#8B1E1E',
  },
  // --- Status pills ---
  statusPillsScroll: {
    marginTop: 2,
  },
  statusPillsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusPillActive: {
    backgroundColor: '#8B1E1E',
    borderColor: '#8B1E1E',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  statusPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  // --- Active filters bar ---
  activeFiltersBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    paddingTop: 4,
  },
  activeFilterLead: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    maxWidth: 160,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8B1E1E',
    maxWidth: 120,
  },
  clearAllBtn: {
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  clearAllBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8B1E1E',
    textDecorationLine: 'underline',
  },
  // --- Document List ---
  docListContainer: {
    gap: 16,
  },
  groupSection: {
    gap: 8,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  groupIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 8,
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
  },
  groupAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  groupConfirmedHint: {
    fontSize: 10,
    color: '#16A34A',
    fontWeight: '600',
  },
  // --- Document card ---
  docCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  docCardBody: {
    gap: 4,
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
  // --- Empty states ---
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
  // --- Picker Modals (Tháng & Category) ---
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  pickerModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  pickerModalCardLarge: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  pickerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  pickerCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
  },
  pickerOptionRowActive: {
    backgroundColor: '#FEE2E2',
  },
  pickerOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pickerOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  pickerOptionTextActive: {
    color: '#8B1E1E',
    fontWeight: '700',
  },
  pickerCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
  },
  pickerCountBadgeActive: {
    backgroundColor: '#8B1E1E',
  },
  pickerCountText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#475569',
  },
  pickerCountTextActive: {
    color: '#FFFFFF',
  },
  pickerDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  monthGridCell: {
    width: '31%',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  monthGridCellActive: {
    backgroundColor: '#8B1E1E',
    borderColor: '#8B1E1E',
  },
  monthGridCellMuted: {
    opacity: 0.7,
  },
  monthCellLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  monthCellLabelActive: {
    color: '#FFFFFF',
  },
  monthCellCount: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  monthCellCountActive: {
    color: 'rgba(255,255,255,0.85)',
  },
  monthCellCountBold: {
    fontWeight: '700',
    color: '#64748B',
  },
  // --- Category Modal Details ---
  categorySearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
    marginBottom: 12,
  },
  categorySearchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    padding: 0,
  },
  pickerCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  pickerCategoryRowActive: {
    backgroundColor: '#FFF8F8',
    borderColor: '#8B1E1E',
  },
  pickerCategoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
    marginRight: 8,
  },
  catIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerCategoryName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  pickerCategoryNameActive: {
    color: '#8B1E1E',
  },
  categorySubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  pickerCategorySub: {
    fontSize: 11,
    color: '#64748B',
  },
  taxEligiblePill: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  taxEligiblePillText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#059669',
  },
  pickerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 12,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  pickerFooterText: {
    fontSize: 11,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  // --- Modal Thêm Năm ---
  modalCard: {
    width: '100%',
    maxWidth: 380,
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
