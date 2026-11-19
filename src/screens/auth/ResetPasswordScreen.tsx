import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { HeaderMotif } from '../../components/common/HeaderMotif';
import { CustomInput } from '../../components/common/CustomInput';
import { CustomButton } from '../../components/common/CustomButton';
import { PasswordStrengthBar } from '../../components/common/PasswordStrengthBar';
import { useToast } from '../../components/ui/Toast';
import { theme } from '../../constants/theme';
import { RootNavigationProp, RootStackParamList } from '../../navigation/types';
import { authApi } from '../../api/authApi';

type TokenState = 'checking' | 'valid' | 'invalid';

export const ResetPasswordScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'ResetPassword'>>();
  const { toast } = useToast();

  const [token, setToken] = useState(route.params?.token || '');
  const [tokenState, setTokenState] = useState<TokenState>('checking');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [errors, setErrors] = useState<{
    token?: string;
    newPassword?: string;
    confirmNewPassword?: string;
  }>({});
  const [submitting, setSubmitting] = useState(false);

  const checkToken = useCallback(async (rawToken: string) => {
    const clean = rawToken.trim();
    if (!clean) {
      setTokenState('invalid');
      return;
    }
    setTokenState('checking');
    try {
      const res = await authApi.validateResetToken(clean);
      if (res?.success && res?.data?.valid !== false) {
        setTokenState('valid');
      } else {
        setTokenState('invalid');
      }
    } catch {
      setTokenState('invalid');
    }
  }, []);

  useEffect(() => {
    let urlToken = route.params?.token || '';
    if (!urlToken && Platform.OS === 'web' && typeof window !== 'undefined') {
      urlToken = new URLSearchParams(window.location.search).get('token') || '';
    }
    if (urlToken) {
      setToken(urlToken);
      void checkToken(urlToken);
    } else {
      setTokenState('invalid');
    }
  }, [checkToken, route.params?.token]);

  const handleSubmit = useCallback(async () => {
    const nextErrors: {
      newPassword?: string;
      confirmNewPassword?: string;
    } = {};

    if (!newPassword || newPassword.length < 8) {
      nextErrors.newPassword = 'Mật khẩu mới phải có tối thiểu 8 ký tự.';
    }
    if (!confirmNewPassword) {
      nextErrors.confirmNewPassword = 'Vui lòng xác nhận mật khẩu mới.';
    } else if (newPassword !== confirmNewPassword) {
      nextErrors.confirmNewPassword = 'Mật khẩu xác nhận không khớp.';
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const res = await authApi.resetPassword({
        token,
        newPassword,
        confirmNewPassword,
      });
      toast.success(
        res?.message || 'Đặt lại mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới.',
        'Thành công'
      );
      navigation.replace('Login');
    } catch (error: any) {
      const code = String(
        error?.response?.data?.errors?.errorCode ||
          error?.response?.data?.errorCode ||
          ''
      ).toUpperCase();
      const msg = error?.response?.data?.message;

      if (code === 'TOKEN_EXPIRED' || code === 'INVALID_TOKEN' || code === 'INVALID_OR_EXPIRED_TOKEN') {
        setTokenState('invalid');
      } else if (code === 'SAME_PASSWORD') {
        setErrors({
          newPassword: msg || 'Mật khẩu mới không được trùng với mật khẩu hiện tại.',
        });
      } else {
        toast.error(
          msg || 'Không thể đặt lại mật khẩu. Vui lòng thử lại.',
          'Đặt lại mật khẩu thất bại'
        );
      }
    } finally {
      setSubmitting(false);
    }
  }, [confirmNewPassword, navigation, newPassword, toast, token]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <HeaderMotif
        title="ĐẶT LẠI MẬT KHẨU"
        onBack={() => navigation.navigate('Login')}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            {tokenState === 'checking' ? (
              <View style={styles.centerBlock}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.title}>Đang kiểm tra liên kết...</Text>
                <Text style={styles.subtitle}>
                  Vui lòng đợi trong giây lát khi hệ thống xác thực yêu cầu đặt lại mật khẩu.
                </Text>
              </View>
            ) : tokenState === 'invalid' ? (
              <View style={styles.centerBlock}>
                <View style={[styles.iconCircle, styles.iconError]}>
                  <Ionicons name="alert-circle-outline" size={44} color={theme.colors.error} />
                </View>
                <Text style={styles.title}>
                  Liên kết đặt lại mật khẩu đã hết hạn hoặc không hợp lệ
                </Text>
                <Text style={styles.subtitle}>
                  Liên kết đặt lại mật khẩu chỉ có hiệu lực trong vòng 15 phút và chỉ sử dụng được một lần.
                </Text>
                <CustomButton
                  title="Yêu cầu liên kết mới"
                  onPress={() => navigation.replace('ForgotPassword')}
                  style={styles.fullBtn}
                />
                <TouchableOpacity
                  style={styles.backLink}
                  onPress={() => navigation.navigate('Login')}
                >
                  <Text style={styles.backLinkText}>Quay lại Đăng nhập</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.formWrap}>
                <Text style={styles.title}>Thiết lập mật khẩu mới</Text>
                <Text style={styles.subtitle}>
                  Vui lòng nhập mật khẩu mới tối thiểu 8 ký tự cho tài khoản của bạn.
                </Text>

                <CustomInput
                  label="Mật khẩu mới"
                  required
                  isPassword
                  placeholder="Tối thiểu 8 ký tự"
                  value={newPassword}
                  onChangeText={(val) => {
                    setNewPassword(val);
                    if (errors.newPassword) setErrors((p) => ({ ...p, newPassword: undefined }));
                  }}
                  error={errors.newPassword}
                />
                <PasswordStrengthBar passwordText={newPassword} />

                <CustomInput
                  label="Xác nhận mật khẩu mới"
                  required
                  isPassword
                  placeholder="Nhập lại mật khẩu mới"
                  value={confirmNewPassword}
                  onChangeText={(val) => {
                    setConfirmNewPassword(val);
                    if (errors.confirmNewPassword) {
                      setErrors((p) => ({ ...p, confirmNewPassword: undefined }));
                    }
                  }}
                  error={errors.confirmNewPassword}
                />

                <CustomButton
                  title="Đặt lại mật khẩu"
                  onPress={handleSubmit}
                  loading={submitting}
                  style={styles.submitBtn}
                />
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  centerBlock: {
    alignItems: 'center',
  },
  formWrap: {
    width: '100%',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  iconError: {
    backgroundColor: theme.colors.errorBackground,
  },
  title: {
    ...theme.typography.titleMedium,
    color: theme.colors.primaryDark,
    textAlign: 'center',
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    ...theme.typography.bodyMedium,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 20,
  },
  fullBtn: {
    width: '100%',
  },
  submitBtn: {
    marginTop: 8,
  },
  backLink: {
    marginTop: 18,
    paddingVertical: 8,
  },
  backLinkText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.primary,
    fontWeight: '600',
  },
});
