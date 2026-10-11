import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { HeaderMotif } from '../../components/common/HeaderMotif';
import { DrumPatternBackdrop } from '../../components/brand/DrumPatternBackdrop';
import { RootNavigationProp, RootStackParamList } from '../../navigation/types';
import { expenseApi, mapDocumentReviewToOcrResult } from '../../api/expenseApi';
import { incomeSourceApi, IncomeSourceCrossCheckResult } from '../../api/incomeSourceApi';
import { useExpenseStore } from '../../stores/useExpenseStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { getDocumentTypeIcon, isWithholdingDocType } from './expenseGroupUtils';
import { Badge, useToast } from '../../components/ui';
import { Dialog } from '../../components/common/Dialog';
import { parseBackendError } from './expenseValidationUtils';

// Các bước trong luồng tải lên
type UploadStep = 1 | 2 | 3;

export const ExpenseUploadScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'ExpenseUpload'>>();
  const currentTaxYear = new Date().getFullYear();
  const targetYear = route.params?.targetYear || currentTaxYear;
  const periodId = route.params?.periodId;

  const { toast } = useToast();
  const { user } = useAuthStore();
  const {
    periods,
    documentTypes,
    fetchDocumentTypes,
    isDocumentTypesLoading,
    systemConfigs,
    fetchSystemConfigs,
    addOrUpdateDocument,
  } = useExpenseStore();

  const activePeriod = periods[targetYear];
  const isPeriodSubmitted = activePeriod?.status === 'SUBMITTED';

  useEffect(() => {
    fetchDocumentTypes();
    fetchSystemConfigs();
  }, []);

  const ineligibleCategories = useMemo(() => {
    return (documentTypes || []).filter((t) => !t.isTaxEligible);
  }, [documentTypes]);

  const [currentStep, setCurrentStep] = useState<UploadStep>(1);
  const selectedCategory = 'AUTO';
  const [showIneligibleModal, setShowIneligibleModal] = useState<boolean>(false);
  const [showUploadConfirm, setShowUploadConfirm] = useState<boolean>(false);
  const [showCancelFileConfirm, setShowCancelFileConfirm] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<{
    uri: string;
    name: string;
    type: string;
    size?: number;
    base64?: string;
  } | null>(null);

  const [processing, setProcessing] = useState<boolean>(false);
  const [processingStage, setProcessingStage] = useState<string>('');
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const [uploadError, setUploadError] = useState<{ title: string; message: string } | null>(null);

  // Chuyển bước khi chọn file
  useEffect(() => {
    if (selectedFile && currentStep === 1) {
      setCurrentStep(2);
    }
  }, [selectedFile]);

  // Kiểm tra tính hợp lệ của tệp theo quy định của hệ thống thuế
  const validateFile = (file: { name?: string; type?: string; size?: number }): boolean => {
    if (!file) {
      toast.warning('Vui lòng chọn hoặc chụp ảnh hóa đơn chứng từ.', 'Chưa chọn tệp');
      return false;
    }

    const name = (file.name || '').toLowerCase();
    const allowedExts = ['.jpg', '.jpeg', '.png', '.pdf'];
    const hasValidExt = allowedExts.some((ext) => name.endsWith(ext));
    const validMimes = [
      'image/jpeg',
      'image/jpg',
      'image/pjpeg',
      'image/png',
      'image/x-png',
      'application/pdf',
    ];
    const hasValidMime = !file.type || validMimes.includes(file.type.toLowerCase());

    if (!hasValidExt && !hasValidMime) {
      toast.error(
        'Định dạng tệp không được hỗ trợ. Vui lòng chỉ tải lên tệp ảnh (JPG, PNG) hoặc tệp PDF.',
        'Định dạng tệp không hợp lệ'
      );
      return false;
    }

    if (file.size && file.size > 10 * 1024 * 1024) {
      toast.error(
        `Dung lượng tệp (${(file.size / (1024 * 1024)).toFixed(1)}MB) vượt quá giới hạn 10MB cho phép.`,
        'Tệp vượt quá dung lượng'
      );
      return false;
    }

    return true;
  };

  const handleTakePhoto = async () => {
    if (isPeriodSubmitted) {
      toast.error(
        `Kỳ quyết toán thuế năm ${targetYear} đã hoàn tất và bị khóa. Không thể tải thêm chứng từ.`,
        'Kỳ tính thuế đã khóa'
      );
      return;
    }

    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        toast.warning('Vui lòng cho phép truy cập máy ảnh để chụp chứng từ.', 'Cần cấp quyền');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: false,
        base64: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const newFile = {
          uri: asset.uri,
          name: asset.fileName || `chung_tu_chup_${Date.now()}.jpg`,
          type: 'image/jpeg',
          size: asset.fileSize,
          base64: asset.base64 || undefined,
        };

        if (validateFile(newFile)) {
          setUploadError(null);
          setSelectedFile(newFile);
          toast.success('Đã chọn ảnh chụp thành công.', 'Đã tải ảnh lên');
        }
      }
    } catch (err) {
      toast.error('Không thể khởi động máy ảnh. Vui lòng thử lại.', 'Lỗi thiết bị');
    }
  };

  const handlePickImage = async () => {
    if (isPeriodSubmitted) {
      toast.error(
        `Kỳ quyết toán thuế năm ${targetYear} đã hoàn tất và bị khóa. Không thể tải thêm chứng từ.`,
        'Kỳ tính thuế đã khóa'
      );
      return;
    }

    if (Platform.OS === 'web') {
      await handlePickDocument();
      return;
    }
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        toast.warning('Vui lòng cho phép truy cập thư viện ảnh.', 'Cần cấp quyền');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.85,
        allowsMultipleSelection: false,
        base64: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const newFile = {
          uri: asset.uri,
          name: asset.fileName || `chung_tu_${Date.now()}.jpg`,
          type: 'image/jpeg',
          size: asset.fileSize,
          base64: asset.base64 || undefined,
        };

        if (validateFile(newFile)) {
          setUploadError(null);
          setSelectedFile(newFile);
          toast.success('Đã chọn ảnh từ thư viện thành công.', 'Đã tải ảnh lên');
        }
      }
    } catch (err: any) {
      if (err?.message?.includes('application/pdf') || err?.message?.includes('Unsupported file type')) {
        await handlePickDocument();
        return;
      }
      toast.error('Không thể chọn ảnh từ thư viện thiết bị.', 'Lỗi chọn tệp');
    }
  };

  const handlePickDocument = async () => {
    if (isPeriodSubmitted) {
      toast.error(
        `Kỳ quyết toán thuế năm ${targetYear} đã hoàn tất và bị khóa. Không thể tải thêm chứng từ.`,
        'Kỳ tính thuế đã khóa'
      );
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const fileName = asset.name || `chung_tu_${Date.now()}`;
        const isPdf = fileName.toLowerCase().endsWith('.pdf') || asset.mimeType === 'application/pdf';
        const newFile = {
          uri: asset.uri,
          name: fileName,
          type: asset.mimeType || (isPdf ? 'application/pdf' : 'image/jpeg'),
          size: asset.size,
        };

        if (validateFile(newFile)) {
          setUploadError(null);
          setSelectedFile(newFile);
          toast.success('Đã chọn tệp chứng từ thành công.', 'Đã chọn tệp');
        }
      }
    } catch (err) {
      toast.error('Không thể chọn tệp tài liệu.', 'Lỗi chọn tệp');
    }
  };

  const handleSubmit = () => {
    // 1. Kiểm tra trạng thái kỳ tính thuế (sau kết toán thì không cho phép up)
    if (isPeriodSubmitted) {
      toast.error(
        `Kỳ quyết toán thuế năm ${targetYear} đã hoàn tất và bị khóa. Quý khách không thể tải thêm chứng từ.`,
        'Kỳ tính thuế đã khóa'
      );
      return;
    }

    // 2. Kiểm tra chọn tệp
    if (!selectedFile) {
      toast.warning('Vui lòng chọn ảnh hoặc tệp hóa đơn chứng từ trước.', 'Chưa chọn tệp');
      return;
    }

    // 3. Kiểm tra định dạng & dung lượng
    if (!validateFile(selectedFile)) {
      return;
    }

    // Mở modal xác nhận trước khi gửi tải lên
    setShowUploadConfirm(true);
  };

  const executeUpload = async () => {
    setShowUploadConfirm(false);
    if (!selectedFile) return;

    setProcessing(true);
    setCurrentStep(3);
    setProcessingProgress(10);
    setProcessingStage('Đang kết nối hồ sơ quyết toán...');

    try {
      let activePeriodId = periodId || activePeriod?.periodId;
      if (!activePeriodId) {
        setProcessingStage('Đang kiểm tra thông tin kỳ tính thuế...');
        setProcessingProgress(20);
        const period = await expenseApi.createOrGetTaxPeriod(targetYear, user?.id);
        if (period.status === 'SUBMITTED') {
          setProcessing(false);
          setCurrentStep(1);
          toast.error(
            `Kỳ quyết toán thuế năm ${targetYear} đã hoàn tất và bị khóa. Quý khách không thể tải thêm chứng từ.`,
            'Kỳ tính thuế đã khóa'
          );
          return;
        }
        activePeriodId = period.periodId;
      }

      setProcessingStage('Đang tải tệp chứng từ...');
      setProcessingProgress(30);

      const uploadResult = await expenseApi.uploadDocument(
        activePeriodId!,
        selectedFile
      );

      if (!uploadResult?.documents || uploadResult.documents.length === 0) {
        throw new Error('Hệ thống không nhận được phản hồi về chứng từ tải lên.');
      }

      const uploadedDoc = uploadResult.documents[0];
      const docId = uploadedDoc.id;

      setProcessingStage('Đang phân loại chi phí giảm trừ...');
      setProcessingProgress(60);

      // Polling đợi hệ thống đọc thông tin
      let extractedDoc: any = null;
      const maxAttempts = 42;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        await new Promise((res) => setTimeout(res, 1500));
        try {
          const docDetail = await expenseApi.getDocumentById(activePeriodId!, docId);
          const validationErrors = Array.isArray(docDetail.validationErrors)
            ? docDetail.validationErrors
            : [];
          const firstValidationError = validationErrors[0];
          const firstValidationMsg = typeof firstValidationError === 'string'
            ? firstValidationError
            : (firstValidationError as any)?.message;
          const isWithholding = isWithholdingDocType(docDetail.docTypeCode, docDetail.docTypeName);
          // Đối với chứng từ khấu trừ: Năm áp dụng quyết toán là incomeYear (năm chi trả thu nhập ở mục [15]),
          // không phải năm lập chứng từ (invoiceDate / extractedYear).
          const effectiveDocYear = isWithholding
            ? (docDetail.incomeYear || docDetail.extractedYear || (typeof docDetail.invoiceDate === 'string' && /^\d{4}/.test(docDetail.invoiceDate) ? Number(docDetail.invoiceDate.slice(0, 4)) : undefined))
            : (docDetail.extractedYear || (typeof docDetail.invoiceDate === 'string' && /^\d{4}/.test(docDetail.invoiceDate) ? Number(docDetail.invoiceDate.slice(0, 4)) : undefined));
          const numTargetYear = Number(targetYear);
          const isYearMismatch = docDetail.isYearValid === false ||
            (effectiveDocYear !== undefined && effectiveDocYear !== numTargetYear);

          const matchedDocType = (documentTypes || []).find((t) => t.code === docDetail.docTypeCode);
          const isDocTypeNonEligible = (matchedDocType && !matchedDocType.isTaxEligible) || docDetail.isTaxEligible === false;

          const aiErrorMessage = isYearMismatch
            ? (isWithholding
                ? (effectiveDocYear && effectiveDocYear !== numTargetYear
                    ? `Chứng từ khấu trừ cho thu nhập năm ${effectiveDocYear}, không khớp với kỳ quyết toán thuế năm ${targetYear}. Quý khách vui lòng chọn kỳ quyết toán thuế năm ${effectiveDocYear} để tải lên.`
                    : `Thời điểm trả thu nhập ghi trên chứng từ khấu trừ không khớp với kỳ quyết toán thuế năm ${targetYear}. Quý khách vui lòng kiểm tra mục [15] trên chứng từ và chọn đúng năm tính thuế tương ứng.`)
                : (effectiveDocYear && effectiveDocYear !== numTargetYear
                    ? `Hóa đơn phát hành năm ${effectiveDocYear}, không khớp với kỳ tính thuế năm ${targetYear}.`
                    : `Năm lập trên hóa đơn không khớp với kỳ tính thuế năm ${targetYear}.`))
            : isDocTypeNonEligible
              ? (firstValidationMsg || 'Hóa đơn này không thuộc diện được giảm trừ thuế TNCN theo quy định.')
              : docDetail.docTypeCode === 'UNSUPPORTED'
                ? 'Hóa đơn tiêu dùng, bán lẻ không thuộc danh mục được giảm trừ thuế TNCN.'
              : docDetail.isIdentityValid === false
                ? 'Thông tin người mua không khớp với người nộp thuế hoặc người phụ thuộc trong hồ sơ.'
              : docDetail.status === 'FAILED' && !docDetail.docTypeCode
                ? 'Hóa đơn chưa đủ điều kiện kê khai giảm trừ thuế theo quy định.'
              : firstValidationMsg || 'Không thể xác thực tính hợp lệ của chứng từ.';
          const hasAiValidationError =
            isYearMismatch ||
            docDetail.isIdentityValid === false ||
            isDocTypeNonEligible ||
            validationErrors.length > 0 ||
            docDetail.docTypeCode === 'UNSUPPORTED';

          if (docDetail.status === 'EXTRACTED' && hasAiValidationError) {
            try {
              await expenseApi.deleteDocument(activePeriodId!, docId);
            } catch {
              // Dọn document lỗi là best-effort
            }
            setProcessing(false);
            setSelectedFile(null);
            setCurrentStep(1);
            setUploadError({
              title: isYearMismatch ? 'Sai kỳ tính thuế' : 'Chứng từ không hợp lệ',
              message: aiErrorMessage,
            });
            toast.error(
              aiErrorMessage,
              isYearMismatch ? 'Sai kỳ tính thuế' : 'Chứng từ không hợp lệ'
            );
            return;
          }

          if (docDetail.status === 'EXTRACTED') {
            extractedDoc = docDetail;
            break;
          }
          if (docDetail.status === 'FAILED') {
            try {
              await expenseApi.deleteDocument(activePeriodId!, docId);
            } catch {
              // Dọn document lỗi là best-effort
            }
            setProcessing(false);
            setSelectedFile(null);
            setCurrentStep(1);
            setUploadError({
              title: isYearMismatch ? 'Sai kỳ tính thuế' : 'Chứng từ không hợp lệ',
              message: aiErrorMessage,
            });
            toast.error(
              aiErrorMessage,
              isYearMismatch ? 'Sai kỳ tính thuế' : 'Chứng từ không hợp lệ'
            );
            return;
          }
        } catch (_) {}
        const pct = 60 + Math.round((attempt / maxAttempts) * 35);
        setProcessingProgress(pct);
        setProcessingStage('Đang kiểm tra và trích xuất dữ liệu hóa đơn...');
      }

      if (extractedDoc && extractedDoc.status === 'EXTRACTED') {
        const ocrResult = mapDocumentReviewToOcrResult(extractedDoc, targetYear, documentTypes, systemConfigs);
        ocrResult.originalFileUri = selectedFile?.uri;
        if (!ocrResult.docTypeCode || ocrResult.docTypeCode === 'UNSUPPORTED') {
          const defaultType = documentTypes?.find((t) => t.isTaxEligible) || documentTypes?.[0];
          if (defaultType) {
            ocrResult.docTypeCode = defaultType.code;
            ocrResult.docTypeName = defaultType.name;
          }
        }

        const isWithholding = isWithholdingDocType(ocrResult.docTypeCode, ocrResult.docTypeName);
        let autoCrossCheckResult: IncomeSourceCrossCheckResult | null = null;

        // Tự động đối chiếu số liệu ngay trong lúc tải lên nếu là chứng từ khấu trừ thuế TNCN
        if (isWithholding) {
          setProcessingStage('Đang tự động đối chiếu số liệu với hệ thống thu nhập...');
          setProcessingProgress(98);

          const compName = (ocrResult.sellerName || extractedDoc.sellerName || '').trim();
          const certTaxYear = ocrResult.incomeYear || ocrResult.extractedYear || targetYear;
          const certIncome = ocrResult.totalIncome ?? 0;
          const certTax = ocrResult.taxWithheld ?? 0;
          const certInsurance = ocrResult.insuranceDeducted ?? 0;

          if (compName && certTaxYear) {
            try {
              autoCrossCheckResult = await incomeSourceApi.crossCheck({
                companyName: compName,
                taxYear: certTaxYear,
                certificateTotalIncome: certIncome,
                certificateTaxWithheld: certTax,
                certificateInsuranceDeducted: certInsurance,
              });
            } catch (checkErr: any) {
              console.warn('[AutoCrossCheck on Upload] warn:', checkErr?.message);
            }
          }
        }

        ocrResult.crossCheckResult = autoCrossCheckResult;

        setProcessingProgress(100);
        setProcessing(false);

        // Thêm vào danh sách xét duyệt khi hoàn tất
        addOrUpdateDocument(targetYear, ocrResult);
        toast.success(
          isWithholding
            ? 'Chứng từ khấu trừ đã được trích xuất và đối chiếu số liệu tự động.'
            : 'Hóa đơn đã được đối soát thành công.',
          'Hoàn tất'
        );
        navigation.navigate('ExpenseReview', {
          ocrResult,
          periodId: activePeriodId,
          crossCheckResult: autoCrossCheckResult,
        });
      } else {
        setProcessingProgress(100);
        setProcessing(false);
        // Hết thời gian chờ
        setCurrentStep(1);
        setSelectedFile(null);
        setUploadError({
          title: 'Chưa hoàn tất nhận diện',
          message: 'Thời gian xử lý kéo dài hơn dự kiến. Quý khách vui lòng kiểm tra lại chất lượng ảnh và thử lại.',
        });
        toast.error(
          'Thời gian xử lý kéo dài hơn dự kiến. Quý khách vui lòng thử tải lại hoặc chụp rõ nét hơn.',
          'Chưa hoàn tất nhận diện'
        );
      }
    } catch (err: any) {
      console.error('[ExpenseUpload Error]:', err?.code, err?.message, err?.response?.status, err?.response?.data);
      setProcessing(false);
      setCurrentStep(selectedFile ? 2 : 1);
      const parsed = parseBackendError(err);
      setUploadError({ title: parsed.title, message: parsed.message });
      toast.error(parsed.message, parsed.title);
    }
  };

  const STEPS = [
    { num: 1, label: 'Chọn chứng từ' },
    { num: 2, label: 'Xác nhận' },
    { num: 3, label: 'Xử lý' },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <DrumPatternBackdrop variant="soft" />
      <HeaderMotif title="TẢI LÊN HÓA ĐƠN & CHỨNG TỪ" onBack={() => navigation.goBack()} />

      {/* STEP INDICATOR */}
      <View style={styles.stepRow}>
        {STEPS.map((step, idx) => {
          const isActive = currentStep === step.num;
          const isDone = currentStep > step.num;
          return (
            <React.Fragment key={step.num}>
              <View style={styles.stepItem}>
                <View
                  style={[
                    styles.stepCircle,
                    isActive && styles.stepCircleActive,
                    isDone && styles.stepCircleDone,
                  ]}
                >
                  {isDone ? (
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  ) : (
                    <Text style={[styles.stepNum, (isActive || isDone) && { color: '#fff' }]}>
                      {step.num}
                    </Text>
                  )}
                </View>
                <Text style={[styles.stepLabel, isActive && styles.stepLabelActive]}>
                  {step.label}
                </Text>
              </View>
              {idx < STEPS.length - 1 && (
                <View style={[styles.stepLine, currentStep > step.num && styles.stepLineDone]} />
              )}
            </React.Fragment>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* BANNER KỲ ĐÃ KẾT TOÁN / KHÓA */}
        {isPeriodSubmitted ? (
          <View style={styles.lockedBanner}>
            <Ionicons name="lock-closed" size={20} color="#DC2626" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.lockedBannerTitle}>Kỳ quyết toán thuế đã khóa</Text>
              <Text style={styles.lockedBannerDesc}>
                Kỳ tính thuế năm {targetYear} đã hoàn tất quyết toán và nộp cơ quan thuế. Hồ sơ đã được khóa, bạn không thể tải thêm hóa đơn chứng từ vào kỳ này.
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.yearBanner}>
            <Ionicons name="calendar-outline" size={14} color="#8B1E1E" />
            <Text style={styles.yearBannerText}>
              Hóa đơn & chứng từ cho kỳ quyết toán thuế năm {targetYear}
            </Text>
          </View>
        )}

        {uploadError && !processing && (
          <View style={styles.uploadErrorBanner}>
            <Ionicons name="alert-circle" size={21} color="#B91C1C" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.uploadErrorTitle}>{uploadError.title}</Text>
              <Text style={styles.uploadErrorMessage}>{uploadError.message}</Text>
              <Text style={styles.uploadErrorHint}>Quý khách vui lòng kiểm tra và tải lại chứng từ.</Text>
            </View>
            <TouchableOpacity
              onPress={() => setUploadError(null)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={18} color="#B91C1C" />
            </TouchableOpacity>
          </View>
        )}

        {/* BƯỚC 1 & 2: CHỌN FILE + PHÂN LOẠI (ẩn khi đang xử lý) */}
        {!processing && (
          <>
            {/* VÙNG CHỌN HÓA ĐƠN */}
            <View style={styles.uploadCard}>
              {selectedFile ? (
                <View style={styles.previewContainer}>
                  {selectedFile.type.includes('image') ? (
                    <Image source={{ uri: selectedFile.uri }} style={styles.previewImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.pdfPreview}>
                      <Ionicons name="document-text" size={48} color="#8B1E1E" />
                      <Text style={styles.pdfName} numberOfLines={2}>
                        {selectedFile.name}
                      </Text>
                      <Text style={styles.pdfSize}>
                        {selectedFile.size ? `${(selectedFile.size / 1024).toFixed(0)} KB` : 'Tài liệu PDF'}
                      </Text>
                    </View>
                  )}
                  <View style={styles.previewActions}>
                    <TouchableOpacity
                      style={styles.changeFileBtn}
                      disabled={isPeriodSubmitted}
                      onPress={() => setShowCancelFileConfirm(true)}
                    >
                      <Ionicons name="refresh-outline" size={14} color="#475569" />
                      <Text style={styles.changeFileBtnText}>Chọn tệp khác</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.uploadPlaceholder}>
                  <View style={[styles.uploadIconRing, isPeriodSubmitted && { backgroundColor: '#F1F5F9' }]}>
                    <Ionicons
                      name={isPeriodSubmitted ? 'lock-closed-outline' : 'cloud-upload-outline'}
                      size={32}
                      color={isPeriodSubmitted ? '#94A3B8' : '#8B1E1E'}
                    />
                  </View>
                  <Text style={styles.uploadTitle}>
                    {isPeriodSubmitted ? 'Kỳ tính thuế đã đóng' : 'Chọn ảnh hoặc tệp chứng từ'}
                  </Text>
                  <Text style={styles.uploadSubtitle}>
                    {isPeriodSubmitted
                      ? 'Hồ sơ năm này đã nộp cơ quan thuế và không thể nhận thêm chứng từ.'
                      : 'Hỗ trợ ảnh chụp JPG, PNG và tài liệu PDF (tối đa 10MB)'}
                  </Text>

                  {!isPeriodSubmitted && (
                    <View style={styles.uploadBtnRow}>
                      <TouchableOpacity
                        style={styles.uploadBtnItem}
                        onPress={handleTakePhoto}
                        activeOpacity={0.8}
                      >
                        <View style={[styles.uploadBtnIcon, { backgroundColor: '#8B1E1E' }]}>
                          <Ionicons name="camera" size={20} color="#fff" />
                        </View>
                        <Text style={styles.uploadBtnLabel}>Chụp ảnh</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.uploadBtnItem}
                        onPress={handlePickImage}
                        activeOpacity={0.8}
                      >
                        <View style={[styles.uploadBtnIcon, { backgroundColor: '#0284C7' }]}>
                          <Ionicons name="images-outline" size={20} color="#fff" />
                        </View>
                        <Text style={styles.uploadBtnLabel}>Thư viện</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.uploadBtnItem}
                        onPress={handlePickDocument}
                        activeOpacity={0.8}
                      >
                        <View style={[styles.uploadBtnIcon, { backgroundColor: '#D97706' }]}>
                          <Ionicons name="document-attach-outline" size={20} color="#fff" />
                        </View>
                        <Text style={styles.uploadBtnLabel}>Tệp PDF</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {!isPeriodSubmitted && (
                    <View style={styles.tipsRow}>
                      <Ionicons name="bulb-outline" size={13} color="#D97706" />
                      <Text style={styles.tipsText}>
                        Mẹo: Đặt hóa đơn ngay ngắn, chụp rõ mã số thuế, số hóa đơn và tổng tiền để hệ thống đọc thông tin nhanh chóng và chính xác.
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* BƯỚC 2: PHÂN LOẠI & XÁC NHẬN CHỨNG TỪ (hiện khi đã chọn file) */}
            {selectedFile && !isPeriodSubmitted && (
              <>
                {/* PHƯƠNG THỨC PHÂN LOẠI - Thẻ đơn phẳng, không lồng thẻ */}
                <View style={styles.methodCard}>
                  <View style={styles.methodHeader}>
                    <View style={styles.methodTitleRow}>
                      <View style={styles.methodIconWrap}>
                        <Ionicons name="sparkles" size={15} color="#8B1E1E" />
                      </View>
                      <Text style={styles.methodTitle}>Tự động phân loại</Text>
                      <Badge variant="teal" style={styles.methodBadge}>Mặc định</Badge>
                    </View>
                    <Ionicons name="radio-button-on" size={18} color="#8B1E1E" />
                  </View>
                  <Text style={styles.methodDesc}>
                    Hệ thống tự động nhận diện nội dung chứng từ và áp dụng danh mục giảm trừ thuế hợp lệ.
                  </Text>
                </View>

                {/* THÔNG TIN KHOẢN KHÔNG GIẢM TRỪ */}
                {ineligibleCategories.length > 0 && (
                  <TouchableOpacity
                    style={styles.ineligibleNoticeBanner}
                    onPress={() => setShowIneligibleModal(true)}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="information-circle-outline" size={16} color="#B45309" />
                    <Text style={styles.ineligibleNoticeBannerText}>
                      Hóa đơn tiêu dùng, ăn uống, mua sắm cá nhân... không thuộc diện giảm trừ thuế TNCN.{' '}
                      <Text style={styles.ineligibleNoticeLink}>Xem danh mục không giảm trừ</Text>
                    </Text>
                  </TouchableOpacity>
                )}

                {/* NÚT GỬI */}
                <TouchableOpacity
                  style={[styles.submitBtn, !selectedFile && styles.submitBtnDisabled]}
                  onPress={handleSubmit}
                  activeOpacity={0.85}
                >
                  <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                  <Text style={styles.submitBtnText}>Tiến hành xử lý</Text>
                </TouchableOpacity>
              </>
            )}
          </>
        )}

        {/* BƯỚC 3: ĐANG XỬ LÝ */}
        {processing && (
          <View style={styles.processingCard}>
            <View style={styles.processingIconCircle}>
              <ActivityIndicator size="large" color="#8B1E1E" />
            </View>
            <Text style={styles.processingTitle}>Đang xử lý chứng từ...</Text>
            <Text style={styles.processingStage}>{processingStage}</Text>

            {/* Progress bar */}
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${processingProgress}%` }]} />
            </View>
            <Text style={styles.progressPct}>{processingProgress}%</Text>

            <View style={styles.processingSteps}>
              {[
                { pct: 30, label: 'Tải tệp chứng từ' },
                { pct: 60, label: 'Phân loại chi phí' },
                { pct: 90, label: 'Đối soát thông tin' },
              ].map((s) => (
                <View key={s.pct} style={styles.processingStepItem}>
                  <Ionicons
                    name={processingProgress >= s.pct ? 'checkmark-circle' : 'ellipse-outline'}
                    size={15}
                    color={processingProgress >= s.pct ? '#16A34A' : '#CBD5E1'}
                  />
                  <Text
                    style={[
                      styles.processingStepText,
                      processingProgress >= s.pct && { color: '#16A34A', fontWeight: '600' },
                    ]}
                  >
                    {s.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* MODAL CHI TIẾT CÁC HÓA ĐƠN KHÔNG GIẢM TRỪ */}
      <Modal
        visible={showIneligibleModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowIneligibleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalHeaderTitleRow}>
                <Ionicons name="alert-circle" size={20} color="#D97706" />
                <Text style={styles.modalTitle}>Chi phí không được giảm trừ</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowIneligibleModal(false)}
                style={styles.modalCloseIconBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalNoticeBox}>
              <Ionicons name="information-circle" size={16} color="#B45309" style={{ marginTop: 1 }} />
              <Text style={styles.modalNoticeText}>
                Theo Luật Thuế TNCN, chỉ các khoản chi y tế, giáo dục và đóng góp từ thiện - nhân đạo mới đủ điều kiện khấu trừ thuế. Các hóa đơn sau không thuộc diện giảm trừ:
              </Text>
            </View>

            <ScrollView style={styles.modalScrollList} showsVerticalScrollIndicator={false}>
              {ineligibleCategories.map((item) => (
                <View key={item.code} style={styles.ineligibleListItem}>
                  <View style={styles.ineligibleListIconWrap}>
                    <Ionicons
                      name={getDocumentTypeIcon(item.code, item.name) as any}
                      size={18}
                      color="#64748B"
                    />
                  </View>
                  <View style={styles.ineligibleListContent}>
                    <View style={styles.ineligibleListNameRow}>
                      <Text style={styles.ineligibleListName}>{item.name}</Text>
                      <Badge variant="secondary" style={styles.ineligibleBadge}>
                        Không giảm trừ
                      </Badge>
                    </View>
                    {item.description ? (
                      <Text style={styles.ineligibleListDesc}>{item.description}</Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setShowIneligibleModal(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalCloseBtnText}>Đã hiểu</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* DIALOG XÁC NHẬN TẢI LÊN */}
      <Dialog
        visible={showUploadConfirm}
        title="Tải lên chứng từ"
        message={`Thêm chứng từ này vào hồ sơ năm ${targetYear}?`}
        detail={selectedFile?.name}
        primaryLabel="Tải lên"
        secondaryLabel="Hủy"
        onPrimary={executeUpload}
        onSecondary={() => setShowUploadConfirm(false)}
        onRequestClose={() => setShowUploadConfirm(false)}
      />

      {/* DIALOG XÁC NHẬN CHỌN TỆP KHÁC */}
      <Dialog
        visible={showCancelFileConfirm}
        title="Chọn tệp khác"
        message="Bỏ tệp đang chọn để chọn tệp mới?"
        primaryLabel="Đồng ý"
        secondaryLabel="Giữ lại"
        destructive={true}
        onPrimary={() => {
          setShowCancelFileConfirm(false);
          setSelectedFile(null);
          setCurrentStep(1);
        }}
        onSecondary={() => setShowCancelFileConfirm(false)}
        onRequestClose={() => setShowCancelFileConfirm(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  // Step indicator
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  stepItem: {
    alignItems: 'center',
    gap: 4,
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleActive: {
    backgroundColor: '#8B1E1E',
    borderColor: '#8B1E1E',
  },
  stepCircleDone: {
    backgroundColor: '#16A34A',
    borderColor: '#16A34A',
  },
  stepNum: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  stepLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '500',
  },
  stepLabelActive: {
    color: '#8B1E1E',
    fontWeight: '700',
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#E2E8F0',
    marginBottom: 16,
    marginHorizontal: 4,
  },
  stepLineDone: {
    backgroundColor: '#16A34A',
  },
  // Scroll
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
  },
  // Year banner
  yearBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF8F8',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  yearBannerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8B1E1E',
  },
  uploadErrorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FDA4AF',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 8,
  },
  uploadErrorTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9F1239',
    marginBottom: 2,
  },
  uploadErrorMessage: {
    fontSize: 12,
    color: '#881337',
    lineHeight: 16,
  },
  uploadErrorHint: {
    fontSize: 11,
    color: '#BE123C',
    fontWeight: '600',
    marginTop: 4,
  },
  // Locked banner
  lockedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 8,
  },
  lockedBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 2,
  },
  lockedBannerDesc: {
    fontSize: 12,
    color: '#7F1D1D',
    lineHeight: 16,
  },
  // Upload card
  uploadCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    marginBottom: 12,
  },
  previewContainer: {
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: 240,
    backgroundColor: '#0F172A',
  },
  pdfPreview: {
    width: '100%',
    paddingVertical: 36,
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
  },
  pdfName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  pdfSize: {
    fontSize: 12,
    color: '#64748B',
  },
  previewActions: {
    width: '100%',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  changeFileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  changeFileBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  uploadPlaceholder: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    gap: 8,
  },
  uploadIconRing: {
    width: 56,
    height: 56,
    borderRadius: 6,
    backgroundColor: '#FFEBEE',
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  uploadTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  uploadSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 16,
  },
  uploadBtnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    width: '100%',
  },
  uploadBtnItem: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  uploadBtnIcon: {
    width: 48,
    height: 48,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadBtnLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  tipsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 8,
    width: '100%',
  },
  tipsText: {
    flex: 1,
    fontSize: 11,
    color: '#92400E',
    lineHeight: 15,
  },
  // Method card (phẳng, đơn, không lồng)
  methodCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#8B1E1E',
    padding: 14,
    marginBottom: 12,
  },
  methodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  methodTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  methodIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#FFF8F8',
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  methodBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  methodDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
  // Ineligible notice banner (Độc lập, không lồng)
  ineligibleNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 6,
    padding: 12,
    marginBottom: 12,
  },
  ineligibleNoticeBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    lineHeight: 16,
  },
  ineligibleNoticeLink: {
    fontWeight: '700',
    color: '#B45309',
    textDecorationLine: 'underline',
  },
  // Submit button (Phẳng, không shadow)
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#8B1E1E',
    paddingVertical: 14,
    borderRadius: 6,
    marginBottom: 12,
  },
  submitBtnDisabled: {
    backgroundColor: '#CBD5E1',
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Processing card
  processingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    padding: 20,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  processingIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 6,
    backgroundColor: '#FFEBEE',
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  processingTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  processingStage: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#8B1E1E',
    borderRadius: 3,
  },
  progressPct: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8B1E1E',
  },
  processingSteps: {
    width: '100%',
    gap: 8,
    marginTop: 4,
  },
  processingStepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  processingStepText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  // Modal (Phẳng, bo góc 6, không shadow)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxHeight: '82%',
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    padding: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalCloseIconBtn: {
    padding: 4,
  },
  modalNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 6,
    padding: 10,
    marginVertical: 12,
  },
  modalNoticeText: {
    flex: 1,
    fontSize: 11.5,
    color: '#92400E',
    lineHeight: 16,
  },
  modalScrollList: {
    maxHeight: 320,
    marginBottom: 12,
  },
  ineligibleListItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 10,
  },
  ineligibleListIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  ineligibleListContent: {
    flex: 1,
  },
  ineligibleListNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  ineligibleListName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
  },
  ineligibleBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  ineligibleListDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 3,
    lineHeight: 15,
  },
  modalCloseBtn: {
    backgroundColor: '#8B1E1E',
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
