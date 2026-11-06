import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { theme } from '../../constants/theme';
import { HeaderMotif } from '../../components/common/HeaderMotif';
import { CustomButton } from '../../components/common/CustomButton';
import { Dialog } from '../../components/common/Dialog';
import { InfoNote } from '../../components/common/InfoNote';
import { SourceOptionCard } from '../../components/ocr/SourceOptionCard';
import { DocumentPreview } from '../../components/ocr/DocumentPreview';
import { OcrField } from '../../components/ocr/OcrField';
import {
  DocumentViewerModal,
  DocumentViewerItem,
} from '../../components/common/DocumentViewerModal';
import { useToast } from '../../components/ui/Toast';
import { RootNavigationProp, RootStackParamList } from '../../navigation/types';
import {
  OCR_FIELD_META,
  OcrExtractedFields,
  OcrFieldKey,
  OcrFieldStatus,
  ScanIdentitySource,
} from '../../types/ocr';
import { ocrApi } from '../../api/ocrApi';
import { normalizeOcrForForm, mapToDependentFill } from './ocrUtils';
import {
  canConfirmOcrReview,
  createEmptyOcrFields,
  evaluateOcrImageAsset,
  WEB_CAMERA_UNAVAILABLE_MESSAGE,
} from './scanIdentityCore';
import { runRegisterOcrExtract } from './scanIdentityRegisterExtract';
import {
  CCCD_PROFILE_MISMATCH_MESSAGE,
  runEditProfileOcrExtract,
} from './scanIdentityEditProfileExtract';
import {
  DEPENDENT_OCR_TIMEOUT_MESSAGE,
  runDependentOcrExtract,
} from './scanIdentityDependentExtract';
import { sanitizeUiMessage } from '../../utils/friendlyError';

type ScreenState = 'source' | 'camera' | 'backOffer' | 'review';
type ProcessPhase = 'idle' | 'uploading' | 'extracting';
type ScanIdentityRoute = RouteProp<RootStackParamList, 'ScanIdentity'>;

type ActionDialogConfig = {
  title: string;
  message: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
};

export const ScanIdentityScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const route = useRoute<ScanIdentityRoute>();
  const insets = useSafeAreaInsets();
  const { toast } = useToast();

  const source: ScanIdentitySource = route.params?.source ?? 'register';
  const hasExistingData = route.params?.hasExistingData ?? false;
  const lockedCitizenId = route.params?.lockedCitizenId;

  const [screen, setScreen] = useState<ScreenState>('source');
  const [processPhase, setProcessPhase] = useState<ProcessPhase>('idle');
  const [flashOn, setFlashOn] = useState(false);
  const [frontUri, setFrontUri] = useState<string | null>(null);
  const [backUri, setBackUri] = useState<string | null>(null);
  const [fields, setFields] = useState<OcrExtractedFields>(createEmptyOcrFields);
  const [lowConfidence] = useState<OcrFieldKey[]>([]);
  const [, setViewedLowFields] = useState<Set<OcrFieldKey>>(new Set());
  const [viewerOpen, setViewerOpen] = useState(false);

  const [blurryVisible, setBlurryVisible] = useState(false);
  const [blurryMessage, setBlurryMessage] = useState<string | undefined>();
  const [overwriteVisible, setOverwriteVisible] = useState(false);
  const [serverErrorVisible, setServerErrorVisible] = useState(false);
  const [invalidCitizenIdVisible, setInvalidCitizenIdVisible] = useState(false);
  const [invalidCitizenIdMessage, setInvalidCitizenIdMessage] = useState<string | undefined>();
  const [citizenIdMismatch, setCitizenIdMismatch] = useState(false);
  const [actionDialog, setActionDialog] = useState<ActionDialogConfig | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const isBusy = processPhase !== 'idle';
  const imageUri = frontUri;

  const skipManual = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const cancelProcessing = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setProcessPhase('idle');
    setScreen('source');
  }, []);

  const fieldStatus = useCallback(
    (key: OcrFieldKey): OcrFieldStatus => {
      if (!fields[key]?.trim()) return 'unreadable';
      if (lowConfidence.includes(key)) return 'check';
      return 'confident';
    },
    [fields, lowConfidence]
  );

  const canConfirm = useMemo(() => canConfirmOcrReview(fields, source), [fields, source]);

  const runExtract = useCallback(
    async (front: string, back?: string | null) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setProcessPhase('uploading');
      setViewedLowFields(new Set());
      setCitizenIdMismatch(false);

      try {
        if (source === 'register') {
          setProcessPhase('extracting');
          const result = await runRegisterOcrExtract({
            frontUri: front,
            backUri: back,
            signal: controller.signal,
            extractUserCccd: ocrApi.extractUserCccd,
          });
          if (controller.signal.aborted) return;
          if (result.ok) {
            setFields(result.fields);
            setProcessPhase('idle');
            setScreen('review');
            return;
          }
          setProcessPhase('idle');
          if (result.kind === 'blurry') {
            setBlurryMessage(result.message);
            setBlurryVisible(true);
            return;
          }
          if (result.kind === 'invalidCitizenId') {
            setInvalidCitizenIdMessage(result.message);
            setInvalidCitizenIdVisible(true);
            return;
          }
          setServerErrorVisible(true);
          return;
        }

        if (source === 'editProfile') {
          setProcessPhase('extracting');
          const result = await runEditProfileOcrExtract({
            frontUri: front,
            backUri: back,
            lockedCitizenId,
            signal: controller.signal,
            extractDirect: ocrApi.extractDirect,
          });
          if (controller.signal.aborted) return;
          if (result.ok) {
            setFields(result.fields);
            setCitizenIdMismatch(result.citizenIdMismatch);
            setProcessPhase('idle');
            setScreen('review');
            return;
          }
          setProcessPhase('idle');
          if (result.kind === 'blurry') {
            setBlurryMessage(result.message);
            setBlurryVisible(true);
            return;
          }
          setServerErrorVisible(true);
          return;
        }

        const result = await runDependentOcrExtract({
          frontUri: front,
          backUri: back,
          signal: controller.signal,
          extractDirect: ocrApi.extractDirect,
          onPhase: (phase) => {
            if (!controller.signal.aborted) setProcessPhase(phase);
          },
        });
        if (controller.signal.aborted) return;
        if (result.ok) {
          setFields(result.fields);
          setProcessPhase('idle');
          setScreen('review');
          return;
        }
        setProcessPhase('idle');
        if (result.kind === 'blurry') {
          setBlurryMessage(result.message);
          setBlurryVisible(true);
          return;
        }
        if (result.kind === 'timeout') {
          setActionDialog({
            title: 'Quá thời gian đọc giấy tờ',
            message: sanitizeUiMessage(result.message, DEPENDENT_OCR_TIMEOUT_MESSAGE),
            secondaryLabel: 'Nhập thủ công',
            onSecondary: skipManual,
            primaryLabel: 'Thử lại',
            onPrimary: () => void runExtract(front, back),
          });
          return;
        }
        setServerErrorVisible(true);
      } catch (error: unknown) {
        if (controller.signal.aborted) return;
        const name = error instanceof Error ? error.name : '';
        if (name === 'AbortError') return;
        setProcessPhase('idle');
        setServerErrorVisible(true);
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    },
    [lockedCitizenId, skipManual, source]
  );

  const acceptFrontAndOfferBack = useCallback((uri: string) => {
    setFrontUri(uri);
    setBackUri(null);
    setScreen('backOffer');
  }, []);

  const validateAndProcessFront = useCallback(
    (asset: ImagePicker.ImagePickerAsset) => {
      const result = evaluateOcrImageAsset({
        uri: asset.uri,
        fileName: asset.fileName,
        mimeType: asset.mimeType,
        fileSize: asset.fileSize,
        width: asset.width,
        height: asset.height,
      });

      if (!result.ok) {
        if (result.reason === 'format') {
          toast.warning('Vui lòng chọn ảnh định dạng JPG hoặc PNG.', 'Định dạng ảnh chưa hỗ trợ');
          return;
        }
        if (result.reason === 'tooLarge') {
          toast.warning('Vui lòng chọn ảnh có dung lượng không vượt quá 10 MB.', 'Dung lượng ảnh quá lớn');
          return;
        }
        if (result.reason === 'tooSmall') {
          toast.warning('Vui lòng chụp gần hơn hoặc chọn ảnh rõ nét hơn.', 'Độ phân giải ảnh quá thấp');
          return;
        }
        setFrontUri(asset.uri);
        setBlurryVisible(true);
        return;
      }

      acceptFrontAndOfferBack(asset.uri);
    },
    [acceptFrontAndOfferBack, toast]
  );

  const validateAndProcessBack = useCallback(
    (asset: ImagePicker.ImagePickerAsset) => {
      const result = evaluateOcrImageAsset({
        uri: asset.uri,
        fileName: asset.fileName,
        mimeType: asset.mimeType,
        fileSize: asset.fileSize,
        width: asset.width,
        height: asset.height,
      });

      if (!result.ok) {
        if (result.reason === 'blurry') {
          setBlurryVisible(true);
          return;
        }
        toast.warning(
          'Vui lòng chọn ảnh JPG/PNG rõ nét hoặc bỏ qua bước chụp mặt sau.',
          'Ảnh mặt sau chưa hợp lệ'
        );
        return;
      }

      setBackUri(asset.uri);
      if (frontUri) {
        void runExtract(frontUri, asset.uri);
      }
    },
    [frontUri, runExtract, toast]
  );

  const pickFromLibrary = useCallback(
    async (forBack = false) => {
      try {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          setActionDialog({
            title: 'Cần quyền truy cập thư viện ảnh',
            message: 'Vui lòng cấp quyền thư viện ảnh trong Cài đặt thiết bị, hoặc chuyển sang nhập thủ công.',
            secondaryLabel: 'Đóng',
            primaryLabel: 'Nhập thủ công',
            onPrimary: skipManual,
          });
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.8,
          allowsEditing: false,
          base64: false,
        });
        if (result.canceled || !result.assets?.[0]) return;
        if (forBack) validateAndProcessBack(result.assets[0]);
        else validateAndProcessFront(result.assets[0]);
      } catch {
        setActionDialog({
          title: 'Không mở được thư viện ảnh',
          message: 'Không thể truy cập thư viện ảnh lúc này. Bạn có thể thử lại hoặc nhập thủ công.',
          secondaryLabel: 'Đóng',
          primaryLabel: 'Nhập thủ công',
          onPrimary: skipManual,
        });
      }
    },
    [skipManual, validateAndProcessBack, validateAndProcessFront]
  );

  const captureFromCamera = useCallback(
    async (forBack = false) => {
      if (Platform.OS === 'web') {
        setActionDialog({
          title: 'Máy ảnh chưa khả dụng',
          message: WEB_CAMERA_UNAVAILABLE_MESSAGE,
          secondaryLabel: 'Nhập thủ công',
          onSecondary: skipManual,
          primaryLabel: 'Chọn từ thư viện',
          onPrimary: () => void pickFromLibrary(forBack),
        });
        return;
      }
      try {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setActionDialog({
            title: 'Cần quyền sử dụng máy ảnh',
            message: 'Vui lòng cấp quyền máy ảnh trong Cài đặt thiết bị, hoặc chuyển sang nhập thủ công.',
            secondaryLabel: 'Đóng',
            primaryLabel: 'Nhập thủ công',
            onPrimary: skipManual,
          });
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.8,
          allowsEditing: false,
          base64: false,
        });
        if (result.canceled || !result.assets?.[0]) return;
        if (forBack) validateAndProcessBack(result.assets[0]);
        else validateAndProcessFront(result.assets[0]);
      } catch {
        setActionDialog({
          title: 'Không mở được máy ảnh',
          message: 'Không thể khởi động máy ảnh lúc này. Bạn có thể chọn ảnh từ thư viện hoặc nhập thủ công.',
          secondaryLabel: 'Nhập thủ công',
          onSecondary: skipManual,
          primaryLabel: 'Chọn từ thư viện',
          onPrimary: () => void pickFromLibrary(forBack),
        });
      }
    },
    [pickFromLibrary, skipManual, validateAndProcessBack, validateAndProcessFront]
  );

  const applyAndReturn = useCallback(() => {
    if (source === 'editProfile') {
      const fill = normalizeOcrForForm(fields);
      navigation.navigate({
        name: 'EditProfile',
        params: { ocrResult: fill },
        merge: true,
      });
      return;
    }
    if (source === 'dependent') {
      const fill = mapToDependentFill(fields, fields.suggestedGroup);
      navigation.navigate({
        name: 'TaxRegistration',
        params: { ocrDependentFill: fill },
        merge: true,
      });
      return;
    }
    const fill = normalizeOcrForForm(fields);
    navigation.navigate({
      name: 'Register',
      params: { ocrResult: fill },
      merge: true,
    });
  }, [fields, navigation, source]);

  const onPressUseInfo = useCallback(() => {
    if (hasExistingData) {
      setOverwriteVisible(true);
      return;
    }
    applyAndReturn();
  }, [applyAndReturn, hasExistingData]);

  const viewerDoc: DocumentViewerItem = useMemo(
    () => ({
      uri: imageUri ?? undefined,
      title: 'Ảnh căn cước công dân',
      fileName: 'cccd-preview.jpg',
      isReadable: true,
      mimeType: 'image/jpeg',
    }),
    [imageUri]
  );

  const renderProcessing = () => {
    if (!isBusy) return null;
    return (
      <View style={styles.processScrim} pointerEvents="auto">
        <View style={styles.processCard}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.processTitle}>
            {processPhase === 'uploading' ? 'Đang tải ảnh lên...' : 'Đang đọc thông tin từ giấy tờ...'}
          </Text>
          <TouchableOpacity style={styles.cancelChip} onPress={cancelProcessing}>
            <Text style={styles.cancelChipText}>Hủy thao tác</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderSource = () => (
    <SafeAreaView style={styles.safe}>
      <HeaderMotif title="QUÉT CĂN CƯỚC CÔNG DÂN" onBack={skipManual} />
      <ScrollView contentContainerStyle={styles.sourceContent} showsVerticalScrollIndicator={false}>
        <View style={styles.contentWrap}>
          <Text style={styles.lead}>
            Chụp hoặc chọn ảnh mặt trước căn cước công dân để điền nhanh thông tin hồ sơ.
          </Text>

          <SourceOptionCard
            icon="camera-outline"
            title="Chụp ảnh bằng máy ảnh"
            subtitle="Khung căn giấy tờ, hỗ trợ đèn trợ sáng"
            onPress={() => setScreen('camera')}
          />
          <SourceOptionCard
            icon="images-outline"
            title="Chọn ảnh từ thiết bị"
            subtitle="Thư viện ảnh trên điện thoại"
            onPress={() => void pickFromLibrary(false)}
          />

          <View style={styles.metaRow}>
            <Text style={styles.metaText}>Định dạng: JPG, PNG</Text>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.metaText}>Tối đa: 10 MB</Text>
          </View>

          <InfoNote text="Ảnh chỉ dùng để đọc thông tin một lần và không lưu lại trên hệ thống." />

          <TouchableOpacity style={styles.skipLink} onPress={skipManual}>
            <Text style={styles.skipLinkText}>Bỏ qua, tôi sẽ nhập thủ công</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      {renderProcessing()}
    </SafeAreaView>
  );

  const renderBackOffer = () => (
    <SafeAreaView style={styles.safe}>
      <HeaderMotif title="THÊM MẶT SAU" onBack={() => setScreen('source')} />
      <ScrollView contentContainerStyle={styles.sourceContent} showsVerticalScrollIndicator={false}>
        <View style={styles.contentWrap}>
          <Text style={styles.lead}>
            Bạn có thể bổ sung ảnh mặt sau (không bắt buộc) để đọc đầy đủ ngày cấp và nơi thường trú.
          </Text>
          {frontUri ? <DocumentPreview uri={frontUri} onPress={() => setViewerOpen(true)} /> : null}
          <View style={styles.spacerMd} />
          <SourceOptionCard
            icon="camera-outline"
            title="Chụp mặt sau"
            subtitle="Không bắt buộc"
            onPress={() => void captureFromCamera(true)}
          />
          <SourceOptionCard
            icon="images-outline"
            title="Chọn ảnh mặt sau từ thiết bị"
            subtitle="Không bắt buộc"
            onPress={() => void pickFromLibrary(true)}
          />
          <CustomButton
            title="Bỏ qua, chỉ dùng mặt trước"
            variant="outline"
            onPress={() => {
              if (frontUri) void runExtract(frontUri, null);
            }}
            style={styles.skipBackBtn}
          />
        </View>
      </ScrollView>
      {renderProcessing()}
      <DocumentViewerModal
        visible={viewerOpen}
        onClose={() => setViewerOpen(false)}
        document={viewerDoc}
      />
    </SafeAreaView>
  );

  const renderCamera = () => (
    <View style={styles.cameraRoot}>
      <SafeAreaView style={styles.cameraSafe}>
        <View style={styles.cameraTop}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => setScreen('source')}
            accessibilityLabel="Đóng máy ảnh"
          >
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.viewfinderWrap}>
          <View style={styles.goldFrame}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
            <Text style={styles.frameHint}>Đặt căn cước nằm trọn{'\n'}trong khung này</Text>
          </View>
          <Text style={styles.steadyHint}>Giữ máy vững, tránh bóng tối và ánh sáng lóa</Text>
        </View>

        <View style={styles.cameraBar}>
          <TouchableOpacity
            style={styles.sideBtn}
            onPress={() => void pickFromLibrary(false)}
            disabled={isBusy}
          >
            <Ionicons name="images-outline" size={22} color="#FFFFFF" />
            <Text style={styles.sideLabel}>Thư viện</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.shutterOuter}
            onPress={() => void captureFromCamera(false)}
            disabled={isBusy}
            accessibilityLabel="Chụp"
          >
            <View style={styles.shutterInner} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.sideBtn}
            onPress={() => setFlashOn((v) => !v)}
            disabled={isBusy}
          >
            <Ionicons
              name={flashOn ? 'flash' : 'flash-off'}
              size={22}
              color={flashOn ? theme.colors.gold : '#FFFFFF'}
            />
            <Text style={styles.sideLabel}>Trợ sáng</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
      {renderProcessing()}
    </View>
  );

  const renderReview = () => (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <HeaderMotif title="KIỂM TRA THÔNG TIN" onBack={() => setScreen('source')} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.reviewContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.contentWrap}>
            <DocumentPreview uri={imageUri} onPress={() => setViewerOpen(true)} />
            {fields.isAvailable === false ? (
              <View style={styles.warningBanner}>
                <Ionicons name="warning-outline" size={18} color={theme.colors.warning} />
                <Text style={styles.warningBannerText}>
                  {sanitizeUiMessage(
                    fields.warning,
                    'Số căn cước công dân này đã được đăng ký tài khoản. Bạn vẫn có thể dùng thông tin để điền biểu mẫu.'
                  )}
                </Text>
              </View>
            ) : null}
            {citizenIdMismatch ? (
              <View style={styles.warningBanner}>
                <Ionicons name="warning-outline" size={18} color={theme.colors.warning} />
                <Text style={styles.warningBannerText}>{CCCD_PROFILE_MISMATCH_MESSAGE}</Text>
              </View>
            ) : null}
            <InfoNote
              tone="review"
              text="Vui lòng đối chiếu với giấy tờ gốc và chỉnh sửa trực tiếp nếu có sai lệch."
            />

            <View style={styles.spacerMd} />

            {OCR_FIELD_META.map((meta) => (
              <OcrField
                key={meta.key}
                label={meta.label}
                value={fields[meta.key] ?? ''}
                placeholder={meta.placeholder || undefined}
                status={fieldStatus(meta.key)}
                unusedHint={!meta.usedInRegister}
                keyboardType={meta.key === 'citizenId' ? 'numeric' : 'default'}
                onFocus={() => {
                  if (lowConfidence.includes(meta.key)) {
                    setViewedLowFields((prev) => new Set(prev).add(meta.key));
                  }
                }}
                onChangeText={(text) => {
                  setFields((prev) => ({ ...prev, [meta.key]: text }));
                  if (lowConfidence.includes(meta.key)) {
                    setViewedLowFields((prev) => new Set(prev).add(meta.key));
                  }
                }}
              />
            ))}
            {source === 'dependent' || fields.documentNumber ? (
              <OcrField
                label="Số giấy khai sinh"
                value={fields.documentNumber ?? ''}
                status={fields.documentNumber?.trim() ? 'confident' : 'unreadable'}
                unusedHint={false}
                onChangeText={(text) => {
                  setFields((prev) => ({ ...prev, documentNumber: text }));
                }}
              />
            ) : null}
          </View>
        </ScrollView>

        <View style={[styles.stickyCta, { paddingBottom: Math.max(16, insets.bottom + 8) }]}>
          <CustomButton
            title="Chụp lại"
            variant="outline"
            onPress={() => {
              setFrontUri(null);
              setBackUri(null);
              setCitizenIdMismatch(false);
              setFields(createEmptyOcrFields());
              setScreen('source');
            }}
            style={styles.ctaHalf}
          />
          <CustomButton
            title="Dùng thông tin này"
            onPress={onPressUseInfo}
            disabled={!canConfirm}
            style={styles.ctaHalf}
          />
        </View>
      </KeyboardAvoidingView>

      <DocumentViewerModal
        visible={viewerOpen}
        onClose={() => setViewerOpen(false)}
        document={viewerDoc}
        onRePick={() => {
          setViewerOpen(false);
          setScreen('source');
        }}
      />
    </SafeAreaView>
  );

  return (
    <>
      {screen === 'source' ? renderSource() : null}
      {screen === 'camera' ? renderCamera() : null}
      {screen === 'backOffer' ? renderBackOffer() : null}
      {screen === 'review' ? renderReview() : null}

      <Dialog
        visible={blurryVisible}
        title="Ảnh giấy tờ chưa đủ rõ"
        message={sanitizeUiMessage(
          blurryMessage,
          'Ảnh bị mờ hoặc thiếu sáng nên chưa đọc được thông tin. Vui lòng đặt phẳng giấy tờ ở nơi đủ sáng và chụp lại.'
        )}
        secondaryLabel="Chọn ảnh khác"
        primaryLabel="Chụp lại"
        onSecondary={() => {
          setBlurryVisible(false);
          setBlurryMessage(undefined);
          setScreen('source');
        }}
        onPrimary={() => {
          setBlurryVisible(false);
          setBlurryMessage(undefined);
          setScreen('camera');
        }}
      />

      <Dialog
        visible={invalidCitizenIdVisible}
        title="Chưa nhận diện được số CCCD"
        message={sanitizeUiMessage(
          invalidCitizenIdMessage,
          'Chưa đọc được dãy 12 chữ số căn cước công dân hợp lệ. Vui lòng chụp lại mặt trước căn cước hoặc nhập thủ công.'
        )}
        secondaryLabel="Nhập thủ công"
        primaryLabel="Chụp lại"
        onSecondary={() => {
          setInvalidCitizenIdVisible(false);
          setInvalidCitizenIdMessage(undefined);
          skipManual();
        }}
        onPrimary={() => {
          setInvalidCitizenIdVisible(false);
          setInvalidCitizenIdMessage(undefined);
          setScreen('source');
        }}
      />

      <Dialog
        visible={overwriteVisible}
        title="Thay thế thông tin đang nhập?"
        message="Biểu mẫu đã có dữ liệu trước đó. Thông tin đọc từ căn cước sẽ thay thế các mục tương ứng."
        detailLabel="Họ và tên nhận diện"
        detail={fields.fullName || undefined}
        secondaryLabel="Giữ nguyên"
        primaryLabel="Thay thế"
        destructive
        onSecondary={() => setOverwriteVisible(false)}
        onPrimary={() => {
          setOverwriteVisible(false);
          applyAndReturn();
        }}
      />

      <Dialog
        visible={serverErrorVisible}
        title="Chưa đọc được thông tin giấy tờ"
        message="Tạm thời chưa trích xuất được dữ liệu từ ảnh vừa chọn. Bạn có thể thử đọc lại hoặc nhập thủ công."
        secondaryLabel="Nhập thủ công"
        primaryLabel="Thử lại"
        onSecondary={() => {
          setServerErrorVisible(false);
          skipManual();
        }}
        onPrimary={() => {
          setServerErrorVisible(false);
          if (frontUri) void runExtract(frontUri, backUri);
        }}
      />

      <Dialog
        visible={actionDialog !== null}
        title={actionDialog?.title || ''}
        message={actionDialog?.message || ''}
        secondaryLabel={actionDialog?.secondaryLabel}
        primaryLabel={actionDialog?.primaryLabel || 'Đóng'}
        onSecondary={
          actionDialog?.secondaryLabel
            ? () => {
                const cb = actionDialog.onSecondary;
                setActionDialog(null);
                cb?.();
              }
            : undefined
        }
        onPrimary={() => {
          const cb = actionDialog?.onPrimary;
          setActionDialog(null);
          cb?.();
        }}
      />
    </>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  sourceContent: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.xl * 2,
  },
  contentWrap: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  spacerMd: {
    height: theme.spacing.md,
  },
  skipBackBtn: {
    marginTop: theme.spacing.md,
  },
  lead: {
    ...theme.typography.bodyLarge,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.lg,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 4,
    marginBottom: theme.spacing.md,
  },
  metaText: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
  metaDot: {
    marginHorizontal: 8,
    color: theme.colors.textSecondary,
  },
  skipLink: {
    alignSelf: 'center',
    marginTop: theme.spacing.lg,
    padding: 8,
  },
  skipLinkText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.primary,
    fontWeight: '700',
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
  cameraRoot: {
    flex: 1,
    backgroundColor: '#0D0F12',
  },
  cameraSafe: {
    flex: 1,
  },
  cameraTop: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: Platform.OS === 'android' ? 8 : 4,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewfinderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  goldFrame: {
    width: '100%',
    maxWidth: 420,
    aspectRatio: 1.58,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderColor: '#FFFFFF',
  },
  cornerTL: { top: -1, left: -1, borderTopWidth: 4, borderLeftWidth: 4 },
  cornerTR: { top: -1, right: -1, borderTopWidth: 4, borderRightWidth: 4 },
  cornerBL: { bottom: -1, left: -1, borderBottomWidth: 4, borderLeftWidth: 4 },
  cornerBR: { bottom: -1, right: -1, borderBottomWidth: 4, borderRightWidth: 4 },
  frameHint: {
    color: 'rgba(255,255,255,0.88)',
    textAlign: 'center',
    ...theme.typography.bodyMedium,
    fontWeight: '600',
    paddingHorizontal: 12,
  },
  steadyHint: {
    marginTop: 16,
    color: 'rgba(255,255,255,0.7)',
    ...theme.typography.bodySmall,
    textAlign: 'center',
  },
  cameraBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 28,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  sideBtn: {
    minWidth: 72,
    alignItems: 'center',
  },
  sideLabel: {
    color: '#FFFFFF',
    ...theme.typography.caption,
    marginTop: 6,
  },
  shutterOuter: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FFFFFF',
  },
  processScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    zIndex: 20,
  },
  processCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 18,
    paddingHorizontal: 28,
    paddingVertical: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
  },
  processTitle: {
    ...theme.typography.bodyLarge,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginTop: 14,
    textAlign: 'center',
  },
  cancelChip: {
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceSecondary,
  },
  cancelChipText: {
    ...theme.typography.bodyMedium,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  reviewContent: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: 32,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.warningBackground,
  },
  warningBannerText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textPrimary,
    flex: 1,
  },
  stickyCta: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: theme.spacing.md,
    paddingTop: 12,
    backgroundColor: theme.colors.background,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  ctaHalf: {
    flex: 1,
  },
});
