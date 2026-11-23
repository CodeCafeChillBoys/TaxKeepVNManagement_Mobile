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
import { ProvinceSelect } from '../../components/common/ProvinceSelect';
import { PasswordStrengthBar } from '../../components/common/PasswordStrengthBar';
import { HeaderMotif } from '../../components/common/HeaderMotif';
import { Dialog } from '../../components/common/Dialog';
import { TermsCheckbox } from '../../components/auth/TermsCheckbox';
import { useToast } from '../../components/ui/Toast';
import { theme } from '../../constants/theme';
import { matchVietnamProvince } from '../../constants/vietnamProvinces';
import { RootNavigationProp, RootStackParamList } from '../../navigation/types';
import { authApi } from '../../api/authApi';
import { applyRegisterOcrResult } from './applyRegisterOcrResult';
import { sanitizeUiMessage, toFriendlyError } from '../../utils/friendlyError';

const VALID_REGISTER_FIELDS = new Set<keyof RegisterFormData>([
  'fullName',
  'citizenId',
  'dateOfBirth',
  'email',
  'phoneNumber',
  'address',
  'password',
  'confirmPassword',
  'agreeTerms',
]);

export const RegisterScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'Register'>>();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
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
    const matchedProvince = matchVietnamProvince(plan.fields.address) || '';

    setValue('fullName', plan.fields.fullName, { shouldValidate: true, shouldDirty: true });
    setValue('citizenId', plan.fields.citizenId, { shouldValidate: true, shouldDirty: true });
    setValue('dateOfBirth', plan.fields.dateOfBirth, { shouldValidate: true, shouldDirty: true });
    setValue('address', matchedProvince, { shouldValidate: true, shouldDirty: true });

    navigation.setParams({ ocrResult: undefined });

    if (plan.citizenIdError) {
      const errMsg = sanitizeUiMessage(
        plan.citizenIdError,
        'Số CCCD này đã được đăng ký.'
      );
      setError('citizenId', {
        type: 'server',
        message: errMsg,
      });
      toast.warning(errMsg, 'Số CCCD đã được đăng ký');
    } else {
      toast.success(plan.alertMessage, plan.alertTitle);
    }
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
        const res = await authApi.register(data);
        if (!isMountedRef.current) return;

        const targetEmail = res?.data?.email || data.email.trim().toLowerCase();
        if (res?.data?.requiresEmailVerification !== false) {
          setRegisteredEmail(targetEmail);
        } else {
          toast.success(
            'Tài khoản đã được tạo. Vui lòng đăng nhập.',
            'Đăng ký thành công'
          );
          navigation.replace('Login');
        }
      } catch (error: any) {
        if (!isMountedRef.current) return;
        const status = error?.response?.status;
        const responseData = error?.response?.data;
        const errorCode = String(
          responseData?.errors?.errorCode || responseData?.errorCode || ''
        ).toUpperCase();
        const serverMsg = String(responseData?.message || '');

        if (errorCode === 'CITIZEN_ID_ALREADY_EXISTS') {
          setError('citizenId', {
            type: 'server',
            message: 'Số CCCD này đã được đăng ký.',
          });
          toast.error(
            'Số CCCD này đã được đăng ký. Vui lòng đăng nhập.',
            'Đăng ký thất bại'
          );
        } else if (errorCode === 'EMAIL_ALREADY_EXISTS') {
          setError('email', {
            type: 'server',
            message: 'Email này đã được sử dụng.',
          });
          toast.error(
            'Email này đã được sử dụng. Vui lòng dùng email khác.',
            'Đăng ký thất bại'
          );
        } else if (errorCode === 'INVALID_CITIZEN_ID') {
          setError('citizenId', {
            type: 'server',
            message: 'Số CCCD phải gồm 12 chữ số.',
          });
          toast.error('Số CCCD không hợp lệ.', 'Thông tin chưa hợp lệ');
        } else if (status === 400 && responseData?.errors && typeof responseData.errors === 'object') {
          const fieldErrors = responseData.errors;
          let hasMappedField = false;

          Object.keys(fieldErrors).forEach((key) => {
            if (key === 'errorCode') return;
            const fieldName = (key.charAt(0).toLowerCase() + key.slice(1)) as keyof RegisterFormData;
            if (!VALID_REGISTER_FIELDS.has(fieldName)) return;

            const rawVal = fieldErrors[key];
            const firstMsg = Array.isArray(rawVal) ? rawVal[0] : typeof rawVal === 'string' ? rawVal : '';
            setError(fieldName, {
              type: 'server',
              message: sanitizeUiMessage(firstMsg, 'Thông tin chưa hợp lệ.'),
            });
            hasMappedField = true;
          });

          toast.error(
            sanitizeUiMessage(
              serverMsg,
              hasMappedField
                ? 'Vui lòng kiểm tra lại các trường báo đỏ.'
                : 'Thông tin đăng ký chưa hợp lệ.'
            ),
            'Thông tin chưa hợp lệ'
          );
        } else if (status === 409) {
          const lower = serverMsg.toLowerCase();
          if (lower.includes('email')) {
            setError('email', {
              type: 'server',
              message: 'Email này đã được sử dụng.',
            });
            toast.error('Email này đã được sử dụng.', 'Đăng ký thất bại');
          } else if (lower.includes('căn cước') || lower.includes('cccd') || lower.includes('citizen')) {
            setError('citizenId', {
              type: 'server',
              message: 'Số CCCD này đã được đăng ký.',
            });
            toast.error('Số CCCD này đã được đăng ký.', 'Đăng ký thất bại');
          } else if (lower.includes('điện thoại') || lower.includes('phone')) {
            setError('phoneNumber', {
              type: 'server',
              message: 'Số điện thoại này đã được sử dụng.',
            });
            toast.error('Số điện thoại này đã được sử dụng.', 'Đăng ký thất bại');
          } else {
            toast.warning(
              sanitizeUiMessage(serverMsg, 'Thông tin đăng ký đã tồn tại.'),
              'Thông tin đã tồn tại'
            );
          }
        } else if (status === 429) {
          toast.warning(
            'Thao tác quá nhanh. Vui lòng đợi ít phút rồi thử lại.',
            'Quá nhiều yêu cầu'
          );
        } else {
          const friendly = toFriendlyError(error, {
            fallbackTitle: 'Đăng ký thất bại',
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
            {registeredEmail ? (
              <View style={styles.formCard}>
                <View style={{ alignItems: 'center', paddingVertical: 12 }}>
                  <View
                    style={{
                      width: 68,
                      height: 68,
                      borderRadius: 34,
                      backgroundColor: theme.colors.successBackground,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 14,
                    }}
                  >
                    <Ionicons name="mail-unread-outline" size={36} color={theme.colors.success} />
                  </View>
                  <Text
                    style={{
                      ...theme.typography.titleLarge,
                      color: theme.colors.primaryDark,
                      textAlign: 'center',
                      marginBottom: 10,
                    }}
                  >
                    ✉️ Đăng ký thành công!
                  </Text>
                  <Text
                    style={{
                      ...theme.typography.bodyMedium,
                      color: theme.colors.textSecondary,
                      textAlign: 'center',
                      lineHeight: 22,
                      marginBottom: 22,
                    }}
                  >
                    Chúng tôi đã gửi một liên kết xác minh đến địa chỉ email{' '}
                    <Text style={{ fontWeight: '700', color: theme.colors.textPrimary }}>
                      {registeredEmail}
                    </Text>
                    . Vui lòng kiểm tra hộp thư (cả mục Spam) để kích hoạt tài khoản của bạn.
                  </Text>

                  <CustomButton
                    title="Quay lại Đăng nhập"
                    onPress={() => navigation.replace('Login')}
                    style={{ width: '100%' }}
                  />

                  <TouchableOpacity
                    style={{ marginTop: 14, paddingVertical: 6 }}
                    onPress={() =>
                      navigation.navigate('VerifyEmail', { email: registeredEmail })
                    }
                  >
                    <Text style={styles.loginLinkHighlight}>
                      Chưa nhận được email hoặc muốn nhập mã xác minh?
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
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
                    placeholder="Nguyễn Văn A"
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
                    placeholder="Nhập 12 chữ số CCCD"
                    onBlur={onBlur}
                    onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, 12))}
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
                    helperText="Định dạng Năm-Tháng-Ngày (từ 18 tuổi)"
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
                    onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, 10))}
                    value={value}
                    error={errors.phoneNumber?.message}
                  />
                )}
              />

              {/* Địa chỉ thường trú (Dropdown 34 Tỉnh/Thành phố sau sáp nhập) */}
              <Controller
                control={control}
                name="address"
                render={({ field: { onChange, onBlur, value } }) => (
                  <ProvinceSelect
                    label="Địa chỉ thường trú"
                    placeholder="Chọn Tỉnh / Thành phố"
                    value={value}
                    onChange={onChange}
                    onBlur={onBlur}
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
                    placeholder="Nhập lại mật khẩu"
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
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Dialog
        visible={leaveDestination !== null}
        title="Hủy thông tin đang nhập?"
        message="Dữ liệu đăng ký chưa được lưu. Bạn có chắc muốn rời màn hình này?"
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
