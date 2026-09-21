import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { RootNavigationProp } from '../../navigation/types';
import {
  dependentDocumentApi,
  DependentItem,
  getDocTypeLabel,
  getGroupTitle,
} from '../../api/dependentDocumentApi';
import { dependentLifecycleApi } from '../../api/dependentLifecycleApi';
import {
  DocumentViewerModal,
  DocumentViewerItem,
} from '../../components/common/DocumentViewerModal';
import { ChangeGroupSheet } from '../../components/common/ChangeGroupSheet';
import { Dialog } from '../../components/common/Dialog';
import { groupCodeToIndex } from './dependentGroupUtils';
import {
  buildManualChangeGroupPlan,
  runManualChangeGroup,
  type ManualChangeGroupPlan,
} from './manualChangeGroup';
import { buildSoftDeletePlan, runSoftDeleteDependent } from './softDeleteDependent';

// Mức giảm trừ gia cảnh cho mỗi người phụ thuộc theo Nghị quyết 110/2025/UBTVQH15 (áp dụng từ 01/01/2026)
const DEDUCTION_PER_DEPENDENT = 6200000; // 6.200.000 VNĐ/tháng

export const DependentListScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
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
  const [infoDialog, setInfoDialog] = useState<{
    title: string;
    message: string;
  } | null>(null);

  const handleViewDetail = async (depId: string) => {
    setIsDetailModalVisible(true);
    setDetailLoading(true);
    try {
      const detail = await dependentDocumentApi.getDependentById(depId);
      setSelectedDetail(detail);
    } catch (err: any) {
      Alert.alert('Lỗi lấy chi tiết', err?.message || 'Không thể xem chi tiết người phụ thuộc.');
      setIsDetailModalVisible(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const fetchDependents = useCallback(async () => {
    try {
      const data = await dependentDocumentApi.getDependents();
      setDependents(data);
    } catch (err: any) {
      console.warn('fetchDependents error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchDependents();
    }, [fetchDependents])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDependents();
  };

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

  const getGroupIndex = (currentGroup?: string): number => groupCodeToIndex(currentGroup);

  const handleGoToProofDocuments = (dep: DependentItem) => {
    const groupIdx = getGroupIndex(dep.currentGroup);
    navigation.navigate('ProofDocuments', {
      groupIndex: groupIdx,
      dependentId: dep.id,
      dependentData: {
        fullName: dep.fullName,
        citizenId: dep.citizenId || '',
        birthCertNumber: dep.birthCertNumber || '',
        dateOfBirth: dep.birthDate,
        relationship: dep.relationship || 'CHILD',
        effectiveFromMonth: dep.effectiveFromMonth || '2026-01',
        effectiveToMonth: dep.effectiveToMonth || '2026-12',
        groupId: groupIdx + 1,
        groupCode: dep.currentGroup,
      },
    });
  };

  const navigateAfterGroupChange = (nav: {
    screen: 'ProofDocuments';
    params: {
      dependentId: string;
      groupIndex: number;
      requiredDocuments?: string[];
    };
  }) => {
    navigation.navigate(nav.screen, nav.params);
  };

  const handleChangeGroup = (detail: {
    dependentId: string;
    fullName: string;
    relationship: string;
    currentGroup: string;
  }) => {
    const plan = buildManualChangeGroupPlan({
      dependentId: detail.dependentId,
      fullName: detail.fullName,
      relationship: detail.relationship || 'CHILD',
      currentGroup: detail.currentGroup,
    });
    if (!plan.canChange) {
      setInfoDialog({
        title: 'Không thể đổi nhóm',
        message: 'Không còn nhóm điều kiện khác phù hợp với quan hệ hiện tại.',
      });
      return;
    }
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
      if (!result.ok) {
        setInfoDialog({ title: 'Không thể chuyển nhóm', message: result.message });
        return;
      }
      setChangeGroupVisible(false);
      setChangeGroupPlan(null);
      setIsDetailModalVisible(false);
      navigateAfterGroupChange(result.navigation);
    } finally {
      setChangeGroupLoading(false);
    }
  };

  const executeSoftDelete = async (dependentId: string, reason?: string) => {
    const result = await runSoftDeleteDependent({
      dependentId,
      reason,
      deleteDependent: dependentLifecycleApi.deleteDependent,
    });
    if (!result.ok) {
      Alert.alert('Không thể vô hiệu hóa', result.message);
      return;
    }
    setIsDetailModalVisible(false);
    setSelectedDetail(null);
    Alert.alert('Thành công', result.toastMessage);
    await fetchDependents();
  };

  const handleSoftDelete = (dependentId: string, fullName: string) => {
    const plan = buildSoftDeletePlan({ dependentId, fullName });
    if (Platform.OS === 'ios') {
      Alert.prompt(
        plan.confirmTitle,
        `${plan.confirmMessage}\n\nLý do (tuỳ chọn):`,
        [
          { text: 'Hủy', style: 'cancel' },
          {
            text: 'Vô hiệu hóa',
            style: 'destructive',
            onPress: (reason?: string) => {
              void executeSoftDelete(dependentId, reason);
            },
          },
        ]
      );
      return;
    }
    Alert.alert(plan.confirmTitle, plan.confirmMessage, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Vô hiệu hóa',
        style: 'destructive',
        onPress: () => {
          void executeSoftDelete(dependentId);
        },
      },
    ]);
  };

  const handleRowMenu = (dep: DependentItem) => {
    Alert.alert(dep.fullName, undefined, [
      {
        text: 'Vô hiệu hóa',
        style: 'destructive',
        onPress: () => handleSoftDelete(dep.id, dep.fullName),
      },
      { text: 'Hủy', style: 'cancel' },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header chuẩn màu sắc thương hiệu */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
          testID="dependentListBackBtn"
        >
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Danh sách người phụ thuộc
        </Text>
        <TouchableOpacity
          style={styles.addHeaderBtn}
          onPress={() => navigation.navigate('TaxRegistration')}
          accessibilityRole="button"
          accessibilityLabel="Thêm người phụ thuộc"
          testID="btnAddDependentHeader"
        >
          <Ionicons name="person-add" size={20} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
          />
        }
      >
        {/* Banner Tổng quan Giảm trừ gia cảnh theo Nghị quyết 110/2025/UBTVQH15 */}
        <View style={styles.summaryBanner}>
          <View style={styles.summaryTextCol}>
            <Text style={styles.summaryLabel}>GIẢM TRỪ GIA CẢNH NPT</Text>
            <Text style={styles.summaryCount}>
              {dependents.length}{' '}
              <Text style={styles.summaryCountUnit}>người phụ thuộc</Text>
            </Text>
            <Text style={styles.summaryDeductionAmount}>
              Ước tính:{' '}
              <Text style={styles.summaryHighlight}>
                {(dependents.length * DEDUCTION_PER_DEPENDENT).toLocaleString('vi-VN')} đ/tháng
              </Text>
            </Text>
            <Text style={styles.summaryLawSubtext}>
              (6,2 tr đ/tháng/người - NQ 110/2025/UBTVQH15)
            </Text>
          </View>
          <View style={styles.summaryIconBox}>
            <Ionicons name="people" size={32} color={theme.colors.gold} />
          </View>
        </View>

        {/* Tiêu đề danh sách & nút Đăng ký */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Hồ sơ đã khai báo ({dependents.length})</Text>
          <TouchableOpacity
            style={styles.addNewInlineBtn}
            onPress={() => navigation.navigate('TaxRegistration')}
            testID="btnAddNewDependentInline"
          >
            <Ionicons name="add-circle" size={16} color={theme.colors.primary} />
            <Text style={styles.addNewInlineBtnText}>Khai báo mới</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Đang tải danh sách người phụ thuộc...</Text>
          </View>
        ) : dependents.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="people-outline" size={48} color={theme.colors.textPlaceholder} />
            </View>
            <Text style={styles.emptyTitle}>Chưa có người phụ thuộc</Text>
            <Text style={styles.emptySubtitle}>
              Bạn chưa đăng ký người phụ thuộc nào để được hưởng mức giảm trừ gia cảnh 6.200.000 VNĐ/tháng (theo Nghị quyết 110/2025/UBTVQH15 áp dụng từ năm 2026).
            </Text>
            <TouchableOpacity
              style={styles.emptyAddBtn}
              onPress={() => navigation.navigate('TaxRegistration')}
              testID="btnEmptyAddDependent"
            >
              <Ionicons name="person-add-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.emptyAddBtnText}>Đăng ký người phụ thuộc ngay</Text>
            </TouchableOpacity>
          </View>
        ) : (
          dependents.map((dep) => {
            const age = calculateAge(dep.birthDate);
            const isAdult = age >= 14;
            const hasCitizenId = Boolean(dep.citizenId);

            return (
              <TouchableOpacity
                key={dep.id}
                style={styles.cardItem}
                activeOpacity={0.88}
                onPress={() => handleViewDetail(dep.id)}
                testID={`dependentCard_${dep.id}`}
              >
                {/* Header thẻ */}
                <View style={styles.cardTopRow}>
                  <View style={styles.avatarBox}>
                    <Ionicons
                      name={dep.relationship === 'CHILD' ? 'happy' : 'person'}
                      size={22}
                      color="#FFFFFF"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardName}>{dep.fullName}</Text>
                    <View style={styles.badgesRow}>
                      <View style={styles.relationBadge}>
                        <Text style={styles.relationBadgeText}>
                          {getRelationshipLabel(dep.relationship)}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.statusBadge,
                          dep.isProfileComplete ? styles.statusComplete : styles.statusPending,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            dep.isProfileComplete
                              ? styles.statusCompleteText
                              : styles.statusPendingText,
                          ]}
                        >
                          {dep.isProfileComplete ? '✓ Đủ hồ sơ' : 'Chờ bổ sung minh chứng'}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.rowMenuBtn}
                    onPress={() => handleRowMenu(dep)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    testID={`dependentMenu_${dep.id}`}
                    accessibilityRole="button"
                    accessibilityLabel="Tuỳ chọn người phụ thuộc"
                  >
                    <Ionicons name="ellipsis-vertical" size={20} color="#666666" />
                  </TouchableOpacity>
                </View>

                {/* Phân cách nhẹ */}
                <View style={styles.cardDivider} />

                {/* Chi tiết người phụ thuộc */}
                <View style={styles.cardDetails}>
                  {/* Ngày sinh & Độ tuổi */}
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Ngày sinh & Độ tuổi:</Text>
                    <Text style={styles.detailValue}>
                      {dep.birthDate} ({age} tuổi)
                    </Text>
                  </View>

                  {/* Định danh: CCCD (nếu >= 14 tuổi) hoặc Giấy khai sinh (nếu < 14 tuổi) */}
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>
                      {isAdult || hasCitizenId ? 'Số Căn cước công dân:' : 'Số Giấy khai sinh:'}
                    </Text>
                    <Text style={[styles.detailValue, styles.monospace]}>
                      {dep.citizenId || dep.birthCertNumber || 'Chưa cập nhật'}
                    </Text>
                  </View>

                  {/* Nhóm điều kiện */}
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Nhóm điều kiện:</Text>
                    <Text style={[styles.detailValue, { flex: 1, textAlign: 'right' }]} numberOfLines={2}>
                      {dep.groupTitle}
                    </Text>
                  </View>

                  {/* Thời gian hiệu lực */}
                  {(dep.effectiveFromMonth || dep.effectiveToMonth) && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Thời gian hiệu lực:</Text>
                      <Text style={styles.detailValue}>
                        {dep.effectiveFromMonth || '01/2026'} → {dep.effectiveToMonth || '12/2026'}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Nút hành động */}
                <View style={styles.cardActionRow}>
                  <TouchableOpacity
                    style={styles.uploadProofBtn}
                    onPress={() => handleGoToProofDocuments(dep)}
                    activeOpacity={0.8}
                    testID={`btnProofDoc_${dep.id}`}
                  >
                    <Ionicons
                      name="cloud-upload-outline"
                      size={16}
                      color={theme.colors.primary}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.uploadProofBtnText}>
                      {dep.isProfileComplete ? 'Xem / Cập nhật minh chứng' : 'Bổ sung ảnh minh chứng'}
                    </Text>
                    <Ionicons name="chevron-forward" size={14} color={theme.colors.primary} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* Modal Xem chi tiết người phụ thuộc (GET /api/v1/dependents/{id}) */}
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
          <View style={styles.detailModalSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.detailModalHandle} />

            {detailLoading ? (
              <View style={styles.modalLoadingBox}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.modalLoadingText}>Đang tải chi tiết người phụ thuộc từ máy chủ...</Text>
              </View>
            ) : selectedDetail ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header Modal */}
                <View style={styles.detailHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailModalTitle}>{selectedDetail.fullName}</Text>
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

                {/* Trạng thái hồ sơ */}
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
                    style={{ marginRight: 8 }}
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

                {/* Khối thông tin cá nhân */}
                <View style={styles.detailCardSection}>
                  <Text style={styles.detailSectionHeading}>THÔNG TIN CÁ NHÂN</Text>

                  <View style={styles.modalDetailRow}>
                    <Text style={styles.modalDetailLabel}>Ngày sinh:</Text>
                    <Text style={styles.modalDetailVal}>
                      {(selectedDetail.birthDate || '').split('T')[0]} ({calculateAge(selectedDetail.birthDate)} tuổi)
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

                {/* Khối Giấy tờ minh chứng */}
                <View style={styles.detailCardSection}>
                  <Text style={styles.detailSectionHeading}>
                    GIẤY TỜ MINH CHỨNG ĐÃ LƯU ({selectedDetail.documents?.length || 0})
                  </Text>

                  {selectedDetail.documents && selectedDetail.documents.length > 0 ? (
                    selectedDetail.documents.map((doc: any, index: number) => {
                      const isImg =
                        doc.fileMimeType?.includes('image') ||
                        doc.fileUrl?.match(/\.(png|jpe?g|webp|gif)$/i) ||
                        !doc.fileUrl?.match(/\.pdf$/i);
                      const fileName = (doc.fileUrl || '').split('/').pop() || doc.docType;

                      const handleDocPress = () => {
                        setPreviewDoc({
                          uri: doc.fileUrl,
                          title: getDocTypeLabel(doc.docType),
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
                          accessibilityLabel={`Xem tài liệu ${getDocTypeLabel(doc.docType)}`}
                        >
                          {isImg && doc.fileUrl ? (
                            <View style={styles.docThumbContainer}>
                              <Image
                                source={{ uri: doc.fileUrl }}
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

                          <View style={{ flex: 1, paddingHorizontal: 10 }}>
                            <Text style={styles.docItemName} numberOfLines={1}>
                              {getDocTypeLabel(doc.docType)}
                            </Text>
                            <Text style={styles.docFileName} numberOfLines={1}>
                              {fileName}
                            </Text>
                            <Text style={styles.docItemDate}>
                              Ngày nộp: {(doc.uploadedAt || '').split('T')[0]} •{' '}
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
                      <Ionicons name="folder-open-outline" size={32} color="#999999" style={{ marginBottom: 6 }} />
                      <Text style={styles.emptyDocText}>Chưa có giấy tờ minh chứng nào được tải lên.</Text>
                    </View>
                  )}
                </View>

                {/* Nút hành động trong Modal */}
                <View style={styles.modalActionRow}>
                  <TouchableOpacity
                    style={styles.modalSecondaryBtn}
                    onPress={() =>
                      handleChangeGroup({
                        dependentId: selectedDetail.dependentId,
                        fullName: selectedDetail.fullName,
                        relationship: selectedDetail.relationship,
                        currentGroup: selectedDetail.currentGroup,
                      })
                    }
                    testID="btnChangeDependentGroup"
                  >
                    <Ionicons
                      name="swap-horizontal-outline"
                      size={18}
                      color={theme.colors.primary}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.modalSecondaryBtnText}>Đổi nhóm điều kiện</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalDangerBtn}
                    onPress={() =>
                      handleSoftDelete(selectedDetail.dependentId, selectedDetail.fullName)
                    }
                    testID="btnSoftDeleteDependent"
                  >
                    <Ionicons
                      name="trash-outline"
                      size={18}
                      color={theme.colors.error}
                      style={{ marginRight: 6 }}
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
                    <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.modalGoProofBtnText}>
                      {selectedDetail.isProfileComplete ? 'Xem / Cập nhật minh chứng' : 'Bổ sung ảnh minh chứng ngay'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={{ height: 25 }} />
              </ScrollView>
            ) : null}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal Xem ảnh / tài liệu minh chứng phóng to full-screen */}
      <DocumentViewerModal
        visible={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
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
        }}
      />

      <Dialog
        visible={!!infoDialog}
        title={infoDialog?.title ?? ''}
        message={infoDialog?.message ?? ''}
        primaryLabel="Đóng"
        onPrimary={() => setInfoDialog(null)}
        onRequestClose={() => setInfoDialog(null)}
      />
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
    paddingVertical: 12,
    backgroundColor: '#FAF5EA',
    borderBottomWidth: 1,
    borderBottomColor: '#EBE2D3',
  },
  backBtn: {
    padding: 6,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    flex: 1,
    textAlign: 'center',
  },
  addHeaderBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: theme.colors.surfaceSecondary,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  summaryBanner: {
    backgroundColor: theme.colors.primaryDark,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
    ...theme.shadows.button,
  },
  summaryTextCol: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.goldLight,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  summaryCount: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  summaryCountUnit: {
    fontSize: 14,
    fontWeight: '400',
    color: '#E0E0E0',
  },
  summaryDeductionAmount: {
    fontSize: 12,
    color: '#D0D0D0',
  },
  summaryHighlight: {
    fontWeight: '700',
    color: theme.colors.goldLight,
  },
  summaryLawSubtext: {
    fontSize: 11,
    color: '#E0D0B0',
    marginTop: 3,
    fontStyle: 'italic',
  },
  summaryIconBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  detailModalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
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
    fontSize: 14,
    color: '#666666',
  },
  detailHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  detailModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  detailModalSubtitle: {
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
  statusBoxComplete: {
    backgroundColor: '#E8F5E9',
  },
  statusBoxPending: {
    backgroundColor: '#FFF3E0',
  },
  detailStatusText: {
    fontSize: 13,
    fontWeight: '600',
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
    fontSize: 11,
    fontWeight: '700',
    color: '#8B1E1E',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  modalDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EBE0',
  },
  modalDetailLabel: {
    fontSize: 13,
    color: '#666666',
  },
  modalDetailVal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'right',
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
  docFileName: {
    fontSize: 11,
    color: '#666666',
    marginTop: 1,
  },
  validStatusText: {
    color: '#2E7D32',
    fontWeight: '600',
  },
  pendingStatusText: {
    color: '#E65100',
    fontWeight: '600',
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
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  docItemName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  docItemDate: {
    fontSize: 11,
    color: '#888888',
    marginTop: 2,
  },
  emptyDocBox: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  emptyDocText: {
    fontSize: 13,
    color: '#888888',
  },
  modalActionRow: {
    marginTop: 6,
  },
  modalGoProofBtn: {
    backgroundColor: theme.colors.primaryDark,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  modalGoProofBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  modalSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
  },
  modalSecondaryBtnText: {
    color: theme.colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  modalDangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: theme.colors.error,
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
  },
  modalDangerBtnText: {
    color: theme.colors.error,
    fontWeight: '700',
    fontSize: 14,
  },
  rowMenuBtn: {
    padding: 6,
    marginLeft: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  addNewInlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  addNewInlineBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: 30,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginTop: 10,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    ...theme.shadows.button,
  },
  emptyAddBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cardItem: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  relationBadge: {
    backgroundColor: theme.colors.surfaceSecondary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  relationBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusComplete: {
    backgroundColor: '#E8F5E9',
  },
  statusPending: {
    backgroundColor: '#FFF3E0',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusCompleteText: {
    color: '#2E7D32',
  },
  statusPendingText: {
    color: '#E65100',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F0F0F2',
    marginVertical: 12,
  },
  cardDetails: {
    gap: 6,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  monospace: {
    fontFamily: 'monospace',
    letterSpacing: 0.5,
  },
  cardActionRow: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F2',
    paddingTop: 10,
    alignItems: 'flex-end',
  },
  uploadProofBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF0E8',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 2,
  },
  uploadProofBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.primary,
  },
});
