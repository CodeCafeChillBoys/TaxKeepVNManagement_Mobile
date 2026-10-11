import React from 'react';
import { TouchableOpacity, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useNavigation, useNavigationState, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { useAuthStore } from '../../stores/useAuthStore';
import { RootNavigationProp } from '../../navigation/types';
import { shouldShowHomeButton } from './homeButtonUtils';

/** Header dùng để biết có hiện nút Home không (chia chỗ cho tiêu đề). */
export function useShowHomeButton(): boolean {
  const route = useRoute();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  // Màn ngay phía trước trong stack — nếu là Trang chủ thì nút lùi đã đủ
  const previousRouteName = useNavigationState((state) => {
    const idx = state.routes.findIndex((r) => r.key === route.key);
    return idx > 0 ? state.routes[idx - 1].name : undefined;
  });
  return shouldShowHomeButton(route.name, isAuthenticated, previousRouteName);
}

type Props = { color?: string; style?: StyleProp<ViewStyle> };

/** Về thẳng Trang chủ từ bất kỳ màn nào (không phải bấm lùi từng màn). */
export function HomeHeaderButton({ color = theme.colors.textPrimary, style }: Props) {
  const navigation = useNavigation<RootNavigationProp>();
  const visible = useShowHomeButton();
  if (!visible) return null;

  return (
    <TouchableOpacity
      style={[styles.btn, style]}
      onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Home' }] })}
      accessibilityRole="button"
      accessibilityLabel="Về trang chủ"
      testID="headerHomeBtn"
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    >
      <Ionicons name="home-outline" size={22} color={color} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
