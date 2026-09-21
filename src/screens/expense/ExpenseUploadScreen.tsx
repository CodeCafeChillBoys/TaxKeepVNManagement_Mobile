import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { HeaderMotif } from '../../components/common/HeaderMotif';
import { RootNavigationProp, RootStackParamList } from '../../navigation/types';
import { expenseApi } from '../../api/expenseApi';
import { useExpenseStore } from '../../stores/useExpenseStore';
import { getDocumentTypeIcon } from './expenseGroupUtils';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Badge,
  Button,
  Separator,
} from '../../components/ui';



export const ExpenseUploadScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'ExpenseUpload'>>();
  const currentTaxYear = new Date().getFullYear();
  const targetYear = route.params?.targetYear || currentTaxYear;
  const periodId = route.params?.periodId;

  const { documentTypes, fetchDocumentTypes, isDocumentTypesLoading } = useExpenseStore();

  useEffect(() => {
    fetchDocumentTypes();
  }, []);

  const categoryOptions = useMemo(() => {
    const autoOption = {
      code: 'AUTO',
      name: 'Tự động nhận diện theo nội dung hóa đơn',
      icon: 'sparkles',
      badge: 'Khuyên dùng',
      badgeVariant: 'teal' as const,
      isTaxEligible: true,
    };

    const dynamicOptions = (documentTypes || []).map((t) => ({
      code: t.code,
      name: t.name,
      icon: getDocumentTypeIcon(t.code, t.name),
      badge: t.isTaxEligible ? 'Giảm trừ thuế' : undefined,
      badgeVariant: 'teal' as const,
      isTaxEligible: t.isTaxEligible,
    }));

    return [autoOption, ...dynamicOptions];
  }, [documentTypes]);

  const [selectedCategory, setSelectedCategory] = useState<string>('AUTO');
  const [selectedFile, setSelectedFile] = useState<{
    uri: string;
    name: string;
    type: string;
    size?: number;
  } | null>(null);
  const [processing, setProcessing] = useState<boolean>(false);
  const [processingStage, setProcessingStage] = useState<string>('');

  // 1. Chụp ảnh từ Camera
  const handleTakePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Cấp quyền camera', 'Vui lòng cho phép ứng dụng truy cập camera để chụp hóa đơn.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.85,
        allowsEditing: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedFile({
          uri: asset.uri,
          name: asset.fileName || `expense_${Date.now()}.jpg`,
          type: 'image/jpeg',
          size: asset.fileSize,
        });
      }
    } catch (err) {
      console.warn('Lỗi khi chụp camera:', err);
      Alert.alert('Lỗi', 'Không thể khởi động camera.');
    }
  };

  // 2. Chọn ảnh từ Thư viện
  const handlePickImage = async () => {
    // Trên nền tảng Web: trực tiếp mở picker hỗ trợ cả ảnh và PDF trong User Activation của sự kiện click
    if (Platform.OS === 'web') {
      await handlePickDocument();
      return;
    }
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Cấp quyền thư viện', 'Vui lòng cho phép truy cập thư viện ảnh để tải lên hóa đơn.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.85,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedFile({
          uri: asset.uri,
          name: asset.fileName || `expense_${Date.now()}.jpg`,
          type: 'image/jpeg',
          size: asset.fileSize,
        });
      }
    } catch (err: any) {
      console.warn('Lỗi chọn ảnh thư viện:', err);
      // Nếu người dùng chọn file PDF từ hộp thoại chọn file trên Web/Desktop
      if (
        err?.message?.includes('application/pdf') ||
        err?.message?.includes('Unsupported file type')
      ) {
        await handlePickDocument();
        return;
      }
      Alert.alert('Lỗi', 'Không thể chọn ảnh từ thư viện.');
    }
  };

  // 3. Chọn file PDF hoặc văn bản
  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const fileName = asset.name || `expense_${Date.now()}`;
        const isPdf = fileName.toLowerCase().endsWith('.pdf') || asset.mimeType === 'application/pdf';
        setSelectedFile({
          uri: asset.uri,
          name: fileName,
          type: asset.mimeType || (isPdf ? 'application/pdf' : 'image/jpeg'),
          size: asset.size,
        });
      }
    } catch (err) {
      console.warn('Lỗi chọn tệp PDF:', err);
      Alert.alert('Lỗi', 'Không thể chọn tệp tin.');
    }
  };

  // Xử lý gửi bóc tách OCR tức thì (Direct Sync OCR)
  const handleStartOcrExtraction = async () => {
    if (!selectedFile) {
      Alert.alert('Chưa chọn hóa đơn', 'Vui lòng chụp ảnh hoặc chọn tệp hóa đơn chi phí để bắt đầu.');
      return;
    }

    setProcessing(true);
    setProcessingStage('Đang tải hóa đơn & khởi tạo bóc tách AI...');

    try {
      let backendDocId: string | undefined = undefined;
      let backendFileUrl: string | undefined = undefined;

      // Nếu có kỳ thuế (periodId), tải file lên Backend để lưu trữ bản ghi Document chính thức
      if (periodId) {
        try {
          const batchRes = await expenseApi.batchUploadDocuments(periodId, [selectedFile]);
          if (batchRes?.documents && batchRes.documents.length > 0) {
            backendDocId = batchRes.documents[0].id;
            backendFileUrl = batchRes.documents[0].fileUrl;
          }
        } catch (uploadErr) {
          console.warn('Lưu trữ file lên backend chưa hoàn tất, tiếp tục bóc tách AI trực tiếp:', uploadErr);
        }
      }

      setProcessingStage('AI đang phân tích hóa đơn & bóc tách các dòng hàng...');

      const ocrResult = await expenseApi.extractDocumentDirectSync(selectedFile, documentTypes);

      if (backendDocId) {
        ocrResult.documentId = backendDocId;
      }
      if (backendFileUrl) {
        ocrResult.fileUrl = backendFileUrl;
      }
      ocrResult.periodId = periodId;
      ocrResult.extractedYear = targetYear;
      if (selectedCategory !== 'AUTO') {
        ocrResult.docTypeCode = selectedCategory;
        const matchedDocType = documentTypes.find((t) => t.code === selectedCategory);
        if (matchedDocType) {
          ocrResult.docTypeName = matchedDocType.name;
        }
      }

      setProcessing(false);
      // Chuyển sang màn Soát xét bóc tách chi tiết kèm periodId
      navigation.navigate('ExpenseReview', { ocrResult, periodId });
    } catch (err: any) {
      setProcessing(false);
      Alert.alert(
        'Đọc chứng từ không thành công',
        err?.message || 'Không thể đọc được nội dung hóa đơn. Vui lòng kiểm tra lại hình ảnh hoặc kết nối mạng.'
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <HeaderMotif title="TẢI LÊN HÓA ĐƠN CHI PHÍ" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* BANNER THÔNG TIN KỲ KÊ KHAI */}
        <View style={styles.yearNoticeRow}>
          <Text style={styles.yearNoticeLabel}>KỲ THUẾ ÁP DỤNG:</Text>
          <Badge variant="default" style={{ paddingHorizontal: 10, paddingVertical: 4 }}>
            NĂM {targetYear}
          </Badge>
        </View>

        {/* THẺ HƯỚNG DẪN CHỤP ẢNH CHUẨN */}
        <Card style={styles.guidelineCard}>
          <CardContent style={styles.guidelineContent}>
            <View style={styles.guidelineIconCircle}>
              <Ionicons name="information-circle" size={24} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.guidelineTitle}>Lưu ý khi chụp hoặc tải ảnh hóa đơn</Text>
              <Text style={styles.guidelineText}>
                • Đặt hóa đơn trên mặt phẳng đủ sáng, không bị lóa flash.{'\n'}
                • Chụp rõ nét mã số thuế, số hóa đơn và bảng danh mục hàng hóa / viện phí.{'\n'}
                • Hỗ trợ định dạng JPG, PNG hoặc tài liệu PDF (tối đa 10MB).
              </Text>
            </View>
          </CardContent>
        </Card>

        {/* KHUNG XEM TRƯỚC / KHU VỰC CHỌN TỆP */}
        <Card style={styles.uploadAreaCard}>
          <CardContent style={styles.uploadAreaContent}>
            {selectedFile ? (
              <View style={styles.previewContainer}>
                {selectedFile.type.includes('image') ? (
                  <Image source={{ uri: selectedFile.uri }} style={styles.previewImage} resizeMode="contain" />
                ) : (
                  <View style={styles.pdfPreviewBox}>
                    <Ionicons name="document-text" size={60} color={theme.colors.primary} />
                    <Text style={styles.pdfName} numberOfLines={2}>
                      {selectedFile.name}
                    </Text>
                    <Text style={styles.pdfSize}>
                      {selectedFile.size ? `${(selectedFile.size / 1024).toFixed(1)} KB` : 'Tài liệu PDF'}
                    </Text>
                  </View>
                )}

                <Button
                  variant="destructive"
                  size="sm"
                  onPress={() => setSelectedFile(null)}
                  disabled={processing}
                  style={styles.changeFileBtn}
                  icon={<Ionicons name="trash-outline" size={14} color="#FFFFFF" />}
                >
                  Chọn tệp khác
                </Button>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.placeholderBox}
                onPress={handlePickDocument}
                activeOpacity={0.85}
              >
                <View style={styles.placeholderIconRing}>
                  <Ionicons name="cloud-upload-outline" size={36} color={theme.colors.primary} />
                </View>
                <Text style={styles.placeholderTitle}>Chọn hóa đơn chi phí để xử lý</Text>
                <Text style={styles.placeholderSubtitle}>
                  Chạm để chọn tệp (Ảnh JPG, PNG hoặc PDF) hoặc chọn từ các nút bên dưới
                </Text>

                <View style={styles.actionButtonsRow}>
                  <Button
                    variant="default"
                    size="sm"
                    onPress={handleTakePhoto}
                    style={styles.actionBtnItem}
                    icon={<Ionicons name="camera" size={16} color="#FFFFFF" />}
                  >
                    Camera
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onPress={handlePickImage}
                    style={styles.actionBtnItem}
                    icon={<Ionicons name="images-outline" size={16} color="#0F172A" />}
                  >
                    Thư viện
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onPress={handlePickDocument}
                    style={styles.actionBtnItem}
                    icon={<Ionicons name="document-attach-outline" size={16} color="#0F172A" />}
                  >
                    Tệp PDF
                  </Button>
                </View>
              </TouchableOpacity>
            )}
          </CardContent>
        </Card>

        {/* LỰA CHỌN CHẾ ĐỘ PHÂN LOẠI CHỨNG TỪ (ĐỒNG BỘ CONFIG ADMIN) */}
        <Card style={styles.categorySectionCard}>
          <CardHeader>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <CardTitle>Chế độ phân loại chứng từ</CardTitle>
              {isDocumentTypesLoading && (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              )}
            </View>
            <CardDescription>
              Tự động nhận diện hoặc chỉ định loại chứng từ y tế / chi phí theo cấu hình hệ thống
            </CardDescription>
          </CardHeader>
          <CardContent style={{ paddingVertical: 4 }}>
            {categoryOptions.map((cat) => {
              const isSelected = selectedCategory === cat.code;
              return (
                <TouchableOpacity
                  key={cat.code}
                  style={[styles.categoryCard, isSelected && styles.categoryCardSelected]}
                  onPress={() => setSelectedCategory(cat.code)}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.categoryIconCircle,
                      isSelected && { backgroundColor: theme.colors.primary },
                    ]}
                  >
                    <Ionicons
                      name={cat.icon as any}
                      size={18}
                      color={isSelected ? '#FFFFFF' : theme.colors.primary}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                      <Text
                        style={[
                          styles.categoryCardName,
                          isSelected && styles.categoryCardNameSelected,
                        ]}
                      >
                        {cat.name}
                      </Text>
                      {cat.badge && (
                        <Badge variant={cat.badgeVariant || 'teal'}>
                          {cat.badge}
                        </Badge>
                      )}
                    </View>
                  </View>
                  <Ionicons
                    name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={isSelected ? theme.colors.primary : '#CBD5E1'}
                  />
                </TouchableOpacity>
              );
            })}
          </CardContent>
        </Card>

        {/* NÚT THỰC HIỆN BÓC TÁCH */}
        <View style={styles.submitSection}>
          <Button
            variant="default"
            size="lg"
            onPress={handleStartOcrExtraction}
            disabled={!selectedFile || processing}
            loading={processing}
            icon={<Ionicons name="sparkles" size={18} color="#FFFFFF" />}
            style={styles.submitBtn}
          >
            {processing ? processingStage : 'Bắt đầu đọc thông tin & Phân loại'}
          </Button>

          {processing && (
            <View style={styles.processingIndicatorBox}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={styles.processingStageText}>{processingStage}</Text>
            </View>
          )}
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F5EE',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  yearNoticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  yearNoticeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  guidelineCard: {
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  guidelineContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  guidelineIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFEBEE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guidelineTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  guidelineText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 18,
  },
  uploadAreaCard: {
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  uploadAreaContent: {
    paddingVertical: 16,
  },
  previewContainer: {
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: 240,
    borderRadius: 8,
    backgroundColor: '#0F172A',
  },
  pdfPreviewBox: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  pdfName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    textAlign: 'center',
    marginTop: 10,
  },
  pdfSize: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  changeFileBtn: {
    marginTop: 14,
  },
  placeholderBox: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  placeholderIconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFEBEE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  placeholderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  placeholderSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    marginBottom: 16,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    justifyContent: 'center',
  },
  actionBtnItem: {
    flex: 1,
    minHeight: 38,
  },
  categorySectionCard: {
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  categoryCardSelected: {
    borderColor: '#8B1E1E',
    backgroundColor: '#FFF8F8',
  },
  categoryIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FFEBEE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryCardName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  categoryCardNameSelected: {
    color: '#8B1E1E',
    fontWeight: '700',
  },
  submitSection: {
    marginTop: 4,
  },
  submitBtn: {
    width: '100%',
  },
  processingIndicatorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  processingStageText: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '600',
  },
});
