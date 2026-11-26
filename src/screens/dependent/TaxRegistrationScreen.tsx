import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TextInput,
  TouchableOpacity,
  Switch,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { DrumPatternBackdrop } from '../../components/brand/DrumPatternBackdrop';
import { HomeHeaderButton, useShowHomeButton } from '../../components/navigation/HomeHeaderButton';
import { useToast } from '../../components/ui/Toast';
import { CatalogErrorBanner } from '../../components/common/CatalogErrorBanner';
import { useDependentCatalog } from '../../hooks/useDependentCatalog';
import { RootNavigationProp, RootStackParamList } from '../../navigation/types';
import { dependentDocumentApi } from '../../api/dependentDocumentApi';
import { isBeforeBirthMonth } from './editEffectivePeriod';
import { sanitizeUiMessage, toFriendlyErrorMessage } from '../../utils/friendlyError';
import {
  applyTaxRegistrationOcrFill,
  buildDependentScanParams,
  isTaxRegistrationFormDirty,
} from './applyTaxRegistrationOcrFill';
import {
  ageAtEffectiveFrom,
  ELIGIBILITY_CLEARED_TOAST,
  filterEligibleGroups,
  filterEligibleRelationships,
  findEligibleGroupOption,
  GROUP_NOT_CONFIGURED_MESSAGE,
  isAge14OrOlderAtEffective,
  isGroupCodeEligible,
  reconcileEligibilitySelection,
  sanitizeOcrEligibility,
} from './dependentEligibility';
import { uiTabForGroup } from './dependentGroupUtils';
import {
  ageYearsFromBirthParts,
  GENDER_OPTIONS,
  isParentOtherGenderBlocked,
  parentIncomeCommitmentLabel,
  resolveConfirmIncomeBelowThreshold,
  showParentIncomeCommitmentCheckbox,
  type DependentGenderApi,
} from './parentIncomeCommitment';

const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 100 }, (_, i) => String(currentYear - i));
const EFFECTIVE_YEARS = Array.from({ length: 10 }, (_, i) => String(currentYear - 2 + i));

type PickerType =
  | 'birthDay'
  | 'birthMonth'
  | 'birthYear'
  | 'gender'
  | 'relationship'
  | 'startDay'
  | 'startMonth'
  | 'startYear'
  | 'endDay'
  | 'endMonth'
  | 'endYear'
  | 'conditionGroup';

interface PickerItem {
  value: any;
  label: string;
}

const PickerOptionRow = React.memo<{
  item: PickerItem;
  onSelect: (val: any) => void;
}>(({ item, onSelect }) => (
  <TouchableOpacity
    style={styles.pickerOptionItem}
    onPress={() => onSelect(item.value)}
    accessibilityRole="button"
  >
    <Text style={styles.pickerOptionLabel}>{item.label}</Text>
    <Ionicons name="chevron-forward" size={16} color="#8E8E93" />
  </TouchableOpacity>
));

export const TaxRegistrationScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'TaxRegistration'>>();
  const insets = useSafeAreaInsets();
  const showHomeButton = useShowHomeButton();
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

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [fullName, setFullName] = useState<string>('');
  const [citizenId, setCitizenId] = useState<string>('');
  const [birthCertNumber, setBirthCertNumber] = useState<string>('');

  const [birthDay, setBirthDay] = useState<string>('15');
  const [birthMonth, setBirthMonth] = useState<string>('06');
  const [birthYear, setBirthYear] = useState<string>('2018');

  const [gender, setGender] = useState<DependentGenderApi | ''>('');
  const [relationship, setRelationship] = useState<string>('');
  const [confirmIncomeBelowThreshold, setConfirmIncomeBelowThreshold] = useState(false);

  const [startDay, setStartDay] = useState<string>('01');
  const [startMonth, setStartMonth] = useState<string>('01');
  const [startYear, setStartYear] = useState<string>(String(currentYear));

  const [hasEndDate, setHasEndDate] = useState<boolean>(false);
  const [endDay, setEndDay] = useState<string>('31');
  const [endMonth, setEndMonth] = useState<string>('12');
  const [endYear, setEndYear] = useState<string>(String(currentYear));

  const [selectedGroupCode, setSelectedGroupCode] = useState<string>('');
  const [configuredGroupCodes, setConfiguredGroupCodes] = useState<string[] | null>(null);
  const [groupsLoading, setGroupsLoading] = useState(false);

  const effectiveFromMonth = `${startYear}-${startMonth}`;
  const ageAtEffective = useMemo(
    () => ageAtEffectiveFrom(birthDay, birthMonth, birthYear, effectiveFromMonth),
    [birthDay, birthMonth, birthYear, effectiveFromMonth]
  );
  const isAge14OrOlder = isAge14OrOlderAtEffective(ageAtEffective);
  const ageToday = useMemo(
    () => ageYearsFromBirthParts(birthDay, birthMonth, birthYear),
    [birthDay, birthMonth, birthYear]
  );
  const showIncomeCommitment = useMemo(
    () => showParentIncomeCommitmentCheckbox(relationship, gender, ageToday, selectedGroupCode),
    [relationship, gender, ageToday, selectedGroupCode]
  );

  useEffect(() => {
    if (!showIncomeCommitment && confirmIncomeBelowThreshold) {
      setConfirmIncomeBelowThreshold(false);
    }
  }, [showIncomeCommitment, confirmIncomeBelowThreshold]);

  const eligibleRelationships = useMemo(
    () => filterEligibleRelationships(catalog, ageAtEffective),
    [catalog, ageAtEffective]
  );
  // Nhóm = catalog ∩ GET /dependents/groups?relationship= (đã có rule giấy tờ)
  const eligibleGroups = useMemo(
    () => filterEligibleGroups(catalog, relationship, ageAtEffective, configuredGroupCodes),
    [catalog, relationship, ageAtEffective, configuredGroupCodes]
  );

  // Catalog về lần đầu: chọn sẵn quan hệ đầu danh sách (theo displayOrder) như form cũ
  useEffect(() => {
    if (!relationship && eligibleRelationships.length > 0) {
      setRelationship(eligibleRelationships[0].value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligibleRelationships]);

  // Đổi quan hệ → tải danh sách nhóm đã cấu hình giấy tờ
  useEffect(() => {
    if (!relationship) {
      setConfiguredGroupCodes(null);
      return;
    }
    let cancelled = false;
    setGroupsLoading(true);
    dependentDocumentApi
      .getGroups(relationship)
      .then((codes) => {
        if (!cancelled) setConfiguredGroupCodes(codes);
      })
      .catch(() => {
        if (!cancelled) setConfiguredGroupCodes([]);
      })
      .finally(() => {
        if (!cancelled) setGroupsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [relationship]);

  // Khi danh sách nhóm đổi: giữ mã đang chọn nếu còn hợp lệ, không thì chọn nhóm đầu
  useEffect(() => {
    if (configuredGroupCodes === null) return;
    if (eligibleGroups.length === 0) {
      if (selectedGroupCode) setSelectedGroupCode('');
      return;
    }
    const stillOk = findEligibleGroupOption(eligibleGroups, selectedGroupCode);
    if (!stillOk) {
      setSelectedGroupCode(eligibleGroups[0].code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligibleGroups, configuredGroupCodes]);

  const skipReconcileToastRef = useRef(true);

  useEffect(() => {
    if (!catalog) return;
    if (!relationship) {
      skipReconcileToastRef.current = false;
      return;
    }
    const { next, clearedGroup, clearedRelationship } = reconcileEligibilitySelection(
      catalog,
      { relationship, selectedGroupCode },
      ageAtEffective,
      configuredGroupCodes
    );
    if (next.relationship !== relationship) setRelationship(next.relationship);
    if (next.selectedGroupCode !== selectedGroupCode) setSelectedGroupCode(next.selectedGroupCode);
    if (!skipReconcileToastRef.current && (clearedGroup || clearedRelationship)) {
      toast.info(ELIGIBILITY_CLEARED_TOAST, 'Cần chọn lại điều kiện');
    }
    skipReconcileToastRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ageAtEffective, catalog, configuredGroupCodes]);

  const [activePicker, setActivePicker] = useState<{
    title: string;
    type: PickerType;
    items: PickerItem[];
  } | null>(null);

  useEffect(() => {
    const fill = route.params?.ocrDependentFill;
    if (!fill) return;

    const plan = applyTaxRegistrationOcrFill(fill);
    const { patch } = plan;
    const nextBirthDay = patch.birthDay ?? birthDay;
    const nextBirthMonth = patch.birthMonth ?? birthMonth;
    const nextBirthYear = patch.birthYear ?? birthYear;
    const age = ageAtEffectiveFrom(
      nextBirthDay,
      nextBirthMonth,
      nextBirthYear,
      effectiveFromMonth
    );
    const sanitized = sanitizeOcrEligibility(
      catalog,
      {
        relationship: patch.relationship,
        selectedGroupCode: patch.selectedGroupCode,
        selectedGroupIdx: patch.selectedGroupIdx,
      },
      age,
      relationship,
      configuredGroupCodes
    );

    skipReconcileToastRef.current = true;
    setFullName(patch.fullName);
    if (patch.birthDay) setBirthDay(patch.birthDay);
    if (patch.birthMonth) setBirthMonth(patch.birthMonth);
    if (patch.birthYear) setBirthYear(patch.birthYear);
    if (patch.citizenId !== undefined) setCitizenId(patch.citizenId);
    if (patch.birthCertNumber !== undefined) setBirthCertNumber(patch.birthCertNumber);
    if (sanitized.relationship) setRelationship(sanitized.relationship);
    if (sanitized.selectedGroupCode) {
      setSelectedGroupCode(sanitized.selectedGroupCode);
    } else if (sanitized.dropped) {
      setSelectedGroupCode('');
    }

    navigation.setParams({ ocrDependentFill: undefined });
    const msg = sanitized.dropped
      ? `${plan.alertMessage} ${ELIGIBILITY_CLEARED_TOAST}`
      : plan.alertMessage;
    toast.success(
      sanitizeUiMessage(msg, 'Đã tự động điền thông tin từ giấy tờ tùy thân.'),
      sanitizeUiMessage(plan.alertTitle, 'Đã điền thông tin')
    );
  }, [route.params?.ocrDependentFill]);

  const handleContinue = async (chosenGroup?: string) => {
    if (!fullName.trim()) {
      toast.warning('Vui lòng nhập họ và tên người phụ thuộc.', 'Thiếu thông tin bắt buộc');
      return;
    }

    if (!gender) {
      toast.warning('Vui lòng chọn giới tính người phụ thuộc.', 'Thiếu thông tin bắt buộc');
      return;
    }

    if (!relationship) {
      toast.warning('Vui lòng chọn mối quan hệ với người nộp thuế.', 'Thiếu thông tin bắt buộc');
      return;
    }

    if (isParentOtherGenderBlocked(relationship, gender)) {
      toast.warning(
        'Với cha/mẹ, vui lòng chọn giới tính Nam hoặc Nữ để áp dụng quy tắc tuổi và cam kết thu nhập.',
        'Giới tính chưa phù hợp'
      );
      return;
    }

    if (!catalog) {
      toast.warning(catalogError || 'Đang tải danh mục nhóm người phụ thuộc. Vui lòng thử lại.', 'Chưa có danh mục');
      return;
    }

    if (configuredGroupCodes !== null && configuredGroupCodes.length === 0) {
      toast.warning(GROUP_NOT_CONFIGURED_MESSAGE, 'Chưa có nhóm điều kiện');
      return;
    }

    const groupEnumCode = (chosenGroup || selectedGroupCode || '').trim();
    if (
      !groupEnumCode ||
      !isGroupCodeEligible(catalog, groupEnumCode, relationship, configuredGroupCodes)
    ) {
      toast.warning(
        'Vui lòng chọn nhóm điều kiện phù hợp với quan hệ và danh mục giấy tờ đã cấu hình.',
        'Nhóm điều kiện chưa phù hợp'
      );
      return;
    }

    const mustConfirmIncome = showParentIncomeCommitmentCheckbox(
      relationship,
      gender,
      ageToday,
      groupEnumCode
    );
    if (mustConfirmIncome && !confirmIncomeBelowThreshold) {
      toast.warning(parentIncomeCommitmentLabel(), 'Cần xác nhận cam kết thu nhập');
      return;
    }

    if (isAge14OrOlder) {
      if (!citizenId.trim()) {
        toast.warning(
          'Người phụ thuộc từ đủ 14 tuổi trở lên tại thời điểm hiệu lực bắt buộc phải có mã số định danh.',
          'Thiếu mã số định danh'
        );
        return;
      }
      if (citizenId.trim().length !== 12 && citizenId.trim().length !== 9) {
        toast.warning(
          'Mã số định danh phải gồm 12 chữ số (hoặc 9 chữ số CMND cũ).',
          'Mã số định danh chưa hợp lệ'
        );
        return;
      }
    } else if (!birthCertNumber.trim()) {
      toast.warning(
        'Người phụ thuộc dưới 14 tuổi vui lòng nhập mã số định danh.',
        'Thiếu mã số định danh'
      );
      return;
    }

    const birthDate = `${birthYear}-${birthMonth}-${birthDay}`;
    const effectiveFrom = effectiveFromMonth;
    if (isBeforeBirthMonth(effectiveFrom, birthDate)) {
      toast.warning(
        `Tháng bắt đầu không được trước tháng sinh (${birthMonth}/${birthYear}).`,
        'Thời gian hiệu lực'
      );
      return;
    }
    const effectiveTo = hasEndDate ? `${endYear}-${endMonth}` : `${startYear}-12`;
    const relCode = relationship;
    const selectedGroupIdx = Math.max(0, uiTabForGroup(catalog, groupEnumCode));

    let createdDependentId = '';
    try {
      setIsSubmitting(true);
      const createRes = await dependentDocumentApi.createDependent({
        fullName: fullName.trim(),
        gender,
        relationship: relCode,
        currentGroup: groupEnumCode,
        birthDate: `${birthDate}T00:00:00Z`,
        citizenId: isAge14OrOlder ? citizenId.trim() : undefined,
        birthCertNumber: !isAge14OrOlder ? birthCertNumber.trim() : undefined,
        effectiveFromMonth: effectiveFrom,
        effectiveToMonth: effectiveTo,
        confirmIncomeBelowThreshold: resolveConfirmIncomeBelowThreshold(
          relationship,
          gender,
          ageToday,
          groupEnumCode,
          confirmIncomeBelowThreshold
        ),
      });
      if (!isMountedRef.current) return;
      createdDependentId = createRes?.dependentId || createRes?.id;
      if (!createdDependentId) {
        throw new Error('Chưa nhận được thông tin hồ sơ người phụ thuộc vừa tạo.');
      }
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      setIsSubmitting(false);
      toast.error(
        toFriendlyErrorMessage(err, 'Chưa thể lưu thông tin người phụ thuộc. Vui lòng kiểm tra lại thông tin đã nhập.'),
        'Chưa đăng ký được hồ sơ'
      );
      return;
    } finally {
      if (isMountedRef.current) {
        setIsSubmitting(false);
      }
    }

    const dependentData = {
      id: createdDependentId,
      fullName: fullName.trim(),
      citizenId: isAge14OrOlder ? citizenId.trim() : '',
      birthCertNumber: !isAge14OrOlder ? birthCertNumber.trim() : '',
      dateOfBirth: birthDate,
      relationship: relCode,
      effectiveFromMonth: effectiveFrom,
      effectiveToMonth: effectiveTo,
      groupId: selectedGroupIdx + 1,
      groupCode: groupEnumCode,
    };

    navigation.navigate('ProofDocuments', {
      groupIndex: selectedGroupIdx,
      dependentId: createdDependentId,
      dependentData,
    });
  };

  const openPicker = useCallback((title: string, type: PickerType, items: PickerItem[]) => {
    setActivePicker({ title, type, items });
  }, []);

  const handleSelectPickerItem = useCallback(
    (val: any) => {
      if (!activePicker) return;
      switch (activePicker.type) {
        case 'birthDay':
          setBirthDay(val);
          break;
        case 'birthMonth':
          setBirthMonth(val);
          break;
        case 'birthYear':
          setBirthYear(val);
          break;
        case 'gender':
          setGender(val);
          break;
        case 'relationship':
          setRelationship(val);
          setSelectedGroupCode('');
          break;
        case 'startDay':
          setStartDay(val);
          break;
        case 'startMonth':
          setStartMonth(val);
          break;
        case 'startYear':
          setStartYear(val);
          break;
        case 'endDay':
          setEndDay(val);
          break;
        case 'endMonth':
          setEndMonth(val);
          break;
        case 'endYear':
          setEndYear(val);
          break;
        case 'conditionGroup':
          setSelectedGroupCode(String(val || ''));
          break;
      }
      setActivePicker(null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activePicker]
  );

  const pickerKeyExtractor = useCallback((item: PickerItem) => String(item.value), []);
  const renderPickerItem = useCallback(
    ({ item }: ListRenderItemInfo<PickerItem>) => (
      <PickerOptionRow item={item} onSelect={handleSelectPickerItem} />
    ),
    [handleSelectPickerItem]
  );

  const selectedGenderLabel =
    GENDER_OPTIONS.find((g) => g.value === gender)?.label || 'Chọn giới tính';
  const selectedRelLabel =
    eligibleRelationships.find((r) => r.value === relationship)?.label || 'Chọn mối quan hệ';
  const selectedGroupTitle =
    findEligibleGroupOption(eligibleGroups, selectedGroupCode)?.title ||
    (groupsLoading ? 'Đang tải nhóm điều kiện...' : 'Chọn nhóm điều kiện');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <DrumPatternBackdrop variant="soft" />
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
          testID="taxRegBackBtn"
        >
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text
          style={styles.headerTitle}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          Đơn đăng ký người phụ thuộc
        </Text>
        <View style={showHomeButton ? styles.homeSlot : styles.homeSlotCompact}>
          <HomeHeaderButton />
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollOuter}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.scrollContent}>
            {catalogError ? (
              <CatalogErrorBanner
                message={catalogError}
                loading={catalogLoading}
                onRetry={() => void reloadCatalog()}
              />
            ) : null}
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.ocrQuickCard}
              onPress={() =>
                navigation.navigate(
                  'ScanIdentity',
                  buildDependentScanParams(
                    isTaxRegistrationFormDirty({ fullName, citizenId, birthCertNumber })
                  )
                )
              }
              testID="taxRegOcrScanCard"
            >
              <View style={styles.ocrIconCircle}>
                <Ionicons name="scan-outline" size={24} color={theme.colors.primary} />
              </View>
              <View style={styles.ocrTextCol}>
                <Text style={styles.ocrTitle}>Quét giấy tờ người phụ thuộc</Text>
                <Text style={styles.ocrSubtitle}>Điền nhanh từ căn cước công dân hoặc giấy khai sinh</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>hoặc nhập tay</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Trường 1: Họ và Tên */}
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>
                Họ và Tên. <Text style={styles.required}>*Bắt buộc</Text>
              </Text>
              <TextInput
                style={styles.inputField}
                value={fullName}
                onChangeText={setFullName}
                testID="inputFullName"
              />
            </View>

            {/* Trường 2: Ngày sinh */}
            <View style={styles.formGroup}>
              <View style={styles.labelWithBadgeRow}>
                <Text style={styles.fieldLabelNoMargin}>
                  Ngày sinh. <Text style={styles.required}>*Bắt buộc</Text>
                </Text>
                <View style={[styles.ageBadge, isAge14OrOlder ? styles.ageBadgeAdult : styles.ageBadgeChild]}>
                  <Text
                    style={[
                      styles.ageBadgeText,
                      isAge14OrOlder ? styles.ageBadgeTextAdult : styles.ageBadgeTextChild,
                    ]}
                  >
                    {ageAtEffective} tuổi tại hiệu lực ({isAge14OrOlder ? '≥ 14 tuổi' : '< 14 tuổi'})
                  </Text>
                </View>
              </View>

              <View style={styles.dateSelectorRow}>
                <TouchableOpacity
                  style={[styles.dateSelectorChip, styles.dateChipDay]}
                  onPress={() =>
                    openPicker(
                      'Chọn ngày sinh',
                      'birthDay',
                      DAYS.map((d) => ({ value: d, label: `Ngày ${d}` }))
                    )
                  }
                  testID="selectBirthDay"
                >
                  <Text
                    style={styles.dateSelectorText}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                  >{`Ngày ${birthDay}`}</Text>
                  <Ionicons name="chevron-down" size={15} color="#1A1A1A" style={styles.chevronIcon} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.dateSelectorChip, styles.dateChipMonth]}
                  onPress={() =>
                    openPicker(
                      'Chọn tháng sinh',
                      'birthMonth',
                      MONTHS.map((m) => ({ value: m, label: `Tháng ${m}` }))
                    )
                  }
                  testID="selectBirthMonth"
                >
                  <Text
                    style={styles.dateSelectorText}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                  >{`Tháng ${birthMonth}`}</Text>
                  <Ionicons name="chevron-down" size={15} color="#1A1A1A" style={styles.chevronIcon} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.dateSelectorChip, styles.dateChipYear]}
                  onPress={() =>
                    openPicker(
                      'Chọn năm sinh',
                      'birthYear',
                      YEARS.map((y) => ({ value: y, label: `Năm ${y}` }))
                    )
                  }
                  testID="selectBirthYear"
                >
                  <Text
                    style={styles.dateSelectorText}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                  >{birthYear}</Text>
                  <Ionicons name="chevron-down" size={15} color="#1A1A1A" style={styles.chevronIcon} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Trường 3: Giới tính */}
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>
                Giới tính. <Text style={styles.required}>*Bắt buộc</Text>
              </Text>
              <TouchableOpacity
                style={styles.dropdownSelector}
                onPress={() =>
                  openPicker(
                    'Chọn giới tính',
                    'gender',
                    GENDER_OPTIONS.map((g) => ({ value: g.value, label: g.label }))
                  )
                }
                testID="selectGender"
              >
                <Text style={styles.dropdownSelectorText} numberOfLines={1}>
                  {selectedGenderLabel}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#1A1A1A" />
              </TouchableOpacity>
            </View>

            {/* Trường 4: Định danh theo độ tuổi */}
            {isAge14OrOlder ? (
              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>
                  Mã số định danh <Text style={styles.required}>*Bắt buộc</Text>
                </Text>
                <TextInput
                  style={styles.inputField}
                  placeholder="12 chữ số"
                  placeholderTextColor="#8E8E93"
                  value={citizenId}
                  onChangeText={setCitizenId}
                  keyboardType="numeric"
                  maxLength={12}
                  testID="inputCitizenId"
                />
                <Text style={styles.fieldHintText}>
                  Công dân từ đủ 14 tuổi bắt buộc cung cấp mã số định danh (CCCD).
                </Text>
              </View>
            ) : (
              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>
                  Mã số định danh <Text style={styles.required}>*Bắt buộc</Text>
                </Text>
                <TextInput
                  style={styles.inputField}
                  placeholder="Ví dụ: 079218001234"
                  placeholderTextColor="#8E8E93"
                  value={birthCertNumber}
                  onChangeText={setBirthCertNumber}
                  testID="inputBirthCertNumber"
                />
                <Text style={styles.fieldHintText}>
                  Trẻ em dưới 14 tuổi dùng mã số định danh cá nhân (hoặc số trên giấy tờ định danh tương ứng).
                </Text>
              </View>
            )}

            {/* Trường 5: Mối quan hệ */}
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>
                Mối quan hệ với người nộp thuế. <Text style={styles.required}>*Bắt buộc</Text>
              </Text>
              <TouchableOpacity
                style={styles.dropdownSelector}
                onPress={() =>
                  openPicker(
                    'Mối quan hệ với người nộp thuế',
                    'relationship',
                    eligibleRelationships.map((r) => ({ value: r.value, label: r.label }))
                  )
                }
                testID="selectRelationship"
              >
                <Text style={styles.dropdownSelectorText} numberOfLines={1}>
                  {selectedRelLabel}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#1A1A1A" />
              </TouchableOpacity>
            </View>

            {/* Trường 6: Thời điểm bắt đầu hiệu lực */}
            <View style={styles.formGroup}>
              <View style={styles.longLabelRow}>
                <Text style={[styles.fieldLabel, styles.longLabelText]}>
                  Thời điểm bắt đầu tính hiệu lực giảm trừ gia cảnh
                </Text>
                <Text style={styles.requiredMark} testID="effectiveStartRequiredMark">
                  Bắt buộc
                </Text>
              </View>
              <View style={styles.dateSelectorRow}>
                <TouchableOpacity
                  style={[styles.dateSelectorChip, styles.dateChipDay]}
                  onPress={() =>
                    openPicker(
                      'Chọn ngày bắt đầu',
                      'startDay',
                      DAYS.map((d) => ({ value: d, label: `Ngày ${d}` }))
                    )
                  }
                >
                  <Text
                    style={styles.dateSelectorText}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                  >{`Ngày ${startDay}`}</Text>
                  <Ionicons name="chevron-down" size={15} color="#1A1A1A" style={styles.chevronIcon} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.dateSelectorChip, styles.dateChipMonth]}
                  onPress={() =>
                    openPicker(
                      'Chọn tháng bắt đầu',
                      'startMonth',
                      MONTHS.map((m) => ({ value: m, label: `Tháng ${m}` }))
                    )
                  }
                >
                  <Text
                    style={styles.dateSelectorText}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                  >{`Tháng ${startMonth}`}</Text>
                  <Ionicons name="chevron-down" size={15} color="#1A1A1A" style={styles.chevronIcon} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.dateSelectorChip, styles.dateChipYear]}
                  onPress={() =>
                    openPicker(
                      'Chọn năm bắt đầu',
                      'startYear',
                      EFFECTIVE_YEARS.map((y) => ({ value: y, label: `Năm ${y}` }))
                    )
                  }
                >
                  <Text
                    style={styles.dateSelectorText}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                  >{startYear}</Text>
                  <Ionicons name="chevron-down" size={15} color="#1A1A1A" style={styles.chevronIcon} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Trường 7: Thời điểm kết thúc hiệu lực */}
            <View style={styles.formGroup}>
              <View style={styles.toggleLabelRow}>
                <Text style={styles.fieldLabelToggle}>
                  Thời điểm kết thúc tính hiệu lực giảm trừ gia cảnh
                </Text>
                <Switch
                  value={hasEndDate}
                  onValueChange={setHasEndDate}
                  trackColor={{ false: '#D1D1D6', true: theme.colors.primary }}
                  thumbColor="#FFFFFF"
                  testID="toggleHasEndDate"
                />
              </View>

              {hasEndDate && (
                <View style={[styles.dateSelectorRow, styles.endDateRow]}>
                  <TouchableOpacity
                    style={[styles.dateSelectorChip, styles.dateChipDay]}
                    onPress={() =>
                      openPicker(
                        'Chọn ngày kết thúc',
                        'endDay',
                        DAYS.map((d) => ({ value: d, label: `Ngày ${d}` }))
                      )
                    }
                  >
                    <Text
                      style={styles.dateSelectorText}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.85}
                    >{`Ngày ${endDay}`}</Text>
                    <Ionicons name="chevron-down" size={15} color="#1A1A1A" style={styles.chevronIcon} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.dateSelectorChip, styles.dateChipMonth]}
                    onPress={() =>
                      openPicker(
                        'Chọn tháng kết thúc',
                        'endMonth',
                        MONTHS.map((m) => ({ value: m, label: `Tháng ${m}` }))
                      )
                    }
                  >
                    <Text
                      style={styles.dateSelectorText}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.85}
                    >{`Tháng ${endMonth}`}</Text>
                    <Ionicons name="chevron-down" size={15} color="#1A1A1A" style={styles.chevronIcon} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.dateSelectorChip, styles.dateChipYear]}
                    onPress={() =>
                      openPicker(
                        'Chọn năm kết thúc',
                        'endYear',
                        EFFECTIVE_YEARS.map((y) => ({ value: y, label: `Năm ${y}` }))
                      )
                    }
                  >
                    <Text
                      style={styles.dateSelectorText}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.85}
                    >{endYear}</Text>
                    <Ionicons name="chevron-down" size={15} color="#1A1A1A" style={styles.chevronIcon} />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Trường 7: Điều kiện đăng ký */}
            <View style={styles.formGroup}>
              <View style={styles.labelWithInfoRow}>
                <View style={styles.conditionLabelWrap}>
                  <Text style={styles.fieldLabelNoMargin}>Điều kiện đăng kí người phụ thuộc</Text>
                  <Text style={styles.required}>*Bắt buộc</Text>
                </View>

                <TouchableOpacity
                  style={styles.infoLinkBtn}
                  onPress={() => navigation.navigate('LawConditions')}
                  accessibilityRole="button"
                  accessibilityLabel="Xem luật điều kiện đăng kí"
                  testID="btnLawConditionInfo"
                >
                  <Ionicons name="alert-circle-outline" size={17} color="#8B1E1E" style={styles.lawIcon} />
                  <Text style={styles.infoLinkText}>Xem luật</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.dropdownSelector}
                onPress={() => {
                  if (groupsLoading) return;
                  if (eligibleGroups.length === 0) {
                    toast.warning(GROUP_NOT_CONFIGURED_MESSAGE, 'Chưa có nhóm điều kiện');
                    return;
                  }
                  openPicker(
                    'Chọn nhóm điều kiện đăng ký',
                    'conditionGroup',
                    eligibleGroups.map((g) => ({
                      value: g.code,
                      label: g.subtitle ? `${g.title} — ${g.subtitle}` : g.title,
                    }))
                  );
                }}
                testID="selectConditionGroup"
              >
                <Text style={styles.dropdownSelectorText} numberOfLines={1}>
                  {selectedGroupTitle}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#1A1A1A" />
              </TouchableOpacity>
            </View>

            {showIncomeCommitment ? (
              <View style={styles.formGroup}>
                <TouchableOpacity
                  style={styles.commitmentRow}
                  onPress={() => setConfirmIncomeBelowThreshold((v) => !v)}
                  activeOpacity={0.85}
                  testID="toggleIncomeCommitment"
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: confirmIncomeBelowThreshold }}
                >
                  <Ionicons
                    name={confirmIncomeBelowThreshold ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={confirmIncomeBelowThreshold ? theme.colors.primary : '#8E8E93'}
                    style={styles.commitmentIcon}
                  />
                  <Text style={styles.commitmentText}>{parentIncomeCommitmentLabel()}</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <View style={styles.btnWrapper}>
              <TouchableOpacity
                style={[styles.continueBtn, isSubmitting && styles.continueBtnDisabled]}
                onPress={() => handleContinue()}
                disabled={isSubmitting}
                activeOpacity={0.85}
                testID="btnContinueTaxReg"
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#262626" size="small" />
                ) : (
                  <Text style={styles.continueBtnText}>Tiếp tục</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal Picker dùng FlatList tối ưu cuộn dài (100 năm) */}
      <Modal
        visible={activePicker !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setActivePicker(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setActivePicker(null)}
        >
          <View
            style={[styles.pickerModalContent, { paddingBottom: Math.max(insets.bottom, 20) }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.pickerModalHeader}>
              <Text style={styles.pickerModalTitle}>{activePicker?.title}</Text>
              <TouchableOpacity
                onPress={() => setActivePicker(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={24} color="#1A1A1A" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={activePicker?.items ?? []}
              keyExtractor={pickerKeyExtractor}
              renderItem={renderPickerItem}
              style={styles.pickerList}
              showsVerticalScrollIndicator
              initialNumToRender={14}
              maxToRenderPerBatch={14}
              windowSize={7}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  homeSlot: { width: 40, alignItems: 'flex-end', justifyContent: 'center' },
  homeSlotCompact: { width: 20, alignItems: 'flex-end', justifyContent: 'center' },
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    minHeight: 52,
    paddingVertical: 6,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.goldLight,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...theme.typography.titleLarge,
    flex: 1,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '700',
    color: theme.colors.primaryDark,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  scrollOuter: {
    flexGrow: 1,
  },
  scrollContent: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 56,
  },
  ocrQuickCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.2,
    borderColor: theme.colors.gold,
    borderStyle: 'dashed',
    marginBottom: 12,
  },
  ocrIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  ocrTextCol: {
    flex: 1,
    paddingVertical: 2,
  },
  ocrTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    lineHeight: 22,
    color: theme.colors.primary,
  },
  ocrSubtitle: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  dividerText: {
    marginHorizontal: 10,
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#8E8E93',
  },
  formGroup: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    color: '#1A1A1A',
    marginBottom: 8,
  },
  longLabelRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  longLabelText: {
    flex: 1,
    marginBottom: 0,
  },
  requiredMark: {
    color: '#E53935',
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    marginTop: 1,
  },
  required: {
    color: '#E53935',
    fontFamily: fonts.bodyMedium,
  },
  inputField: {
    minHeight: 48,
    backgroundColor: '#EAEAEE',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: fonts.body,
    fontSize: 15,
    color: '#1A1A1A',
  },
  dateSelectorRow: {
    flexDirection: 'row',
    gap: 6,
  },
  endDateRow: {
    marginTop: 10,
  },
  dateSelectorChip: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    backgroundColor: '#EAEAEE',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 9,
    gap: 3,
  },
  dateChipDay: {
    flex: 1.08,
  },
  dateChipMonth: {
    flex: 1.24,
  },
  dateChipYear: {
    flex: 0.85,
  },
  chevronIcon: {
    flexShrink: 0,
  },
  dateSelectorText: {
    flex: 1,
    flexShrink: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
    color: '#1A1A1A',
  },
  dropdownSelector: {
    minHeight: 48,
    backgroundColor: '#EAEAEE',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  dropdownSelectorText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: '#1A1A1A',
    flex: 1,
    marginRight: 8,
  },
  toggleLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldLabelToggle: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    color: '#1A1A1A',
    flex: 1,
    marginRight: 10,
  },
  commitmentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F5F2E8',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  commitmentIcon: {
    marginTop: 1,
  },
  commitmentText: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 19,
    color: '#1A1A1A',
  },
  labelWithInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  conditionLabelWrap: {
    flex: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  fieldLabelNoMargin: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    color: '#1A1A1A',
  },
  lawIcon: {
    marginRight: 3,
  },
  infoLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  infoLinkText: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    color: theme.colors.primary,
  },
  btnWrapper: {
    alignItems: 'center',
    marginTop: 18,
  },
  continueBtn: {
    minWidth: 180,
    minHeight: 46,
    paddingHorizontal: 28,
    paddingVertical: 11,
    backgroundColor: '#EFE3BF',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)' }
      : {
          elevation: 2,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        }),
  },
  continueBtnDisabled: {
    opacity: 0.7,
  },
  continueBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: '#262626',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  pickerModalContent: {
    width: '100%',
    maxWidth: 540,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  pickerModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F2',
  },
  pickerModalTitle: {
    flex: 1,
    fontFamily: fonts.bodyBold,
    fontSize: 17,
    color: '#1A1A1A',
  },
  pickerList: {
    maxHeight: 320,
  },
  pickerOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F7F7F8',
  },
  pickerOptionLabel: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: '#1A1A1A',
    marginRight: 8,
  },
  labelWithBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  ageBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  ageBadgeAdult: {
    backgroundColor: '#E8F5E9',
  },
  ageBadgeChild: {
    backgroundColor: '#FFF3E0',
  },
  ageBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
  },
  ageBadgeTextAdult: {
    color: '#2E7D32',
  },
  ageBadgeTextChild: {
    color: '#E65100',
  },
  fieldHintText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
    lineHeight: 17,
  },
});
