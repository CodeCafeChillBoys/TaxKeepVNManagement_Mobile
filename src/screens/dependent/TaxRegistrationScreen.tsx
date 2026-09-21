import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  Modal,
  Alert,
  ActivityIndicator, Platform} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { RootNavigationProp, RootStackParamList } from '../../navigation/types';
import { dependentDocumentApi } from '../../api/dependentDocumentApi';
import {
  applyTaxRegistrationOcrFill,
  buildDependentScanParams,
  isTaxRegistrationFormDirty,
} from './applyTaxRegistrationOcrFill';
import {
  ageAtEffectiveFrom,
  CONDITION_GROUP_OPTIONS,
  ELIGIBILITY_CLEARED_TOAST,
  filterEligibleGroups,
  filterEligibleRelationships,
  isAge14OrOlderAtEffective,
  isGroupEligibleFor,
  mapUiGroupToBackendEnum,
  reconcileEligibilitySelection,
  RELATIONSHIP_OPTIONS,
  sanitizeOcrEligibility,
} from './dependentEligibility';

// Mảng ngày, tháng, năm
const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 100 }, (_, i) => String(currentYear - i));
const EFFECTIVE_YEARS = Array.from({ length: 10 }, (_, i) => String(currentYear - 2 + i));

export const TaxRegistrationScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'TaxRegistration'>>();

  // Trạng thái gửi dữ liệu lên Backend
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // 1. Họ và tên
  const [fullName, setFullName] = useState<string>('');

  // 2. Định danh: Căn cước công dân (khi >= 14 tuổi) hoặc Giấy khai sinh (khi < 14 tuổi)
  const [citizenId, setCitizenId] = useState<string>('');
  const [birthCertNumber, setBirthCertNumber] = useState<string>('');

  // 3. Ngày sinh (Ngày - Tháng - Năm)
  const [birthDay, setBirthDay] = useState<string>('15');
  const [birthMonth, setBirthMonth] = useState<string>('06');
  const [birthYear, setBirthYear] = useState<string>('2018');

  // 4. Mối quan hệ với người nộp thuế
  const [relationship, setRelationship] = useState<string>('CHILD');

  // 5. Thời điểm bắt đầu tính hiệu lực giảm trừ gia cảnh
  const [startDay, setStartDay] = useState<string>('01');
  const [startMonth, setStartMonth] = useState<string>('01');
  const [startYear, setStartYear] = useState<string>(String(currentYear));

  // 6. Thời điểm kết thúc tính hiệu lực giảm trừ gia cảnh
  const [hasEndDate, setHasEndDate] = useState<boolean>(false);
  const [endDay, setEndDay] = useState<string>('31');
  const [endMonth, setEndMonth] = useState<string>('12');
  const [endYear, setEndYear] = useState<string>(String(currentYear));

  // 7. Điều kiện đăng kí người phụ thuộc (Nhóm 1 đến Nhóm 5); -1 = chưa chọn
  const [selectedGroupIdx, setSelectedGroupIdx] = useState<number>(0);

  const effectiveFromMonth = `${startYear}-${startMonth}`;
  const ageAtEffective = useMemo(
    () => ageAtEffectiveFrom(birthDay, birthMonth, birthYear, effectiveFromMonth),
    [birthDay, birthMonth, birthYear, effectiveFromMonth]
  );
  const isAge14OrOlder = isAge14OrOlderAtEffective(ageAtEffective);

  const eligibleRelationships = useMemo(
    () => filterEligibleRelationships(ageAtEffective),
    [ageAtEffective]
  );
  const eligibleGroups = useMemo(
    () => filterEligibleGroups(relationship || 'CHILD', ageAtEffective),
    [relationship, ageAtEffective]
  );

  const skipReconcileToastRef = useRef(true);

  // Q6: đổi DOB / hiệu lực / quan hệ → xóa lựa chọn không còn hợp lệ
  useEffect(() => {
    const { next, clearedGroup, clearedRelationship } = reconcileEligibilitySelection(
      { relationship, selectedGroupIdx },
      ageAtEffective
    );
    if (next.relationship !== relationship) setRelationship(next.relationship);
    if (next.selectedGroupIdx !== selectedGroupIdx) setSelectedGroupIdx(next.selectedGroupIdx);
    if (!skipReconcileToastRef.current && (clearedGroup || clearedRelationship)) {
      Alert.alert('Cần chọn lại', ELIGIBILITY_CLEARED_TOAST);
    }
    skipReconcileToastRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ khi tuổi/hiệu lực đổi; quan hệ/nhóm tự reconcile
  }, [ageAtEffective]);

  // Modals selector
  const [activePicker, setActivePicker] = useState<{
    title: string;
    type: 'birthDay' | 'birthMonth' | 'birthYear' | 'relationship' | 'startDay' | 'startMonth' | 'startYear' | 'endDay' | 'endMonth' | 'endYear' | 'conditionGroup';
    items: { value: any; label: string }[];
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
      {
        relationship: patch.relationship,
        selectedGroupIdx: patch.selectedGroupIdx,
      },
      age
    );

    skipReconcileToastRef.current = true;
    setFullName(patch.fullName);
    if (patch.birthDay) setBirthDay(patch.birthDay);
    if (patch.birthMonth) setBirthMonth(patch.birthMonth);
    if (patch.birthYear) setBirthYear(patch.birthYear);
    if (patch.citizenId !== undefined) setCitizenId(patch.citizenId);
    if (patch.birthCertNumber !== undefined) setBirthCertNumber(patch.birthCertNumber);
    if (sanitized.relationship) setRelationship(sanitized.relationship);
    if (typeof sanitized.selectedGroupIdx === 'number') {
      setSelectedGroupIdx(sanitized.selectedGroupIdx);
    } else if (sanitized.dropped) {
      setSelectedGroupIdx(-1);
    }

    navigation.setParams({ ocrDependentFill: undefined });
    const msg = sanitized.dropped
      ? `${plan.alertMessage}\n\n${ELIGIBILITY_CLEARED_TOAST}`
      : plan.alertMessage;
    Alert.alert(plan.alertTitle, msg);
  }, [route.params?.ocrDependentFill]);

  // Xử lý nút Tiếp tục: validate & điều hướng sang màn Ảnh minh chứng của nhóm tương ứng
  const handleContinue = async () => {
    if (!fullName.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập Họ và Tên người phụ thuộc.');
      return;
    }

    if (!relationship) {
      Alert.alert('Thiếu thông tin', 'Vui lòng chọn mối quan hệ với người nộp thuế.');
      return;
    }

    if (selectedGroupIdx < 0 || !isGroupEligibleFor(selectedGroupIdx, relationship, ageAtEffective)) {
      Alert.alert(
        'Nhóm điều kiện không hợp lệ',
        'Vui lòng chọn nhóm điều kiện phù hợp với ngày sinh và ngày bắt đầu hiệu lực.'
      );
      return;
    }

    if (isAge14OrOlder) {
      if (!citizenId.trim()) {
        Alert.alert('Thiếu thông tin', 'Người phụ thuộc từ đủ 14 tuổi trở lên (tại ngày hiệu lực) bắt buộc phải có Căn cước công dân.');
        return;
      }
      if (citizenId.trim().length !== 12 && citizenId.trim().length !== 9) {
        Alert.alert('CCCD không hợp lệ', 'Số Căn cước công dân phải gồm 12 chữ số (hoặc 9 số CMND cũ).');
        return;
      }
    } else {
      if (!birthCertNumber.trim()) {
        Alert.alert('Thiếu thông tin', 'Người phụ thuộc dưới 14 tuổi vui lòng nhập Số giấy khai sinh / Mã định danh.');
        return;
      }
    }

    const birthDate = `${birthYear}-${birthMonth}-${birthDay}`;
    const effectiveFrom = effectiveFromMonth;
    const effectiveTo = hasEndDate ? `${endYear}-${endMonth}` : `${startYear}-12`;

    const mapped = mapUiGroupToBackendEnum(selectedGroupIdx, relationship);
    if (!mapped) {
      Alert.alert('Nhóm điều kiện không hợp lệ', 'Quan hệ và nhóm không khớp. Vui lòng chọn lại.');
      return;
    }
    const { relationship: relCode, currentGroup: groupEnumCode } = mapped;

    // Gọi API Backend POST /api/v1/dependents để tạo người phụ thuộc trước khi sang upload tài liệu
    let createdDependentId = '';
    try {
      setIsSubmitting(true);
      const createRes = await dependentDocumentApi.createDependent({
        fullName: fullName.trim(),
        relationship: relCode,
        currentGroup: groupEnumCode,
        birthDate: `${birthDate}T00:00:00Z`,
        citizenId: isAge14OrOlder ? citizenId.trim() : undefined,
        birthCertNumber: !isAge14OrOlder ? birthCertNumber.trim() : undefined,
        effectiveFromMonth: effectiveFrom,
        effectiveToMonth: effectiveTo,
      });
      createdDependentId = createRes?.dependentId || createRes?.id;
      if (!createdDependentId) {
        throw new Error('Máy chủ không trả về mã hồ sơ người phụ thuộc.');
      }
    } catch (err: any) {
      setIsSubmitting(false);
      Alert.alert(
        'Không thể đăng ký người phụ thuộc',
        err?.message || 'Có lỗi xảy ra khi lưu thông tin người phụ thuộc. Vui lòng kiểm tra lại.'
      );
      return; // Dừng lại ở Màn 1 để người dùng chỉnh sửa thông tin, không chuyển sang Màn 2
    } finally {
      setIsSubmitting(false);
    }

    // Chuẩn bị dữ liệu người phụ thuộc đã khai báo
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

    // Điều hướng sang màn hình "Ảnh minh chứng" tương ứng nhóm (iPhone 17 - 15)
    navigation.navigate('ProofDocuments', {
      groupIndex: selectedGroupIdx,
      dependentId: createdDependentId,
      dependentData,
    });
  };

  const openPicker = (
    title: string,
    type: any,
    items: { value: any; label: string }[]
  ) => {
    setActivePicker({ title, type, items });
  };

  const handleSelectPickerItem = (val: any) => {
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
      case 'relationship':
        setRelationship(val);
        // Đổi quan hệ → nếu nhóm hiện tại không còn hợp lệ thì xóa
        if (!isGroupEligibleFor(selectedGroupIdx, val, ageAtEffective)) {
          setSelectedGroupIdx(-1);
        }
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
        setSelectedGroupIdx(val);
        break;
    }
    setActivePicker(null);
  };

  const selectedRelLabel =
    RELATIONSHIP_OPTIONS.find((r) => r.value === relationship)?.label || 'Chọn mối quan hệ';
  const selectedGroupTitle =
    selectedGroupIdx >= 0
      ? CONDITION_GROUP_OPTIONS.find((g) => g.index === selectedGroupIdx)?.title ??
        'Chọn nhóm điều kiện'
      : 'Chọn nhóm điều kiện';

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header chuẩn Figma: Nền hoa văn vàng be + Tiêu đề "Đơn đăng ký người phụ thuộc" */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
          testID="taxRegBackBtn"
        >
          <Ionicons name="arrow-back" size={26} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Đơn đăng ký người phụ thuộc</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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
            <Text style={styles.ocrSubtitle}>Điền nhanh từ CCCD hoặc giấy khai sinh</Text>
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
            placeholder="Họ và tên"
            placeholderTextColor="#8E8E93"
            value={fullName}
            onChangeText={setFullName}
            testID="inputFullName"
          />
        </View>

        {/* Trường 2: Ngày sinh (Được đưa lên trên theo yêu cầu luật 14 tuổi) */}
        <View style={styles.formGroup}>
          <View style={styles.labelWithBadgeRow}>
            <Text style={styles.fieldLabel}>
              Ngày sinh. <Text style={styles.required}>*Bắt buộc</Text>
            </Text>
            <View style={[styles.ageBadge, isAge14OrOlder ? styles.ageBadgeAdult : styles.ageBadgeChild]}>
              <Text style={[styles.ageBadgeText, isAge14OrOlder ? styles.ageBadgeTextAdult : styles.ageBadgeTextChild]}>
                {ageAtEffective} tuổi tại hiệu lực ({isAge14OrOlder ? '≥ 14 tuổi' : '< 14 tuổi'})
              </Text>
            </View>
          </View>

          <View style={styles.dateSelectorRow}>
            {/* Ngày */}
            <TouchableOpacity
              style={styles.dateSelectorChip}
              onPress={() =>
                openPicker(
                  'Chọn ngày sinh',
                  'birthDay',
                  DAYS.map((d) => ({ value: d, label: `Ngày ${d}` }))
                )
              }
              testID="selectBirthDay"
            >
              <Text style={styles.dateSelectorText}>{`Ngày ${birthDay}`}</Text>
              <Ionicons name="chevron-down" size={16} color="#1A1A1A" />
            </TouchableOpacity>

            {/* Tháng */}
            <TouchableOpacity
              style={styles.dateSelectorChip}
              onPress={() =>
                openPicker(
                  'Chọn tháng sinh',
                  'birthMonth',
                  MONTHS.map((m) => ({ value: m, label: `Tháng ${m}` }))
                )
              }
              testID="selectBirthMonth"
            >
              <Text style={styles.dateSelectorText}>{`Tháng ${birthMonth}`}</Text>
              <Ionicons name="chevron-down" size={16} color="#1A1A1A" />
            </TouchableOpacity>

            {/* Năm */}
            <TouchableOpacity
              style={styles.dateSelectorChip}
              onPress={() =>
                openPicker(
                  'Chọn năm sinh',
                  'birthYear',
                  YEARS.map((y) => ({ value: y, label: `Năm ${y}` }))
                )
              }
              testID="selectBirthYear"
            >
              <Text style={styles.dateSelectorText}>{birthYear}</Text>
              <Ionicons name="chevron-down" size={16} color="#1A1A1A" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Trường 3: Xử lý theo Luật 14 tuổi:
            - Nếu người phụ thuộc >= 14 tuổi: Hiển thị trường "Căn cước công dân"
            - Nếu người phụ thuộc < 14 tuổi: Ẩn CCCD, đổi thành trường "Giấy khai sinh" (birthCertNumber) */}
        {isAge14OrOlder ? (
          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>
              Căn cước công dân <Text style={styles.required}>*Bắt buộc</Text>
            </Text>
            <TextInput
              style={styles.inputField}
              placeholder="Căn cước công dân (12 số)"
              placeholderTextColor="#8E8E93"
              value={citizenId}
              onChangeText={setCitizenId}
              keyboardType="numeric"
              maxLength={12}
              testID="inputCitizenId"
            />
            <Text style={styles.fieldHintText}>Công dân từ đủ 14 tuổi bắt buộc cung cấp Căn cước công dân.</Text>
          </View>
        ) : (
          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>
              Số giấy khai sinh <Text style={styles.required}>*Bắt buộc</Text>
            </Text>
            <TextInput
              style={styles.inputField}
              placeholder="Số giấy khai sinh / Mã định danh cá nhân"
              placeholderTextColor="#8E8E93"
              value={birthCertNumber}
              onChangeText={setBirthCertNumber}
              testID="inputBirthCertNumber"
            />
            <Text style={styles.fieldHintText}>Trẻ em dưới 14 tuổi chưa cấp CCCD sử dụng Số Giấy khai sinh theo quy định.</Text>
          </View>
        )}

        {/* Trường 4: Mối quan hệ với người nộp thuế */}
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

        {/* Trường 5: Thời điểm bắt đầu tính hiệu lực giảm trừ gia cảnh */}
        <View style={styles.formGroup}>
          <Text style={styles.fieldLabel}>
            Thời điểm bắt đầu tính hiệu lực giảm trừ gia cảnh <Text style={styles.required}>*Bắt buộc</Text>
          </Text>
          <View style={styles.dateSelectorRow}>
            {/* Ngày */}
            <TouchableOpacity
              style={styles.dateSelectorChip}
              onPress={() =>
                openPicker(
                  'Chọn ngày bắt đầu',
                  'startDay',
                  DAYS.map((d) => ({ value: d, label: `Ngày ${d}` }))
                )
              }
            >
              <Text style={styles.dateSelectorText}>{`Ngày ${startDay}`}</Text>
              <Ionicons name="chevron-down" size={16} color="#1A1A1A" />
            </TouchableOpacity>

            {/* Tháng */}
            <TouchableOpacity
              style={styles.dateSelectorChip}
              onPress={() =>
                openPicker(
                  'Chọn tháng bắt đầu',
                  'startMonth',
                  MONTHS.map((m) => ({ value: m, label: `Tháng ${m}` }))
                )
              }
            >
              <Text style={styles.dateSelectorText}>{`Tháng ${startMonth}`}</Text>
              <Ionicons name="chevron-down" size={16} color="#1A1A1A" />
            </TouchableOpacity>

            {/* Năm */}
            <TouchableOpacity
              style={styles.dateSelectorChip}
              onPress={() =>
                openPicker(
                  'Chọn năm bắt đầu',
                  'startYear',
                  EFFECTIVE_YEARS.map((y) => ({ value: y, label: `Năm ${y}` }))
                )
              }
            >
              <Text style={styles.dateSelectorText}>{startYear}</Text>
              <Ionicons name="chevron-down" size={16} color="#1A1A1A" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Trường 6: Thời điểm kết thúc tính hiệu lực giảm trừ gia cảnh */}
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
            <View style={[styles.dateSelectorRow, { marginTop: 10 }]}>
              <TouchableOpacity
                style={styles.dateSelectorChip}
                onPress={() =>
                  openPicker(
                    'Chọn ngày kết thúc',
                    'endDay',
                    DAYS.map((d) => ({ value: d, label: `Ngày ${d}` }))
                  )
                }
              >
                <Text style={styles.dateSelectorText}>{`Ngày ${endDay}`}</Text>
                <Ionicons name="chevron-down" size={16} color="#1A1A1A" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dateSelectorChip}
                onPress={() =>
                  openPicker(
                    'Chọn tháng kết thúc',
                    'endMonth',
                    MONTHS.map((m) => ({ value: m, label: `Tháng ${m}` }))
                  )
                }
              >
                <Text style={styles.dateSelectorText}>{`Tháng ${endMonth}`}</Text>
                <Ionicons name="chevron-down" size={16} color="#1A1A1A" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dateSelectorChip}
                onPress={() =>
                  openPicker(
                    'Chọn năm kết thúc',
                    'endYear',
                    EFFECTIVE_YEARS.map((y) => ({ value: y, label: `Năm ${y}` }))
                  )
                }
              >
                <Text style={styles.dateSelectorText}>{endYear}</Text>
                <Ionicons name="chevron-down" size={16} color="#1A1A1A" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Trường 7: Điều kiện đăng kí người phụ thuộc & Nút tra cứu điều kiện */}
        <View style={styles.formGroup}>
          <View style={styles.labelWithInfoRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
              <Text style={styles.fieldLabelNoMargin}>Điều kiện đăng kí người phụ thuộc</Text>
              <Text style={styles.required}>*Bắt buộc</Text>
            </View>

            {/* Bấm xem luật ngay dấu chấm than -> Mở trang Điều kiện đăng kí */}
            <TouchableOpacity
              style={styles.infoLinkBtn}
              onPress={() => navigation.navigate('LawConditions')}
              accessibilityRole="button"
              accessibilityLabel="Xem luật điều kiện đăng kí"
              testID="btnLawConditionInfo"
            >
              <Ionicons name="alert-circle-outline" size={17} color="#8B1E1E" style={{ marginRight: 3 }} />
              <Text style={styles.infoLinkText}>Xem luật</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.dropdownSelector}
            onPress={() =>
              openPicker(
                'Chọn nhóm điều kiện đăng ký',
                'conditionGroup',
                eligibleGroups.map((g) => ({ value: g.index, label: g.title }))
              )
            }
            testID="selectConditionGroup"
          >
            <Text style={styles.dropdownSelectorText} numberOfLines={1}>
              {selectedGroupTitle}
            </Text>
            <Ionicons name="chevron-down" size={18} color="#1A1A1A" />
          </TouchableOpacity>
        </View>

        <View style={{ height: 20 }} />

        {/* Nút Tiếp tục chuẩn Figma (iPhone 17 - 13) */}
        <View style={styles.btnWrapper}>
          <TouchableOpacity
            style={[styles.continueBtn, isSubmitting && { opacity: 0.7 }]}
            onPress={handleContinue}
            disabled={isSubmitting}
            activeOpacity={0.85}
            testID="btnContinueTaxReg"
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.continueBtnText}>Tiếp tục</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modal Picker chọn giá trị (Ngày, Tháng, Năm, Mối quan hệ, Nhóm điều kiện) */}
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
          <View style={styles.pickerModalContent}>
            <View style={styles.pickerModalHeader}>
              <Text style={styles.pickerModalTitle}>{activePicker?.title}</Text>
              <TouchableOpacity onPress={() => setActivePicker(null)}>
                <Ionicons name="close" size={24} color="#1A1A1A" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={true}>
              {activePicker?.items.map((item, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.pickerOptionItem}
                  onPress={() => handleSelectPickerItem(item.value)}
                >
                  <Text style={styles.pickerOptionLabel}>{item.label}</Text>
                  <Ionicons name="chevron-forward" size={16} color="#8E8E93" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    height: 64,
    backgroundColor: '#EBE4D5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#DDD5C4',
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...theme.typography.titleLarge,
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  ocrQuickCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
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
  },
  ocrTitle: {
    fontSize: 16,
    color: theme.colors.primary,
    fontWeight: '700',
  },
  ocrSubtitle: {
    fontSize: 12,
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
    fontSize: 12,
    color: '#8E8E93',
  },
  formGroup: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  required: {
    color: '#E53935',
    fontWeight: '500',
  },
  inputField: {
    height: 48,
    backgroundColor: '#EAEAEE',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#1A1A1A',
  },
  dateSelectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dateSelectorChip: {
    flex: 1,
    height: 44,
    backgroundColor: '#EAEAEE',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  dateSelectorText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  dropdownSelector: {
    height: 48,
    backgroundColor: '#EAEAEE',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  dropdownSelectorText: {
    fontSize: 14,
    fontWeight: '500',
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
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    flex: 1,
    marginRight: 10,
  },
  labelWithInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  fieldLabelNoMargin: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  exclamationInlineBtn: {
    paddingHorizontal: 2,
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  infoLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  btnWrapper: {
    alignItems: 'center',
    marginTop: 10,
  },
  continueBtn: {
    width: 170,
    height: 46,
    backgroundColor: '#EFE3BF', // Nền màu be vàng theo đúng Figma iPhone 17 - 13
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
  continueBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#262626',
  },
  // Modal Picker
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  pickerModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
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
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
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
    fontSize: 15,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  labelWithBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    fontSize: 11,
    fontWeight: '700',
  },
  ageBadgeTextAdult: {
    color: '#2E7D32',
  },
  ageBadgeTextChild: {
    color: '#E65100',
  },
  fieldHintText: {
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
    fontStyle: 'italic',
  },
});
