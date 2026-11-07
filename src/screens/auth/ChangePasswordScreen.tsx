import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { HomeHeaderButton } from '../../components/navigation/HomeHeaderButton';
import { authApi } from '../../api/authApi';
import { PasswordStrengthBar } from '../../components/common/PasswordStrengthBar';
import { useToast } from '../../components/ui/Toast';
import { RootNavigationProp } from '../../navigation/types';
import { sanitizeUiMessage, toFriendlyError } from '../../utils/friendlyError';

export const ChangePasswordScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const { toast } = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const validate = useCallback((): boolean => {
    const errs: { [key: string]: string } = {};

    if (!currentPassword) {
      errs.currentPassword = 'Vui lòng nhập mật khẩu hiện tại.';
    }

    if (!newPassword) {
      errs.newPassword = 'Vui lòng nhập mật khẩu mới.';
    } else if (newPassword.length < 8) {
      errs.newPassword = 'Mật khẩu mới phải có ít nhất 8 ký tự.';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      errs.newPassword = 'Mật khẩu phải gồm ít nhất 1 chữ hoa, 1 chữ thường và 1 chữ số.';
    } else if (currentPassword && newPassword === currentPassword) {
      errs.newPassword = 'Mật khẩu mới không được trùng với mật khẩu hiện tại.';
    }

    if (!confirmNewPassword) {
      errs.confirmNewPassword = 'Vui lòng xác nhận lại mật khẩu mới.';
    } else if (newPassword && confirmNewPassword !== newPassword) {
      errs.confirmNewPassword = 'Mật khẩu xác nhận không khớp.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [confirmNewPassword, currentPassword, newPassword]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) {
      return;
    }

    try {
      setSubmitting(true);
      const res = await authApi.changePassword({
        currentPassword: currentPassword.trim(),
        newPassword: newPassword.trim(),
        confirmNewPassword: confirmNewPassword.trim(),
      });
      if (!isMountedRef.current) return;

      const successMsg = sanitizeUiMessage(
        res.message,
        'Mật khẩu mới đã được áp dụng. Các thiết bị khác đã được đăng xuất an toàn.'
      );
      toast.success(successMsg, 'Đổi mật khẩu thành công');
      navigation.goBack();
    } catch (err: any) {
      if (!isMountedRef.current) return;
      const resp = err?.response?.data;
      const errorCode = resp?.errorCode;
      const msg = String(resp?.message || '');

      if (
        errorCode === 'WRONG_CURRENT_PASSWORD' ||
        errorCode === 'INCORRECT_CURRENT_PASSWORD' ||
        msg.includes('hiện tại')
      ) {
        setErrors((prev) => ({ ...prev, currentPassword: 'Mật khẩu hiện tại không chính xác.' }));
      } else if (
        errorCode === 'SAME_PASSWORD' ||
        errorCode === 'PASSWORD_CANNOT_BE_IDENTICAL' ||
        msg.includes('trùng')
      ) {
        setErrors((prev) => ({
          ...prev,
          newPassword: 'Mật khẩu mới không được trùng với mật khẩu hiện tại.',
        }));
      } else if (errorCode === 'NEW_PASSWORDS_DO_NOT_MATCH' || msg.includes('khớp')) {
        setErrors((prev) => ({ ...prev, confirmNewPassword: 'Mật khẩu xác nhận không khớp.' }));
      } else {
        const friendly = toFriendlyError(err, {
          fallbackTitle: 'Chưa đổi được mật khẩu',
          fallbackMessage: 'Không thể cập nhật mật khẩu lúc này. Vui lòng kiểm tra lại và thử lại.',
        });
        toast.error(friendly.message, friendly.title);
      }
    } finally {
      if (isMountedRef.current) {
        setSubmitting(false);
      }
    }
  }, [confirmNewPassword, currentPassword, navigation, newPassword, toast, validate]);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1} testID="changePasswordHeaderTitle">
          ĐỔI MẬT KHẨU
        </Text>
        <View style={styles.homeSlot}>
          <HomeHeaderButton />
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.contentWrap}>
            {/* Banner bảo mật */}
            <View style={styles.securityCard}>
              <View style={styles.securityIconCircle}>
                <Ionicons name="shield-checkmark" size={24} color={theme.colors.primary} />
              </View>
              <View style={styles.securityTextCol}>
                <Text style={styles.securityTitle}>Bảo vệ tài khoản an toàn</Text>
                <Text style={styles.securitySubtitle}>
                  Mật khẩu mạnh cần tối thiểu 8 ký tự, kết hợp chữ hoa, chữ thường và chữ số để ngăn ngừa truy cập trái phép.
                </Text>
              </View>
            </View>

            {/* Card biểu mẫu đổi mật khẩu */}
            <View style={styles.formCard}>
              {/* Mật khẩu hiện tại */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  Mật khẩu hiện tại <Text style={styles.required}>*</Text>
                </Text>
                <View style={[styles.inputRow, errors.currentPassword && styles.inputError]}>
                  <TextInput
                    style={styles.inputField}
                    value={currentPassword}
                    onChangeText={(val) => {
                      setCurrentPassword(val);
                      if (errors.currentPassword) {
                        setErrors((prev) => ({ ...prev, currentPassword: '' }));
                      }
                    }}
                    placeholderTextColor={theme.colors.textPlaceholder}
                    secureTextEntry={!showCurrent}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={() => setShowCurrent(!showCurrent)}
                    accessibilityRole="button"
                    accessibilityLabel={showCurrent ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    <Ionicons
                      name={showCurrent ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={theme.colors.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
                {errors.currentPassword ? (
                  <Text style={styles.errorText}>{errors.currentPassword}</Text>
                ) : null}
              </View>

              {/* Mật khẩu mới */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  Mật khẩu mới <Text style={styles.required}>*</Text>
                </Text>
                <View style={[styles.inputRow, errors.newPassword && styles.inputError]}>
                  <TextInput
                    style={styles.inputField}
                    value={newPassword}
                    onChangeText={(val) => {
                      setNewPassword(val);
                      if (errors.newPassword) {
                        setErrors((prev) => ({ ...prev, newPassword: '' }));
                      }
                    }}
                    placeholder="Tối thiểu 8 ký tự, có chữ hoa, thường, số"
                    placeholderTextColor={theme.colors.textPlaceholder}
                    secureTextEntry={!showNew}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={() => setShowNew(!showNew)}
                    accessibilityRole="button"
                    accessibilityLabel={showNew ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    <Ionicons
                      name={showNew ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={theme.colors.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
                {errors.newPassword ? (
                  <Text style={styles.errorText}>{errors.newPassword}</Text>
                ) : null}

                {/* Thanh đo độ mạnh mật khẩu realtime */}
                {newPassword.length > 0 && (
                  <View style={styles.strengthWrap}>
                    <PasswordStrengthBar passwordText={newPassword} />
                  </View>
                )}
              </View>

              {/* Xác nhận mật khẩu mới */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  Xác nhận mật khẩu mới <Text style={styles.required}>*</Text>
                </Text>
                <View style={[styles.inputRow, errors.confirmNewPassword && styles.inputError]}>
                  <TextInput
                    style={styles.inputField}
                    value={confirmNewPassword}
                    onChangeText={(val) => {
                      setConfirmNewPassword(val);
                      if (errors.confirmNewPassword) {
                        setErrors((prev) => ({ ...prev, confirmNewPassword: '' }));
                      }
                    }}
                    placeholderTextColor={theme.colors.textPlaceholder}
                    secureTextEntry={!showConfirm}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={() => setShowConfirm(!showConfirm)}
                    accessibilityRole="button"
                    accessibilityLabel={showConfirm ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    <Ionicons
                      name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={theme.colors.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
                {errors.confirmNewPassword ? (
                  <Text style={styles.errorText}>{errors.confirmNewPassword}</Text>
                ) : null}
              </View>
            </View>

            {/* Lời nhắc an toàn */}
            <View style={styles.tipBox}>
              <Ionicons name="information-circle-outline" size={20} color={theme.colors.info} />
              <Text style={styles.tipText}>
                Sau khi đổi mật khẩu thành công, bạn sẽ nhận được thông báo xác nhận và các lần đăng nhập trên thiết bị khác sẽ tự động kết thúc.
              </Text>
            </View>

            {/* Nút hành động */}
            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Đổi mật khẩu"
              testID="submitChangePasswordBtn"
            >
              {submitting ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color="#FFFFFF" style={styles.spinnerGap} />
                  <Text style={styles.submitBtnText}>Đang cập nhật...</Text>
                </View>
              ) : (
                <Text style={styles.submitBtnText}>Xác nhận đổi mật khẩu</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => navigation.goBack()}
              disabled={submitting}
            >
              <Text style={styles.cancelBtnText}>Quay lại</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  homeSlot: { width: 40, alignItems: 'flex-end', justifyContent: 'center' },
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  keyboardView: {
    flex: 1,
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
  backBtn: {
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
    flex: 1,
    textAlign: 'center',
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    paddingBottom: 48,
  },
  contentWrap: {
    width: '100%',
    maxWidth: 540,
    alignSelf: 'center',
  },
  securityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9E6',
    borderWidth: 1,
    borderColor: theme.colors.goldLight,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  securityIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF0C2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  securityTextCol: {
    flex: 1,
  },
  securityTitle: {
    ...theme.typography.titleMedium,
    fontSize: 15,
    fontWeight: '700',
    color: '#7A5B00',
    marginBottom: 4,
  },
  securitySubtitle: {
    ...theme.typography.caption,
    color: '#8A6800',
    lineHeight: 18,
  },
  formCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    ...theme.shadows.card,
    marginBottom: theme.spacing.md,
  },
  inputGroup: {
    marginBottom: theme.spacing.md,
  },
  label: {
    ...theme.typography.bodyMedium,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 6,
  },
  required: {
    color: theme.colors.error,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    minHeight: 46,
  },
  inputField: {
    flex: 1,
    fontSize: 15,
    color: theme.colors.textPrimary,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
  },
  eyeBtn: {
    padding: 6,
  },
  inputError: {
    borderColor: theme.colors.error,
    backgroundColor: '#FFF5F5',
  },
  errorText: {
    ...theme.typography.caption,
    color: theme.colors.error,
    marginTop: 4,
  },
  strengthWrap: {
    marginTop: 10,
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    gap: 8,
  },
  tipText: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  submitBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.button,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spinnerGap: {
    marginRight: 8,
  },
  cancelBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelBtnText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
});
