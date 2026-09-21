import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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

type ScreenState = 'source' | 'camera' | 'backOffer' | 'review';
type ProcessPhase = 'idle' | 'uploading' | 'extracting';
type ScanIdentityRoute = RouteProp<RootStackParamList, 'ScanIdentity'>;

export const ScanIdentityScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const route = useRoute<ScanIdentityRoute>();
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
  const [viewedLowFields, setViewedLowFields] = useState<Set<OcrFieldKey>>(new Set());
  const [viewerOpen, setViewerOpen] = useState(false);

  const [blurryVisible, setBlurryVisible] = useState(false);
  const [blurryMessage, setBlurryMessage] = useState<string | undefined>();
  const [overwriteVisible, setOverwriteVisible] = useState(false);
  const [serverErrorVisible, setServerErrorVisible] = useState(false);
  const [invalidCitizenIdVisible, setInvalidCitizenIdVisible] = useState(false);
  const [invalidCitizenIdMessage, setInvalidCitizenIdMessage] = useState<string | undefined>();
  const [citizenIdMismatch, setCitizenIdMismatch] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const isBusy = processPhase !== 'idle';
  const imageUri = frontUri;

  const skipManual = () => {
    navigation.goBack();
  };

  const cancelProcessing = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setProcessPhase('idle');
    setScreen('source');
  };

  const fieldStatus = (key: OcrFieldKey): OcrFieldStatus => {
    if (!fields[key]?.trim()) return 'unreadable';
    if (lowConfidence.includes(key)) return 'check';
    return 'confident';
  };

  const canConfirm = (): boolean => canConfirmOcrReview(fields, source);

  /** OCR-05 register / OCR-06 editProfile / OCR-07 dependent. */
  const runExtract = async (front: string, back?: string | null) => {
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

      // dependent: sync direct-extractions (tránh poll RabbitMQ 30s timeout)
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
        Alert.alert('Hết thời gian', result.message || DEPENDENT_OCR_TIMEOUT_MESSAGE, [
          { text: 'Nhập tay', onPress: skipManual },
          { text: 'Thử lại', onPress: () => void runExtract(front, back) },
        ]);
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
  };

  const acceptFrontAndOfferBack = (uri: string) => {
    setFrontUri(uri);
    setBackUri(null);
    setScreen('backOffer');
  };

  const validateAndProcessFront = (asset: ImagePicker.ImagePickerAsset) => {
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
        Alert.alert('Định dạng không hỗ trợ', 'Chỉ hỗ trợ ảnh định dạng JPG hoặc PNG.');
        return;
      }
      if (result.reason === 'tooLarge') {
        Alert.alert('Tệp quá lớn', 'Dung lượng ảnh không được vượt quá 10 MB.');
        return;
      }
      if (result.reason === 'tooSmall') {
        Alert.alert('Ảnh quá nhỏ', 'Ảnh có độ phân giải quá thấp. Vui lòng chọn ảnh rõ hơn.');
        return;
      }
      setFrontUri(asset.uri);
      setBlurryVisible(true);
      return;
    }

    acceptFrontAndOfferBack(asset.uri);
  };

  const validateAndProcessBack = (asset: ImagePicker.ImagePickerAsset) => {
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
      Alert.alert('Ảnh mặt sau không hợp lệ', 'Vui lòng chọn JPG/PNG rõ nét hoặc bỏ qua mặt sau.');
      return;
    }

    setBackUri(asset.uri);
    if (frontUri) {
      void runExtract(frontUri, asset.uri);
    }
  };

  const pickFromLibrary = async (forBack = false) => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Cần quyền thư viện ảnh',
          'Vui lòng mở quyền thư viện trong Cài đặt, hoặc nhập tay thông tin.',
          [
            { text: 'Nhập tay', onPress: skipManual },
            { text: 'Đóng', style: 'cancel' },
          ]
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.85,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      if (forBack) validateAndProcessBack(result.assets[0]);
      else validateAndProcessFront(result.assets[0]);
    } catch {
      Alert.alert('Không thể mở thư viện', 'Vui lòng thử lại hoặc nhập tay thông tin.', [
        { text: 'Nhập tay', onPress: skipManual },
        { text: 'Đóng', style: 'cancel' },
      ]);
    }
  };

  const captureFromCamera = async (forBack = false) => {
    if (Platform.OS === 'web') {
      Alert.alert('Camera không khả dụng', WEB_CAMERA_UNAVAILABLE_MESSAGE, [
        { text: 'Chọn từ thư viện', onPress: () => void pickFromLibrary(forBack) },
        { text: 'Nhập tay', onPress: skipManual },
        { text: 'Đóng', style: 'cancel' },
      ]);
      return;
    }
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Cần quyền camera',
          'Vui lòng mở quyền camera trong Cài đặt, hoặc nhập tay thông tin.',
          [
            { text: 'Nhập tay', onPress: skipManual },
            { text: 'Đóng', style: 'cancel' },
          ]
        );
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.85,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      if (forBack) validateAndProcessBack(result.assets[0]);
      else validateAndProcessFront(result.assets[0]);
    } catch {
      Alert.alert('Không thể mở camera', 'Vui lòng thử lại, chọn thư viện, hoặc nhập tay.', [
        { text: 'Nhập tay', onPress: skipManual },
        { text: 'Đóng', style: 'cancel' },
      ]);
    }
  };

  const applyAndReturn = () => {
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
  };

  const onPressUseInfo = () => {
    if (hasExistingData) {
      setOverwriteVisible(true);
      return;
    }
    applyAndReturn();
  };

  const viewerDoc: DocumentViewerItem = {
    uri: imageUri ?? undefined,
    title: 'Ảnh căn cước công dân',
    fileName: 'cccd-preview.jpg',
    isReadable: true,
    mimeType: 'image/jpeg',
  };

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
            <Text style={styles.cancelChipText}>Hủy</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderSource = () => (
    <SafeAreaView style={styles.safe}>
      <HeaderMotif title="QUÉT CĂN CƯỚC CÔNG DÂN" onBack={skipManual} />
      <ScrollView contentContainerStyle={styles.sourceContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.lead}>
          Chụp hoặc chọn ảnh mặt trước căn cước công dân để hệ thống tự điền thông tin.
        </Text>

        <SourceOptionCard
          icon="camera-outline"
          title="Chụp ảnh bằng camera"
          subtitle="Khung căn giấy tờ, hỗ trợ đèn flash"
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

        <InfoNote text="Ảnh chỉ dùng để đọc thông tin và không được lưu lại trên hệ thống." />

        <TouchableOpacity style={styles.skipLink} onPress={skipManual}>
          <Text style={styles.skipLinkText}>Bỏ qua, tôi sẽ nhập tay</Text>
        </TouchableOpacity>
      </ScrollView>
      {renderProcessing()}
    </SafeAreaView>
  );

  const renderBackOffer = () => (
    <SafeAreaView style={styles.safe}>
      <HeaderMotif title="THÊM MẶT SAU" onBack={() => setScreen('source')} />
      <ScrollView contentContainerStyle={styles.sourceContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.lead}>
          Bạn có thể thêm ảnh mặt sau (không bắt buộc) để đọc đủ thông tin hơn.
        </Text>
        {frontUri ? <DocumentPreview uri={frontUri} onPress={() => setViewerOpen(true)} /> : null}
        <View style={{ height: theme.spacing.md }} />
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
          style={{ marginTop: theme.spacing.md }}
        />
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
            accessibilityLabel="Đóng camera"
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
          <Text style={styles.steadyHint}>Giữ máy vững, tránh bóng và lóa</Text>
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
            <Text style={styles.sideLabel}>Đèn flash</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
      {renderProcessing()}
    </View>
  );

  const renderReview = () => (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <HeaderMotif title="KIỂM TRA THÔNG TIN" onBack={() => setScreen('source')} />
      <ScrollView
        contentContainerStyle={styles.reviewContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <DocumentPreview uri={imageUri} onPress={() => setViewerOpen(true)} />
        {fields.isAvailable === false ? (
          <View style={styles.warningBanner}>
            <Ionicons name="warning-outline" size={18} color={theme.colors.warning} />
            <Text style={styles.warningBannerText}>
              {fields.warning?.trim() ||
                'Số CCCD này đã được đăng ký tài khoản. Bạn vẫn có thể dùng thông tin để điền form.'}
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
          text="Vui lòng đối chiếu với giấy tờ gốc và sửa lại nếu có sai sót."
        />

        <View style={{ height: theme.spacing.md }} />

        {OCR_FIELD_META.map((meta) => (
          <OcrField
            key={meta.key}
            label={meta.label}
            value={fields[meta.key] ?? ''}
            placeholder={meta.placeholder}
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
            placeholder="Nhập số giấy khai sinh"
            status={fields.documentNumber?.trim() ? 'confident' : 'unreadable'}
            unusedHint={false}
            onChangeText={(text) => {
              setFields((prev) => ({ ...prev, documentNumber: text }));
            }}
          />
        ) : null}
      </ScrollView>

      <View style={styles.stickyCta}>
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
          disabled={!canConfirm()}
          style={styles.ctaHalf}
        />
      </View>

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
        title="Ảnh chưa đủ rõ"
        message={
          blurryMessage?.trim() ||
          'Ảnh quá mờ hoặc thiếu sáng nên hệ thống không đọc được thông tin. Vui lòng chụp lại ở nơi đủ sáng và đặt giấy tờ phẳng.'
        }
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
        title="Không đọc được số CCCD"
        message={
          invalidCitizenIdMessage?.trim() ||
          'Không thể nhận diện số CCCD 12 số hợp lệ. Giấy khai sinh không dùng để đăng ký tài khoản. Vui lòng chụp lại CCCD hoặc nhập tay.'
        }
        secondaryLabel="Nhập tay"
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
        title="Ghi đè thông tin đã nhập"
        message="Biểu mẫu đang có dữ liệu. Thông tin từ căn cước sẽ thay thế các trường tương ứng."
        secondaryLabel="Hủy"
        primaryLabel="Ghi đè"
        destructive
        onSecondary={() => setOverwriteVisible(false)}
        onPrimary={() => {
          setOverwriteVisible(false);
          applyAndReturn();
        }}
      />

      <Dialog
        visible={serverErrorVisible}
        title="Không thể đọc thông tin"
        message="Không thể đọc thông tin từ giấy tờ lúc này. Bạn có thể thử lại hoặc nhập tay."
        secondaryLabel="Nhập tay"
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
    </>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  sourceContent: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.xl * 2,
  },
  lead: {
    ...theme.typography.bodyLarge,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.lg,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    paddingHorizontal: 28,
  },
  goldFrame: {
    width: '100%',
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
  },
  steadyHint: {
    marginTop: 16,
    color: 'rgba(255,255,255,0.7)',
    ...theme.typography.bodySmall,
  },
  cameraBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingBottom: 28,
  },
  sideBtn: {
    width: 72,
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
    zIndex: 20,
  },
  processCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 18,
    paddingHorizontal: 28,
    paddingVertical: 24,
    alignItems: 'center',
    minWidth: 260,
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
    paddingBottom: 120,
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
    paddingBottom: 16,
    backgroundColor: theme.colors.background,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  ctaHalf: {
    flex: 1,
  },
});
