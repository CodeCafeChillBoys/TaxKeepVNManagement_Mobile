import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

interface SeparatorProps {
  orientation?: 'horizontal' | 'vertical';
  style?: ViewStyle;
}

export const Separator: React.FC<SeparatorProps> = ({
  orientation = 'horizontal',
  style,
}) => {
  return (
    <View
      style={[
        orientation === 'horizontal' ? styles.horizontal : styles.vertical,
        style,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  horizontal: {
    height: 1,
    width: '100%',
    backgroundColor: '#E2E8F0', // slate-200
    marginVertical: 8,
  },
  vertical: {
    width: 1,
    height: '100%',
    backgroundColor: '#E2E8F0',
    marginHorizontal: 8,
  },
});
