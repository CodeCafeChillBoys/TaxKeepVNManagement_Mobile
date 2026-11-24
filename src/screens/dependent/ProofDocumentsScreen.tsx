import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Modal,
  Image,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { theme } from '../../constants/theme';
import { DrumHeader } from '../../components/brand/DrumHeader';
import { useToast } from '../../components/ui/Toast';
import { Dialog } from '../../components/common/Dialog';
import { CatalogErrorBanner } from '../../components/common/CatalogErrorBanner';
import { useDependentCatalog } from '../../hooks/useDependentCatalog';
import { getCachedCatalog } from '../../api/dependentCatalogStore';
import { RULES_NOT_CONFIGURED_LABEL } from '../../api/dependentDocHelpers';
import { uiTabForGroup } from './dependentGroupUtils';
import { formatPersonName } from '../../utils/formatPersonName';
import {
  dependentDocumentApi,
  DependentItem,
  DependentDocumentRuleItem,
  getDocTypeLabel,
  getFullFileUrl,
} from '../../api/dependentDocumentApi';
import { taxRuleApi, type TaxRuleSetDetailData } from '../../api/taxRuleApi';
import {
  DocumentViewerModal,
  DocumentViewerItem,
} from '../../components/common/DocumentViewerModal';
import { isImageDocumentUri } from '../../components/common/imageZoomUtils';
import { RootStackParamList, RootNavigationProp } from '../../navigation/types';
import {
  buildDocSlots,
  expandChecklistToRules,
  resolveProofDocumentsChecklist,
  RULES_NOT_CONFIGURED_CODE,
  selectRulesForTab,
  type DocSlot,
} from './proofDocumentsParams';
import {
  buildProofDocLawExplanation,
  extractYearFromEffectiveMonth,
  isSameProofDocType,
  selectActiveRuleSetForYear,
  type ProofDocLawModalData,
} from './proofDocumentLawExplanation';
import {
  areAllMandatoryStepsUploaded,
  canNavigateToProofStep,
  findInitialPendingStepIndex,
  parseDependentUploadError,
  type ParsedDependentUploadError,
} from './dependentDocumentError';

type ProofDocumentsRouteProp = RouteProp<RootStackParamList, 'ProofDocuments'>;

interface LawDocOption {
  docType: string;
  title: string;
  targetGroup?: string;
  ruleDescription?: string;
}

interface LawDocItem {
  key: string;
  code: string;
  docType: string;
  title: string;
  shortLabel: string;
  isMandatory: boolean;
  targetGroup?: string;
  ruleDescription?: string;
  /** Ô "nộp 1 trong N": các loại giấy người dùng được chọn; docType là loại đang chọn. */
  options?: LawDocOption[];
}

interface LawGroupRequirement {
  groupId: number;
  tabLabel: string;
  title: string;
  subtitle: string;
}

const ALTERNATIVE_SLOT_TITLE = 'Nộp 1 trong các giấy tờ:';
const OPTIONAL_SUFFIX = ' (không bắt buộc)';

type RuleLike = Pick<
  DependentDocumentRuleItem,
  'docType' | 'isMandatory' | 'alternativeGroup' | 'docName' | 'targetGroup' | 'description'
>;

/** Ô upload (gộp "chọn 1 trong N") → bước hiển thị trên màn. */
function slotToLawDoc(slot: DocSlot<RuleLike>, idx: number, fallbackGroup?: string): LawDocItem {
  const letter = String.fromCharCode(97 + idx);
  const options: LawDocOption[] = slot.rules.map((r) => ({
    docType: r.docType,
    title: getDocTypeLabel(r.docType, r.docName),
    targetGroup: r.targetGroup || fallbackGroup,
    ruleDescription: r.description || undefined,
  }));
  const first = options[0];
  if (options.length > 1) {
    return {
      key: slot.key,
      code: letter,
      docType: first.docType,
      title: ALTERNATIVE_SLOT_TITLE,
      shortLabel: options.map((o) => o.title).join(' / '),
      isMandatory: true,
      targetGroup: first.targetGroup,
      ruleDescription: first.ruleDescription,
      options,
    };
  }
  return {
    key: slot.key,
    code: letter,
    docType: first.docType,
    title: slot.isMandatory ? first.title : `${first.title}${OPTIONAL_SUFFIX}`,
    shortLabel: first.title,
    isMandatory: slot.isMandatory,
    targetGroup: first.targetGroup,
    ruleDescription: first.ruleDescription,
  };
}

const docMatchesSlot = (doc: LawDocItem, docType?: string | null): boolean =>
  (doc.options ? doc.options.map((o) => o.docType) : [doc.docType]).some((t) =>
    isSameProofDocType(t, docType)
  );

interface SelectedDocFile {
  name: string;
  sizeText: string;
  type: string;
  blob?: Blob | File;
  uri?: string;
  docId?: string;
  docType?: string;
  uploadedAt?: string;
  isReadable?: boolean;
  needsReupload?: boolean;
}

// Tiêu đề / mô tả 5 tab theo luật. Danh sách giấy tờ lấy từ rule DB, không viết sẵn trong app.
const LAW_GROUP_SPECS: LawGroupRequirement[] = [
  {
    groupId: 1,
    tabLabel: 'Nhóm 1',
    title: 'Nhóm 1: Con dưới 18 tuổi',
    subtitle: 'Độ tuổi tính theo ngày sinh < 18 tuổi.',
  },
  {
    groupId: 2,
    tabLabel: 'Nhóm 2',
    title: 'Nhóm 2: Con từ 18 tuổi trở lên đang đi học',
    subtitle: 'Con từ đủ 18 tuổi và đang theo học đại học, cao đẳng, trung học chuyên nghiệp, dạy nghề.',
  },
  {
    groupId: 3,
    tabLabel: 'Nhóm 3',
    title: 'Nhóm 3: Con bị khuyết tật / Mất khả năng lao động',
    subtitle: 'Con đủ 18 tuổi trở lên nhưng không có khả năng tự lao động tạo thu nhập.',
  },
  {
    groupId: 4,
    tabLabel: 'Nhóm 4',
    title: 'Nhóm 4: Vợ / Chồng hoặc Cha / Mẹ',
    subtitle: 'Bao gồm: Vợ, chồng; cha mẹ đẻ, cha mẹ vợ/chồng, cha mẹ kế, cha mẹ nuôi hợp pháp.',
  },
  {
    groupId: 5,
    tabLabel: 'Nhóm 5',
    title: 'Nhóm 5: Cá nhân khác không nơi nương tựa trực tiếp nuôi dưỡng',
    subtitle: 'Bao gồm: Anh, chị, em ruột; ông bà nội/ngoại; cô dì chú bác ruột; cháu ruột.',
  },
];

export const ProofDocumentsScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const route = useRoute<ProofDocumentsRouteProp>();
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const {
    catalog,
    error: catalogError,
    loading: catalogLoading,
    reload: reloadCatalog,
  } = useDependentCatalog();

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const [dialog, setDialog] = useState<{
    title: string;
    message: string;
    primaryLabel?: string;
    onPrimary?: () => void;
  } | null>(null);

  const initialGroupIdx =
    typeof route.params?.groupIndex === 'number' &&
    route.params.groupIndex >= 0 &&
    route.params.groupIndex < LAW_GROUP_SPECS.length
      ? route.params.groupIndex
      : 0;

  const [selectedGroupIdx, setSelectedGroupIdx] = useState<number>(initialGroupIdx);

  useEffect(() => {
    if (
      typeof route.params?.groupIndex === 'number' &&
      route.params.groupIndex >= 0 &&
      route.params.groupIndex < LAW_GROUP_SPECS.length
    ) {
      setSelectedGroupIdx(route.params.groupIndex);
    }
  }, [route.params?.groupIndex]);

  const [selectedDependent, setSelectedDependent] = useState<DependentItem | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Record<string, SelectedDocFile>>({});
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadedKeys, setUploadedKeys] = useState<Record<string, boolean>>({});
  const [skippedKeys, setSkippedKeys] = useState<Record<string, boolean>>({});
  const [stepErrors, setStepErrors] = useState<Record<string, ParsedDependentUploadError | undefined>>({});
  const [stepSuccesses, setStepSuccesses] = useState<Record<string, string | undefined>>({});
  const [lastSuccessNotice, setLastSuccessNotice] = useState<string | null>(null);
  const [serverDocs, setServerDocs] = useState<any[]>([]);
  const [serverProfileComplete, setServerProfileComplete] = useState<boolean>(false);
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(0);
  const hasAutoPositionedStepRef = useRef<boolean>(false);

  const [previewDoc, setPreviewDoc] = useState<DocumentViewerItem | null>(null);
  const [pickerModalVisible, setPickerModalVisible] = useState<boolean>(false);
  const [activePickingDoc, setActivePickingDoc] = useState<{
    key: string;
    title: string;
    docType: string;
  } | null>(null);
  const [lawModalVisible, setLawModalVisible] = useState<boolean>(false);
  const [lawModalDoc, setLawModalDoc] = useState<LawDocItem | null>(null);
  const [activeTaxRuleDetail, setActiveTaxRuleDetail] = useState<TaxRuleSetDetailData | null>(null);
  const [loadingTaxRules, setLoadingTaxRules] = useState<boolean>(false);

  const [allRules, setAllRules] = useState<DependentDocumentRuleItem[]>([]);
  const [rulesLoading, setRulesLoading] = useState<boolean>(true);
  const [dynamicDocs, setDynamicDocs] = useState<LawDocItem[] | null>(null);
  const [rulesNotConfigured, setRulesNotConfigured] = useState<boolean>(false);
  // Loại giấy người dùng chọn trong ô "nộp 1 trong N", theo key ô
  const [docChoices, setDocChoices] = useState<Record<string, string>>({});

  const currentGroupSpec = LAW_GROUP_SPECS[selectedGroupIdx];
  const docsFromDb = Boolean(dynamicDocs && dynamicDocs.length > 0);
  const activeDocs = useMemo<LawDocItem[]>(
    () =>
      (dynamicDocs || []).map((doc) => {
        const chosen = doc.options?.find((o) => o.docType === docChoices[doc.key]);
        return chosen
          ? { ...doc, docType: chosen.docType, targetGroup: chosen.targetGroup, ruleDescription: chosen.ruleDescription }
          : doc;
      }),
    [dynamicDocs, docChoices]
  );
  // Tải được rule nhưng nhóm không có rule nào = admin chưa cấu hình, không phải lỗi mạng
  const RULES_NOT_LOADED_MESSAGE =
    rulesNotConfigured || allRules.length > 0
      ? RULES_NOT_CONFIGURED_LABEL
      : 'Chưa tải được danh mục giấy tờ của nhóm này từ hệ thống. Vui lòng kiểm tra kết nối và thử lại.';

  // Đảm bảo chỉ số bước luôn nằm trong phạm vi activeDocs
  useEffect(() => {
    if (currentStepIdx >= activeDocs.length) {
      setCurrentStepIdx(Math.max(0, activeDocs.length - 1));
    }
  }, [activeDocs.length, currentStepIdx]);

  useEffect(() => {
    void loadInitialData();
    void loadRules();
    void loadActiveTaxRules();
  }, []);

  const loadRules = async () => {
    setRulesLoading(true);
    try {
      const rules = await dependentDocumentApi.getRules();
      if (isMountedRef.current && rules && rules.length > 0) {
        setAllRules(rules);
      }
    } catch (err) {
      if (__DEV__) console.warn('loadRules err:', err);
    } finally {
      if (isMountedRef.current) setRulesLoading(false);
    }
  };

  // Tải bộ Quy tắc thuế đang hiệu lực do Admin cấu hình để giải thích lý do & căn cứ pháp lý động (không hard code)
  const loadActiveTaxRules = async () => {
    try {
      setLoadingTaxRules(true);
      const preferredYear = extractYearFromEffectiveMonth(
        (route.params?.dependentData as any)?.effectiveFromMonth
      );
      const ruleSets = await taxRuleApi.getAllRuleSets();
      const chosen = selectActiveRuleSetForYear(ruleSets, preferredYear);
      if (!chosen?.ruleSetId) return;
      const detail = await taxRuleApi.getRuleSetDetail(chosen.ruleSetId);
      if (isMountedRef.current) {
        setActiveTaxRuleDetail(detail);
      }
    } catch (err) {
      if (__DEV__) console.warn('loadActiveTaxRules err:', err);
    } finally {
      if (isMountedRef.current) {
        setLoadingTaxRules(false);
      }
    }
  };

  // Cập nhật danh sách tài liệu động theo quy tắc từ Backend API
  useEffect(() => {
    const depGroupCode: string | undefined =
      (route.params?.dependentData as any)?.groupCode ??
      (route.params?.dependentData as any)?.currentGroup ??
      undefined;
    const filteredForLookup = selectRulesForTab(allRules, selectedGroupIdx, depGroupCode, catalog);

    const fromPatch = resolveProofDocumentsChecklist({
      requiredDocuments: route.params?.requiredDocuments,
      fallbackDocTypes: [],
    });
    if (fromPatch.some((d) => d.toUpperCase() === RULES_NOT_CONFIGURED_CODE)) {
      setRulesNotConfigured(true);
      setDynamicDocs(null);
      return;
    }
    setRulesNotConfigured(false);

    if (fromPatch.length > 0) {
      // Checklist từ BE: mã thuộc nhóm "chọn 1" kéo theo các giấy thay thế cùng nhóm
      const rules = expandChecklistToRules<RuleLike>(fromPatch, filteredForLookup, (docType) => {
        const matched = allRules.find((r) => isSameProofDocType(r.docType, docType));
        return {
          docType,
          isMandatory: true,
          alternativeGroup: null,
          docName: matched?.docName,
          targetGroup: matched?.targetGroup || depGroupCode || '',
          description: matched?.description,
        };
      });
      setDynamicDocs(buildDocSlots(rules).map((slot, idx) => slotToLawDoc(slot, idx, depGroupCode)));
      return;
    }

    if (allRules.length === 0) return;

    // Ô upload lấy hoàn toàn từ rule DB theo nhóm thật của NPT; rule cùng alternativeGroup gộp một ô
    if (filteredForLookup.length === 0) {
      setDynamicDocs(null);
    } else {
      setDynamicDocs(
        buildDocSlots<RuleLike>(filteredForLookup).map((slot, idx) => slotToLawDoc(slot, idx, depGroupCode))
      );
    }
  }, [allRules, catalog, selectedGroupIdx, route.params?.dependentData, route.params?.requiredDocuments]);

  // Tự động đồng bộ hóa tài liệu từ máy chủ (serverDocs) vào các bước
  useEffect(() => {
    if (!serverDocs || serverDocs.length === 0 || !dynamicDocs) return;
    const newUploadedKeys: Record<string, boolean> = {};
    const newSelectedFiles: Record<string, SelectedDocFile> = {};
    const newChoices: Record<string, string> = {};

    dynamicDocs.forEach((docSpec) => {
      // Ô "nộp 1 trong N": giấy hợp lệ của bất kỳ loại nào trong ô đều tính là đủ
      const candidates = serverDocs.filter((doc: any) => docMatchesSlot(docSpec, doc.docType));
      const matchingDoc = candidates.find((doc: any) => doc.isCurrent !== false) || candidates[0];
      if (matchingDoc) {
        if (docSpec.options) {
          const opt = docSpec.options.find((o) => isSameProofDocType(o.docType, matchingDoc.docType));
          if (opt) newChoices[docSpec.key] = opt.docType;
        }
        // Giấy nộp trước khi đổi thông tin nhân thân (isCurrent=false) không còn được tính → chưa coi là đã lưu
        const stale = matchingDoc.isCurrent === false;
        newUploadedKeys[docSpec.key] = !stale;
        newSelectedFiles[docSpec.key] = {
          needsReupload: stale,
          name: (matchingDoc.fileUrl || '').split('/').pop()?.split('?')[0] || docSpec.title,
          sizeText: 'Đã lưu trên máy chủ',
          type: matchingDoc.fileMimeType || 'image/jpeg',
          uri: getFullFileUrl(matchingDoc.fileUrl),
          docId: matchingDoc.docId,
          docType: matchingDoc.docType,
          uploadedAt: matchingDoc.uploadedAt,
          isReadable: matchingDoc.isReadable,
        };
      }
    });

    setUploadedKeys((prev) => {
      const merged = { ...prev, ...newUploadedKeys };
      if (!hasAutoPositionedStepRef.current) {
        hasAutoPositionedStepRef.current = true;
        setCurrentStepIdx(findInitialPendingStepIndex(dynamicDocs, merged));
      }
      return merged;
    });
    setSelectedFiles((prev) => ({ ...newSelectedFiles, ...prev }));
    setDocChoices((prev) => ({ ...newChoices, ...prev }));
  }, [serverDocs, dynamicDocs]);

  const loadInitialData = async () => {
    try {
      const deps = await dependentDocumentApi.getDependents();
      if (!isMountedRef.current) return;
      if (deps.length > 0) {
        const matched = deps.find(
          (d) => uiTabForGroup(getCachedCatalog(), d.currentGroup) === selectedGroupIdx
        );
        setSelectedDependent(matched || deps[0]);
      }
    } catch {
      // Fallback
    }

    const targetDepId = route.params?.dependentId || (route.params?.dependentData as any)?.id;
    if (targetDepId) {
      try {
        const detail = await dependentDocumentApi.getDependentById(targetDepId);
        if (!isMountedRef.current) return;
        if (detail?.isProfileComplete) {
          setServerProfileComplete(true);
        }
        if (detail && Array.isArray(detail.documents) && detail.documents.length > 0) {
          setServerDocs(detail.documents);
        }
      } catch (err) {
        if (__DEV__) console.warn('getDependentById in ProofDocumentsScreen error:', err);
      }
    }
  };

  const dependentId =
    route.params?.dependentId ||
    (route.params?.dependentData as any)?.id ||
    selectedDependent?.id;

  const currentDoc = activeDocs[currentStepIdx] || activeDocs[0];
  const currentFile = currentDoc ? selectedFiles[currentDoc.key] : undefined;
  const isCurrentUploaded = currentDoc ? Boolean(uploadedKeys[currentDoc.key]) : false;
  const hasPendingLocalFile = Boolean(currentFile && !currentFile.docId);
  const currentError = currentDoc ? stepErrors[currentDoc.key] : undefined;
  const currentSuccessMsg = currentDoc ? stepSuccesses[currentDoc.key] : undefined;
  const isLastStep = currentStepIdx >= activeDocs.length - 1;
  const uploadedCount = activeDocs.filter((d) => uploadedKeys[d.key]).length;
  const allMandatoryDone = areAllMandatoryStepsUploaded(
    activeDocs,
    uploadedKeys,
    serverProfileComplete
  );

  const handleOpenLawModal = (doc: LawDocItem) => {
    setLawModalDoc(doc);
    setLawModalVisible(true);
    if (!activeTaxRuleDetail && !loadingTaxRules) {
      void loadActiveTaxRules();
    }
  };

  const resolvedLawModalData: ProofDocLawModalData | null = lawModalDoc
    ? buildProofDocLawExplanation({
        docType: lawModalDoc.docType,
        docTitle: lawModalDoc.title,
        isMandatory: lawModalDoc.isMandatory,
        targetGroup:
          lawModalDoc.targetGroup ||
          (route.params?.dependentData as any)?.groupCode ||
          (route.params?.dependentData as any)?.currentGroup ||
          selectedDependent?.currentGroup,
        groupIndex: selectedGroupIdx,
        ruleDescription: lawModalDoc.ruleDescription,
        taxRuleDetail: activeTaxRuleDetail,
        catalog,
      })
    : null;

  const handleChooseDocOption = (docKey: string, docType: string) => {
    if (uploading) return;
    setDocChoices((prev) => ({ ...prev, [docKey]: docType }));
    setStepErrors((prev) => ({ ...prev, [docKey]: undefined }));
  };

  const assignPickedFile = (docKey: string, file: SelectedDocFile) => {
    setSelectedFiles((prev) => ({
      ...prev,
      [docKey]: file,
    }));
    // Xóa lỗi cũ của bước này ngay khi người dùng chọn lại ảnh mới
    setStepErrors((prev) => ({ ...prev, [docKey]: undefined }));
    setStepSuccesses((prev) => ({ ...prev, [docKey]: undefined }));
    setLastSuccessNotice(null);
  };

  const handleOpenDocPicker = (docKey: string, docTitle: string, docType: string) => {
    if (uploading) return;
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*,application/pdf';
      input.onchange = (e: any) => {
        const file = e.target?.files?.[0];
        if (file) {
          if (file.size > 10 * 1024 * 1024) {
            toast.error('Dung lượng tệp vượt quá giới hạn tối đa 10MB.', 'Tệp vượt quá 10MB');
            return;
          }
          const sizeKb = Math.round(file.size / 1024);
          const sizeText = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;
          const previewUri = typeof URL !== 'undefined' ? URL.createObjectURL(file) : undefined;
          assignPickedFile(docKey, {
            name: file.name,
            sizeText,
            type: file.type || 'application/pdf',
            blob: file,
            uri: previewUri,
          });
        }
      };
      input.click();
    } else {
      setActivePickingDoc({ key: docKey, title: docTitle, docType });
      setPickerModalVisible(true);
    }
  };

  const handleLaunchCamera = async () => {
    setPickerModalVisible(false);
    if (!activePickingDoc) return;

    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        toast.warning('Vui lòng cho phép ứng dụng truy cập máy ảnh để chụp ảnh giấy tờ minh chứng.', 'Cần cấp quyền');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const fileName =
          asset.fileName ||
          `chup_${activePickingDoc.docType.toLowerCase()}_${Date.now().toString().slice(-4)}.jpg`;
        const sizeText = asset.fileSize ? `${Math.round(asset.fileSize / 1024)} KB` : 'Ảnh chụp mới';
        assignPickedFile(activePickingDoc.key, {
          name: fileName,
          sizeText,
          type: asset.mimeType || 'image/jpeg',
          uri: asset.uri,
        });
      }
    } catch (err: any) {
      toast.error(err?.message || 'Không thể khởi động máy ảnh.', 'Lỗi chụp ảnh');
    }
  };

  const handleLaunchGallery = async () => {
    setPickerModalVisible(false);
    if (!activePickingDoc) return;

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        toast.warning('Vui lòng cho phép ứng dụng truy cập Thư viện ảnh để chọn chứng từ.', 'Cần cấp quyền');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const fileName =
          asset.fileName ||
          `anh_${activePickingDoc.docType.toLowerCase()}_${Date.now().toString().slice(-4)}.jpg`;
        const sizeText = asset.fileSize ? `${Math.round(asset.fileSize / 1024)} KB` : 'Ảnh thư viện';
        assignPickedFile(activePickingDoc.key, {
          name: fileName,
          sizeText,
          type: asset.mimeType || 'image/jpeg',
          uri: asset.uri,
        });
      }
    } catch (err: any) {
      toast.error(err?.message || 'Không thể mở thư viện ảnh.', 'Lỗi thư viện ảnh');
    }
  };

  const handleLaunchDocument = async () => {
    setPickerModalVisible(false);
    if (!activePickingDoc) return;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (asset.size && asset.size > 10 * 1024 * 1024) {
          toast.error('Dung lượng tệp vượt quá giới hạn tối đa 10MB.', 'Tệp vượt quá 10MB');
          return;
        }
        const sizeKb = asset.size ? Math.round(asset.size / 1024) : 380;
        const sizeText = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;
        assignPickedFile(activePickingDoc.key, {
          name: asset.name,
          sizeText,
          type: asset.mimeType || 'application/pdf',
          uri: asset.uri,
        });
      }
    } catch (err: any) {
      toast.error(err?.message || 'Không thể chọn tệp tài liệu.', 'Lỗi chọn tệp');
    }
  };

  // Upload ĐÚNG 1 chứng từ ở bước hiện tại — thành công mới tự nhảy sang chứng từ tiếp theo
  const handleUploadCurrentStep = async () => {
    if (!currentDoc || uploading) return;

    if (!dependentId) {
      toast.warning('Không tìm thấy thông tin hồ sơ người phụ thuộc để lưu.', 'Chưa có hồ sơ');
      return;
    }

    if (!docsFromDb) {
      toast.warning(RULES_NOT_LOADED_MESSAGE, 'Chưa có danh mục giấy tờ');
      return;
    }

    if (!currentFile) {
      handleOpenDocPicker(currentDoc.key, currentDoc.title, currentDoc.docType);
      return;
    }

    setUploading(true);
    setStepErrors((prev) => ({ ...prev, [currentDoc.key]: undefined }));
    setLastSuccessNotice(null);

    try {
      const res = await dependentDocumentApi.uploadDocument(
        dependentId,
        currentDoc.docType,
        currentFile
      );
      if (!isMountedRef.current) return;

      const updatedDocFile: SelectedDocFile = {
        ...currentFile,
        needsReupload: false,
        sizeText: 'Đã xác thực & lưu trên hệ thống',
        uri: res.fileUrl || currentFile.uri,
        docId: res.docId,
        docType: res.docType || currentDoc.docType,
        uploadedAt: res.uploadedAt || new Date().toISOString(),
        isReadable: res.isReadable,
      };

      setSelectedFiles((prev) => ({ ...prev, [currentDoc.key]: updatedDocFile }));
      setUploadedKeys((prev) => ({ ...prev, [currentDoc.key]: true }));
      setSkippedKeys((prev) => ({ ...prev, [currentDoc.key]: false }));
      setStepSuccesses((prev) => ({
        ...prev,
        [currentDoc.key]: `${currentDoc.shortLabel} đã được kiểm tra khớp hồ sơ và lưu thành công.`,
      }));
      if (res.isProfileComplete) {
        setServerProfileComplete(true);
      }

      setServerDocs((prev) => {
        const filtered = prev.filter((d) => d.docType !== (res.docType || currentDoc.docType));
        return [
          ...filtered,
          {
            docId: res.docId,
            docType: res.docType || currentDoc.docType,
            fileUrl: res.fileUrl,
            fileMimeType: res.fileMimeType || currentFile.type,
            uploadedAt: res.uploadedAt || new Date().toISOString(),
            isReadable: res.isReadable,
          },
        ];
      });

      toast.success(
        `"${currentDoc.shortLabel}" đã tải lên và xác thực thành công!`,
        'Tải chứng từ thành công'
      );

      // Nếu còn chứng từ tiếp theo -> chuyển tự động sang chứng từ kế tiếp kèm thông báo thành công của bước vừa xong
      if (currentStepIdx < activeDocs.length - 1) {
        setLastSuccessNotice(
          `Đã tải lên thành công: ${currentDoc.shortLabel}. Mời tiếp tục chứng từ tiếp theo.`
        );
        setCurrentStepIdx(currentStepIdx + 1);
      } else {
        setLastSuccessNotice(null);
      }
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      const parsed = parseDependentUploadError(err);
      setStepErrors((prev) => ({ ...prev, [currentDoc.key]: parsed }));
      toast.error(parsed.message, parsed.title);
    } finally {
      if (isMountedRef.current) {
        setUploading(false);
      }
    }
  };

  const handleCompleteFlow = () => {
    if (!dependentId) {
      navigation.reset({ index: 1, routes: [{ name: 'Home' }, { name: 'DependentList' }] });
      return;
    }

    const saved = route.params?.dependentData;
    if (saved?.fullName && saved.relationship && saved.effectiveFromMonth) {
      navigation.reset({
        index: 1,
        routes: [
          { name: 'Home' },
          {
            name: 'DependentSaved',
            params: {
              dependentId,
              fullName: saved.fullName,
              relationship: saved.relationship,
              groupCode: saved.groupCode,
              groupId: saved.groupId,
              effectiveFromMonth: saved.effectiveFromMonth,
            },
          },
        ],
      });
      return;
    }

    setDialog({
      title: 'Lưu hồ sơ thành công',
      message: allMandatoryDone
        ? 'Hồ sơ minh chứng người phụ thuộc đã được cập nhật và đủ điều kiện giảm trừ gia cảnh.'
        : 'Các giấy tờ minh chứng đã tải lên đã được lưu vào hồ sơ người phụ thuộc.',
      primaryLabel: 'Xem chi tiết hồ sơ',
      onPrimary: () => {
        setDialog(null);
        navigation.reset({
          index: 2,
          routes: [
            { name: 'Home' },
            { name: 'DependentList' },
            { name: 'DependentDetail', params: { dependentId } },
          ],
        });
      },
    });
  };

  const handleSelectStepPill = (targetIdx: number) => {
    if (uploading || targetIdx === currentStepIdx) return;
    if (!canNavigateToProofStep(targetIdx, activeDocs, uploadedKeys, skippedKeys)) {
      toast.warning(
        'Vui lòng tải lên thành công chứng từ bắt buộc ở bước hiện tại trước khi chuyển sang chứng từ tiếp theo.',
        'Chưa hoàn tất bước hiện tại'
      );
      return;
    }
    setLastSuccessNotice(null);
    setCurrentStepIdx(targetIdx);
  };

  const handleSkipOptionalStep = () => {
    if (!currentDoc || currentDoc.isMandatory || uploading) return;
    setSkippedKeys((prev) => ({ ...prev, [currentDoc.key]: true }));
    setLastSuccessNotice(null);
    if (!isLastStep) {
      setCurrentStepIdx(currentStepIdx + 1);
    } else if (allMandatoryDone) {
      handleCompleteFlow();
    } else {
      const firstPending = findInitialPendingStepIndex(activeDocs, uploadedKeys);
      setCurrentStepIdx(firstPending);
      toast.warning(
        'Vẫn còn chứng từ bắt buộc chưa tải lên. Vui lòng hoàn tất chứng từ bắt buộc.',
        'Còn chứng từ bắt buộc'
      );
    }
  };

  const handleNextStepAfterUploaded = () => {
    setLastSuccessNotice(null);
    if (!isLastStep) {
      setCurrentStepIdx(currentStepIdx + 1);
    } else {
      handleCompleteFlow();
    }
  };

  const isCurrentFileImage = currentFile?.uri
    ? isImageDocumentUri(currentFile.uri, currentFile.type, currentFile.name)
    : false;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <DrumHeader
        title="Ảnh minh chứng"
        onBack={() => {
          if (navigation.canGoBack()) navigation.goBack();
          else navigation.navigate('Home');
        }}
        backTestID="proofBackBtn"
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 20) + 28 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner thông tin NPT */}
        {route.params?.dependentData ? (
          <View style={styles.applicantBadge} testID="dependentInfoBanner">
            <Ionicons name="person-circle" size={22} color={theme.colors.primary} />
            <Text style={styles.applicantText} numberOfLines={1}>
              Hồ sơ:{' '}
              <Text style={styles.applicantName}>
                {formatPersonName(route.params.dependentData.fullName)}
              </Text>{' '}
              {route.params.dependentData.citizenId
                ? `(CCCD: ${route.params.dependentData.citizenId})`
                : route.params.dependentData.birthCertNumber
                ? `(Số GKS: ${route.params.dependentData.birthCertNumber})`
                : ''}
            </Text>
          </View>
        ) : null}

        {catalogError ? (
          <CatalogErrorBanner
            message={catalogError}
            loading={catalogLoading}
            onRetry={() => void reloadCatalog()}
          />
        ) : null}

        {/* Tiêu đề nhóm điều kiện */}
        <View style={styles.titleSection}>
          <Text style={styles.groupTitleText}>{currentGroupSpec.title}</Text>
          <Text style={styles.groupSubtitleText}>{currentGroupSpec.subtitle}</Text>
        </View>

        {/* Thanh tiến trình tải từng chứng từ */}
        <View style={styles.stepperCard}>
          <View style={styles.stepperHeaderRow}>
            <Text style={styles.stepperStepCount}>
              Chứng từ {currentStepIdx + 1} / {activeDocs.length}
            </Text>
            <View
              style={[
                styles.progressCountBadge,
                allMandatoryDone && styles.progressCountBadgeDone,
              ]}
            >
              <Ionicons
                name={allMandatoryDone ? 'checkmark-circle' : 'cloud-upload-outline'}
                size={13}
                color={allMandatoryDone ? '#2E7D32' : theme.colors.primary}
              />
              <Text
                style={[
                  styles.progressCountText,
                  allMandatoryDone && styles.progressCountTextDone,
                ]}
              >
                {allMandatoryDone
                  ? `Đủ hồ sơ (${uploadedCount}/${activeDocs.length})`
                  : `Đã tải ${uploadedCount}/${activeDocs.length}`}
              </Text>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.stepPillsRow}
          >
            {activeDocs.map((doc, idx) => {
              const isActive = idx === currentStepIdx;
              const isDone = Boolean(uploadedKeys[doc.key]);
              const isSkipped = Boolean(skippedKeys[doc.key]) && !isDone;
              const unlocked = canNavigateToProofStep(idx, activeDocs, uploadedKeys, skippedKeys);

              return (
                <TouchableOpacity
                  key={doc.key}
                  style={[
                    styles.stepPill,
                    isDone && styles.stepPillDone,
                    isActive && styles.stepPillActive,
                    !unlocked && !isActive && styles.stepPillLocked,
                  ]}
                  onPress={() => handleSelectStepPill(idx)}
                  activeOpacity={0.8}
                  testID={`proofStepPill_${idx}`}
                >
                  {isDone ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={14}
                      color={isActive ? '#FFFFFF' : '#2E7D32'}
                    />
                  ) : (
                    <Text
                      style={[
                        styles.stepPillNum,
                        isActive && styles.stepPillNumActive,
                      ]}
                    >
                      {idx + 1}.
                    </Text>
                  )}
                  <Text
                    style={[
                      styles.stepPillText,
                      isDone && styles.stepPillTextDone,
                      isActive && styles.stepPillTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {doc.shortLabel}
                    {isSkipped ? ' (Bỏ qua)' : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Thông báo vừa tải thành công chứng từ trước đó */}
        {lastSuccessNotice ? (
          <View style={styles.prevSuccessBanner} testID="proofPrevStepSuccessBanner">
            <Ionicons name="checkmark-circle" size={18} color="#2E7D32" />
            <Text style={styles.prevSuccessText}>{lastSuccessNotice}</Text>
          </View>
        ) : null}

        {/* CHỈ HIỂN THỊ 1 CHỨNG TỪ TẠI MỖI BƯỚC */}
        {currentDoc ? (
          <View style={styles.singleDocCard} testID={`docUploadBox_${currentDoc.key}`}>
            {/* Header chứng từ hiện tại */}
            <View style={styles.docHeaderRow}>
              <View style={styles.docTitleCol}>
                <View style={styles.docMetaBadges}>
                  <View style={styles.stepTag}>
                    <Text style={styles.stepTagText}>Bước {currentStepIdx + 1}</Text>
                  </View>
                  <View
                    style={[
                      styles.mandatoryBadge,
                      currentDoc.isMandatory
                        ? styles.mandatoryBadgeRequired
                        : styles.mandatoryBadgeOptional,
                    ]}
                  >
                    <Text
                      style={[
                        styles.mandatoryBadgeText,
                        currentDoc.isMandatory
                          ? styles.mandatoryBadgeTextRequired
                          : styles.mandatoryBadgeTextOptional,
                      ]}
                    >
                      {currentDoc.isMandatory ? 'Bắt buộc' : 'Không bắt buộc'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.docFieldLabel}>{currentDoc.title}</Text>
                {currentDoc.options ? (
                  <View style={styles.docOptionList} testID={`docOptions_${currentDoc.key}`}>
                    {currentDoc.options.map((opt) => (
                      <Text key={opt.docType} style={styles.docOptionListItem}>
                        • {opt.title}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </View>

              <TouchableOpacity
                style={styles.exclamationIconBtn}
                onPress={() => handleOpenLawModal(currentDoc)}
                accessibilityRole="button"
                accessibilityLabel={`Xem lý do và quy định pháp luật cho ${currentDoc.title}`}
                testID={`btnLawExclamation_${currentDoc.key}`}
              >
                <Ionicons name="alert-circle-outline" size={22} color="#007AFF" />
              </TouchableOpacity>
            </View>

            {/* Ô "nộp 1 trong N": chọn loại giấy trước khi chụp / chọn ảnh, upload gửi đúng loại đã chọn */}
            {currentDoc.options ? (
              <View style={styles.docChoiceWrap}>
                <Text style={styles.docChoiceLabel}>Chọn loại giấy tờ bạn nộp:</Text>
                <View style={styles.docChoiceRow}>
                  {currentDoc.options.map((opt) => {
                    const selected = opt.docType === currentDoc.docType;
                    return (
                      <TouchableOpacity
                        key={opt.docType}
                        style={[styles.docChoiceChip, selected && styles.docChoiceChipSelected]}
                        onPress={() => handleChooseDocOption(currentDoc.key, opt.docType)}
                        disabled={uploading}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        testID={`docChoice_${opt.docType}`}
                      >
                        <Ionicons
                          name={selected ? 'radio-button-on' : 'radio-button-off'}
                          size={16}
                          color={selected ? theme.colors.primary : '#8E8E93'}
                        />
                        <Text
                          style={[styles.docChoiceChipText, selected && styles.docChoiceChipTextSelected]}
                          numberOfLines={2}
                        >
                          {opt.title}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {/* Banner lỗi cụ thể từ BE cho chứng từ này */}
            {currentError ? (
              <View style={styles.stepErrorBanner} testID="proofStepErrorBanner">
                <Ionicons name="alert-circle" size={20} color="#B91C1C" style={styles.bannerIcon} />
                <View style={styles.bannerTextCol}>
                  <Text style={styles.stepErrorTitle}>{currentError.title}</Text>
                  <Text style={styles.stepErrorMessage}>{currentError.message}</Text>
                  <Text style={styles.stepErrorHint}>Gợi ý: {currentError.hint}</Text>
                </View>
              </View>
            ) : null}

            {/* Banner thành công cho chứng từ này */}
            {!currentError && isCurrentUploaded && !hasPendingLocalFile ? (
              <View style={styles.stepSuccessBanner} testID="proofStepSuccessBanner">
                <Ionicons name="checkmark-circle" size={20} color="#2E7D32" style={styles.bannerIcon} />
                <View style={styles.bannerTextCol}>
                  <Text style={styles.stepSuccessTitle}>Đã tải lên & xác thực thành công</Text>
                  <Text style={styles.stepSuccessMessage}>
                    {currentSuccessMsg ||
                      'Giấy tờ này đã được hệ thống AI đối chiếu hợp lệ và lưu vào hồ sơ.'}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Khung chụp / chọn & xem trước ảnh */}
            <View
              style={[
                styles.uploadBox,
                currentFile && styles.uploadBoxSelected,
                isCurrentUploaded && !hasPendingLocalFile && styles.uploadBoxUploaded,
                currentError && styles.uploadBoxError,
              ]}
            >
              {currentFile ? (
                <View style={styles.selectedFileContent}>
                  {currentFile.uri && isCurrentFileImage ? (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => {
                        setPreviewDoc({
                          uri: currentFile.uri,
                          title: currentDoc.title,
                          docType: currentDoc.docType,
                          fileName: currentFile.name,
                          uploadedAt: currentFile.uploadedAt,
                          isReadable: currentFile.isReadable,
                          mimeType: currentFile.type,
                        });
                      }}
                      style={styles.previewImageTouchable}
                      accessibilityRole="button"
                      accessibilityLabel="Phóng to xem ảnh minh chứng"
                    >
                      <Image
                        source={{ uri: currentFile.uri }}
                        style={styles.thumbnailPreview}
                        resizeMode="contain"
                      />
                      <View style={styles.zoomPromptBadge}>
                        <Ionicons name="search-outline" size={12} color="#FFFFFF" style={styles.mr4} />
                        <Text style={styles.zoomPromptText}>Phóng to</Text>
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => {
                        setPreviewDoc({
                          uri: currentFile.uri,
                          title: currentDoc.title,
                          docType: currentDoc.docType,
                          fileName: currentFile.name,
                          uploadedAt: currentFile.uploadedAt,
                          isReadable: currentFile.isReadable,
                          mimeType: currentFile.type,
                        });
                      }}
                      style={styles.fileIconBadge}
                      accessibilityRole="button"
                      accessibilityLabel="Xem chi tiết tệp"
                    >
                      <Ionicons
                        name={isCurrentUploaded && !hasPendingLocalFile ? 'checkmark-circle' : 'document-text'}
                        size={44}
                        color={
                          isCurrentUploaded && !hasPendingLocalFile
                            ? theme.colors.success
                            : theme.colors.primary
                        }
                      />
                      <Text style={styles.viewPdfNotice}>Chạm để xem thông tin tệp</Text>
                    </TouchableOpacity>
                  )}

                  <Text style={styles.selectedFileName} numberOfLines={1}>
                    {currentFile.name}
                  </Text>
                  <Text style={styles.selectedFileSize}>
                    {isCurrentUploaded && !hasPendingLocalFile
                      ? '✓ Đã xác thực & lưu trên máy chủ'
                      : `Chưa tải lên • ${currentFile.sizeText}`}
                  </Text>

                  <View style={styles.docActionButtonsRow}>
                    <TouchableOpacity
                      style={styles.previewDocBtn}
                      onPress={() => {
                        setPreviewDoc({
                          uri: currentFile.uri,
                          title: currentDoc.title,
                          docType: currentDoc.docType,
                          fileName: currentFile.name,
                          uploadedAt: currentFile.uploadedAt,
                          isReadable: currentFile.isReadable,
                          mimeType: currentFile.type,
                        });
                      }}
                      disabled={uploading}
                    >
                      <Ionicons name="eye-outline" size={16} color={theme.colors.primary} style={styles.mr4} />
                      <Text style={styles.previewDocBtnText}>Xem ảnh lớn</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.repickActionBtn}
                      onPress={() =>
                        handleOpenDocPicker(currentDoc.key, currentDoc.title, currentDoc.docType)
                      }
                      disabled={uploading}
                    >
                      <Ionicons name="camera-reverse-outline" size={16} color="#555555" style={styles.mr4} />
                      <Text style={styles.repickActionBtnText}>Chọn ảnh khác</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.emptyUploadContent}
                  activeOpacity={0.75}
                  disabled={uploading}
                  onPress={() =>
                    handleOpenDocPicker(currentDoc.key, currentDoc.title, currentDoc.docType)
                  }
                >
                  <View style={styles.uploadIconContainer}>
                    <Ionicons name="cloud-upload-outline" size={38} color="#8B1E1E" />
                  </View>
                  <Text style={styles.emptyUploadTitle}>Chụp ảnh hoặc chọn tệp minh chứng</Text>
                  <Text style={styles.emptyUploadHint}>
                    Hỗ trợ JPG, PNG, PDF (tối đa 10MB). Hệ thống AI sẽ đối chiếu ngay sau khi tải lên.
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Nút hành động chính của bước hiện tại */}
            <View style={styles.stepActionsWrap}>
              {hasPendingLocalFile ? (
                <TouchableOpacity
                  style={[styles.primaryStepBtn, uploading && styles.btnDisabled]}
                  onPress={() => void handleUploadCurrentStep()}
                  disabled={uploading}
                  activeOpacity={0.85}
                  testID="uploadCurrentDocBtn"
                >
                  {uploading ? (
                    <>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text style={styles.primaryStepBtnText}>Đang tải lên & AI kiểm tra...</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="cloud-upload-outline" size={20} color="#FFFFFF" />
                      <Text style={styles.primaryStepBtnText}>
                        {currentError ? 'Thử tải lên & xác thực lại' : 'Tải lên & Xác thực chứng từ'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : isCurrentUploaded ? (
                <TouchableOpacity
                  style={styles.primaryStepBtn}
                  onPress={handleNextStepAfterUploaded}
                  activeOpacity={0.85}
                  testID={isLastStep ? 'saveAndContinueBtn' : 'nextDocStepBtn'}
                >
                  <Ionicons
                    name={isLastStep ? 'checkmark-circle-outline' : 'arrow-forward-circle-outline'}
                    size={20}
                    color="#FFFFFF"
                  />
                  <Text style={styles.primaryStepBtnText}>
                    {isLastStep ? 'Hoàn tất hồ sơ minh chứng' : 'Tiếp tục chứng từ tiếp theo'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.primaryStepBtn}
                  onPress={() =>
                    handleOpenDocPicker(currentDoc.key, currentDoc.title, currentDoc.docType)
                  }
                  activeOpacity={0.85}
                  testID="pickCurrentDocBtn"
                >
                  <Ionicons name="camera-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.primaryStepBtnText}>Chọn / Chụp ảnh chứng từ này</Text>
                </TouchableOpacity>
              )}

              {/* Nút bỏ qua cho chứng từ Tùy chọn */}
              {!currentDoc.isMandatory && !isCurrentUploaded && !uploading ? (
                <TouchableOpacity
                  style={styles.secondaryStepBtn}
                  onPress={handleSkipOptionalStep}
                  activeOpacity={0.8}
                  testID="skipOptionalDocBtn"
                >
                  <Text style={styles.secondaryStepBtnText}>
                    {isLastStep && allMandatoryDone
                      ? 'Bỏ qua & Hoàn tất hồ sơ'
                      : 'Bỏ qua chứng từ tùy chọn này'}
                  </Text>
                </TouchableOpacity>
              ) : null}

              {/* Nút hoàn tất sớm nếu đã đủ chứng từ bắt buộc trên BE */}
              {allMandatoryDone && !isLastStep && !uploading && !hasPendingLocalFile ? (
                <TouchableOpacity
                  style={styles.finishEarlyBtn}
                  onPress={handleCompleteFlow}
                  activeOpacity={0.8}
                  testID="saveAndContinueBtn"
                >
                  <Ionicons name="checkmark-done-outline" size={17} color="#2E7D32" />
                  <Text style={styles.finishEarlyText}>
                    Đã đủ giấy tờ bắt buộc — Hoàn tất hồ sơ ngay
                  </Text>
                </TouchableOpacity>
              ) : null}

              {/* Nút quay lại chứng từ trước */}
              {currentStepIdx > 0 && !uploading ? (
                <TouchableOpacity
                  style={styles.prevStepBtn}
                  onPress={() => {
                    setLastSuccessNotice(null);
                    setCurrentStepIdx(currentStepIdx - 1);
                  }}
                  activeOpacity={0.75}
                  testID="prevDocStepBtn"
                >
                  <Ionicons name="arrow-back-outline" size={16} color="#555555" />
                  <Text style={styles.prevStepText}>Quay lại chứng từ trước</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ) : (rulesLoading || (!catalog && catalogLoading)) && !rulesNotConfigured ? (
          <View style={styles.rulesEmptyCard}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={styles.rulesEmptyText}>Đang tải danh mục giấy tờ...</Text>
          </View>
        ) : (
          <View style={styles.rulesEmptyCard} testID="proofRulesEmpty">
            <Ionicons name="alert-circle-outline" size={28} color="#B91C1C" />
            <Text style={styles.rulesEmptyText}>{RULES_NOT_LOADED_MESSAGE}</Text>
            {!rulesNotConfigured && allRules.length === 0 ? (
              <TouchableOpacity
                style={styles.rulesRetryBtn}
                onPress={() => void loadRules()}
                testID="proofRulesRetryBtn"
              >
                <Text style={styles.rulesRetryText}>Thử lại</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
      </ScrollView>

      {/* Modal Bottom Sheet chọn nguồn ảnh thật từ máy */}
      <Modal
        visible={pickerModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setPickerModalVisible(false)}
        >
          <View style={styles.sheetContent}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Chọn nguồn ảnh minh chứng</Text>
            <Text style={styles.sheetSubtitle} numberOfLines={2}>
              {activePickingDoc?.title}
            </Text>

            <TouchableOpacity style={styles.sheetOption} onPress={() => void handleLaunchCamera()}>
              <View style={[styles.sheetIconBox, { backgroundColor: '#E8F5E9' }]}>
                <Ionicons name="camera" size={22} color="#2E7D32" />
              </View>
              <View style={styles.flex}>
                <Text style={styles.sheetOptionTitle}>Chụp ảnh từ Camera</Text>
                <Text style={styles.sheetOptionDesc}>Mở camera chụp trực tiếp giấy tờ</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#8E8E93" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.sheetOption} onPress={() => void handleLaunchGallery()}>
              <View style={[styles.sheetIconBox, { backgroundColor: '#E3F2FD' }]}>
                <Ionicons name="images" size={22} color="#1565C0" />
              </View>
              <View style={styles.flex}>
                <Text style={styles.sheetOptionTitle}>Chọn từ Thư viện ảnh</Text>
                <Text style={styles.sheetOptionDesc}>Chọn ảnh chụp có sẵn trong máy</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#8E8E93" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.sheetOption} onPress={() => void handleLaunchDocument()}>
              <View style={[styles.sheetIconBox, { backgroundColor: '#FFF3E0' }]}>
                <Ionicons name="document-text" size={22} color="#E65100" />
              </View>
              <View style={styles.flex}>
                <Text style={styles.sheetOptionTitle}>Chọn tệp tài liệu (PDF)</Text>
                <Text style={styles.sheetOptionDesc}>Tải lên tệp PDF hoặc bản scan</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#8E8E93" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetCancelBtn}
              onPress={() => setPickerModalVisible(false)}
            >
              <Text style={styles.sheetCancelText}>Hủy bỏ</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal hiển thị lý do cần nộp chứng từ & căn cứ Quy tắc thuế động từ Admin */}
      <Modal
        visible={lawModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLawModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.lawModalOverlay}
          activeOpacity={1}
          onPress={() => setLawModalVisible(false)}
        >
          <View style={styles.lawModalCard} onStartShouldSetResponder={() => true}>
            <View style={styles.lawModalHeader}>
              <View style={styles.lawModalIconCircle}>
                <Ionicons name="alert-circle" size={24} color="#007AFF" />
              </View>
              <View style={styles.lawModalTitleWrap}>
                <Text style={styles.lawModalTitle} numberOfLines={2}>
                  {resolvedLawModalData?.title || 'Quy định chứng từ minh chứng'}
                </Text>
                {resolvedLawModalData ? (
                  <Text style={styles.lawModalStatusSub}>
                    {resolvedLawModalData.isMandatory ? 'Chứng từ bắt buộc' : 'Chứng từ tùy chọn'}
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity
                onPress={() => setLawModalVisible(false)}
                style={styles.lawModalCloseBtn}
                accessibilityRole="button"
                accessibilityLabel="Đóng"
              >
                <Ionicons name="close" size={22} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            <View style={styles.lawModalDivider} />

            <ScrollView style={styles.lawModalBody} showsVerticalScrollIndicator={false}>
              {loadingTaxRules && !resolvedLawModalData?.hasDynamicData ? (
                <View style={styles.lawLoadingBox}>
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                  <Text style={styles.lawLoadingText}>
                    Đang tải quy tắc thuế hiện hành từ hệ thống...
                  </Text>
                </View>
              ) : resolvedLawModalData?.hasDynamicData ? (
                <>
                  {resolvedLawModalData.reasonText ? (
                    <View style={styles.lawSectionBox}>
                      <Text style={styles.lawSectionLabel}>Lý do cần nộp chứng từ</Text>
                      {resolvedLawModalData.reasonText.split('\n').map((line, idx) => (
                        <Text key={idx} style={styles.lawReasonText}>
                          {line.trim()}
                        </Text>
                      ))}
                    </View>
                  ) : null}

                  {resolvedLawModalData.groupConditions.length > 0 ? (
                    <View style={styles.lawSectionBlock}>
                      <Text style={styles.lawSectionLabel}>
                        {resolvedLawModalData.dependentGroupName
                          ? `Điều kiện nhóm: ${resolvedLawModalData.dependentGroupName}`
                          : 'Điều kiện áp dụng theo Quy tắc thuế'}
                      </Text>
                      {resolvedLawModalData.groupConditions.map((cond, idx) => (
                        <View key={idx} style={styles.lawBulletRow}>
                          <Text style={styles.lawBulletDot}>•</Text>
                          <Text style={styles.lawBulletText}>{cond}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {resolvedLawModalData.ruleSetLabel ||
                  resolvedLawModalData.legalBasis ||
                  resolvedLawModalData.deductionAmountLabel ? (
                    <View style={styles.lawLegalFooterBox}>
                      <Text style={styles.lawSectionLabel}>Căn cứ Quy tắc thuế đang áp dụng</Text>
                      {resolvedLawModalData.ruleSetLabel ? (
                        <Text style={styles.lawMetaText}>{resolvedLawModalData.ruleSetLabel}</Text>
                      ) : null}
                      {resolvedLawModalData.effectiveRangeLabel ? (
                        <Text style={styles.lawMetaSubText}>
                          {resolvedLawModalData.effectiveRangeLabel}
                        </Text>
                      ) : null}
                      {resolvedLawModalData.legalBasis ? (
                        <Text style={styles.lawMetaText}>
                          Văn bản: {resolvedLawModalData.legalBasis}
                        </Text>
                      ) : null}
                      {resolvedLawModalData.deductionAmountLabel ? (
                        <Text style={styles.lawMetaHighlight}>
                          Mức giảm trừ NPT: {resolvedLawModalData.deductionAmountLabel}
                        </Text>
                      ) : null}
                      {resolvedLawModalData.sourceUrl ? (
                        <TouchableOpacity
                          style={styles.lawSourceLinkBtn}
                          onPress={() => {
                            if (resolvedLawModalData.sourceUrl) {
                              void Linking.openURL(resolvedLawModalData.sourceUrl);
                            }
                          }}
                          activeOpacity={0.75}
                        >
                          <Ionicons name="open-outline" size={14} color="#007AFF" />
                          <Text style={styles.lawSourceLinkText}>Xem văn bản pháp luật gốc</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ) : null}
                </>
              ) : (
                <Text style={styles.lawEmptyText}>
                  Chưa có mô tả chi tiết cho chứng từ này trong bộ Quy tắc thuế đang áp dụng của hệ thống.
                </Text>
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.lawModalConfirmBtn}
              onPress={() => setLawModalVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.lawModalConfirmBtnText}>Đã hiểu</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal Xem ảnh / tài liệu minh chứng phóng to / thu nhỏ */}
      <DocumentViewerModal
        visible={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        document={previewDoc}
        onRePick={() => {
          if (currentDoc) {
            handleOpenDocPicker(currentDoc.key, currentDoc.title, currentDoc.docType);
          }
        }}
      />

      <Dialog
        visible={Boolean(dialog)}
        title={dialog?.title || ''}
        message={dialog?.message || ''}
        primaryLabel={dialog?.primaryLabel || 'Đóng'}
        onPrimary={dialog?.onPrimary || (() => setDialog(null))}
        onRequestClose={() => setDialog(null)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  mr4: { marginRight: 4 },
  docOptionList: {
    marginTop: 4,
  },
  docOptionListItem: {
    fontSize: 13,
    color: '#333333',
    lineHeight: 19,
  },
  docChoiceWrap: {
    marginBottom: 12,
  },
  docChoiceLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  docChoiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  docChoiceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#FFFFFF',
  },
  docChoiceChipSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: '#FBF5EE',
  },
  docChoiceChipText: {
    flexShrink: 1,
    fontSize: 13,
    color: '#333333',
  },
  docChoiceChipTextSelected: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  rulesEmptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 20,
    alignItems: 'center',
    gap: 10,
  },
  rulesEmptyText: {
    fontSize: 14,
    color: '#333333',
    textAlign: 'center',
    lineHeight: 20,
  },
  rulesRetryBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  rulesRetryText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  applicantBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FBF5EE',
    borderWidth: 1,
    borderColor: '#E7DCB9',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
    gap: 8,
  },
  applicantText: {
    flex: 1,
    fontSize: 13,
    color: '#333333',
  },
  applicantName: {
    fontWeight: '700',
  },
  titleSection: {
    marginBottom: 14,
  },
  groupTitleText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  groupSubtitleText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#B91C1C',
    lineHeight: 18,
  },
  stepperCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
    marginBottom: 14,
  },
  stepperHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  stepperStepCount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  progressCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FDF2F2',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  progressCountBadgeDone: {
    backgroundColor: '#E8F5E9',
  },
  progressCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  progressCountTextDone: {
    color: '#2E7D32',
  },
  stepPillsRow: {
    gap: 8,
    paddingVertical: 2,
  },
  stepPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#F3EFE6',
    borderWidth: 1,
    borderColor: '#E2DACB',
    maxWidth: 190,
  },
  stepPillDone: {
    backgroundColor: '#E8F5E9',
    borderColor: '#A5D6A7',
  },
  stepPillActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  stepPillLocked: {
    opacity: 0.48,
  },
  stepPillNum: {
    fontSize: 12,
    fontWeight: '700',
    color: '#555555',
  },
  stepPillNumActive: {
    color: '#FFFFFF',
  },
  stepPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333333',
    flexShrink: 1,
  },
  stepPillTextDone: {
    color: '#2E7D32',
  },
  stepPillTextActive: {
    color: '#FFFFFF',
  },
  prevSuccessBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#A5D6A7',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  prevSuccessText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#1B5E20',
    lineHeight: 18,
  },
  singleDocCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
  },
  docHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 12,
  },
  docTitleCol: {
    flex: 1,
  },
  docMetaBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  stepTag: {
    backgroundColor: '#F3EFE6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  stepTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5A4A22',
  },
  mandatoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  mandatoryBadgeRequired: {
    backgroundColor: '#FEE2E2',
  },
  mandatoryBadgeOptional: {
    backgroundColor: '#E0F2FE',
  },
  mandatoryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  mandatoryBadgeTextRequired: {
    color: '#B91C1C',
  },
  mandatoryBadgeTextOptional: {
    color: '#0369A1',
  },
  docFieldLabel: {
    fontSize: 15.5,
    fontWeight: '700',
    color: '#1A1A1A',
    lineHeight: 22,
  },
  exclamationIconBtn: {
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerIcon: {
    marginTop: 1,
  },
  bannerTextCol: {
    flex: 1,
  },
  stepErrorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  stepErrorTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 3,
  },
  stepErrorMessage: {
    fontSize: 13,
    color: '#7F1D1D',
    lineHeight: 19,
  },
  stepErrorHint: {
    fontSize: 12,
    color: '#B91C1C',
    marginTop: 5,
    fontWeight: '600',
    lineHeight: 17,
  },
  stepSuccessBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  stepSuccessTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#166534',
    marginBottom: 2,
  },
  stepSuccessMessage: {
    fontSize: 12.5,
    color: '#15803D',
    lineHeight: 18,
  },
  uploadBox: {
    minHeight: 200,
    backgroundColor: '#FAF8F5',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#D4D4D8',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 14,
  },
  uploadBoxSelected: {
    borderStyle: 'solid',
    borderColor: theme.colors.primary,
    backgroundColor: '#FDF8F8',
  },
  uploadBoxUploaded: {
    borderStyle: 'solid',
    borderColor: theme.colors.success,
    backgroundColor: '#F2FBF5',
  },
  uploadBoxError: {
    borderStyle: 'solid',
    borderColor: '#DC2626',
    backgroundColor: '#FFF5F5',
  },
  emptyUploadContent: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  uploadIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FCECEC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyUploadTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 4,
  },
  emptyUploadHint: {
    fontSize: 12.5,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 320,
  },
  selectedFileContent: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImageTouchable: {
    width: '100%',
    height: 210,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0F172A',
    marginBottom: 10,
  },
  thumbnailPreview: {
    width: '100%',
    height: '100%',
  },
  zoomPromptBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
  },
  zoomPromptText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  fileIconBadge: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  viewPdfNotice: {
    fontSize: 12,
    color: theme.colors.primary,
    marginTop: 6,
    fontWeight: '600',
  },
  selectedFileName: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 2,
  },
  selectedFileSize: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 10,
    textAlign: 'center',
  },
  reuploadText: {
    color: theme.colors.warning,
    textAlign: 'center',
    fontWeight: '600',
  },
  docActionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  previewDocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF0E8',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E8D8CA',
  },
  previewDocBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  repickActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F2',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  repickActionBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#444444',
  },
  stepActionsWrap: {
    marginTop: 16,
    gap: 10,
  },
  primaryStepBtn: {
    minHeight: 50,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    ...theme.shadows.button,
  },
  btnDisabled: {
    opacity: 0.72,
  },
  primaryStepBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryStepBtn: {
    minHeight: 46,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: '#D6CFC2',
    backgroundColor: '#FAF8F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryStepBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#444444',
  },
  finishEarlyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#A5D6A7',
  },
  finishEarlyText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#2E7D32',
  },
  prevStepBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  prevStepText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#555555',
  },
  // Modal luật
  lawModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  lawModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#F5F5F7',
    borderRadius: 18,
    padding: 20,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.2)' }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 10,
          elevation: 6,
        }),
  },
  lawModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lawModalIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lawModalTitleWrap: {
    flex: 1,
  },
  lawModalTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  lawModalStatusSub: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  lawModalCloseBtn: {
    padding: 4,
  },
  lawModalDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 12,
  },
  lawModalBody: {
    maxHeight: 320,
    marginBottom: 16,
  },
  lawLoadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  lawLoadingText: {
    flex: 1,
    fontSize: 13,
    color: '#475569',
  },
  lawSectionBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 12,
  },
  lawSectionBlock: {
    marginBottom: 12,
  },
  lawLegalFooterBox: {
    backgroundColor: '#FAF5EC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6D5B8',
    padding: 12,
    marginBottom: 4,
  },
  lawSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8B1E1E',
    marginBottom: 6,
  },
  lawReasonText: {
    fontSize: 13.5,
    color: '#1E293B',
    lineHeight: 20,
  },
  lawBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  lawBulletDot: {
    fontSize: 13,
    color: '#8B1E1E',
    fontWeight: '700',
    marginRight: 6,
    lineHeight: 19,
  },
  lawBulletText: {
    flex: 1,
    fontSize: 13,
    color: '#2C3E50',
    lineHeight: 19,
  },
  lawMetaText: {
    fontSize: 12.5,
    color: '#334155',
    lineHeight: 18,
    marginBottom: 3,
  },
  lawMetaSubText: {
    fontSize: 11.5,
    color: '#64748B',
    marginBottom: 4,
  },
  lawMetaHighlight: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#8B1E1E',
    marginTop: 2,
  },
  lawSourceLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
  },
  lawSourceLinkText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#007AFF',
  },
  lawEmptyText: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 19,
  },
  lawModalConfirmBtn: {
    height: 42,
    backgroundColor: '#8B1E1E',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lawModalConfirmBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Modal Bottom Sheet chọn nguồn ảnh
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  sheetContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D1D6',
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  sheetSubtitle: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 16,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  sheetIconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  sheetOptionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  sheetOptionDesc: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  sheetCancelBtn: {
    marginTop: 16,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666666',
  },
});
