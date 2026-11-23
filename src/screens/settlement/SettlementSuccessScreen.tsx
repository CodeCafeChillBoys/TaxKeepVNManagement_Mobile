import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '../../constants/fonts';
import { theme } from '../../constants/theme';
import { sanitizeUiMessage } from '../../utils/friendlyError';
import { SettlementExportHeader } from '../../components/navigation/SettlementExportHeader';
import { RootNavigationProp, RootStackParamList } from '../../navigation/types';
import { formatVnd, heroOutcome } from '../../types/taxSettlement';

type Route = RouteProp<RootStackParamList, 'SettlementSuccess'>;

export const SettlementSuccessScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const insets = useSafeAreaInsets();
  const { params } = useRoute<Route>();
  const hero = heroOutcome(params);
  const cleanSummary = params.summaryMessage
    ? sanitizeUiMessage(params.summaryMessage.replace(/^[^\wÀ-ỹ]+/, ''))
    : '';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      <LinearGradient
        colors={['#ECE9C2', '#ECE9C2', '#F8F5EE']}
        locations={[0, 0.4, 1]}
        style={styles.wash}
      />

      <SettlementExportHeader
        title="Đã chốt"
        backTestID="settlementSuccessBack"
        homeTestID="settlementSuccessHome"
        showRule={false}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollBody,
          { paddingBottom: Math.max(insets.bottom, 24) },
        ]}
      >
        <View style={styles.containerInner}>
          <View style={styles.content}>
            <Text style={styles.eyebrow}>Hồ sơ quyết toán thuế</Text>
            <Text style={styles.title}>Đã chốt</Text>
            <Text style={styles.lead}>
              Năm {params.taxYear} · Chốt {params.cutoffDate}
            </Text>

            <View style={styles.card}>
              <Text style={styles.cardKicker}>BIÊN NHẬN QUYẾT TOÁN</Text>
              <Text style={styles.heroLabel}>{hero.label}</Text>
              <Text
                style={styles.heroAmount}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
              >
                {formatVnd(hero.amount)}
              </Text>
              {cleanSummary ? <Text style={styles.msg}>{cleanSummary}</Text> : null}
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
                    accessibilityRole="button"
                    onPress={() =>
                      navigation.navigate('SettlementExportForm', {
                        dossierId: params.dossierId,
                        taxYear: params.taxYear,
                        refundAmount: params.refundAmount,
                      })
                    }
                  >
                    <Ionicons name="document-text-outline" size={18} color={theme.colors.primary} />
                    <Text style={styles.exportBtnText} numberOfLines={1}>
                      Tờ khai PDF
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.exportBtn}
                    testID="settlementSuccessZip"
                    accessibilityRole="button"
                    onPress={() =>
                      navigation.navigate('SettlementExportForm', {
                        dossierId: params.dossierId,
                        taxYear: params.taxYear,
                        refundAmount: params.refundAmount,
                      })
                    }
                  >
                    <Ionicons name="archive-outline" size={18} color={theme.colors.primary} />
                    <Text style={styles.exportBtnText} numberOfLines={1}>
                      Bộ hồ sơ
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
            <TouchableOpacity
              style={styles.cta}
              accessibilityRole="button"
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
              accessibilityRole="button"
              onPress={() => navigation.replace('SettlementList')}
              testID="settlementSuccessList"
            >
              <Text style={styles.secondaryText}>Về danh sách</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F5EE' },
  wash: { position: 'absolute', left: 0, right: 0, top: 0, height: 280 },
  scrollBody: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 8 },
  containerInner: {
    flex: 1,
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  content: { flex: 1 },
  eyebrow: { fontFamily: fonts.body, fontSize: 13, color: '#5A4A22' },
  title: {
    fontFamily: fonts.serifBold,
    fontSize: 30,
    lineHeight: 36,
    color: theme.colors.primaryDark,
    marginTop: 6,
  },
  lead: { fontFamily: fonts.body, fontSize: 14, color: '#444', marginTop: 8 },
  card: {
    marginTop: 28,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DED7CB',
    padding: 18,
    paddingBottom: 56,
  },
  cardKicker: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: theme.colors.primaryDark,
    marginBottom: 12,
  },
  heroLabel: { fontFamily: fonts.bodySemi, fontSize: 12, letterSpacing: 1, color: '#7A5A14' },
  heroAmount: {
    fontFamily: fonts.serifBold,
    fontSize: 32,
    color: theme.colors.primaryDark,
    marginTop: 4,
    flexShrink: 1,
  },
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
  footer: { marginTop: 'auto', paddingTop: 48, gap: 10 },
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
    paddingHorizontal: 8,
  },
  exportBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: theme.colors.primary,
    flexShrink: 1,
  },
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
