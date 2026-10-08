import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { GoldDoubleRule } from '../../components/brand/GoldDoubleRule';
import { RootNavigationProp, RootStackParamList } from '../../navigation/types';
import { consultationApi } from '../../api/consultationApi';
import type {
  ExpertDetailResponse,
  ExpertAvailableSlotDto,
  SpecializationDto,
  BookingPreviewResponse,
} from '../../types/consultation';
import {
  formatVnd,
  formatSessionType,
  formatVietnameseDate,
  formatTimeRange,
} from '../../types/consultation';

const MAX_ATTACHMENTS = 5;
const MAX_TOTAL_SIZE_MB = 25;

interface SelectedFile {
  uri: string;
  name: string;
  size: number;
  type: string;
  blob?: any;
}

export const BookingCreateScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'BookingCreate'>>();
  const { expertProfileId, initialSlotId, specializationId: initialSpecId } = route.params;

  const [expert, setExpert] = useState<ExpertDetailResponse | null>(null);
  const [availableSlots, setAvailableSlots] = useState<ExpertAvailableSlotDto[]>([]);
  const [specializations, setSpecializations] = useState<SpecializationDto[]>([]);

  // Form states
  const [selectedSlotId, setSelectedSlotId] = useState<string>(initialSlotId || '');
  const [selectedSpecId, setSelectedSpecId] = useState<number>(initialSpecId || 0);
  const [topicTitle, setTopicTitle] = useState('');
  const [problemDescription, setProblemDescription] = useState('');
  const [attachments, setAttachments] = useState<SelectedFile[]>([]);

  // Loading & Preview states
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [previewData, setPreviewData] = useState<BookingPreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Load initial expert, slots & specializations
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingInitial(true);
      try {
        const [detail, slots, specs] = await Promise.all([
          consultationApi.getExpertDetail(expertProfileId),
          consultationApi.getAvailableSlotsForBooking(expertProfileId, undefined, 14),
          consultationApi.getSpecializations(true),
        ]);

        if (mounted) {
          setExpert(detail);
          setAvailableSlots(slots);
          setSpecializations(specs);

          // Default specialization if not selected
          if (!initialSpecId && specs.length > 0) {
            setSelectedSpecId(specs[0].id);
          }
          // Default slot if specified or pick first
          if (!initialSlotId && slots.length > 0) {
            setSelectedSlotId(slots[0].id);
          }
        }
      } catch (err: any) {
        Alert.alert('Lỗi', err?.message || 'Không thể tải thông tin đặt lịch.');
      } finally {
        if (mounted) setLoadingInitial(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [expertProfileId, initialSlotId, initialSpecId]);

  // Dry-run preview calculation triggered when slot or specialization changes
  const runPreview = useCallback(async () => {
    if (!selectedSlotId || !selectedSpecId) return;

    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const res = await consultationApi.previewBooking({
        expertSlotId: selectedSlotId,
        specializationId: selectedSpecId,
      });
      setPreviewData(res);
      if (!res.isValid && res.validationMessage) {
        setPreviewError(res.validationMessage);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Không thể tính phí xem trước.';
      setPreviewError(msg);
      setPreviewData(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [selectedSlotId, selectedSpecId]);

  useEffect(() => {
    if (selectedSlotId && selectedSpecId) {
      runPreview();
    }
  }, [selectedSlotId, selectedSpecId, runPreview]);

  // Pick Document (PDF, Word, Images)
  const handlePickDocument = async () => {
    if (attachments.length >= MAX_ATTACHMENTS) {
      Alert.alert('Giới hạn tệp', `Chỉ được đính kèm tối đa ${MAX_ATTACHMENTS} tệp tin.`);
      return;
    }

    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets) {
        const newFiles: SelectedFile[] = [];
        let currentTotalBytes = attachments.reduce((sum, f) => sum + f.size, 0);

        for (const asset of res.assets) {
          if (attachments.length + newFiles.length >= MAX_ATTACHMENTS) {
            Alert.alert('Giới hạn tệp', `Đã đạt số lượng tối đa ${MAX_ATTACHMENTS} tệp.`);
            break;
          }

          const fileSize = asset.size || 0;
          if ((currentTotalBytes + fileSize) / (1024 * 1024) > MAX_TOTAL_SIZE_MB) {
            Alert.alert('Vượt dung lượng', `Tổng dung lượng tài liệu không được vượt quá ${MAX_TOTAL_SIZE_MB}MB.`);
            break;
          }

          currentTotalBytes += fileSize;
          newFiles.push({
            uri: asset.uri,
            name: asset.name || 'document',
            size: fileSize,
            type: asset.mimeType || 'application/octet-stream',
            blob: (asset as any).file,
          });
        }

        setAttachments((prev) => [...prev, ...newFiles]);
      }
    } catch (err) {
      console.warn('Pick document error:', err);
    }
  };

  // Pick Image from photo library
  const handlePickImage = async () => {
    if (attachments.length >= MAX_ATTACHMENTS) {
      Alert.alert('Giới hạn tệp', `Chỉ được đính kèm tối đa ${MAX_ATTACHMENTS} tệp tin.`);
      return;
    }

    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Quyền truy cập', 'Vui lòng cấp quyền truy cập thư viện ảnh để đính kèm chứng từ.');
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!res.canceled && res.assets) {
        const newFiles: SelectedFile[] = [];
        let currentTotalBytes = attachments.reduce((sum, f) => sum + f.size, 0);

        for (const asset of res.assets) {
          if (attachments.length + newFiles.length >= MAX_ATTACHMENTS) break;

          const fileSize = asset.fileSize || 500 * 1024; // fallback approx
          if ((currentTotalBytes + fileSize) / (1024 * 1024) > MAX_TOTAL_SIZE_MB) {
            Alert.alert('Vượt dung lượng', `Tổng dung lượng tài liệu không được vượt quá ${MAX_TOTAL_SIZE_MB}MB.`);
            break;
          }

          currentTotalBytes += fileSize;
          const fileName = asset.fileName || `anh_chung_tu_${Date.now()}.jpg`;
          newFiles.push({
            uri: asset.uri,
            name: fileName,
            size: fileSize,
            type: asset.mimeType || 'image/jpeg',
          });
        }

        setAttachments((prev) => [...prev, ...newFiles]);
      }
    } catch (err) {
      console.warn('Pick image error:', err);
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit Booking
  const handleSubmitBooking = async () => {
    if (!selectedSlotId) {
      Alert.alert('Thiếu thông tin', 'Vui lòng chọn một khung giờ tư vấn khả dụng.');
      return;
    }
    if (!selectedSpecId) {
      Alert.alert('Thiếu thông tin', 'Vui lòng chọn lĩnh vực cần tư vấn.');
      return;
    }
    if (!topicTitle.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tiêu đề tóm tắt buổi tư vấn.');
      return;
    }
    if (!problemDescription.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng mô tả chi tiết vấn đề / câu hỏi trọng tâm để chuyên gia chuẩn bị.');
      return;
    }
    if (previewError || (previewData && !previewData.isValid)) {
      Alert.alert(
        'Không thể đặt lịch',
        previewError || previewData?.validationMessage || 'Khung giờ này không khả dụng.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const result = await consultationApi.createBooking({
        expertSlotId: selectedSlotId,
        specializationId: selectedSpecId,
        topicTitle: topicTitle.trim(),
        problemDescription: problemDescription.trim(),
        attachments,
      });

      Alert.alert(
        'Đặt lịch thành công!',
        `Mã lịch hẹn: ${result.bookingCode}\nKhung giờ đã được tạm giữ 10 phút chờ thanh toán.`,
        [
          {
            text: 'Xem chi tiết lịch hẹn',
            onPress: () => {
              navigation.replace('BookingDetail', { bookingId: result.id });
            },
          },
        ]
      );
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Không thể khởi tạo lịch hẹn.';
      Alert.alert('Đặt lịch thất bại', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedSlot = useMemo(() => {
    return availableSlots.find((s) => s.id === selectedSlotId);
  }, [availableSlots, selectedSlotId]);

  const totalAttachmentMb = useMemo(() => {
    const bytes = attachments.reduce((sum, f) => sum + f.size, 0);
    return (bytes / (1024 * 1024)).toFixed(2);
  }, [attachments]);

  if (loadingInitial) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Đặt lịch tư vấn</Text>
          <View style={{ width: 38 }} />
        </View>
        <GoldDoubleRule />
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Đang chuẩn bị biểu mẫu đặt lịch...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* ── HEADER ── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Xác nhận đặt lịch tư vấn</Text>
        <View style={{ width: 38 }} />
      </View>
      <GoldDoubleRule />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* ── 1. EXPERT MINI SUMMARY ── */}
        {expert && (
          <View style={styles.expertSummaryCard}>
            <View style={styles.expertSummaryAvatarWrap}>
              {expert.avatarUrl ? (
                <Image source={{ uri: expert.avatarUrl }} style={styles.expertSummaryAvatar} />
              ) : (
                <View style={styles.expertSummaryAvatarPlaceholder}>
                  <Text style={styles.expertSummaryAvatarLetter}>
                    {expert.fullName.trim().charAt(expert.fullName.trim().length - 1)}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.expertSummaryInfo}>
              <Text style={styles.expertSummaryName}>{expert.fullName}</Text>
              <Text style={styles.expertSummaryJob}>{expert.jobTitle || 'Chuyên gia thuế'}</Text>
              <View style={styles.expertSummaryRatingRow}>
                <Ionicons name="star" size={13} color="#F59E0B" />
                <Text style={styles.expertSummaryRating}>
                  {expert.rating > 0 ? expert.rating.toFixed(1) : '5.0'}
                </Text>
                <Text style={styles.expertSummaryReviews}>({expert.totalReviews} đánh giá)</Text>
              </View>
            </View>
          </View>
        )}

        {/* ── 2. CHỌN KHUNG GIỜ LÀM VIỆC ── */}
        <View style={styles.formSection}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="time" size={18} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>Khung giờ tư vấn</Text>
            <Text style={styles.requiredMark}>*</Text>
          </View>
          <Text style={styles.sectionHint}>
            Khung giờ tuân thủ quy định đặt trước tối thiểu 4 tiếng (Lead-time)
          </Text>

          {availableSlots.length === 0 ? (
            <View style={styles.emptySlotWarning}>
              <Ionicons name="alert-circle" size={18} color="#D97706" />
              <Text style={styles.emptySlotWarningText}>
                Chuyên gia hiện không có khung giờ nào khả dụng. Vui lòng chọn chuyên gia khác.
              </Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.slotScrollWrap}
            >
              {availableSlots.map((slot) => {
                const isSelected = selectedSlotId === slot.id;
                const sInfo = formatSessionType(slot.sessionType);

                return (
                  <TouchableOpacity
                    key={slot.id}
                    style={[styles.slotItemCard, isSelected && styles.slotItemCardSelected]}
                    onPress={() => setSelectedSlotId(slot.id)}
                  >
                    <View style={styles.slotItemHeader}>
                      <Ionicons
                        name={sInfo.icon as any}
                        size={12}
                        color={isSelected ? '#FFFFFF' : sInfo.color}
                      />
                      <Text
                        style={[
                          styles.slotItemSessionName,
                          isSelected && styles.slotItemTextActive,
                        ]}
                      >
                        {sInfo.label}
                      </Text>
                    </View>
                    <Text
                      style={[styles.slotItemDateText, isSelected && styles.slotItemTextActive]}
                    >
                      {formatVietnameseDate(slot.slotDate)}
                    </Text>
                    <Text
                      style={[styles.slotItemTimeText, isSelected && styles.slotItemTextActive]}
                    >
                      {formatTimeRange(slot.startTime, slot.endTime)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* ── 3. CHỌN CHỦ ĐỀ CHUYÊN MÔN ── */}
        <View style={styles.formSection}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="bookmark" size={18} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>Chủ đề cần tư vấn</Text>
            <Text style={styles.requiredMark}>*</Text>
          </View>
          <Text style={styles.sectionHint}>Chọn đúng lĩnh vực để chuyên gia nghiên cứu trọng tâm</Text>

          <View style={styles.specChipsContainer}>
            {specializations.map((spec) => {
              const isSelected = selectedSpecId === spec.id;
              return (
                <TouchableOpacity
                  key={spec.id}
                  style={[styles.specPickChip, isSelected && styles.specPickChipActive]}
                  onPress={() => setSelectedSpecId(spec.id)}
                >
                  <Text
                    style={[styles.specPickChipText, isSelected && styles.specPickChipTextActive]}
                  >
                    {spec.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── 4. TIÊU ĐỀ & MÔ TẢ NỘI DUNG VẤN ĐỀ ── */}
        <View style={styles.formSection}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="document-text" size={18} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>Nội dung câu hỏi & Vấn đề</Text>
            <Text style={styles.requiredMark}>*</Text>
          </View>

          {/* Topic Title */}
          <Text style={styles.inputLabel}>Tiêu đề tóm tắt</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Ví dụ: Tư vấn quyết toán thuế TNCN có 2 nguồn thu nhập"
            placeholderTextColor="#999999"
            value={topicTitle}
            onChangeText={setTopicTitle}
            maxLength={150}
          />

          {/* Problem Description */}
          <Text style={[styles.inputLabel, { marginTop: 12 }]}>
            Mô tả chi tiết câu hỏi & Tình huống cụ thể
          </Text>
          <TextInput
            style={styles.textArea}
            placeholder="Vui lòng nêu rõ các thắc mắc, số liệu hoặc bối cảnh cần hỗ trợ để chuyên gia chuẩn bị tài liệu trước phiên tư vấn..."
            placeholderTextColor="#999999"
            value={problemDescription}
            onChangeText={setProblemDescription}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
        </View>

        {/* ── 5. ĐÍNH KÈM CHỨNG TỪ MẪU (TỐI ĐA 5 FILE, <= 25MB) ── */}
        <View style={styles.formSection}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="attach" size={18} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>Tài liệu / Chứng từ đính kèm</Text>
            <Text style={styles.sectionCounter}>
              ({attachments.length}/{MAX_ATTACHMENTS})
            </Text>
          </View>
          <Text style={styles.sectionHint}>
            Hỗ trợ file PDF, Ảnh chứng từ, Word (tối đa 5 tệp, tổng dung lượng &le; 25MB).
          </Text>

          {/* Action buttons to pick file */}
          <View style={styles.uploadBtnRow}>
            <TouchableOpacity style={styles.uploadPickBtn} onPress={handlePickDocument}>
              <Ionicons name="document-attach-outline" size={18} color={theme.colors.primary} />
              <Text style={styles.uploadPickBtnText}>Chọn tài liệu (PDF, Word)</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.uploadPickBtn} onPress={handlePickImage}>
              <Ionicons name="image-outline" size={18} color={theme.colors.primary} />
              <Text style={styles.uploadPickBtnText}>Chọn hình ảnh</Text>
            </TouchableOpacity>
          </View>

          {/* Attachments List */}
          {attachments.length > 0 && (
            <View style={styles.attachmentsListWrap}>
              <View style={styles.totalSizeRow}>
                <Text style={styles.totalSizeText}>
                  Tổng dung lượng: <Text style={styles.boldText}>{totalAttachmentMb} MB</Text> / 25 MB
                </Text>
              </View>

              {attachments.map((file, idx) => (
                <View key={idx} style={styles.fileChipRow}>
                  <Ionicons
                    name={file.type.includes('image') ? 'image' : 'document-text'}
                    size={20}
                    color={theme.colors.primary}
                    style={{ marginRight: 8 }}
                  />
                  <View style={styles.fileChipInfo}>
                    <Text style={styles.fileChipName} numberOfLines={1}>
                      {file.name}
                    </Text>
                    <Text style={styles.fileChipSize}>
                      {(file.size / 1024).toFixed(1)} KB
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleRemoveAttachment(idx)}
                    style={styles.removeFileBtn}
                  >
                    <Ionicons name="trash-outline" size={18} color={theme.colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── 6. DRY-RUN PREVIEW LIVE ESTIMATE CARD ── */}
        <View style={styles.previewCard}>
          <View style={styles.previewCardHeader}>
            <Ionicons name="calculator-outline" size={18} color={theme.colors.gold} />
            <Text style={styles.previewCardTitle}>Tóm tắt đặt lịch & Phí dự kiến</Text>
          </View>

          {previewLoading ? (
            <View style={styles.previewLoadingBox}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={styles.previewLoadingText}>Đang kiểm tra tính hợp lệ & tính phí...</Text>
            </View>
          ) : previewError ? (
            <View style={styles.previewErrorBox}>
              <Ionicons name="warning-outline" size={18} color={theme.colors.error} />
              <Text style={styles.previewErrorText}>{previewError}</Text>
            </View>
          ) : previewData ? (
            <View style={styles.previewBody}>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Chuyên gia:</Text>
                <Text style={styles.previewValueBold}>{previewData.expertFullName}</Text>
              </View>

              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Khung giờ:</Text>
                <Text style={styles.previewValue}>
                  {formatVietnameseDate(previewData.slotDate)} (
                  {formatTimeRange(previewData.startTime, previewData.endTime)})
                </Text>
              </View>

              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Hình thức:</Text>
                <Text style={styles.previewValue}>
                  {formatSessionType(previewData.sessionType).label} ({previewData.durationMinutes} phút)
                </Text>
              </View>

              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Chủ đề:</Text>
                <Text style={styles.previewValue}>{previewData.specializationName}</Text>
              </View>

              <View style={styles.previewDivider} />

              <View style={styles.previewFeeRow}>
                <Text style={styles.previewFeeLabel}>Tổng chi phí phiên tư vấn:</Text>
                <Text style={styles.previewFeeValue}>{formatVnd(previewData.totalFee)}</Text>
              </View>

              <View style={styles.holdNoticeBox}>
                <Ionicons name="lock-closed-outline" size={14} color="#B45309" />
                <Text style={styles.holdNoticeText}>
                  Khung giờ sẽ được tạm giữ 10 phút sau khi bấm xác nhận để bạn thực hiện thanh toán.
                </Text>
              </View>
            </View>
          ) : null}
        </View>

        {/* ── 7. SUBMIT BUTTON ── */}
        <TouchableOpacity
          style={[
            styles.submitBtn,
            (submitting || Boolean(previewError) || (previewData && !previewData.isValid)) &&
              styles.submitBtnDisabled,
          ]}
          onPress={handleSubmitBooking}
          disabled={submitting || Boolean(previewError)}
          accessibilityRole="button"
          accessibilityLabel="Xác nhận đặt lịch tư vấn"
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="shield-checkmark" size={18} color="#FFFFFF" />
              <Text style={styles.submitBtnText}>Xác nhận đặt lịch - Giữ chỗ 10 phút</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3EFE6',
  },
  headerTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 16,
    color: theme.colors.primary,
  },

  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },

  // Expert Summary Card
  expertSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  expertSummaryAvatarWrap: {
    marginRight: 12,
  },
  expertSummaryAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  expertSummaryAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#8B1E1E1F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  expertSummaryAvatarLetter: {
    fontFamily: fonts.serifBold,
    fontSize: 18,
    color: theme.colors.primary,
  },
  expertSummaryInfo: {
    flex: 1,
  },
  expertSummaryName: {
    fontFamily: fonts.serifBold,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  expertSummaryJob: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: theme.colors.primaryDark,
    marginTop: 1,
  },
  expertSummaryRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 3,
  },
  expertSummaryRating: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: '#D97706',
  },
  expertSummaryReviews: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#777777',
  },

  // Form Section
  formSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 14,
    color: theme.colors.primary,
  },
  requiredMark: {
    color: theme.colors.error,
    fontWeight: '700',
    fontSize: 14,
  },
  sectionCounter: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginLeft: 'auto',
  },
  sectionHint: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 2,
    marginBottom: 10,
  },

  emptySlotWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: 10,
    borderRadius: 8,
    gap: 6,
  },
  emptySlotWarningText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#B45309',
  },

  slotScrollWrap: {
    gap: 8,
    paddingVertical: 4,
  },
  slotItemCard: {
    width: 130,
    backgroundColor: '#FAF7F0',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E6DECE',
  },
  slotItemCardSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  slotItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  slotItemSessionName: {
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    color: '#555555',
  },
  slotItemDateText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#666666',
  },
  slotItemTimeText: {
    fontFamily: fonts.serifBold,
    fontSize: 13,
    color: theme.colors.textPrimary,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  slotItemTextActive: {
    color: '#FFFFFF',
  },

  // Specialization chips
  specChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  specPickChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F5EFE4',
    borderWidth: 1,
    borderColor: '#E4DAC7',
  },
  specPickChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  specPickChipText: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: theme.colors.textPrimary,
  },
  specPickChipTextActive: {
    color: '#FFFFFF',
  },

  // Inputs
  inputLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: theme.colors.inputBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: fonts.body,
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  textArea: {
    backgroundColor: theme.colors.inputBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.body,
    fontSize: 13,
    color: theme.colors.textPrimary,
    minHeight: 90,
  },

  // Upload buttons
  uploadBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  uploadPickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAF5EE',
    borderWidth: 1,
    borderColor: theme.colors.goldLight,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 6,
  },
  uploadPickBtnText: {
    fontFamily: fonts.bodySemi,
    fontSize: 11,
    color: theme.colors.primary,
  },

  attachmentsListWrap: {
    marginTop: 6,
    gap: 6,
  },
  totalSizeRow: {
    marginBottom: 4,
  },
  totalSizeText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  boldText: {
    fontFamily: fonts.bodyBold,
    color: theme.colors.textPrimary,
  },
  fileChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9F6F0',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#EAE2D2',
  },
  fileChipInfo: {
    flex: 1,
  },
  fileChipName: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: theme.colors.textPrimary,
  },
  fileChipSize: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: '#888888',
  },
  removeFileBtn: {
    padding: 4,
  },

  // Preview Card
  previewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: theme.colors.goldLight,
    ...theme.shadows.card,
  },
  previewCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  previewCardTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 14,
    color: theme.colors.primary,
  },
  previewLoadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  previewLoadingText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  previewErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    padding: 10,
    borderRadius: 6,
    gap: 6,
  },
  previewErrorText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 12,
    color: theme.colors.error,
  },
  previewBody: {
    gap: 6,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  previewLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#666666',
  },
  previewValue: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: theme.colors.textPrimary,
  },
  previewValueBold: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: theme.colors.primary,
  },
  previewDivider: {
    height: 1,
    backgroundColor: '#EAE3D5',
    marginVertical: 4,
  },
  previewFeeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewFeeLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  previewFeeValue: {
    fontFamily: fonts.serifBold,
    fontSize: 16,
    color: theme.colors.primary,
    fontVariant: ['tabular-nums'],
  },
  holdNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: 8,
    borderRadius: 6,
    gap: 6,
    marginTop: 6,
  },
  holdNoticeText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#92400E',
    lineHeight: 15,
  },

  // Submit
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
    ...theme.shadows.button,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: '#FFFFFF',
  },

  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 10,
  },
});
