import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { DrumHeader } from '../../components/brand/DrumHeader';
import { GoldDoubleRule } from '../../components/brand/GoldDoubleRule';
import { MainTabBar } from '../../components/navigation/MainTabBar';
import { useToast } from '../../components/ui/Toast';
import { RootNavigationProp } from '../../navigation/types';
import { useAuthStore } from '../../stores/useAuthStore';
import { profileApi, type UserProfileResponse } from '../../api/profileApi';
import { consultationApi } from '../../api/consultationApi';
import { formatPersonName } from '../../utils/formatPersonName';
import { toFriendlyErrorMessage } from '../../utils/friendlyError';
import { sanitizeProfileAddress } from '../../constants/vietnamProvinces';
import {
  getCustomExpertAvatar,
  saveCustomExpertAvatar,
  resolveExpertAvatarUri,
} from '../../utils/expertAvatarStorage';
import type {
  ExpertDetailResponse,
  ExpertPublicCertificateDto,
  ReviewDetailResponse,
} from '../../types/consultation';
import {
  formatVnd,
  formatSessionType,
  isValidAvatarUrl,
} from '../../types/consultation';

type SubTabKey = 'INFO' | 'CERTIFICATES' | 'REVIEWS';

function resolveAssetUrl(url?: string | null): string {
  return resolveExpertAvatarUri(url);
}

async function toPersistentAvatarDataUri(
  asset: ImagePicker.ImagePickerAsset
): Promise<{ persistentUri: string; mimeType: string; fileName: string }> {
  const mimeType = asset.mimeType || 'image/jpeg';
  const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
  const fileName = asset.fileName || `expert_avatar_${Date.now()}.${ext}`;

  if (asset.base64) {
    return {
      persistentUri: `data:${mimeType};base64,${asset.base64}`,
      mimeType,
      fileName,
    };
  }

  if (Platform.OS === 'web' && asset.uri && typeof FileReader !== 'undefined') {
    try {
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') resolve(reader.result);
          else reject(new Error('Failed to read image'));
        };
        reader.onerror = () => reject(new Error('Failed to read image'));
        reader.readAsDataURL(blob);
      });
      return { persistentUri: dataUrl, mimeType: blob.type || mimeType, fileName };
    } catch {
      return { persistentUri: asset.uri, mimeType, fileName };
    }
  }

  return { persistentUri: asset.uri, mimeType, fileName };
}

function isImageUrl(url?: string | null): boolean {
  if (!url) return false;
  const clean = url.split('?')[0].toLowerCase();
  return (
    clean.endsWith('.jpg') ||
    clean.endsWith('.jpeg') ||
    clean.endsWith('.png') ||
    clean.endsWith('.webp') ||
    clean.endsWith('.gif')
  );
}

export const ExpertProfileScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const { toast } = useToast();
  const authUser = useAuthStore((s) => s.user);

  const [activeTab, setActiveTab] = useState<SubTabKey>('INFO');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [userProfile, setUserProfile] = useState<UserProfileResponse | null>(null);
  const [expertDetail, setExpertDetail] = useState<ExpertDetailResponse | null>(null);
  const [receivedReviews, setReceivedReviews] = useState<ReviewDetailResponse[]>([]);
  const [customAvatarUri, setCustomAvatarUri] = useState<string>('');
  const [avatarPickerVisible, setAvatarPickerVisible] = useState<boolean>(false);
  const [uploadingAvatar, setUploadingAvatar] = useState<boolean>(false);

  // Xem chứng chỉ
  const [selectedCert, setSelectedCert] = useState<ExpertPublicCertificateDto | null>(null);

  // Phản hồi đánh giá của khách hàng
  const [replyTarget, setReplyTarget] = useState<ReviewDetailResponse | null>(null);
  const [replyText, setReplyText] = useState<string>('');
  const [submittingReply, setSubmittingReply] = useState<boolean>(false);

  const loadProfileData = useCallback(
    async (isPullRefresh = false) => {
      if (isPullRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setLoadError(null);

      try {
        const userProf = await profileApi.getProfile().catch(() => null);
        if (userProf) {
          setUserProfile(userProf);
        }

        const effectiveUid = userProf?.userId || authUser?.id || '';
        const effectiveName = userProf?.fullName || authUser?.fullName || '';

        if (effectiveUid) {
          const savedLocalAvatar = await getCustomExpertAvatar(effectiveUid);
          setCustomAvatarUri(savedLocalAvatar || '');
        }

        const [expRes, revRes] = await Promise.allSettled([
          effectiveUid
            ? consultationApi.getMyExpertProfile(effectiveUid, effectiveName)
            : Promise.resolve(null),
          consultationApi.getMyReceivedReviews({ page: 1, size: 30 }),
        ]);

        if (expRes.status === 'fulfilled' && expRes.value) {
          setExpertDetail(expRes.value);
        }
        if (revRes.status === 'fulfilled' && revRes.value?.items) {
          setReceivedReviews(revRes.value.items);
        }

        if (!userProf && (expRes.status === 'rejected' || !expRes.value)) {
          setLoadError('Không thể tải thông tin hồ sơ chuyên gia từ máy chủ.');
        }
      } catch (err: unknown) {
        setLoadError(toFriendlyErrorMessage(err, 'Không thể tải thông tin hồ sơ chuyên gia.'));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [authUser?.fullName, authUser?.id]
  );

  useFocusEffect(
    useCallback(() => {
      void loadProfileData(false);
    }, [loadProfileData])
  );

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('ExpertUtilities');
    }
  }, [navigation]);

  const handleSubmitReply = async () => {
    if (!replyTarget || submittingReply) return;
    const trimmed = replyText.trim();
    if (trimmed.length < 5) {
      toast.warning('Nội dung phản hồi cần ít nhất 5 ký tự.', 'Nội dung quá ngắn');
      return;
    }

    setSubmittingReply(true);
    try {
      const updated = await consultationApi.replyToReview(replyTarget.id, trimmed);
      setReceivedReviews((prev) =>
        prev.map((r) => (r.id === updated.id ? updated : r))
      );
      setReplyTarget(null);
      setReplyText('');
      toast.success('Đã gửi phản hồi đánh giá công khai thành công.', 'Đã phản hồi');
    } catch (err: unknown) {
      toast.error(
        toFriendlyErrorMessage(err, 'Không thể gửi phản hồi đánh giá lúc này.'),
        'Gửi thất bại'
      );
    } finally {
      setSubmittingReply(false);
    }
  };

  const handlePickAvatar = useCallback(
    async (source: 'camera' | 'library') => {
      if (uploadingAvatar) return;
      setAvatarPickerVisible(false);

      try {
        if (source === 'camera' && Platform.OS !== 'web') {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) {
            toast.warning(
              'Vui lòng cấp quyền truy cập Máy ảnh để chụp ảnh đại diện.',
              'Chưa cấp quyền'
            );
            return;
          }
        } else if (source === 'library' && Platform.OS !== 'web') {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) {
            toast.warning(
              'Vui lòng cấp quyền truy cập Thư viện ảnh để chọn ảnh đại diện.',
              'Chưa cấp quyền'
            );
            return;
          }
        }

        const pickerOptions: ImagePicker.ImagePickerOptions = {
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.65,
          base64: true,
        };

        const result =
          source === 'camera' && Platform.OS !== 'web'
            ? await ImagePicker.launchCameraAsync(pickerOptions)
            : await ImagePicker.launchImageLibraryAsync(pickerOptions);

        if (result.canceled || !result.assets?.length) {
          return;
        }

        const asset = result.assets[0];
        if (!asset?.uri) return;

        setUploadingAvatar(true);
        const { persistentUri, mimeType, fileName } = await toPersistentAvatarDataUri(asset);
        let finalAvatarUri = persistentUri;

        // Thử tải lên qua endpoint avatar chuyên gia nếu tài khoản có quyền gửi file
        try {
          const uploaded = await consultationApi.uploadApplicationAvatar({
            uri: asset.uri,
            name: fileName,
            type: mimeType,
            blob: (asset as unknown as { file?: unknown }).file,
          });
          if (uploaded?.avatarUrl && isValidAvatarUrl(uploaded.avatarUrl)) {
            finalAvatarUri = resolveAssetUrl(uploaded.avatarUrl);
          }
        } catch {
          // Giữ bản lưu ảnh đại diện chất lượng cao đồng bộ trên thiết bị mà không cần đổi BE
        }

        const effectiveUid =
          userProfile?.userId || expertDetail?.userId || authUser?.id || '';
        if (effectiveUid) {
          await saveCustomExpertAvatar(effectiveUid, finalAvatarUri);
        }

        setCustomAvatarUri(finalAvatarUri);
        setExpertDetail((prev) => (prev ? { ...prev, avatarUrl: finalAvatarUri } : prev));
        toast.success('Đã cập nhật ảnh đại diện chuyên gia.', 'Thành công');
      } catch (err: unknown) {
        toast.error(
          toFriendlyErrorMessage(err, 'Không thể cập nhật ảnh đại diện lúc này.'),
          'Tải ảnh thất bại'
        );
      } finally {
        setUploadingAvatar(false);
      }
    },
    [authUser?.id, expertDetail?.userId, toast, uploadingAvatar, userProfile?.userId]
  );

  const displayName =
    formatPersonName(expertDetail?.fullName || userProfile?.fullName || authUser?.fullName) ||
    'Chuyên gia tư vấn thuế';
  const rawAvatarCandidate = customAvatarUri || expertDetail?.avatarUrl;
  const avatarUri = isValidAvatarUrl(rawAvatarCandidate)
    ? resolveAssetUrl(rawAvatarCandidate)
    : '';
  const certs = expertDetail?.verifiedCertificates || [];
  const fees = expertDetail?.feePackages || [];
  const specs = expertDetail?.specializationNames || [];
  const totalReviewsCount =
    receivedReviews.length > 0 ? receivedReviews.length : expertDetail?.totalReviews ?? 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <DrumHeader
        title="Hồ sơ chuyên gia"
        onBack={handleBack}
        backTestID="expertProfileBackBtn"
        right={
          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={() => navigation.navigate('EditProfile', { autoFocusTaxId: false })}
            accessibilityRole="button"
            accessibilityLabel="Sửa thông tin cá nhân"
            testID="expertProfileEditPersonalBtn"
          >
            <Text style={styles.headerActionText}>Sửa</Text>
          </TouchableOpacity>
        }
      />

      {loading && !refreshing ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingHint}>Đang tải hồ sơ chuyên gia...</Text>
        </View>
      ) : loadError && !expertDetail && !userProfile ? (
        <View style={styles.centerBox}>
          <Ionicons name="alert-circle-outline" size={32} color={theme.colors.error} />
          <Text style={styles.errorText}>{loadError}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => void loadProfileData(false)}
          >
            <Text style={styles.retryBtnText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadProfileData(true)}
              colors={[theme.colors.primary]}
            />
          }
        >
          <View style={styles.contentWrap}>
            {/* ── THẺ ĐỊNH DANH & CHỈ SỐ CHUYÊN GIA ── */}
            <View style={styles.heroCard}>
              <View style={styles.heroTopRow}>
                <TouchableOpacity
                  style={styles.avatarUploadBtn}
                  activeOpacity={0.82}
                  disabled={uploadingAvatar}
                  onPress={() => setAvatarPickerVisible(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Tải lên ảnh đại diện chuyên gia"
                  testID="expertProfileAvatarUploadBtn"
                >
                  <View style={styles.avatarCircleWrap}>
                    {avatarUri ? (
                      <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                    ) : (
                      <View style={styles.avatarFallback}>
                        <Ionicons name="person" size={28} color="#FFFFFF" />
                      </View>
                    )}

                    <View style={styles.avatarCameraBadge}>
                      {uploadingAvatar ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Ionicons name="camera" size={12} color="#FFFFFF" />
                      )}
                    </View>
                  </View>

                  <Text style={styles.avatarUploadHint}>
                    {uploadingAvatar ? 'Đang tải...' : 'Đổi ảnh'}
                  </Text>
                </TouchableOpacity>

                <View style={styles.heroInfoCol}>
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="shield-checkmark" size={12} color="#065F46" />
                    <Text style={styles.verifiedBadgeText}>
                      {expertDetail?.isActive === false ? 'Đang tạm ngưng nhận lịch' : 'Đã xác thực hành nghề'}
                    </Text>
                  </View>

                  <Text style={styles.heroName}>{displayName}</Text>
                  <Text style={styles.heroJobTitle}>
                    {expertDetail?.jobTitle || 'Chuyên gia tư vấn thuế'}
                  </Text>
                  {expertDetail?.companyName ? (
                    <Text style={styles.heroCompany} numberOfLines={2}>
                      {expertDetail.companyName}
                    </Text>
                  ) : null}
                </View>
              </View>

              <View style={styles.statsBar}>
                <View style={styles.statItem}>
                  <View style={styles.statValueRow}>
                    <Ionicons name="star" size={14} color="#D97706" />
                    <Text style={styles.statNumber}>
                      {(expertDetail?.rating ?? 0).toFixed(1)}
                    </Text>
                  </View>
                  <Text style={styles.statCaption}>{totalReviewsCount} đánh giá</Text>
                </View>

                <View style={styles.statDivider} />

                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>
                    {expertDetail?.completedConsultationsCount ?? 0}
                  </Text>
                  <Text style={styles.statCaption}>Ca hoàn tất</Text>
                </View>

                <View style={styles.statDivider} />

                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>
                    {expertDetail?.yearsOfExperience ?? 0} năm
                  </Text>
                  <Text style={styles.statCaption}>Kinh nghiệm</Text>
                </View>
              </View>
            </View>

            <GoldDoubleRule style={styles.rule} />

            {/* ── THANH CHUYỂN TAB NỘI DUNG ── */}
            <View style={styles.subTabRow}>
              <TouchableOpacity
                style={[styles.subTabBtn, activeTab === 'INFO' && styles.subTabBtnActive]}
                onPress={() => setActiveTab('INFO')}
                testID="expertProfileTab_INFO"
              >
                <Text
                  style={[styles.subTabText, activeTab === 'INFO' && styles.subTabTextActive]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                >
                  Chuyên môn &amp; Phí
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.subTabBtn, activeTab === 'CERTIFICATES' && styles.subTabBtnActive]}
                onPress={() => setActiveTab('CERTIFICATES')}
                testID="expertProfileTab_CERTIFICATES"
              >
                <Text
                  style={[
                    styles.subTabText,
                    activeTab === 'CERTIFICATES' && styles.subTabTextActive,
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                >
                  Chứng chỉ ({certs.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.subTabBtn, activeTab === 'REVIEWS' && styles.subTabBtnActive]}
                onPress={() => setActiveTab('REVIEWS')}
                testID="expertProfileTab_REVIEWS"
              >
                <Text
                  style={[styles.subTabText, activeTab === 'REVIEWS' && styles.subTabTextActive]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                >
                  Đánh giá ({totalReviewsCount})
                </Text>
              </TouchableOpacity>
            </View>

            {/* ── TAB 1: THÔNG TIN CHUYÊN MÔN, BIỂU PHÍ & LIÊN HỆ ── */}
            {activeTab === 'INFO' && (
              <>
                {/* Lĩnh vực chuyên môn */}
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Lĩnh vực tư vấn trọng tâm</Text>
                  {specs.length > 0 ? (
                    <View style={styles.specChipsWrap}>
                      {specs.map((specName, idx) => (
                        <View key={`${specName}-${idx}`} style={styles.specChip}>
                          <Ionicons
                            name="checkmark-circle"
                            size={14}
                            color="#8B1E1E"
                            style={styles.specChipIcon}
                          />
                          <Text style={styles.specChipText}>{specName}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.emptySubText}>
                      Chưa cập nhật danh mục lĩnh vực chuyên môn.
                    </Text>
                  )}

                  {expertDetail?.bio ? (
                    <View style={styles.bioBox}>
                      <Text style={styles.bioLabel}>Giới thiệu chuyên môn</Text>
                      <Text style={styles.bioBody}>{expertDetail.bio}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Bảng biểu phí dịch vụ đang áp dụng */}
                <View style={styles.sectionCard}>
                  <View style={styles.sectionHeadRow}>
                    <Text style={styles.sectionTitleNoMargin}>Biểu phí tư vấn đang áp dụng</Text>
                    <TouchableOpacity
                      onPress={() => navigation.navigate('ExpertSlots')}
                      style={styles.inlineLinkBtn}
                    >
                      <Text style={styles.inlineLinkText}>Mở lịch rảnh →</Text>
                    </TouchableOpacity>
                  </View>

                  {fees.length > 0 ? (
                    fees.map((pkg, idx) => (
                      <View
                        key={pkg.id || `${pkg.sessionType}-${idx}`}
                        style={[styles.feeRow, idx < fees.length - 1 && styles.rowBorder]}
                      >
                        <View style={styles.flex}>
                          <Text style={styles.feeSessionLabel}>
                            {formatSessionType(pkg.sessionType).fullLabel}
                          </Text>
                          <Text style={styles.feeDurationText}>
                            Thời lượng tiêu chuẩn: {pkg.durationMinutes} phút / phiên
                          </Text>
                        </View>
                        <Text style={styles.feeAmountText}>{formatVnd(pkg.fee)}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptySubText}>
                      Chưa ghi nhận gói phí dịch vụ trên hồ sơ công khai.
                    </Text>
                  )}
                </View>

                {/* Thông tin định danh & liên hệ tài khoản (/api/profile) */}
                {userProfile ? (
                  <View style={styles.sectionCard}>
                    <View style={styles.sectionHeadRow}>
                      <Text style={styles.sectionTitleNoMargin}>Thông tin tài khoản định danh</Text>
                      <TouchableOpacity
                        onPress={() => navigation.navigate('EditProfile', { autoFocusTaxId: false })}
                        style={styles.inlineLinkBtn}
                      >
                        <Text style={styles.inlineLinkText}>Chỉnh sửa →</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={[styles.infoFieldRow, styles.rowBorder]}>
                      <Text style={styles.infoFieldLabel}>Số CCCD:</Text>
                      <Text style={styles.infoFieldValue}>{userProfile.citizenId || '—'}</Text>
                    </View>
                    <View style={[styles.infoFieldRow, styles.rowBorder]}>
                      <Text style={styles.infoFieldLabel}>Mã số thuế:</Text>
                      <Text style={styles.infoFieldValue}>
                        {userProfile.taxIdNumber || 'Chưa bổ sung'}
                      </Text>
                    </View>
                    <View style={[styles.infoFieldRow, styles.rowBorder]}>
                      <Text style={styles.infoFieldLabel}>Email:</Text>
                      <Text style={styles.infoFieldValue}>{userProfile.email || '—'}</Text>
                    </View>
                    <View style={[styles.infoFieldRow, styles.rowBorder]}>
                      <Text style={styles.infoFieldLabel}>Số điện thoại:</Text>
                      <Text style={styles.infoFieldValue}>
                        {userProfile.phoneNumber || 'Chưa cập nhật'}
                      </Text>
                    </View>
                    <View style={styles.infoFieldRow}>
                      <Text style={styles.infoFieldLabel}>Địa chỉ:</Text>
                      <Text style={styles.infoFieldValue} numberOfLines={2}>
                        {sanitizeProfileAddress(userProfile.address, userProfile.citizenId) ||
                          'Chưa cập nhật'}
                      </Text>
                    </View>
                  </View>
                ) : null}
              </>
            )}

            {/* ── TAB 2: CHỨNG CHỈ HÀNH NGHỀ ĐÃ XÁC THỰC ── */}
            {activeTab === 'CERTIFICATES' && (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Chứng chỉ hành nghề đã xác thực</Text>
                {certs.length === 0 ? (
                  <Text style={styles.emptySubText}>
                    Chưa có chứng chỉ xác thực nào hiển thị trên hồ sơ công khai.
                  </Text>
                ) : (
                  certs.map((cert, idx) => (
                    <TouchableOpacity
                      key={cert.id || String(idx)}
                      style={[styles.certItem, idx < certs.length - 1 && styles.rowBorder]}
                      activeOpacity={0.8}
                      onPress={() => setSelectedCert(cert)}
                    >
                      <View style={styles.certIconBox}>
                        <Ionicons name="ribbon-outline" size={22} color="#8B1E1E" />
                      </View>
                      <View style={styles.flex}>
                        <Text style={styles.certName}>{cert.certificateName}</Text>
                        <Text style={styles.certMeta}>
                          Cấp bởi: {cert.issuingAuthority || 'Cơ quan có thẩm quyền'}
                        </Text>
                        <Text style={styles.certMeta}>
                          Số hiệu: {cert.maskedCertificateNumber || 'Đã xác thực'}
                          {cert.expiryDate ? ` • HSD: ${cert.expiryDate}` : ''}
                        </Text>
                      </View>
                      <Ionicons name="eye-outline" size={18} color={theme.colors.primary} />
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}

            {/* ── TAB 3: ĐÁNH GIÁ TỪ KHÁCH HÀNG & PHẢN HỒI CỦA CHUYÊN GIA ── */}
            {activeTab === 'REVIEWS' && (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Nhận xét từ khách hàng</Text>
                {receivedReviews.length === 0 ? (
                  <Text style={styles.emptySubText}>
                    Chưa có đánh giá nào từ khách hàng cho các ca tư vấn của bạn.
                  </Text>
                ) : (
                  receivedReviews.map((rev, idx) => (
                    <View
                      key={rev.id}
                      style={[styles.reviewCard, idx < receivedReviews.length - 1 && styles.rowBorder]}
                    >
                      <View style={styles.reviewHeaderRow}>
                        <Text style={styles.reviewerName}>
                          {rev.isAnonymous ? 'Khách hàng ẩn danh' : rev.reviewerName || 'Khách hàng'}
                        </Text>
                        <View style={styles.starRow}>
                          {Array.from({ length: 5 }, (_, sIdx) => (
                            <Ionicons
                              key={sIdx}
                              name={sIdx < rev.rating ? 'star' : 'star-outline'}
                              size={13}
                              color="#D97706"
                            />
                          ))}
                        </View>
                      </View>

                      <Text style={styles.reviewDate}>
                        {new Date(rev.createdAt).toLocaleDateString('vi-VN')}
                        {rev.isFlaggedForReview ? ' • Đang chờ kiểm duyệt' : ''}
                      </Text>

                      {rev.comment ? (
                        <Text style={styles.reviewComment}>{rev.comment}</Text>
                      ) : null}

                      {rev.expertReply ? (
                        <View style={styles.expertReplyBox}>
                          <Text style={styles.expertReplyLabel}>Phản hồi của bạn:</Text>
                          <Text style={styles.expertReplyBody}>{rev.expertReply}</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.replyActionBtn}
                          onPress={() => {
                            setReplyTarget(rev);
                            setReplyText('');
                          }}
                        >
                          <Ionicons
                            name="chatbubble-ellipses-outline"
                            size={14}
                            color={theme.colors.primary}
                          />
                          <Text style={styles.replyActionText}>Phản hồi đánh giá này</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))
                )}
              </View>
            )}
          </View>
        </ScrollView>
      )}

      <MainTabBar />

      {/* Modal Chọn nguồn tải lên ảnh đại diện */}
      <Modal
        visible={avatarPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAvatarPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setAvatarPickerVisible(false)}
        >
          <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeadRow}>
              <Text style={styles.modalTitle}>Cập nhật ảnh đại diện</Text>
              <TouchableOpacity onPress={() => setAvatarPickerVisible(false)}>
                <Ionicons name="close" size={22} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.avatarPickerSubtitle}>
              Chọn ảnh chân dung rõ nét để hiển thị trên hồ sơ chuyên gia tư vấn thuế của bạn.
            </Text>

            {Platform.OS !== 'web' ? (
              <TouchableOpacity
                style={styles.avatarOptionBtn}
                activeOpacity={0.8}
                onPress={() => void handlePickAvatar('camera')}
                testID="expertAvatarPickCameraBtn"
              >
                <View style={styles.avatarOptionIconWrap}>
                  <Ionicons name="camera-outline" size={20} color="#8B1E1E" />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.avatarOptionTitle}>Chụp ảnh mới</Text>
                  <Text style={styles.avatarOptionDesc}>Mở máy ảnh để chụp ảnh chân dung trực tiếp</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={styles.avatarOptionBtn}
              activeOpacity={0.8}
              onPress={() => void handlePickAvatar('library')}
              testID="expertAvatarPickLibraryBtn"
            >
              <View style={styles.avatarOptionIconWrap}>
                <Ionicons name="images-outline" size={20} color="#8B1E1E" />
              </View>
              <View style={styles.flex}>
                <Text style={styles.avatarOptionTitle}>Chọn từ thư viện thiết bị</Text>
                <Text style={styles.avatarOptionDesc}>Tải lên ảnh chân dung có sẵn (JPG, PNG, WebP)</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.avatarCancelBtn}
              onPress={() => setAvatarPickerVisible(false)}
            >
              <Text style={styles.cancelModalBtnText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal Xem chi tiết chứng chỉ */}
      <Modal
        visible={Boolean(selectedCert)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedCert(null)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setSelectedCert(null)}
        >
          <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeadRow}>
              <Text style={styles.modalTitle} numberOfLines={2}>
                {selectedCert?.certificateName || 'Chi tiết chứng chỉ'}
              </Text>
              <TouchableOpacity onPress={() => setSelectedCert(null)}>
                <Ionicons name="close" size={22} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDetailLine}>
              Đơn vị cấp: {selectedCert?.issuingAuthority || '—'}
            </Text>
            <Text style={styles.modalDetailLine}>
              Số hiệu: {selectedCert?.maskedCertificateNumber || '—'}
            </Text>
            {selectedCert?.issueDate ? (
              <Text style={styles.modalDetailLine}>Ngày cấp: {selectedCert.issueDate}</Text>
            ) : null}
            {selectedCert?.expiryDate ? (
              <Text style={styles.modalDetailLine}>Hiệu lực đến: {selectedCert.expiryDate}</Text>
            ) : null}

            {selectedCert?.fileUrl ? (
              isImageUrl(selectedCert.fileUrl) ? (
                <Image
                  source={{ uri: resolveAssetUrl(selectedCert.fileUrl) }}
                  style={styles.certPreviewImage}
                  resizeMode="contain"
                />
              ) : (
                <TouchableOpacity
                  style={styles.openCertFileBtn}
                  onPress={() => {
                    const full = resolveAssetUrl(selectedCert.fileUrl);
                    if (full) void Linking.openURL(full);
                  }}
                >
                  <Ionicons name="document-text-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.openCertFileBtnText}>Mở tệp chứng chỉ gốc</Text>
                </TouchableOpacity>
              )
            ) : null}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal Gửi phản hồi đánh giá khách hàng */}
      <Modal
        visible={Boolean(replyTarget)}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!submittingReply) setReplyTarget(null);
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeadRow}>
              <Text style={styles.modalTitle}>Phản hồi đánh giá khách hàng</Text>
              <TouchableOpacity
                disabled={submittingReply}
                onPress={() => setReplyTarget(null)}
              >
                <Ionicons name="close" size={22} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {replyTarget?.comment ? (
              <Text style={styles.replyQuoteText} numberOfLines={3}>
                &ldquo;{replyTarget.comment}&rdquo;
              </Text>
            ) : null}

            <TextInput
              style={styles.replyInput}
              placeholder="Nhập phản hồi lịch sự, chuyên nghiệp gửi tới khách hàng..."
              placeholderTextColor={theme.colors.textPlaceholder}
              multiline
              value={replyText}
              onChangeText={setReplyText}
              editable={!submittingReply}
              textAlignVertical="top"
            />
            <Text style={styles.replyNotice}>
              Lưu ý: Mỗi đánh giá chỉ được gửi phản hồi công khai một lần duy nhất.
            </Text>

            <View style={styles.modalFooterRow}>
              <TouchableOpacity
                style={styles.cancelModalBtn}
                disabled={submittingReply}
                onPress={() => setReplyTarget(null)}
              >
                <Text style={styles.cancelModalBtnText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitModalBtn}
                disabled={submittingReply}
                onPress={() => void handleSubmitReply()}
              >
                {submittingReply ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitModalBtnText}>Gửi phản hồi</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  flex: {
    flex: 1,
  },
  headerActionBtn: {
    minWidth: 44,
    height: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 4,
  },
  headerActionText: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.primary,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  loadingHint: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  errorText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.error,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
  },
  retryBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 36,
  },
  contentWrap: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: '#D99B26',
    padding: 16,
    ...theme.shadows.card,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarUploadBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarCircleWrap: {
    width: 68,
    height: 68,
    position: 'relative',
  },
  avatarImage: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: '#D99B26',
  },
  avatarFallback: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: theme.colors.primary,
    borderWidth: 2,
    borderColor: '#D99B26',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.primary,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarUploadHint: {
    fontFamily: fonts.bodySemi,
    fontSize: 11,
    lineHeight: 15,
    color: theme.colors.primary,
    marginTop: 5,
  },
  heroInfoCol: {
    flex: 1,
    minWidth: 0,
  },
  verifiedBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    marginBottom: 5,
  },
  verifiedBadgeText: {
    fontFamily: fonts.bodySemi,
    fontSize: 10.5,
    lineHeight: 14,
    color: '#065F46',
  },
  heroName: {
    fontFamily: fonts.serifBold,
    fontSize: 19,
    lineHeight: 25,
    color: theme.colors.primaryDark,
  },
  heroJobTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: 13.5,
    lineHeight: 19,
    color: theme.colors.textPrimary,
    marginTop: 2,
  },
  heroCompany: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EFE8D8',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statNumber: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    lineHeight: 21,
    color: theme.colors.textPrimary,
  },
  statCaption: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    lineHeight: 16,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E5D8C3',
  },
  rule: {
    marginVertical: 14,
  },
  subTabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  subTabBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: 10,
    backgroundColor: '#EFEBE2',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  subTabBtnActive: {
    backgroundColor: theme.colors.primary,
  },
  subTabText: {
    fontFamily: fonts.bodySemi,
    fontSize: 12.5,
    lineHeight: 17,
    color: theme.colors.textSecondary,
  },
  subTabTextActive: {
    color: '#FFFFFF',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 15,
    marginBottom: 14,
    ...theme.shadows.card,
  },
  sectionHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 16,
    lineHeight: 22,
    color: theme.colors.primaryDark,
    marginBottom: 10,
  },
  sectionTitleNoMargin: {
    fontFamily: fonts.serifBold,
    fontSize: 16,
    lineHeight: 22,
    color: theme.colors.primaryDark,
    flex: 1,
  },
  inlineLinkBtn: {
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  inlineLinkText: {
    fontFamily: fonts.bodySemi,
    fontSize: 12.5,
    lineHeight: 17,
    color: theme.colors.primary,
  },
  specChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    width: '100%',
  },
  specChip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    maxWidth: '100%',
    flexShrink: 1,
    backgroundColor: '#FFF9E6',
    borderWidth: 1,
    borderColor: '#E8D4A2',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  specChipIcon: {
    marginTop: 2,
    flexShrink: 0,
  },
  specChipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12.5,
    lineHeight: 18,
    color: '#5A4A22',
    flexShrink: 1,
    minWidth: 0,
    ...(Platform.OS === 'web'
      ? ({ wordBreak: 'break-word', overflowWrap: 'anywhere' } as any)
      : {}),
  },
  bioBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  bioLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 12.5,
    lineHeight: 17,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  bioBody: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    lineHeight: 20,
    color: theme.colors.textPrimary,
  },
  emptySubText: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textSecondary,
  },
  feeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 11,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  feeSessionLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textPrimary,
  },
  feeDurationText: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  feeAmountText: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    lineHeight: 20,
    color: '#059669',
  },
  infoFieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
  },
  infoFieldLabel: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    lineHeight: 19,
    color: theme.colors.textSecondary,
    flexShrink: 0,
  },
  infoFieldValue: {
    flex: 1,
    fontFamily: fonts.bodySemi,
    fontSize: 13.5,
    lineHeight: 19,
    color: theme.colors.textPrimary,
    textAlign: 'right',
  },
  certItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  certIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FCE4A6',
    borderWidth: 1,
    borderColor: '#D99B26',
    alignItems: 'center',
    justifyContent: 'center',
  },
  certName: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    lineHeight: 19,
    color: theme.colors.textPrimary,
  },
  certMeta: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  reviewCard: {
    paddingVertical: 12,
  },
  reviewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  reviewerName: {
    fontFamily: fonts.bodyBold,
    fontSize: 13.5,
    lineHeight: 19,
    color: theme.colors.textPrimary,
    flex: 1,
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  reviewDate: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    lineHeight: 16,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  reviewComment: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    lineHeight: 20,
    color: theme.colors.textPrimary,
    marginTop: 6,
  },
  expertReplyBox: {
    marginTop: 8,
    backgroundColor: '#FAF7F0',
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
    padding: 10,
  },
  expertReplyLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 11.5,
    lineHeight: 16,
    color: theme.colors.primary,
  },
  expertReplyBody: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textPrimary,
    marginTop: 3,
  },
  replyActionBtn: {
    alignSelf: 'flex-start',
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  replyActionText: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    lineHeight: 16,
    color: theme.colors.primary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  modalCard: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  modalTitle: {
    flex: 1,
    fontFamily: fonts.serifBold,
    fontSize: 17,
    lineHeight: 23,
    color: theme.colors.primaryDark,
  },
  modalDetailLine: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  certPreviewImage: {
    width: '100%',
    height: 260,
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
  },
  openCertFileBtn: {
    marginTop: 14,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  openCertFileBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13.5,
    color: '#FFFFFF',
  },
  replyQuoteText: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    lineHeight: 18,
    color: theme.colors.textSecondary,
    backgroundColor: '#F8F5EE',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  replyInput: {
    minHeight: 100,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#FAF7F2',
    padding: 12,
    fontFamily: fonts.body,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  replyNotice: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    lineHeight: 16,
    color: theme.colors.textSecondary,
    marginTop: 6,
  },
  modalFooterRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  cancelModalBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelModalBtnText: {
    fontFamily: fonts.bodySemi,
    fontSize: 13.5,
    color: theme.colors.textSecondary,
  },
  submitModalBtn: {
    flex: 1.4,
    minHeight: 42,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitModalBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13.5,
    color: '#FFFFFF',
  },
  avatarPickerSubtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textSecondary,
    marginBottom: 12,
  },
  avatarOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 10,
  },
  avatarOptionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FCE4A6',
    borderWidth: 1,
    borderColor: '#D99B26',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarOptionTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    lineHeight: 19,
    color: theme.colors.textPrimary,
  },
  avatarOptionDesc: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  avatarCancelBtn: {
    marginTop: 4,
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
