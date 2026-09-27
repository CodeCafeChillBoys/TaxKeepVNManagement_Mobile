import React, { ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { fonts } from '../../constants/fonts';
import { theme } from '../../constants/theme';

type Props = {
  title: string;
  onBack: () => void;
  backTestID?: string;
  right?: ReactNode;
};

/** Dải trống đồng mờ xuống nền kem — header của màn tra cứu và màn gốc tab. */
export function DrumHeader({ title, onBack, backTestID, right }: Props) {
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#ECE9C2', '#ECE9C2', '#F8F5EE']}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Image
        source={require('../../../assets/brand/trong-dong-header.png')}
        style={styles.drum}
        resizeMode="contain"
      />
      <LinearGradient
        colors={['transparent', 'transparent', '#F8F5EE']}
        locations={[0, 0.28, 0.7]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.side}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
          testID={backTestID}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.side}>{right}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    height: 108,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  drum: {
    position: 'absolute',
    width: 460,
    height: 460,
    top: -300,
    left: '50%',
    marginLeft: -230,
    opacity: 0.72,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 4,
    backgroundColor: '#F8F5EE',
  },
  side: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.serifBold,
    fontSize: 20,
    lineHeight: 26,
    color: '#1E1E1E',
  },
});
