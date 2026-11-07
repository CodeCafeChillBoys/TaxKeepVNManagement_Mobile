import React, { useEffect, useRef, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { DrumHeader } from '../../components/brand/DrumHeader';
import { useToast } from '../../components/ui/Toast';
import { expenseApi } from '../../api/expenseApi';
import { incomeSourceApi, IncomeSourceCrossCheckResult } from '../../api/incomeSourceApi';
import { useAuthStore } from '../../stores/useAuthStore';
import { DocumentReviewResponse } from '../../types/expense';
import { RootNavigationProp, RootStackParamList } from '../../navigation/types';
import { sanitizeUiMessage } from '../../utils/friendlyError';
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

export function WithholdingVoucherScreen() {
  const navigation = useNavigation<RootNavigationProp>();
  const { params } = useRoute<Route>();
  const { toast } = useToast();
  const user = useAuthStore((s) => s.user);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

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

  const pickImage = async (source: 'camera' | 'library') => {
    try {
      const perm =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        toast.warning(
          source === 'camera'
            ? 'Vui lòng cấp quyền truy cập máy ảnh trong phần Cài đặt thiết bị để chụp chứng từ.'
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
      setFile({
        uri: asset.uri,
        name: asset.fileName ?? `chungtu_khautru_${Date.now()}.jpg`,
        type: asset.mimeType ?? 'image/jpeg',
      });
      setUploadError('');
    } catch {
      toast.error('Chưa thể mở máy ảnh hoặc thư viện ảnh. Vui lòng thử lại.', 'Không mở được ảnh');
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length || !isMountedRef.current) return;
      const asset = result.assets[0];
      const name = asset.name || `chungtu_khautru_${Date.now()}.pdf`;
      const isPdf = name.toLowerCase().endsWith('.pdf') || asset.mimeType === 'application/pdf';
      setFile({ uri: asset.uri, name, type: asset.mimeType || (isPdf ? 'application/pdf' : 'image/jpeg') });
      setUploadError('');
    } catch {
      toast.error('Chưa thể mở trình chọn tệp tài liệu. Vui lòng thử lại.', 'Không chọn được tệp');
    }
  };

  const upload = async () => {
    if (!file) return;
    setUploading(true);
    setUploadError('');
    try {
      setStage('Đang khởi tạo kỳ tính thuế...');
      const period = await expenseApi.initOrGetPeriod(year, user?.id);
      if (!isMountedRef.current) return;

      setStage('Đang tải chứng từ lên...');
      const uploaded = await expenseApi.batchUploadDocuments(period.periodId, [file]);
      if (!isMountedRef.current) return;

      const docId = uploaded.documents[0]?.id;
      if (!docId) {
        throw new Error('Chưa nhận được thông tin chứng từ vừa tải lên. Vui lòng thử lại.');
      }

      let latest: DocumentReviewResponse | null = null;
      for (let attempt = 1; attempt <= POLL_ATTEMPTS; attempt++) {
        if (!isMountedRef.current) return;
        setStage(`Đang đọc thông tin chứng từ... (${attempt}/${POLL_ATTEMPTS})`);
        await wait(POLL_INTERVAL_MS);
        if (!isMountedRef.current) return;
        try {
          latest = await expenseApi.getDocumentById(period.periodId, docId);
          if (isExtractionFinished(latest.status)) break;
        } catch {
          // lỗi tạm thời khi kiểm tra trạng thái → thử lại lượt sau
        }
      }

      if (!isMountedRef.current) return;
      const extracted = latest && latest.status === 'EXTRACTED' ? latest : null;
      const base: DocumentReviewResponse =
        latest ??
        ({
          id: docId,
          periodId: period.periodId,
          fileUrl: '',
          status: 'UPLOADED',
          createdAt: '',
          items: [],
        } as DocumentReviewResponse);

      setPeriodId(period.periodId);
      setDoc(base);
      setExtractFailed(!extracted);
      setValues(fromVoucherDocument(base, year));
      setErrors({});
      setCheck(null);
    } catch (err) {
      if (!isMountedRef.current) return;
      const fallback = 'Chưa tải lên được chứng từ. Vui lòng kiểm tra kết nối mạng và thử lại.';
      setUploadError(sanitizeUiMessage(extractApiErrorMessage(err, fallback), fallback));
    } finally {
      if (isMountedRef.current) {
        setUploading(false);
        setStage('');
      }
    }
  };

  const setField = (field: VoucherFormField, text: string) => {
    setValues((v) => (v ? { ...v, [field]: text } : v));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
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
      if (!isMountedRef.current) return;
      setCheck(result);
    } catch (err) {
      if (!isMountedRef.current) return;
      const fallback = 'Không đối chiếu được số liệu lúc này. Vui lòng thử lại.';
      setFormError(sanitizeUiMessage(extractApiErrorMessage(err, fallback), fallback));
      return;
    } finally {
      if (isMountedRef.current) {
        setChecking(false);
      }
    }
    if (!result.isMatch) return;

    setSaving(true);
    try {
      await expenseApi.confirmDocumentReview(periodId, doc.id, toVoucherConfirmRequest(values, doc));
      if (!isMountedRef.current) return;
      toast.success(
        'Số liệu chứng từ khớp với thu nhập đã khai và đã được cập nhật vào nơi chi trả.',
        'Đã lưu chứng từ'
      );
      navigation.goBack();
    } catch (err) {
      if (!isMountedRef.current) return;
      const fallback = 'Không lưu được chứng từ khấu trừ. Vui lòng thử lại.';
      setFormError(sanitizeUiMessage(extractApiErrorMessage(err, fallback), fallback));
    } finally {
      if (isMountedRef.current) {
        setSaving(false);
      }
    }
  };

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
        <TouchableOpacity
          style={styles.pickBtn}
          onPress={() => pickImage('camera')}
          disabled={busy}
          testID="voucherPickCamera"
        >
          <Ionicons name="camera-outline" size={18} color={theme.colors.primary} />
          <Text style={styles.pickBtnText}>Chụp ảnh</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.pickBtn}
          onPress={() => pickImage('library')}
          disabled={busy}
          testID="voucherPickLibrary"
        >
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
          {extractFailed ? 'Chưa đọc được chứng từ — vui lòng nhập tay' : 'Đã đọc chứng từ — kiểm tra lại số liệu'}
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
              • {sanitizeUiMessage(m, m)}
            </Text>
          ))}
          <View style={styles.compare}>
            <Text style={styles.compareText}>Đã ghi nhận theo tháng: thu nhập {vnd(check.summedTotalIncome)}</Text>
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

      <TouchableOpacity
        style={[styles.primaryBtn, busy && styles.disabled]}
        onPress={confirm}
        disabled={busy}
        testID="voucherConfirmBtn"
      >
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
        <ScrollView
          contentContainerStyle={styles.scrollOuter}
          keyboardShouldPersistTaps="handled"
          testID="voucherScroll"
        >
          <View style={styles.content}>{values ? renderReviewStep() : renderUploadStep()}</View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  lead: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: theme.colors.textSecondary },
  sectionLabel: { fontFamily: fonts.bodySemi, fontSize: 13, color: theme.colors.textPrimary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
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
  pickBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pickBtn: {
    flex: 1,
    minWidth: 92,
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
  pickBtnText: { flexShrink: 1, fontFamily: fonts.bodySemi, fontSize: 12, color: theme.colors.primary },
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
  input: { flex: 1, minHeight: 42, paddingVertical: 10, fontFamily: fonts.body, fontSize: 14, color: theme.colors.textPrimary },
  unit: { fontFamily: fonts.bodyMedium, fontSize: 14, color: theme.colors.textSecondary, marginLeft: 4 },
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
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryText: { fontFamily: fonts.bodySemi, fontSize: 15, color: '#FFFFFF', textAlign: 'center' },
  disabled: { opacity: 0.6 },
});
