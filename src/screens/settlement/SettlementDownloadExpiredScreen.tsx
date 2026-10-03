import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { SettlementExportHeader } from '../../components/navigation/SettlementExportHeader';
import { RootNavigationProp, RootStackParamList } from '../../navigation/types';

type Route = RouteProp<RootStackParamList, 'SettlementDownloadExpired'>;

export const SettlementDownloadExpiredScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const { params } = useRoute<Route>();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <SettlementExportHeader
        title="Link hết hạn"
        backTestID="downloadExpiredBack"
        homeTestID="downloadExpiredHome"
      />

      <View style={styles.body} testID="downloadExpired">
        <View style={styles.iconWrap}>
          <Ionicons name="time-outline" size={40} color={theme.colors.primary} />
        </View>
        <Text style={styles.headline}>Link tải đã hết hạn</Text>
        <Text style={styles.copy}>
          Đường dẫn tải chỉ còn hiệu lực khoảng 30 phút. Vui lòng xuất lại hồ sơ để nhận link mới.
        </Text>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.cta}
            testID="downloadExpiredReexport"
            onPress={() =>
              navigation.replace('SettlementExportForm', {
                dossierId: params.dossierId,
                refundAmount: params.refundAmount,
              })
            }
          >
            <Text style={styles.ctaText}>Xuất lại</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondary}
            onPress={() => navigation.navigate('SettlementDetail', { id: params.dossierId })}
          >
            <Text style={styles.secondaryText}>Về chi tiết hồ sơ</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F5EE' },
  body: { flex: 1, paddingHorizontal: 28, paddingTop: 48, alignItems: 'center' },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1.5,
    borderColor: '#DED7CB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  headline: {
    fontFamily: fonts.serifBold,
    fontSize: 24,
    color: theme.colors.primaryDark,
    marginTop: 20,
    textAlign: 'center',
  },
  copy: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    color: '#555',
    marginTop: 12,
    textAlign: 'center',
  },
  footer: { marginTop: 'auto', width: '100%', paddingBottom: 24, gap: 10 },
  cta: {
    height: 52,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { fontFamily: fonts.bodyBold, fontSize: 16, color: '#fff' },
  secondary: {
    height: 52,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { fontFamily: fonts.bodyBold, fontSize: 16, color: theme.colors.primary },
});
