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
import { HeaderMotif } from '../../components/common/HeaderMotif';
import { RootNavigationProp, RootStackParamList } from '../../navigation/types';
import { expenseApi, mapDocumentReviewToOcrResult } from '../../api/expenseApi';
import { useExpenseStore } from '../../stores/useExpenseStore';
import { getDocumentTypeIcon } from './expenseGroupUtils';
import { Badge, useToast } from '../../components/ui';
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
  const { periods, documentTypes, fetchDocumentTypes, isDocumentTypesLoading, addOrUpdateDocument } = useExpenseStore();

  const activePeriod = periods[targetYear];
  const isPeriodSubmitted = activePeriod?.status === 'SUBMITTED';

  useEffect(() => {
    fetchDocumentTypes();
  }, []);

  const categoryOptions = useMemo(() => {
    const autoOption = {
      code: 'AUTO',
      name: 'Tự động phân loại (AI)',
      description: 'Hệ thống tự động đọc và phân loại theo nội dung chứng từ',
      icon: 'sparkles',
      badge: 'Khuyên dùng',
      badgeVariant: 'teal' as const,
      isTaxEligible: true,
    };

    const dynamicOptions = (documentTypes || [])
      .filter((t) => t.isTaxEligible)
      .map((t) => ({
        code: t.code,
        name: t.name,
        description: t.description || '',
        icon: getDocumentTypeIcon(t.code, t.name),
        badge: 'Được giảm trừ thuế',
        badgeVariant: 'teal' as const,
        isTaxEligible: true,
      }));

    return [autoOption, ...dynamicOptions];
  }, [documentTypes]);

  const ineligibleCategories = useMemo(() => {
    return (documentTypes || []).filter((t) => !t.isTaxEligible);
  }, [documentTypes]);

  const [currentStep, setCurrentStep] = useState<UploadStep>(1);
  const [selectedCategory, setSelectedCategory] = useState<string>('AUTO');
  const [showIneligibleModal, setShowIneligibleModal] = useState<boolean>(false);
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

  const handleSubmit = async () => {
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

    setProcessing(true);
    setCurrentStep(3);
    setProcessingProgress(10);
    setProcessingStage('Đang chuẩn bị kết nối hồ sơ quyết toán...');

    try {
      let activePeriodId = periodId;
      if (!activePeriodId) {
        setProcessingStage('Đang kiểm tra thông tin kỳ tính thuế...');
        setProcessingProgress(20);
        const period = await expenseApi.createOrGetTaxPeriod(targetYear);
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

      setProcessingStage('Đang tải tệp lên hệ thống lưu trữ...');
      setProcessingProgress(30);

      const uploadResult = await expenseApi.uploadDocument(
        activePeriodId!,
        selectedFile,
        selectedCategory !== 'AUTO' ? selectedCategory : undefined
      );

      if (!uploadResult?.documents || uploadResult.documents.length === 0) {
        throw new Error('Máy chủ không phản hồi thông tin chứng từ tải lên.');
      }

      const uploadedDoc = uploadResult.documents[0];
      const docId = uploadedDoc.id;

      setProcessingStage('Hệ thống đang phân loại danh mục giảm trừ...');
      setProcessingProgress(60);

      // Polling đợi hệ thống đọc thông tin (tăng lên 42 lần ~ 63s để đảm bảo nhận diện trực tiếp, hạn chế xử lý ngầm)
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
          const invoiceYear = docDetail.extractedYear ||
            (typeof docDetail.invoiceDate === 'string' && /^\d{4}/.test(docDetail.invoiceDate)
              ? Number(docDetail.invoiceDate.slice(0, 4))
              : undefined);
          const isYearMismatch = docDetail.isYearValid === false ||
            (invoiceYear !== undefined && invoiceYear !== targetYear);

          const matchedDocType = (documentTypes || []).find((t) => t.code === docDetail.docTypeCode);
          const isDocTypeNonEligible = (matchedDocType && !matchedDocType.isTaxEligible) || docDetail.isTaxEligible === false;

          const aiErrorMessage = isYearMismatch
            ? `Hóa đơn phát hành năm ${invoiceYear || 'không xác định'}, không khớp với kỳ tính thuế năm ${targetYear}.`
            : isDocTypeNonEligible
              ? (firstValidationMsg || `Loại chứng từ '${matchedDocType?.name || docDetail.docTypeCode}' không thuộc diện được giảm trừ thuế TNCN theo quy định.`)
              : docDetail.docTypeCode === 'UNSUPPORTED'
                ? 'Hóa đơn tiêu dùng/bán lẻ không thuộc danh mục được giảm trừ thuế TNCN theo quy định.'
              : docDetail.isIdentityValid === false
                ? 'Thông tin người mua trên hóa đơn không khớp với Người nộp thuế hoặc Người phụ thuộc trong hồ sơ.'
              : docDetail.status === 'FAILED' && !docDetail.docTypeCode
                ? 'AI nhận diện loại chứng từ chưa được Admin cho phép kê khai giảm trừ thuế.'
              : firstValidationMsg || 'AI không thể xác nhận tính hợp lệ của chứng từ.';
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
              // Dọn document lỗi là best-effort; vẫn bắt người dùng nhập/upload lại.
            }
            setProcessing(false);
            setSelectedFile(null);
            setCurrentStep(1);
            setUploadError({
              title: isYearMismatch ? 'Sai năm tính thuế' : 'Chứng từ không hợp lệ',
              message: `${aiErrorMessage} Vui lòng nhập lại và upload chứng từ khác.`,
            });
            toast.error(
              `${aiErrorMessage} Vui lòng nhập lại và upload chứng từ khác.`,
              isYearMismatch ? 'Sai năm tính thuế' : 'Chứng từ không hợp lệ'
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
              // Dọn document lỗi là best-effort; vẫn bắt người dùng upload lại.
            }
            setProcessing(false);
            setSelectedFile(null);
            setCurrentStep(1);
            const message = `${aiErrorMessage} Vui lòng nhập lại và upload chứng từ khác.`;
            setUploadError({
              title: isYearMismatch ? 'Sai năm tính thuế' : 'AI từ chối chứng từ',
              message,
            });
            toast.error(
              message,
              isYearMismatch ? 'Sai năm tính thuế' : 'AI từ chối chứng từ'
            );
            return;
          }
        } catch (_) {}
        const pct = 60 + Math.round((attempt / maxAttempts) * 35);
        setProcessingProgress(pct);
        setProcessingStage(`Đang nhận diện nội dung chứng từ... (lần ${attempt}/${maxAttempts})`);
      }

      setProcessingProgress(100);
      setProcessing(false);

      if (extractedDoc && extractedDoc.status === 'EXTRACTED') {
        const ocrResult = mapDocumentReviewToOcrResult(extractedDoc, targetYear, documentTypes);
        ocrResult.originalFileUri = selectedFile?.uri;
        if (selectedCategory !== 'AUTO') {
          ocrResult.docTypeCode = selectedCategory;
          const matchedDocType = documentTypes.find((t) => t.code === selectedCategory);
          if (matchedDocType) ocrResult.docTypeName = matchedDocType.name;
        } else if (!ocrResult.docTypeCode || ocrResult.docTypeCode === 'UNSUPPORTED') {
          const defaultType = documentTypes?.find((t) => t.isTaxEligible) || documentTypes?.[0];
          if (defaultType) {
            ocrResult.docTypeCode = defaultType.code;
            ocrResult.docTypeName = defaultType.name;
          }
        }

        // Chỉ thêm vào danh sách xét duyệt khi nhận diện thành công
        addOrUpdateDocument(targetYear, ocrResult);
        toast.success('Hóa đơn đã được đọc thông tin thành công.', 'Nhận diện hoàn tất');
        navigation.navigate('ExpenseReview', { ocrResult, periodId: activePeriodId });
      } else {
        // Hết thời gian chờ mà AI vẫn chưa kịp trả kết quả
        setCurrentStep(1);
        setSelectedFile(null);
        setUploadError({
          title: 'Quá thời gian nhận diện',
          message: 'Thời gian AI xử lý tài liệu vượt quá 60 giây. Vui lòng kiểm tra lại chất lượng ảnh và thử tải lại.',
        });
        toast.error(
          'Thời gian AI xử lý tài liệu vượt quá 60 giây. Vui lòng thử tải lại hoặc chụp rõ nét hơn.',
          'Quá thời gian nhận diện'
        );
      }
    } catch (err: any) {
      setProcessing(false);
      setCurrentStep(selectedFile ? 2 : 1);
      const parsed = parseBackendError(err);
      setUploadError({ title: parsed.title, message: parsed.message });
      toast.error(parsed.message, parsed.title);
      // Tuyệt đối không thêm vào danh sách chờ xét duyệt
    }
  };

  const STEPS = [
    { num: 1, label: 'Chọn chứng từ' },
    { num: 2, label: 'Phân loại' },
    { num: 3, label: 'Đang xử lý' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <HeaderMotif title="TẢI LÊN HÓA ĐƠN CHI PHÍ" onBack={() => navigation.goBack()} />

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
              Hóa đơn cho kỳ quyết toán thuế năm {targetYear}
            </Text>
          </View>
        )}

        {uploadError && !processing && (
          <View style={styles.uploadErrorBanner}>
            <Ionicons name="alert-circle" size={21} color="#B91C1C" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.uploadErrorTitle}>{uploadError.title}</Text>
              <Text style={styles.uploadErrorMessage}>{uploadError.message}</Text>
              <Text style={styles.uploadErrorHint}>Vui lòng chọn lại hóa đơn và upload lại.</Text>
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
                      onPress={() => {
                        setSelectedFile(null);
                        setCurrentStep(1);
                      }}
                    >
                      <Ionicons name="refresh-outline" size={14} color="#475569" />
                      <Text style={styles.changeFileBtnText}>Chọn hóa đơn khác</Text>
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

            {/* BƯỚC 2: PHÂN LOẠI CHỨNG TỪ (hiện khi đã chọn file) */}
            {selectedFile && !isPeriodSubmitted && (
              <View style={styles.categoryCard}>
                <View style={styles.categoryHeader}>
                  <View style={styles.categoryHeaderLeft}>
                    <Ionicons name="albums-outline" size={16} color="#8B1E1E" />
                    <Text style={styles.categoryTitle}>Danh mục chi phí giảm trừ</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {isDocumentTypesLoading && <ActivityIndicator size="small" color="#8B1E1E" />}
                    {ineligibleCategories.length > 0 && (
                      <TouchableOpacity
                        style={styles.ineligibleInfoBtn}
                        onPress={() => setShowIneligibleModal(true)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="alert-circle" size={14} color="#D97706" />
                        <Text style={styles.ineligibleInfoBtnText}>Khoản không giảm trừ (!)</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                <Text style={styles.categorySubtitle}>
                  Chỉ các danh mục đủ điều kiện giảm trừ thuế TNCN được đề xuất dưới đây.
                </Text>

                <View style={styles.categoryGrid}>
                  {categoryOptions.map((cat) => {
                    const isSelected = selectedCategory === cat.code;
                    return (
                      <TouchableOpacity
                        key={cat.code}
                        style={[styles.categoryItem, isSelected && styles.categoryItemSelected]}
                        onPress={() => setSelectedCategory(cat.code)}
                        activeOpacity={0.75}
                      >
                        <View
                          style={[
                            styles.categoryIconWrap,
                            isSelected && { backgroundColor: '#8B1E1E' },
                          ]}
                        >
                          <Ionicons
                            name={cat.icon as any}
                            size={16}
                            color={isSelected ? '#fff' : '#8B1E1E'}
                          />
                        </View>
                        <View style={{ flex: 1, marginLeft: 8 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                            <Text
                              style={[
                                styles.categoryName,
                                isSelected && styles.categoryNameSelected,
                              ]}
                              numberOfLines={1}
                            >
                              {cat.name}
                            </Text>
                            {cat.badge && (
                              <Badge variant={cat.badgeVariant} style={{ marginTop: 1 }}>
                                {cat.badge}
                              </Badge>
                            )}
                          </View>
                          {cat.description ? (
                            <Text style={styles.categoryDesc} numberOfLines={2}>
                              {cat.description}
                            </Text>
                          ) : null}
                        </View>
                        <Ionicons
                          name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                          size={18}
                          color={isSelected ? '#8B1E1E' : '#CBD5E1'}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {ineligibleCategories.length > 0 && (
                  <TouchableOpacity
                    style={styles.ineligibleNoticeBanner}
                    onPress={() => setShowIneligibleModal(true)}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="information-circle-outline" size={16} color="#B45309" />
                    <Text style={styles.ineligibleNoticeBannerText}>
                      Hóa đơn mua sắm, ăn uống, dịch vụ sinh hoạt... không thuộc diện giảm trừ thuế TNCN.{' '}
                      <Text style={styles.ineligibleNoticeLink}>Xem danh mục không giảm trừ (!)</Text>
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* NÚT GỬI */}
            {selectedFile && !isPeriodSubmitted && (
              <TouchableOpacity
                style={[styles.submitBtn, !selectedFile && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                activeOpacity={0.85}
              >
                <Ionicons name="sparkles" size={18} color="#fff" />
                <Text style={styles.submitBtnText}>Đọc thông tin & Lưu chứng từ</Text>
              </TouchableOpacity>
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
                { pct: 30, label: 'Tải tệp lên hệ thống' },
                { pct: 60, label: 'Phân loại danh mục giảm trừ' },
                { pct: 90, label: 'Nhận diện nội dung chứng từ' },
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
                Theo Luật Thuế TNCN hiện hành, thuế TNCN chỉ áp dụng giảm trừ đối với các khoản chi y tế, giáo dục và đóng góp từ thiện - nhân đạo. Các hóa đơn tiêu dùng dưới đây <Text style={{ fontWeight: '700' }}>KHÔNG thuộc diện được giảm trừ thuế</Text>:
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F5EE',
  },
  // Step indicator
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  stepItem: {
    alignItems: 'center',
    gap: 4,
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    borderWidth: 2,
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
    paddingBottom: 40,
  },
  // Year banner
  yearBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF8F8',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 14,
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
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  uploadErrorTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9F1239',
    marginBottom: 3,
  },
  uploadErrorMessage: {
    fontSize: 12,
    color: '#881337',
    lineHeight: 17,
  },
  uploadErrorHint: {
    fontSize: 11,
    color: '#BE123C',
    fontWeight: '600',
    marginTop: 5,
  },
  // Locked banner
  lockedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  lockedBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 3,
  },
  lockedBannerDesc: {
    fontSize: 12,
    color: '#7F1D1D',
    lineHeight: 17,
  },
  // Upload card
  uploadCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    marginBottom: 14,
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
    paddingVertical: 40,
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
    borderRadius: 8,
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
    paddingVertical: 28,
    paddingHorizontal: 20,
    gap: 8,
  },
  uploadIconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFEBEE',
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
  },
  uploadBtnRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 16,
  },
  uploadBtnItem: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  uploadBtnIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
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
    gap: 5,
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 8,
    width: '100%',
  },
  tipsText: {
    flex: 1,
    fontSize: 11,
    color: '#92400E',
    lineHeight: 15,
  },
  // Category card
  categoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 14,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  categoryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  categorySubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 14,
  },
  categoryGrid: {
    gap: 8,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  categoryItemSelected: {
    borderColor: '#8B1E1E',
    backgroundColor: '#FFF8F8',
  },
  categoryIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#FFEBEE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  categoryNameSelected: {
    color: '#8B1E1E',
    fontWeight: '700',
  },
  categoryDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 15,
  },
  ineligibleInfoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  ineligibleInfoBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  ineligibleNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  ineligibleNoticeBannerText: {
    flex: 1,
    fontSize: 11.5,
    color: '#92400E',
    lineHeight: 16,
  },
  ineligibleNoticeLink: {
    fontWeight: '700',
    color: '#B45309',
    textDecorationLine: 'underline',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxHeight: '82%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
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
    fontSize: 15,
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
    borderRadius: 10,
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
    maxHeight: 340,
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
    borderRadius: 8,
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
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Submit button
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#8B1E1E',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 14,
    shadowColor: '#8B1E1E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnDisabled: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  // Processing card
  processingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  processingIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFEBEE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  processingTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  processingStage: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#8B1E1E',
    borderRadius: 4,
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
});
