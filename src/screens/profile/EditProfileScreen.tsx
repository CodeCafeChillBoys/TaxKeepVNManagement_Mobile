import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { profileApi, UserProfileResponse } from '../../api/profileApi';
import { RootStackParamList, RootNavigationProp } from '../../navigation/types';
import { useAuthStore } from '../../stores/useAuthStore';
import {
  applyEditProfileOcrResult,
  buildEditProfileScanParams,
} from './applyEditProfileOcrResult';

type EditProfileRouteProp = RouteProp<RootStackParamList, 'EditProfile'>;

export const EditProfileScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const route = useRoute<EditProfileRouteProp>();
  const autoFocusTaxId = route.params?.autoFocusTaxId;

  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [initialProfile, setInitialProfile] = useState<UserProfileResponse | null>(null);

  // Form states
  const [fullName, setFullName] = useState<string>('');
  const [citizenId, setCitizenId] = useState<string>('');
  const [dateOfBirth, setDateOfBirth] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [taxIdNumber, setTaxIdNumber] = useState<string>('');
  const [isTaxRegisteredConfirmed, setIsTaxRegisteredConfirmed] = useState<boolean>(false);

  // Validation errors
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    const result = route.params?.ocrResult;
    if (!result) return;
    const plan = applyEditProfileOcrResult(result);
    setFullName(plan.fields.fullName);
    setDateOfBirth(plan.fields.dateOfBirth);
    setAddress(plan.fields.address);
    // Không setCitizenId — CCCD khóa
    navigation.setParams({ ocrResult: undefined });
    Alert.alert(plan.alertTitle, plan.alertMessage);
  }, [route.params?.ocrResult]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const data = await profileApi.getProfile();
      setInitialProfile(data);
      setFullName(data.fullName || '');
      setCitizenId(data.citizenId || '');
      setDateOfBirth(data.dateOfBirth || '');
      setAddress(data.address || '');
      setPhoneNumber(data.phoneNumber || '');
      setTaxIdNumber(data.taxIdNumber || '');
      // Nếu đã có MST trong hồ sơ, mặc định đã xác nhận mở ô điền
      if (data.taxIdNumber && data.taxIdNumber.trim().length > 0) {
        setIsTaxRegisteredConfirmed(true);
      } else {
        setIsTaxRegisteredConfirmed(false);
      }
    } catch (err: any) {
      // Fallback an toàn: không thoát màn hình, lấy từ Auth Store
      const authUser = useAuthStore.getState().user;
      if (authUser) {
        setFullName(authUser.fullName || '');
        setCitizenId(authUser.citizenId || '');
      }
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const errs: { [key: string]: string } = {};

    if (!fullName.trim()) {
      errs.fullName = 'Vui lòng nhập họ và tên.';
    } else if (fullName.trim().length < 2) {
      errs.fullName = 'Họ và tên phải có ít nhất 2 ký tự.';
    }

    if (phoneNumber.trim()) {
      const phoneRegex = /^(0|\+84)[0-9]{9}$/;
      if (!phoneRegex.test(phoneNumber.trim())) {
        errs.phoneNumber = 'Số điện thoại không hợp lệ (gồm 10 số, bắt đầu bằng 0 hoặc +84).';
      }
    }

    if (dateOfBirth.trim()) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(dateOfBirth.trim())) {
        errs.dateOfBirth = 'Ngày sinh phải có định dạng YYYY-MM-DD (Ví dụ: 1995-05-15).';
      }
    }

    const cleanTaxId = taxIdNumber.trim();
    if (cleanTaxId) {
      if (!isTaxRegisteredConfirmed) {
        errs.taxConfirmation =
          'Vui lòng tích xác nhận đã đăng ký mã số thuế với Cơ quan Thuế.';
      } else if (!/^\d{10}$|^\d{12}$/.test(cleanTaxId)) {
        errs.taxIdNumber = 'Mã số thuế chỉ gồm 10 chữ số (MST cũ) hoặc 12 chữ số (số CCCD).';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setSubmitting(true);
      const cleanTaxId = taxIdNumber.trim() || null;
      const cleanPhone = phoneNumber.trim() || null;
      const cleanDob = dateOfBirth.trim() || null;
      const cleanAddr = address.trim() || null;

      const payload = {
        fullName: fullName.trim(),
        phoneNumber: cleanPhone,
        dateOfBirth: cleanDob,
        address: cleanAddr,
        taxIdNumber: cleanTaxId,
        isTaxRegisteredConfirmed: cleanTaxId && cleanTaxId.length === 12 ? isTaxRegisteredConfirmed : null,
      };

      const updated = await profileApi.updateProfile(payload);

      // Đồng bộ thông tin tên vào useAuthStore để Header và HomeScreen phản ánh ngay
      const authUser = useAuthStore.getState().user;
      if (authUser) {
        useAuthStore.setState({
          user: {
            ...authUser,
            fullName: updated.fullName || fullName.trim(),
          },
        });
      }

      if (Platform.OS === 'web') {
        window.alert('Cập nhật hồ sơ cá nhân thành công!');
        navigation.goBack();
      } else {
        Alert.alert('Thành công', 'Cập nhật hồ sơ cá nhân thành công!', [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]);
      }
    } catch (err: any) {
      const respData = err.response?.data;
      const errorMsg =
        respData?.message || 'Đã xảy ra lỗi khi cập nhật hồ sơ. Vui lòng thử lại sau.';
      Alert.alert('Không thể lưu', errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    // Kiểm tra xem có thay đổi nào chưa lưu
    const hasChanges =
      initialProfile &&
      (fullName !== (initialProfile.fullName || '') ||
        phoneNumber !== (initialProfile.phoneNumber || '') ||
        dateOfBirth !== (initialProfile.dateOfBirth || '') ||
        address !== (initialProfile.address || '') ||
        taxIdNumber !== (initialProfile.taxIdNumber || ''));

    if (hasChanges) {
      Alert.alert('Hủy các thay đổi', 'Các thay đổi chưa được lưu sẽ bị mất. Bạn có chắc chắn muốn hủy?', [
        { text: 'Tiếp tục sửa', style: 'cancel' },
        { text: 'Hủy thay đổi', style: 'destructive', onPress: () => navigation.goBack() },
      ]);
    } else {
      navigation.goBack();
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>CHỈNH SỬA HỒ SƠ</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Đang tải thông tin...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isTax12Digits = taxIdNumber.trim().length === 12;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleCancel}
          accessibilityRole="button"
          accessibilityLabel="Hủy"
        >
          <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>CHỈNH SỬA HỒ SƠ</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Nút Quét lại CCCD */}
        <TouchableOpacity
          style={styles.scanCccdBtn}
          onPress={() =>
            navigation.navigate('ScanIdentity', buildEditProfileScanParams(citizenId))
          }
        >
          <Ionicons name="scan" size={20} color={theme.colors.primary} />
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.scanCccdTitle}>Quét lại căn cước công dân</Text>
            <Text style={styles.scanCccdSubtitle}>Cập nhật nhanh thông tin từ giấy tờ</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.formCard}>
          {/* Họ và tên */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Họ và tên <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, errors.fullName && styles.inputError]}
              value={fullName}
              onChangeText={(val) => {
                setFullName(val);
                if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: '' }));
              }}
              placeholder="Nhập họ và tên đầy đủ"
              placeholderTextColor={theme.colors.textPlaceholder}
            />
            {errors.fullName ? <Text style={styles.errorText}>{errors.fullName}</Text> : null}
          </View>

          {/* Số CCCD (Bị khóa 🔒) */}
          <View style={styles.inputGroup}>
            <View style={styles.labelWithLock}>
              <Text style={styles.label}>Số căn cước công dân</Text>
              <Ionicons name="lock-closed" size={14} color={theme.colors.textSecondary} style={{ marginLeft: 6 }} />
            </View>
            <TextInput
              style={[styles.input, styles.inputLocked]}
              value={citizenId}
              editable={false}
              placeholder="Số căn cước công dân"
            />
            <Text style={styles.lockedNote}>
              🔒 Không thể sửa số căn cước vì đã được dùng làm định danh tài khoản.
            </Text>
          </View>

          {/* Ngày sinh */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Ngày sinh</Text>
            <View style={styles.inputWithIcon}>
              <TextInput
                style={[styles.inputInner, errors.dateOfBirth && styles.inputError]}
                value={dateOfBirth}
                onChangeText={(val) => {
                  setDateOfBirth(val);
                  if (errors.dateOfBirth) setErrors((prev) => ({ ...prev, dateOfBirth: '' }));
                }}
                placeholder="YYYY-MM-DD (Ví dụ: 1995-05-15)"
                placeholderTextColor={theme.colors.textPlaceholder}
              />
              <Ionicons name="calendar-outline" size={20} color={theme.colors.textSecondary} style={{ marginRight: 12 }} />
            </View>
            {errors.dateOfBirth ? (
              <Text style={styles.errorText}>{errors.dateOfBirth}</Text>
            ) : (
              <Text style={styles.helperText}>Định dạng ngày: Năm-Tháng-Ngày (YYYY-MM-DD)</Text>
            )}
          </View>

          {/* Địa chỉ */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Địa chỉ liên hệ</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={address}
              onChangeText={setAddress}
              placeholder="Nhập số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành"
              placeholderTextColor={theme.colors.textPlaceholder}
              multiline
              numberOfLines={2}
            />
          </View>

          {/* Số điện thoại */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Số điện thoại</Text>
            <TextInput
              style={[styles.input, errors.phoneNumber && styles.inputError]}
              value={phoneNumber}
              onChangeText={(val) => {
                setPhoneNumber(val);
                if (errors.phoneNumber) setErrors((prev) => ({ ...prev, phoneNumber: '' }));
              }}
              placeholder="Ví dụ: 0901234567"
              placeholderTextColor={theme.colors.textPlaceholder}
              keyboardType="phone-pad"
            />
            {errors.phoneNumber ? <Text style={styles.errorText}>{errors.phoneNumber}</Text> : null}
          </View>

          {/* Mã số thuế (MST) & Checkbox xác nhận: Tích checkbox rồi mới cho điền */}
          <View style={styles.inputGroup}>
            <View style={styles.labelWithLock}>
              <Text style={styles.label}>Mã số thuế cá nhân (MST)</Text>
              {!isTaxRegisteredConfirmed && (
                <Ionicons name="lock-closed" size={13} color={theme.colors.textSecondary} style={{ marginLeft: 6 }} />
              )}
            </View>

            {/* Checkbox bắt buộc: Tích chọn trước rồi mới cho điền */}
            <View style={[styles.taxConfirmationBox, isTaxRegisteredConfirmed && styles.taxConfirmationBoxActive]}>
              <TouchableOpacity
                style={[styles.checkbox, isTaxRegisteredConfirmed && styles.checkboxChecked]}
                onPress={() => {
                  const nextVal = !isTaxRegisteredConfirmed;
                  setIsTaxRegisteredConfirmed(nextVal);
                  if (errors.taxConfirmation) setErrors((prev) => ({ ...prev, taxConfirmation: '' }));
                }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isTaxRegisteredConfirmed }}
                testID="taxConfirmationCheckbox"
              >
                {isTaxRegisteredConfirmed ? <Ionicons name="checkmark" size={16} color="#FFFFFF" /> : null}
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1 }}
                onPress={() => {
                  const nextVal = !isTaxRegisteredConfirmed;
                  setIsTaxRegisteredConfirmed(nextVal);
                  if (errors.taxConfirmation) setErrors((prev) => ({ ...prev, taxConfirmation: '' }));
                }}
                testID="taxConfirmationLabel"
              >
                <Text style={styles.checkboxLabel}>
                  Tôi xác nhận đã đăng ký mã số thuế trên cơ quan thuế <Text style={styles.required}>*</Text>
                </Text>
              </TouchableOpacity>
            </View>

            {errors.taxConfirmation ? (
              <Text style={styles.errorText} testID="taxConfirmationError">
                {errors.taxConfirmation}
              </Text>
            ) : null}

            {/* Ô nhập MST: Chỉ cho phép điền khi đã tích checkbox */}
            <TouchableOpacity
              activeOpacity={isTaxRegisteredConfirmed ? 1 : 0.8}
              onPress={() => {
                if (!isTaxRegisteredConfirmed) {
                  setErrors((prev) => ({
                    ...prev,
                    taxConfirmation: 'Vui lòng tích chọn ô xác nhận ở trên để mở khóa ô điền Mã số thuế.',
                  }));
                }
              }}
              style={{ marginTop: 8 }}
            >
              <TextInput
                style={[
                  styles.input,
                  !isTaxRegisteredConfirmed && styles.inputLocked,
                  errors.taxIdNumber && styles.inputError,
                ]}
                value={taxIdNumber}
                onChangeText={(val) => {
                  setTaxIdNumber(val);
                  if (errors.taxIdNumber) setErrors((prev) => ({ ...prev, taxIdNumber: '' }));
                }}
                placeholder={
                  isTaxRegisteredConfirmed
                    ? "Nhập 10 chữ số (cũ) hoặc 12 số CCCD"
                    : "🔒 Tích xác nhận ở trên rồi mới cho điền MST"
                }
                placeholderTextColor={
                  isTaxRegisteredConfirmed
                    ? theme.colors.textPlaceholder
                    : theme.colors.textSecondary
                }
                keyboardType="number-pad"
                editable={isTaxRegisteredConfirmed}
                autoFocus={autoFocusTaxId && isTaxRegisteredConfirmed}
                testID="taxIdInput"
              />
            </TouchableOpacity>
            {errors.taxIdNumber ? <Text style={styles.errorText}>{errors.taxIdNumber}</Text> : null}

            {!isTaxRegisteredConfirmed ? (
              <Text style={styles.lockedNote}>
                🔒 Ô nhập mã số thuế đang khóa. Vui lòng tích ô xác nhận ở trên thì mới được điền.
              </Text>
            ) : (
              <Text style={styles.taxInfoNote}>
                💡 Theo Luật Quản lý Thuế mới, số CCCD (12 chữ số) hoặc MST cũ (10 chữ số) hợp lệ sau khi bạn đã đăng ký với Cơ quan Thuế.
              </Text>
            )}
          </View>
        </View>

        {/* Cặp nút hành động: Hủy & Lưu thay đổi */}
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={handleCancel}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel="Hủy thay đổi"
          >
            <Text style={styles.cancelBtnText}>Hủy</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.saveBtn, submitting && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel="Lưu thay đổi"
            testID="saveProfileBtn"
          >
            {submitting ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.saveBtnText}>Đang lưu...</Text>
              </View>
            ) : (
              <Text style={styles.saveBtnText}>Lưu thay đổi</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...theme.typography.titleMedium,
    fontWeight: '700',
    color: theme.colors.primaryDark,
    letterSpacing: 0.5,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.textSecondary,
    marginTop: 12,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  scanCccdBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: theme.colors.borderFocus,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  scanCccdTitle: {
    ...theme.typography.bodyMedium,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  scanCccdSubtitle: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  formCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    ...theme.typography.bodyMedium,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 6,
  },
  labelWithLock: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  required: {
    color: theme.colors.error,
    fontWeight: 'bold',
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    backgroundColor: '#FFFFFF',
  },
  inputInner: {
    flex: 1,
    height: 48,
    paddingHorizontal: 12,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  inputLocked: {
    backgroundColor: '#F5F5F5',
    color: theme.colors.textSecondary,
    borderColor: theme.colors.border,
  },
  inputError: {
    borderColor: theme.colors.error,
  },
  textArea: {
    height: 70,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  lockedNote: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginTop: 4,
    fontStyle: 'italic',
  },
  helperText: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  errorText: {
    ...theme.typography.caption,
    color: theme.colors.error,
    marginTop: 4,
  },
  taxConfirmationBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FBF8F4',
    borderWidth: 1,
    borderColor: '#E8DED1',
    borderRadius: theme.borderRadius.sm,
    padding: 10,
    marginTop: 10,
  },
  taxConfirmationBoxActive: {
    backgroundColor: '#FAF5EE',
    borderColor: theme.colors.primary,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: theme.colors.borderFocus,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  checkboxLabel: {
    ...theme.typography.bodySmall,
    color: theme.colors.textPrimary,
    lineHeight: 18,
  },
  taxInfoNote: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginTop: 6,
    lineHeight: 16,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    ...theme.typography.bodyLarge,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  saveBtn: {
    flex: 2,
    height: 48,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.button,
  },
  saveBtnDisabled: {
    opacity: 0.7,
  },
  saveBtnText: {
    ...theme.typography.bodyLarge,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
