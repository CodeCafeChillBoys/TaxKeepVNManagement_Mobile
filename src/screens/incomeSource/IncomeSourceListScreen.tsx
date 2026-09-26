import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  Switch,
  Platform,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { DrumHeader } from '../../components/brand/DrumHeader';
import { GoldDoubleRule } from '../../components/brand/GoldDoubleRule';
import { MainTabBar } from '../../components/navigation/MainTabBar';
import {
  incomeSourceApi,
  IncomeSourceItem,
  IncomeSourceCreateDto,
  IncomeSourceUpdateDto,
  IncomeSourceSummaryDto,
  PaginationMeta,
} from '../../api/incomeSourceApi';
import { RootNavigationProp } from '../../navigation/types';

const TAX_YEAR_OPTIONS = [2026, 2025, 2024];

export const IncomeSourceListScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [sources, setSources] = useState<IncomeSourceItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Lọc theo năm tính thuế (mặc định năm hiện hành 2026, 0 = tất cả)
  const [selectedYearFilter, setSelectedYearFilter] = useState<number>(2026);
  const [summary, setSummary] = useState<IncomeSourceSummaryDto | null>(null);

  // Định dạng ngày giờ chuẩn Việt Nam (DD/MM/YYYY HH:mm)
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Chưa cập nhật';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // Định dạng số tiền VNĐ
  const formatCurrency = (val?: number) => {
    if (typeof val !== 'number' || isNaN(val)) return '0';
    return val.toLocaleString('vi-VN');
  };

  // Modal State cho Thêm / Sửa
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

  const fetchIncomeSources = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const queryParams: any = {};
        if (selectedYearFilter > 0) {
          queryParams.taxYear = selectedYearFilter;
        }

        // 1. Gọi API lấy danh sách nơi chi trả
        const data = await incomeSourceApi.getAll(queryParams);
        setSources(data.items || []);
        setPagination(data.pagination || null);

        // 2. Gọi API lấy bảng tổng hợp thu nhập năm (Summary endpoint mới của BE)
        const summaryYear = selectedYearFilter > 0 ? selectedYearFilter : 2026;
        const summaryData = await incomeSourceApi.getSummary(summaryYear);
        setSummary(summaryData);
      } catch (err: any) {
        const msg = err.response?.data?.message || 'Không thể tải danh sách nơi chi trả thu nhập.';
        Alert.alert('Lỗi', msg);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedYearFilter]
  );

  useEffect(() => {
    fetchIncomeSources();
  }, [fetchIncomeSources]);

  // Mở modal thêm mới
  const handleOpenCreateModal = () => {
    setEditingItem(null);
    setCompanyName('');
    setCompanyTaxCode('');
    setTaxYear(selectedYearFilter > 0 ? selectedYearFilter : 2026);
    setTotalIncome('');
    setTaxWithheld('');
    setIsActive(true);
    setFormErrors({});
    setModalVisible(true);
  };

  // Mở modal chỉnh sửa
  const handleOpenEditModal = (item: IncomeSourceItem) => {
    setEditingItem(item);
    setCompanyName(item.companyName);
    setCompanyTaxCode(item.companyTaxCode || item.companyTaxId || '');
    setTaxYear(item.taxYear || 2026);
    setTotalIncome(item.totalIncome ? String(item.totalIncome) : '0');
    setTaxWithheld(item.taxWithheld ? String(item.taxWithheld) : '0');
    setIsActive(item.isActive);
    setFormErrors({});
    setModalVisible(true);
  };

  // Đóng modal
  const handleCloseModal = () => {
    if (!submitting) {
      setModalVisible(false);
      setEditingItem(null);
      setFormErrors({});
    }
  };

  // Kiểm tra tính hợp lệ của Form
  const validateForm = (): boolean => {
    const errs: { [key: string]: string } = {};

    const cleanName = companyName.trim();
    if (!cleanName) {
      errs.companyName = 'Vui lòng nhập tên cơ quan / doanh nghiệp.';
    } else if (cleanName.length > 255) {
      errs.companyName = 'Tên cơ quan không được vượt quá 255 ký tự.';
    }

    const cleanTax = companyTaxCode.trim();
    if (!cleanTax) {
      errs.companyTaxCode = 'Vui lòng nhập mã số thuế tổ chức.';
    } else if (!/^\d{10}$|^\d{10}-\d{3}$/.test(cleanTax)) {
      errs.companyTaxCode =
        'Mã số thuế tổ chức phải gồm 10 chữ số (VD: 0100109107) hoặc 13 số có gạch ngang (VD: 0100109107-001).';
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

  // Gửi Form lưu thông tin
  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      setSubmitting(true);
      const cleanName = companyName.trim();
      const cleanTax = companyTaxCode.trim();
      const cleanYear = Number(taxYear) || 2026;
      const cleanIncome = Number(totalIncome.replace(/[^\d.]/g, '')) || 0;
      const cleanWithheld = Number(taxWithheld.replace(/[^\d.]/g, '')) || 0;

      if (editingItem) {
        // Cập nhật: gửi đầy đủ các field mới của BE
        const updatePayload: IncomeSourceUpdateDto = {
          companyName: cleanName,
          companyTaxCode: cleanTax,
          companyTaxId: cleanTax,
          taxYear: cleanYear,
          totalIncome: cleanIncome,
          taxWithheld: cleanWithheld,
          isActive: isActive,
        };
        await incomeSourceApi.update(editingItem.id, updatePayload);
      } else {
        // Thêm mới: gửi đầy đủ các field mới của BE
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

      setModalVisible(false);
      await fetchIncomeSources();

      const successMsg = editingItem
        ? 'Cập nhật nơi chi trả thu nhập thành công!'
        : 'Khai báo nơi chi trả thu nhập thành công!';

      if (Platform.OS === 'web') {
        window.alert(successMsg);
      } else {
        Alert.alert('Thành công', successMsg);
      }
    } catch (err: any) {
      const respMsg =
        err.response?.data?.message || 'Đã xảy ra lỗi khi lưu thông tin. Vui lòng kiểm tra lại MST.';
      Alert.alert('Lưu thất bại', respMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // Xóa nơi chi trả thu nhập
  const handleDelete = (item: IncomeSourceItem) => {
    const confirmDelete = async () => {
      try {
        setLoading(true);
        await incomeSourceApi.delete(item.id);
        await fetchIncomeSources();
        if (Platform.OS === 'web') {
          window.alert('Đã xóa nơi chi trả thu nhập.');
        } else {
          Alert.alert('Thành công', 'Đã xóa nơi chi trả thu nhập.');
        }
      } catch (err: any) {
        const msg = err.response?.data?.message || 'Không thể xóa nơi chi trả này.';
        Alert.alert('Lỗi', msg);
      } finally {
        setLoading(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Bạn có chắc muốn xóa "${item.companyName}" khỏi danh sách nơi chi trả?`)) {
        confirmDelete();
      }
    } else {
      Alert.alert(
        'Xác nhận xóa',
        `Bạn có chắc chắn muốn xóa "${item.companyName}" khỏi danh sách nơi chi trả thu nhập?`,
        [
          { text: 'Hủy', style: 'cancel' },
          { text: 'Xóa', style: 'destructive', onPress: confirmDelete },
        ]
      );
    }
  };

  // Lọc theo tìm kiếm
  const filteredSources = sources.filter((item) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase().trim();
    return (
      item.companyName.toLowerCase().includes(query) ||
      (item.companyTaxCode && item.companyTaxCode.toLowerCase().includes(query)) ||
      (item.companyTaxId && item.companyTaxId.toLowerCase().includes(query))
    );
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <DrumHeader
        title="Nơi chi trả"
        onBack={() => {
          if (navigation.canGoBack()) navigation.goBack();
          else navigation.navigate('Home');
        }}
        backTestID="backBtn"
        right={
          <TouchableOpacity
            style={styles.addHeaderBtn}
            onPress={handleOpenCreateModal}
            accessibilityRole="button"
            accessibilityLabel="Thêm nơi chi trả"
            testID="addIncomeSourceBtn"
          >
            <Ionicons name="add" size={26} color={theme.colors.primary} />
          </TouchableOpacity>
        }
      />

      <Text style={styles.pageLead}>
        Cơ quan chi trả lương, dùng khi đối soát và quyết toán thuế thu nhập cá nhân.
      </Text>

      {/* 2.1 Bộ chọn năm tính thuế (Tabs TaxYear) */}
      <View style={styles.yearFilterRow}>
        <Text style={styles.yearFilterLabel}>Năm tính thuế:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.yearFilterScroll}>
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

      {/* 2.2 Bảng tổng hợp thu nhập & thuế khấu trừ (Gọi từ GET /summary) */}
      {summary && (
        <View style={styles.summaryCard} testID="incomeSummaryCard">
          <Text style={styles.summaryTitle}>
            Thu nhập {selectedYearFilter > 0 ? `năm ${selectedYearFilter}` : 'năm 2026'}
          </Text>
          <Text style={styles.summaryIncomeValue}>{formatCurrency(summary.totalIncome)} đ</Text>
          <Text style={styles.summaryTaxValue}>
            Thuế đã khấu trừ {formatCurrency(summary.totalTaxWithheld)} đ ·{' '}
            {summary.totalSources || sources.length} nơi chi trả
          </Text>
          <GoldDoubleRule style={styles.summaryRule} />
        </View>
      )}

      {/* 3. Thanh tìm kiếm */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Tìm theo tên công ty hoặc mã số thuế..."
            placeholderTextColor={theme.colors.textPlaceholder}
            testID="incomeSourceSearchInput"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 3.1 Thống kê danh sách */}
      {!loading && sources.length > 0 && (
        <View style={styles.listHeaderBar}>
          <Text style={styles.listHeaderTitle}>Danh sách</Text>
          <Text style={styles.listHeaderSubtext}>
            {pagination ? pagination.totalItems : sources.length} đơn vị ·{' '}
            {sources.filter((s) => s.isActive).length} đang chi trả ·{' '}
            {sources.filter((s) => !s.isActive).length} đã dừng
          </Text>
        </View>
      )}

      {/* 4. Danh sách hoặc Trạng thái trống */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Đang tải danh sách nơi chi trả...</Text>
        </View>
      ) : (
        <FlatList
          style={styles.list}
          data={filteredSources}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
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
                  <Ionicons name="add" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.emptyAddBtnText}>Khai báo nơi chi trả đầu tiên</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          renderItem={({ item, index }) => (
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
                  <Text style={styles.incomeValueText}>{formatCurrency(item.totalIncome)} đ</Text>
                </View>
                <View style={styles.financialCol}>
                  <Text style={styles.financialLabel}>Thuế đã khấu trừ</Text>
                  <Text style={styles.taxValueText}>{formatCurrency(item.taxWithheld)} đ</Text>
                </View>
              </View>

              <Text style={styles.metaValue}>
                Khai báo {formatDate(item.createdAt)}
                {item.updatedAt && item.updatedAt !== item.createdAt
                  ? ` · Cập nhật ${formatDate(item.updatedAt)}`
                  : ''}
              </Text>

              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => handleOpenEditModal(item)}
                  testID={`editIncomeSourceBtn_${item.id}`}
                >
                  <Text style={styles.actionBtnText}>Sửa</Text>
                </TouchableOpacity>
                <Text style={styles.actionDivider}>·</Text>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => handleDelete(item)}
                  testID={`deleteIncomeSourceBtn_${item.id}`}
                >
                  <Text style={styles.actionBtnDanger}>Xóa</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* 5. Modal Khai báo / Chỉnh sửa */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingItem ? 'Chỉnh sửa nơi chi trả' : 'Khai báo nơi chi trả'}
              </Text>
              <TouchableOpacity onPress={handleCloseModal} disabled={submitting}>
                <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Tên cơ quan / tổ chức */}
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

              {/* Mã số thuế tổ chức */}
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
                  placeholder="Ví dụ: 0100109107"
                  placeholderTextColor={theme.colors.textPlaceholder}
                  keyboardType="number-pad"
                  maxLength={14}
                  testID="companyTaxCodeInput"
                />
                {formErrors.companyTaxCode ? (
                  <Text style={styles.errorText}>{formErrors.companyTaxCode}</Text>
                ) : null}
                <Text style={styles.taxHint}>
                  💡 MST gồm 10 chữ số (hoặc 13 số chi nhánh, VD: 0100109107).
                </Text>
              </View>

              {/* Năm tính thuế (taxYear) */}
              <View style={styles.modalInputGroup}>
                <Text style={styles.modalLabel}>
                  Năm tính thuế <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={[styles.modalInput, formErrors.taxYear && styles.inputError]}
                  value={String(taxYear)}
                  onChangeText={(val) => {
                    setTaxYear(Number(val) || 0);
                    if (formErrors.taxYear) setFormErrors((prev) => ({ ...prev, taxYear: '' }));
                  }}
                  placeholder="2026"
                  placeholderTextColor={theme.colors.textPlaceholder}
                  keyboardType="number-pad"
                  maxLength={4}
                  testID="taxYearInput"
                />
                {formErrors.taxYear ? (
                  <Text style={styles.errorText}>{formErrors.taxYear}</Text>
                ) : null}
              </View>

              {/* Cặp trường Tổng thu nhập và Thuế đã khấu trừ (totalIncome, taxWithheld) */}
              <View style={styles.modalRowInputs}>
                <View style={[styles.modalInputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.modalLabel}>Tổng thu nhập (VNĐ)</Text>
                  <TextInput
                    style={[styles.modalInput, formErrors.totalIncome && styles.inputError]}
                    value={totalIncome}
                    onChangeText={(val) => {
                      setTotalIncome(val);
                      if (formErrors.totalIncome) setFormErrors((prev) => ({ ...prev, totalIncome: '' }));
                    }}
                    placeholder="VD: 150000000"
                    placeholderTextColor={theme.colors.textPlaceholder}
                    keyboardType="numeric"
                    testID="totalIncomeInput"
                  />
                  {formErrors.totalIncome ? (
                    <Text style={styles.errorText}>{formErrors.totalIncome}</Text>
                  ) : null}
                </View>

                <View style={[styles.modalInputGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.modalLabel}>Thuế đã khấu trừ</Text>
                  <TextInput
                    style={[styles.modalInput, formErrors.taxWithheld && styles.inputError]}
                    value={taxWithheld}
                    onChangeText={(val) => {
                      setTaxWithheld(val);
                      if (formErrors.taxWithheld) setFormErrors((prev) => ({ ...prev, taxWithheld: '' }));
                    }}
                    placeholder="VD: 15000000"
                    placeholderTextColor={theme.colors.textPlaceholder}
                    keyboardType="numeric"
                    testID="taxWithheldInput"
                  />
                  {formErrors.taxWithheld ? (
                    <Text style={styles.errorText}>{formErrors.taxWithheld}</Text>
                  ) : null}
                </View>
              </View>

              {/* Trạng thái hoạt động (khi sửa) */}
              {editingItem && (
                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.switchLabel}>Đang nhận thu nhập từ đơn vị này</Text>
                    <Text style={styles.switchSubtext}>
                      {isActive ? 'Đơn vị đang tích cực chi trả tiền lương' : 'Đã dừng chi trả / chuyển công tác'}
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

              {/* Thông tin hệ thống / lịch sử từ API (khi xem/sửa) */}
              {editingItem && (
                <View style={styles.systemInfoBox}>
                  <View style={styles.systemInfoRow}>
                    <Ionicons name="finger-print-outline" size={13} color={theme.colors.textSecondary} />
                    <Text style={styles.systemInfoLabel}>Mã bản ghi (ID):</Text>
                    <Text style={styles.systemInfoValue} numberOfLines={1} ellipsizeMode="middle">
                      {editingItem.id}
                    </Text>
                  </View>
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

            {/* Cặp nút Modal */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={handleCloseModal}
                disabled={submitting}
              >
                <Text style={styles.modalCancelText}>Hủy</Text>
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
        </View>
      </Modal>
      <MainTabBar active="IncomeSourceList" />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerSide: {
    width: 40,
    height: 40,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...theme.typography.titleMedium,
    color: theme.colors.primary,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  addHeaderBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageLead: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    color: '#444444',
    paddingHorizontal: 22,
    paddingTop: 8,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDF7E7',
    borderWidth: 1,
    borderColor: '#E8DED1',
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  bannerIconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
    borderWidth: 1,
    borderColor: '#E8DED1',
  },
  bannerTextBox: {
    flex: 1,
  },
  bannerTitle: {
    ...theme.typography.bodyMedium,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  bannerDesc: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  yearFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    marginTop: 14,
  },
  yearFilterLabel: {
    fontSize: 13,
    fontWeight: '600',
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
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  yearChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  summaryCard: {
    marginHorizontal: 22,
    marginTop: 18,
    alignItems: 'center',
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F5EFE6',
    paddingBottom: 8,
    marginBottom: 8,
  },
  summaryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    lineHeight: 16,
    color: '#5A4A22',
  },
  summaryCount: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  summaryMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryMetricItem: {
    flex: 1,
  },
  summaryMetricLabel: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginBottom: 2,
  },
  summaryIncomeValue: {
    fontFamily: fonts.serifBold,
    fontSize: 32,
    lineHeight: 38,
    color: theme.colors.primaryDark,
    marginTop: 4,
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
  summaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E8DED1',
    marginHorizontal: 12,
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
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.textPrimary,
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
  companyAvatarBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#FAF5EE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#E8DED1',
  },
  cardMainInfo: {
    flex: 1,
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
  taxBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  taxBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF5EE',
    borderWidth: 1,
    borderColor: '#E8DED1',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  taxCodeText: {
    ...theme.typography.caption,
    fontWeight: '600',
    color: theme.colors.primary,
    marginLeft: 4,
  },
  yearBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 3,
  },
  yearBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1565C0',
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusActive: {
    backgroundColor: '#E8F5E9',
  },
  statusInactive: {
    backgroundColor: '#F5F5F5',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  financialRow: {
    flexDirection: 'row',
    marginLeft: 28,
    marginTop: 6,
    gap: 16,
  },
  financialCol: {
    flex: 1,
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
  financialDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E8DED1',
    marginHorizontal: 8,
  },
  cardMetaBox: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F5EFE6',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginLeft: 4,
    marginRight: 6,
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
    paddingHorizontal: theme.spacing.md,
    paddingBottom: 8,
  },
  listHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listHeaderTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 18,
    lineHeight: 24,
    color: theme.colors.textPrimary,
  },
  totalBadge: {
    backgroundColor: '#FAF5EE',
    borderWidth: 1,
    borderColor: '#E8DED1',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  totalBadgeText: {
    ...theme.typography.caption,
    fontWeight: '600',
    color: theme.colors.primary,
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
  emptyIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FAF5EE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E8DED1',
  },
  emptyTitle: {
    ...theme.typography.titleMedium,
    color: theme.colors.textPrimary,
    fontWeight: '700',
    marginBottom: 8,
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
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
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
  },
  modalBody: {
    padding: theme.spacing.md,
  },
  modalInputGroup: {
    marginBottom: 14,
  },
  modalRowInputs: {
    flexDirection: 'row',
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
  },
  systemInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
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
    flex: 1,
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
