import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { DrumHeader } from '../../components/brand/DrumHeader';
import { Dialog } from '../../components/common/Dialog';
import { DocumentViewerModal } from '../../components/common/DocumentViewerModal';
import { useToast } from '../../components/ui/Toast';
import { incomeApi } from '../../api/incomeApi';
import type { OcrImagePart } from '../../api/ocrApi';
import { PayslipOcrData } from '../../types/income';
import { RootNavigationProp, RootStackParamList } from '../../navigation/types';
import { sanitizeUiMessage } from '../../utils/friendlyError';
import {
  IncomeFormErrors,
  IncomeFormField,
  IncomeFormValues,
  emptyIncomeForm,
  extractApiErrorMessage,
  findDuplicateMonth,
  formatMoneyInput,
  fromIncomeItem,
  fromPayslipOcr,
  incomeFormUi,
  IncomeFormMode,
  isLowConfidence,
  toIncomeRequest,
  validateIncomeForm,
} from './incomeFormUtils';

type Route = RouteProp<RootStackParamList, 'IncomeMonthForm'>;

const vnd = (n?: number | null) => `${Number(n ?? 0).toLocaleString('vi-VN')} đ`;

export function IncomeMonthFormScreen() {
  const navigation = useNavigation<RootNavigationProp>();
  const { params } = useRoute<Route>();
  const { toast } = useToast();
  const editing = params.item;

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const [values, setValues] = useState<IncomeFormValues>(() =>
    editing ? fromIncomeItem(editing) : emptyIncomeForm(params.year, new Date().getMonth() + 1)
  );
  const [errors, setErrors] = useState<IncomeFormErrors>({});
  const [ocr, setOcr] = useState<PayslipOcrData | null>(null);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState('');
  const [scanError, setScanError] = useState('');
  const [viewerOpen, setViewerOpen] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [payslipFile, setPayslipFile] = useState<OcrImagePart | null>(null);

  const [mode, setMode] = useState<IncomeFormMode>(editing ? 'view' : 'edit');
  const ui = incomeFormUi(mode, editing);

  const lowFields = ocr?.thresholdValidation?.lowConfidenceFields ?? [];
  const duplicate = findDuplicateMonth(params.groups ?? [], values, editing?.id);
  const busy = scanning || saving || deleting;

  const setField = useCallback((field: IncomeFormField, text: string) => {
    setValues((v) => ({ ...v, [field]: text }));
    setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e));
    setFormError((prev) => (prev ? '' : prev));
  }, []);

  const setMoney = useCallback(
    (field: IncomeFormField) => (text: string) => setField(field, formatMoneyInput(text)),
    [setField]
  );

  const scan = async (source: 'camera' | 'library') => {
    try {
      const perm =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        toast.warning(
          source === 'camera'
            ? 'Vui lòng cấp quyền truy cập máy ảnh trong phần Cài đặt thiết bị để chụp phiếu lương.'
            : 'Vui lòng cấp quyền truy cập thư viện ảnh trong phần Cài đặt thiết bị để chọn ảnh.',
          'Cần cấp quyền truy cập'
        );
        return;
      }
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8, base64: false })
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, base64: false });
      if (result.canceled || !result.assets?.length || !isMountedRef.current) return;

      const asset = result.assets[0];
      const picked: OcrImagePart = {
        uri: asset.uri,
        name: asset.fileName ?? `payslip_${Date.now()}.jpg`,
        type: asset.mimeType ?? 'image/jpeg',
      };
      setScanning(true);
      setScanError('');
      const month = Number(values.month) || undefined;
      const year = Number(values.year) || params.year;
      const data = await incomeApi.extractPayslip(picked, month, year);
      if (!isMountedRef.current) return;

      setOcr(data);
      setPayslipFile(picked);
      const filled = fromPayslipOcr(data, { month, year });
      setValues((prev) => {
        const next = { ...prev };
        (Object.keys(filled) as (keyof IncomeFormValues)[]).forEach((k) => {
          const v = filled[k];
          if (v) (next as Record<string, string | null>)[k] = v;
        });
        return next;
      });
      setErrors({});
    } catch (err) {
      if (!isMountedRef.current) return;
      const fallback = 'Không đọc được phiếu lương. Vui lòng thử ảnh rõ nét hơn hoặc nhập tay.';
      setScanError(sanitizeUiMessage(extractApiErrorMessage(err, fallback), fallback));
    } finally {
      if (isMountedRef.current) {
        setScanning(false);
      }
    }
  };

  const doSave = async () => {
    setDuplicateDialogOpen(false);
    setSaving(true);
    setFormError('');
    try {
      const body = toIncomeRequest(values);
      if (editing) await incomeApi.update(editing.id, body);
      else await incomeApi.create(body, payslipFile ?? undefined);
      if (!isMountedRef.current) return;
      toast.success(
        editing ? 'Đã cập nhật thông tin thu nhập tháng.' : 'Đã lưu thông tin thu nhập tháng mới.',
        'Đã lưu thu nhập'
      );
      navigation.goBack();
    } catch (err) {
      if (!isMountedRef.current) return;
      const fallback = 'Không lưu được thông tin thu nhập. Vui lòng kiểm tra lại và thử lại.';
      setFormError(sanitizeUiMessage(extractApiErrorMessage(err, fallback), fallback));
    } finally {
      if (isMountedRef.current) {
        setSaving(false);
      }
    }
  };

  const save = () => {
    const e = validateIncomeForm(values);
    setErrors(e);
    if (Object.keys(e).length > 0) {
      setFormError('Vui lòng kiểm tra lại các ô được đánh dấu đỏ.');
      return;
    }
    if (duplicate) {
      setDuplicateDialogOpen(true);
      return;
    }
    doSave();
  };

  const cancelEdit = () => {
    if (!editing) return;
    setValues(fromIncomeItem(editing));
    setErrors({});
    setOcr(null);
    setPayslipFile(null);
    setScanError('');
    setFormError('');
    setMode('view');
  };

  const confirmRemove = async () => {
    if (!editing) return;
    setDeleteDialogOpen(false);
    setDeleting(true);
    try {
      await incomeApi.remove(editing.id);
      if (!isMountedRef.current) return;
      toast.success(
        `Đã xóa khoản thu nhập tháng ${editing.month}/${editing.year}.`,
        'Đã xóa khoản thu'
      );
      navigation.goBack();
    } catch (err) {
      if (!isMountedRef.current) return;
      const fallback = 'Không xóa được khoản thu nhập này. Vui lòng thử lại.';
      setFormError(sanitizeUiMessage(extractApiErrorMessage(err, fallback), fallback));
    } finally {
      if (isMountedRef.current) {
        setDeleting(false);
      }
    }
  };

  const field = (
    name: IncomeFormField,
    label: string,
    opts: { money?: boolean; numeric?: boolean; placeholder?: string; required?: boolean } = {}
  ) => {
    const low = isLowConfidence(name, lowFields);
    return (
      <View style={styles.field}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>
            {label}
            {opts.required ? <Text style={styles.required}> *</Text> : null}
          </Text>
          {low ? <Text style={styles.lowTag}>Cần đối chiếu lại</Text> : null}
        </View>
        <View
          style={[
            styles.inputWrap,
            !ui.editable && styles.inputReadOnly,
            low && styles.inputLow,
            errors[name] && styles.inputError,
          ]}
        >
          <TextInput
            style={styles.input}
            value={values[name]}
            onChangeText={opts.money ? setMoney(name) : (t) => setField(name, t)}
            keyboardType={opts.money || opts.numeric ? 'number-pad' : 'default'}
            placeholder={opts.placeholder}
            placeholderTextColor={theme.colors.textPlaceholder}
            editable={ui.editable && !busy}
            testID={`incomeInput_${name}`}
          />
          {opts.money ? <Text style={styles.unit}>đ</Text> : null}
        </View>
        {errors[name] ? <Text style={styles.errorText}>{errors[name]}</Text> : null}
      </View>
    );
  };

  const warningMessageClean = ocr?.thresholdValidation?.warningMessage
    ? sanitizeUiMessage(ocr.thresholdValidation.warningMessage)
    : '';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <DrumHeader
        title={ui.title}
        onBack={() => navigation.goBack()}
        backTestID="incomeFormBack"
      />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scrollOuter}
          keyboardShouldPersistTaps="handled"
          testID="incomeFormScroll"
        >
          <View style={styles.content}>
            {ui.showScan ? (
              <View style={styles.scanCard}>
                <Text style={styles.scanTitle}>Quét phiếu lương</Text>
                <Text style={styles.scanDesc}>
                  Chụp hoặc chọn ảnh phiếu lương để tự động điền các chỉ tiêu bên dưới. Vui lòng kiểm tra lại số liệu trước khi lưu.
                </Text>
                <View style={styles.scanBtns}>
                  <TouchableOpacity
                    style={styles.scanBtn}
                    onPress={() => scan('camera')}
                    disabled={busy}
                    testID="scanPayslipCamera"
                  >
                    <Ionicons name="camera-outline" size={18} color={theme.colors.primary} />
                    <Text style={styles.scanBtnText}>Chụp ảnh</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.scanBtn}
                    onPress={() => scan('library')}
                    disabled={busy}
                    testID="scanPayslipLibrary"
                  >
                    <Ionicons name="images-outline" size={18} color={theme.colors.primary} />
                    <Text style={styles.scanBtnText}>Chọn ảnh</Text>
                  </TouchableOpacity>
                </View>
                {scanError ? (
                  <Text style={styles.scanError} testID="payslipScanError">
                    {scanError}
                  </Text>
                ) : null}
                {scanning ? (
                  <View style={styles.scanning}>
                    <ActivityIndicator color={theme.colors.primary} />
                    <Text style={styles.scanningText}>Đang đọc phiếu lương, có thể mất 20–60 giây...</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {ui.showScan && ocr ? (
              <View
                style={[styles.ocrBox, ocr.thresholdValidation?.isPassedThreshold === false && styles.ocrBoxWarn]}
                testID="payslipOcrResult"
              >
                <Text style={styles.ocrTitle}>
                  {ocr.thresholdValidation?.isPassedThreshold === false
                    ? 'Đã đọc phiếu lương, cần kiểm tra kỹ'
                    : 'Đã đọc phiếu lương'}
                  {ocr.thresholdValidation?.overallConfidence != null
                    ? ` · độ tin cậy ${Math.round(ocr.thresholdValidation.overallConfidence * 100)}%`
                    : ''}
                </Text>
                {warningMessageClean ? <Text style={styles.ocrText}>{warningMessageClean}</Text> : null}
                {lowFields.length > 0 ? (
                  <Text style={styles.ocrText}>
                    Các ô tô vàng có độ tin cậy thấp, vui lòng đối chiếu lại với phiếu lương gốc.
                  </Text>
                ) : null}
                {ocr.employeeName || ocr.grossSalary != null || ocr.netSalary != null ? (
                  <Text style={styles.ocrRef}>
                    Tham khảo trên phiếu: {ocr.employeeName ? `${ocr.employeeName} · ` : ''}
                    {ocr.grossSalary != null ? `Lương gộp ${vnd(ocr.grossSalary)} · ` : ''}
                    {ocr.netSalary != null ? `Thực nhận ${vnd(ocr.netSalary)}` : ''}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {field('organizationName', 'Tổ chức chi trả', { required: true, placeholder: 'Ví dụ: Công ty Cổ phần ABC' })}
            {field('taxIdNumber', 'Mã số thuế tổ chức', { numeric: false, placeholder: '10 hoặc 13 chữ số' })}
            <View style={styles.row2}>
              <View style={styles.flex}>{field('month', 'Tháng', { numeric: true, required: true, placeholder: '1–12' })}</View>
              <View style={styles.flex}>{field('year', 'Năm', { numeric: true, required: true })}</View>
            </View>
            {field('totalTaxableIncome', 'Thu nhập chịu thuế', { money: true, required: true, placeholder: '0' })}
            {field('insuranceDeducted', 'Bảo hiểm bắt buộc đã trích (BHXH, BHYT, BHTN)', {
              money: true,
              required: true,
              placeholder: '0',
            })}
            {field('taxAlreadyDeducted', 'Thuế TNCN đã khấu trừ', { money: true, placeholder: '0' })}

            {ui.showPayslipPreview ? (
              <View style={styles.previewCard} testID="payslipPreview">
                <Text style={styles.label}>Ảnh phiếu lương</Text>
                {values.payslipFileUrl ? (
                  <TouchableOpacity onPress={() => setViewerOpen(true)} testID="payslipPreviewImage">
                    <Image source={{ uri: values.payslipFileUrl }} style={styles.previewImage} resizeMode="contain" />
                    <Text style={styles.previewHint}>Bấm vào ảnh để phóng to</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.previewEmpty}>Tháng này chưa đính kèm ảnh phiếu lương.</Text>
                )}
              </View>
            ) : values.payslipFileUrl || payslipFile ? (
              <TouchableOpacity
                style={styles.attach}
                onPress={() => setViewerOpen(true)}
                testID="payslipAttachment"
              >
                <Ionicons name="document-attach-outline" size={16} color={theme.colors.primary} />
                <Text style={styles.attachText}>
                  {values.payslipFileUrl
                    ? 'Đã đính kèm ảnh phiếu lương · bấm để xem'
                    : 'Ảnh phiếu lương sẽ được lưu kèm · bấm để xem'}
                </Text>
              </TouchableOpacity>
            ) : null}

            {ui.editable && duplicate ? (
              <View style={styles.warnBox} testID="duplicateMonthWarning">
                <Ionicons name="warning-outline" size={16} color="#8A5A00" />
                <Text style={styles.warnText}>
                  Đã có thu nhập tháng {duplicate.month}/{duplicate.year} của "{duplicate.organizationName}" (
                  {vnd(duplicate.totalTaxableIncome)}). Kiểm tra lại để tránh khai trùng.
                </Text>
              </View>
            ) : null}

            {ui.editable ? (
              <View style={styles.note}>
                <Ionicons name="information-circle-outline" size={14} color="#7A5A14" />
                <Text style={styles.noteText}>
                  Chỉ khai thu nhập chịu thuế đã được tổ chức chi trả bóc tách. Bảo hiểm là số doanh nghiệp đã trích trên
                  phiếu lương, không tự tính.
                </Text>
              </View>
            ) : null}

            {formError ? (
              <Text style={styles.formError} testID="incomeFormError">
                {formError}
              </Text>
            ) : null}

            {ui.showEditButton ? (
              <TouchableOpacity style={styles.saveBtn} onPress={() => setMode('edit')} disabled={busy} testID="editMonthlyIncomeBtn">
                <Text style={styles.saveText}>Sửa</Text>
              </TouchableOpacity>
            ) : null}

            {ui.showSave ? (
              <TouchableOpacity
                style={[styles.saveBtn, busy && styles.disabled]}
                onPress={save}
                disabled={busy}
                testID="saveMonthlyIncomeBtn"
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveText}>{editing ? 'Lưu thay đổi' : 'Lưu thu nhập tháng'}</Text>
                )}
              </TouchableOpacity>
            ) : null}

            {ui.showCancelEdit ? (
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={cancelEdit}
                disabled={busy}
                testID="cancelEditMonthlyIncomeBtn"
              >
                <Text style={styles.cancelText}>Hủy sửa</Text>
              </TouchableOpacity>
            ) : null}

            {ui.showEditButton ? (
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => setDeleteDialogOpen(true)}
                disabled={busy}
                testID="deleteMonthlyIncomeBtn"
              >
                {deleting ? (
                  <ActivityIndicator color={theme.colors.primary} />
                ) : (
                  <Text style={styles.deleteText}>Xóa tháng này</Text>
                )}
              </TouchableOpacity>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Dialog
        visible={duplicateDialogOpen && !!duplicate}
        title="Có thể bị trùng tháng khai"
        message="Khoản thu nhập cùng tháng của đơn vị này đã tồn tại. Nếu lưu thêm, số liệu sẽ được cộng dồn khi quyết toán."
        detailLabel="Khoản đã khai trước đó"
        detail={
          duplicate
            ? `Tháng ${duplicate.month}/${duplicate.year} · ${duplicate.organizationName} (${vnd(duplicate.totalTaxableIncome)})`
            : undefined
        }
        destructive
        primaryLabel="Vẫn lưu"
        secondaryLabel="Xem lại"
        onPrimary={doSave}
        onSecondary={() => setDuplicateDialogOpen(false)}
        onRequestClose={() => setDuplicateDialogOpen(false)}
      />

      <Dialog
        visible={deleteDialogOpen && !!editing}
        title="Xóa thu nhập tháng này?"
        message="Khoản thu nhập này sẽ bị gỡ khỏi bảng kê theo tháng. Bạn vẫn có thể kê khai lại nếu cần."
        detailLabel="Khoản thu nhập"
        detail={
          editing
            ? `Tháng ${editing.month}/${editing.year} · ${editing.organizationName} (${vnd(editing.totalTaxableIncome)})`
            : undefined
        }
        destructive
        primaryLabel="Xóa"
        secondaryLabel="Giữ lại"
        onPrimary={confirmRemove}
        onSecondary={() => setDeleteDialogOpen(false)}
        onRequestClose={() => setDeleteDialogOpen(false)}
      />

      <DocumentViewerModal
        visible={viewerOpen}
        onClose={() => setViewerOpen(false)}
        document={
          values.payslipFileUrl || payslipFile
            ? {
                uri: values.payslipFileUrl || payslipFile!.uri,
                title: 'Ảnh phiếu lương',
                subtitle: `${values.organizationName || 'Phiếu lương'} · tháng ${values.month || '?'}/${values.year}`,
                fileName: `Phiếu lương tháng ${values.month || '?'}/${values.year}`,
                mimeType: 'image/jpeg',
              }
            : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  scrollOuter: { flexGrow: 1 },
  content: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    padding: 20,
    paddingBottom: 40,
    gap: 12,
  },
  scanCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    padding: 14,
    gap: 8,
  },
  scanTitle: { fontFamily: fonts.bodySemi, fontSize: 15, color: theme.colors.textPrimary },
  scanDesc: { fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: theme.colors.textSecondary },
  scanBtns: { flexDirection: 'row', gap: 10 },
  scanBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  scanBtnText: { flexShrink: 1, fontFamily: fonts.bodySemi, fontSize: 13, color: theme.colors.primary },
  scanError: { fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 17, color: theme.colors.primary },
  scanning: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scanningText: { flex: 1, fontFamily: fonts.body, fontSize: 12, color: theme.colors.textSecondary },
  ocrBox: { borderRadius: 10, padding: 10, backgroundColor: '#EEF6EE', gap: 4 },
  ocrBoxWarn: { backgroundColor: '#FFF6E0' },
  ocrTitle: { fontFamily: fonts.bodySemi, fontSize: 13, color: theme.colors.textPrimary },
  ocrText: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: '#5A4A22' },
  ocrRef: { fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: theme.colors.textSecondary },
  field: { gap: 4 },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  label: { flexShrink: 1, fontFamily: fonts.bodyMedium, fontSize: 13, color: theme.colors.textPrimary },
  required: { color: theme.colors.primary },
  lowTag: { fontFamily: fonts.bodyMedium, fontSize: 11, color: '#8A5A00' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
  },
  inputReadOnly: { backgroundColor: theme.colors.background },
  inputLow: { borderColor: '#E0A800', backgroundColor: '#FFF9E6' },
  inputError: { borderColor: theme.colors.primary },
  input: { flex: 1, minHeight: 42, paddingVertical: 10, fontFamily: fonts.body, fontSize: 14, color: theme.colors.textPrimary },
  unit: { fontFamily: fonts.bodyMedium, fontSize: 14, color: theme.colors.textSecondary, marginLeft: 4 },
  errorText: { fontFamily: fonts.body, fontSize: 11, color: theme.colors.primary },
  row2: { flexDirection: 'row', gap: 10 },
  attach: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  previewCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    padding: 12,
    gap: 8,
  },
  previewImage: { width: '100%', height: 260, borderRadius: 8, backgroundColor: theme.colors.background },
  previewHint: { fontFamily: fonts.body, fontSize: 11, color: theme.colors.textSecondary, textAlign: 'center', marginTop: 4 },
  previewEmpty: { fontFamily: fonts.body, fontSize: 12, color: theme.colors.textSecondary },
  attachText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 12, color: theme.colors.primary },
  warnBox: { flexDirection: 'row', gap: 6, padding: 10, borderRadius: 8, backgroundColor: '#FFF1D6' },
  warnText: { flex: 1, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: '#6B4600' },
  note: { flexDirection: 'row', gap: 6, padding: 8, borderRadius: 8, backgroundColor: '#FBF6E9' },
  noteText: { flex: 1, fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: '#5A4A22' },
  formError: { fontFamily: fonts.bodyMedium, fontSize: 12, color: theme.colors.primary },
  saveBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  saveText: { fontFamily: fonts.bodySemi, fontSize: 15, color: '#FFFFFF', textAlign: 'center' },
  disabled: { opacity: 0.6 },
  deleteBtn: { alignItems: 'center', paddingVertical: 10 },
  deleteText: { fontFamily: fonts.bodySemi, fontSize: 14, color: theme.colors.primary },
  cancelText: { fontFamily: fonts.bodySemi, fontSize: 14, color: theme.colors.textSecondary },
});
