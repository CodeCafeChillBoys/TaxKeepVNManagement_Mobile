import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { useThemeStore } from '../../stores/useThemeStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { RootNavigationProp } from '../../navigation/types';

const HIDDEN_HOME_ROUTES = new Set([
  'Home',
  'Login',
  'Register',
  'VerifyEmail',
  'VerifyPending',
  'ForgotPassword',
  'ResetPassword',
]);

interface HeaderMotifProps {
  title: string;
  onBack?: () => void;
  showHome?: boolean;
  style?: ViewStyle;
}

export const HeaderMotif: React.FC<HeaderMotifProps> = ({
  title,
  onBack,
  showHome = true,
  style,
}) => {
  const navigation = useNavigation<RootNavigationProp>();
  const route = useRoute();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  useThemeStore((s) => s.mode);

  const canShowHome = showHome && isAuthenticated && !HIDDEN_HOME_ROUTES.has(route.name);

  return (
    <View style={[styles.container, style]}>
      <View style={styles.topRow}>
        {onBack ? (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholder} />
        )}

        <Text style={styles.title} numberOfLines={1}>{title}</Text>

        {canShowHome ? (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Home' }] })}
            accessibilityRole="button"
            accessibilityLabel="Về trang chủ"
            testID="headerHomeBtn"
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons name="home-outline" size={22} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>

      {/* Dải trang trí vàng hoàng gia */}
      <View style={styles.decorLine} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
    backgroundColor: 'transparent',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.full,
  },
  placeholder: {
    width: 36,
    height: 36,
  },
  title: {
    ...theme.typography.titleMedium,
    color: theme.colors.primaryDark,
    textAlign: 'center',
    fontWeight: '700',
    flex: 1,
    paddingHorizontal: 8,
  },
  decorLine: {
    height: 2,
    backgroundColor: theme.colors.goldLight,
    marginTop: theme.spacing.sm,
    borderRadius: 1,
    opacity: 0.8,
  },
});
