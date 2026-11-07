import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { HomeHeaderButton } from '../../components/navigation/HomeHeaderButton';
import { fonts } from '../../constants/fonts';
import { useToast } from '../../components/ui/Toast';
import { toFriendlyErrorMessage } from '../../utils/friendlyError';
import { RootNavigationProp, RootStackParamList } from '../../navigation/types';
import { taxSettlementApi } from '../../api/taxSettlementApi';
import { formatVnd, heroOutcome, TaxSettlementPreview } from '../../types/taxSettlement';
import { SettlementResultBlocks } from './SettlementResultBlocks';

type Route = RouteProp<RootStackParamList, 'SettlementPreview'>;

export const SettlementPreviewScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const route = useRoute<Route>();
  const { taxYear, cutoffDate, charityDeduction } = route.params;

  const isMountedRef = useRef(true);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<TaxSettlementPreview | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await taxSettlementApi.preview({
        taxYear,
        cutoffDate,
        charityDeduction: charityDeduction ?? 0,
      });
      if (!isMountedRef.current) return;
      setPreview(data);
    } catch (e: unknown) {
      if (!isMountedRef.current) return;
      const msg = toFriendlyErrorMessage(
        e,
        'Chưa thể tổng hợp bản xem trước quyết toán lúc này. Vui lòng thử lại sau.'
      );
      setError(msg);
      setPreview(null);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [taxYear, cutoffDate, charityDeduction]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        setLoading(true);
        setError(null);
        try {
          const data = await taxSettlementApi.preview({
            taxYear,
            cutoffDate,
            charityDeduction: charityDeduction ?? 0,
          });
          if (!alive || !isMountedRef.current) return;
          setPreview(data);
        } catch (e: unknown) {
          if (!alive || !isMountedRef.current) return;
          const msg = toFriendlyErrorMessage(
            e,
            'Chưa thể tổng hợp bản xem trước quyết toán lúc này. Vui lòng thử lại sau.'
          );
          setError(msg);
          setPreview(null);
        } finally {
          if (alive && isMountedRef.current) {
            setLoading(false);
          }
        }
      })();
      return () => {
        alive = false;
      };
    }, [taxYear, cutoffDate, charityDeduction])
  );

  const onExport = useCallback(async () => {
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
      if (!isMountedRef.current) return;
      setConfirmOpen(false);
      navigation.replace('SettlementSuccess', {
        dossierId: result.dossierId || '',
        taxYear: result.taxYear,
        cutoffDate: result.cutoffDate,
        refundAmount: result.refundAmount,
        dueAmount: result.dueAmount,
        summaryMessage: result.summaryMessage,
      });
    } catch (e: unknown) {
      if (!isMountedRef.current) return;
      toast.error(
        toFriendlyErrorMessage(
          e,
          'Chưa thể chốt hồ sơ quyết toán lúc này. Vui lòng kiểm tra kết nối và thử lại.'
        ),
        'Chưa thể chốt hồ sơ'
      );
    } finally {
      if (isMountedRef.current) {
        setExporting(false);
      }
    }
  }, [charityDeduction, cutoffDate, navigation, preview, taxYear, toast]);

  const hero = preview ? heroOutcome(preview) : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.side}
          onPress={() => navigation.goBack()}
          testID="settlementPreviewBack"
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          Xem trước
        </Text>
        <View style={styles.side}>
          <HomeHeaderButton />
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.centerText}>Đang tổng hợp số liệu quyết toán...</Text>
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
            <View style={styles.containerInner}>
              <SettlementResultBlocks preview={preview} />
            </View>
          </ScrollView>
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.containerInner}>
              <TouchableOpacity
                style={styles.cta}
                onPress={() => setConfirmOpen(true)}
                testID="settlementOpenConfirm"
                accessibilityRole="button"
              >
                <Text style={styles.ctaText}>Chốt hồ sơ</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                testID="settlementPreviewEdit"
                accessibilityRole="button"
              >
                <Text style={styles.editLink}>Quay lại chỉnh</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      ) : null}

      <Modal
        visible={confirmOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!exporting) setConfirmOpen(false);
        }}
      >
        <View style={styles.sheetOverlay}>
          <TouchableOpacity
            style={styles.sheetDismiss}
            onPress={() => !exporting && setConfirmOpen(false)}
          />
          <View
            style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]}
            testID="settlementConfirmSheet"
          >
            <Text style={styles.sheetTitle}>Chốt hồ sơ quyết toán thuế</Text>
            <Text style={styles.sheetDesc}>
              Sau khi chốt, số liệu kỳ tính thuế được lưu cố định để xuất tờ khai 02/QTT-TNCN và bộ chứng từ đính kèm.
            </Text>
            {hero ? (
              <>
                <Text style={styles.sheetLabel}>{hero.label}</Text>
                <Text
                  style={styles.sheetAmount}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.65}
                >
                  {formatVnd(hero.amount)}
                </Text>
              </>
            ) : null}
            {preview ? (
              <View style={styles.sheetRows}>
                <View style={styles.sheetLineRow}>
                  <Text style={styles.sheetLineLabel}>Kỳ quyết toán</Text>
                  <Text style={styles.sheetLineValue}>Năm {preview.taxYear}</Text>
                </View>
                <View style={styles.sheetLineRow}>
                  <Text style={styles.sheetLineLabel}>Thuế phải nộp cả năm</Text>
                  <Text
                    style={styles.sheetLineValue}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                  >
                    {formatVnd(preview.taxPayable)}
                  </Text>
                </View>
                <View style={styles.sheetLineRow}>
                  <Text style={styles.sheetLineLabel}>Thuế đã khấu trừ</Text>
                  <Text
                    style={styles.sheetLineValue}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                  >
                    {formatVnd(preview.totalTaxWithheld)}
                  </Text>
                </View>
              </View>
            ) : null}
            <TouchableOpacity
              style={[styles.cta, exporting && styles.ctaDisabled]}
              disabled={exporting}
              onPress={onExport}
              testID="settlementConfirmExport"
              accessibilityRole="button"
            >
              {exporting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.ctaText}>Chốt hồ sơ</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setConfirmOpen(false)}
              disabled={exporting}
              accessibilityRole="button"
            >
              <Text style={styles.editLink}>Kiểm tra lại</Text>
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
  containerInner: {
    width: '100%',
    maxWidth: 700,
    alignSelf: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  centerText: { fontFamily: fonts.body, fontSize: 14, color: theme.colors.textSecondary },
  errorText: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.error,
    textAlign: 'center',
    maxWidth: 420,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  cta: {
    height: 52,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: { opacity: 0.7 },
  ctaText: { fontFamily: fonts.bodyBold, fontSize: 16, color: '#fff' },
  editLink: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    color: theme.colors.primary,
    textAlign: 'center',
    paddingVertical: 10,
  },
  secondaryBtn: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  secondaryBtnText: { fontFamily: fonts.bodySemi, color: theme.colors.primary },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheetDismiss: { flex: 1 },
  sheet: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    backgroundColor: '#F8F5EE',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 22,
    paddingTop: 20,
  },
  sheetTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 20,
    color: theme.colors.primaryDark,
    marginBottom: 6,
  },
  sheetDesc: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textSecondary,
    marginBottom: 14,
  },
  sheetLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    letterSpacing: 1,
    color: '#7A5A14',
  },
  sheetAmount: {
    fontFamily: fonts.serifBold,
    fontSize: 28,
    color: theme.colors.primaryDark,
    marginTop: 4,
    flexShrink: 1,
  },
  sheetRows: {
    marginVertical: 14,
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sheetLineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  sheetLineLabel: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  sheetLineValue: {
    flexShrink: 1,
    maxWidth: '58%',
    fontFamily: fonts.bodySemi,
    fontSize: 13.5,
    color: theme.colors.textPrimary,
    textAlign: 'right',
  },
});
