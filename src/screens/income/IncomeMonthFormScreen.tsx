import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { DrumHeader } from '../../components/brand/DrumHeader';
import { DocumentViewerModal } from '../../components/common/DocumentViewerModal';
import { incomeApi } from '../../api/incomeApi';
import type { OcrImagePart } from '../../api/ocrApi';
import { PayslipOcrData } from '../../types/income';
import { RootNavigationProp, RootStackParamList } from '../../navigation/types';
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
  isLowConfidence,
  toIncomeRequest,
  validateIncomeForm,
} from './incomeFormUtils';

type Route = RouteProp<RootStackParamList, 'IncomeMonthForm'>;

const vnd = (n?: number | null) => `${Number(n ?? 0).toLocaleString('vi-VN')} đ`;

export function IncomeMonthFormScreen() {
  const navigation = useNavigation<RootNavigationProp>();
  const { params } = useRoute<Route>();
  const editing = params.item;

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
  // Ảnh phiếu lương đã quét — BE chỉ lưu ảnh khi gửi kèm lúc tạo thu nhập
  const [payslipFile, setPayslipFile] = useState<OcrImagePart | null>(null);

  const lowFields = ocr?.thresholdValidation?.lowConfidenceFields ?? [];
  const duplicate = findDuplicateMonth(params.groups ?? [], values, editing?.id);
  const busy = scanning || saving || deleting;

  const setField = (field: IncomeFormField, text: string) => {
    setValues((v) => ({ ...v, [field]: text }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
    // Câu lỗi chung của lần lưu trước không còn đúng khi người dùng đã sửa
    if (formError) setFormError('');
  };
  const setMoney = (field: IncomeFormField) => (text: string) => setField(field, formatMoneyInput(text));

  // ── Quét phiếu lương ────────────────────────────────────────────────────────
  const scan = async (source: 'camera' | 'library') => {
    try {
      const perm =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Cần cấp quyền', source === 'camera' ? 'Vui lòng cho phép truy cập Camera.' : 'Vui lòng cho phép truy cập Thư viện ảnh.');
        return;
      }
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (result.canceled || !result.assets?.length) return;

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
      setOcr(data);
      setPayslipFile(picked);
      // Ô nào AI không đọc được (rỗng) thì giữ giá trị người dùng đã nhập
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
      setScanError(extractApiErrorMessage(err, 'Không đọc được phiếu lương. Vui lòng thử ảnh khác hoặc nhập tay.'));
    } finally {
      setScanning(false);
    }
  };

  // ── Lưu / xóa ───────────────────────────────────────────────────────────────
  const doSave = async () => {
    setSaving(true);
    setFormError('');
    try {
      const body = toIncomeRequest(values);
      if (editing) await incomeApi.update(editing.id, body);
      else await incomeApi.create(body, payslipFile ?? undefined);
      navigation.goBack();
    } catch (err) {
      setFormError(extractApiErrorMessage(err, 'Không lưu được thu nhập. Vui lòng thử lại.'));
    } finally {
      setSaving(false);
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
      Alert.alert(
        'Có thể bị trùng',
        `Đã có thu nhập tháng ${duplicate.month}/${duplicate.year} của "${duplicate.organizationName}" (${vnd(
          duplicate.totalTaxableIncome
        )}). Lưu thêm sẽ bị cộng 2 lần. Bạn vẫn muốn lưu?`,
        [
          { text: 'Xem lại', style: 'cancel' },
          { text: 'Vẫn lưu', style: 'destructive', onPress: doSave },
        ]
      );
      return;
    }
    doSave();
  };

  const remove = () => {
    if (!editing) return;
    Alert.alert('Xóa thu nhập tháng này?', `Tháng ${editing.month}/${editing.year} · ${editing.organizationName}`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await incomeApi.remove(editing.id);
            navigation.goBack();
          } catch (err) {
            setFormError(extractApiErrorMessage(err, 'Không xóa được. Vui lòng thử lại.'));
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  // ── Giao diện ───────────────────────────────────────────────────────────────
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
          {low ? <Text style={styles.lowTag}>AI chưa chắc — kiểm tra lại</Text> : null}
        </View>
        <View style={[styles.inputWrap, low && styles.inputLow, errors[name] && styles.inputError]}>
          <TextInput
            style={styles.input}
            value={values[name]}
            onChangeText={opts.money ? setMoney(name) : (t) => setField(name, t)}
            keyboardType={opts.money || opts.numeric ? 'number-pad' : 'default'}
            placeholder={opts.placeholder}
            placeholderTextColor={theme.colors.textPlaceholder}
            editable={!busy}
            testID={`incomeInput_${name}`}
          />
          {opts.money ? <Text style={styles.unit}>đ</Text> : null}
        </View>
        {errors[name] ? <Text style={styles.errorText}>{errors[name]}</Text> : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <DrumHeader
        title={editing ? `Thu nhập tháng ${editing.month}/${editing.year}` : 'Thêm thu nhập tháng'}
        onBack={() => navigation.goBack()}
        backTestID="incomeFormBack"
      />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" testID="incomeFormScroll">
          {/* Quét phiếu lương */}
          <View style={styles.scanCard}>
            <Text style={styles.scanTitle}>Quét phiếu lương</Text>
            <Text style={styles.scanDesc}>
              Chụp hoặc chọn ảnh phiếu lương, hệ thống sẽ tự điền các ô bên dưới. Bạn vẫn kiểm tra lại trước khi lưu.
            </Text>
            <View style={styles.scanBtns}>
              <TouchableOpacity style={styles.scanBtn} onPress={() => scan('camera')} disabled={busy} testID="scanPayslipCamera">
                <Ionicons name="camera-outline" size={18} color={theme.colors.primary} />
                <Text style={styles.scanBtnText}>Chụp ảnh</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.scanBtn} onPress={() => scan('library')} disabled={busy} testID="scanPayslipLibrary">
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

          {/* Kết quả OCR */}
          {ocr ? (
            <View style={[styles.ocrBox, ocr.thresholdValidation?.isPassedThreshold === false && styles.ocrBoxWarn]} testID="payslipOcrResult">
              <Text style={styles.ocrTitle}>
                {ocr.thresholdValidation?.isPassedThreshold === false ? 'Đã đọc, nhưng độ tin cậy thấp' : 'Đã đọc phiếu lương'}
                {ocr.thresholdValidation?.overallConfidence != null
                  ? ` · độ tin cậy ${Math.round(ocr.thresholdValidation.overallConfidence * 100)}%`
                  : ''}
              </Text>
              {ocr.thresholdValidation?.warningMessage ? (
                <Text style={styles.ocrText}>{ocr.thresholdValidation.warningMessage}</Text>
              ) : null}
              {lowFields.length > 0 ? (
                <Text style={styles.ocrText}>Các ô tô vàng là AI chưa chắc chắn, vui lòng đối chiếu với phiếu lương.</Text>
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

          {/* Form */}
          {field('organizationName', 'Tổ chức chi trả', { required: true, placeholder: 'Ví dụ: Công ty Cổ phần ABC' })}
          {field('taxIdNumber', 'Mã số thuế tổ chức', { numeric: false, placeholder: '10 chữ số' })}
          <View style={styles.row2}>
            <View style={styles.flex}>{field('month', 'Tháng', { numeric: true, required: true, placeholder: '1–12' })}</View>
            <View style={styles.flex}>{field('year', 'Năm', { numeric: true, required: true })}</View>
          </View>
          {field('totalTaxableIncome', 'Thu nhập chịu thuế', { money: true, required: true, placeholder: '0' })}
          {field('insuranceDeducted', 'Bảo hiểm bắt buộc đã trích (BHXH, BHYT, BHTN)', { money: true, required: true, placeholder: '0' })}
          {field('taxAlreadyDeducted', 'Thuế TNCN đã khấu trừ', { money: true, placeholder: '0' })}

          {values.payslipFileUrl || payslipFile ? (
            <TouchableOpacity
              style={styles.attach}
              onPress={() => setViewerOpen(true)}
              testID="payslipAttachment"
            >
              <Ionicons name="document-attach-outline" size={16} color={theme.colors.primary} />
              <Text style={styles.attachText}>
              {values.payslipFileUrl ? 'Đã đính kèm ảnh phiếu lương · bấm để xem' : 'Ảnh phiếu lương sẽ được lưu kèm · bấm để xem'}
            </Text>
            </TouchableOpacity>
          ) : null}

          {duplicate ? (
            <View style={styles.warnBox} testID="duplicateMonthWarning">
              <Ionicons name="warning-outline" size={16} color="#8A5A00" />
              <Text style={styles.warnText}>
                Đã có thu nhập tháng {duplicate.month}/{duplicate.year} của "{duplicate.organizationName}" (
                {vnd(duplicate.totalTaxableIncome)}). Kiểm tra lại để tránh khai trùng.
              </Text>
            </View>
          ) : null}

          <View style={styles.note}>
            <Ionicons name="information-circle-outline" size={14} color="#7A5A14" />
            <Text style={styles.noteText}>
              Chỉ khai thu nhập chịu thuế đã được tổ chức chi trả bóc tách. Bảo hiểm là số doanh nghiệp đã trích trên
              phiếu lương, không tự tính.
            </Text>
          </View>

          {formError ? (
            <Text style={styles.formError} testID="incomeFormError">
              {formError}
            </Text>
          ) : null}

          <TouchableOpacity style={[styles.saveBtn, busy && styles.disabled]} onPress={save} disabled={busy} testID="saveMonthlyIncomeBtn">
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveText}>{editing ? 'Lưu thay đổi' : 'Lưu thu nhập tháng'}</Text>}
          </TouchableOpacity>

          {editing ? (
            <TouchableOpacity style={styles.deleteBtn} onPress={remove} disabled={busy} testID="deleteMonthlyIncomeBtn">
              {deleting ? <ActivityIndicator color={theme.colors.primary} /> : <Text style={styles.deleteText}>Xóa tháng này</Text>}
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Xem ảnh phiếu lương ngay trong app — mở trình duyệt ngoài dễ làm mất dữ liệu form khi quay lại */}
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
  content: { padding: 20, paddingBottom: 40, gap: 12 },
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
  },
  scanBtnText: { fontFamily: fonts.bodySemi, fontSize: 13, color: theme.colors.primary },
  scanError: { fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 17, color: theme.colors.primary },
  scanning: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scanningText: { flex: 1, fontFamily: fonts.body, fontSize: 12, color: theme.colors.textSecondary },
  ocrBox: { borderRadius: 10, padding: 10, backgroundColor: '#EEF6EE', gap: 4 },
  ocrBoxWarn: { backgroundColor: '#FFF6E0' },
  ocrTitle: { fontFamily: fonts.bodySemi, fontSize: 13, color: theme.colors.textPrimary },
  ocrText: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: '#5A4A22' },
  ocrRef: { fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: theme.colors.textSecondary },
  field: { gap: 4 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  label: { flexShrink: 1, fontFamily: fonts.bodyMedium, fontSize: 13, color: theme.colors.textPrimary },
  required: { color: theme.colors.primary },
  lowTag: { fontFamily: fonts.bodyMedium, fontSize: 10, color: '#8A5A00' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
  },
  inputLow: { borderColor: '#E0A800', backgroundColor: '#FFF9E6' },
  inputError: { borderColor: theme.colors.primary },
  input: { flex: 1, paddingVertical: 10, fontFamily: fonts.body, fontSize: 14, color: theme.colors.textPrimary },
  unit: { fontFamily: fonts.bodyMedium, fontSize: 14, color: theme.colors.textSecondary },
  errorText: { fontFamily: fonts.body, fontSize: 11, color: theme.colors.primary },
  row2: { flexDirection: 'row', gap: 10 },
  attach: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  attachText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: theme.colors.primary },
  warnBox: { flexDirection: 'row', gap: 6, padding: 10, borderRadius: 8, backgroundColor: '#FFF1D6' },
  warnText: { flex: 1, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: '#6B4600' },
  note: { flexDirection: 'row', gap: 6, padding: 8, borderRadius: 8, backgroundColor: '#FBF6E9' },
  noteText: { flex: 1, fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: '#5A4A22' },
  formError: { fontFamily: fonts.bodyMedium, fontSize: 12, color: theme.colors.primary },
  saveBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  saveText: { fontFamily: fonts.bodySemi, fontSize: 15, color: '#FFFFFF' },
  disabled: { opacity: 0.6 },
  deleteBtn: { alignItems: 'center', paddingVertical: 10 },
  deleteText: { fontFamily: fonts.bodySemi, fontSize: 14, color: theme.colors.primary },
});
