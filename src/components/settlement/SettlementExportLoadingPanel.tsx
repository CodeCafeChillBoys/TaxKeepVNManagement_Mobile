import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, LayoutChangeEvent } from 'react-native';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';

type Props = {
  title: string;
  subtitle: string;
  testID?: string;
};

/** Thanh chạy không xác định — API không trả % tiến độ. */
function IndeterminateBar() {
  const [trackW, setTrackW] = React.useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const segment = Math.max(56, trackW * 0.28);

  useEffect(() => {
    if (trackW <= 0) return;
    x.setValue(0);
    const loop = Animated.loop(
      Animated.timing(x, {
        toValue: 1,
        duration: 1400,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [trackW, x]);

  const translateX = x.interpolate({
    inputRange: [0, 1],
    outputRange: [-segment, Math.max(trackW, segment)],
  });

  const onLayout = (e: LayoutChangeEvent) => {
    setTrackW(e.nativeEvent.layout.width);
  };

  return (
    <View style={styles.track} onLayout={onLayout} accessibilityRole="progressbar">
      {trackW > 0 ? (
        <Animated.View
          style={[
            styles.segment,
            { width: segment, transform: [{ translateX }] },
          ]}
        />
      ) : null}
    </View>
  );
}

export const SettlementExportLoadingPanel: React.FC<Props> = ({ title, subtitle, testID }) => {
  return (
    <View style={styles.wrap} testID={testID}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <IndeterminateBar />
    </View>
  );
};

/** Giữ màn chờ tối thiểu để API nhanh vẫn tạo cảm giác chờ có chủ đích. */
export function withMinDuration<T>(promise: Promise<T>, minMs = 800): Promise<T> {
  const started = Date.now();
  return promise.then(async (value) => {
    const left = minMs - (Date.now() - started);
    if (left > 0) {
      await new Promise((r) => setTimeout(r, left));
    }
    return value;
  });
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 36,
    paddingBottom: 48,
  },
  title: {
    fontFamily: fonts.serifBold,
    fontSize: 22,
    lineHeight: 30,
    color: theme.colors.primaryDark,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    color: '#666',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 28,
  },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E4DCCF',
    overflow: 'hidden',
    width: '100%',
  },
  segment: {
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.primary,
  },
});
