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
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { registerSchema, RegisterFormData } from '../../utils/validation';
import { CustomInput } from '../../components/common/CustomInput';
import { CustomButton } from '../../components/common/CustomButton';
import { PasswordStrengthBar } from '../../components/common/PasswordStrengthBar';
import { HeaderMotif } from '../../components/common/HeaderMotif';
import { Dialog } from '../../components/common/Dialog';
import { TermsCheckbox } from '../../components/auth/TermsCheckbox';
import { useToast } from '../../components/ui/Toast';
import { theme } from '../../constants/theme';
import { RootNavigationProp, RootStackParamList } from '../../navigation/types';
import { authApi } from '../../api/authApi';
import { applyRegisterOcrResult } from './applyRegisterOcrResult';
import { sanitizeUiMessage, toFriendlyError } from '../../utils/friendlyError';

export const RegisterScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'Register'>>();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [leaveDestination, setLeaveDestination] = useState<(() => void) | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const {
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isDirty },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    mode: 'onBlur',
    defaultValues: {
      fullName: '',
      citizenId: '',
      dateOfBirth: '',
      email: '',
      phoneNumber: '',
      taxIdNumber: '',
      address: '',
      password: '',
      confirmPassword: '',
      agreeTerms: false,
    },
  });

  const passwordValue = useWatch({ control, name: 'password' });
  const agreeTermsValue = useWatch({ control, name: 'agreeTerms' });

  useEffect(() => {
    const result = route.params?.ocrResult;
    if (!result) return;

    const plan = applyRegisterOcrResult(result);
    setValue('fullName', plan.fields.fullName, { shouldValidate: true, shouldDirty: true });
    setValue('citizenId', plan.fields.citizenId, { shouldValidate: true, shouldDirty: true });
    setValue('dateOfBirth', plan.fields.dateOfBirth, { shouldValidate: true, shouldDirty: true });
    setValue('address', plan.fields.address, { shouldValidate: true, shouldDirty: true });

    if (plan.citizenIdError) {
      setError('citizenId', {
        type: 'server',
        message: sanitizeUiMessage(plan.citizenIdError, 'Số căn cước công dân này đã được đăng ký.'),
      });
    }

    navigation.setParams({ ocrResult: undefined });
    toast.success(plan.alertMessage, plan.alertTitle);
  }, [navigation, route.params?.ocrResult, setError, setValue, toast]);

  const handleLeavePage = useCallback(
    (destination: () => void) => {
      if (isDirty) {
        setLeaveDestination(() => destination);
      } else {
        destination();
      }
    },
    [isDirty]
  );

  const onSubmit = useCallback(
    async (data: RegisterFormData) => {
      setLoading(true);
      try {
        await authApi.register(data);
        if (!isMountedRef.current) return;

        toast.success(
          'Vui lòng kiểm tra hộp thư điện tử để kích hoạt tài khoản.',
          'Đăng ký tài khoản thành công'
        );
        navigation.replace('VerifyPending', { email: data.email });
      } catch (error: any) {
        if (!isMountedRef.current) return;
        const status = error?.response?.status;
        const responseData = error?.response?.data;

        if (status === 400 && responseData?.errors) {
          const fieldErrors = responseData.errors;
          Object.keys(fieldErrors).forEach((key) => {
            const fieldName = (key.charAt(0).toLowerCase() + key.slice(1)) as keyof RegisterFormData;
            setError(fieldName, {
              type: 'server',
              message: sanitizeUiMessage(fieldErrors[key]?.[0], 'Thông tin nhập chưa hợp lệ.'),
            });
          });
        } else if (status === 409) {
          const msg = String(responseData?.message || 'Thông tin đăng ký đã tồn tại trên hệ thống.');
          const lower = msg.toLowerCase();
          if (lower.includes('email')) {
            setError('email', {
              type: 'server',
              message: 'Địa chỉ email này đã được sử dụng. Vui lòng chọn email khác.',
            });
          } else if (lower.includes('căn cước') || lower.includes('cccd') || lower.includes('citizen')) {
            setError('citizenId', {
              type: 'server',
              message: 'Số căn cước công dân này đã được đăng ký.',
            });
          } else if (lower.includes('điện thoại') || lower.includes('phone')) {
            setError('phoneNumber', {
              type: 'server',
              message: 'Số điện thoại này đã được sử dụng.',
            });
          } else {
            toast.warning(
              sanitizeUiMessage(msg, 'Thông tin đăng ký đã tồn tại trên hệ thống.'),
              'Thông tin đã được đăng ký'
            );
          }
        } else if (status === 429) {
          toast.warning(
            'Bạn đã gửi yêu cầu đăng ký nhiều lần liên tiếp. Vui lòng đợi ít phút rồi thử lại.',
            'Gửi yêu cầu quá nhanh'
          );
        } else {
          const friendly = toFriendlyError(error, {
            fallbackTitle: 'Chưa thể tạo tài khoản',
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
    [navigation, setError, toast]
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <HeaderMotif
        title="ĐĂNG KÝ TÀI KHOẢN"
        onBack={() => handleLeavePage(() => navigation.goBack())}
      />

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
            {/* Card Quét CCCD nhanh */}
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.ocrQuickCard}
              onPress={() =>
                navigation.navigate('ScanIdentity', {
                  source: 'register',
                  hasExistingData: isDirty,
                })
              }
            >
              <View style={styles.ocrIconCircle}>
                <Ionicons name="scan-outline" size={24} color={theme.colors.primary} />
              </View>
              <View style={styles.ocrTextCol}>
                <Text style={styles.ocrTitle}>Quét căn cước công dân</Text>
                <Text style={styles.ocrSubtitle}>Điền nhanh thông tin từ giấy tờ tùy thân</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>

            {/* Dải phân cách hoặc nhập tay */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>hoặc nhập tay</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Form Card chính */}
            <View style={styles.formCard}>
              {/* Họ và tên */}
              <Controller
                control={control}
                name="fullName"
                render={({ field: { onChange, onBlur, value } }) => (
                  <CustomInput
                    label="Họ và tên"
                    required
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    error={errors.fullName?.message}
                  />
                )}
              />

              {/* Số CCCD */}
              <Controller
                control={control}
                name="citizenId"
                render={({ field: { onChange, onBlur, value } }) => (
                  <CustomInput
                    label="Số căn cước công dân"
                    required
                    keyboardType="numeric"
                    maxLength={12}
                    placeholder="12 chữ số"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    error={errors.citizenId?.message}
                  />
                )}
              />

              {/* Ngày sinh */}
              <Controller
                control={control}
                name="dateOfBirth"
                render={({ field: { onChange, onBlur, value } }) => (
                  <CustomInput
                    label="Ngày sinh"
                    placeholder="1995-05-12"
                    helperText="Định dạng Năm-Tháng-Ngày (từ 18 tuổi trở lên)"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    error={errors.dateOfBirth?.message}
                  />
                )}
              />

              {/* Email */}
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <CustomInput
                    label="Email"
                    required
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholder="ten@email.com"
                    helperText="Dùng làm tên đăng nhập và nhận thư kích hoạt"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    error={errors.email?.message}
                  />
                )}
              />

              {/* Số điện thoại */}
              <Controller
                control={control}
                name="phoneNumber"
                render={({ field: { onChange, onBlur, value } }) => (
                  <CustomInput
                    label="Số điện thoại"
                    required
                    keyboardType="phone-pad"
                    maxLength={10}
                    placeholder="09xxxxxxxx"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    error={errors.phoneNumber?.message}
                  />
                )}
              />

              {/* Mã số thuế */}
              <Controller
                control={control}
                name="taxIdNumber"
                render={({ field: { onChange, onBlur, value } }) => (
                  <CustomInput
                    label="Mã số thuế"
                    keyboardType="numeric"
                    maxLength={13}
                    placeholder="10 hoặc 13 chữ số"
                    helperText="Có thể bổ sung sau trong hồ sơ cá nhân"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    error={errors.taxIdNumber?.message}
                  />
                )}
              />

              {/* Địa chỉ */}
              <Controller
                control={control}
                name="address"
                render={({ field: { onChange, onBlur, value } }) => (
                  <CustomInput
                    label="Địa chỉ thường trú"
                    multiline
                    numberOfLines={2}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    error={errors.address?.message}
                  />
                )}
              />

              {/* Mật khẩu */}
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <CustomInput
                    label="Mật khẩu"
                    required
                    isPassword
                    placeholder="Tối thiểu 8 ký tự, chữ hoa, thường, số"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    error={errors.password?.message}
                  />
                )}
              />
              <PasswordStrengthBar passwordText={passwordValue || ''} />

              {/* Xác nhận Mật khẩu */}
              <Controller
                control={control}
                name="confirmPassword"
                render={({ field: { onChange, onBlur, value } }) => (
                  <CustomInput
                    label="Xác nhận mật khẩu"
                    required
                    isPassword
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    error={errors.confirmPassword?.message}
                  />
                )}
              />

              {/* Checkbox Đồng ý điều khoản */}
              <Controller
                control={control}
                name="agreeTerms"
                render={({ field: { onChange, value } }) => (
                  <TermsCheckbox
                    checked={value}
                    onToggle={onChange}
                    error={errors.agreeTerms?.message}
                  />
                )}
              />

              {/* Nút Đăng ký */}
              <CustomButton
                title={loading ? 'Đang tạo tài khoản...' : 'Đăng ký'}
                onPress={handleSubmit(onSubmit)}
                loading={loading}
                disabled={!agreeTermsValue}
                style={styles.submitBtn}
              />

              {/* Chuyển sang Đăng nhập */}
              <View style={styles.loginLinkRow}>
                <Text style={styles.loginLinkText}>Đã có tài khoản? </Text>
                <TouchableOpacity
                  onPress={() => handleLeavePage(() => navigation.navigate('Login'))}
                >
                  <Text style={styles.loginLinkHighlight}>Đăng nhập</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Dialog
        visible={leaveDestination !== null}
        title="Hủy thông tin đang nhập?"
        message="Thông tin đăng ký chưa được gửi đi. Nếu rời khỏi màn hình này, dữ liệu vừa nhập sẽ không được lưu."
        destructive
        secondaryLabel="Tiếp tục nhập"
        primaryLabel="Rời màn hình"
        onSecondary={() => setLeaveDestination(null)}
        onPrimary={() => {
          const dest = leaveDestination;
          setLeaveDestination(null);
          dest?.();
        }}
      />
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
    paddingVertical: theme.spacing.md,
    paddingBottom: theme.spacing.xl * 2,
  },
  contentWrap: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  ocrQuickCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.2,
    borderColor: theme.colors.gold,
    borderStyle: 'dashed',
    ...theme.shadows.card,
    marginBottom: theme.spacing.md,
  },
  ocrIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  ocrTextCol: {
    flex: 1,
  },
  ocrTitle: {
    ...theme.typography.titleMedium,
    fontSize: 16,
    color: theme.colors.primary,
    fontWeight: '700',
  },
  ocrSubtitle: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
  },
  dividerText: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginHorizontal: theme.spacing.sm,
  },
  formCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    ...theme.shadows.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  submitBtn: {
    marginTop: theme.spacing.md,
  },
  loginLinkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: theme.spacing.lg,
  },
  loginLinkText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.textSecondary,
  },
  loginLinkHighlight: {
    ...theme.typography.bodyMedium,
    color: theme.colors.primary,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
