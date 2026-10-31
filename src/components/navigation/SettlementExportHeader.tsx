import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { GoldDoubleRule } from '../brand/GoldDoubleRule';
import { RootNavigationProp } from '../../navigation/types';

type Props = {
  title: string;
  backTestID: string;
  homeTestID: string;
  /** Mặc định true — Success (hero gradient) có thể tắt */
  showRule?: boolean;
};

/**
 * Header luồng sau chốt: ← lùi 1 bước + Home reset về trang chủ.
 */
export const SettlementExportHeader: React.FC<Props> = ({
  title,
  backTestID,
  homeTestID,
  showRule = true,
}) => {
  const navigation = useNavigation<RootNavigationProp>();

  const goHome = () => {
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  };

  return (
    <>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.side}
          onPress={() => navigation.goBack()}
          testID={backTestID}
          accessibilityLabel="Quay lại"
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <TouchableOpacity
          style={styles.side}
          onPress={goHome}
          testID={homeTestID}
          accessibilityLabel="Về trang chủ"
        >
          <Ionicons name="home-outline" size={22} color={theme.colors.textPrimary} />
        </TouchableOpacity>
      </View>
      {showRule ? <GoldDoubleRule /> : null}
    </>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    height: 52,
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
    color: theme.colors.textPrimary,
  },
});


