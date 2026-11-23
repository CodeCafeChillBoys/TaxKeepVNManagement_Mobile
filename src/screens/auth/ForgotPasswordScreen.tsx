import React, { useCallback, useState } from 'react';
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
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { HeaderMotif } from '../../components/common/HeaderMotif';
import { CustomInput } from '../../components/common/CustomInput';
import { CustomButton } from '../../components/common/CustomButton';
import { theme } from '../../constants/theme';
import { RootNavigationProp, RootStackParamList } from '../../navigation/types';
import { authApi } from '../../api/authApi';

export const ForgotPasswordScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'ForgotPassword'>>();

  const [email, setEmail] = useState(route.params?.email || '');
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = useCallback(async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setEmailError('Vui lòng nhập địa chỉ email.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setEmailError('Địa chỉ email không đúng định dạng.');
      return;
    }

    setEmailError('');
    setLoading(true);

    try {
      await authApi.forgotPassword(cleanEmail);
      setSubmitted(true);
    } catch (error: any) {
      const msg =
        error?.response?.data?.message ||
        'Không thể gửi yêu cầu lúc này. Vui lòng kiểm tra kết nối và thử lại.';
      setEmailError(msg);
    } finally {
      setLoading(false);
    }
  }, [email]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <HeaderMotif
        title="QUÊN MẬT KHẨU"
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
            <View style={styles.iconCircle}>
              <Ionicons
                name={submitted ? 'mail-unread-outline' : 'key-outline'}
                size={36}
                color={theme.colors.primary}
              />
            </View>

            <Text style={styles.title}>Quên mật khẩu</Text>

            {submitted ? (
              <View style={styles.successBox}>
                <Text style={styles.successText}>
                  Nếu email tồn tại trong hệ thống, chúng tôi đã gửi liên kết đặt lại mật khẩu đến hộp thư của bạn. Vui lòng kiểm tra hộp thư (liên kết có hiệu lực trong 15 phút).
                </Text>

                <CustomButton
                  title="Nhập mã đặt lại mật khẩu"
                  variant="outline"
                  onPress={() => navigation.navigate('ResetPassword')}
                  style={styles.actionBtn}
                />

                <CustomButton
                  title="Quay lại Đăng nhập"
                  onPress={() => navigation.navigate('Login')}
                  style={styles.actionBtn}
                />
              </View>
            ) : (
              <>
                <Text style={styles.description}>
                  Nhập địa chỉ email liên kết với tài khoản của bạn để nhận liên kết đặt lại mật khẩu.
                </Text>

                <View style={styles.formWrap}>
                  <CustomInput
                    label="Email"
                    required
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholder="user@gmail.com"
                    value={email}
                    onChangeText={(val) => {
                      setEmail(val);
                      if (emailError) setEmailError('');
                    }}
                    error={emailError}
                  />

                  <CustomButton
                    title="Gửi liên kết đặt lại"
                    onPress={handleSubmit}
                    loading={loading}
                  />
                </View>

                <TouchableOpacity
                  style={styles.backLink}
                  onPress={() => navigation.navigate('Login')}
                >
                  <Ionicons name="arrow-back" size={16} color={theme.colors.primary} />
                  <Text style={styles.backLinkText}>Quay lại Đăng nhập</Text>
                </TouchableOpacity>
              </>
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
    alignItems: 'center',
    ...theme.shadows.card,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: theme.colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    ...theme.typography.titleLarge,
    color: theme.colors.primaryDark,
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    ...theme.typography.bodyMedium,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 20,
  },
  formWrap: {
    width: '100%',
  },
  successBox: {
    width: '100%',
    marginTop: 8,
  },
  successText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.successBackground,
    borderRadius: 10,
    padding: 14,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 16,
  },
  actionBtn: {
    marginTop: 8,
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
    paddingVertical: 6,
  },
  backLinkText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.primary,
    fontWeight: '600',
  },
});
