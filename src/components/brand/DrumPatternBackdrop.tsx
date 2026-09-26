import React from 'react';
import { View, Image, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type Props = {
  /** full = login; soft = home root tabs */
  variant?: 'full' | 'soft';
  style?: ViewStyle;
};

/**
 * Hoa văn trống đồng mờ dần xuống nền — theo Đánh giá UI §6c.
 */
export function DrumPatternBackdrop({ variant = 'full', style }: Props) {
  const height = variant === 'full' ? 420 : 380;
  const topOffset = variant === 'full' ? -110 : -160;
  const size = variant === 'full' ? 580 : 540;
  const opacity = variant === 'full' ? 0.8 : 0.75;
  const fadeColors =
    variant === 'full'
      ? (['#ECE9C2', '#ECE9C2', '#FFFFFF'] as const)
      : (['#ECE9C2', '#ECE9C2', '#F8F5EE'] as const);
  const fadeLocations = variant === 'full' ? ([0, 0.42, 1] as const) : ([0, 0.38, 1] as const);

  return (
    <View pointerEvents="none" style={[styles.wrap, { height }, style]}>
      <LinearGradient
        colors={[...fadeColors]}
        locations={[...fadeLocations]}
        style={StyleSheet.absoluteFill}
      />
      <Image
        source={require('../../../assets/brand/trong-dong-header.png')}
        style={[
          styles.drum,
          {
            top: topOffset,
            width: size,
            height: size,
            marginLeft: -size / 2,
            opacity,
          },
        ]}
        resizeMode="contain"
      />
      <LinearGradient
        colors={
          variant === 'full'
            ? ['transparent', 'transparent', '#FFFFFF']
            : ['transparent', 'transparent', '#F8F5EE']
        }
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    overflow: 'hidden',
  },
  drum: {
    position: 'absolute',
    left: '50%',
  },
});
