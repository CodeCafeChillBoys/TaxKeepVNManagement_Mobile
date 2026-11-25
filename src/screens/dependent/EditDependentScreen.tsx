import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  useNavigation,
  useRoute,
  RouteProp,
  usePreventRemove,
} from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { DrumHeader } from '../../components/brand/DrumHeader';
import { Dialog } from '../../components/common/Dialog';
import { useToast } from '../../components/ui/Toast';
import { ChangeGroupSheet } from '../../components/common/ChangeGroupSheet';
import { CatalogErrorBanner } from '../../components/common/CatalogErrorBanner';
import { useDependentCatalog } from '../../hooks/useDependentCatalog';
import { getCachedCatalog } from '../../api/dependentCatalogStore';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { RootStackParamList } from '../../navigation/types';
import { dependentDocumentApi, type DependentItem } from '../../api/dependentDocumentApi';
import { dependentLifecycleApi } from '../../api/dependentLifecycleApi';
import { pickApiErrorMessage } from '../../utils/apiErrorCatalog';
import { ageAtEffectiveFrom, isAge14OrOlderAtEffective } from './dependentEligibility';
import { groupName, relationshipName } from './dependentGroupUtils';
import {
  DEPENDENT_MAX_LENGTHS,
  EditDependentFormState,
  buildUpdateDependentPayload,
  clampBirthDay,
  daysInMonth,
  dependentDetailToFormState,
  hasIdentityFieldChange,
  isEditDependentFormDirty,
  needsIdentityChangeConfirm,
  splitEffectiveMonth,
} from './editDependentForm';
import {
  buildManualChangeGroupPlan,
  runManualChangeGroup,
  type ManualChangeGroupPlan,
} from './manualChangeGroup';
import { buildProofDocumentsParams } from './proofDocumentsParams';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'EditDependent'>;

const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const YEARS = Array.from({ length: 100 }, (_, i) => String(new Date().getFullYear() - i));
const EFF_YEARS = Array.from({ length: 8 }, (_, i) => String(new Date().getFullYear() - 2 + i));

type PickerField =
  | 'birthDay'
  | 'birthMonth'
  | 'birthYear'
  | 'relationship'
  | 'currentGroup'
  | 'fromYear'
  | 'fromMonth'
  | 'toYear'
  | 'toMonth';

export const EditDependentScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { toast } = useToast();
  const dependentId = route.params.dependentId;
  const {
    catalog,
    error: catalogError,
    loading: catalogLoading,
    reload: reloadCatalog,
  } = useDependentCatalog();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<EditDependentFormState | null>(null);
  const [baseline, setBaseline] = useState<EditDependentFormState | null>(null);
  const [profileStatus, setProfileStatus] = useState('');
  const [hasUploadedDocs, setHasUploadedDocs] = useState(false);
  const [identityConfirmVisible, setIdentityConfirmVisible] = useState(false);
  const [changeGroupPlan, setChangeGroupPlan] = useState<ManualChangeGroupPlan | null>(null);
  const [changeGroupVisible, setChangeGroupVisible] = useState(false);
  const [changeGroupLoading, setChangeGroupLoading] = useState(false);
  const savedOkRef = useRef(false);

  const [leaveVisible, setLeaveVisible] = useState(false);
  const [pendingLeaveAction, setPendingLeaveAction] = useState<any>(null);

  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerTitle, setPickerTitle] = useState('');
  const [pickerField, setPickerField] = useState<PickerField | null>(null);
  const [pickerOptions, setPickerOptions] = useState<{ value: string; label: string }[]>([]);

  const patchForm = useCallback((partial: Partial<EditDependentFormState>) => {
    setForm((prev) => (prev ? { ...prev, ...partial } : prev));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const detail = await dependentDocumentApi.getDependentById(dependentId);
      const state = dependentDetailToFormState(detail, getCachedCatalog());
      setForm(state);
      setBaseline(state);
      setProfileStatus(String(detail?.status || ''));
      setHasUploadedDocs(Array.isArray(detail?.documents) && detail.documents.length > 0);
      savedOkRef.current = false;
    } catch (e: any) {
      setLoadError(e?.message || 'Không tải được hồ sơ người phụ thuộc.');
    } finally {
      setLoading(false);
    }
  }, [dependentId]);

  useEffect(() => {
    load();
  }, [load]);

  const isDirty = useMemo(
    () => (form ? isEditDependentFormDirty(form, baseline) : false),
    [form, baseline]
  );

  usePreventRemove(isDirty && !savedOkRef.current, ({ data }) => {
    if (savedOkRef.current) {
      navigation.dispatch(data.action);
      return;
    }
    setPendingLeaveAction(data.action);
    setLeaveVisible(true);
  });

  const ageAtEffective = useMemo(() => {
    if (!form) return 0;
    return ageAtEffectiveFrom(form.birthDay, form.birthMonth, form.birthYear, form.effectiveFromMonth);
  }, [form]);

  const needCitizenId = isAge14OrOlderAtEffective(ageAtEffective);

  const openPicker = (title: string, field: PickerField, options: { value: string; label: string }[]) => {
    if (profileStatus.toUpperCase() === 'INACTIVE') return;
    setPickerTitle(title);
    setPickerField(field);
    setPickerOptions(options);
    setPickerVisible(true);
  };

  const onPick = (value: string) => {
    if (!form || !pickerField) return;
    if (pickerField === 'fromYear' || pickerField === 'fromMonth') {
      const parts = splitEffectiveMonth(form.effectiveFromMonth);
      const year = pickerField === 'fromYear' ? value : parts.year;
      const month = pickerField === 'fromMonth' ? value : parts.month;
      patchForm({ effectiveFromMonth: `${year}-${month}` });
    } else if (pickerField === 'toYear' || pickerField === 'toMonth') {
      const parts = splitEffectiveMonth(form.effectiveToMonth);
      const year = pickerField === 'toYear' ? value : parts.year;
      const month = pickerField === 'toMonth' ? value : parts.month;
      patchForm({ effectiveToMonth: `${year}-${month}` });
    } else if (pickerField === 'birthMonth' || pickerField === 'birthYear' || pickerField === 'birthDay') {
      const next = {
        birthDay: pickerField === 'birthDay' ? value : form.birthDay,
        birthMonth: pickerField === 'birthMonth' ? value : form.birthMonth,
        birthYear: pickerField === 'birthYear' ? value : form.birthYear,
      };
      patchForm({
        ...next,
        birthDay: clampBirthDay(next.birthDay, next.birthMonth, next.birthYear),
      });
    } else {
      patchForm({ [pickerField]: value } as Partial<EditDependentFormState>);
    }
    setPickerVisible(false);
    setPickerField(null);
  };

  const isInactive = profileStatus.toUpperCase() === 'INACTIVE';

  const handleSave = async (confirmIdentity = false) => {
    if (!form || saving || isInactive) return;
    const built = buildUpdateDependentPayload(form);
    if (!built.ok) {
      toast.warning(built.message, 'Chưa thể lưu');
      return;
    }
    const identityChanged = hasIdentityFieldChange(form, baseline);
    if (!confirmIdentity && needsIdentityChangeConfirm(profileStatus, identityChanged)) {
      setIdentityConfirmVisible(true);
      return;
    }
    setSaving(true);
    try {
      const result = await dependentDocumentApi.updateDependent(dependentId, {
        ...built.payload,
        confirmIdentityChange: confirmIdentity || undefined,
      });
      savedOkRef.current = true;
      setBaseline(form);
      setIdentityConfirmVisible(false);
      if (result.statusChanged || result.documentsNeedReupload) {
        const dep: DependentItem = {
          id: dependentId,
          fullName: result.fullName || form.fullName,
          birthDate: `${form.birthYear}-${form.birthMonth}-${form.birthDay}`,
          currentGroup: result.currentGroup || form.currentGroup,
          groupTitle: groupName(catalog, result.currentGroup || form.currentGroup),
          isProfileComplete: false,
          requiredDocs: Array.isArray(result.requiredDocuments) ? result.requiredDocuments : [],
          citizenId: result.citizenId ?? (form.citizenId.trim() || undefined),
          birthCertNumber: result.birthCertNumber ?? (form.birthCertNumber.trim() || undefined),
          relationship: result.relationship || form.relationship,
          effectiveFromMonth: result.effectiveFromMonth || form.effectiveFromMonth,
          effectiveToMonth: result.effectiveToMonth || form.effectiveToMonth,
          status: result.status || 'PENDING_DOCUMENTS',
        };
        navigation.navigate('ProofDocuments', buildProofDocumentsParams(dep, catalog));
        return;
      }
      toast.success('Hồ sơ người phụ thuộc đã được lưu.', 'Đã cập nhật');
      navigation.goBack();
    } catch (e: any) {
      if (e?.errorCode === 'IDENTITY_CHANGE_REQUIRES_REVERIFY') {
        setIdentityConfirmVisible(true);
        return;
      }
      toast.error(pickApiErrorMessage(e?.errorCode, e?.message, 'Không thể lưu hồ sơ.'), 'Không thể lưu');
    } finally {
      setSaving(false);
    }
  };

  const openChangeGroup = () => {
    if (!form) return;
    const plan = buildManualChangeGroupPlan({
      dependentId,
      fullName: form.fullName,
      relationship: form.relationship,
      currentGroup: form.currentGroup,
      ageAtEffective,
      catalog,
    });
    if (!plan.canChange) {
      toast.warning('Không còn nhóm điều kiện khác phù hợp với mối quan hệ hiện tại.', 'Chưa thể đổi nhóm');
      return;
    }
    setChangeGroupPlan(plan);
    setChangeGroupVisible(true);
  };

  const fromParts = splitEffectiveMonth(form?.effectiveFromMonth);
  const toParts = splitEffectiveMonth(form?.effectiveToMonth);
  const relLabel = relationshipName(catalog, form?.relationship) || '—';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <DrumHeader
        title="Sửa hồ sơ NPT"
        onBack={() => navigation.goBack()}
        backTestID="editDependentBack"
      />

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.centerHint}>Đang tải hồ sơ…</Text>
        </View>
      ) : loadError || !form ? (
        <View style={styles.centerBox}>
          <Text style={styles.centerError}>{loadError || 'Không có dữ liệu.'}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load} testID="editDependentRetry">
            <Text style={styles.retryBtnText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {catalogError ? (
              <CatalogErrorBanner
                message={catalogError}
                loading={catalogLoading}
                onRetry={() => void reloadCatalog()}
              />
            ) : null}
            {isInactive ? (
              <Text style={styles.identityNote}>
                Hồ sơ người phụ thuộc đã ngừng hiệu lực nên không thể chỉnh sửa thông tin.
              </Text>
            ) : null}
            {profileStatus.toUpperCase() === 'ACTIVE' ? (
              <Text style={styles.identityNote}>
                Hồ sơ đã đủ minh chứng. Đổi thông tin nhân thân sẽ đưa hồ sơ về Chờ minh chứng.
              </Text>
            ) : null}
            {profileStatus.toUpperCase() === 'PENDING_DOCUMENTS' && hasUploadedDocs ? (
              <Text style={styles.identityNote}>
                Đổi thông tin nhân thân thì các giấy đã nộp phải nộp lại.
              </Text>
            ) : null}

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>
                Họ và tên <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={form.fullName}
                onChangeText={(t) => patchForm({ fullName: t })}
                maxLength={DEPENDENT_MAX_LENGTHS.fullName}
                editable={!isInactive}
                testID="editDependentFullName"
              />
            </View>

            <View style={styles.formGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.fieldLabelNoMargin}>
                  Ngày sinh <Text style={styles.required}>*</Text>
                </Text>
                <View style={[styles.ageBadge, needCitizenId ? styles.ageAdult : styles.ageChild]}>
                  <Text style={[styles.ageBadgeText, needCitizenId ? styles.ageAdultText : styles.ageChildText]}>
                    {ageAtEffective} tuổi tại hiệu lực
                  </Text>
                </View>
              </View>
              <View style={styles.chipRow}>
                <TouchableOpacity
                  style={styles.chip}
                  onPress={() =>
                    openPicker(
                      'Ngày sinh',
                      'birthDay',
                      Array.from(
                        { length: daysInMonth(Number(form.birthYear), Number(form.birthMonth)) },
                        (_, i) => String(i + 1).padStart(2, '0')
                      ).map((d) => ({ value: d, label: `Ngày ${d}` }))
                    )
                  }
                  testID="editDependentBirthDay"
                >
                  <Text style={styles.chipText}>Ngày {form.birthDay}</Text>
                  <Ionicons name="chevron-down" size={16} color="#1A1A1A" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.chip}
                  onPress={() =>
                    openPicker(
                      'Tháng sinh',
                      'birthMonth',
                      MONTHS.map((m) => ({ value: m, label: `Tháng ${m}` }))
                    )
                  }
                >
                  <Text style={styles.chipText}>Tháng {form.birthMonth}</Text>
                  <Ionicons name="chevron-down" size={16} color="#1A1A1A" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.chip}
                  onPress={() =>
                    openPicker(
                      'Năm sinh',
                      'birthYear',
                      YEARS.map((y) => ({ value: y, label: y }))
                    )
                  }
                >
                  <Text style={styles.chipText}>{form.birthYear}</Text>
                  <Ionicons name="chevron-down" size={16} color="#1A1A1A" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Chỉ hiện 1 ô mã số định danh — theo tuổi (giống đăng ký); field còn lại null/không dùng thì ẩn */}
            {needCitizenId ? (
              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>
                  Mã số định danh <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  value={form.citizenId}
                  onChangeText={(t) =>
                    patchForm({
                      citizenId: t.replace(/\D/g, '').slice(0, 12),
                      birthCertNumber: '',
                    })
                  }
                  keyboardType="numeric"
                  maxLength={12}
                  editable={!isInactive}
                  placeholder="12 chữ số"
                  placeholderTextColor="#8E8E93"
                  testID="editDependentCitizenId"
                />
                <Text style={styles.hint}>
                  Từ đủ 14 tuổi bắt buộc mã số định danh 12 chữ số.
                </Text>
              </View>
            ) : (
              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>
                  Mã số định danh <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  value={form.birthCertNumber}
                  onChangeText={(t) =>
                    patchForm({
                      birthCertNumber: t,
                      citizenId: '',
                    })
                  }
                  maxLength={DEPENDENT_MAX_LENGTHS.birthCertNumber}
                  editable={!isInactive}
                  placeholder="Ví dụ: 079218001234"
                  placeholderTextColor="#8E8E93"
                  testID="editDependentBirthCert"
                />
                <Text style={styles.hint}>
                  Dưới 14 tuổi dùng mã số định danh cá nhân (hoặc số trên giấy tờ định danh tương ứng).
                </Text>
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Mã số thuế (nếu có)</Text>
              <TextInput
                style={styles.input}
                value={form.taxIdNumber}
                onChangeText={(t) => patchForm({ taxIdNumber: t.replace(/\D/g, '').slice(0, 12) })}
                keyboardType="numeric"
                maxLength={12}
                editable={!isInactive}
                testID="editDependentTaxId"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Mối quan hệ và nhóm điều kiện</Text>
              <View style={styles.readonlyBox}>
                <Text style={styles.dropdownText}>
                  {relLabel}
                  {form.currentGroup ? ` · ${groupName(catalog, form.currentGroup)}` : ''}
                </Text>
              </View>
              {!isInactive ? (
                <TouchableOpacity
                  style={styles.changeGroupBtn}
                  onPress={openChangeGroup}
                  testID="editDependentChangeGroup"
                >
                  <Text style={styles.changeGroupText}>Đổi nhóm điều kiện</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>
                Tháng bắt đầu giảm trừ <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.chipRow}>
                <TouchableOpacity
                  style={styles.chip}
                  onPress={() =>
                    openPicker(
                      'Tháng bắt đầu',
                      'fromMonth',
                      MONTHS.map((m) => ({ value: m, label: `Tháng ${m}` }))
                    )
                  }
                >
                  <Text style={styles.chipText}>Tháng {fromParts.month}</Text>
                  <Ionicons name="chevron-down" size={16} color="#1A1A1A" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.chip}
                  onPress={() =>
                    openPicker(
                      'Năm bắt đầu',
                      'fromYear',
                      EFF_YEARS.map((y) => ({ value: y, label: y }))
                    )
                  }
                >
                  <Text style={styles.chipText}>{fromParts.year}</Text>
                  <Ionicons name="chevron-down" size={16} color="#1A1A1A" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>
                Tháng kết thúc giảm trừ <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.chipRow}>
                <TouchableOpacity
                  style={styles.chip}
                  onPress={() =>
                    openPicker(
                      'Tháng kết thúc',
                      'toMonth',
                      MONTHS.map((m) => ({ value: m, label: `Tháng ${m}` }))
                    )
                  }
                >
                  <Text style={styles.chipText}>Tháng {toParts.month}</Text>
                  <Ionicons name="chevron-down" size={16} color="#1A1A1A" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.chip}
                  onPress={() =>
                    openPicker(
                      'Năm kết thúc',
                      'toYear',
                      EFF_YEARS.map((y) => ({ value: y, label: y }))
                    )
                  }
                >
                  <Text style={styles.chipText}>{toParts.year}</Text>
                  <Ionicons name="chevron-down" size={16} color="#1A1A1A" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Ghi chú</Text>
              <TextInput
                style={[styles.input, styles.noteInput]}
                value={form.note}
                onChangeText={(t) => patchForm({ note: t })}
                multiline
                maxLength={DEPENDENT_MAX_LENGTHS.note}
                editable={!isInactive}
                textAlignVertical="top"
                testID="editDependentNote"
              />
            </View>

            {!isInactive ? (
              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={() => void handleSave()}
                disabled={saving}
                testID="editDependentSave"
              >
                {saving ? (
                  <ActivityIndicator color="#262626" />
                ) : (
                  <Text style={styles.saveBtnText}>Lưu thay đổi</Text>
                )}
              </TouchableOpacity>
            ) : null}
            <View style={{ height: 28 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      <Modal visible={pickerVisible} transparent animationType="slide" onRequestClose={() => setPickerVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setPickerVisible(false)}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>{pickerTitle}</Text>
              <TouchableOpacity onPress={() => setPickerVisible(false)}>
                <Ionicons name="close" size={22} color="#1A1A1A" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={pickerOptions}
              keyExtractor={(item) => item.value}
              style={styles.pickerList}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.pickerItem} onPress={() => onPick(item.value)}>
                  <Text style={styles.pickerItemLabel}>{item.label}</Text>
                  <Ionicons name="chevron-forward" size={16} color="#999" />
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      <Dialog
        visible={leaveVisible}
        title="Rời màn hình"
        message="Bạn có thay đổi chưa lưu. Rời màn hình này?"
        primaryLabel="Rời đi"
        secondaryLabel="Ở lại"
        onPrimary={() => {
          setLeaveVisible(false);
          const action = pendingLeaveAction;
          setPendingLeaveAction(null);
          if (action) navigation.dispatch(action);
        }}
        onSecondary={() => {
          setLeaveVisible(false);
          setPendingLeaveAction(null);
        }}
        onRequestClose={() => {
          setLeaveVisible(false);
          setPendingLeaveAction(null);
        }}
      />

      <Dialog
        visible={identityConfirmVisible}
        title="Xác nhận đổi thông tin"
        message="Hồ sơ đã đủ minh chứng. Đổi thông tin nhân thân sẽ đưa hồ sơ về trạng thái chờ nộp lại giấy. Tiếp tục?"
        primaryLabel="Tiếp tục"
        secondaryLabel="Ở lại"
        onPrimary={() => {
          setIdentityConfirmVisible(false);
          void handleSave(true);
        }}
        onSecondary={() => setIdentityConfirmVisible(false)}
        onRequestClose={() => setIdentityConfirmVisible(false)}
      />

      <ChangeGroupSheet
        visible={changeGroupVisible && !!changeGroupPlan}
        fullName={changeGroupPlan?.fullName ?? ''}
        currentGroup={changeGroupPlan?.currentGroup ?? ''}
        options={changeGroupPlan?.options ?? []}
        loading={changeGroupLoading}
        onSelect={async (code) => {
          if (!changeGroupPlan || changeGroupLoading) return;
          setChangeGroupLoading(true);
          try {
            const result = await runManualChangeGroup({
              dependentId: changeGroupPlan.dependentId,
              newGroup: code,
              updateDependentGroup: dependentLifecycleApi.updateDependentGroup,
              catalog,
            });
            if (!result.ok) {
              toast.error(result.message, 'Chưa chuyển được nhóm');
              return;
            }
            savedOkRef.current = true;
            setChangeGroupVisible(false);
            navigation.navigate(result.navigation.screen, result.navigation.params);
          } finally {
            setChangeGroupLoading(false);
          }
        }}
        onCancel={() => {
          if (changeGroupLoading) return;
          setChangeGroupVisible(false);
          setChangeGroupPlan(null);
        }}
      />

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  centerHint: { fontFamily: fonts.body, color: theme.colors.textSecondary },
  centerError: { fontFamily: fonts.bodyMedium, color: theme.colors.error, textAlign: 'center' },
  retryBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: theme.colors.primary,
  },
  retryBtnText: { fontFamily: fonts.bodyBold, color: '#FFF' },
  formGroup: { marginBottom: 18 },
  fieldLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    color: '#1A1A1A',
    marginBottom: 8,
  },
  fieldLabelNoMargin: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    color: '#1A1A1A',
  },
  required: { color: '#E53935', fontFamily: fonts.bodyMedium },
  input: {
    minHeight: 48,
    backgroundColor: '#EAEAEE',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: fonts.body,
    fontSize: 15,
    color: '#1A1A1A',
  },
  noteInput: { minHeight: 88 },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  ageBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  ageAdult: { backgroundColor: '#E8F5E9' },
  ageChild: { backgroundColor: '#FFF3E0' },
  ageBadgeText: { fontFamily: fonts.bodyBold, fontSize: 11 },
  ageAdultText: { color: '#2E7D32' },
  ageChildText: { color: '#E65100' },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: {
    flex: 1,
    minHeight: 44,
    backgroundColor: '#EAEAEE',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    gap: 4,
  },
  chipText: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: '#1A1A1A',
  },
  dropdown: {
    minHeight: 48,
    backgroundColor: '#EAEAEE',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    gap: 8,
  },
  dropdownText: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: '#1A1A1A',
  },
  hint: {
    marginTop: 6,
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#666',
    lineHeight: 17,
  },
  identityNote: {
    marginBottom: 16,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: '#8B1E1E',
  },
  readonlyBox: {
    minHeight: 48,
    backgroundColor: '#F3EEE6',
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  changeGroupBtn: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingVertical: 6,
  },
  changeGroupText: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    color: theme.colors.primary,
  },
  saveBtn: {
    marginTop: 8,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#EFE3BF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { fontFamily: fonts.bodyBold, fontSize: 16, color: '#262626' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    maxHeight: '70%',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F2',
  },
  pickerTitle: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 17, color: '#1A1A1A' },
  pickerList: { maxHeight: 360 },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F7F7F8',
  },
  pickerItemLabel: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: '#1A1A1A',
    marginRight: 8,
  },
});
