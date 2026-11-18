import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { RootNavigationProp } from '../../navigation/types';
import { useAuthStore } from '../../stores/useAuthStore';
import { useThemeStore, DARK_COLORS, LIGHT_COLORS } from '../../stores/useThemeStore';

export type TabKey =
  | 'Home'
  | 'Wallet'
  | 'ExpenseUpload'
  | 'Notifications'
  | 'Profile'
  | 'DependentList'
  | 'IncomeSourceList';

type SideTabSpec = {
  key: 'Home' | 'Wallet' | 'Notifications' | 'Profile';
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
};

const LEFT_TABS: SideTabSpec[] = [
  { key: 'Home', label: 'Trang chủ', icon: 'home-outline', iconActive: 'home' },
  { key: 'Wallet', label: 'Ví TaxKeep', icon: 'wallet-outline', iconActive: 'wallet' },
];

const RIGHT_TABS: SideTabSpec[] = [
  {
    key: 'Notifications',
    label: 'Thông báo',
    icon: 'notifications-outline',
    iconActive: 'notifications',
  },
  { key: 'Profile', label: 'Cài đặt', icon: 'settings-outline', iconActive: 'settings' },
];

type Props = {
  active?: TabKey;
  onOpenNotifications?: () => void;
  unreadCount?: number;
};

export const MainTabBar = React.memo(function MainTabBar({
  active,
  onOpenNotifications,
  unreadCount = 0,
}: Props) {
  const navigation = useNavigation<RootNavigationProp>();
  const route = useRoute();
  const userRole = (useAuthStore((s) => s.user?.role) || '').toLowerCase();
  const isExpert = userRole === 'expert' || userRole.includes('expert');
  const isDark = useThemeStore((s) => s.isDark);
  const palette = isDark ? DARK_COLORS : LIGHT_COLORS;
  const current = active ?? (route.name as TabKey);

  const handlePressTab = (key: SideTabSpec['key']) => {
    if (key === 'Notifications') {
      if (onOpenNotifications) {
        onOpenNotifications();
      } else {
        navigation.navigate('Home', { openNotifications: true });
      }
      return;
    }

    if (current === key) return;

    if (key === 'Home') {
      navigation.navigate('Home');
      return;
    }
    if (key === 'Wallet') {
      navigation.navigate('Wallet', { walletType: isExpert ? 'EXPERT' : 'USER' });
      return;
    }
    if (key === 'Profile') {
      navigation.navigate('Profile', { initialTab: 'settings' });
    }
  };

  const renderSideTab = (tab: SideTabSpec) => {
    const isActive = current === tab.key;
    const showBadge = tab.key === 'Notifications' && unreadCount > 0;

    return (
      <TouchableOpacity
        key={tab.key}
        style={styles.item}
        activeOpacity={0.75}
        onPress={() => handlePressTab(tab.key)}
        accessibilityRole="button"
        accessibilityState={{ selected: isActive }}
        accessibilityLabel={tab.label}
        testID={`mainTab_${tab.key}`}
      >
        <View style={styles.iconWrap}>
          <Ionicons
            name={isActive ? tab.iconActive : tab.icon}
            size={24}
            color={isActive ? palette.primary : isDark ? palette.textSecondary : '#3B3632'}
          />
          {showBadge ? (
            <View style={[styles.unreadDot, { borderColor: palette.surface }]} />
          ) : null}
        </View>
        <Text
          style={[
            styles.label,
            { color: isDark ? palette.textSecondary : '#7A7571' },
            isActive && [styles.labelActive, { color: palette.primary }],
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
        >
          {tab.label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: palette.surface,
          borderTopColor: isDark ? palette.border : '#EAE4DC',
        },
      ]}
      testID="mainTabBar"
    >
      {LEFT_TABS.map(renderSideTab)}

      {/* Nút lớn ở giữa: Upload chứng từ */}
      <View style={styles.centerSlot}>
        <TouchableOpacity
          style={styles.centerUploadBtn}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('ExpenseUpload')}
          accessibilityRole="button"
          accessibilityLabel="Upload chứng từ"
          testID="mainTab_ExpenseUpload"
        >
          <View style={styles.scannerGraphic}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
            <View style={styles.scannerDocCard} />
            <View style={styles.scannerLine} />
          </View>
        </TouchableOpacity>
      </View>

      {RIGHT_TABS.map(renderSideTab)}
    </View>
  );
});

const styles = StyleSheet.create({
  bar: {
    minHeight: 74,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EAE4DC',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 2,
  },
  iconWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    position: 'absolute',
    top: -1,
    right: -3,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.error,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  label: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
    color: '#7A7571',
  },
  labelActive: {
    fontFamily: fonts.bodySemi,
    color: theme.colors.primary,
  },
  centerSlot: {
    width: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerUploadBtn: {
    width: 54,
    height: 54,
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: theme.colors.primaryDark,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  scannerGraphic: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  scannerDocCard: {
    width: 16,
    height: 18,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  scannerLine: {
    position: 'absolute',
    width: 22,
    height: 2.2,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  corner: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderColor: '#FFFFFF',
  },
  cornerTL: {
    top: 1,
    left: 1,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderTopLeftRadius: 3,
  },
  cornerTR: {
    top: 1,
    right: 1,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderTopRightRadius: 3,
  },
  cornerBL: {
    bottom: 1,
    left: 1,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderBottomLeftRadius: 3,
  },
  cornerBR: {
    bottom: 1,
    right: 1,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderBottomRightRadius: 3,
  },
});
