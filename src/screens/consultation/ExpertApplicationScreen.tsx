import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { GoldDoubleRule } from '../../components/brand/GoldDoubleRule';
import { Dialog } from '../../components/common/Dialog';
import { RootNavigationProp } from '../../navigation/types';
import { consultationApi } from '../../api/consultationApi';
import { useAuthStore } from '../../stores/useAuthStore';
import { toFriendlyConsultationError } from '../../utils/consultationFriendlyErrors';
import type {
  ExpertApplicationDetailResponse,
  SpecializationDto,
  ConsultationFeeConfigDto,
} from '../../types/consultation';
import {
  formatExpertApplicationStatus,
  formatCertStatus,
} from '../../types/consultation';

export const ExpertApplicationScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const currentUser = useAuthStore((s) => s.user);
  const userRole = (currentUser?.role || '').toLowerCase();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [application, setApplication] = useState<ExpertApplicationDetailResponse | null>(null);
  const [specializations, setSpecializations] = useState<SpecializationDto[]>([]);
  const [feeConfigs, setFeeConfigs] = useState<ConsultationFeeConfigDto[]>([]);

  // Form State
  const [fullName, setFullName] = useState(currentUser?.fullName || '');
  const [jobTitle, setJobTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [yearsOfExperience, setYearsOfExperience] = useState('3');
  const [bio, setBio] = useState('');
  const [experienceDescription, setExperienceDescription] = useState('');
  const [selectedSpecIds, setSelectedSpecIds] = useState<number[]>([]);

  // Fee Proposals (VNĐ / buổi 60 phút)
  const [onlineMeetingFee, setOnlineMeetingFee] = useState('200000');
  const [chatFee, setChatFee] = useState('100000');
  const [voiceCallFee, setVoiceCallFee] = useState('150000');

  // Dialog state
  const [dialog, setDialog] = useState<{
    title: string;
    message: string;
    primaryLabel?: string;
    onPrimary?: () => void;
    secondaryLabel?: string;
    onSecondary?: () => void;
    destructive?: boolean;
  } | null>(null);

  // Certificate Modal State
  const [certModalVisible, setCertModalVisible] = useState(false);
  const [certUploading, setCertUploading] = useState(false);
  const [certFile, setCertFile] = useState<any>(null);
  const [certType, setCertType] = useState('TAX_AGENT');
  const [certName, setCertName] = useState('');
  const [certNumber, setCertNumber] = useState('');
  const [issuingAuthority, setIssuingAuthority] = useState('');
  const [issueDate, setIssueDate] = useState('2023-01-01');

  const fetchApplicationData = useCallback(async () => {
    setLoading(true);
    try {
      const [appData, specs, fees] = await Promise.all([
        consultationApi.getMyApplication(),
        consultationApi.getSpecializations(true),
        consultationApi.getConsultationFeeConfigs({ isActive: true }),
      ]);

      setSpecializations(specs);
      setFeeConfigs(fees);

      if (appData) {
        setApplication(appData);
        setFullName(appData.fullName || currentUser?.fullName || '');
        setJobTitle(appData.jobTitle || '');
        setCompanyName(appData.companyName || '');
        setYearsOfExperience(String(appData.yearsOfExperience || 3));
        setBio(appData.bio || '');
        setExperienceDescription(appData.experienceDescription || '');
        setSelectedSpecIds(appData.specializations?.map((s) => s.id) || []);

        // Điền trước các mức phí đã đăng ký nếu có
        const meetingProposal = appData.feeProposals?.find(
          (p) => p.sessionType === 'ONLINE_MEETING'
        );
        if (meetingProposal) setOnlineMeetingFee(String(meetingProposal.proposedFee));

        const chatProposal = appData.feeProposals?.find((p) => p.sessionType === 'CHAT');
        if (chatProposal) setChatFee(String(chatProposal.proposedFee));

        const voiceProposal = appData.feeProposals?.find((p) => p.sessionType === 'VOICE_CALL');
        if (voiceProposal) setVoiceCallFee(String(voiceProposal.proposedFee));
      } else if (currentUser?.fullName) {
        setFullName(currentUser.fullName);
      }
    } catch (err: any) {
      const friendly = toFriendlyConsultationError(
        err,
        'Thông báo',
        'Không thể tải thông tin hồ sơ lúc này.'
      );
      setDialog({
        title: friendly.title,
        message: friendly.message,
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
    } finally {
      setLoading(false);
    }
  }, [currentUser?.fullName]);

  useEffect(() => {
    fetchApplicationData();
  }, [fetchApplicationData]);

  // Toggle Specialization
  const toggleSpecialization = (id: number) => {
    if (selectedSpecIds.includes(id)) {
      setSelectedSpecIds(selectedSpecIds.filter((item) => item !== id));
    } else {
      setSelectedSpecIds([...selectedSpecIds, id]);
    }
  };

  // Build Payload
  const buildDraftPayload = () => {
    return {
      fullName: fullName.trim(),
      jobTitle: jobTitle.trim(),
      companyName: companyName.trim() || undefined,
      bio: bio.trim() || undefined,
      yearsOfExperience: parseInt(yearsOfExperience, 10) || 0,
      experienceDescription: experienceDescription.trim(),
      specializationIds: selectedSpecIds,
      feeProposals: [
        {
          sessionType: 'ONLINE_MEETING' as const,
          durationMinutes: 60,
          proposedFee: parseFloat(onlineMeetingFee) || 0,
        },
        {
          sessionType: 'CHAT' as const,
          durationMinutes: 60,
          proposedFee: parseFloat(chatFee) || 0,
        },
        {
          sessionType: 'VOICE_CALL' as const,
          durationMinutes: 60,
          proposedFee: parseFloat(voiceCallFee) || 0,
        },
      ],
    };
  };

  // Lưu bản nháp
  const handleSaveDraft = async () => {
    if (!fullName.trim() || !jobTitle.trim()) {
      setDialog({
        title: 'Thông tin chưa đầy đủ',
        message: 'Vui lòng nhập Họ tên và Chức danh nghề nghiệp để lưu nháp.',
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
      return;
    }
    setSavingDraft(true);
    try {
      const payload = buildDraftPayload();
      const updated = await consultationApi.saveDraftApplication(payload);
      setApplication(updated);
      setDialog({
        title: 'Thành công',
        message: 'Đã lưu bản nháp hồ sơ chuyên gia thành công.',
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
    } catch (err: any) {
      const friendly = toFriendlyConsultationError(
        err,
        'Lưu nháp thất bại',
        'Không thể lưu bản nháp hồ sơ lúc này.'
      );
      setDialog({
        title: friendly.title,
        message: friendly.message,
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
    } finally {
      setSavingDraft(false);
    }
  };

  // Nộp hồ sơ chính thức
  const handleSubmitApplication = async () => {
    if (!fullName.trim() || !jobTitle.trim() || !experienceDescription.trim()) {
      setDialog({
        title: 'Thông tin chưa đầy đủ',
        message: 'Vui lòng hoàn thiện họ tên, chức danh và mô tả kinh nghiệm tư vấn trước khi nộp hồ sơ.',
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
      return;
    }
    if (selectedSpecIds.length === 0) {
      setDialog({
        title: 'Chưa chọn lĩnh vực',
        message: 'Vui lòng chọn ít nhất một lĩnh vực tư vấn trọng tâm.',
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
      return;
    }
    if (!application?.certificates || application.certificates.length === 0) {
      setDialog({
        title: 'Thiếu chứng chỉ',
        message: 'Vui lòng đính kèm ít nhất một chứng chỉ hành nghề thuế hợp lệ.',
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
      return;
    }

    setSubmitting(true);
    try {
      // Lưu bản nháp trước để đảm bảo dữ liệu mới nhất được cập nhật
      const payload = buildDraftPayload();
      await consultationApi.saveDraftApplication(payload);
      const res = await consultationApi.submitApplication();
      setApplication(res);
      setDialog({
        title: 'Nộp hồ sơ thành công',
        message: 'Hồ sơ đã được gửi thành công. Ban quản trị sẽ tiến hành thẩm định và phản hồi đến bạn.',
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
    } catch (err: any) {
      const friendly = toFriendlyConsultationError(
        err,
        'Nộp hồ sơ thất bại',
        'Không thể gửi hồ sơ thẩm định lúc này.'
      );
      setDialog({
        title: friendly.title,
        message: friendly.message,
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Chọn tệp đính kèm chứng chỉ
  const handlePickCertDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setCertFile({
          uri: file.uri,
          name: file.name,
          type: file.mimeType || 'application/pdf',
          file: (file as any).file,
        });
      }
    } catch (err: any) {
      setDialog({
        title: 'Lỗi chọn tệp',
        message: err?.message || 'Không thể chọn tệp chứng chỉ từ thiết bị.',
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
    }
  };

  // Tải lên chứng chỉ
  const handleUploadCertificate = async () => {
    if (!certFile) {
      setDialog({
        title: 'Chưa chọn tệp',
        message: 'Vui lòng chọn tệp chứng chỉ (ảnh hoặc PDF).',
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
      return;
    }
    if (!certName.trim() || !certNumber.trim() || !issuingAuthority.trim()) {
      setDialog({
        title: 'Thông tin chưa đầy đủ',
        message: 'Vui lòng nhập tên chứng chỉ, số hiệu và cơ quan cấp.',
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
      return;
    }

    setCertUploading(true);
    try {
      // Khởi tạo bản nháp nếu là hồ sơ mới hoàn toàn
      if (!application) {
        const payload = buildDraftPayload();
        await consultationApi.saveDraftApplication(payload);
      }

      await consultationApi.uploadApplicationCertificate(certFile, {
        certificateType: certType,
        certificateName: certName.trim(),
        certificateNumber: certNumber.trim(),
        issuingAuthority: issuingAuthority.trim(),
        issueDate: issueDate.trim(),
        hasExpiry: false,
      });

      // Tải lại thông tin hồ sơ
      const updated = await consultationApi.getMyApplication();
      if (updated) setApplication(updated);

      setCertModalVisible(false);
      setCertFile(null);
      setCertName('');
      setCertNumber('');
      setIssuingAuthority('');
      setDialog({
        title: 'Thành công',
        message: 'Đã tải lên và đính kèm chứng chỉ hành nghề.',
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
    } catch (err: any) {
      const friendly = toFriendlyConsultationError(
        err,
        'Lỗi tải chứng chỉ',
        'Không thể tải lên chứng chỉ lúc này.'
      );
      setDialog({
        title: friendly.title,
        message: friendly.message,
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
    } finally {
      setCertUploading(false);
    }
  };

  // Xóa chứng chỉ
  const handleDeleteCertificate = (certId: string) => {
    setDialog({
      title: 'Xác nhận xóa chứng chỉ',
      message: 'Bạn có chắc chắn muốn xóa chứng chỉ này khỏi hồ sơ?',
      primaryLabel: 'Xóa chứng chỉ',
      destructive: true,
      onPrimary: async () => {
        setDialog(null);
        try {
          await consultationApi.deleteApplicationCertificate(certId);
          const updated = await consultationApi.getMyApplication();
          if (updated) setApplication(updated);
        } catch (err: any) {
          const friendly = toFriendlyConsultationError(
            err,
            'Lỗi xóa chứng chỉ',
            'Không thể xóa chứng chỉ lúc này.'
          );
          setDialog({
            title: friendly.title,
            message: friendly.message,
            primaryLabel: 'Đã hiểu',
            onPrimary: () => setDialog(null),
          });
        }
      },
      secondaryLabel: 'Hủy',
      onSecondary: () => setDialog(null),
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Hồ sơ chuyên gia thuế</Text>
          <View style={{ width: 38 }} />
        </View>
        <GoldDoubleRule />
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Đang tải thông tin hồ sơ...</Text>
        </View>
        <Dialog
          visible={Boolean(dialog)}
          title={dialog?.title || ''}
          message={dialog?.message || ''}
          primaryLabel={dialog?.primaryLabel || 'Đã hiểu'}
          onPrimary={dialog?.onPrimary || (() => setDialog(null))}
          onRequestClose={() => setDialog(null)}
        />
      </SafeAreaView>
    );
  }

  const statusInfo = formatExpertApplicationStatus(application?.status);
  const isReadOnly =
    application?.status === 'PendingReview' || application?.status === 'Approved';
  const isExpert =
    userRole === 'expert' || userRole.includes('expert') || application?.status === 'Approved';

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
        <Text style={styles.headerTitle}>
          {isExpert ? 'Hồ sơ chuyên gia thuế' : 'Đăng ký chuyên gia thuế'}
        </Text>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={fetchApplicationData}
          accessibilityRole="button"
          accessibilityLabel="Làm mới"
        >
          <Ionicons name="refresh" size={20} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>
      <GoldDoubleRule />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── 1. TRẠNG THÁI HỒ SƠ ── */}
        <View style={[styles.statusBanner, { backgroundColor: statusInfo.bg }]}>
          <View style={styles.statusBannerRow}>
            <View style={styles.statusTitleLeft}>
              <Ionicons name={statusInfo.icon as any} size={18} color={statusInfo.color} />
              <Text style={[styles.statusBannerTitle, { color: statusInfo.color }]}>
                {statusInfo.label}
              </Text>
            </View>
            {application?.applicationNumber && (
              <View style={styles.appNumberBadge}>
                <Text style={styles.appNumberText}>Mã: #{application.applicationNumber}</Text>
              </View>
            )}
          </View>
          <Text style={styles.statusBannerDesc}>{statusInfo.desc}</Text>

          {/* Lý do yêu cầu bổ sung nếu có */}
          {application?.supplementRequestReason && (
            <View style={styles.noticeBox}>
              <Text style={styles.noticeLabel}>Yêu cầu bổ sung từ Quản trị viên:</Text>
              <Text style={styles.noticeText}>{application.supplementRequestReason}</Text>
            </View>
          )}

          {/* Lý do từ chối nếu có */}
          {application?.rejectionReason && (
            <View style={styles.noticeBox}>
              <Text style={styles.noticeLabel}>Lý do từ chối thẩm định:</Text>
              <Text style={styles.noticeText}>{application.rejectionReason}</Text>
            </View>
          )}

          {application?.status === 'Approved' && (
            <TouchableOpacity
              style={styles.gotoExpertDashboardBtn}
              onPress={() => navigation.navigate('ExpertBookings')}
            >
              <Ionicons name="briefcase-outline" size={16} color="#FFFFFF" />
              <Text style={styles.gotoExpertDashboardBtnText}>
                Đến trang quản lý ca tư vấn
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── 2. THÔNG TIN CÁ NHÂN & CHUYÊN MÔN ── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Thông tin cá nhân & Chuyên môn</Text>

          <Text style={styles.inputLabel}>Họ và tên chuyên gia *</Text>
          <TextInput
            style={styles.input}
            placeholder="VD: Nguyễn Văn An"
            placeholderTextColor="#9C9287"
            value={fullName}
            onChangeText={setFullName}
            editable={!isReadOnly}
          />

          <Text style={styles.inputLabel}>Chức danh / Nghề nghiệp *</Text>
          <TextInput
            style={styles.input}
            placeholder="VD: Chuyên viên tư vấn thuế cao cấp, Kế toán trưởng"
            placeholderTextColor="#9C9287"
            value={jobTitle}
            onChangeText={setJobTitle}
            editable={!isReadOnly}
          />

          <Text style={styles.inputLabel}>Cơ quan / Tổ chức công tác</Text>
          <TextInput
            style={styles.input}
            placeholder="VD: Công ty TNHH Tư vấn Thuế Á Châu"
            placeholderTextColor="#9C9287"
            value={companyName}
            onChangeText={setCompanyName}
            editable={!isReadOnly}
          />

          <Text style={styles.inputLabel}>Số năm kinh nghiệm tư vấn *</Text>
          <View style={styles.standaloneNumberWrap}>
            <TextInput
              style={styles.standaloneNumberInput}
              placeholder="3"
              placeholderTextColor="#9C9287"
              keyboardType="numeric"
              value={yearsOfExperience}
              onChangeText={setYearsOfExperience}
              editable={!isReadOnly}
            />
            <Text style={styles.standaloneNumberSuffix}>năm kinh nghiệm</Text>
          </View>

          <Text style={styles.inputLabel}>Giới thiệu bản thân</Text>
          <TextInput
            style={[styles.input, styles.bioInput]}
            placeholder="Tóm tắt quá trình hoạt động, thế mạnh chuyên môn, phương châm tư vấn của bạn..."
            placeholderTextColor="#9C9287"
            value={bio}
            onChangeText={setBio}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            editable={!isReadOnly}
          />

          <Text style={styles.inputLabel}>Mô tả kinh nghiệm tư vấn *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Mô tả cụ thể các lĩnh vực thuế chuyên sâu: quyết toán thuế TNCN, hoàn thuế, giải trình thanh tra thuế..."
            placeholderTextColor="#9C9287"
            value={experienceDescription}
            onChangeText={setExperienceDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            editable={!isReadOnly}
          />
        </View>

        {/* ── 3. LĨNH VỰC TƯ VẤN TRỌNG TÂM ── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Lĩnh vực tư vấn trọng tâm *</Text>
          <Text style={styles.sectionHelper}>
            Chọn các lĩnh vực thuế bạn có chứng chỉ và kinh nghiệm tư vấn thực tế.
          </Text>
          <View style={styles.specChipsWrap}>
            {specializations.map((spec) => {
              const isSelected = selectedSpecIds.includes(spec.id);
              return (
                <TouchableOpacity
                  key={spec.id}
                  style={[styles.specChip, isSelected && styles.specChipActive]}
                  onPress={() => !isReadOnly && toggleSpecialization(spec.id)}
                  disabled={isReadOnly}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={isSelected ? 'checkmark-circle' : 'add-circle-outline'}
                    size={16}
                    color={isSelected ? '#FFFFFF' : '#6B7280'}
                  />
                  <Text style={[styles.specChipText, isSelected && styles.specChipTextActive]}>
                    {spec.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── 4. ĐỀ XUẤT MỨC PHÍ TƯ VẤN ── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Mức phí tư vấn dự kiến (VNĐ / buổi 60 phút)</Text>
          <Text style={styles.sectionHelper}>
            Đề xuất mức phí cho từng hình thức tư vấn trực tuyến.
          </Text>

          <View style={styles.feeGroup}>
            <View style={styles.feeItem}>
              <View style={styles.feeHeader}>
                <Ionicons name="videocam-outline" size={16} color={theme.colors.primary} />
                <Text style={styles.feeLabel}>Họp trực tuyến (Gọi video)</Text>
              </View>
              <View style={styles.feeInputWrap}>
                <TextInput
                  style={styles.feeInput}
                  keyboardType="numeric"
                  value={onlineMeetingFee}
                  onChangeText={setOnlineMeetingFee}
                  editable={!isReadOnly}
                  placeholder="200000"
                  placeholderTextColor="#9C9287"
                />
                <Text style={styles.feeCurrencySuffix}>VNĐ</Text>
              </View>
            </View>

            <View style={styles.feeItem}>
              <View style={styles.feeHeader}>
                <Ionicons name="chatbubbles-outline" size={16} color={theme.colors.primary} />
                <Text style={styles.feeLabel}>Nhắn tin tư vấn</Text>
              </View>
              <View style={styles.feeInputWrap}>
                <TextInput
                  style={styles.feeInput}
                  keyboardType="numeric"
                  value={chatFee}
                  onChangeText={setChatFee}
                  editable={!isReadOnly}
                  placeholder="100000"
                  placeholderTextColor="#9C9287"
                />
                <Text style={styles.feeCurrencySuffix}>VNĐ</Text>
              </View>
            </View>

            <View style={styles.feeItem}>
              <View style={styles.feeHeader}>
                <Ionicons name="call-outline" size={16} color={theme.colors.primary} />
                <Text style={styles.feeLabel}>Gọi thoại trực tiếp</Text>
              </View>
              <View style={styles.feeInputWrap}>
                <TextInput
                  style={styles.feeInput}
                  keyboardType="numeric"
                  value={voiceCallFee}
                  onChangeText={setVoiceCallFee}
                  editable={!isReadOnly}
                  placeholder="150000"
                  placeholderTextColor="#9C9287"
                />
                <Text style={styles.feeCurrencySuffix}>VNĐ</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── 5. CHỨNG CHỈ HÀNH NGHỀ & BẰNG CẤP ── */}
        <View style={styles.sectionCard}>
          <View style={styles.certHeaderRow}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.sectionTitle}>Chứng chỉ hành nghề *</Text>
              <Text style={styles.certSubtitle}>Chứng chỉ CPA hoặc Chứng chỉ Đại lý thuế</Text>
            </View>
            {!isReadOnly && (
              <TouchableOpacity
                style={styles.addCertBtn}
                onPress={() => setCertModalVisible(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={15} color="#FFFFFF" />
                <Text style={styles.addCertBtnText}>Thêm chứng chỉ</Text>
              </TouchableOpacity>
            )}
          </View>

          {application?.certificates && application.certificates.length > 0 ? (
            application.certificates.map((cert) => {
              const certSt = formatCertStatus(cert.verificationStatus);
              return (
                <View key={cert.id} style={styles.certItemRow}>
                  <View style={styles.certIconWrap}>
                    <Ionicons name="ribbon-outline" size={22} color={theme.colors.primary} />
                  </View>
                  <View style={styles.certItemInfo}>
                    <Text style={styles.certName}>{cert.certificateName}</Text>
                    <Text style={styles.certDetails}>
                      Số: {cert.certificateNumber} • Cấp bởi: {cert.issuingAuthority}
                    </Text>
                    <View style={[styles.certBadge, { backgroundColor: certSt.bg }]}>
                      <Text style={[styles.certBadgeText, { color: certSt.color }]}>
                        {certSt.label}
                      </Text>
                    </View>
                  </View>

                  {!isReadOnly && (
                    <TouchableOpacity
                      onPress={() => handleDeleteCertificate(cert.id)}
                      style={styles.deleteCertBtn}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="trash-outline" size={18} color={theme.colors.error} />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          ) : (
            <View style={styles.emptyCertBox}>
              <Ionicons name="document-text-outline" size={32} color="#A8A29E" />
              <Text style={styles.emptyCertText}>
                Chưa đính kèm chứng chỉ nào. Bắt buộc có ít nhất một chứng chỉ hành nghề thuế để được duyệt hồ sơ.
              </Text>
            </View>
          )}
        </View>

        {/* ── 6. NÚT THAO TÁC (LƯU NHÁP & NỘP HỒ SƠ) ── */}
        {!isReadOnly && (
          <View style={styles.actionsWrap}>
            <TouchableOpacity
              style={styles.saveDraftBtn}
              onPress={handleSaveDraft}
              disabled={savingDraft || submitting}
              activeOpacity={0.8}
            >
              {savingDraft ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <>
                  <Ionicons name="save-outline" size={17} color={theme.colors.primary} />
                  <Text style={styles.saveDraftBtnText}>Lưu nháp</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleSubmitApplication}
              disabled={savingDraft || submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="paper-plane" size={16} color="#FFFFFF" />
                  <Text style={styles.submitBtnText}>Nộp hồ sơ</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* ── MODAL THÊM CHỨNG CHỈ ── */}
      <Modal
        visible={certModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCertModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Ionicons name="ribbon" size={22} color={theme.colors.primary} />
              <Text style={styles.modalTitle}>Thêm chứng chỉ hành nghề</Text>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Tệp chứng chỉ (Ảnh hoặc PDF) *</Text>
              <TouchableOpacity style={styles.pickFileBtn} onPress={handlePickCertDocument}>
                <Ionicons name="cloud-upload-outline" size={20} color={theme.colors.primary} />
                <Text style={styles.pickFileBtnText} numberOfLines={1}>
                  {certFile ? certFile.name : 'Chọn tệp từ điện thoại...'}
                </Text>
              </TouchableOpacity>

              <Text style={styles.inputLabel}>Loại chứng chỉ *</Text>
              <View style={styles.certTypeRow}>
                {[
                  { key: 'TAX_AGENT', label: 'Đại lý thuế' },
                  { key: 'CPA', label: 'Kiểm toán viên' },
                  { key: 'OTHER', label: 'Chứng chỉ khác' },
                ].map((type) => (
                  <TouchableOpacity
                    key={type.key}
                    style={[styles.certTypeBtn, certType === type.key && styles.certTypeBtnActive]}
                    onPress={() => setCertType(type.key)}
                  >
                    <Text
                      style={[
                        styles.certTypeBtnText,
                        certType === type.key && styles.certTypeBtnTextActive,
                      ]}
                    >
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Tên chứng chỉ *</Text>
              <TextInput
                style={styles.input}
                placeholder="VD: Chứng chỉ hành nghề dịch vụ làm thủ tục về thuế"
                placeholderTextColor="#9C9287"
                value={certName}
                onChangeText={setCertName}
              />

              <Text style={styles.inputLabel}>Số hiệu chứng chỉ *</Text>
              <TextInput
                style={styles.input}
                placeholder="VD: 042083011689"
                placeholderTextColor="#9C9287"
                value={certNumber}
                onChangeText={setCertNumber}
              />

              <Text style={styles.inputLabel}>Cơ quan cấp *</Text>
              <TextInput
                style={styles.input}
                placeholder="VD: Tổng cục Thuế / Bộ Tài chính"
                placeholderTextColor="#9C9287"
                value={issuingAuthority}
                onChangeText={setIssuingAuthority}
              />

              <Text style={styles.inputLabel}>Ngày cấp (Năm-Tháng-Ngày, VD: 2023-01-01) *</Text>
              <TextInput
                style={styles.input}
                placeholder="2023-01-01"
                placeholderTextColor="#9C9287"
                value={issueDate}
                onChangeText={setIssueDate}
              />
            </ScrollView>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setCertModalVisible(false)}
                disabled={certUploading}
              >
                <Text style={styles.modalCloseBtnText}>Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleUploadCertificate}
                disabled={certUploading}
              >
                {certUploading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>Tải lên</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Dialog
        visible={Boolean(dialog)}
        title={dialog?.title || ''}
        message={dialog?.message || ''}
        primaryLabel={dialog?.primaryLabel || 'Đã hiểu'}
        onPrimary={dialog?.onPrimary || (() => setDialog(null))}
        secondaryLabel={dialog?.secondaryLabel}
        onSecondary={dialog?.onSecondary}
        destructive={dialog?.destructive}
        onRequestClose={() => setDialog(null)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FAF7F2',
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
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 17,
    color: theme.colors.textPrimary,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 36,
  },

  // 1. Trạng thái hồ sơ
  statusBanner: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E7DEC9',
  },
  statusBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  statusTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusBannerTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
  },
  appNumberBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  appNumberText: {
    fontFamily: fonts.bodySemi,
    fontSize: 11,
    color: '#444444',
  },
  statusBannerDesc: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#444444',
    lineHeight: 18,
  },
  noticeBox: {
    marginTop: 8,
    padding: 10,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 3,
    borderLeftColor: '#DC2626',
  },
  noticeLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: '#DC2626',
  },
  noticeText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#333333',
    marginTop: 2,
    lineHeight: 17,
  },
  gotoExpertDashboardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingVertical: 9,
    borderRadius: 8,
    marginTop: 10,
  },
  gotoExpertDashboardBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: '#FFFFFF',
  },

  // Thẻ chứa phẳng (Flat Section Card)
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ECE4D8',
    padding: 15,
  },
  sectionTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 15,
    color: theme.colors.primaryDark,
    marginBottom: 4,
  },
  sectionHelper: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#786F66',
    marginBottom: 12,
    lineHeight: 17,
  },

  // Trường nhập liệu
  inputLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    color: '#3A2E25',
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#DFD7CC',
    borderRadius: 8,
    height: 46,
    paddingHorizontal: 12,
    fontFamily: fonts.body,
    fontSize: 13,
    color: '#1C1917',
  },
  bioInput: {
    minHeight: 96,
    height: undefined,
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 14,
    textAlignVertical: 'top',
    lineHeight: 20,
  },
  textArea: {
    minHeight: 110,
    height: undefined,
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 14,
    textAlignVertical: 'top',
    lineHeight: 20,
  },
  standaloneNumberWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#DFD7CC',
    borderRadius: 8,
    height: 46,
    paddingHorizontal: 14,
  },
  standaloneNumberInput: {
    flex: 1,
    height: 44,
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    color: '#1C1917',
    padding: 0,
  },
  standaloneNumberSuffix: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: '#786F66',
    marginLeft: 8,
  },

  // Lĩnh vực chuyên môn
  specChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  specChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F5EFEB',
    borderWidth: 1,
    borderColor: '#E8DFC9',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    maxWidth: '100%',
    flexShrink: 1,
  },
  specChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  specChipText: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: '#4B3F35',
    flexShrink: 1,
  },
  specChipTextActive: {
    color: '#FFFFFF',
  },

  // Mức phí tư vấn
  feeGroup: {
    gap: 10,
  },
  feeItem: {
    gap: 4,
  },
  feeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  feeLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: '#4B3F35',
  },
  feeInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#DFD7CC',
    borderRadius: 8,
    height: 44,
    paddingHorizontal: 12,
  },
  feeInput: {
    flex: 1,
    height: 42,
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    color: '#1C1917',
    padding: 0,
  },
  feeCurrencySuffix: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: '#786F66',
    marginLeft: 8,
  },

  // Chứng chỉ hành nghề
  certHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  certSubtitle: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#786F66',
    marginTop: 2,
  },
  addCertBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
    ...theme.shadows.button,
  },
  addCertBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: '#FFFFFF',
  },
  certItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EAE1',
  },
  certIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FAF4EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  certItemInfo: {
    flex: 1,
  },
  certName: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  certDetails: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
    lineHeight: 16,
  },
  certBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  certBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
  },
  deleteCertBtn: {
    padding: 6,
  },
  emptyCertBox: {
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 12,
  },
  emptyCertText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#786F66',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },

  // Nút hành động chính
  actionsWrap: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
    marginBottom: 20,
  },
  saveDraftBtn: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    borderRadius: 10,
  },
  saveDraftBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: theme.colors.primary,
  },
  submitBtn: {
    flex: 1.15,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    ...theme.shadows.button,
  },
  submitBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: '#FFFFFF',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  modalBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    width: '100%',
    maxWidth: 390,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EAE1',
  },
  modalTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  pickFileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.primary,
    padding: 12,
    borderRadius: 8,
    marginBottom: 6,
  },
  pickFileBtnText: {
    flex: 1,
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: theme.colors.primary,
  },
  certTypeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  certTypeBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 7,
    backgroundColor: '#F5EFEB',
    borderWidth: 1,
    borderColor: '#E8DFC9',
  },
  certTypeBtnActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  certTypeBtnText: {
    fontFamily: fonts.bodySemi,
    fontSize: 11,
    color: '#4B3F35',
  },
  certTypeBtnTextActive: {
    color: '#FFFFFF',
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0EAE1',
  },
  modalCloseBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#F5EFEB',
  },
  modalCloseBtnText: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: '#4B3F35',
  },
  modalSubmitBtn: {
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: theme.colors.primary,
    minWidth: 84,
    alignItems: 'center',
  },
  modalSubmitBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: '#FFFFFF',
  },

  // Loading
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 10,
  },
});
