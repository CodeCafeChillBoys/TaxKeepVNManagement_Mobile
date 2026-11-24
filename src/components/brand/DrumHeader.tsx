import React, { ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fonts } from '../../constants/fonts';
import { theme } from '../../constants/theme';
import { DrumPatternBackdrop } from './DrumPatternBackdrop';
import { HomeHeaderButton, useShowHomeButton } from '../navigation/HomeHeaderButton';
import { useThemeStore, DARK_COLORS, LIGHT_COLORS } from '../../stores/useThemeStore';

type Props = {
  title: string;
  onBack: () => void;
  backTestID?: string;
  right?: ReactNode;
};

/** Dải trống đồng mờ xuống nền kem — header của màn tra cứu và màn gốc tab. */
export function DrumHeader({ title, onBack, backTestID, right }: Props) {
  const showHome = useShowHomeButton();
  const isDark = useThemeStore((s) => s.isDark);
  const palette = isDark ? DARK_COLORS : LIGHT_COLORS;
  const sideWidth = showHome && right ? 88 : 44;
  const titleColor = isDark ? palette.primaryDark : theme.colors.primaryDark;
  return (
    <>
      <DrumPatternBackdrop variant="soft" />
      <View style={styles.root}>
        <View style={styles.row}>
          <View style={[styles.side, styles.sideLeft, { width: sideWidth }]}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel="Quay lại"
              testID={backTestID}
            >
              <Ionicons name="arrow-back" size={24} color={palette.textPrimary} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.title, { color: titleColor }]} numberOfLines={1}>
            {title}
          </Text>
          <View style={[styles.side, styles.sideRight, { width: sideWidth }]}>
            {showHome ? <HomeHeaderButton /> : null}
            {right}
          </View>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: 'transparent',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    minHeight: 52,
    backgroundColor: 'transparent',
  },
  side: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sideLeft: { justifyContent: 'flex-start' },
  sideRight: { justifyContent: 'flex-end' },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.serifBold,
    fontWeight: '700',
    fontSize: 20,
    lineHeight: 26,
    color: theme.colors.primaryDark,
  },
});
