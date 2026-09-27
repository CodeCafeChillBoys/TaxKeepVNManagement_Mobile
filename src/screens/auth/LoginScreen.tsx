import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
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
import { theme } from '../../constants/theme';
import { RootNavigationProp } from '../../navigation/types';
import { authApi } from '../../api/authApi';
import { useAuthStore } from '../../stores/useAuthStore';
import { getLocalApiBaseUrl } from '../../constants/config';

export const LoginScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [loading, setLoading] = useState(false);

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

  const onSubmit = async (data: LoginFormData) => {
    setLoading(true);
    try {
      if (__DEV__) {
        console.log('[Login] API =', getLocalApiBaseUrl());
      }
      const response = await authApi.login(data);

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
        navigation.replace('Home');
      } else {
        Alert.alert('Đăng nhập thành công', 'Chào mừng bạn quay trở lại!');
        navigation.replace('Home');
      }
    } catch (error: any) {
      const status = error?.response?.status;
      const serverMsg = error?.response?.data?.message;

      if (status === 401 || status === 400) {
        Alert.alert('Đăng nhập thất bại', serverMsg || 'Số CCCD hoặc mật khẩu không chính xác.');
      } else if (status === 500) {
        Alert.alert('Lỗi hệ thống', 'Đã xảy ra lỗi trên máy chủ. Vui lòng thử lại sau.');
      } else {
        Alert.alert(
          'Không kết nối được máy chủ',
          `${serverMsg || 'Vui lòng kiểm tra API đang chạy rồi thử đăng nhập lại.'}\n\nAPI: ${getLocalApiBaseUrl()}`
        );
      }
    } finally {
      setLoading(false);
    }
  };

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
              onPress={() =>
                Alert.alert('Ngôn ngữ', 'Hiện tại ứng dụng dùng tiếng Việt.')
              }
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
                  placeholder="Nhập số CCCD (12 số) hoặc Email"
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
              <TouchableOpacity
                onPress={() =>
                  Alert.alert(
                    'Quên mật khẩu',
                    'Vui lòng liên hệ cơ quan thuế hoặc quản trị viên để cấp lại mật khẩu cho số CCCD của bạn.'
                  )
                }
              >
                <Text style={styles.forgotText}>Quên mật khẩu?</Text>
              </TouchableOpacity>
            </View>
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <CustomInput
                  isPassword
                  placeholder="Nhập mật khẩu"
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
  },
  langText: {
    ...theme.typography.fieldLabel,
    color: theme.colors.textPrimary,
  },
  brandBlock: {
    alignItems: 'center',
    marginTop: 84,
    gap: 8,
    paddingHorizontal: 20,
  },
  brandTitle: {
    ...theme.typography.appTitle,
    color: theme.colors.primaryDark,
  },
  brandSubtitle: {
    ...theme.typography.body,
    fontSize: 13,
    lineHeight: 20,
    color: '#5A4A22',
  },
  brandRule: {
    width: 56,
    marginTop: 6,
  },
  formBlock: {
    paddingHorizontal: 20,
    paddingTop: 48,
  },
  fieldLabel: {
    ...theme.typography.fieldLabel,
    color: theme.colors.textPrimary,
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
