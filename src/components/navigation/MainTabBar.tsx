import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { RootNavigationProp } from '../../navigation/types';

type TabKey = 'Home' | 'DependentList' | 'IncomeSourceList' | 'Profile';

const TABS: {
  key: TabKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: 'Home', label: 'Trang chủ', icon: 'home-outline', iconActive: 'home' },
  { key: 'DependentList', label: 'Phụ thuộc', icon: 'people-outline', iconActive: 'people' },
  { key: 'IncomeSourceList', label: 'Thu nhập', icon: 'wallet-outline', iconActive: 'wallet' },
  { key: 'Profile', label: 'Tài khoản', icon: 'person-circle-outline', iconActive: 'person-circle' },
];

type Props = {
  active?: TabKey;
};

export function MainTabBar({ active }: Props) {
  const navigation = useNavigation<RootNavigationProp>();
  const route = useRoute();
  const current = active ?? (route.name as TabKey);

  return (
    <View style={styles.bar} testID="mainTabBar">
      {TABS.map((tab) => {
        const isActive = current === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.item}
            activeOpacity={0.75}
            onPress={() => {
              if (isActive) return;
              navigation.navigate(tab.key);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.label}
            testID={`mainTab_${tab.key}`}
          >
            <Ionicons
              name={isActive ? tab.iconActive : tab.icon}
              size={22}
              color={isActive ? theme.colors.primary : theme.colors.textSecondary}
            />
            <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 68,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    flexDirection: 'row',
    paddingTop: 8,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  label: {
    ...theme.typography.tabBarLabel,
    color: theme.colors.textSecondary,
  },
  labelActive: {
    fontFamily: fonts.bodyBold,
    color: theme.colors.primary,
  },
});
