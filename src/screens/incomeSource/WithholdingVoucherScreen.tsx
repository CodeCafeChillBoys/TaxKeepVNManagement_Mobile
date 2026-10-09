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
import * as DocumentPicker from 'expo-document-picker';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { DrumHeader } from '../../components/brand/DrumHeader';
import { expenseApi } from '../../api/expenseApi';
import { incomeSourceApi, IncomeSourceCrossCheckResult } from '../../api/incomeSourceApi';
import { useAuthStore } from '../../stores/useAuthStore';
import { DocumentReviewResponse } from '../../types/expense';
import { RootNavigationProp, RootStackParamList } from '../../navigation/types';
import { extractApiErrorMessage, formatMoneyInput } from '../income/incomeFormUtils';
import {
  VoucherFormErrors,
  VoucherFormField,
  VoucherFormValues,
  fromVoucherDocument,
  isExtractionFinished,
  toCrossCheckRequest,
  toVoucherConfirmRequest,
  validateVoucherForm,
} from './withholdingVoucherUtils';

type Route = RouteProp<RootStackParamList, 'WithholdingVoucher'>;
type PickedFile = { uri: string; name: string; type: string };

const TAX_YEAR_OPTIONS = [2026, 2025, 2024];
const POLL_ATTEMPTS = 12;
const POLL_INTERVAL_MS = 1500;

const vnd = (n?: number | null) => `${Number(n ?? 0).toLocaleString('vi-VN')} đ`;
const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

/**
 * Tải chứng từ khấu trừ thuế TNCN (luồng riêng của Nơi chi trả, không đi qua màn hoá đơn chi phí).
 * B1 chọn năm + file → upload, chờ bóc tách. B2 kiểm tra số → cross-check với thu nhập theo tháng → khớp mới lưu.
 */
export function WithholdingVoucherScreen() {
  const navigation = useNavigation<RootNavigationProp>();
  const { params } = useRoute<Route>();
  const user = useAuthStore((s) => s.user);

  const [year, setYear] = useState<number>(params?.year ?? new Date().getFullYear());
  const [file, setFile] = useState<PickedFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [stage, setStage] = useState('');
  const [uploadError, setUploadError] = useState('');

  const [periodId, setPeriodId] = useState<string | null>(null);
  const [doc, setDoc] = useState<DocumentReviewResponse | null>(null);
  const [extractFailed, setExtractFailed] = useState(false);
  const [values, setValues] = useState<VoucherFormValues | null>(null);
  const [errors, setErrors] = useState<VoucherFormErrors>({});
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [check, setCheck] = useState<IncomeSourceCrossCheckResult | null>(null);

  const busy = uploading || checking || saving;

  // ── B1: chọn file ───────────────────────────────────────────────────────────
  const pickImage = async (source: 'camera' | 'library') => {
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
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      setFile({
        uri: asset.uri,
        name: asset.fileName ?? `chungtu_khautru_${Date.now()}.jpg`,
        type: asset.mimeType ?? 'image/jpeg',
      });
      setUploadError('');
    } catch {
      Alert.alert('Lỗi', 'Không thể mở camera hoặc thư viện ảnh.');
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      const name = asset.name || `chungtu_khautru_${Date.now()}.pdf`;
      const isPdf = name.toLowerCase().endsWith('.pdf') || asset.mimeType === 'application/pdf';
      setFile({ uri: asset.uri, name, type: asset.mimeType || (isPdf ? 'application/pdf' : 'image/jpeg') });
      setUploadError('');
    } catch {
      Alert.alert('Lỗi', 'Không thể chọn tệp.');
    }
  };

  // ── B1: tạo kỳ thuế → upload → chờ bóc tách ────────────────────────────────
  const upload = async () => {
    if (!file) return;
    setUploading(true);
    setUploadError('');
    try {
      setStage('Đang tạo kỳ tính thuế...');
      const period = await expenseApi.initOrGetPeriod(year, user?.id);

      setStage('Đang tải chứng từ lên...');
      const uploaded = await expenseApi.batchUploadDocuments(period.periodId, [file]);
      const docId = uploaded.documents[0]?.id;
      if (!docId) throw new Error('Máy chủ không trả về chứng từ vừa tải lên.');

      // BE tự đẩy việc bóc tách sau khi upload → chờ đến khi có kết quả
      let latest: DocumentReviewResponse | null = null;
      for (let attempt = 1; attempt <= POLL_ATTEMPTS; attempt++) {
        setStage(`Đang đọc thông tin chứng từ... (${attempt}/${POLL_ATTEMPTS})`);
        await wait(POLL_INTERVAL_MS);
        try {
          latest = await expenseApi.getDocumentById(period.periodId, docId);
          if (isExtractionFinished(latest.status)) break;
        } catch {
          // lỗi tạm thời khi hỏi trạng thái → thử lại lượt sau
        }
      }

      const extracted = latest && latest.status === 'EXTRACTED' ? latest : null;
      const base: DocumentReviewResponse =
        latest ?? ({ id: docId, periodId: period.periodId, fileUrl: '', status: 'UPLOADED', createdAt: '', items: [] } as DocumentReviewResponse);

      setPeriodId(period.periodId);
      setDoc(base);
      setExtractFailed(!extracted);
      setValues(fromVoucherDocument(base, year));
      setErrors({});
      setCheck(null);
    } catch (err) {
      setUploadError(extractApiErrorMessage(err, 'Tải chứng từ thất bại. Vui lòng thử lại.'));
    } finally {
      setUploading(false);
      setStage('');
    }
  };

  // ── B2: sửa số → cross-check → confirm ─────────────────────────────────────
  const setField = (field: VoucherFormField, text: string) => {
    setValues((v) => (v ? { ...v, [field]: text } : v));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
    // Số đã đổi thì kết quả đối chiếu cũ không còn đúng
    setCheck(null);
    if (formError) setFormError('');
  };

  const confirm = async () => {
    if (!values || !doc || !periodId) return;
    const e = validateVoucherForm(values);
    setErrors(e);
    if (Object.keys(e).length > 0) {
      setFormError('Vui lòng kiểm tra lại các ô được đánh dấu đỏ.');
      return;
    }

    setFormError('');
    setChecking(true);
    let result: IncomeSourceCrossCheckResult;
    try {
      result = await incomeSourceApi.crossCheck(toCrossCheckRequest(values));
      setCheck(result);
    } catch (err) {
      setFormError(extractApiErrorMessage(err, 'Không đối chiếu được số liệu. Vui lòng thử lại.'));
      return;
    } finally {
      setChecking(false);
    }
    // Lệch số → không lưu, để người dùng xem chênh lệch
    if (!result.isMatch) return;

    setSaving(true);
    try {
      await expenseApi.confirmDocumentReview(periodId, doc.id, toVoucherConfirmRequest(values, doc));
      Alert.alert('Đã lưu chứng từ', 'Số liệu chứng từ khớp với thu nhập đã khai và đã được cập nhật vào nơi chi trả.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      setFormError(extractApiErrorMessage(err, 'Không lưu được chứng từ. Vui lòng thử lại.'));
    } finally {
      setSaving(false);
    }
  };

  // ── Giao diện ───────────────────────────────────────────────────────────────
  const field = (
    name: VoucherFormField,
    label: string,
    opts: { money?: boolean; numeric?: boolean; placeholder?: string } = {}
  ) => (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        <Text style={styles.required}> *</Text>
      </Text>
      <View style={[styles.inputWrap, errors[name] && styles.inputError]}>
        <TextInput
          style={styles.input}
          value={values?.[name] ?? ''}
          onChangeText={(t) => setField(name, opts.money ? formatMoneyInput(t) : t)}
          keyboardType={opts.money || opts.numeric ? 'number-pad' : 'default'}
          placeholder={opts.placeholder}
          placeholderTextColor={theme.colors.textPlaceholder}
          editable={!busy}
          testID={`voucherInput_${name}`}
        />
        {opts.money ? <Text style={styles.unit}>đ</Text> : null}
      </View>
      {errors[name] ? <Text style={styles.errorText}>{errors[name]}</Text> : null}
    </View>
  );

  const renderUploadStep = () => (
    <>
      <Text style={styles.lead}>
        Tải chứng từ khấu trừ thuế TNCN do nơi chi trả cấp. Hệ thống sẽ đối chiếu với thu nhập theo tháng bạn đã khai
        trước khi lưu.
      </Text>

      <Text style={styles.sectionLabel}>Năm tính thuế</Text>
      <View style={styles.chips}>
        {TAX_YEAR_OPTIONS.map((yr) => {
          const on = yr === year;
          return (
            <TouchableOpacity
              key={yr}
              style={[styles.chip, on && styles.chipOn]}
              onPress={() => setYear(yr)}
              disabled={busy}
              testID={`voucherYear_${yr}`}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{yr}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>Chứng từ</Text>
      <View style={styles.pickBtns}>
        <TouchableOpacity style={styles.pickBtn} onPress={() => pickImage('camera')} disabled={busy} testID="voucherPickCamera">
          <Ionicons name="camera-outline" size={18} color={theme.colors.primary} />
          <Text style={styles.pickBtnText}>Chụp ảnh</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.pickBtn} onPress={() => pickImage('library')} disabled={busy} testID="voucherPickLibrary">
          <Ionicons name="images-outline" size={18} color={theme.colors.primary} />
          <Text style={styles.pickBtnText}>Chọn ảnh</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.pickBtn} onPress={pickDocument} disabled={busy} testID="voucherPickFile">
          <Ionicons name="document-outline" size={18} color={theme.colors.primary} />
          <Text style={styles.pickBtnText}>Tệp PDF</Text>
        </TouchableOpacity>
      </View>

      {file ? (
        <View style={styles.fileRow} testID="voucherSelectedFile">
          <Ionicons name="document-attach-outline" size={16} color={theme.colors.primary} />
          <Text style={styles.fileName} numberOfLines={1}>
            {file.name}
          </Text>
        </View>
      ) : null}

      {uploading ? (
        <View style={styles.progress}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.progressText}>{stage}</Text>
        </View>
      ) : null}

      {uploadError ? (
        <Text style={styles.formError} testID="voucherUploadError">
          {uploadError}
        </Text>
      ) : null}

      <TouchableOpacity
        style={[styles.primaryBtn, (!file || busy) && styles.disabled]}
        onPress={upload}
        disabled={!file || busy}
        testID="voucherUploadBtn"
      >
        {uploading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Tải lên và đọc chứng từ</Text>}
      </TouchableOpacity>
    </>
  );

  const renderReviewStep = () => (
    <>
      <View style={[styles.infoBox, extractFailed && styles.infoBoxWarn]} testID="voucherExtractStatus">
        <Text style={styles.infoTitle}>
          {extractFailed ? 'Chưa đọc được chứng từ — vui lòng nhập tay' : 'Đã đọc chứng từ — kiểm tra lại các số'}
        </Text>
        <Text style={styles.infoText}>
          Tên tổ chức phải trùng với tên nơi chi trả bạn đã khai ở phần thu nhập theo tháng thì mới đối chiếu được.
        </Text>
      </View>

      {field('companyName', 'Tổ chức chi trả', { placeholder: 'Ví dụ: Công ty Cổ phần ABC' })}
      {field('companyTaxCode', 'Mã số thuế tổ chức', { placeholder: '10 hoặc 13 chữ số' })}
      {field('taxYear', 'Năm', { numeric: true })}
      {field('totalIncome', 'Tổng thu nhập chịu thuế', { money: true, placeholder: '0' })}
      {field('taxWithheld', 'Thuế TNCN đã khấu trừ', { money: true, placeholder: '0' })}
      {field('insuranceDeducted', 'Bảo hiểm bắt buộc đã trừ', { money: true, placeholder: '0' })}

      {check && !check.isMatch ? (
        <View style={styles.mismatchBox} testID="voucherMismatch">
          <View style={styles.mismatchHead}>
            <Ionicons name="warning-outline" size={16} color="#8A2A00" />
            <Text style={styles.mismatchTitle}>Số liệu chưa khớp với thu nhập đã khai — chưa lưu</Text>
          </View>
          {check.mismatchMessages.map((m, i) => (
            <Text key={i} style={styles.mismatchText}>
              • {m}
            </Text>
          ))}
          <View style={styles.compare}>
            <Text style={styles.compareText}>Hệ thống đang có: thu nhập {vnd(check.summedTotalIncome)}</Text>
            <Text style={styles.compareText}>
              · thuế {vnd(check.summedTaxWithheld)} · bảo hiểm {vnd(check.summedInsuranceDeducted)}
            </Text>
          </View>
          <Text style={styles.mismatchHint}>
            Sửa lại số trên chứng từ nếu nhập sai, hoặc bổ sung các tháng còn thiếu ở mục "Theo tháng" rồi xác nhận lại.
          </Text>
        </View>
      ) : null}

      {formError ? (
        <Text style={styles.formError} testID="voucherFormError">
          {formError}
        </Text>
      ) : null}

      <TouchableOpacity style={[styles.primaryBtn, busy && styles.disabled]} onPress={confirm} disabled={busy} testID="voucherConfirmBtn">
        {busy ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.primaryText}>Đối chiếu và lưu chứng từ</Text>
        )}
      </TouchableOpacity>
    </>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <DrumHeader title="Chứng từ khấu trừ thuế" onBack={() => navigation.goBack()} backTestID="voucherBack" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" testID="voucherScroll">
          {values ? renderReviewStep() : renderUploadStep()}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  content: { padding: 20, paddingBottom: 40, gap: 12 },
  lead: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: theme.colors.textSecondary },
  sectionLabel: { fontFamily: fonts.bodySemi, fontSize: 13, color: theme.colors.textPrimary },
  chips: { flexDirection: 'row', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: theme.colors.surface,
  },
  chipOn: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: theme.colors.textPrimary },
  chipTextOn: { color: '#FFFFFF' },
  pickBtns: { flexDirection: 'row', gap: 8 },
  pickBtn: {
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
  pickBtnText: { fontFamily: fonts.bodySemi, fontSize: 12, color: theme.colors.primary },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fileName: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 12, color: theme.colors.textPrimary },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressText: { flex: 1, fontFamily: fonts.body, fontSize: 12, color: theme.colors.textSecondary },
  infoBox: { borderRadius: 10, padding: 10, backgroundColor: '#EEF6EE', gap: 4 },
  infoBoxWarn: { backgroundColor: '#FFF6E0' },
  infoTitle: { fontFamily: fonts.bodySemi, fontSize: 13, color: theme.colors.textPrimary },
  infoText: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: '#5A4A22' },
  field: { gap: 4 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 13, color: theme.colors.textPrimary },
  required: { color: theme.colors.primary },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
  },
  inputError: { borderColor: theme.colors.primary },
  input: { flex: 1, paddingVertical: 10, fontFamily: fonts.body, fontSize: 14, color: theme.colors.textPrimary },
  unit: { fontFamily: fonts.bodyMedium, fontSize: 14, color: theme.colors.textSecondary },
  errorText: { fontFamily: fonts.body, fontSize: 11, color: theme.colors.primary },
  mismatchBox: { borderRadius: 10, padding: 12, backgroundColor: '#FDEDE8', gap: 6 },
  mismatchHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mismatchTitle: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 13, color: '#8A2A00' },
  mismatchText: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: '#5A2A14' },
  compare: { paddingTop: 2 },
  compareText: { fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: theme.colors.textSecondary },
  mismatchHint: { fontFamily: fonts.bodyMedium, fontSize: 11, lineHeight: 16, color: '#5A4A22' },
  formError: { fontFamily: fonts.bodyMedium, fontSize: 12, color: theme.colors.primary },
  primaryBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryText: { fontFamily: fonts.bodySemi, fontSize: 15, color: '#FFFFFF' },
  disabled: { opacity: 0.6 },
});
