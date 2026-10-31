import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '../../constants/fonts';
import { theme } from '../../constants/theme';
import { SettlementExportHeader } from '../../components/navigation/SettlementExportHeader';
import { RootNavigationProp, RootStackParamList } from '../../navigation/types';
import { formatVnd, heroOutcome } from '../../types/taxSettlement';

type Route = RouteProp<RootStackParamList, 'SettlementSuccess'>;

export const SettlementSuccessScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const { params } = useRoute<Route>();
  const hero = heroOutcome(params);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      <LinearGradient colors={['#ECE9C2', '#ECE9C2', '#F8F5EE']} locations={[0, 0.4, 1]} style={styles.wash} />

      <SettlementExportHeader
        title="Đã chốt"
        backTestID="settlementSuccessBack"
        homeTestID="settlementSuccessHome"
        showRule={false}
      />

      <View style={styles.content}>
        <Text style={styles.eyebrow}>Hồ sơ quyết toán thuế</Text>
        <Text style={styles.title}>Đã chốt</Text>
        <Text style={styles.lead}>
          Năm {params.taxYear} · Chốt {params.cutoffDate}
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardKicker}>BIÊN NHẬN QUYẾT TOÁN</Text>
          <Text style={styles.heroLabel}>{hero.label}</Text>
          <Text style={styles.heroAmount}>{formatVnd(hero.amount)}</Text>
          {params.summaryMessage ? (
            <Text style={styles.msg}>{params.summaryMessage.replace(/^[^\wÀ-ỹ]+/, '')}</Text>
          ) : null}
          <View style={styles.stamp} pointerEvents="none">
            <View style={styles.stampInner}>
              <Text style={styles.stampSmall}>TAXKEEP</Text>
              <Text style={styles.stampMain}>ĐÃ CHỐT</Text>
              <Text style={styles.stampSmall}>TNCN {params.taxYear}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        {params.dossierId ? (
          <View style={styles.exportBlock}>
            <Text style={styles.exportLabel}>XUẤT HỒ SƠ</Text>
            <View style={styles.exportRow}>
              <TouchableOpacity
                style={styles.exportBtn}
                testID="settlementSuccessPdf"
                onPress={() =>
                  navigation.navigate('SettlementExportForm', {
                    dossierId: params.dossierId,
                    taxYear: params.taxYear,
                    refundAmount: params.refundAmount,
                  })
                }
              >
                <Ionicons name="document-text-outline" size={18} color={theme.colors.primary} />
                <Text style={styles.exportBtnText}>Tờ khai PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.exportBtn}
                testID="settlementSuccessZip"
                onPress={() =>
                  navigation.navigate('SettlementExportForm', {
                    dossierId: params.dossierId,
                    taxYear: params.taxYear,
                    refundAmount: params.refundAmount,
                  })
                }
              >
                <Ionicons name="archive-outline" size={18} color={theme.colors.primary} />
                <Text style={styles.exportBtnText}>Hồ sơ ZIP</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
        <TouchableOpacity
          style={styles.cta}
          onPress={() => {
            if (params.dossierId) {
              navigation.replace('SettlementDetail', { id: params.dossierId });
            } else {
              navigation.replace('SettlementList');
            }
          }}
          testID="settlementSuccessDetail"
        >
          <Text style={styles.ctaText}>Xem hồ sơ</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondary}
          onPress={() => navigation.replace('SettlementList')}
          testID="settlementSuccessList"
        >
          <Text style={styles.secondaryText}>Về danh sách</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F5EE' },
  wash: { position: 'absolute', left: 0, right: 0, top: 0, height: 280 },
  content: { flex: 1, paddingTop: 8, paddingHorizontal: 22 },
  eyebrow: { fontFamily: fonts.body, fontSize: 13, color: '#5A4A22' },
  title: { fontFamily: fonts.serifBold, fontSize: 30, lineHeight: 36, color: theme.colors.primaryDark, marginTop: 6 },
  lead: { fontFamily: fonts.body, fontSize: 14, color: '#444', marginTop: 8 },
  card: {
    marginTop: 28,
    backgroundColor: '#fff',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#DED7CB',
    padding: 18,
    paddingBottom: 56,
  },
  cardKicker: { fontFamily: fonts.bodyBold, fontSize: 11, color: theme.colors.primaryDark, marginBottom: 12 },
  heroLabel: { fontFamily: fonts.bodySemi, fontSize: 12, letterSpacing: 1, color: '#7A5A14' },
  heroAmount: { fontFamily: fonts.serifBold, fontSize: 32, color: theme.colors.primaryDark, marginTop: 4 },
  msg: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: '#444', marginTop: 10 },
  stamp: {
    position: 'absolute',
    right: -4,
    bottom: -36,
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 2,
    borderColor: '#B3261E',
    opacity: 0.88,
    transform: [{ rotate: '-12deg' }],
    alignItems: 'center',
    justifyContent: 'center',
  },
  stampInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: '#B3261E',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  stampSmall: { fontFamily: fonts.bodyBold, fontSize: 7, color: '#B3261E' },
  stampMain: { fontFamily: fonts.bodyExtra, fontSize: 14, color: '#B3261E' },
  footer: { paddingHorizontal: 20, paddingBottom: 24, gap: 10 },
  exportBlock: { gap: 8, marginBottom: 4 },
  exportLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 1,
    color: '#7A5A14',
  },
  exportRow: { flexDirection: 'row', gap: 10 },
  exportBtn: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  exportBtnText: { fontFamily: fonts.bodyBold, fontSize: 14, color: theme.colors.primary },
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
