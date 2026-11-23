import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  Switch,
  Platform,
  RefreshControl,
  ScrollView,
  KeyboardAvoidingView,
  ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { DrumHeader } from '../../components/brand/DrumHeader';
import { GoldDoubleRule } from '../../components/brand/GoldDoubleRule';
import { Dialog } from '../../components/common/Dialog';
import { MainTabBar } from '../../components/navigation/MainTabBar';
import { useToast } from '../../components/ui/Toast';
import { useDebounce } from '../../hooks/useDebounce';
import {
  incomeSourceApi,
  IncomeSourceItem,
  IncomeSourceCreateDto,
  IncomeSourceUpdateDto,
  IncomeSourceSummaryDto,
  PaginationMeta,
} from '../../api/incomeSourceApi';
import { RootNavigationProp, RootStackParamList } from '../../navigation/types';
import { toFriendlyErrorMessage } from '../../utils/friendlyError';
import { MonthlyIncomePanel } from '../income/MonthlyIncomePanel';
import { evaluateManualIncomeSource } from './manualIncomeSourceCheck';

const TAX_YEAR_OPTIONS = [2026, 2025, 2024];

const formatDate = (dateStr?: string) => {
  if (!dateStr) return 'Chưa cập nhật';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const formatCurrency = (val?: number) => {
  if (typeof val !== 'number' || isNaN(val)) return '0';
  return val.toLocaleString('vi-VN');
};

interface IncomeSourceRowProps {
  item: IncomeSourceItem;
  index: number;
  onEdit: (item: IncomeSourceItem) => void;
  onDelete: (item: IncomeSourceItem) => void;
}

const IncomeSourceRow = React.memo<IncomeSourceRowProps>(({ item, index, onEdit, onDelete }) => (
  <View style={styles.card} testID={`incomeSourceCard_${item.id}`}>
    <View style={styles.cardHeader}>
      <Text style={styles.ledgerIndex}>{String(index + 1).padStart(2, '0')}</Text>
      <View style={styles.cardMainInfo}>
        <Text style={styles.companyName} numberOfLines={2}>
          {item.companyName}
        </Text>
        <Text style={styles.companyMeta}>
          MST {item.companyTaxCode || item.companyTaxId} · Năm {item.taxYear || 2026} ·{' '}
          <Text style={item.isActive ? styles.statusActiveText : styles.statusInactiveText}>
            {item.isActive ? 'Đang chi trả' : 'Đã dừng'}
          </Text>
        </Text>
      </View>
    </View>

    <View style={styles.financialRow}>
      <View style={styles.financialCol}>
        <Text style={styles.financialLabel}>Thu nhập năm</Text>
        <Text
          style={styles.incomeValueText}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.72}
        >
          {formatCurrency(item.totalIncome)} đ
        </Text>
      </View>
      <View style={styles.financialCol}>
        <Text style={styles.financialLabel}>Thuế đã khấu trừ</Text>
        <Text
          style={styles.taxValueText}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.72}
        >
          {formatCurrency(item.taxWithheld)} đ
        </Text>
      </View>
    </View>

    <Text style={styles.metaValue}>
      Khai báo {formatDate(item.createdAt)}
      {item.updatedAt && item.updatedAt !== item.createdAt ? ` · Cập nhật ${formatDate(item.updatedAt)}` : ''}
    </Text>

    <View style={styles.cardActions}>
      <TouchableOpacity
        style={styles.actionBtn}
        onPress={() => onEdit(item)}
        testID={`editIncomeSourceBtn_${item.id}`}
      >
        <Text style={styles.actionBtnText}>Sửa</Text>
      </TouchableOpacity>
      <Text style={styles.actionDivider}>·</Text>
      <TouchableOpacity
        style={styles.actionBtn}
        onPress={() => onDelete(item)}
        testID={`deleteIncomeSourceBtn_${item.id}`}
      >
        <Text style={styles.actionBtnDanger}>Xóa</Text>
      </TouchableOpacity>
    </View>
  </View>
));

interface CrossCheckConfirmState {
  title: string;
  message: string;
  detail: string;
}

export const IncomeSourceListScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'IncomeSourceList'>>();
  const insets = useSafeAreaInsets();
  const { toast } = useToast();

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const [viewMode, setViewMode] = useState<'yearly' | 'monthly'>(route.params?.view ?? 'yearly');

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [sources, setSources] = useState<IncomeSourceItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const [selectedYearFilter, setSelectedYearFilter] = useState<number>(2026);
  const [summary, setSummary] = useState<IncomeSourceSummaryDto | null>(null);

  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<IncomeSourceItem | null>(null);
  const [companyName, setCompanyName] = useState<string>('');
  const [companyTaxCode, setCompanyTaxCode] = useState<string>('');
  const [taxYear, setTaxYear] = useState<number>(2026);
  const [totalIncome, setTotalIncome] = useState<string>('0');
  const [taxWithheld, setTaxWithheld] = useState<string>('0');
  const [isActive, setIsActive] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  const [deleteTarget, setDeleteTarget] = useState<IncomeSourceItem | null>(null);
  const [crossCheckDialog, setCrossCheckDialog] = useState<CrossCheckConfirmState | null>(null);

  const fetchIncomeSources = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const queryParams: { taxYear?: number } = {};
        if (selectedYearFilter > 0) {
          queryParams.taxYear = selectedYearFilter;
        }
        const summaryYear = selectedYearFilter > 0 ? selectedYearFilter : 2026;

        const [data, summaryData] = await Promise.all([
          incomeSourceApi.getAll(queryParams),
          incomeSourceApi.getSummary(summaryYear),
        ]);
        if (!isMountedRef.current) return;

        setSources(data.items || []);
        setPagination(data.pagination || null);
        setSummary(summaryData);
      } catch (err: unknown) {
        if (!isMountedRef.current) return;
        toast.error(
          toFriendlyErrorMessage(err, 'Không thể tải danh sách nơi chi trả thu nhập. Vui lòng thử lại.'),
          'Chưa tải được dữ liệu'
        );
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [selectedYearFilter, toast]
  );

  useFocusEffect(
    useCallback(() => {
      fetchIncomeSources();
    }, [fetchIncomeSources])
  );

  const handleOpenCreateModal = useCallback(() => {
    setEditingItem(null);
    setCompanyName('');
    setCompanyTaxCode('');
    setTaxYear(selectedYearFilter > 0 ? selectedYearFilter : 2026);
    setTotalIncome('');
    setTaxWithheld('');
    setIsActive(true);
    setFormErrors({});
    setModalVisible(true);
  }, [selectedYearFilter]);

  const handleOpenEditModal = useCallback((item: IncomeSourceItem) => {
    setEditingItem(item);
    setCompanyName(item.companyName);
    setCompanyTaxCode(item.companyTaxCode || item.companyTaxId || '');
    setTaxYear(item.taxYear || 2026);
    setTotalIncome(item.totalIncome ? String(item.totalIncome) : '0');
    setTaxWithheld(item.taxWithheld ? String(item.taxWithheld) : '0');
    setIsActive(item.isActive);
    setFormErrors({});
    setModalVisible(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    if (!submitting) {
      setModalVisible(false);
      setEditingItem(null);
      setFormErrors({});
    }
  }, [submitting]);

  const validateForm = (): boolean => {
    const errs: { [key: string]: string } = {};

    const cleanName = companyName.trim();
    if (!cleanName) {
      errs.companyName = 'Vui lòng nhập tên cơ quan hoặc doanh nghiệp chi trả.';
    } else if (cleanName.length > 255) {
      errs.companyName = 'Tên cơ quan không được vượt quá 255 ký tự.';
    }

    const cleanTax = companyTaxCode.trim();
    if (!cleanTax) {
      errs.companyTaxCode = 'Vui lòng nhập mã số thuế tổ chức.';
    } else if (!/^\d{10}$|^\d{10}-\d{3}$/.test(cleanTax)) {
      errs.companyTaxCode =
        'Mã số thuế tổ chức gồm 10 chữ số (ví dụ: 0100109107) hoặc 13 chữ số chi nhánh (ví dụ: 0100109107-001).';
    }

    const cleanYear = Number(taxYear);
    if (!cleanYear || cleanYear < 2000 || cleanYear > 2100) {
      errs.taxYear = 'Năm tính thuế phải từ 2000 đến 2100.';
    }

    const parsedIncome = Number(totalIncome.replace(/[^\d.]/g, ''));
    if (isNaN(parsedIncome) || parsedIncome < 0) {
      errs.totalIncome = 'Tổng thu nhập không được âm.';
    }

    const parsedWithheld = Number(taxWithheld.replace(/[^\d.]/g, ''));
    if (isNaN(parsedWithheld) || parsedWithheld < 0) {
      errs.taxWithheld = 'Số thuế đã khấu trừ không được âm.';
    }

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const persistIncomeSource = async () => {
    try {
      setSubmitting(true);
      const cleanName = companyName.trim();
      const cleanTax = companyTaxCode.trim();
      const cleanYear = Number(taxYear) || 2026;
      const cleanIncome = Number(totalIncome.replace(/[^\d.]/g, '')) || 0;
      const cleanWithheld = Number(taxWithheld.replace(/[^\d.]/g, '')) || 0;

      if (editingItem) {
        const updatePayload: IncomeSourceUpdateDto = {
          companyName: cleanName,
          companyTaxCode: cleanTax,
          companyTaxId: cleanTax,
          taxYear: cleanYear,
          totalIncome: cleanIncome,
          taxWithheld: cleanWithheld,
          isActive,
        };
        await incomeSourceApi.update(editingItem.id, updatePayload);
      } else {
        const createPayload: IncomeSourceCreateDto = {
          companyName: cleanName,
          companyTaxCode: cleanTax,
          companyTaxId: cleanTax,
          taxYear: cleanYear,
          totalIncome: cleanIncome,
          taxWithheld: cleanWithheld,
        };
        await incomeSourceApi.create(createPayload);
      }

      if (!isMountedRef.current) return;
      const wasEditing = !!editingItem;
      setCrossCheckDialog(null);
      setModalVisible(false);
      setEditingItem(null);
      await fetchIncomeSources();
      if (!isMountedRef.current) return;

      toast.success(
        wasEditing
          ? 'Đã cập nhật thông tin nơi chi trả thu nhập.'
          : 'Đã khai báo nơi chi trả thu nhập mới.',
        'Đã lưu nơi chi trả'
      );
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      toast.error(
        toFriendlyErrorMessage(err, 'Chưa thể lưu thông tin nơi chi trả. Vui lòng kiểm tra lại mã số thuế.'),
        'Chưa lưu được thông tin'
      );
    } finally {
      if (isMountedRef.current) {
        setSubmitting(false);
      }
    }
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    const cleanName = companyName.trim();
    const cleanYear = Number(taxYear) || 2026;
    const cleanIncome = Number(totalIncome.replace(/[^\d.]/g, '')) || 0;
    const cleanWithheld = Number(taxWithheld.replace(/[^\d.]/g, '')) || 0;

    setSubmitting(true);
    try {
      const result = await incomeSourceApi.crossCheck({
        companyName: cleanName,
        taxYear: cleanYear,
        certificateTotalIncome: cleanIncome,
        certificateTaxWithheld: cleanWithheld,
        certificateInsuranceDeducted: 0,
      });
      if (!isMountedRef.current) return;
      const outcome = evaluateManualIncomeSource(result, { income: cleanIncome, tax: cleanWithheld });
      if (outcome.status === 'mismatch') {
        setSubmitting(false);
        setModalVisible(false);
        setCrossCheckDialog({
          title: 'Số liệu lệch với thu nhập tháng',
          message:
            'Số liệu tổng năm được dùng trực tiếp khi quyết toán thuế. Vui lòng kiểm tra lại hoặc xác nhận vẫn lưu.',
          detail: outcome.messages.join('\n'),
        });
        return;
      }
    } catch {
      if (!isMountedRef.current) return;
      setSubmitting(false);
      setModalVisible(false);
      setCrossCheckDialog({
        title: 'Chưa đối chiếu được số liệu tháng',
        message:
          'Hiện chưa kiểm tra được với bảng thu nhập theo tháng. Bạn có thể xem lại hoặc vẫn lưu thông tin này.',
        detail: `${cleanName} · Năm ${cleanYear} (${formatCurrency(cleanIncome)} đ)`,
      });
      return;
    }

    await persistIncomeSource();
  };

  const handleRequestDelete = useCallback((item: IncomeSourceItem) => {
    setDeleteTarget(item);
  }, []);

  const handleConfirmDelete = async () => {
    const item = deleteTarget;
    if (!item) return;
    setDeleteTarget(null);
    try {
      setLoading(true);
      await incomeSourceApi.delete(item.id);
      if (!isMountedRef.current) return;
      await fetchIncomeSources();
      if (!isMountedRef.current) return;
      toast.success(`Đã xóa "${item.companyName}" khỏi danh sách nơi chi trả.`, 'Đã xóa nơi chi trả');
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      toast.error(
        toFriendlyErrorMessage(err, 'Không thể xóa nơi chi trả này. Vui lòng thử lại.'),
        'Chưa xóa được đơn vị'
      );
      setLoading(false);
    }
  };

  const filteredSources = useMemo(() => {
    const query = debouncedSearchQuery.toLowerCase().trim();
    if (!query) return sources;
    return sources.filter(
      (item) =>
        item.companyName.toLowerCase().includes(query) ||
        (item.companyTaxCode && item.companyTaxCode.toLowerCase().includes(query)) ||
        (item.companyTaxId && item.companyTaxId.toLowerCase().includes(query))
    );
  }, [sources, debouncedSearchQuery]);

  const counts = useMemo(() => {
    let active = 0;
    let inactive = 0;
    for (const s of sources) {
      if (s.isActive) active += 1;
      else inactive += 1;
    }
    return { active, inactive };
  }, [sources]);

  const keyExtractor = useCallback((item: IncomeSourceItem) => item.id, []);

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<IncomeSourceItem>) => (
      <IncomeSourceRow
        item={item}
        index={index}
        onEdit={handleOpenEditModal}
        onDelete={handleRequestDelete}
      />
    ),
    [handleOpenEditModal, handleRequestDelete]
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <DrumHeader
        title={viewMode === 'monthly' ? 'Thu nhập theo tháng' : 'Nơi chi trả'}
        onBack={() => {
          if (navigation.canGoBack()) navigation.goBack();
          else navigation.navigate('Home');
        }}
        backTestID="backBtn"
        right={
          <TouchableOpacity
            style={styles.addHeaderBtn}
            onPress={
              viewMode === 'monthly'
                ? () => navigation.navigate('IncomeMonthForm', { year: new Date().getFullYear() })
                : handleOpenCreateModal
            }
            accessibilityRole="button"
            accessibilityLabel={viewMode === 'monthly' ? 'Thêm thu nhập tháng' : 'Thêm nơi chi trả'}
            testID="addIncomeSourceBtn"
          >
            <Ionicons name="add" size={26} color={theme.colors.primary} />
          </TouchableOpacity>
        }
      />

      <View style={styles.mainConstraint}>
        <View style={styles.viewToggle}>
          {(['yearly', 'monthly'] as const).map((mode) => {
            const on = viewMode === mode;
            return (
              <TouchableOpacity
                key={mode}
                style={[styles.viewToggleBtn, on && styles.viewToggleBtnOn]}
                onPress={() => setViewMode(mode)}
                accessibilityRole="button"
                testID={`incomeView_${mode}`}
              >
                <Text style={[styles.viewToggleText, on && styles.viewToggleTextOn]}>
                  {mode === 'yearly' ? 'Theo năm' : 'Theo tháng'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {viewMode === 'monthly' ? (
        <MonthlyIncomePanel />
      ) : (
        <View style={styles.yearlyContainer}>
          <Text style={styles.pageLead}>
            Cơ quan chi trả lương, dùng khi đối soát và quyết toán thuế thu nhập cá nhân.
          </Text>

          <TouchableOpacity
            style={styles.voucherBtn}
            onPress={() =>
              navigation.navigate('WithholdingVoucher', {
                year: selectedYearFilter || new Date().getFullYear(),
              })
            }
            accessibilityRole="button"
            testID="uploadWithholdingVoucherBtn"
          >
            <Ionicons name="document-text-outline" size={18} color={theme.colors.primary} />
            <Text style={styles.voucherBtnText}>Tải chứng từ khấu trừ</Text>
          </TouchableOpacity>

          <View style={styles.yearFilterRow}>
            <Text style={styles.yearFilterLabel}>Năm tính thuế:</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.yearFilterScroll}
            >
              {TAX_YEAR_OPTIONS.map((yr) => {
                const isSelected = selectedYearFilter === yr;
                return (
                  <TouchableOpacity
                    key={yr}
                    style={[styles.yearChip, isSelected && styles.yearChipSelected]}
                    onPress={() => setSelectedYearFilter(yr)}
                    testID={`yearFilterTab_${yr}`}
                  >
                    <Text style={[styles.yearChipText, isSelected && styles.yearChipTextSelected]}>
                      Năm {yr}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={[styles.yearChip, selectedYearFilter === 0 && styles.yearChipSelected]}
                onPress={() => setSelectedYearFilter(0)}
                testID="yearFilterTab_all"
              >
                <Text style={[styles.yearChipText, selectedYearFilter === 0 && styles.yearChipTextSelected]}>
                  Tất cả
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {summary && (
            <View style={styles.summaryCard} testID="incomeSummaryCard">
              <Text style={styles.summaryTitle}>
                Thu nhập {selectedYearFilter > 0 ? `năm ${selectedYearFilter}` : 'năm 2026'}
              </Text>
              <Text
                style={styles.summaryIncomeValue}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.68}
              >
                {formatCurrency(summary.totalIncome)} đ
              </Text>
              <Text style={styles.summaryTaxValue}>
                Thuế đã khấu trừ {formatCurrency(summary.totalTaxWithheld)} đ ·{' '}
                {summary.totalSources || sources.length} nơi chi trả
              </Text>
              <GoldDoubleRule style={styles.summaryRule} />
            </View>
          )}

          <View style={styles.searchContainer}>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color={theme.colors.textSecondary} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Tìm theo tên đơn vị hoặc mã số thuế"
                placeholderTextColor={theme.colors.textPlaceholder}
                testID="incomeSourceSearchInput"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={18} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {!loading && sources.length > 0 && (
            <View style={styles.listHeaderBar}>
              <Text style={styles.listHeaderTitle}>Danh sách</Text>
              <Text style={styles.listHeaderSubtext}>
                {pagination ? pagination.totalItems : sources.length} đơn vị · {counts.active} đang chi trả ·{' '}
                {counts.inactive} đã dừng
              </Text>
            </View>
          )}

          {loading && !refreshing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.loadingText}>Đang tải danh sách nơi chi trả...</Text>
            </View>
          ) : (
            <FlatList
              style={styles.list}
              data={filteredSources}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              initialNumToRender={8}
              maxToRenderPerBatch={8}
              windowSize={7}
              removeClippedSubviews={Platform.OS === 'android'}
              keyboardShouldPersistTaps="handled"
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => fetchIncomeSources(true)}
                  colors={[theme.colors.primary]}
                />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyTitle}>Chưa có nơi chi trả nào</Text>
                  <Text style={styles.emptySubtext}>
                    {searchQuery
                      ? 'Không tìm thấy đơn vị chi trả phù hợp với từ khóa.'
                      : `Chưa có đơn vị chi trả nào cho kỳ tính thuế ${selectedYearFilter > 0 ? selectedYearFilter : ''}. Hãy khai báo thông tin nơi làm việc của bạn.`}
                  </Text>

                  {!searchQuery && (
                    <TouchableOpacity
                      style={styles.emptyAddBtn}
                      onPress={handleOpenCreateModal}
                      testID="emptyAddBtn"
                    >
                      <Ionicons name="add" size={20} color="#FFFFFF" style={styles.emptyAddIcon} />
                      <Text style={styles.emptyAddBtnText}>Khai báo nơi chi trả đầu tiên</Text>
                    </TouchableOpacity>
                  )}
                </View>
              }
            />
          )}
        </View>
      )}

      {/* Modal Khai báo / Chỉnh sửa */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={handleCloseModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalCard, { paddingBottom: Math.max(insets.bottom, 8) }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingItem ? 'Chỉnh sửa nơi chi trả' : 'Khai báo nơi chi trả'}
              </Text>
              <TouchableOpacity
                onPress={handleCloseModal}
                disabled={submitting}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.modalBody}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.modalInputGroup}>
                <Text style={styles.modalLabel}>
                  Tên cơ quan / Doanh nghiệp <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={[styles.modalInput, formErrors.companyName && styles.inputError]}
                  value={companyName}
                  onChangeText={(val) => {
                    setCompanyName(val);
                    if (formErrors.companyName) setFormErrors((prev) => ({ ...prev, companyName: '' }));
                  }}
                  placeholder="Ví dụ: Công ty Cổ phần Viễn thông FPT"
                  placeholderTextColor={theme.colors.textPlaceholder}
                  testID="companyNameInput"
                />
                {formErrors.companyName ? (
                  <Text style={styles.errorText}>{formErrors.companyName}</Text>
                ) : null}
              </View>

              <View style={styles.modalInputGroup}>
                <Text style={styles.modalLabel}>
                  Mã số thuế tổ chức (MST) <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={[styles.modalInput, formErrors.companyTaxCode && styles.inputError]}
                  value={companyTaxCode}
                  onChangeText={(val) => {
                    setCompanyTaxCode(val);
                    if (formErrors.companyTaxCode) setFormErrors((prev) => ({ ...prev, companyTaxCode: '' }));
                  }}
                  placeholder="10 hoặc 13 chữ số"
                  placeholderTextColor={theme.colors.textPlaceholder}
                  keyboardType="number-pad"
                  maxLength={14}
                  testID="companyTaxCodeInput"
                />
                {formErrors.companyTaxCode ? (
                  <Text style={styles.errorText}>{formErrors.companyTaxCode}</Text>
                ) : null}
                <Text style={styles.taxHint}>
                  Mã số thuế gồm 10 chữ số (hoặc 13 số kèm dấu gạch ngang cho chi nhánh).
                </Text>
              </View>

              <View style={styles.modalInputGroup}>
                <Text style={styles.modalLabel}>
                  Năm tính thuế <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={[styles.modalInput, formErrors.taxYear && styles.inputError]}
                  value={taxYear ? String(taxYear) : ''}
                  onChangeText={(val) => {
                    setTaxYear(Number(val.replace(/\D/g, '')) || 0);
                    if (formErrors.taxYear) setFormErrors((prev) => ({ ...prev, taxYear: '' }));
                  }}
                  placeholder="4 chữ số"
                  placeholderTextColor={theme.colors.textPlaceholder}
                  keyboardType="number-pad"
                  maxLength={4}
                  testID="taxYearInput"
                />
                {formErrors.taxYear ? (
                  <Text style={styles.errorText}>{formErrors.taxYear}</Text>
                ) : null}
              </View>

              <View style={styles.modalRowInputs}>
                <View style={[styles.modalInputGroup, styles.halfInputCol]}>
                  <Text style={styles.modalLabel}>Tổng thu nhập (VNĐ)</Text>
                  <TextInput
                    style={[styles.modalInput, formErrors.totalIncome && styles.inputError]}
                    value={totalIncome}
                    onChangeText={(val) => {
                      setTotalIncome(val);
                      if (formErrors.totalIncome) setFormErrors((prev) => ({ ...prev, totalIncome: '' }));
                    }}
                    placeholder="0"
                    placeholderTextColor={theme.colors.textPlaceholder}
                    keyboardType="numeric"
                    testID="totalIncomeInput"
                  />
                  {formErrors.totalIncome ? (
                    <Text style={styles.errorText}>{formErrors.totalIncome}</Text>
                  ) : null}
                </View>

                <View style={[styles.modalInputGroup, styles.halfInputCol]}>
                  <Text style={styles.modalLabel}>Thuế đã khấu trừ</Text>
                  <TextInput
                    style={[styles.modalInput, formErrors.taxWithheld && styles.inputError]}
                    value={taxWithheld}
                    onChangeText={(val) => {
                      setTaxWithheld(val);
                      if (formErrors.taxWithheld) setFormErrors((prev) => ({ ...prev, taxWithheld: '' }));
                    }}
                    placeholder="0"
                    placeholderTextColor={theme.colors.textPlaceholder}
                    keyboardType="numeric"
                    testID="taxWithheldInput"
                  />
                  {formErrors.taxWithheld ? (
                    <Text style={styles.errorText}>{formErrors.taxWithheld}</Text>
                  ) : null}
                </View>
              </View>

              {editingItem && (
                <View style={styles.switchRow}>
                  <View style={styles.switchTextWrap}>
                    <Text style={styles.switchLabel}>Đang nhận thu nhập từ đơn vị này</Text>
                    <Text style={styles.switchSubtext}>
                      {isActive ? 'Đơn vị đang chi trả tiền lương định kỳ' : 'Đã dừng chi trả hoặc chuyển công tác'}
                    </Text>
                  </View>
                  <Switch
                    value={isActive}
                    onValueChange={setIsActive}
                    trackColor={{ false: '#CCCCCC', true: theme.colors.primary }}
                    thumbColor="#FFFFFF"
                    testID="isActiveSwitch"
                  />
                </View>
              )}

              {editingItem && (
                <View style={styles.systemInfoBox}>
                  <View style={styles.systemInfoRow}>
                    <Ionicons name="calendar-outline" size={13} color={theme.colors.textSecondary} />
                    <Text style={styles.systemInfoLabel}>Ngày khai báo:</Text>
                    <Text style={styles.systemInfoValue}>{formatDate(editingItem.createdAt)}</Text>
                  </View>
                  <View style={styles.systemInfoRow}>
                    <Ionicons name="time-outline" size={13} color={theme.colors.textSecondary} />
                    <Text style={styles.systemInfoLabel}>Cập nhật lần cuối:</Text>
                    <Text style={styles.systemInfoValue}>{formatDate(editingItem.updatedAt)}</Text>
                  </View>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={handleCloseModal}
                disabled={submitting}
              >
                <Text style={styles.modalCancelText}>Đóng</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSaveBtn, submitting && styles.modalSaveBtnDisabled]}
                onPress={handleSave}
                disabled={submitting}
                testID="saveIncomeSourceBtn"
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSaveText}>Lưu thông tin</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Dialog
        visible={!modalVisible && !!crossCheckDialog}
        title={crossCheckDialog?.title ?? 'Kiểm tra số liệu kê khai'}
        message={crossCheckDialog?.message ?? ''}
        detailLabel="Chi tiết đối chiếu"
        detail={crossCheckDialog?.detail}
        destructive
        primaryLabel="Vẫn lưu"
        secondaryLabel="Xem lại"
        onPrimary={persistIncomeSource}
        onSecondary={() => {
          setCrossCheckDialog(null);
          setModalVisible(true);
        }}
        onRequestClose={() => {
          setCrossCheckDialog(null);
          setModalVisible(true);
        }}
      />

      <Dialog
        visible={!modalVisible && !!deleteTarget}
        title="Xóa nơi chi trả này?"
        message="Đơn vị này sẽ bị gỡ khỏi danh sách nơi chi trả thu nhập trong kỳ tính thuế."
        detailLabel="Đơn vị chi trả"
        detail={
          deleteTarget
            ? `${deleteTarget.companyName} · MST ${deleteTarget.companyTaxCode || deleteTarget.companyTaxId || '—'} · Năm ${deleteTarget.taxYear || 2026}`
            : undefined
        }
        destructive
        primaryLabel="Xóa đơn vị"
        secondaryLabel="Giữ lại"
        onPrimary={handleConfirmDelete}
        onSecondary={() => setDeleteTarget(null)}
        onRequestClose={() => setDeleteTarget(null)}
      />

      <MainTabBar active="IncomeSourceList" />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  mainConstraint: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  yearlyContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  addHeaderBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewToggle: {
    flexDirection: 'row',
    marginHorizontal: 22,
    marginTop: 10,
    padding: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  viewToggleBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 9,
  },
  viewToggleBtnOn: {
    backgroundColor: theme.colors.primary,
  },
  viewToggleText: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  viewToggleTextOn: {
    color: '#FFFFFF',
  },
  pageLead: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    color: '#444444',
    paddingHorizontal: 22,
    paddingTop: 8,
  },
  voucherBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginHorizontal: 22,
    marginTop: 10,
  },
  voucherBtnText: {
    flexShrink: 1,
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    color: theme.colors.primary,
  },
  yearFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    marginTop: 14,
  },
  yearFilterLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginRight: 8,
  },
  yearFilterScroll: {
    gap: 8,
  },
  yearChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  yearChipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  yearChipText: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  yearChipTextSelected: {
    color: '#FFFFFF',
    fontFamily: fonts.bodyBold,
  },
  summaryCard: {
    marginHorizontal: 22,
    marginTop: 18,
    alignItems: 'center',
  },
  summaryTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    lineHeight: 16,
    color: '#5A4A22',
    textAlign: 'center',
  },
  summaryIncomeValue: {
    fontFamily: fonts.serifBold,
    fontSize: 32,
    lineHeight: 38,
    color: theme.colors.primaryDark,
    marginTop: 4,
    maxWidth: '100%',
    textAlign: 'center',
  },
  summaryTaxValue: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  summaryRule: {
    alignSelf: 'stretch',
    marginTop: 16,
  },
  searchContainer: {
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 8,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    minHeight: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    color: theme.colors.textPrimary,
    paddingVertical: 6,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.textSecondary,
    marginTop: 12,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 22,
    paddingBottom: 40,
  },
  card: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardMainInfo: {
    flex: 1,
    flexShrink: 1,
  },
  ledgerIndex: {
    width: 28,
    fontFamily: fonts.serifBold,
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.gold,
  },
  companyName: {
    fontFamily: fonts.bodySemi,
    fontSize: 16,
    lineHeight: 22,
    color: theme.colors.textPrimary,
  },
  companyMeta: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  statusActiveText: {
    color: '#3D5C3A',
  },
  statusInactiveText: {
    color: '#888888',
  },
  financialRow: {
    flexDirection: 'row',
    marginLeft: 28,
    marginTop: 6,
    gap: 12,
  },
  financialCol: {
    flex: 1,
    flexShrink: 1,
  },
  financialLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
    color: theme.colors.textSecondary,
    marginBottom: 2,
  },
  incomeValueText: {
    fontFamily: fonts.serifBold,
    fontSize: 16,
    lineHeight: 22,
    color: theme.colors.textPrimary,
  },
  taxValueText: {
    fontFamily: fonts.serifBold,
    fontSize: 16,
    lineHeight: 22,
    color: theme.colors.textPrimary,
  },
  metaValue: {
    marginLeft: 28,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
    color: '#8A8175',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 28,
    marginTop: 4,
    gap: 8,
  },
  actionBtn: {
    paddingVertical: 4,
  },
  actionBtnText: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.primary,
  },
  actionBtnDanger: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.error,
  },
  actionDivider: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: '#BBBBBB',
  },
  listHeaderBar: {
    paddingHorizontal: 22,
    paddingBottom: 8,
  },
  listHeaderTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 18,
    lineHeight: 24,
    color: theme.colors.textPrimary,
  },
  listHeaderSubtext: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    ...theme.typography.titleMedium,
    color: theme.colors.textPrimary,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    ...theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
  },
  emptyAddIcon: {
    marginRight: 6,
  },
  emptyAddBtnText: {
    ...theme.typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.borderRadius.lg,
    borderTopRightRadius: theme.borderRadius.lg,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    ...theme.typography.titleMedium,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    flexShrink: 1,
  },
  modalBody: {
    padding: theme.spacing.md,
  },
  modalInputGroup: {
    marginBottom: 14,
  },
  modalRowInputs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  halfInputCol: {
    flex: 1,
    minWidth: 132,
  },
  modalLabel: {
    ...theme.typography.bodySmall,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 6,
  },
  required: {
    color: theme.colors.error,
  },
  modalInput: {
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.body,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  inputError: {
    borderColor: theme.colors.error,
    backgroundColor: '#FFF8F8',
  },
  errorText: {
    ...theme.typography.caption,
    color: theme.colors.error,
    marginTop: 4,
  },
  taxHint: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginTop: 4,
    lineHeight: 16,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAF8F5',
    padding: 12,
    borderRadius: theme.borderRadius.md,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 10,
  },
  switchTextWrap: {
    flex: 1,
    flexShrink: 1,
  },
  switchLabel: {
    ...theme.typography.bodySmall,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  switchSubtext: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  systemInfoBox: {
    backgroundColor: '#F9F9F9',
    borderRadius: theme.borderRadius.sm,
    padding: 10,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    marginTop: 4,
    gap: 4,
  },
  systemInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  systemInfoLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginLeft: 4,
    marginRight: 6,
  },
  systemInfoValue: {
    ...theme.typography.caption,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    flexShrink: 1,
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  modalCancelText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  modalSaveBtn: {
    flex: 2,
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  modalSaveBtnDisabled: {
    opacity: 0.6,
  },
  modalSaveText: {
    ...theme.typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
