import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { HeaderMotif } from '../../components/common/HeaderMotif';
import { DrumPatternBackdrop } from '../../components/brand/DrumPatternBackdrop';
import { RootNavigationProp, RootStackParamList } from '../../navigation/types';
import { Card, Button, Separator } from '../../components/ui';
import {
  getExpertById,
  getSlotsForExpert,
  CONSULTATION_TOPICS,
  createBooking,
} from './expertMockData';
import { ConsultationBooking } from '../../types/expert';

type BookingRouteProp = RouteProp<RootStackParamList, 'ExpertBooking'>;

function formatCurrency(amount: number): string {
  return `${amount.toLocaleString('vi-VN')} đ`;
}

export const ExpertBookingScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const route = useRoute<BookingRouteProp>();
  const expertId = route.params?.expertId || 'exp-1';
  const initialSlotId = route.params?.slotId;

  const expert = useMemo(() => getExpertById(expertId), [expertId]);
  const allSlots = useMemo(
    () => getSlotsForExpert(expertId).filter((s) => s.isAvailable),
    [expertId]
  );

  // Group slots by date
  const dateList = useMemo(() => {
    const dates = Array.from(new Set(allSlots.map((s) => s.date)));
    return dates.sort();
  }, [allSlots]);

  const [selectedDate, setSelectedDate] = useState<string>(
    dateList[0] || '2026-09-30'
  );

  const availableSlotsOnDate = useMemo(() => {
    return allSlots.filter((s) => s.date === selectedDate);
  }, [allSlots, selectedDate]);

  const [selectedSlotId, setSelectedSlotId] = useState<string>(() => {
    if (initialSlotId) return initialSlotId;
    return availableSlotsOnDate[0]?.id || '';
  });

  const [selectedTopic, setSelectedTopic] = useState<string>(CONSULTATION_TOPICS[0]);
  const [problemDescription, setProblemDescription] = useState<string>('');
  const [attachedFiles, setAttachedFiles] = useState<Array<{ name: string; size: string }>>([
    { name: 'To_khai_quyet_toan_2026.pdf', size: '1.2 MB' },
  ]);

  if (!expert) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <HeaderMotif title="ĐẶT LỊCH TƯ VẤN" onBack={() => navigation.goBack()} />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Không tìm thấy thông tin chuyên gia.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const selectedSlot = allSlots.find((s) => s.id === selectedSlotId);

  const handleAddSampleDoc = () => {
    if (attachedFiles.length >= 3) {
      Alert.alert('Giới hạn tệp', 'Tối đa đính kèm 3 tệp chứng từ cho mỗi phiên.');
      return;
    }
    const sampleDocs = [
      { name: 'Bang_ke_chung_tu_khau_tru.xlsx', size: '420 KB' },
      { name: 'Hop_dong_lao_dong_2026.pdf', size: '2.1 MB' },
    ];
    const nextDoc = sampleDocs[attachedFiles.length - 1] || {
      name: `Chung_tu_dinh_kem_${Date.now().toString().slice(-4)}.pdf`,
      size: '850 KB',
    };
    setAttachedFiles([...attachedFiles, nextDoc]);
  };

  const handleRemoveDoc = (index: number) => {
    setAttachedFiles(attachedFiles.filter((_, i) => i !== index));
  };

  const handleProceedToPayment = () => {
    if (!selectedSlot) {
      Alert.alert('Chưa chọn giờ', 'Vui lòng chọn một khung giờ còn trống.');
      return;
    }

    const bookingId = `BK-${Date.now().toString().slice(-6)}`;
    const newBooking: ConsultationBooking = {
      bookingId,
      expertId: expert.id,
      expertName: expert.fullName,
      expertTitle: expert.title,
      date: selectedSlot.date,
      timeSlot: `${selectedSlot.startTime} - ${selectedSlot.endTime}`,
      topic: selectedTopic,
      problemDescription: problemDescription.trim() || 'Hỗ trợ nghiệp vụ thuế theo chuyên đề.',
      attachedFiles: attachedFiles.map((f, idx) => ({
        id: `att-${idx}`,
        name: f.name,
        size: 1024 * 1024,
        uri: `file://mock/${f.name}`,
        type: 'application/pdf',
      })),
      expertFee: expert.feePerSession,
      platformFee: 0,
      discountAmount: 0,
      totalAmount: expert.feePerSession,
      status: 'PENDING_PAYMENT',
      escrowStatus: 'HELD',
      createdAt: new Date().toISOString(),
    };

    createBooking(newBooking);

    navigation.navigate('ExpertPayment', { bookingId });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <DrumPatternBackdrop variant="soft" />
      <HeaderMotif title="ĐẶT LỊCH TƯ VẤN" onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* EXPERT MINI SUMMARY */}
        <Card style={styles.cleanCard}>
          <View style={styles.expertSummaryRow}>
            <View style={styles.avatarMini}>
              <Text style={styles.avatarMiniText}>
                {expert.fullName.trim().split(/\s+/).pop()?.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.expertSummaryInfo}>
              <Text style={styles.expertSummaryName}>{expert.fullName}</Text>
              <Text style={styles.expertSummaryTitle}>{expert.title}</Text>
              <Text style={styles.feeHighlight}>
                {formatCurrency(expert.feePerSession)} / {expert.sessionDurationMinutes} phút
              </Text>
            </View>
          </View>
        </Card>

        {/* STEP 1: CHỌN NGÀY VÀ KHUNG GIỜ */}
        <Card style={styles.cleanCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="calendar-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>1. Chọn ngày tư vấn</Text>
          </View>

          {/* DATE SELECTOR PILLS */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateScroll}>
            {dateList.map((d) => {
              const isSelected = d === selectedDate;
              return (
                <TouchableOpacity
                  key={d}
                  style={[styles.datePill, isSelected && styles.datePillSelected]}
                  onPress={() => {
                    setSelectedDate(d);
                    const slots = allSlots.filter((s) => s.date === d);
                    if (slots.length > 0) {
                      setSelectedSlotId(slots[0].id);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.datePillText, isSelected && styles.datePillTextSelected]}>
                    {d.slice(8)}/{d.slice(5, 7)}
                  </Text>
                  <Text style={[styles.datePillSub, isSelected && styles.datePillSubSelected]}>
                    Năm {d.slice(0, 4)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Separator style={styles.divider} />

          <View style={styles.sectionHeader}>
            <Ionicons name="time-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>Khung giờ trống (Lead-time &gt; 4h)</Text>
          </View>

          {availableSlotsOnDate.length === 0 ? (
            <Text style={styles.emptyText}>Không còn khung giờ trống trong ngày này.</Text>
          ) : (
            <View style={styles.slotGrid}>
              {availableSlotsOnDate.map((s) => {
                const isSelected = s.id === selectedSlotId;
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.slotItem, isSelected && styles.slotItemSelected]}
                    onPress={() => setSelectedSlotId(s.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="radio-button-on"
                      size={14}
                      color={isSelected ? theme.colors.primary : '#CBD5E1'}
                    />
                    <Text style={[styles.slotItemText, isSelected && styles.slotItemTextSelected]}>
                      {s.startTime} - {s.endTime}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </Card>

        {/* STEP 2: CHỦ ĐỀ TƯ VẤN */}
        <Card style={styles.cleanCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="list-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>2. Chủ đề tư vấn trọng tâm</Text>
          </View>

          <View style={styles.topicList}>
            {CONSULTATION_TOPICS.map((topic) => {
              const isSelected = topic === selectedTopic;
              return (
                <TouchableOpacity
                  key={topic}
                  style={[styles.topicChip, isSelected && styles.topicChipSelected]}
                  onPress={() => setSelectedTopic(topic)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={16}
                    color={isSelected ? theme.colors.primary : '#94A3B8'}
                  />
                  <Text style={[styles.topicText, isSelected && styles.topicTextSelected]}>
                    {topic}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        {/* STEP 3: MÔ TẢ VẮN TẮT CÂU HỎI */}
        <Card style={styles.cleanCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="create-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>3. Tóm tắt câu hỏi hoặc số liệu</Text>
          </View>

          <TextInput
            style={styles.textInputArea}
            placeholder="Tóm tắt ngắn gọn vấn đề để chuyên gia chuẩn bị giải pháp trước..."
            placeholderTextColor="#94A3B8"
            multiline
            numberOfLines={4}
            value={problemDescription}
            onChangeText={setProblemDescription}
            maxLength={300}
          />
          <Text style={styles.charCounter}>{problemDescription.length}/300 ký tự</Text>
        </Card>

        {/* STEP 4: ĐÍNH KÈM TÀI LIỆU (TÙY CHỌN) */}
        <Card style={styles.cleanCard}>
          <View style={styles.sectionHeaderBetween}>
            <View style={styles.sectionHeader}>
              <Ionicons name="document-attach-outline" size={16} color={theme.colors.primary} />
              <Text style={styles.sectionTitle}>4. Chứng từ gửi trước (Tùy chọn)</Text>
            </View>
            <TouchableOpacity
              onPress={handleAddSampleDoc}
              style={styles.addDocBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={14} color={theme.colors.primary} />
              <Text style={styles.addDocText}>Thêm tệp</Text>
            </TouchableOpacity>
          </View>

          {attachedFiles.length === 0 ? (
            <Text style={styles.emptyDocText}>Chưa có tài liệu đính kèm.</Text>
          ) : (
            <View style={styles.docList}>
              {attachedFiles.map((file, idx) => (
                <View key={idx} style={styles.docItem}>
                  <Ionicons name="document-text-outline" size={18} color={theme.colors.primary} />
                  <View style={styles.docInfo}>
                    <Text style={styles.docName} numberOfLines={1}>{file.name}</Text>
                    <Text style={styles.docSize}>{file.size} • Mã hóa chuẩn NDA</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleRemoveDoc(idx)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={18} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <View style={styles.ndaRow}>
            <Ionicons name="lock-closed" size={12} color="#0F766E" />
            <Text style={styles.ndaText}>
              Bảo mật NDA: Tài liệu chỉ phục vụ phiên tư vấn, cam kết không rò rỉ.
            </Text>
          </View>
        </Card>

        {/* STEP 5: TỔNG QUAN PHÍ */}
        <Card style={styles.cleanCard}>
          <View style={styles.feeBreakdownRow}>
            <Text style={styles.feeBreakdownLabel}>Thù lao chuyên gia (45 phút)</Text>
            <Text style={styles.feeBreakdownValue}>{formatCurrency(expert.feePerSession)}</Text>
          </View>
          <View style={styles.feeBreakdownRow}>
            <Text style={styles.feeBreakdownLabel}>Phí nền tảng TaxKeep</Text>
            <Text style={styles.feeBreakdownValueFree}>0 đ (Miễn phí)</Text>
          </View>

          <Separator style={styles.divider} />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Tổng chi phí tạm giữ</Text>
            <Text style={styles.totalValue}>{formatCurrency(expert.feePerSession)}</Text>
          </View>
        </Card>
      </ScrollView>

      {/* BOTTOM CTA BAR */}
      <View style={styles.bottomBar}>
        <View style={styles.holdInfoCol}>
          <Text style={styles.holdLabel}>Giữ slot trong 10 phút</Text>
          <Text style={styles.holdSub}>Bảo vệ thanh toán qua Escrow</Text>
        </View>

        <Button
          variant="default"
          onPress={handleProceedToPayment}
          style={styles.paymentCtaBtn}
          icon={<Ionicons name="arrow-forward" size={16} color="#FFFFFF" />}
        >
          Tiếp tục thanh toán
        </Button>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 96,
    gap: 12,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontFamily: fonts.primary,
  },
  cleanCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    marginVertical: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  expertSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarMini: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMiniText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: fonts.primary,
  },
  expertSummaryInfo: {
    flex: 1,
    gap: 2,
  },
  expertSummaryName: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    fontFamily: fonts.primary,
  },
  expertSummaryTitle: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontFamily: fonts.primary,
  },
  feeHighlight: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.primary,
    fontFamily: fonts.primary,
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sectionHeaderBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    fontFamily: fonts.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  dateScroll: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  datePill: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  datePillSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: '#8B1E1E0D',
  },
  datePillText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    fontFamily: fonts.primary,
  },
  datePillTextSelected: {
    color: theme.colors.primary,
  },
  datePillSub: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 2,
    fontFamily: fonts.primary,
  },
  datePillSubSelected: {
    color: theme.colors.primary,
  },
  divider: {
    marginVertical: 12,
    backgroundColor: theme.colors.border,
  },
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slotItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    minWidth: '45%',
    flex: 1,
  },
  slotItemSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: '#8B1E1E0D',
  },
  slotItemText: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.textPrimary,
    fontFamily: fonts.primary,
  },
  slotItemTextSelected: {
    fontWeight: '700',
    color: theme.colors.primary,
  },
  topicList: {
    gap: 6,
  },
  topicChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
  },
  topicChipSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: '#8B1E1E0D',
  },
  topicText: {
    flex: 1,
    fontSize: 12,
    color: theme.colors.textPrimary,
    fontFamily: fonts.primary,
  },
  topicTextSelected: {
    fontWeight: '600',
    color: theme.colors.primary,
  },
  textInputArea: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 6,
    padding: 10,
    fontSize: 13,
    fontFamily: fonts.primary,
    color: theme.colors.textPrimary,
    backgroundColor: '#FBFBFA',
    textAlignVertical: 'top',
    minHeight: 80,
  },
  charCounter: {
    fontSize: 11,
    color: theme.colors.textMuted,
    textAlign: 'right',
    marginTop: 4,
    fontFamily: fonts.primary,
  },
  addDocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  addDocText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.primary,
    fontFamily: fonts.primary,
  },
  emptyDocText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontFamily: fonts.primary,
    paddingVertical: 6,
  },
  docList: {
    gap: 8,
    marginVertical: 4,
  },
  docItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 6,
    padding: 8,
    backgroundColor: '#F8F5EE',
  },
  docInfo: {
    flex: 1,
  },
  docName: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    fontFamily: fonts.primary,
  },
  docSize: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 2,
    fontFamily: fonts.primary,
  },
  ndaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  ndaText: {
    fontSize: 11,
    color: '#0F766E',
    fontFamily: fonts.primary,
  },
  feeBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  feeBreakdownLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontFamily: fonts.primary,
  },
  feeBreakdownValue: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    fontFamily: fonts.primary,
  },
  feeBreakdownValueFree: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16A34A',
    fontFamily: fonts.primary,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    fontFamily: fonts.primary,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.primary,
    fontFamily: fonts.primary,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  holdInfoCol: {
    gap: 2,
  },
  holdLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
    fontFamily: fonts.primary,
  },
  holdSub: {
    fontSize: 10,
    color: theme.colors.textMuted,
    fontFamily: fonts.primary,
  },
  paymentCtaBtn: {
    flex: 1,
    borderRadius: 6,
    backgroundColor: theme.colors.primary,
    height: 44,
  },
});
