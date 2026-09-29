import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { RootNavigationProp, RootStackParamList } from '../../navigation/types';
import { taxSettlementApi } from '../../api/taxSettlementApi';
import { formatVnd, heroOutcome, TaxSettlementPreview } from '../../types/taxSettlement';
import { SettlementResultBlocks } from './SettlementResultBlocks';

type Route = RouteProp<RootStackParamList, 'SettlementPreview'>;

export const SettlementPreviewScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const route = useRoute<Route>();
  const { taxYear, cutoffDate, charityDeduction } = route.params;

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<TaxSettlementPreview | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await taxSettlementApi.preview({
        taxYear,
        cutoffDate,
        charityDeduction: charityDeduction ?? 0,
      });
      setPreview(data);
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.errorCode ||
        e?.message ||
        'Không tải được xem trước.';
      setError(String(msg));
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }, [taxYear, cutoffDate, charityDeduction]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const onExport = async () => {
    if (!preview) return;
    setExporting(true);
    try {
      const selected = preview.incomeItems.filter((i) => i.isSelected).map((i) => i.incomeSourceId);
      const result = await taxSettlementApi.export({
        taxYear,
        cutoffDate,
        charityDeduction: charityDeduction ?? 0,
        selectedIncomeSourceIds: selected.length ? selected : null,
      });
      setConfirmOpen(false);
      navigation.replace('SettlementSuccess', {
        dossierId: result.dossierId || '',
        taxYear: result.taxYear,
        cutoffDate: result.cutoffDate,
        refundAmount: result.refundAmount,
        dueAmount: result.dueAmount,
        summaryMessage: result.summaryMessage,
      });
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.errorCode ||
        e?.message ||
        'Chốt hồ sơ thất bại.';
      Alert.alert('Không chốt được', String(msg));
    } finally {
      setExporting(false);
    }
  };

  const hero = preview ? heroOutcome(preview) : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.side} onPress={() => navigation.goBack()} testID="settlementPreviewBack">
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Xem trước</Text>
        <View style={styles.side} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.centerText}>Đang tính quyết toán...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.secondaryBtn} onPress={load} testID="settlementPreviewRetry">
            <Text style={styles.secondaryBtnText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : preview ? (
        <>
          <ScrollView contentContainerStyle={styles.scroll} testID="settlementPreviewScroll">
            <SettlementResultBlocks preview={preview} />
          </ScrollView>
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cta}
              onPress={() => setConfirmOpen(true)}
              testID="settlementOpenConfirm"
            >
              <Text style={styles.ctaText}>Chốt hồ sơ</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.goBack()} testID="settlementPreviewEdit">
              <Text style={styles.editLink}>Quay lại chỉnh</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : null}

      <Modal visible={confirmOpen} transparent animationType="fade" onRequestClose={() => setConfirmOpen(false)}>
        <View style={styles.sheetOverlay}>
          <TouchableOpacity style={styles.sheetDismiss} onPress={() => setConfirmOpen(false)} />
          <View style={styles.sheet} testID="settlementConfirmSheet">
            <Text style={styles.sheetTitle}>Xác nhận chốt</Text>
            {hero ? (
              <>
                <Text style={styles.sheetLabel}>{hero.label}</Text>
                <Text style={styles.sheetAmount}>{formatVnd(hero.amount)}</Text>
              </>
            ) : null}
            {preview ? (
              <View style={styles.sheetRows}>
                <Text style={styles.sheetRow}>Năm {preview.taxYear}</Text>
                <Text style={styles.sheetRow}>Thuế phải nộp {formatVnd(preview.taxPayable)}</Text>
                <Text style={styles.sheetRow}>Đã khấu trừ {formatVnd(preview.totalTaxWithheld)}</Text>
              </View>
            ) : null}
            <TouchableOpacity
              style={[styles.cta, exporting && { opacity: 0.7 }]}
              disabled={exporting}
              onPress={onExport}
              testID="settlementConfirmExport"
            >
              {exporting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.ctaText}>Chốt hồ sơ</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setConfirmOpen(false)} disabled={exporting}>
              <Text style={styles.editLink}>Huỷ</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, height: 52 },
  side: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.serifBold,
    fontSize: 20,
    color: theme.colors.textPrimary,
  },
  scroll: { paddingHorizontal: 22, paddingBottom: 24, paddingTop: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  centerText: { fontFamily: fonts.body, fontSize: 14, color: theme.colors.textSecondary },
  errorText: { fontFamily: fonts.body, fontSize: 14, color: theme.colors.error, textAlign: 'center' },
  footer: { paddingHorizontal: 20, paddingBottom: 16, paddingTop: 8, gap: 10 },
  cta: {
    height: 52,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { fontFamily: fonts.bodyBold, fontSize: 16, color: '#fff' },
  editLink: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    color: theme.colors.primary,
    textAlign: 'center',
    paddingVertical: 8,
  },
  secondaryBtn: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  secondaryBtnText: { fontFamily: fonts.bodySemi, color: theme.colors.primary },
  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  sheetDismiss: { flex: 1 },
  sheet: {
    backgroundColor: '#F8F5EE',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 28,
  },
  sheetTitle: { fontFamily: fonts.serifBold, fontSize: 20, color: theme.colors.textPrimary, marginBottom: 12 },
  sheetLabel: { fontFamily: fonts.bodySemi, fontSize: 12, letterSpacing: 1, color: '#7A5A14' },
  sheetAmount: { fontFamily: fonts.serifBold, fontSize: 28, color: theme.colors.primaryDark, marginTop: 4 },
  sheetRows: { marginVertical: 14, gap: 4 },
  sheetRow: { fontFamily: fonts.body, fontSize: 14, color: '#444' },
});
