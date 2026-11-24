import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Platform, Image, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { theme } from '../../constants/theme';
import { HeaderMotif } from '../../components/common/HeaderMotif';
import { DrumPatternBackdrop } from '../../components/brand/DrumPatternBackdrop';
import { Dialog } from '../../components/common/Dialog';
import { DocumentViewerModal, DocumentViewerItem } from '../../components/common/DocumentViewerModal';
import { isImageDocumentUri } from '../../components/common/imageZoomUtils';
import { Card, Badge, Button, Separator, useToast } from '../../components/ui';
import { RootNavigationProp, RootStackParamList } from '../../navigation/types';
import { expenseApi } from '../../api/expenseApi';
import { MedicalStatement } from '../../types/expense';
import { formatCurrencyVND, parseBackendError, toPercent } from './expenseValidationUtils';
import {
  validateStatementFile,
  isStatementProcessing,
  shouldShowMedicalStatementImage,
  getStatementStatusMeta,
  getDeductionReasonLabel,
  isLineExcluded,
  normalizeStatementErrors,
  summarizeStatementLines,
} from './medicalStatementUtils';

const POLL_MS = 4000;
const MAX_POLLS = 30; // ~2 phút; quá thì để người dùng tự bấm tải lại

type PickedFile = { uri: string; name?: string; type?: string; size?: number | null };

export const MedicalStatementScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'MedicalStatement'>>();
  const { periodId, documentId, readOnly } = route.params;
  const { toast } = useToast();

  const [statement, setStatement] = useState<MedicalStatement | null>(null);
  const [receiptConfirmed, setReceiptConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [pollTimedOut, setPollTimedOut] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [viewerDocument, setViewerDocument] = useState<DocumentViewerItem | null>(null);
  const pollCount = useRef(0);

  useEffect(() => {
    setImageFailed(false);
  }, [statement?.fileUrl]);

  const load = useCallback(async () => {
    try {
      const doc = await expenseApi.getDocumentById(periodId, documentId);
      setStatement(doc.medicalStatement ?? null);
      setReceiptConfirmed(doc.status === 'CONFIRMED');
    } catch (err) {
      const { title, message } = parseBackendError(err);
      toast.error(message, title);
    } finally {
      setLoading(false);
    }
  }, [periodId, documentId]);

  useEffect(() => {
    load();
  }, [load]);

  // AI bóc tách chạy nền: hỏi lại BE cho đến khi bảng kê rời trạng thái UPLOADED
  useEffect(() => {
    if (!isStatementProcessing(statement)) {
      pollCount.current = 0;
      return;
    }
    if (pollCount.current >= MAX_POLLS) {
      setPollTimedOut(true);
      return;
    }
    const t = setTimeout(() => {
      pollCount.current += 1;
      load();
    }, POLL_MS);
    return () => clearTimeout(t);
  }, [statement, load]);

  const canEdit = !readOnly && !receiptConfirmed && statement?.status !== 'CONFIRMED';

  const upload = async (file: PickedFile) => {
    const invalid = validateStatementFile(file);
    if (invalid) {
      toast.warning(invalid, 'Tệp không hợp lệ');
      return;
    }
    setUploading(true);
    try {
      const created = await expenseApi.uploadMedicalStatement(periodId, documentId, file);
      pollCount.current = 0;
      setPollTimedOut(false);
      setStatement(created);
      toast.success('AI đang bóc tách bảng kê, vui lòng chờ trong giây lát.', 'Đã tải bảng kê');
    } catch (err: any) {
      if (err?.response?.status === 409) {
        toast.error('Hóa đơn này đã có bảng kê. Hãy xóa bảng kê cũ trước khi tải bảng mới.', 'Đã có bảng kê');
        load();
      } else {
        const { title, message } = parseBackendError(err);
        toast.error(message, title);
      }
    } finally {
      setUploading(false);
    }
  };

  const pickFromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      toast.warning('Vui lòng cho phép truy cập máy ảnh để chụp bảng kê.', 'Cần cấp quyền');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 });
    const a = !res.canceled ? res.assets?.[0] : undefined;
    if (a) upload({ uri: a.uri, name: a.fileName || `bang_ke_${Date.now()}.jpg`, type: 'image/jpeg', size: a.fileSize });
  };

  const pickFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    });
    const a = !res.canceled ? res.assets?.[0] : undefined;
    if (a) upload({ uri: a.uri, name: a.name, type: a.mimeType || undefined, size: a.size });
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await expenseApi.deleteMedicalStatement(periodId, documentId);
      setStatement(null);
      setShowDelete(false);
      toast.success('Đã xóa bảng kê. Quý khách có thể tải bảng kê khác.', 'Đã xóa');
    } catch (err) {
      const { title, message } = parseBackendError(err);
      toast.error(message, title);
    } finally {
      setDeleting(false);
    }
  };

  const statusMeta = getStatementStatusMeta(statement?.status);
  const summary = summarizeStatementLines(statement?.lines);
  const eligibleTotal = statement?.totalEligibleAmount ?? summary.eligibleAmount;

  const renderEmpty = () => (
    <Card style={styles.card}>
      <View style={styles.cardHeader}>
        <Ionicons name="document-text-outline" size={16} color="#475569" />
        <Text style={styles.cardTitle}>Chưa có bảng kê chi phí KCB</Text>
      </View>
      <Text style={styles.muted}>
        Theo Điều 49 NĐ 253/2026, chi phí y tế chỉ được giảm trừ khi có bảng kê chi tiết (Mẫu 01/KBCB) để
        tách phần được BHYT chi trả. Hóa đơn viện phí chưa có bảng kê sẽ không được tính khi quyết toán.
      </Text>
      {canEdit ? (
        <View style={styles.actions}>
          {Platform.OS !== 'web' && (
            <Button
              onPress={pickFromCamera}
              disabled={uploading}
              icon={<Ionicons name="camera-outline" size={16} color="#FFFFFF" />}
            >
              Chụp bảng kê
            </Button>
          )}
          <Button
            variant="outline"
            onPress={pickFile}
            disabled={uploading}
            icon={<Ionicons name="folder-open-outline" size={16} color={theme.colors.primary} />}
          >
            Chọn ảnh hoặc PDF
          </Button>
          <Text style={styles.hint}>JPG, PNG hoặc PDF, tối đa 10MB.</Text>
        </View>
      ) : (
        <Text style={[styles.muted, { marginTop: 8 }]}>Hóa đơn đã được xác nhận nên không thể tải thêm bảng kê.</Text>
      )}
    </Card>
  );

  const renderStatement = (s: MedicalStatement) => (
    <>
      <Card style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={styles.cardHeader}>
            <Ionicons name="document-text-outline" size={16} color="#475569" />
            <Text style={styles.cardTitle} numberOfLines={1}>{s.originalFilename || 'Bảng kê chi phí KCB'}</Text>
          </View>
          <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
        </View>

        {isStatementProcessing(s) ? (
          <View style={styles.processing}>
            {pollTimedOut ? (
              <>
                <Text style={styles.muted}>AI vẫn đang xử lý lâu hơn bình thường.</Text>
                <Button variant="outline" size="sm" onPress={() => { pollCount.current = 0; setPollTimedOut(false); load(); }}>
                  Tải lại
                </Button>
              </>
            ) : (
              <>
                <ActivityIndicator color={theme.colors.primary} />
                <Text style={styles.muted}>AI đang đọc bảng kê và phân loại từng dòng chi phí...</Text>
              </>
            )}
          </View>
        ) : (
          <>
            <InfoRow label="Người bệnh" value={s.patientName} />
            <InfoRow label="Cơ sở KCB" value={s.hospitalName} />
            <InfoRow
              label="Thời gian điều trị"
              value={s.admissionDate ? `${s.admissionDate}${s.dischargeDate ? ` → ${s.dischargeDate}` : ''}` : null}
            />
            {s.overallConfidence != null && (
              <InfoRow
                label="Độ tin cậy trích xuất"
                value={`${toPercent(s.overallConfidence)}%${s.appliedThreshold != null ? ` (yêu cầu ≥ ${toPercent(s.appliedThreshold)}%)` : ''}`}
              />
            )}
          </>
        )}
      </Card>

      {shouldShowMedicalStatementImage(s) && isImageDocumentUri(s.fileUrl, undefined, s.originalFilename) && (
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="image-outline" size={16} color="#475569" />
            <Text style={styles.cardTitle}>Ảnh bảng kê gốc</Text>
          </View>
          {!imageFailed ? (
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.imagePreviewWrap}
              onPress={() =>
                setViewerDocument({
                  uri: s.fileUrl,
                  title: 'Ảnh bảng kê chi phí KCB',
                  fileName: s.originalFilename || undefined,
                  subtitle: `Được giảm trừ: ${formatCurrencyVND(eligibleTotal)}`,
                  isReadable: true,
                })
              }
              accessibilityRole="button"
              accessibilityLabel="Phóng to ảnh bảng kê gốc"
            >
              <Image
                source={{ uri: s.fileUrl }}
                style={styles.statementImage}
                resizeMode="contain"
                onError={() => setImageFailed(true)}
              />
              <View style={styles.imageZoomBadge}>
                <Ionicons name="search-outline" size={12} color="#FFFFFF" />
                <Text style={styles.imageZoomBadgeText}>Phóng to</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.imageErrorBox}>
              <Ionicons name="image-outline" size={26} color="#94A3B8" />
              <Text style={styles.imageErrorText}>Không tải được ảnh bảng kê gốc.</Text>
            </View>
          )}
        </Card>
      )}

      {normalizeStatementErrors(s.validationErrors).length > 0 && (
        <Card style={[styles.card, styles.cardWarning]}>
          <View style={styles.cardHeader}>
            <Ionicons name="alert-circle-outline" size={16} color="#B45309" />
            <Text style={[styles.cardTitle, { color: '#92400E' }]}>
              Cần kiểm tra ({normalizeStatementErrors(s.validationErrors).length})
            </Text>
          </View>
          {normalizeStatementErrors(s.validationErrors).map((msg, i) => (
            <Text key={i} style={styles.errorText}>• {msg}</Text>
          ))}
        </Card>
      )}

      {!isStatementProcessing(s) && (
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="calculator-outline" size={16} color="#475569" />
            <Text style={styles.cardTitle}>Tổng hợp chi phí</Text>
          </View>
          <InfoRow label="Tổng chi phí KCB" value={formatCurrencyVND(s.totalHospitalAmount ?? 0)} />
          <InfoRow label="BHYT chi trả" value={formatCurrencyVND(s.insurancePaidAmount ?? 0)} />
          <InfoRow label="Người bệnh trả" value={formatCurrencyVND(s.patientPaidAmount ?? 0)} />
          <Separator style={{ marginVertical: 8 }} />
          <View style={styles.rowBetween}>
            <Text style={styles.eligibleLabel}>Được giảm trừ thuế</Text>
            <Text style={styles.eligibleValue}>{formatCurrencyVND(eligibleTotal)}</Text>
          </View>
          {summary.excludedCount > 0 && (
            <Text style={styles.hint}>
              {summary.excludedCount} dòng bị loại trừ ({formatCurrencyVND(summary.excludedAmount)}).
            </Text>
          )}
        </Card>
      )}

      {s.lines?.length > 0 && (
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="list-outline" size={16} color="#475569" />
            <Text style={styles.cardTitle}>Chi tiết dòng chi phí ({s.lines.length})</Text>
          </View>
          {[...s.lines].sort((a, b) => a.lineOrder - b.lineOrder).map((l) => {
            const excluded = isLineExcluded(l);
            return (
              <View key={l.id} style={styles.lineRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.lineName}>{l.itemName}</Text>
                  {!!l.sectionName && <Text style={styles.hint}>{l.sectionName}</Text>}
                  {excluded && (
                    <Text style={styles.reasonText}>
                      Nguyên nhân: {getDeductionReasonLabel(l.deductionReason, l)}
                    </Text>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.lineAmount}>
                    {formatCurrencyVND(!excluded ? l.eligibleAmount : l.patientCoPay + l.patientSelfPay)}
                  </Text>
                  <Badge variant={!excluded ? 'success' : 'destructive'}>
                    {!excluded ? 'Giảm trừ' : 'Loại trừ'}
                  </Badge>
                </View>
              </View>
            );
          })}
        </Card>
      )}

      {canEdit && !isStatementProcessing(s) && (
        <Button
          variant="destructive"
          onPress={() => setShowDelete(true)}
          icon={<Ionicons name="trash-outline" size={16} color="#FFFFFF" />}
        >
          Xóa bảng kê để tải lại
        </Button>
      )}
    </>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <DrumPatternBackdrop variant="soft" />
      <HeaderMotif title="BẢNG KÊ CHI PHÍ KCB" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.primary} />
        ) : uploading ? (
          <View style={styles.processing}>
            <ActivityIndicator color={theme.colors.primary} />
            <Text style={styles.muted}>Đang tải bảng kê lên...</Text>
          </View>
        ) : statement ? (
          renderStatement(statement)
        ) : (
          renderEmpty()
        )}
      </ScrollView>

      <Dialog
        visible={showDelete}
        title="Xóa bảng kê"
        message="Xóa bảng kê này và toàn bộ dòng chi phí AI đã bóc tách? Sau đó quý khách có thể tải bảng kê khác."
        primaryLabel={deleting ? 'Đang xóa...' : 'Xóa bảng kê'}
        secondaryLabel="Giữ lại"
        destructive
        onPrimary={() => { if (!deleting) confirmDelete(); }}
        onSecondary={() => setShowDelete(false)}
        onRequestClose={() => setShowDelete(false)}
      />

      <DocumentViewerModal
        visible={Boolean(viewerDocument)}
        document={viewerDocument}
        onClose={() => setViewerDocument(null)}
      />
    </SafeAreaView>
  );
};

const InfoRow: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value || '—'}</Text>
  </View>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    marginBottom: 12,
  },
  cardWarning: { backgroundColor: '#FFFBEB', borderColor: '#FCD34D' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, flexShrink: 1 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A', flexShrink: 1 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  muted: { fontSize: 13, color: '#475569', lineHeight: 19, textAlign: 'center' },
  hint: { fontSize: 12, color: '#64748B', marginTop: 4 },
  actions: { gap: 10, marginTop: 14 },
  processing: { alignItems: 'center', gap: 10, paddingVertical: 20 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, gap: 12 },
  infoLabel: { fontSize: 13, color: '#64748B' },
  infoValue: { fontSize: 13, color: '#0F172A', fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  errorText: { fontSize: 13, color: '#92400E', lineHeight: 19, marginBottom: 4 },
  eligibleLabel: { fontSize: 14, fontWeight: '700', color: '#15803D' },
  eligibleValue: { fontSize: 16, fontWeight: '800', color: '#15803D' },
  lineRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  lineName: { fontSize: 13, color: '#0F172A', fontWeight: '600' },
  lineAmount: { fontSize: 13, fontWeight: '700', color: '#0F172A', marginBottom: 4 },
  reasonText: { fontSize: 12, color: '#B91C1C', marginTop: 2 },
  imagePreviewWrap: { position: 'relative', borderRadius: 6, overflow: 'hidden' },
  statementImage: { width: '100%', height: 220, borderRadius: 6, backgroundColor: '#0F172A' },
  imageZoomBadge: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  imageZoomBadgeText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  imageErrorBox: {
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    gap: 8,
  },
  imageErrorText: { fontSize: 12, color: '#64748B' },
});
