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
import { useToast } from '../../components/ui/Toast';
import { theme } from '../../constants/theme';
import { RootNavigationProp, RootStackParamList } from '../../navigation/types';
import { authApi } from '../../api/authApi';

type VerifyStatus = 'idle' | 'verifying' | 'success' | 'expired' | 'invalid';

export const VerifyEmailScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'VerifyEmail'>>();
  const { toast } = useToast();

  const initialToken = route.params?.token || '';
  const [tokenInput, setTokenInput] = useState(initialToken);
  const [emailInput, setEmailInput] = useState(route.params?.email || '');
  const [emailError, setEmailError] = useState('');
  const [status, setStatus] = useState<VerifyStatus>(initialToken ? 'verifying' : 'idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [resending, setResending] = useState(false);

  const handleVerify = useCallback(async (rawToken: string) => {
    const cleanToken = rawToken.trim();
    if (!cleanToken) {
      setStatus('invalid');
      setErrorMessage('Liên kết xác minh không hợp lệ hoặc đã được sử dụng.');
      return;
    }

    setStatus('verifying');
    setErrorMessage('');

    try {
      await authApi.verifyEmail(cleanToken);
      setStatus('success');
    } catch (error: any) {
      const responseData = error?.response?.data;
      const errorCode = String(
        responseData?.errors?.errorCode || responseData?.errorCode || ''
      ).toUpperCase();
      const serverMsg = responseData?.message;

      if (errorCode === 'TOKEN_EXPIRED') {
        setStatus('expired');
        setErrorMessage(
          serverMsg || 'Liên kết xác minh đã hết hạn (quá 24 giờ).'
        );
      } else {
        setStatus('invalid');
        setErrorMessage(
          serverMsg || 'Liên kết xác minh không hợp lệ hoặc đã được sử dụng.'
        );
      }
    }
  }, []);

  useEffect(() => {
    let urlToken = route.params?.token || '';
    if (!urlToken && Platform.OS === 'web' && typeof window !== 'undefined') {
      urlToken = new URLSearchParams(window.location.search).get('token') || '';
    }
    if (urlToken) {
      setTokenInput(urlToken);
      void handleVerify(urlToken);
    }
  }, [handleVerify, route.params?.token]);

  const handleResend = useCallback(async () => {
    const cleanEmail = emailInput.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setEmailError('Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }
    setEmailError('');
    setResending(true);

    try {
      const res = await authApi.resendVerification(cleanEmail);
      toast.success(
        res?.message ||
          'Nếu email tồn tại và chưa được xác minh, chúng tôi đã gửi lại email xác minh.',
        'Đã gửi email xác minh'
      );
    } catch (error: any) {
      const msg =
        error?.response?.data?.message ||
        'Nếu email tồn tại và chưa được xác minh, chúng tôi đã gửi lại email xác minh.';
      toast.info(msg, 'Thông báo');
    } finally {
      setResending(false);
    }
  }, [emailInput, toast]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <HeaderMotif
        title="XÁC MINH EMAIL"
        onBack={() => navigation.replace('Login')}
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
            {status === 'verifying' ? (
              <View style={styles.centerBlock}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.title}>Đang xác minh tài khoản...</Text>
                <Text style={styles.subtitle}>
                  Vui lòng đợi trong giây lát khi hệ thống kiểm tra liên kết xác minh của bạn.
                </Text>
              </View>
            ) : status === 'success' ? (
              <View style={styles.centerBlock}>
                <View style={[styles.iconCircle, styles.iconSuccess]}>
                  <Ionicons name="checkmark-circle" size={48} color={theme.colors.success} />
                </View>
                <Text style={styles.title}>Kích hoạt tài khoản thành công!</Text>
                <Text style={styles.subtitle}>
                  Địa chỉ email của bạn đã được xác minh. Bây giờ bạn có thể đăng nhập để sử dụng đầy đủ tính năng của TaxKeep VN.
                </Text>
                <CustomButton
                  title="Đăng nhập ngay"
                  onPress={() => navigation.replace('Login')}
                  style={styles.fullBtn}
                />
              </View>
            ) : status === 'expired' ? (
              <View style={styles.centerBlock}>
                <View style={[styles.iconCircle, styles.iconWarning]}>
                  <Ionicons name="time-outline" size={44} color={theme.colors.warning} />
                </View>
                <Text style={styles.title}>Liên kết xác minh đã hết hạn (quá 24 giờ)</Text>
                <Text style={styles.subtitle}>
                  {errorMessage ||
                    'Liên kết xác minh đã hết hạn. Vui lòng nhập email để nhận liên kết xác minh mới.'}
                </Text>

                <View style={styles.formSection}>
                  <CustomInput
                    label="Địa chỉ Email"
                    required
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholder="user@gmail.com"
                    value={emailInput}
                    onChangeText={(val) => {
                      setEmailInput(val);
                      if (emailError) setEmailError('');
                    }}
                    error={emailError}
                  />
                  <CustomButton
                    title="Gửi lại email xác minh"
                    onPress={handleResend}
                    loading={resending}
                  />
                </View>

                <TouchableOpacity
                  style={styles.backLink}
                  onPress={() => navigation.replace('Login')}
                >
                  <Text style={styles.backLinkText}>Quay lại Đăng nhập</Text>
                </TouchableOpacity>
              </View>
            ) : status === 'invalid' ? (
              <View style={styles.centerBlock}>
                <View style={[styles.iconCircle, styles.iconError]}>
                  <Ionicons name="close-circle-outline" size={44} color={theme.colors.error} />
                </View>
                <Text style={styles.title}>Xác minh không thành công</Text>
                <Text style={styles.subtitle}>
                  {errorMessage || 'Liên kết xác minh không hợp lệ hoặc đã được sử dụng.'}
                </Text>

                <View style={styles.formSection}>
                  <CustomInput
                    label="Gửi lại liên kết xác minh qua Email"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholder="user@gmail.com"
                    value={emailInput}
                    onChangeText={(val) => {
                      setEmailInput(val);
                      if (emailError) setEmailError('');
                    }}
                    error={emailError}
                  />
                  <CustomButton
                    title="Gửi lại email xác minh"
                    variant="outline"
                    onPress={handleResend}
                    loading={resending}
                  />
                </View>

                <TouchableOpacity
                  style={styles.backLink}
                  onPress={() => navigation.replace('Login')}
                >
                  <Text style={styles.backLinkText}>Quay lại Đăng nhập</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.centerBlock}>
                <View style={styles.iconCircle}>
                  <Ionicons name="mail-open-outline" size={40} color={theme.colors.primary} />
                </View>
                <Text style={styles.title}>Xác minh địa chỉ Email</Text>
                <Text style={styles.subtitle}>
                  Dán mã token hoặc liên kết xác minh từ hộp thư email của bạn để kích hoạt tài khoản.
                </Text>

                <View style={styles.formSection}>
                  <CustomInput
                    label="Mã xác minh (Token / URL)"
                    autoCapitalize="none"
                    placeholder="Nhập mã token từ email..."
                    value={tokenInput}
                    onChangeText={setTokenInput}
                  />
                  <CustomButton
                    title="Xác minh ngay"
                    onPress={() => void handleVerify(tokenInput)}
                  />
                </View>

                <View style={styles.divider} />

                <View style={styles.formSection}>
                  <CustomInput
                    label="Chưa nhận được email? Nhập email để gửi lại"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholder="user@gmail.com"
                    value={emailInput}
                    onChangeText={(val) => {
                      setEmailInput(val);
                      if (emailError) setEmailError('');
                    }}
                    error={emailError}
                  />
                  <CustomButton
                    title="Gửi lại email xác minh"
                    variant="outline"
                    onPress={handleResend}
                    loading={resending}
                  />
                </View>
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
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: theme.colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconSuccess: {
    backgroundColor: theme.colors.successBackground,
  },
  iconWarning: {
    backgroundColor: theme.colors.warningBackground,
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
  formSection: {
    width: '100%',
    marginTop: 4,
  },
  fullBtn: {
    width: '100%',
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 20,
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
