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
  Image,
  Linking,
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
import { storageHelper } from '../../api/apiClient';
import { useAuthStore } from '../../stores/useAuthStore';
import {
  toFriendlyConsultationError,
  formatCertVerificationNote,
  formatThousands,
  parseThousands,
  formatVndWithDots,
} from '../../utils/consultationFriendlyErrors';
import type {
  ExpertApplicationDetailResponse,
  SpecializationDto,
  ConsultationFeeConfigDto,
  ExpertCertificateConfigDto,
  CertificateResponseDto,
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
  // Fee Proposals (VNĐ / buổi 60 phút) - có dấu chấm phân cách hàng nghìn
  const [onlineMeetingFee, setOnlineMeetingFee] = useState('200.000');
  const [chatFee, setChatFee] = useState('100.000');
  const [voiceCallFee, setVoiceCallFee] = useState('150.000');

  // Modal điều chỉnh biểu phí dịch vụ cho Chuyên gia đã duyệt (Approved)
  const [feeModalVisible, setFeeModalVisible] = useState(false);
  const [tempMeetingFee, setTempMeetingFee] = useState('200.000');
  const [tempChatFee, setTempChatFee] = useState('100.000');
  const [tempVoiceFee, setTempVoiceFee] = useState('150.000');

  // Modal điều chỉnh lĩnh vực tư vấn trọng tâm cho Chuyên gia đã duyệt (Approved)
  const [specModalVisible, setSpecModalVisible] = useState(false);
  const [tempSpecIds, setTempSpecIds] = useState<number[]>([]);

  const getFeeLimits = (sessionType: 'ONLINE_MEETING' | 'CHAT' | 'VOICE_CALL', durationMinutes = 60) => {
    const cfg = feeConfigs.find(
      (c) => c.sessionType === sessionType && c.durationMinutes === durationMinutes
    );
    if (cfg) {
      return { min: cfg.minFee, max: cfg.maxFee };
    }
    if (sessionType === 'ONLINE_MEETING') return { min: 200000, max: 2000000 };
    if (sessionType === 'CHAT') return { min: 50000, max: 1000000 };
    return { min: 100000, max: 1500000 };
  };

  const handleOpenFeeModal = () => {
    setTempMeetingFee(formatThousands(onlineMeetingFee));
    setTempChatFee(formatThousands(chatFee));
    setTempVoiceFee(formatThousands(voiceCallFee));
    setFeeModalVisible(true);
  };

  const handleSubmitFeeAdjustment = async () => {
    const mFee = parseThousands(tempMeetingFee);
    const cFee = parseThousands(tempChatFee);
    const vFee = parseThousands(tempVoiceFee);

    const mLimit = getFeeLimits('ONLINE_MEETING', 60);
    const cLimit = getFeeLimits('CHAT', 60);
    const vLimit = getFeeLimits('VOICE_CALL', 60);

    if (mFee < mLimit.min || mFee > mLimit.max) {
      setDialog({
        title: 'Mức phí ngoài khung quy định',
        message: `Mức phí Họp trực tuyến (60 phút) phải nằm trong khoảng từ ${formatVndWithDots(mLimit.min)} đến ${formatVndWithDots(mLimit.max)} theo quy định sàn.`,
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
      return;
    }

    if (cFee < cLimit.min || cFee > cLimit.max) {
      setDialog({
        title: 'Mức phí ngoài khung quy định',
        message: `Mức phí Nhắn tin tư vấn (60 phút) phải nằm trong khoảng từ ${formatVndWithDots(cLimit.min)} đến ${formatVndWithDots(cLimit.max)} theo quy định sàn.`,
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
      return;
    }

    if (vFee < vLimit.min || vFee > vLimit.max) {
      setDialog({
        title: 'Mức phí ngoài khung quy định',
        message: `Mức phí Gọi thoại trực tiếp (60 phút) phải nằm trong khoảng từ ${formatVndWithDots(vLimit.min)} đến ${formatVndWithDots(vLimit.max)} theo quy định sàn.`,
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
      return;
    }

    const meetingFormatted = formatThousands(mFee);
    const chatFormatted = formatThousands(cFee);
    const voiceFormatted = formatThousands(vFee);

    setOnlineMeetingFee(meetingFormatted);
    setChatFee(chatFormatted);
    setVoiceCallFee(voiceFormatted);
    setFeeModalVisible(false);

    const uid = currentUser?.id;
    if (uid) {
      await storageHelper.setItem(
        `taxkeep_expert_fees_${uid}`,
        JSON.stringify({
          meeting: meetingFormatted,
          chat: chatFormatted,
          voice: voiceFormatted,
        })
      );
    }

    setDialog({
      title: 'Cập nhật biểu phí thành công',
      message:
        'Biểu phí tư vấn của bạn đã được cập nhật thành công và áp dụng trực tiếp cho các phiên tư vấn mới mà không cần Admin xét duyệt.',
      primaryLabel: 'Đã hiểu',
      onPrimary: () => setDialog(null),
    });
  };

  const handleOpenSpecModal = () => {
    setTempSpecIds([...selectedSpecIds]);
    setSpecModalVisible(true);
  };

  const handleSubmitSpecAdjustment = async () => {
    if (tempSpecIds.length === 0) {
      setDialog({
        title: 'Chưa chọn lĩnh vực',
        message: 'Vui lòng chọn ít nhất một lĩnh vực tư vấn trọng tâm.',
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
      return;
    }

    setSelectedSpecIds([...tempSpecIds]);
    setSpecModalVisible(false);

    const uid = currentUser?.id;
    if (uid) {
      await storageHelper.setItem(
        `taxkeep_expert_specs_${uid}`,
        JSON.stringify(tempSpecIds)
      );
    }

    setDialog({
      title: 'Cập nhật lĩnh vực thành công',
      message:
        'Danh sách lĩnh vực tư vấn trọng tâm của bạn đã được cập nhật thành công và hiển thị ngay trên hồ sơ cá nhân mà không cần Admin xét duyệt.',
      primaryLabel: 'Đã hiểu',
      onPrimary: () => setDialog(null),
    });
  };

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
  const [certUploadProgress, setCertUploadProgress] = useState('');
  const [certFile, setCertFile] = useState<any>(null);
  const [certType, setCertType] = useState('TAX_AGENT');
  const [certName, setCertName] = useState('');
  const [certNumber, setCertNumber] = useState('');
  const [issuingAuthority, setIssuingAuthority] = useState('');
  const [issueDate, setIssueDate] = useState('2023-01-01');
  const [expiryDate, setExpiryDate] = useState('');
  const [certConfigs, setCertConfigs] = useState<ExpertCertificateConfigDto[]>([]);
  const [selectedCertForDetail, setSelectedCertForDetail] = useState<CertificateResponseDto | null>(null);

  const fetchApplicationData = useCallback(async () => {
    setLoading(true);
    try {
      const [appData, specs, fees, configs] = await Promise.all([
        consultationApi.getMyApplication(),
        consultationApi.getSpecializations(true),
        consultationApi.getConsultationFeeConfigs({ isActive: true }),
        consultationApi.getActiveCertificateConfigs().catch(() => []),
      ]);

      setSpecializations(specs);
      setFeeConfigs(fees);

      if (configs && configs.length > 0) {
        setCertConfigs(configs);
        setCertType(configs[0].code);
        if (configs[0].issuingBody) {
          setIssuingAuthority(configs[0].issuingBody);
        }
      }

      if (appData) {
        setApplication(appData);
        setFullName(appData.fullName || currentUser?.fullName || '');
        setJobTitle(appData.jobTitle || '');
        setCompanyName(appData.companyName || '');
        setYearsOfExperience(String(appData.yearsOfExperience || 3));
        setBio(appData.bio || '');
        setExperienceDescription(appData.experienceDescription || '');
        setSelectedSpecIds(appData.specializations?.map((s) => s.id) || []);

        // Điền trước các mức phí đã đăng ký nếu có (định dạng có dấu chấm)
        const meetingProposal = appData.feeProposals?.find(
          (p) => p.sessionType === 'ONLINE_MEETING'
        );
        if (meetingProposal) setOnlineMeetingFee(formatThousands(meetingProposal.proposedFee));

        const chatProposal = appData.feeProposals?.find((p) => p.sessionType === 'CHAT');
        if (chatProposal) setChatFee(formatThousands(chatProposal.proposedFee));

        const voiceProposal = appData.feeProposals?.find((p) => p.sessionType === 'VOICE_CALL');
        if (voiceProposal) setVoiceCallFee(formatThousands(voiceProposal.proposedFee));

        // Nạp các cấu hình mức phí và lĩnh vực do chuyên gia tự điều chỉnh đã lưu trên máy
        const uid = currentUser?.id;
        if (uid) {
          try {
            const [savedFeesStr, savedSpecsStr] = await Promise.all([
              storageHelper.getItem(`taxkeep_expert_fees_${uid}`),
              storageHelper.getItem(`taxkeep_expert_specs_${uid}`),
            ]);
            if (savedFeesStr) {
              const savedFees = JSON.parse(savedFeesStr);
              if (savedFees.meeting) setOnlineMeetingFee(savedFees.meeting);
              if (savedFees.chat) setChatFee(savedFees.chat);
              if (savedFees.voice) setVoiceCallFee(savedFees.voice);
            }
            if (savedSpecsStr) {
              const savedSpecs = JSON.parse(savedSpecsStr);
              if (Array.isArray(savedSpecs) && savedSpecs.length > 0) {
                setSelectedSpecIds(savedSpecs);
              }
            }
          } catch (e) {
            console.warn('Lỗi đọc cấu hình chuyên gia tự lưu:', e);
          }
        }
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

  // Tự động polling làm mới dữ liệu hồ sơ nếu còn chứng chỉ đang chờ AI OCR thẩm định
  useEffect(() => {
    const hasPendingCert = application?.certificates?.some(
      (c) => c.verificationStatus === 'PendingVerification'
    );
    if (!hasPendingCert) return;

    const timer = setInterval(async () => {
      try {
        const updated = await consultationApi.getMyApplication();
        if (updated) {
          setApplication(updated);
          const stillPending = updated.certificates?.some(
            (c) => c.verificationStatus === 'PendingVerification'
          );
          if (!stillPending) {
            clearInterval(timer);
          }
        }
      } catch {
        // bỏ qua lỗi gián đoạn mạng tạm thời trong lúc polling ngầm
      }
    }, 3000);

    return () => clearInterval(timer);
  }, [application?.certificates]);

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
          proposedFee: parseThousands(onlineMeetingFee),
        },
        {
          sessionType: 'CHAT' as const,
          durationMinutes: 60,
          proposedFee: parseThousands(chatFee),
        },
        {
          sessionType: 'VOICE_CALL' as const,
          durationMinutes: 60,
          proposedFee: parseThousands(voiceCallFee),
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

    const activeConfig = certConfigs.find((c) => c.code === certType);
    const requiresExpiry = Boolean(activeConfig?.requiresExpiryDate);

    if (requiresExpiry && !expiryDate.trim()) {
      setDialog({
        title: 'Thiếu ngày hết hạn',
        message: `Chứng chỉ ${activeConfig?.name || certType} yêu cầu cung cấp ngày hết hạn hiệu lực.`,
        primaryLabel: 'Đã hiểu',
        onPrimary: () => setDialog(null),
      });
      return;
    }

    setCertUploading(true);
    setCertUploadProgress('Đang tải tệp chứng chỉ lên máy chủ...');
    try {
      // Khởi tạo bản nháp nếu là hồ sơ mới hoàn toàn
      if (!application) {
        const payload = buildDraftPayload();
        await consultationApi.saveDraftApplication(payload);
      }

      const uploadedCert = await consultationApi.uploadApplicationCertificate(certFile, {
        certificateType: certType,
        certificateName: certName.trim(),
        certificateNumber: certNumber.trim(),
        issuingAuthority: issuingAuthority.trim(),
        issueDate: issueDate.trim(),
        hasExpiry: requiresExpiry || Boolean(expiryDate.trim()),
        expiryDate: expiryDate.trim() || null,
      });

      // Chuyển sang bước AI OCR thẩm định
      setCertUploadProgress('AI OCR đang thẩm định và đối soát thông tin văn bằng... Vui lòng chờ trong giây lát (khoảng 2 - 4 giây)');

      const targetCertId = uploadedCert?.id;
      let finalCert: CertificateResponseDto | undefined;
      let latestApp: ExpertApplicationDetailResponse | null = null;

      // Polling chờ AI OCR xử lý và hoàn tất thẩm định (tối đa ~22 giây)
      if (targetCertId) {
        const maxAttempts = 15;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          try {
            const app = await consultationApi.getMyApplication();
            if (app) {
              latestApp = app;
              const found = app.certificates?.find((c) => c.id === targetCertId);
              if (found && found.verificationStatus !== 'PendingVerification') {
                finalCert = found;
                break;
              }
            }
          } catch {
            // bỏ qua lỗi gián đoạn mạng tạm thời khi polling
          }
        }
      }

      // Đảm bảo nạp dữ liệu hồ sơ mới nhất vào state để giao diện cập nhật ngay lập tức
      if (!latestApp) {
        latestApp = await consultationApi.getMyApplication();
      }
      if (latestApp) {
        setApplication(latestApp);
      }

      // Đóng modal tải lên và dọn sạch các ô nhập
      setCertModalVisible(false);
      setCertFile(null);
      setCertName('');
      setCertNumber('');
      setIssuingAuthority('');
      setExpiryDate('');

      // Thông báo kết quả thẩm định chính thức cho người dùng
      if (finalCert) {
        if (finalCert.verificationStatus === 'Verified') {
          const friendlyNote = formatCertVerificationNote(finalCert.verificationNote, finalCert.verificationStatus);
          setDialog({
            title: 'Thẩm định thành công',
            message: `Chứng chỉ "${finalCert.certificateName}" đã được hệ thống AI OCR thẩm định và xác thực hợp lệ!\n\n${friendlyNote || 'Thông tin văn bằng đã khớp với tài khoản chuyên gia.'}`,
            primaryLabel: 'Đã hiểu',
            onPrimary: () => setDialog(null),
          });
        } else if (finalCert.verificationStatus === 'Rejected') {
          const friendlyReason = formatCertVerificationNote(finalCert.verificationNote, finalCert.verificationStatus);
          setDialog({
            title: 'Chứng chỉ không hợp lệ',
            message: `Hệ thống AI OCR đã đối soát và từ chối chứng chỉ:\n\n${friendlyReason || 'Văn bằng không khớp hoặc không hợp lệ. Vui lòng kiểm tra lại tài liệu.'}`,
            primaryLabel: 'Đã hiểu',
            destructive: true,
            onPrimary: () => setDialog(null),
          });
        } else {
          // Vẫn PendingVerification do timeout
          setDialog({
            title: 'Đã tải lên chứng chỉ',
            message:
              'Chứng chỉ đã được tải lên thành công. Hệ thống AI OCR đang tiếp tục thẩm định trong nền, màn hình sẽ tự động cập nhật kết quả khi hoàn tất.',
            primaryLabel: 'Đã hiểu',
            onPrimary: () => setDialog(null),
          });
        }
      } else {
        setDialog({
          title: 'Đã tải lên chứng chỉ',
          message:
            'Chứng chỉ hành nghề đã được tải lên. Hệ thống AI OCR đang tiếp tục đối soát và màn hình sẽ tự động hiển thị kết quả thẩm định.',
          primaryLabel: 'Đã hiểu',
          onPrimary: () => setDialog(null),
        });
      }
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
      setCertUploadProgress('');
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
          <TouchableOpacity
            onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Profile'))}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
          >
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
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Profile'))}
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
          <View style={styles.specHeaderRow}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.sectionTitle}>Lĩnh vực tư vấn trọng tâm *</Text>
              <Text style={styles.sectionHelper}>
                Chọn các lĩnh vực thuế bạn có chứng chỉ và kinh nghiệm tư vấn thực tế.
              </Text>
            </View>
            {application?.status === 'Approved' && (
              <TouchableOpacity
                style={styles.adjustSpecBtn}
                onPress={handleOpenSpecModal}
                accessibilityRole="button"
                accessibilityLabel="Điều chỉnh lĩnh vực"
                activeOpacity={0.8}
              >
                <Ionicons name="pencil-outline" size={13} color="#FFFFFF" />
                <Text style={styles.adjustSpecBtnText}>Sửa lĩnh vực</Text>
              </TouchableOpacity>
            )}
          </View>

          {application?.status === 'Approved' && (
            <View style={styles.specActiveStatusRow}>
              <View style={styles.specActiveBadge}>
                <Ionicons name="checkmark-circle" size={12} color="#059669" />
                <Text style={styles.specActiveBadgeText}>
                  Đang áp dụng ({selectedSpecIds.length} lĩnh vực)
                </Text>
              </View>
            </View>
          )}

          <View style={styles.specChipsWrap}>
            {specializations.map((spec) => {
              const isSelected = selectedSpecIds.includes(spec.id);
              const isApproved = application?.status === 'Approved';
              return (
                <TouchableOpacity
                  key={spec.id}
                  style={[styles.specChip, isSelected && styles.specChipActive]}
                  onPress={async () => {
                    if (!isReadOnly || isApproved) {
                      const next = isSelected
                        ? selectedSpecIds.filter((item) => item !== spec.id)
                        : [...selectedSpecIds, spec.id];
                      setSelectedSpecIds(next);
                      const uid = currentUser?.id;
                      if (uid && isApproved) {
                        await storageHelper.setItem(`taxkeep_expert_specs_${uid}`, JSON.stringify(next));
                      }
                    }
                  }}
                  disabled={isReadOnly && !isApproved}
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
          <View style={styles.feeHeaderRow}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.sectionTitle}>Mức phí tư vấn dự kiến (VNĐ / buổi 60 phút)</Text>
              <Text style={styles.sectionHelper}>
                Mức phí áp dụng cho từng hình thức tư vấn trực tuyến.
              </Text>
            </View>
            {application?.status === 'Approved' && (
              <TouchableOpacity
                style={styles.adjustFeeBtn}
                onPress={handleOpenFeeModal}
                accessibilityRole="button"
                accessibilityLabel="Điều chỉnh biểu phí"
                activeOpacity={0.8}
              >
                <Ionicons name="pencil-outline" size={13} color="#FFFFFF" />
                <Text style={styles.adjustFeeBtnText}>Sửa biểu phí</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.feeGroup}>
            {/* Họp trực tuyến */}
            <View style={styles.feeItem}>
              <View style={styles.feeItemTopRow}>
                <View style={styles.feeHeader}>
                  <Ionicons name="videocam-outline" size={16} color={theme.colors.primary} />
                  <Text style={styles.feeLabel}>Họp trực tuyến (Gọi video)</Text>
                </View>
                {application?.status === 'Approved' && (
                  <View style={styles.feeActiveBadge}>
                    <Ionicons name="checkmark-circle" size={12} color="#059669" />
                    <Text style={styles.feeActiveBadgeText}>Đang áp dụng</Text>
                  </View>
                )}
              </View>
              <View style={styles.feeInputWrap}>
                <TextInput
                  style={styles.feeInput}
                  keyboardType="numeric"
                  value={onlineMeetingFee}
                  onChangeText={(text) => setOnlineMeetingFee(formatThousands(text))}
                  editable={!isReadOnly}
                  placeholder="200.000"
                  placeholderTextColor="#9C9287"
                />
                <Text style={styles.feeCurrencySuffix}>VNĐ</Text>
              </View>
              <Text style={styles.feeHintText}>
                Khung quy định sàn: {formatVndWithDots(getFeeLimits('ONLINE_MEETING', 60).min)} - {formatVndWithDots(getFeeLimits('ONLINE_MEETING', 60).max)}
              </Text>
            </View>

            {/* Nhắn tin */}
            <View style={styles.feeItem}>
              <View style={styles.feeItemTopRow}>
                <View style={styles.feeHeader}>
                  <Ionicons name="chatbubbles-outline" size={16} color={theme.colors.primary} />
                  <Text style={styles.feeLabel}>Nhắn tin tư vấn</Text>
                </View>
                {application?.status === 'Approved' && (
                  <View style={styles.feeActiveBadge}>
                    <Ionicons name="checkmark-circle" size={12} color="#059669" />
                    <Text style={styles.feeActiveBadgeText}>Đang áp dụng</Text>
                  </View>
                )}
              </View>
              <View style={styles.feeInputWrap}>
                <TextInput
                  style={styles.feeInput}
                  keyboardType="numeric"
                  value={chatFee}
                  onChangeText={(text) => setChatFee(formatThousands(text))}
                  editable={!isReadOnly}
                  placeholder="100.000"
                  placeholderTextColor="#9C9287"
                />
                <Text style={styles.feeCurrencySuffix}>VNĐ</Text>
              </View>
              <Text style={styles.feeHintText}>
                Khung quy định sàn: {formatVndWithDots(getFeeLimits('CHAT', 60).min)} - {formatVndWithDots(getFeeLimits('CHAT', 60).max)}
              </Text>
            </View>

            {/* Gọi thoại */}
            <View style={styles.feeItem}>
              <View style={styles.feeItemTopRow}>
                <View style={styles.feeHeader}>
                  <Ionicons name="call-outline" size={16} color={theme.colors.primary} />
                  <Text style={styles.feeLabel}>Gọi thoại trực tiếp</Text>
                </View>
                {application?.status === 'Approved' && (
                  <View style={styles.feeActiveBadge}>
                    <Ionicons name="checkmark-circle" size={12} color="#059669" />
                    <Text style={styles.feeActiveBadgeText}>Đang áp dụng</Text>
                  </View>
                )}
              </View>
              <View style={styles.feeInputWrap}>
                <TextInput
                  style={styles.feeInput}
                  keyboardType="numeric"
                  value={voiceCallFee}
                  onChangeText={(text) => setVoiceCallFee(formatThousands(text))}
                  editable={!isReadOnly}
                  placeholder="150.000"
                  placeholderTextColor="#9C9287"
                />
                <Text style={styles.feeCurrencySuffix}>VNĐ</Text>
              </View>
              <Text style={styles.feeHintText}>
                Khung quy định sàn: {formatVndWithDots(getFeeLimits('VOICE_CALL', 60).min)} - {formatVndWithDots(getFeeLimits('VOICE_CALL', 60).max)}
              </Text>
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
              const isAiVerified = cert.verificationStatus === 'Verified';
              const isAiRejected = cert.verificationStatus === 'Rejected';
              const isAiPending = cert.verificationStatus === 'PendingVerification';

              return (
                <View key={cert.id} style={styles.certItemRow}>
                  <View style={styles.certIconWrap}>
                    <Ionicons
                      name={isAiVerified ? 'shield-checkmark' : 'ribbon-outline'}
                      size={22}
                      color={isAiVerified ? '#059669' : theme.colors.primary}
                    />
                  </View>
                  <View style={styles.certItemInfo}>
                    <Text style={styles.certName}>{cert.certificateName}</Text>
                    <Text style={styles.certDetails}>
                      Số: {cert.certificateNumber} • Cấp bởi: {cert.issuingAuthority}
                    </Text>
                    {cert.issueDate && (
                      <Text style={styles.certDetails}>
                        Ngày cấp: {cert.issueDate}{' '}
                        {cert.expiryDate ? `• Hạn: ${cert.expiryDate}` : ''}
                      </Text>
                    )}

                    <View style={styles.certActionRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <View style={[styles.certBadge, { backgroundColor: certSt.bg }]}>
                          <Text style={[styles.certBadgeText, { color: certSt.color }]}>
                            {certSt.label}
                          </Text>
                        </View>
                        {isAiPending && (
                          <View style={styles.aiPendingBadge}>
                            <ActivityIndicator size="small" color="#B45309" style={{ transform: [{ scale: 0.7 }] }} />
                            <Text style={styles.aiPendingBadgeText}>AI OCR đang đối soát...</Text>
                          </View>
                        )}
                      </View>

                      <TouchableOpacity
                        style={styles.viewCertBtn}
                        onPress={() => setSelectedCertForDetail(cert)}
                        accessibilityRole="button"
                        accessibilityLabel="Xem chi tiết chứng chỉ"
                      >
                        <Ionicons name="eye-outline" size={13} color={theme.colors.primary} />
                        <Text style={styles.viewCertBtnText}>Xem chi tiết</Text>
                      </TouchableOpacity>
                    </View>

                    {isAiRejected && cert.verificationNote && (
                      <View style={styles.certRejectionInlineBox}>
                        <Ionicons name="alert-circle" size={13} color="#DC2626" />
                        <Text style={styles.certRejectionInlineText} numberOfLines={2}>
                          {formatCertVerificationNote(cert.verificationNote, cert.verificationStatus)}
                        </Text>
                      </View>
                    )}
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
                {(certConfigs.length > 0
                  ? certConfigs
                  : [
                      { id: 1, code: 'TAX_AGENT', name: 'Đại lý thuế', requiresExpiryDate: false },
                      { id: 2, code: 'CPA', name: 'Kiểm toán viên (CPA)', requiresExpiryDate: false },
                      { id: 3, code: 'OTHER', name: 'Chứng chỉ khác', requiresExpiryDate: false },
                    ]
                ).map((cfg) => {
                  const isSelected = certType === cfg.code;
                  return (
                    <TouchableOpacity
                      key={cfg.code}
                      style={[styles.certTypeBtn, isSelected && styles.certTypeBtnActive]}
                      onPress={() => {
                        setCertType(cfg.code);
                        const auth = 'issuingBody' in cfg ? cfg.issuingBody : undefined;
                        if (auth && !issuingAuthority) {
                          setIssuingAuthority(auth);
                        }
                      }}
                    >
                      <Text
                        style={[
                          styles.certTypeBtnText,
                          isSelected && styles.certTypeBtnTextActive,
                        ]}
                      >
                        {cfg.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
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

              {Boolean(certConfigs.find((c) => c.code === certType)?.requiresExpiryDate) && (
                <>
                  <Text style={styles.inputLabel}>Ngày hết hạn (Năm-Tháng-Ngày) *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="2028-12-31"
                    placeholderTextColor="#9C9287"
                    value={expiryDate}
                    onChangeText={setExpiryDate}
                  />
                </>
              )}
            </ScrollView>

            {certUploading && (
              <View style={styles.certUploadingBanner}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Text style={styles.certUploadingBannerText}>
                  {certUploadProgress || 'Đang xử lý tải lên và thẩm định...'}
                </Text>
              </View>
            )}

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalCloseBtn, certUploading && { opacity: 0.5 }]}
                onPress={() => setCertModalVisible(false)}
                disabled={certUploading}
              >
                <Text style={styles.modalCloseBtnText}>Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, certUploading && { opacity: 0.7 }]}
                onPress={handleUploadCertificate}
                disabled={certUploading}
              >
                {certUploading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>Tải lên & Thẩm định AI</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── MODAL XEM CHI TIẾT CHỨNG CHỈ HÀNH NGHỀ ── */}
      <Modal
        visible={Boolean(selectedCertForDetail)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedCertForDetail(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <Ionicons name="ribbon" size={22} color={theme.colors.primary} />
                <Text style={styles.modalTitle} numberOfLines={1}>Chi tiết chứng chỉ hành nghề</Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedCertForDetail(null)}
                style={{ padding: 4 }}
                accessibilityRole="button"
                accessibilityLabel="Đóng chi tiết"
              >
                <Ionicons name="close" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {selectedCertForDetail && (
              <ScrollView style={{ maxHeight: 480 }} showsVerticalScrollIndicator={false}>
                {selectedCertForDetail.fileUrl ? (
                  <View style={styles.certDetailImageCard}>
                    <Image
                      source={{ uri: selectedCertForDetail.fileUrl }}
                      style={styles.certDetailImage}
                      resizeMode="contain"
                    />
                    <TouchableOpacity
                      style={styles.openOriginalLinkBtn}
                      onPress={() => {
                        if (selectedCertForDetail.fileUrl) {
                          Linking.openURL(selectedCertForDetail.fileUrl).catch(() => {});
                        }
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Mở tệp gốc"
                    >
                      <Ionicons name="open-outline" size={14} color={theme.colors.primary} />
                      <Text style={styles.openOriginalLinkText}>Mở tệp gốc / Toàn màn hình</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                <View style={styles.certDetailSection}>
                  <Text style={styles.certDetailTitle}>{selectedCertForDetail.certificateName}</Text>

                  <View style={styles.certDetailRow}>
                    <Text style={styles.certDetailLabel}>Số hiệu chứng chỉ</Text>
                    <Text style={styles.certDetailValueBold}>{selectedCertForDetail.certificateNumber}</Text>
                  </View>

                  <View style={styles.certDetailRow}>
                    <Text style={styles.certDetailLabel}>Cơ quan cấp</Text>
                    <Text style={styles.certDetailValue}>{selectedCertForDetail.issuingAuthority}</Text>
                  </View>

                  <View style={styles.certDetailRow}>
                    <Text style={styles.certDetailLabel}>Ngày cấp</Text>
                    <Text style={styles.certDetailValue}>{selectedCertForDetail.issueDate || 'Chưa cập nhật'}</Text>
                  </View>

                  <View style={styles.certDetailRow}>
                    <Text style={styles.certDetailLabel}>Thời hạn hiệu lực</Text>
                    <Text style={styles.certDetailValue}>
                      {selectedCertForDetail.hasExpiry && selectedCertForDetail.expiryDate
                        ? selectedCertForDetail.expiryDate
                        : 'Vô thời hạn'}
                    </Text>
                  </View>

                  <View style={styles.certDetailRow}>
                    <Text style={styles.certDetailLabel}>Trạng thái thẩm định</Text>
                    <View
                      style={[
                        styles.certBadge,
                        {
                          backgroundColor: formatCertStatus(selectedCertForDetail.verificationStatus).bg,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.certBadgeText,
                          {
                            color: formatCertStatus(selectedCertForDetail.verificationStatus).color,
                          },
                        ]}
                      >
                        {formatCertStatus(selectedCertForDetail.verificationStatus).label}
                      </Text>
                    </View>
                  </View>

                  {selectedCertForDetail.verificationNote && (
                    <View
                      style={[
                        styles.certDetailNoteBox,
                        selectedCertForDetail.verificationStatus === 'Rejected' && {
                          backgroundColor: '#FEF2F2',
                          borderColor: '#FECACA',
                        },
                      ]}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                        <Ionicons
                          name={
                            selectedCertForDetail.verificationStatus === 'Rejected'
                              ? 'alert-circle'
                              : 'shield-checkmark'
                          }
                          size={14}
                          color={
                            selectedCertForDetail.verificationStatus === 'Rejected'
                              ? '#DC2626'
                              : '#059669'
                          }
                        />
                        <Text
                          style={[
                            styles.certDetailNoteTitle,
                            selectedCertForDetail.verificationStatus === 'Rejected' && {
                              color: '#DC2626',
                            },
                          ]}
                        >
                          {selectedCertForDetail.verificationStatus === 'Rejected'
                            ? 'Lý do từ chối thẩm định'
                            : 'Kết quả thẩm định'}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.certDetailNoteText,
                          selectedCertForDetail.verificationStatus === 'Rejected' && {
                            color: '#B91C1C',
                          },
                        ]}
                      >
                        {formatCertVerificationNote(
                          selectedCertForDetail.verificationNote,
                          selectedCertForDetail.verificationStatus
                        )}
                      </Text>
                    </View>
                  )}
                </View>
              </ScrollView>
            )}

            <View style={{ marginTop: 14 }}>
              <TouchableOpacity
                style={styles.certDetailCloseBtn}
                onPress={() => setSelectedCertForDetail(null)}
                accessibilityRole="button"
                accessibilityLabel="Đóng modal"
              >
                <Text style={styles.certDetailCloseBtnText}>Đóng</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── MODAL ĐIỀU CHỈNH BIỂU PHÍ DỊCH VỤ (CHUYÊN GIA APPROVED) ── */}
      <Modal
        visible={feeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFeeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxWidth: 420 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <Ionicons name="pricetags-outline" size={20} color={theme.colors.primary} />
                <Text style={styles.modalTitle}>Điều chỉnh mức phí dịch vụ</Text>
              </View>
              <TouchableOpacity
                onPress={() => setFeeModalVisible(false)}
                style={{ padding: 4 }}
                accessibilityRole="button"
                accessibilityLabel="Đóng modal"
              >
                <Ionicons name="close" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              {/* Thông tin tự chủ mức phí */}
              <View style={styles.feeNoticeBox}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                  <Ionicons name="sparkles" size={14} color="#166534" />
                  <Text style={styles.feeNoticeTitle}>Chủ động quản lý biểu phí</Text>
                </View>
                <Text style={styles.feeNoticeText}>
                  Chuyên gia được toàn quyền chủ động tự điều chỉnh mức phí dịch vụ tư vấn trong khung quy định sàn TaxKeep. Mức phí mới sẽ có hiệu lực ngay lập tức mà không cần Admin duyệt.
                </Text>
              </View>

              {/* Ô nhập Họp trực tuyến */}
              <View style={{ marginBottom: 12 }}>
                <Text style={styles.inputLabel}>Họp trực tuyến (Gọi video 60 phút) *</Text>
                <View style={styles.feeInputWrap}>
                  <TextInput
                    style={styles.feeInput}
                    keyboardType="numeric"
                    value={tempMeetingFee}
                    onChangeText={(text) => setTempMeetingFee(formatThousands(text))}
                    placeholder="200.000"
                    placeholderTextColor="#9C9287"
                  />
                  <Text style={styles.feeCurrencySuffix}>VNĐ</Text>
                </View>
                <Text style={styles.feeHintText}>
                  Khung quy định sàn: {formatVndWithDots(getFeeLimits('ONLINE_MEETING', 60).min)} - {formatVndWithDots(getFeeLimits('ONLINE_MEETING', 60).max)}
                </Text>
              </View>

              {/* Ô nhập Nhắn tin */}
              <View style={{ marginBottom: 12 }}>
                <Text style={styles.inputLabel}>Nhắn tin tư vấn (60 phút) *</Text>
                <View style={styles.feeInputWrap}>
                  <TextInput
                    style={styles.feeInput}
                    keyboardType="numeric"
                    value={tempChatFee}
                    onChangeText={(text) => setTempChatFee(formatThousands(text))}
                    placeholder="100.000"
                    placeholderTextColor="#9C9287"
                  />
                  <Text style={styles.feeCurrencySuffix}>VNĐ</Text>
                </View>
                <Text style={styles.feeHintText}>
                  Khung quy định sàn: {formatVndWithDots(getFeeLimits('CHAT', 60).min)} - {formatVndWithDots(getFeeLimits('CHAT', 60).max)}
                </Text>
              </View>

              {/* Ô nhập Gọi thoại */}
              <View style={{ marginBottom: 14 }}>
                <Text style={styles.inputLabel}>Gọi thoại trực tiếp (60 phút) *</Text>
                <View style={styles.feeInputWrap}>
                  <TextInput
                    style={styles.feeInput}
                    keyboardType="numeric"
                    value={tempVoiceFee}
                    onChangeText={(text) => setTempVoiceFee(formatThousands(text))}
                    placeholder="150.000"
                    placeholderTextColor="#9C9287"
                  />
                  <Text style={styles.feeCurrencySuffix}>VNĐ</Text>
                </View>
                <Text style={styles.feeHintText}>
                  Khung quy định sàn: {formatVndWithDots(getFeeLimits('VOICE_CALL', 60).min)} - {formatVndWithDots(getFeeLimits('VOICE_CALL', 60).max)}
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setFeeModalVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Đóng modal"
              >
                <Text style={styles.modalCloseBtnText}>Bỏ qua</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleSubmitFeeAdjustment}
                accessibilityRole="button"
                accessibilityLabel="Lưu biểu phí"
              >
                <Text style={styles.modalSubmitBtnText}>Lưu & Áp dụng ngay</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── MODAL ĐIỀU CHỈNH LĨNH VỰC TƯ VẤN (CHUYÊN GIA APPROVED) ── */}
      <Modal
        visible={specModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSpecModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxWidth: 440 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <Ionicons name="ribbon-outline" size={20} color={theme.colors.primary} />
                <Text style={styles.modalTitle}>Điều chỉnh lĩnh vực tư vấn</Text>
              </View>
              <TouchableOpacity
                onPress={() => setSpecModalVisible(false)}
                style={{ padding: 4 }}
                accessibilityRole="button"
                accessibilityLabel="Đóng modal"
              >
                <Ionicons name="close" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              {/* Thông tin tự chủ lĩnh vực */}
              <View style={styles.specNoticeBox}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                  <Ionicons name="sparkles" size={14} color="#166534" />
                  <Text style={styles.specNoticeTitle}>Chủ động cập nhật lĩnh vực tư vấn</Text>
                </View>
                <Text style={styles.specNoticeText}>
                  Chuyên gia có thể linh hoạt cập nhật các lĩnh vực thuế trọng tâm theo nhu cầu công tác. Lĩnh vực mới sẽ hiển thị ngay trên hồ sơ cá nhân mà không cần chờ Admin duyệt.
                </Text>
              </View>

              <Text style={styles.inputLabel}>Chọn các lĩnh vực chuyên môn của bạn *</Text>
              <View style={styles.specChipsWrap}>
                {specializations.map((spec) => {
                  const isSelected = tempSpecIds.includes(spec.id);
                  return (
                    <TouchableOpacity
                      key={spec.id}
                      style={[styles.specChip, isSelected && styles.specChipActive]}
                      onPress={() => {
                        if (isSelected) {
                          setTempSpecIds(tempSpecIds.filter((id) => id !== spec.id));
                        } else {
                          setTempSpecIds([...tempSpecIds, spec.id]);
                        }
                      }}
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
            </ScrollView>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setSpecModalVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Đóng modal"
              >
                <Text style={styles.modalCloseBtnText}>Bỏ qua</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleSubmitSpecAdjustment}
                accessibilityRole="button"
                accessibilityLabel="Lưu lĩnh vực"
              >
                <Text style={styles.modalSubmitBtnText}>Lưu & Áp dụng ngay</Text>
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
    alignItems: 'flex-start',
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
    marginTop: 2,
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
  },
  certBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
  },
  aiPendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  aiPendingBadgeText: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: '#B45309',
  },
  certActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  viewCertBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F3EFE6',
    borderWidth: 0.5,
    borderColor: '#E2DAC8',
  },
  viewCertBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: theme.colors.primary,
  },
  certRejectionInlineBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 0.5,
    borderColor: '#FECACA',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 6,
  },
  certRejectionInlineText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#DC2626',
    lineHeight: 15,
  },
  certDetailImageCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    marginBottom: 12,
  },
  certDetailImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#F3F4F6',
  },
  openOriginalLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  openOriginalLinkText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: theme.colors.primary,
  },
  certDetailSection: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  certDetailTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 15,
    color: theme.colors.primary,
    marginBottom: 10,
  },
  certDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0EBE1',
  },
  certDetailLabel: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    color: '#6B7280',
  },
  certDetailValue: {
    fontFamily: fonts.bodySemi,
    fontSize: 12.5,
    color: '#1F2937',
  },
  certDetailValueBold: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: theme.colors.primary,
  },
  certDetailNoteBox: {
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    padding: 10,
    marginTop: 10,
  },
  certDetailNoteTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 11.5,
    color: '#065F46',
  },
  certDetailNoteText: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    color: '#047857',
    lineHeight: 16,
  },
  certDetailCloseBtn: {
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F3EFE6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  certDetailCloseBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: theme.colors.primary,
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
  certUploadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 10,
  },
  certUploadingBannerText: {
    flex: 1,
    fontFamily: fonts.bodySemi,
    fontSize: 11.5,
    color: '#1D4ED8',
    lineHeight: 16,
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

  // Điều chỉnh mức phí dịch vụ
  feeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  adjustFeeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  adjustFeeBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11.5,
    color: '#FFFFFF',
  },
  feeItemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  feeActiveBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: '#A7F3D0',
  },
  feeActiveBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: '#059669',
  },
  feePendingBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: '#FDE68A',
  },
  feePendingBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: '#B45309',
  },
  feeHintText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#8C827A',
    marginTop: 4,
  },
  feeNoticeBox: {
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    padding: 10,
    marginBottom: 14,
  },
  feeNoticeTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: '#166534',
  },
  feeNoticeText: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    color: '#15803D',
    lineHeight: 16,
  },

  // Điều chỉnh lĩnh vực tư vấn trọng tâm
  specHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  adjustSpecBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  adjustSpecBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11.5,
    color: '#FFFFFF',
  },
  specActiveStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 10,
  },
  specActiveBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: '#A7F3D0',
  },
  specActiveBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10.5,
    color: '#059669',
  },
  specPendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: '#FDE68A',
  },
  specPendingBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10.5,
    color: '#B45309',
  },
  specNoticeBox: {
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    padding: 10,
    marginBottom: 14,
  },
  specNoticeTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: '#166534',
  },
  specNoticeText: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    color: '#15803D',
    lineHeight: 16,
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
