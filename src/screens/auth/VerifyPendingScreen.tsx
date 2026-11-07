import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { CustomButton } from '../../components/common/CustomButton';
import { HeaderMotif } from '../../components/common/HeaderMotif';
import { useToast } from '../../components/ui/Toast';
import { theme } from '../../constants/theme';
import { RootStackParamList, RootNavigationProp } from '../../navigation/types';

type VerifyPendingRouteProp = RouteProp<RootStackParamList, 'VerifyPending'>;

export const VerifyPendingScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const route = useRoute<VerifyPendingRouteProp>();
  const { toast } = useToast();
  const email = route.params?.email || 'email của bạn';

  const handleResendEmail = useCallback(() => {
    toast.success(
      `Liên kết kích hoạt mới đã được gửi tới ${email}. Vui lòng kiểm tra cả hòm thư chính và thư rác.`,
      'Đã gửi lại thư xác thực'
    );
  }, [email, toast]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <HeaderMotif title="XÁC THỰC TÀI KHOẢN" showFlag={false} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="mail-unread-outline" size={54} color={theme.colors.primary} />
          </View>

          <Text style={styles.title}>Đăng ký thành công!</Text>
          <Text style={styles.subtitle}>
            Tài khoản của bạn đã được tạo trên hệ thống TaxKeep VN. Chúng tôi đã gửi liên kết xác thực tới:
          </Text>

          <View style={styles.emailBadge}>
            <Text style={styles.emailText} numberOfLines={2}>
              {email}
            </Text>
          </View>

          <Text style={styles.note}>
            Vui lòng nhấn vào đường liên kết trong thư điện tử để kích hoạt tài khoản trước khi thực hiện các thủ tục kê khai thuế.
          </Text>

          <CustomButton
            title="Đăng nhập ngay"
            onPress={() => navigation.replace('Login')}
            style={styles.primaryBtn}
          />

          <TouchableOpacity
            style={styles.resendBtn}
            onPress={handleResendEmail}
            activeOpacity={0.7}
          >
            <Text style={styles.resendText}>Chưa nhận được thư? Gửi lại</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    alignItems: 'center',
    ...theme.shadows.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: theme.colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
  },
  title: {
    ...theme.typography.titleLarge,
    color: theme.colors.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    ...theme.typography.bodyMedium,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
    lineHeight: 22,
  },
  emailBadge: {
    backgroundColor: theme.colors.inputBackground,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
    maxWidth: '100%',
  },
  emailText: {
    ...theme.typography.bodyLarge,
    fontWeight: '700',
    color: theme.colors.primaryDark,
    textAlign: 'center',
  },
  note: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
    lineHeight: 18,
  },
  primaryBtn: {
    width: '100%',
    marginBottom: theme.spacing.md,
  },
  resendBtn: {
    paddingVertical: 8,
  },
  resendText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
});
