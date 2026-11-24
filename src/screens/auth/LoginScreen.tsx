import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, LoginFormData } from '../../utils/validation';
import { CustomInput } from '../../components/common/CustomInput';
import { CustomButton } from '../../components/common/CustomButton';
import { DrumPatternBackdrop } from '../../components/brand/DrumPatternBackdrop';
import { GoldDoubleRule } from '../../components/brand/GoldDoubleRule';
import { useToast } from '../../components/ui/Toast';
import { theme } from '../../constants/theme';
import { RootNavigationProp } from '../../navigation/types';
import { authApi } from '../../api/authApi';
import { useAuthStore } from '../../stores/useAuthStore';
import { sanitizeUiMessage, toFriendlyError } from '../../utils/friendlyError';

export const LoginScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const setAuth = useAuthStore((state) => state.setAuth);
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [emailNotVerifiedMsg, setEmailNotVerifiedMsg] = useState<string | null>(null);
  const [resendEmail, setResendEmail] = useState('');
  const [resendingEmail, setResendingEmail] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      account: '',
      password: '',
    },
  });

  const handleForgotPasswordPress = useCallback(() => {
    navigation.navigate('ForgotPassword');
  }, [navigation]);

  const handleResendVerification = useCallback(async () => {
    const cleanEmail = resendEmail.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      toast.warning('Vui lòng nhập địa chỉ email đã đăng ký để gửi lại liên kết kích hoạt.', 'Thiếu email');
      return;
    }
    setResendingEmail(true);
    try {
      const res = await authApi.resendVerification(cleanEmail);
      toast.success(
        res?.message || 'Đã gửi lại email kích hoạt. Vui lòng kiểm tra hộp thư của bạn.',
        'Đã gửi email kích hoạt'
      );
      setEmailNotVerifiedMsg(null);
    } catch (error: any) {
      const msg =
        error?.response?.data?.message ||
        'Nếu email tồn tại và chưa được xác minh, chúng tôi đã gửi lại email xác minh.';
      toast.info(msg, 'Thông báo');
    } finally {
      setResendingEmail(false);
    }
  }, [resendEmail, toast]);

  const onSubmit = useCallback(
    async (data: LoginFormData) => {
      setLoading(true);
      setEmailNotVerifiedMsg(null);
      try {
        const response = await authApi.login(data);
        if (!isMountedRef.current) return;

        if (response && response.data) {
          const rawData = response.data;
          const jwt = rawData.token || rawData.accessToken || '';
          const profile = rawData.user || {
            id: rawData.userId || 'temp-id',
            citizenId: rawData.citizenId || data.account,
            fullName: rawData.fullName || 'Người nộp thuế',
            email: rawData.email || `${data.account}@taxkeep.vn`,
            role: rawData.userRole,
          };

          await setAuth(jwt, profile, rawData.refreshToken);
          toast.success(`Chào mừng ${profile.fullName}!`, 'Đăng nhập thành công');
          navigation.replace('Home');
        } else {
          toast.success('Đăng nhập hệ thống thành công.', 'Đăng nhập thành công');
          navigation.replace('Home');
        }
      } catch (error: any) {
        if (!isMountedRef.current) return;
        const status = error?.response?.status;
        const responseData = error?.response?.data;
        const errorCode = String(
          responseData?.errors?.errorCode || responseData?.errorCode || ''
        ).toUpperCase();
        const serverMsg = responseData?.message;

        if (errorCode === 'EMAIL_NOT_VERIFIED') {
          const msg =
            serverMsg ||
            'Tài khoản chưa được xác minh email. Vui lòng kiểm tra hộp thư và nhấn vào liên kết xác minh.';
          setEmailNotVerifiedMsg(msg);
          toast.warning(msg, 'Chưa xác minh email');
        } else if (errorCode === 'ACCOUNT_SUSPENDED') {
          toast.error(
            'Tài khoản đang bị tạm khóa. Vui lòng liên hệ hỗ trợ.',
            'Tài khoản bị khóa'
          );
        } else if (errorCode === 'USER_NOT_ACTIVE') {
          toast.error(
            'Tài khoản chưa ở trạng thái hoạt động.',
            'Tài khoản chưa kích hoạt'
          );
        } else if (errorCode === 'INVALID_CREDENTIALS' || status === 401) {
          toast.error('Số CCCD hoặc mật khẩu không đúng.', 'Đăng nhập thất bại');
        } else if (status === 400) {
          const fieldErrors = responseData?.errors;
          if (fieldErrors && typeof fieldErrors === 'object') {
            if (Array.isArray(fieldErrors.CitizenId) || Array.isArray(fieldErrors.citizenId)) {
              const msg = fieldErrors.CitizenId?.[0] || fieldErrors.citizenId?.[0];
              setError('account', {
                type: 'server',
                message: sanitizeUiMessage(msg, 'Số CCCD không hợp lệ.'),
              });
            }
            if (Array.isArray(fieldErrors.Password) || Array.isArray(fieldErrors.password)) {
              const msg = fieldErrors.Password?.[0] || fieldErrors.password?.[0];
              setError('password', {
                type: 'server',
                message: sanitizeUiMessage(msg, 'Mật khẩu không hợp lệ.'),
              });
            }
          }
          toast.error(
            sanitizeUiMessage(serverMsg, 'Vui lòng kiểm tra lại số CCCD và mật khẩu.'),
            'Thông tin chưa hợp lệ'
          );
        } else if (status === 429) {
          toast.warning(
            'Thao tác quá nhanh. Vui lòng đợi ít phút rồi thử lại.',
            'Quá nhiều yêu cầu'
          );
        } else {
          const friendly = toFriendlyError(error, {
            fallbackTitle: 'Đăng nhập thất bại',
            fallbackMessage: 'Không thể kết nối máy chủ. Vui lòng kiểm tra mạng.',
          });
          toast.error(friendly.message, friendly.title);
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    },
    [navigation, setAuth, setError, toast]
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <DrumPatternBackdrop variant="soft" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brandBlock}>
            <Image
              source={require('../../../assets/icon.png')}
              style={styles.brandLogo}
              resizeMode="contain"
            />
            <Text style={styles.brandTitle}>TaxKeep VN</Text>
            <Text style={styles.brandSubtitle}>Kê khai và giảm trừ gia cảnh</Text>
            <GoldDoubleRule style={styles.brandRule} />
          </View>

          <View style={styles.formBlock}>
            <Text style={styles.fieldLabel}>Số căn cước công dân</Text>
            <Controller
              control={control}
              name="account"
              render={({ field: { onChange, onBlur, value } }) => (
                <CustomInput
                  placeholder="Nhập 12 chữ số CCCD"
                  autoCapitalize="none"
                  keyboardType="numeric"
                  maxLength={12}
                  onBlur={onBlur}
                  onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, 12))}
                  value={value}
                  error={errors.account?.message}
                  containerStyle={styles.inputGap}
                  style={styles.fieldInput}
                />
              )}
            />

            <View style={styles.passwordLabelRow}>
              <Text style={styles.fieldLabel}>Mật khẩu</Text>
              <TouchableOpacity onPress={handleForgotPasswordPress}>
                <Text style={styles.forgotText}>Quên mật khẩu?</Text>
              </TouchableOpacity>
            </View>
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <CustomInput
                  placeholder="Nhập mật khẩu"
                  isPassword
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  error={errors.password?.message}
                  containerStyle={styles.inputGap}
                  style={styles.fieldInput}
                />
              )}
            />

            <CustomButton
              title="Đăng nhập"
              onPress={handleSubmit(onSubmit)}
              loading={loading}
              style={styles.loginBtn}
              textStyle={styles.loginBtnText}
            />

            {emailNotVerifiedMsg ? (
              <View
                style={{
                  marginTop: 16,
                  padding: 14,
                  borderRadius: 10,
                  backgroundColor: theme.colors.warningBackground,
                  borderWidth: 1,
                  borderColor: theme.colors.warning,
                }}
              >
                <Text
                  style={{
                    ...theme.typography.bodySmall,
                    color: theme.colors.textPrimary,
                    fontWeight: '600',
                    marginBottom: 10,
                    lineHeight: 19,
                  }}
                >
                  {emailNotVerifiedMsg}
                </Text>
                <CustomInput
                  placeholder="Nhập email đã đăng ký để nhận lại liên kết"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={resendEmail}
                  onChangeText={setResendEmail}
                  containerStyle={{ marginBottom: 10 }}
                />
                <CustomButton
                  title="Gửi lại email kích hoạt"
                  variant="outline"
                  onPress={handleResendVerification}
                  loading={resendingEmail}
                />
              </View>
            ) : null}

            <View style={styles.switchAuthRow}>
              <Text style={styles.switchAuthText}>Chưa có tài khoản? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={styles.switchAuthLink}>Đăng ký</Text>
              </TouchableOpacity>
            </View>
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
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  brandBlock: {
    alignItems: 'center',
    marginTop: 44,
    gap: 8,
    paddingHorizontal: 20,
  },
  brandLogo: {
    width: 84,
    height: 84,
    marginBottom: 4,
  },
  brandTitle: {
    ...theme.typography.appTitle,
    color: theme.colors.primaryDark,
    textAlign: 'center',
  },
  brandSubtitle: {
    ...theme.typography.body,
    fontSize: 13,
    lineHeight: 20,
    color: '#5A4A22',
    textAlign: 'center',
  },
  brandRule: {
    width: 56,
    marginTop: 6,
  },
  formBlock: {
    paddingHorizontal: 20,
    paddingTop: 40,
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
  },
  fieldLabel: {
    ...theme.typography.fieldLabel,
    color: theme.colors.textPrimary,
    flexShrink: 1,
  },
  fieldInput: {
    ...theme.typography.inputText,
  },
  inputGap: {
    marginTop: 6,
    marginBottom: 16,
  },
  passwordLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  forgotText: {
    ...theme.typography.fieldLabel,
    color: theme.colors.primary,
  },
  loginBtn: {
    marginTop: 4,
    minHeight: 52,
    borderRadius: 10,
  },
  loginBtnText: {
    ...theme.typography.buttonText,
  },
  switchAuthRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 24,
  },
  switchAuthText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
  },
  switchAuthLink: {
    ...theme.typography.buttonText,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.primary,
  },
});
