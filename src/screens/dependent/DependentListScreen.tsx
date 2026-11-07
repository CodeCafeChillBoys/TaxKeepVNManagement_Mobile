import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Image,
  Platform,
  ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { DrumHeader } from '../../components/brand/DrumHeader';
import { GoldDoubleRule } from '../../components/brand/GoldDoubleRule';
import { useToast } from '../../components/ui/Toast';
import { formatPersonName } from '../../utils/formatPersonName';
import { sanitizeUiMessage, toFriendlyErrorMessage } from '../../utils/friendlyError';
import { RootNavigationProp } from '../../navigation/types';
import {
  dependentDocumentApi,
  DependentItem,
  getDocTypeLabel,
  getFullFileUrl,
  getGroupTitle,
} from '../../api/dependentDocumentApi';
import { dependentLifecycleApi } from '../../api/dependentLifecycleApi';
import {
  DocumentViewerModal,
  DocumentViewerItem,
} from '../../components/common/DocumentViewerModal';
import { ChangeGroupSheet } from '../../components/common/ChangeGroupSheet';
import { Dialog } from '../../components/common/Dialog';
import { MainTabBar } from '../../components/navigation/MainTabBar';
import { buildProofDocumentsParams } from './proofDocumentsParams';
import { ageAtEffectiveFrom } from './dependentEligibility';
import {
  buildManualChangeGroupPlan,
  runManualChangeGroup,
  type ManualChangeGroupPlan,
} from './manualChangeGroup';
import { buildSoftDeletePlan, runSoftDeleteDependent } from './softDeleteDependent';

const DEDUCTION_PER_DEPENDENT = 6200000;

const getRelationshipLabel = (rel?: string) => {
  switch (rel) {
    case 'CHILD':
      return 'Con';
    case 'SPOUSE':
      return 'Vợ / Chồng';
    case 'PARENT':
      return 'Cha / Mẹ';
    case 'OTHER_DEPENDENT':
      return 'Cá nhân khác';
    default:
      return 'Người phụ thuộc';
  }
};

const calculateAge = (birthDateStr?: string): number => {
  if (!birthDateStr) return 0;
  try {
    const birth = new Date(birthDateStr);
    if (isNaN(birth.getTime())) return 0;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return Math.max(0, age);
  } catch {
    return 0;
  }
};

const formatShortDate = (isoStr?: string): string => {
  if (!isoStr) return 'Chưa cập nhật';
  const raw = isoStr.split('T')[0];
  const parts = raw.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return raw;
};

interface DependentRowProps {
  dep: DependentItem;
  index: number;
  onPressDetail: (depId: string) => void;
  onPressMenu: (dep: DependentItem) => void;
  onPressProof: (dep: DependentItem) => void;
}

const DependentLedgerRow = React.memo<DependentRowProps>(
  ({ dep, index, onPressDetail, onPressMenu, onPressProof }) => {
    const age = calculateAge(dep.birthDate);
    const isAdult = age >= 14;
    const hasCitizenId = Boolean(dep.citizenId);
    const displayName = formatPersonName(dep.fullName);
    const idLabel = isAdult || hasCitizenId ? 'Căn cước' : 'Giấy khai sinh';
    const idValue = dep.citizenId || dep.birthCertNumber || 'Chưa cập nhật';

    return (
      <TouchableOpacity
        style={styles.ledgerRow}
        activeOpacity={0.88}
        onPress={() => onPressDetail(dep.id)}
        testID={`dependentCard_${dep.id}`}
      >
        <View style={styles.ledgerTop}>
          <Text style={styles.ledgerIndex}>{String(index + 1).padStart(2, '0')}</Text>
          <View style={styles.ledgerMain}>
            <Text style={styles.cardName}>{displayName}</Text>
            <Text style={styles.ledgerMeta}>
              {getRelationshipLabel(dep.relationship)} · {age} tuổi ·{' '}
              <Text style={dep.isProfileComplete ? styles.statusCompleteText : styles.statusPendingText}>
                {dep.isProfileComplete ? 'Đủ hồ sơ' : 'Chờ minh chứng'}
              </Text>
            </Text>
          </View>
          <TouchableOpacity
            style={styles.rowMenuBtn}
            onPress={() => onPressMenu(dep)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            testID={`dependentMenu_${dep.id}`}
            accessibilityRole="button"
            accessibilityLabel="Tuỳ chọn người phụ thuộc"
          >
            <Ionicons name="ellipsis-vertical" size={18} color="#666666" />
          </TouchableOpacity>
        </View>

        <Text style={styles.ledgerLine}>
          {idLabel} {idValue}
        </Text>
        <Text style={styles.ledgerLine} numberOfLines={2}>
          {dep.groupTitle}
          {dep.effectiveFromMonth || dep.effectiveToMonth
            ? ` · ${dep.effectiveFromMonth || '01/2026'} → ${dep.effectiveToMonth || '12/2026'}`
            : ''}
        </Text>

        <TouchableOpacity
          onPress={() => onPressProof(dep)}
          activeOpacity={0.8}
          testID={`btnProofDoc_${dep.id}`}
        >
          <Text style={styles.proofLink}>
            {dep.isProfileComplete ? 'Xem minh chứng' : 'Bổ sung minh chứng'}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }
);

export const DependentListScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const insets = useSafeAreaInsets();
  const { toast } = useToast();

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const [dependents, setDependents] = useState<DependentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [selectedDetail, setSelectedDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState<boolean>(false);
  const [previewDoc, setPreviewDoc] = useState<DocumentViewerItem | null>(null);
  const [changeGroupPlan, setChangeGroupPlan] = useState<ManualChangeGroupPlan | null>(null);
  const [changeGroupVisible, setChangeGroupVisible] = useState(false);
  const [changeGroupLoading, setChangeGroupLoading] = useState(false);
  const [reopenDetailAfterSheet, setReopenDetailAfterSheet] = useState(false);

  const [softDeleteTarget, setSoftDeleteTarget] = useState<{
    dependentId: string;
    fullName: string;
    confirmTitle: string;
    fromDetailModal: boolean;
  } | null>(null);

  const handleViewDetail = useCallback(
    async (depId: string) => {
      setIsDetailModalVisible(true);
      setDetailLoading(true);
      try {
        const detail = await dependentDocumentApi.getDependentById(depId);
        if (!isMountedRef.current) return;
        setSelectedDetail(detail);
      } catch (err: unknown) {
        if (!isMountedRef.current) return;
        setIsDetailModalVisible(false);
        toast.error(
          toFriendlyErrorMessage(err, 'Không thể tải thông tin chi tiết người phụ thuộc.'),
          'Chưa mở được hồ sơ'
        );
      } finally {
        if (isMountedRef.current) {
          setDetailLoading(false);
        }
      }
    },
    [toast]
  );

  const fetchDependents = useCallback(async () => {
    try {
      const data = await dependentDocumentApi.getDependents();
      if (!isMountedRef.current) return;
      setDependents(data);
    } catch (err: unknown) {
      if (__DEV__) {
        console.warn('fetchDependents error:', err);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchDependents();
    }, [fetchDependents])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDependents();
  }, [fetchDependents]);

  const handleGoToProofDocuments = useCallback(
    (dep: DependentItem) => {
      navigation.navigate('ProofDocuments', buildProofDocumentsParams(dep));
    },
    [navigation]
  );

  const handleChangeGroup = (detail: {
    dependentId: string;
    fullName: string;
    relationship: string;
    currentGroup: string;
    birthDate?: string;
    effectiveFromMonth?: string;
  }) => {
    let ageAtEffective: number | undefined;
    if (detail.birthDate) {
      const iso = detail.birthDate.slice(0, 10);
      const parts = iso.split('-');
      if (parts.length === 3) {
        const now = new Date();
        const asOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        ageAtEffective = ageAtEffectiveFrom(parts[2], parts[1], parts[0], asOfMonth);
      }
    }
    const plan = buildManualChangeGroupPlan({
      dependentId: detail.dependentId,
      fullName: detail.fullName,
      relationship: detail.relationship || 'CHILD',
      currentGroup: detail.currentGroup,
      ageAtEffective,
    });
    if (!plan.canChange) {
      toast.warning(
        'Không còn nhóm điều kiện khác phù hợp với mối quan hệ và độ tuổi hiện tại.',
        'Chưa thể đổi nhóm'
      );
      return;
    }
    setReopenDetailAfterSheet(isDetailModalVisible);
    setIsDetailModalVisible(false);
    setChangeGroupPlan(plan);
    setChangeGroupVisible(true);
  };

  const handleSelectChangeGroup = async (newGroup: string) => {
    if (!changeGroupPlan || changeGroupLoading) return;
    setChangeGroupLoading(true);
    try {
      const result = await runManualChangeGroup({
        dependentId: changeGroupPlan.dependentId,
        newGroup,
        updateDependentGroup: dependentLifecycleApi.updateDependentGroup,
      });
      if (!isMountedRef.current) return;
      if (!result.ok) {
        toast.error(
          sanitizeUiMessage(result.message, 'Không thể chuyển nhóm điều kiện lúc này.'),
          'Chưa chuyển được nhóm'
        );
        return;
      }
      setChangeGroupVisible(false);
      setChangeGroupPlan(null);
      setReopenDetailAfterSheet(false);
      setSelectedDetail(null);
      toast.success('Đã cập nhật nhóm điều kiện. Vui lòng bổ sung giấy tờ minh chứng tương ứng.', 'Đã đổi nhóm điều kiện');
      navigation.navigate(result.navigation.screen, result.navigation.params);
    } finally {
      if (isMountedRef.current) {
        setChangeGroupLoading(false);
      }
    }
  };

  const executeSoftDelete = async () => {
    const target = softDeleteTarget;
    if (!target) return;
    setSoftDeleteTarget(null);
    const result = await runSoftDeleteDependent({
      dependentId: target.dependentId,
      deleteDependent: dependentLifecycleApi.deleteDependent,
    });
    if (!isMountedRef.current) return;
    if (!result.ok) {
      toast.error(
        sanitizeUiMessage(result.message, 'Không thể ngừng tính giảm trừ cho người phụ thuộc này.'),
        'Chưa thể thực hiện'
      );
      if (target.fromDetailModal && selectedDetail) {
        setIsDetailModalVisible(true);
      }
      return;
    }
    setSelectedDetail(null);
    toast.success(
      sanitizeUiMessage(result.toastMessage, 'Đã ngừng tính giảm trừ người phụ thuộc.'),
      'Đã cập nhật danh sách'
    );
    await fetchDependents();
  };

  const requestSoftDelete = useCallback(
    (dependentId: string, fullName: string, fromDetailModal = false) => {
      const plan = buildSoftDeletePlan({ dependentId, fullName });
      if (fromDetailModal) {
        setIsDetailModalVisible(false);
      }
      setSoftDeleteTarget({
        dependentId,
        fullName,
        confirmTitle: plan.confirmTitle,
        fromDetailModal,
      });
    },
    []
  );

  const handleRowMenu = useCallback(
    (dep: DependentItem) => {
      requestSoftDelete(dep.id, dep.fullName, false);
    },
    [requestSoftDelete]
  );

  const keyExtractor = useCallback((item: DependentItem) => item.id, []);

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<DependentItem>) => (
      <DependentLedgerRow
        dep={item}
        index={index}
        onPressDetail={handleViewDetail}
        onPressMenu={handleRowMenu}
        onPressProof={handleGoToProofDocuments}
      />
    ),
    [handleViewDetail, handleRowMenu, handleGoToProofDocuments]
  );

  const listHeader = useMemo(
    () => (
      <View>
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>Giảm trừ mỗi tháng</Text>
          <Text
            style={styles.heroAmount}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.68}
          >
            {(dependents.length * DEDUCTION_PER_DEPENDENT).toLocaleString('vi-VN')} đ
          </Text>
          <Text style={styles.heroMeta}>
            {dependents.length} người · 6,2 triệu đồng/người · NQ 110/2025/UBTVQH15
          </Text>
        </View>
        <GoldDoubleRule style={styles.heroRule} />

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Hồ sơ đã khai báo ({dependents.length})</Text>
          <TouchableOpacity
            style={styles.addNewInlineBtn}
            onPress={() => navigation.navigate('TaxRegistration')}
            testID="btnAddNewDependentInline"
          >
            <Text style={styles.addNewInlineBtnText}>Khai báo mới</Text>
          </TouchableOpacity>
        </View>
      </View>
    ),
    [dependents.length, navigation]
  );

  const listEmpty = useMemo(
    () =>
      loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Đang tải danh sách người phụ thuộc...</Text>
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Chưa có người phụ thuộc</Text>
          <Text style={styles.emptySubtitle}>
            Bạn chưa đăng ký người phụ thuộc nào để hưởng mức giảm trừ gia cảnh 6.200.000 VNĐ/tháng (theo Nghị quyết
            110/2025/UBTVQH15 áp dụng từ năm 2026).
          </Text>
          <TouchableOpacity
            style={styles.emptyAddBtn}
            onPress={() => navigation.navigate('TaxRegistration')}
            testID="btnEmptyAddDependent"
          >
            <Ionicons name="person-add-outline" size={18} color="#FFFFFF" style={styles.emptyAddIcon} />
            <Text style={styles.emptyAddBtnText}>Đăng ký người phụ thuộc ngay</Text>
          </TouchableOpacity>
        </View>
      ),
    [loading, navigation]
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <DrumHeader
        title="Người phụ thuộc"
        onBack={() => {
          if (navigation.canGoBack()) navigation.goBack();
          else navigation.navigate('Home');
        }}
        backTestID="dependentListBackBtn"
        right={
          <TouchableOpacity
            style={styles.addHeaderBtn}
            onPress={() => navigation.navigate('TaxRegistration')}
            accessibilityRole="button"
            accessibilityLabel="Thêm người phụ thuộc"
            testID="btnAddDependentHeader"
          >
            <Ionicons name="person-add" size={22} color={theme.colors.primary} />
          </TouchableOpacity>
        }
      />

      <FlatList
        style={styles.list}
        data={loading ? [] : dependents}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
          />
        }
      />

      {/* Modal Xem chi tiết người phụ thuộc */}
      <Modal
        visible={isDetailModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsDetailModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsDetailModalVisible(false)}
        >
          <View
            style={[styles.detailModalSheet, { paddingBottom: Math.max(insets.bottom, 12) }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.detailModalHandle} />

            {detailLoading ? (
              <View style={styles.modalLoadingBox}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.modalLoadingText}>Đang tải chi tiết hồ sơ người phụ thuộc...</Text>
              </View>
            ) : selectedDetail ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.detailHeaderRow}>
                  <View style={styles.detailHeaderMain}>
                    <Text style={styles.detailModalTitle}>{formatPersonName(selectedDetail.fullName)}</Text>
                    <Text style={styles.detailModalSubtitle}>
                      {getRelationshipLabel(selectedDetail.relationship)} • {getGroupTitle(selectedDetail.currentGroup)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.closeDetailBtn}
                    onPress={() => setIsDetailModalVisible(false)}
                    accessibilityRole="button"
                    accessibilityLabel="Đóng chi tiết"
                  >
                    <Ionicons name="close" size={24} color="#555555" />
                  </TouchableOpacity>
                </View>

                <View
                  style={[
                    styles.detailStatusBox,
                    selectedDetail.isProfileComplete ? styles.statusBoxComplete : styles.statusBoxPending,
                  ]}
                >
                  <Ionicons
                    name={selectedDetail.isProfileComplete ? 'checkmark-circle' : 'alert-circle'}
                    size={20}
                    color={selectedDetail.isProfileComplete ? '#2E7D32' : '#E65100'}
                    style={styles.statusIcon}
                  />
                  <Text
                    style={[
                      styles.detailStatusText,
                      selectedDetail.isProfileComplete ? styles.statusTextComplete : styles.statusTextPending,
                    ]}
                  >
                    {selectedDetail.isProfileComplete
                      ? 'Hồ sơ đã đầy đủ minh chứng hợp lệ'
                      : 'Hồ sơ đang chờ bổ sung ảnh minh chứng'}
                  </Text>
                </View>

                <View style={styles.detailCardSection}>
                  <Text style={styles.detailSectionHeading}>THÔNG TIN CÁ NHÂN</Text>

                  <View style={styles.modalDetailRow}>
                    <Text style={styles.modalDetailLabel}>Ngày sinh:</Text>
                    <Text style={styles.modalDetailVal}>
                      {formatShortDate(selectedDetail.birthDate)} ({calculateAge(selectedDetail.birthDate)} tuổi)
                    </Text>
                  </View>

                  <View style={styles.modalDetailRow}>
                    <Text style={styles.modalDetailLabel}>
                      {calculateAge(selectedDetail.birthDate) >= 14 || selectedDetail.citizenId
                        ? 'Căn cước công dân:'
                        : 'Số Giấy khai sinh:'}
                    </Text>
                    <Text style={[styles.modalDetailVal, styles.monospace]}>
                      {selectedDetail.citizenId || selectedDetail.birthCertNumber || 'Chưa cập nhật'}
                    </Text>
                  </View>

                  {selectedDetail.taxIdNumber ? (
                    <View style={styles.modalDetailRow}>
                      <Text style={styles.modalDetailLabel}>Mã số thuế NPT:</Text>
                      <Text style={[styles.modalDetailVal, styles.monospace]}>{selectedDetail.taxIdNumber}</Text>
                    </View>
                  ) : null}

                  <View style={styles.modalDetailRow}>
                    <Text style={styles.modalDetailLabel}>Thời gian hiệu lực:</Text>
                    <Text style={styles.modalDetailVal}>
                      {selectedDetail.effectiveFromMonth || '01/2026'} → {selectedDetail.effectiveToMonth || '12/2026'}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailCardSection}>
                  <Text style={styles.detailSectionHeading}>
                    GIẤY TỜ MINH CHỨNG ĐÃ LƯU ({selectedDetail.documents?.length || 0})
                  </Text>

                  {selectedDetail.documents && selectedDetail.documents.length > 0 ? (
                    selectedDetail.documents.map((doc: any, index: number) => {
                      const fullUrl = getFullFileUrl(doc.fileUrl);
                      const isImg =
                        doc.fileMimeType?.includes('image') ||
                        fullUrl.match(/\.(png|jpe?g|webp|gif)(\?|$)/i) != null ||
                        !fullUrl.match(/\.pdf(\?|$)/i);
                      const docLabel = getDocTypeLabel(doc.docType);
                      const fileName = fullUrl.split('/').pop()?.split('?')[0] || docLabel;

                      const handleDocPress = () => {
                        setIsDetailModalVisible(false);
                        setPreviewDoc({
                          uri: fullUrl,
                          title: docLabel,
                          docType: doc.docType,
                          fileName,
                          uploadedAt: doc.uploadedAt,
                          isReadable: doc.isReadable,
                          mimeType: doc.fileMimeType || (isImg ? 'image/jpeg' : 'application/pdf'),
                        });
                      };

                      return (
                        <TouchableOpacity
                          key={doc.docId || index}
                          style={styles.docItemCard}
                          activeOpacity={0.8}
                          onPress={handleDocPress}
                          accessibilityRole="button"
                          accessibilityLabel={`Xem tài liệu ${docLabel}`}
                        >
                          {isImg && fullUrl ? (
                            <View style={styles.docThumbContainer}>
                              <Image
                                source={{ uri: fullUrl }}
                                style={styles.docItemThumb}
                                resizeMode="cover"
                              />
                              <View style={styles.docThumbOverlay}>
                                <Ionicons name="search-outline" size={12} color="#FFFFFF" />
                              </View>
                            </View>
                          ) : (
                            <View style={styles.docPdfBadge}>
                              <Ionicons name="document-text" size={24} color="#D32F2F" />
                            </View>
                          )}

                          <View style={styles.docInfoCol}>
                            <Text style={styles.docItemName} numberOfLines={1}>
                              {docLabel}
                            </Text>
                            <Text style={styles.docFileName} numberOfLines={1}>
                              {fileName}
                            </Text>
                            <Text style={styles.docItemDate}>
                              Ngày nộp: {formatShortDate(doc.uploadedAt)} •{' '}
                              <Text style={doc.isReadable ? styles.validStatusText : styles.pendingStatusText}>
                                {doc.isReadable ? '✓ Hợp lệ' : 'Đang kiểm tra'}
                              </Text>
                            </Text>
                          </View>

                          <TouchableOpacity
                            style={styles.viewDocActionBtn}
                            onPress={handleDocPress}
                            accessibilityRole="button"
                            accessibilityLabel="Xem ảnh"
                          >
                            <Ionicons name="eye-outline" size={15} color={theme.colors.primary} />
                            <Text style={styles.viewDocActionText}>Xem</Text>
                          </TouchableOpacity>
                        </TouchableOpacity>
                      );
                    })
                  ) : (
                    <View style={styles.emptyDocBox}>
                      <Ionicons name="folder-open-outline" size={32} color="#999999" style={styles.emptyDocIcon} />
                      <Text style={styles.emptyDocText}>Chưa có giấy tờ minh chứng nào được tải lên.</Text>
                    </View>
                  )}
                </View>

                <View style={styles.modalActionRow}>
                  <TouchableOpacity
                    style={styles.modalSecondaryBtn}
                    onPress={() =>
                      handleChangeGroup({
                        dependentId: selectedDetail.dependentId,
                        fullName: selectedDetail.fullName,
                        relationship: selectedDetail.relationship,
                        currentGroup: selectedDetail.currentGroup,
                        birthDate: selectedDetail.birthDate,
                        effectiveFromMonth: selectedDetail.effectiveFromMonth,
                      })
                    }
                    testID="btnChangeDependentGroup"
                  >
                    <Ionicons
                      name="swap-horizontal-outline"
                      size={18}
                      color={theme.colors.primary}
                      style={styles.btnIcon}
                    />
                    <Text style={styles.modalSecondaryBtnText}>Đổi nhóm điều kiện</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalDangerBtn}
                    onPress={() =>
                      requestSoftDelete(selectedDetail.dependentId, selectedDetail.fullName, true)
                    }
                    testID="btnSoftDeleteDependent"
                  >
                    <Ionicons
                      name="trash-outline"
                      size={18}
                      color={theme.colors.error}
                      style={styles.btnIcon}
                    />
                    <Text style={styles.modalDangerBtnText}>Vô hiệu hóa</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalGoProofBtn}
                    onPress={() => {
                      setIsDetailModalVisible(false);
                      handleGoToProofDocuments({
                        id: selectedDetail.dependentId,
                        fullName: selectedDetail.fullName,
                        birthDate: selectedDetail.birthDate,
                        currentGroup: selectedDetail.currentGroup,
                        groupTitle: getGroupTitle(selectedDetail.currentGroup),
                        isProfileComplete: selectedDetail.isProfileComplete,
                        requiredDocs: selectedDetail.requiredDocuments || [],
                        citizenId: selectedDetail.citizenId,
                        birthCertNumber: selectedDetail.birthCertNumber,
                        relationship: selectedDetail.relationship,
                        effectiveFromMonth: selectedDetail.effectiveFromMonth,
                        effectiveToMonth: selectedDetail.effectiveToMonth,
                        status: selectedDetail.status,
                      });
                    }}
                  >
                    <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" style={styles.btnIcon} />
                    <Text style={styles.modalGoProofBtnText}>
                      {selectedDetail.isProfileComplete ? 'Xem / Cập nhật minh chứng' : 'Bổ sung ảnh minh chứng ngay'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.modalBottomSpacer} />
              </ScrollView>
            ) : null}
          </View>
        </TouchableOpacity>
      </Modal>

      <DocumentViewerModal
        visible={!!previewDoc}
        onClose={() => {
          setPreviewDoc(null);
          if (selectedDetail) {
            setIsDetailModalVisible(true);
          }
        }}
        document={previewDoc}
      />

      <ChangeGroupSheet
        visible={changeGroupVisible && !!changeGroupPlan}
        fullName={changeGroupPlan?.fullName ?? ''}
        currentGroup={changeGroupPlan?.currentGroup ?? ''}
        options={changeGroupPlan?.options ?? []}
        loading={changeGroupLoading}
        onSelect={(code) => {
          void handleSelectChangeGroup(code);
        }}
        onCancel={() => {
          if (changeGroupLoading) return;
          setChangeGroupVisible(false);
          setChangeGroupPlan(null);
          if (reopenDetailAfterSheet && selectedDetail) {
            setReopenDetailAfterSheet(false);
            setIsDetailModalVisible(true);
          }
        }}
      />

      <Dialog
        visible={!isDetailModalVisible && !!softDeleteTarget}
        title={softDeleteTarget?.confirmTitle ?? 'Vô hiệu hóa người phụ thuộc'}
        message="Người phụ thuộc này sẽ ngừng được tính giảm trừ gia cảnh và ẩn khỏi danh sách hiện hành."
        detailLabel="Người phụ thuộc"
        detail={softDeleteTarget ? formatPersonName(softDeleteTarget.fullName) : undefined}
        destructive
        primaryLabel="Vô hiệu hóa"
        secondaryLabel="Giữ lại"
        onPrimary={executeSoftDelete}
        onSecondary={() => {
          const reopen = softDeleteTarget?.fromDetailModal;
          setSoftDeleteTarget(null);
          if (reopen && selectedDetail) {
            setIsDetailModalVisible(true);
          }
        }}
        onRequestClose={() => {
          const reopen = softDeleteTarget?.fromDetailModal;
          setSoftDeleteTarget(null);
          if (reopen && selectedDetail) {
            setIsDetailModalVisible(true);
          }
        }}
      />

      <MainTabBar active="DependentList" />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  addHeaderBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 22,
    paddingTop: 6,
    paddingBottom: 56,
  },
  hero: {
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 16,
  },
  heroLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    lineHeight: 16,
    color: '#5A4A22',
  },
  heroAmount: {
    fontFamily: fonts.serifBold,
    fontSize: 32,
    lineHeight: 38,
    color: theme.colors.primaryDark,
    marginTop: 4,
    maxWidth: '100%',
    textAlign: 'center',
  },
  heroMeta: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  heroRule: {
    marginBottom: 16,
  },
  ledgerRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: 4,
  },
  ledgerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  ledgerIndex: {
    width: 28,
    fontFamily: fonts.serifBold,
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.gold,
  },
  ledgerMain: {
    flex: 1,
    flexShrink: 1,
  },
  cardName: {
    fontFamily: fonts.bodySemi,
    fontSize: 16,
    lineHeight: 22,
    color: theme.colors.textPrimary,
  },
  ledgerMeta: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  statusCompleteText: {
    color: '#3D5C3A',
  },
  statusPendingText: {
    color: theme.colors.primary,
  },
  ledgerLine: {
    marginLeft: 38,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: '#444444',
  },
  proofLink: {
    marginLeft: 38,
    marginTop: 6,
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.primary,
  },
  rowMenuBtn: {
    padding: 6,
    marginLeft: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 18,
    lineHeight: 24,
    color: theme.colors.textPrimary,
    flexShrink: 1,
  },
  addNewInlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  addNewInlineBtnText: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    color: theme.colors.primary,
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    gap: 12,
  },
  loadingText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: 26,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginTop: 10,
  },
  emptyTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 17,
    color: theme.colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    ...theme.shadows.button,
  },
  emptyAddIcon: {
    marginRight: 6,
  },
  emptyAddBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: '#FFFFFF',
    flexShrink: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  detailModalSheet: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '88%',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  detailModalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DDDDDD',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalLoadingBox: {
    paddingVertical: 50,
    alignItems: 'center',
  },
  modalLoadingText: {
    marginTop: 12,
    fontFamily: fonts.body,
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  detailHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 10,
  },
  detailHeaderMain: {
    flex: 1,
    flexShrink: 1,
  },
  detailModalTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 20,
    color: '#1A1A1A',
  },
  detailModalSubtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: '#666666',
    marginTop: 3,
  },
  closeDetailBtn: {
    padding: 4,
  },
  detailStatusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    marginBottom: 16,
  },
  statusIcon: {
    marginRight: 8,
  },
  statusBoxComplete: {
    backgroundColor: '#E8F5E9',
  },
  statusBoxPending: {
    backgroundColor: '#FFF3E0',
  },
  detailStatusText: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    flex: 1,
  },
  statusTextComplete: {
    color: '#2E7D32',
  },
  statusTextPending: {
    color: '#E65100',
  },
  detailCardSection: {
    backgroundColor: '#F9F7F2',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#EFEAE0',
  },
  detailSectionHeading: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: '#8B1E1E',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  modalDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EBE0',
  },
  modalDetailLabel: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: '#666666',
    flexShrink: 0,
  },
  modalDetailVal: {
    flex: 1,
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    color: '#1A1A1A',
    textAlign: 'right',
  },
  monospace: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.4,
  },
  docItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E8E2D6',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)' }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 2,
          elevation: 1,
        }),
  },
  docThumbContainer: {
    width: 52,
    height: 52,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F0EAE1',
    position: 'relative',
  },
  docItemThumb: {
    width: '100%',
    height: '100%',
  },
  docThumbOverlay: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 8,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docPdfBadge: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: '#FFEBEE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docInfoCol: {
    flex: 1,
    paddingHorizontal: 10,
  },
  docItemName: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    color: '#1A1A1A',
  },
  docFileName: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#666666',
    marginTop: 1,
  },
  docItemDate: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#888888',
    marginTop: 2,
  },
  validStatusText: {
    color: '#2E7D32',
    fontFamily: fonts.bodySemi,
  },
  pendingStatusText: {
    color: '#E65100',
    fontFamily: fonts.bodySemi,
  },
  viewDocActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF0E8',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  viewDocActionText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: theme.colors.primary,
  },
  emptyDocBox: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  emptyDocIcon: {
    marginBottom: 6,
  },
  emptyDocText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: '#888888',
    textAlign: 'center',
  },
  modalActionRow: {
    marginTop: 6,
  },
  btnIcon: {
    marginRight: 6,
  },
  modalGoProofBtn: {
    backgroundColor: theme.colors.primaryDark,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  modalGoProofBtnText: {
    color: '#FFFFFF',
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    flexShrink: 1,
    textAlign: 'center',
  },
  modalSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
  },
  modalSecondaryBtnText: {
    color: theme.colors.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    flexShrink: 1,
  },
  modalDangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: theme.colors.error,
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
  },
  modalDangerBtnText: {
    color: theme.colors.error,
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    flexShrink: 1,
  },
  modalBottomSpacer: {
    height: 16,
  },
});
