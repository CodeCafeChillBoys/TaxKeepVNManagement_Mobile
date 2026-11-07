import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
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
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      account: '',
      password: '',
    },
  });

  const handleLanguagePress = useCallback(() => {
    toast.info('Ứng dụng hiện sử dụng tiếng Việt theo chuẩn hồ sơ thuế.', 'Ngôn ngữ hiển thị');
  }, [toast]);

  const handleForgotPasswordPress = useCallback(() => {
    toast.info(
      'Vui lòng liên hệ cơ quan thuế quản lý hoặc bộ phận hỗ trợ để xác minh danh tính và đặt lại mật khẩu.',
      'Hướng dẫn cấp lại mật khẩu'
    );
  }, [toast]);

  const onSubmit = useCallback(
    async (data: LoginFormData) => {
      setLoading(true);
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
          toast.success(`Chào mừng ${profile.fullName} quay trở lại.`, 'Đăng nhập thành công');
          navigation.replace('Home');
        } else {
          toast.success('Chào mừng bạn quay trở lại.', 'Đăng nhập thành công');
          navigation.replace('Home');
        }
      } catch (error: any) {
        if (!isMountedRef.current) return;
        const status = error?.response?.status;
        const serverMsg = error?.response?.data?.message;

        if (status === 401 || status === 400) {
          toast.error(
            sanitizeUiMessage(
              serverMsg,
              'Số căn cước công dân, email hoặc mật khẩu chưa chính xác. Vui lòng kiểm tra lại.'
            ),
            'Thông tin đăng nhập chưa đúng'
          );
        } else {
          const friendly = toFriendlyError(error, {
            fallbackTitle: 'Chưa thể đăng nhập',
            fallbackMessage: 'Kết nối tạm thời gián đoạn. Vui lòng kiểm tra mạng và thử lại.',
          });
          toast.error(friendly.message, friendly.title);
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    },
    [navigation, setAuth, toast]
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <DrumPatternBackdrop variant="full" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.langRow}>
            <TouchableOpacity
              style={styles.langBtn}
              onPress={handleLanguagePress}
              accessibilityRole="button"
              accessibilityLabel="Chọn ngôn ngữ"
            >
              <Text style={styles.langText}>Tiếng Việt</Text>
              <Ionicons name="chevron-down" size={13} color={theme.colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.brandBlock}>
            <Text style={styles.brandTitle}>TaxKeep VN</Text>
            <Text style={styles.brandSubtitle}>Kê khai và giảm trừ gia cảnh</Text>
            <GoldDoubleRule style={styles.brandRule} />
          </View>

          <View style={styles.formBlock}>
            <Text style={styles.fieldLabel}>Số CCCD hoặc email</Text>
            <Controller
              control={control}
              name="account"
              render={({ field: { onChange, onBlur, value } }) => (
                <CustomInput
                  placeholder="079... hoặc ten@email.com"
                  autoCapitalize="none"
                  keyboardType="default"
                  onBlur={onBlur}
                  onChangeText={onChange}
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
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  langRow: {
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 6,
  },
  langBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  langText: {
    ...theme.typography.fieldLabel,
    color: theme.colors.textPrimary,
  },
  brandBlock: {
    alignItems: 'center',
    marginTop: 64,
    gap: 8,
    paddingHorizontal: 20,
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
