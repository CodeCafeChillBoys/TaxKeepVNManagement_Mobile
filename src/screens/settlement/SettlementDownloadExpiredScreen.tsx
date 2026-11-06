import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { SettlementExportHeader } from '../../components/navigation/SettlementExportHeader';
import { RootNavigationProp, RootStackParamList } from '../../navigation/types';

type Route = RouteProp<RootStackParamList, 'SettlementDownloadExpired'>;

export const SettlementDownloadExpiredScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const insets = useSafeAreaInsets();
  const { params } = useRoute<Route>();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <SettlementExportHeader
        title="Hết hạn tải hồ sơ"
        backTestID="downloadExpiredBack"
        homeTestID="downloadExpiredHome"
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollBody,
          { paddingBottom: Math.max(insets.bottom, 24) },
        ]}
        testID="downloadExpired"
      >
        <View style={styles.containerInner}>
          <View style={styles.iconWrap}>
            <Ionicons name="time-outline" size={40} color={theme.colors.primary} />
          </View>
          <Text style={styles.headline}>Đường dẫn tải đã hết hạn</Text>
          <Text style={styles.copy}>
            Đường dẫn tải tệp hồ sơ chỉ có hiệu lực trong khoảng 30 phút để bảo mật dữ liệu thuế. Vui lòng xuất lại bộ hồ sơ để nhận đường dẫn tải mới.
          </Text>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cta}
              testID="downloadExpiredReexport"
              accessibilityRole="button"
              onPress={() =>
                navigation.replace('SettlementExportForm', {
                  dossierId: params.dossierId,
                  refundAmount: params.refundAmount,
                })
              }
            >
              <Text style={styles.ctaText}>Xuất lại hồ sơ</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondary}
              accessibilityRole="button"
              onPress={() => navigation.navigate('SettlementDetail', { id: params.dossierId })}
            >
              <Text style={styles.secondaryText}>Về chi tiết hồ sơ</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F5EE' },
  scrollBody: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 48 },
  containerInner: {
    flex: 1,
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    alignItems: 'center',
  },
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
    maxWidth: 460,
  },
  footer: { marginTop: 'auto', width: '100%', paddingTop: 28, gap: 10 },
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
