import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { theme } from '../../constants/theme';

type Props = {
  style?: ViewStyle;
};

/** Đường kẻ đôi vàng — lấy từ HeaderMotif / Đánh giá UI §6c. */
export function GoldDoubleRule({ style }: Props) {
  return <View style={[styles.rule, style]} />;
}

const styles = StyleSheet.create({
  rule: {
    height: 3,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.gold,
    opacity: 0.7,
  },
});
