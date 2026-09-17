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
import { loginSchema, LoginFormData } from '../../utils/validation';
import { CustomInput } from '../../components/common/CustomInput';
import { CustomButton } from '../../components/common/CustomButton';
import { HeaderMotif } from '../../components/common/HeaderMotif';
import { theme } from '../../constants/theme';
import { RootNavigationProp } from '../../navigation/types';
import { authApi } from '../../api/authApi';
import { useAuthStore } from '../../stores/useAuthStore';

export const LoginScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [loading, setLoading] = useState(false);

  const {
    control,
    handleSubmit,
    setValue,
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
          serverMsg || 'Vui lòng kiểm tra API đang chạy rồi thử đăng nhập lại.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <HeaderMotif title="ĐĂNG NHẬP" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Card Container theo phong cách iPhone 17 - 12 */}
          <View style={styles.formCard}>
            <Text style={styles.cardHeader}>Đăng nhập tài khoản</Text>
            <Text style={styles.cardSubtitle}>
              Sử dụng số Căn cước công dân hoặc email đã đăng ký
            </Text>

            {/* Ô Tài khoản */}
            <Controller
              control={control}
              name="account"
              render={({ field: { onChange, onBlur, value } }) => (
                <CustomInput
                  label="Tài khoản"
                  required
                  placeholder="Nhập số CCCD (12 số) hoặc Email"
                  autoCapitalize="none"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  error={errors.account?.message}
                />
              )}
            />

            {/* Ô Mật khẩu */}
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <CustomInput
                  label="Mật khẩu"
                  required
                  isPassword
                  placeholder="Nhập mật khẩu"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  error={errors.password?.message}
                />
              )}
            />

            <View style={styles.forgotPasswordRow}>
              <TouchableOpacity
                onPress={() =>
                  Alert.alert(
                    'Quên mật khẩu',
                    'Vui lòng liên hệ cơ quan thuế hoặc quản trị viên để cấp lại mật khẩu cho số CCCD của bạn.'
                  )
                }
              >
                <Text style={styles.forgotPasswordText}>Quên mật khẩu?</Text>
              </TouchableOpacity>
            </View>

            {/* Nút Đăng nhập */}
            <CustomButton
              title="Đăng nhập"
              onPress={handleSubmit(onSubmit)}
              loading={loading}
              style={styles.loginBtn}
            />

            {/* Chuyển sang màn Đăng ký */}
            <View style={styles.switchAuthRow}>
              <Text style={styles.switchAuthText}>Chưa có tài khoản? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={styles.switchAuthLink}>Đăng ký ngay</Text>
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
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
  },
  formCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    ...theme.shadows.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardHeader: {
    ...theme.typography.titleLarge,
    color: theme.colors.primary,
    marginBottom: 6,
  },
  cardSubtitle: {
    ...theme.typography.bodyMedium,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.lg,
  },
  forgotPasswordRow: {
    alignItems: 'flex-end',
    marginBottom: theme.spacing.lg,
    marginTop: -8,
  },
  forgotPasswordText: {
    ...theme.typography.caption,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  loginBtn: {
    marginTop: theme.spacing.sm,
  },
  switchAuthRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.xl,
  },
  switchAuthText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.textSecondary,
  },
  switchAuthLink: {
    ...theme.typography.bodyMedium,
    color: theme.colors.primary,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
