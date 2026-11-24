import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  Platform,
  Modal,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { DrumHeader } from '../../components/brand/DrumHeader';
import { InfoNote } from '../../components/common/InfoNote';
import { ChangeGroupSheet } from '../../components/common/ChangeGroupSheet';
import {
  DocumentViewerModal,
  DocumentViewerItem,
} from '../../components/common/DocumentViewerModal';
import { isImageDocumentUri } from '../../components/common/imageZoomUtils';
import { useToast } from '../../components/ui/Toast';
import { formatPersonName } from '../../utils/formatPersonName';
import { sanitizeUiMessage, toFriendlyErrorMessage } from '../../utils/friendlyError';
import { RootNavigationProp, RootStackParamList } from '../../navigation/types';
import {
  dependentDocumentApi,
  getDocTypeLabel,
  getFullFileUrl,
  getGroupTitle,
} from '../../api/dependentDocumentApi';
import { dependentLifecycleApi } from '../../api/dependentLifecycleApi';
import { ageAtEffectiveFrom, RELATIONSHIP_OPTIONS } from './dependentEligibility';
import { buildProofDocumentsParams } from './proofDocumentsParams';
import {
  buildManualChangeGroupPlan,
  runManualChangeGroup,
  type ManualChangeGroupPlan,
} from './manualChangeGroup';
import { runSoftDeleteDependent } from './softDeleteDependent';
import {
  calculateDependentAge,
  formatDependentDate,
  formatDependentMonthRange,
  getDependentStatusMeta,
  normalizeDependentNote,
} from './dependentDetailUtils';

type Route = RouteProp<RootStackParamList, 'DependentDetail'>;

const NOOP = () => undefined;

function getRelationshipLabel(code?: string): string {
  return RELATIONSHIP_OPTIONS.find((item) => item.value === code)?.label || code || 'Người phụ thuộc';
}

export const DependentDetailScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const { dependentId } = route.params;

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const [detail, setDetail] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [previewDoc, setPreviewDoc] = useState<DocumentViewerItem | null>(null);
  const [changeGroupPlan, setChangeGroupPlan] = useState<ManualChangeGroupPlan | null>(null);
  const [changeGroupVisible, setChangeGroupVisible] = useState<boolean>(false);
  const [changeGroupLoading, setChangeGroupLoading] = useState<boolean>(false);

  const [deleteModalVisible, setDeleteModalVisible] = useState<boolean>(false);
  const [deleteReason, setDeleteReason] = useState<string>('');
  const [deleteLoading, setDeleteLoading] = useState<boolean>(false);

  const fetchDetail = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setLoadError(null);
    try {
      // getRules nạp tên giấy tờ (docName) từ DB để nhãn tài liệu đã nộp không hiện mã thô
      const [data] = await Promise.all([
        dependentDocumentApi.getDependentById(dependentId),
        dependentDocumentApi.getRules(),
      ]);
      if (!isMountedRef.current) return;
      setDetail(data);
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      const msg = toFriendlyErrorMessage(err, 'Không thể tải thông tin chi tiết người phụ thuộc.');
      setLoadError(msg);
      toast.error(msg, 'Chưa tải được hồ sơ');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [dependentId, toast]);

  useFocusEffect(
    useCallback(() => {
      void fetchDetail(Boolean(detail));
    }, [fetchDetail])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchDetail(true);
  }, [fetchDetail]);

  const handleOpenProofDocuments = useCallback(() => {
    if (!detail) return;
    navigation.navigate(
      'ProofDocuments',
      buildProofDocumentsParams({
        id: detail.dependentId || dependentId,
        fullName: detail.fullName,
        birthDate: detail.birthDate,
        currentGroup: detail.currentGroup,
        groupTitle: getGroupTitle(detail.currentGroup),
        isProfileComplete: Boolean(detail.isProfileComplete),
        requiredDocs: detail.requiredDocuments || [],
        citizenId: detail.citizenId,
        birthCertNumber: detail.birthCertNumber,
        relationship: detail.relationship,
        effectiveFromMonth: detail.effectiveFromMonth,
        effectiveToMonth: detail.effectiveToMonth,
        status: detail.status,
      })
    );
  }, [detail, dependentId, navigation]);

  const handleOpenChangeGroup = useCallback(() => {
    if (!detail) return;
    let ageAtEffective: number | undefined;
    if (detail.birthDate) {
      const iso = String(detail.birthDate).slice(0, 10);
      const parts = iso.split('-');
      if (parts.length === 3) {
        const now = new Date();
        const asOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        ageAtEffective = ageAtEffectiveFrom(parts[2], parts[1], parts[0], asOfMonth);
      }
    }

    const plan = buildManualChangeGroupPlan({
      dependentId: detail.dependentId || dependentId,
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

    setChangeGroupPlan(plan);
    setChangeGroupVisible(true);
  }, [detail, dependentId, toast]);

  const handleConfirmChangeGroup = useCallback(
    async (newGroup: string, note?: string) => {
      if (!changeGroupPlan || changeGroupLoading) return;
      setChangeGroupLoading(true);
      try {
        const result = await runManualChangeGroup({
          dependentId: changeGroupPlan.dependentId,
          newGroup,
          note,
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
        toast.success(
          'Đã cập nhật nhóm điều kiện. Vui lòng bổ sung giấy tờ minh chứng tương ứng.',
          'Đã cập nhật hồ sơ'
        );
        navigation.navigate(result.navigation.screen, result.navigation.params);
      } finally {
        if (isMountedRef.current) {
          setChangeGroupLoading(false);
        }
      }
    },
    [changeGroupPlan, changeGroupLoading, navigation, toast]
  );

  const handleConfirmSoftDelete = useCallback(async () => {
    if (!detail || deleteLoading) return;
    setDeleteLoading(true);
    try {
      const result = await runSoftDeleteDependent({
        dependentId: detail.dependentId || dependentId,
        reason: normalizeDependentNote(deleteReason),
        deleteDependent: dependentLifecycleApi.deleteDependent,
      });
      if (!isMountedRef.current) return;
      if (!result.ok) {
        toast.error(
          sanitizeUiMessage(result.message, 'Không thể vô hiệu hóa hồ sơ người phụ thuộc này.'),
          'Chưa thể thực hiện'
        );
        return;
      }
      setDeleteModalVisible(false);
      setDeleteReason('');
      toast.success(
        sanitizeUiMessage(result.toastMessage, 'Đã vô hiệu hóa người phụ thuộc thành công.'),
        'Đã cập nhật danh sách'
      );
      navigation.reset({
        index: 1,
        routes: [{ name: 'Home' }, { name: 'DependentList' }],
      });
    } finally {
      if (isMountedRef.current) {
        setDeleteLoading(false);
      }
    }
  }, [detail, dependentId, deleteLoading, deleteReason, navigation, toast]);

  const statusMeta = detail ? getDependentStatusMeta(detail.status, detail.isProfileComplete) : null;
  const age = detail ? calculateDependentAge(detail.birthDate) : 0;
  const missingDocs: string[] = Array.isArray(detail?.missingDocuments) ? detail.missingDocuments : [];
  const documents: any[] = Array.isArray(detail?.documents) ? detail.documents : [];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <DrumHeader
        title="Chi tiết người phụ thuộc"
        onBack={() => {
          if (navigation.canGoBack()) navigation.goBack();
          else navigation.navigate('DependentList');
        }}
        backTestID="dependentDetailBackBtn"
      />

      {loading && !detail ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.centerText}>Đang tải thông tin chi tiết người phụ thuộc...</Text>
        </View>
      ) : loadError && !detail ? (
        <View style={styles.centerBox}>
          <Ionicons name="alert-circle-outline" size={44} color={theme.colors.error} />
          <Text style={styles.errorTitle}>Không tải được hồ sơ</Text>
          <Text style={styles.centerText}>{loadError}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => void fetchDetail(false)}>
            <Text style={styles.retryBtnText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : detail ? (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 20) + 24 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[theme.colors.primary]}
            />
          }
        >
          {/* Header tên + nhóm */}
          <View style={styles.heroCard}>
            <Text style={styles.heroName}>{formatPersonName(detail.fullName)}</Text>
            <Text style={styles.heroSubtitle}>
              {getRelationshipLabel(detail.relationship)} • {getGroupTitle(detail.currentGroup)}
            </Text>

            {statusMeta ? (
              <View
                style={[
                  styles.statusBanner,
                  statusMeta.tone === 'success'
                    ? styles.statusBannerSuccess
                    : statusMeta.tone === 'warning'
                    ? styles.statusBannerWarning
                    : styles.statusBannerNeutral,
                ]}
              >
                <Ionicons
                  name={
                    statusMeta.tone === 'success'
                      ? 'checkmark-circle'
                      : statusMeta.tone === 'warning'
                      ? 'alert-circle'
                      : 'ban-outline'
                  }
                  size={18}
                  color={
                    statusMeta.tone === 'success'
                      ? '#2E7D32'
                      : statusMeta.tone === 'warning'
                      ? '#E65100'
                      : '#666666'
                  }
                />
                <View style={styles.statusTextCol}>
                  <Text
                    style={[
                      styles.statusTitle,
                      statusMeta.tone === 'success'
                        ? styles.statusTitleSuccess
                        : statusMeta.tone === 'warning'
                        ? styles.statusTitleWarning
                        : styles.statusTitleNeutral,
                    ]}
                  >
                    {statusMeta.label}
                  </Text>
                  <Text style={styles.statusDesc}>{statusMeta.description}</Text>
                </View>
              </View>
            ) : null}
          </View>

          {/* Thông tin cá nhân & giảm trừ */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeading}>THÔNG TIN CÁ NHÂN & GIẢM TRỪ</Text>

            <DetailRow label="Họ và tên" value={formatPersonName(detail.fullName)} />
            <DetailRow label="Mối quan hệ" value={getRelationshipLabel(detail.relationship)} />
            <DetailRow label="Nhóm điều kiện" value={getGroupTitle(detail.currentGroup)} />
            <DetailRow label="Ngày sinh" value={`${formatDependentDate(detail.birthDate)} (${age} tuổi)`} />
            {detail.citizenId ? (
              <DetailRow label="Số CCCD" value={detail.citizenId} monospace />
            ) : null}
            {detail.birthCertNumber ? (
              <DetailRow label="Số Giấy khai sinh" value={detail.birthCertNumber} monospace />
            ) : null}
            {!detail.citizenId && !detail.birthCertNumber ? (
              <DetailRow label="Giấy tờ định danh" value="Chưa cập nhật" />
            ) : null}
            {detail.taxIdNumber ? (
              <DetailRow label="Mã số thuế NPT" value={detail.taxIdNumber} monospace />
            ) : null}
            <DetailRow
              label="Thời gian hiệu lực"
              value={formatDependentMonthRange(detail.effectiveFromMonth, detail.effectiveToMonth)}
            />
            {detail.note ? <DetailRow label="Ghi chú" value={detail.note} /> : null}
            {detail.createdAt ? (
              <DetailRow label="Ngày khai báo" value={formatDependentDate(detail.createdAt)} />
            ) : null}
            {detail.updatedAt ? (
              <DetailRow label="Cập nhật gần nhất" value={formatDependentDate(detail.updatedAt)} last />
            ) : null}
          </View>

          {/* Giấy tờ còn thiếu */}
          {missingDocs.length > 0 ? (
            <View style={[styles.sectionCard, styles.missingCard]}>
              <Text style={styles.sectionHeading}>GIẤY TỜ CÒN THIẾU ({missingDocs.length})</Text>
              {missingDocs.map((docType, idx) => (
                <View key={`${docType}_${idx}`} style={styles.missingRow}>
                  <Ionicons name="alert-circle-outline" size={16} color="#E65100" />
                  <Text style={styles.missingText}>{getDocTypeLabel(docType)}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Giấy tờ minh chứng đã lưu */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeading}>
              GIẤY TỜ MINH CHỨNG ĐÃ LƯU ({documents.length})
            </Text>

            {documents.length > 0 ? (
              documents.map((doc, idx) => {
                const fullUrl = getFullFileUrl(doc.fileUrl);
                const docLabel = getDocTypeLabel(doc.docType);
                const fileName = fullUrl.split('/').pop()?.split('?')[0] || docLabel;
                const isImg = isImageDocumentUri(fullUrl, doc.fileMimeType, fileName);

                const openViewer = () => {
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
                    key={doc.docId || idx}
                    style={styles.docItemCard}
                    activeOpacity={0.82}
                    onPress={openViewer}
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
                      <Text style={styles.docItemName} numberOfLines={1}>{docLabel}</Text>
                      <Text style={styles.docFileName} numberOfLines={1}>{fileName}</Text>
                      <Text style={styles.docItemDate}>
                        Ngày nộp: {formatDependentDate(doc.uploadedAt)} •{' '}
                        <Text style={doc.isReadable ? styles.validStatusText : styles.pendingStatusText}>
                          {doc.isReadable ? '✓ Hợp lệ' : 'Đang kiểm tra'}
                        </Text>
                      </Text>
                    </View>

                    <View style={styles.viewDocActionBtn}>
                      <Ionicons name="eye-outline" size={15} color={theme.colors.primary} />
                      <Text style={styles.viewDocActionText}>Xem</Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.emptyDocBox}>
                <Ionicons name="folder-open-outline" size={30} color="#999999" />
                <Text style={styles.emptyDocText}>Chưa có giấy tờ minh chứng nào được tải lên.</Text>
              </View>
            )}
          </View>

          {/* Chỉnh sửa & Quản lý hồ sơ */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeading}>CHỈNH SỬA & QUẢN LÝ HỒ SƠ</Text>

            <TouchableOpacity
              style={styles.primaryActionBtn}
              onPress={handleOpenProofDocuments}
              activeOpacity={0.85}
              testID="detailGoProofBtn"
            >
              <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" />
              <Text style={styles.primaryActionText}>
                {detail.isProfileComplete ? 'Xem / Cập nhật giấy tờ minh chứng' : 'Bổ sung giấy tờ minh chứng ngay'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryActionBtn}
              onPress={handleOpenChangeGroup}
              activeOpacity={0.85}
              testID="detailChangeGroupBtn"
            >
              <Ionicons name="swap-horizontal-outline" size={18} color={theme.colors.primary} />
              <Text style={styles.secondaryActionText}>Đổi nhóm điều kiện & ghi chú</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dangerActionBtn}
              onPress={() => setDeleteModalVisible(true)}
              activeOpacity={0.85}
              testID="detailSoftDeleteBtn"
            >
              <Ionicons name="trash-outline" size={18} color={theme.colors.error} />
              <Text style={styles.dangerActionText}>Vô hiệu hóa hồ sơ người phụ thuộc</Text>
            </TouchableOpacity>

            <View style={styles.noteSpacer} />
            <InfoNote
              text="Thông tin định danh cố định (Họ tên, Ngày sinh, CCCD/GKS, Mối quan hệ) được giữ nguyên sau khi tạo hồ sơ. Bạn có thể đổi nhóm điều kiện, cập nhật ghi chú/minh chứng, hoặc vô hiệu hóa hồ sơ cũ để khai báo lại nếu nhập nhầm."
            />
          </View>
        </ScrollView>
      ) : null}

      <DocumentViewerModal
        visible={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        document={previewDoc}
      />

      <ChangeGroupSheet
        visible={changeGroupVisible && Boolean(changeGroupPlan)}
        fullName={changeGroupPlan?.fullName ?? ''}
        currentGroup={changeGroupPlan?.currentGroup ?? ''}
        options={changeGroupPlan?.options ?? []}
        initialNote={detail?.note ?? ''}
        loading={changeGroupLoading}
        onSelect={(code, note) => {
          void handleConfirmChangeGroup(code, note);
        }}
        onCancel={() => {
          if (changeGroupLoading) return;
          setChangeGroupVisible(false);
          setChangeGroupPlan(null);
        }}
      />

      {/* Modal Vô hiệu hóa có hỗ trợ nhập lý do (BE DeleteDependentRequest.Reason) */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!deleteLoading) setDeleteModalVisible(false);
        }}
      >
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable
            style={styles.modalScrim}
            onPress={() => {
              if (!deleteLoading) setDeleteModalVisible(false);
            }}
          >
            <Pressable style={styles.deleteCard} onPress={NOOP}>
              <Text style={styles.deleteTitle}>
                Vô hiệu hóa {detail ? formatPersonName(detail.fullName) : 'người phụ thuộc'}?
              </Text>
              <Text style={styles.deleteMessage}>
                Người phụ thuộc sẽ ngừng được tính giảm trừ gia cảnh và không thể khôi phục trực tiếp trên ứng dụng.
              </Text>

              <Text style={styles.deleteReasonLabel}>Lý do vô hiệu hóa (tùy chọn)</Text>
              <TextInput
                style={styles.deleteReasonInput}
                value={deleteReason}
                onChangeText={setDeleteReason}
                placeholder="VD: Nhập nhầm thông tin định danh, không còn là NPT..."
                placeholderTextColor={theme.colors.textPlaceholder}
                multiline
                maxLength={500}
                editable={!deleteLoading}
                textAlignVertical="top"
                testID="deleteDependentReasonInput"
              />

              <View style={styles.deleteBtnRow}>
                <TouchableOpacity
                  style={styles.deleteCancelBtn}
                  onPress={() => setDeleteModalVisible(false)}
                  disabled={deleteLoading}
                >
                  <Text style={styles.deleteCancelText}>Giữ lại</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.deleteConfirmBtn, deleteLoading && styles.btnDisabled]}
                  onPress={() => void handleConfirmSoftDelete()}
                  disabled={deleteLoading}
                  testID="confirmSoftDeleteDependentBtn"
                >
                  {deleteLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.deleteConfirmText}>Vô hiệu hóa</Text>
                  )}
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const DetailRow = React.memo(function DetailRow({
  label,
  value,
  monospace = false,
  last = false,
}: {
  label: string;
  value: string;
  monospace?: boolean;
  last?: boolean;
}) {
  return (
    <View style={[styles.detailRow, !last && styles.detailRowBorder]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, monospace && styles.monospace]}>{value}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  errorTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 17,
    color: theme.colors.textPrimary,
  },
  centerText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 10,
    marginTop: 6,
  },
  retryBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  scrollContent: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  heroCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 14,
  },
  heroName: {
    fontFamily: fonts.serifBold,
    fontSize: 22,
    lineHeight: 28,
    color: theme.colors.textPrimary,
  },
  heroSubtitle: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
  },
  statusBannerSuccess: { backgroundColor: '#E8F5E9' },
  statusBannerWarning: { backgroundColor: '#FFF3E0' },
  statusBannerNeutral: { backgroundColor: '#F1F5F9' },
  statusTextCol: { flex: 1 },
  statusTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 13.5,
  },
  statusTitleSuccess: { color: '#2E7D32' },
  statusTitleWarning: { color: '#E65100' },
  statusTitleNeutral: { color: '#475569' },
  statusDesc: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    color: '#475569',
    lineHeight: 18,
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 14,
  },
  missingCard: {
    backgroundColor: '#FFFBF2',
    borderColor: '#FDE68A',
  },
  sectionHeading: {
    fontFamily: fonts.bodyBold,
    fontSize: 11.5,
    color: theme.colors.primary,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 8,
  },
  detailRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0EBE0',
  },
  detailLabel: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    color: theme.colors.textSecondary,
    flexShrink: 0,
  },
  detailValue: {
    flex: 1,
    fontFamily: fonts.bodySemi,
    fontSize: 13.5,
    color: theme.colors.textPrimary,
    textAlign: 'right',
    lineHeight: 20,
  },
  monospace: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.4,
  },
  missingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 5,
  },
  missingText: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 13.5,
    color: '#9A3412',
  },
  docItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  docThumbContainer: {
    width: 54,
    height: 54,
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
    width: 54,
    height: 54,
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
    fontSize: 13.5,
    color: theme.colors.textPrimary,
  },
  docFileName: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  docItemDate: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    color: '#777777',
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
    paddingVertical: 18,
    gap: 8,
  },
  emptyDocText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primaryDark,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  primaryActionText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14.5,
    color: '#FFFFFF',
  },
  secondaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  secondaryActionText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: theme.colors.primary,
  },
  dangerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: theme.colors.error,
    backgroundColor: theme.colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  dangerActionText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: theme.colors.error,
  },
  noteSpacer: {
    height: 12,
  },
  modalScrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.48)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  deleteCard: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  deleteTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 17,
    color: theme.colors.primaryDark,
    marginBottom: 8,
  },
  deleteMessage: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    lineHeight: 20,
    color: theme.colors.textSecondary,
    marginBottom: 14,
  },
  deleteReasonLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 12.5,
    color: theme.colors.textPrimary,
    marginBottom: 6,
  },
  deleteReasonInput: {
    minHeight: 74,
    maxHeight: 120,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.body,
    fontSize: 14,
    color: theme.colors.textPrimary,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  deleteBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  deleteCancelBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 10,
    backgroundColor: theme.colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteCancelText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  deleteConfirmBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 10,
    backgroundColor: theme.colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteConfirmText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  btnDisabled: {
    opacity: 0.65,
  },
});
