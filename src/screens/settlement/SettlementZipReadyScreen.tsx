import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { Dialog } from '../../components/common/Dialog';
import { useToast } from '../../components/ui/Toast';
import { sanitizeUiMessage, toFriendlyErrorMessage } from '../../utils/friendlyError';
import { SettlementExportHeader } from '../../components/navigation/SettlementExportHeader';
import {
  SettlementExportLoadingPanel,
  withMinDuration,
} from '../../components/settlement/SettlementExportLoadingPanel';
import { RootNavigationProp, RootStackParamList } from '../../navigation/types';
import { taxSettlementApi } from '../../api/taxSettlementApi';
import {
  formatExpiresAt,
  formatFileSize,
  TaxSettlementPackageZipResponse,
} from '../../types/taxSettlement';

type Route = RouteProp<RootStackParamList, 'SettlementZipReady'>;
type Phase = 'loading' | 'ready' | 'error';

function useCountdown(expiresAt: string | null) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!expiresAt) return;
    const end = new Date(expiresAt).getTime();
    if (Number.isNaN(end)) return;

    const initialNow = Date.now();
    setNow(initialNow);
    if (end - initialNow <= 0) return;

    const t = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (end - current <= 0) {
        clearInterval(t);
      }
    }, 1000);

    return () => clearInterval(t);
  }, [expiresAt]);

  return useMemo(() => {
    if (!expiresAt) return { label: '—', expired: false };
    const end = new Date(expiresAt).getTime();
    if (Number.isNaN(end)) return { label: '—', expired: false };
    const ms = end - now;
    if (ms <= 0) return { label: 'Đã hết hạn', expired: true };
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return { label: `${m}:${s.toString().padStart(2, '0')}`, expired: false };
  }, [expiresAt, now]);
}

export const SettlementZipReadyScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const { params } = useRoute<Route>();

  const isMountedRef = useRef(true);
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [pkg, setPkg] = useState<TaxSettlementPackageZipResponse | null>(params.package ?? null);
  const [downloading, setDownloading] = useState(false);
  const [confirmDialogVisible, setConfirmDialogVisible] = useState(false);
  const countdown = useCountdown(pkg?.expiresAt ?? null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setPhase('loading');
    setError(null);
    try {
      const data = await withMinDuration(
        taxSettlementApi.exportZip(params.dossierId, params.form),
        900
      );
      if (!isMountedRef.current) return;
      setPkg(data);
      setPhase('ready');
    } catch (e: unknown) {
      if (!isMountedRef.current) return;
      const friendly = toFriendlyErrorMessage(
        e,
        'Chưa thể đóng gói tệp hồ sơ quyết toán lúc này. Vui lòng thử lại sau ít phút.'
      );
      setError(friendly);
      setPhase('error');
      toast.error(friendly, 'Chưa thể đóng gói hồ sơ');
    }
  }, [params.dossierId, params.form, toast]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      if (params.package) {
        setPkg(params.package);
        setPhase('ready');
        return () => {
          alive = false;
        };
      }
      (async () => {
        setPhase('loading');
        setError(null);
        try {
          const data = await withMinDuration(
            taxSettlementApi.exportZip(params.dossierId, params.form),
            900
          );
          if (!alive || !isMountedRef.current) return;
          setPkg(data);
          setPhase('ready');
        } catch (e: unknown) {
          if (!alive || !isMountedRef.current) return;
          const friendly = toFriendlyErrorMessage(
            e,
            'Chưa thể đóng gói tệp hồ sơ quyết toán lúc này. Vui lòng thử lại sau ít phút.'
          );
          setError(friendly);
          setPhase('error');
          toast.error(friendly, 'Chưa thể đóng gói hồ sơ');
        }
      })();
      return () => {
        alive = false;
      };
    }, [params.dossierId, params.form, params.package, toast])
  );

  const settlementPeriodDetail = useMemo(() => {
    const matchedYear = /20\d{2}/.exec(pkg?.fileName ?? '')?.[0];
    if (matchedYear && pkg?.fileName) {
      return `Năm tính thuế ${matchedYear} · ${pkg.fileName}`;
    }
    if (matchedYear) {
      return `Năm tính thuế ${matchedYear}`;
    }
    return pkg?.fileName || 'Bộ hồ sơ quyết toán thuế TNCN';
  }, [pkg?.fileName]);

  const goReexport = useCallback(() => {
    setConfirmDialogVisible(true);
  }, []);

  const handleConfirmReexport = useCallback(() => {
    setConfirmDialogVisible(false);
    navigation.replace('SettlementExportForm', {
      dossierId: params.dossierId,
      refundAmount: params.refundAmount,
    });
  }, [navigation, params.dossierId, params.refundAmount]);

  const onDownload = useCallback(async () => {
    if (!pkg) return;
    if (countdown.expired) {
      navigation.replace('SettlementDownloadExpired', {
        dossierId: params.dossierId,
        refundAmount: params.refundAmount,
      });
      return;
    }
    setDownloading(true);
    try {
      const file = await taxSettlementApi.downloadByUrl(pkg.downloadUrl, pkg.fileName);
      if (!isMountedRef.current) return;
      const can = await Sharing.isAvailableAsync();
      if (can) {
        await Sharing.shareAsync(file.uri, {
          mimeType: file.mimeType,
          dialogTitle: file.fileName,
        });
        if (isMountedRef.current) {
          toast.success('Bộ tệp hồ sơ quyết toán đã sẵn sàng để lưu trữ.', 'Đã tải tệp hồ sơ');
        }
      } else {
        toast.warning(
          `Thiết bị chưa hỗ trợ mở bảng chia sẻ. Tệp hồ sơ đã lưu tạm: ${file.fileName}`,
          'Đã lưu tệp hồ sơ'
        );
      }
    } catch (e: any) {
      if (!isMountedRef.current) return;
      const status = e?.response?.status;
      if (status === 410) {
        navigation.replace('SettlementDownloadExpired', {
          dossierId: params.dossierId,
          refundAmount: params.refundAmount,
        });
        return;
      }
      toast.error(
        toFriendlyErrorMessage(
          e,
          'Chưa thể tải tệp hồ sơ lúc này. Vui lòng thử lại hoặc xuất lại bộ hồ sơ mới.'
        ),
        'Chưa thể tải tệp hồ sơ'
      );
    } finally {
      if (isMountedRef.current) {
        setDownloading(false);
      }
    }
  }, [countdown.expired, navigation, params.dossierId, params.refundAmount, pkg, toast]);

  const emptyDocs = (pkg?.totalDocumentsIncluded ?? 0) === 0;
  const cleanMessage = pkg?.message ? sanitizeUiMessage(pkg.message) : '';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <SettlementExportHeader
        title={phase === 'loading' ? 'Xuất bộ hồ sơ' : 'Bộ hồ sơ quyết toán'}
        backTestID="zipReadyBack"
        homeTestID="zipReadyHome"
      />

      {phase === 'loading' ? (
        <SettlementExportLoadingPanel
          testID="zipLoading"
          title="Đang đóng gói tờ khai và chứng từ…"
          subtitle="Vui lòng giữ màn hình mở trong giây lát."
        />
      ) : phase === 'error' ? (
        <View style={styles.center} testID="zipError">
          <Ionicons name="alert-circle-outline" size={40} color={theme.colors.error} />
          <Text style={styles.error}>{error}</Text>
          <TouchableOpacity style={styles.cta} onPress={load} testID="zipRetry">
            <Text style={styles.ctaText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : pkg ? (
        <ScrollView
          contentContainerStyle={[
            styles.scrollBody,
            { paddingBottom: Math.max(insets.bottom, 24) },
          ]}
          testID="zipReady"
        >
          <View style={styles.containerInner}>
            <Text style={styles.eyebrow}>TỆP HỒ SƠ SẴN SÀNG</Text>
            <Text style={styles.fileName}>{pkg.fileName}</Text>
            {emptyDocs ? (
              <Text style={styles.emptyHint} testID="zipEmptyDocs">
                Bộ hồ sơ gồm tờ khai quyết toán. Chưa có biên lai y tế hoặc giáo dục đã xác nhận đính kèm.
              </Text>
            ) : (
              <Text style={styles.meta}>
                Kèm {pkg.totalDocumentsIncluded} chứng từ gốc · {formatFileSize(pkg.fileSizeBytes)}
              </Text>
            )}
            {cleanMessage ? <Text style={styles.msg}>{cleanMessage}</Text> : null}

            <View style={styles.expireCard}>
              <Text style={styles.expireLabel}>Hiệu lực đến</Text>
              <Text style={styles.expireAt}>{formatExpiresAt(pkg.expiresAt)}</Text>
              <Text style={[styles.countdown, countdown.expired && styles.countdownExpired]}>
                {countdown.label}
              </Text>
              <Text style={styles.expireNote}>
                Đường dẫn tải tệp hồ sơ có hiệu lực trong khoảng 30 phút.
              </Text>
            </View>

            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.cta, countdown.expired && styles.ctaDisabled]}
                onPress={onDownload}
                disabled={downloading}
                testID="zipDownloadBtn"
                accessibilityRole="button"
              >
                {downloading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="download-outline" size={18} color="#fff" />
                    <Text style={styles.ctaText}>
                      {countdown.expired ? 'Đường dẫn đã hết hạn' : 'Tải tệp hồ sơ'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondary}
                onPress={goReexport}
                testID="zipReexportBtn"
                accessibilityRole="button"
              >
                <Text style={styles.secondaryText}>Xuất lại hồ sơ</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      ) : null}

      <Dialog
        visible={confirmDialogVisible}
        title="Chốt hồ sơ quyết toán thuế"
        message="Thao tác này sẽ đóng gói chốt bộ hồ sơ quyết toán mới và vô hiệu hóa đường dẫn tải hiện tại. Tệp hồ sơ mới sẽ sẵn sàng tải xuống trong vòng 30 phút."
        detailLabel="Kỳ quyết toán"
        detail={settlementPeriodDetail}
        primaryLabel="Chốt và tải hồ sơ"
        secondaryLabel="Kiểm tra lại"
        onPrimary={handleConfirmReexport}
        onSecondary={() => setConfirmDialogVisible(false)}
        onRequestClose={() => setConfirmDialogVisible(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F5EE' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 },
  error: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.error,
    textAlign: 'center',
    maxWidth: 420,
  },
  scrollBody: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 20 },
  containerInner: {
    flex: 1,
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  eyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 1,
    color: '#7A5A14',
  },
  fileName: {
    fontFamily: fonts.serifBold,
    fontSize: 22,
    color: theme.colors.primaryDark,
    marginTop: 8,
  },
  meta: { fontFamily: fonts.body, fontSize: 14, color: '#444', marginTop: 8 },
  emptyHint: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: '#666',
    marginTop: 8,
  },
  msg: { fontFamily: fonts.body, fontSize: 13, color: '#666', marginTop: 6 },
  expireCard: {
    marginTop: 28,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#DED7CB',
    borderRadius: 10,
    padding: 18,
    alignItems: 'center',
  },
  expireLabel: { fontFamily: fonts.body, fontSize: 13, color: '#666' },
  expireAt: {
    fontFamily: fonts.bodySemi,
    fontSize: 16,
    color: theme.colors.textPrimary,
    marginTop: 4,
  },
  countdown: {
    fontFamily: fonts.serifBold,
    fontSize: 40,
    color: theme.colors.primaryDark,
    marginTop: 12,
    fontVariant: ['tabular-nums'],
  },
  countdownExpired: { color: theme.colors.error, fontSize: 28 },
  expireNote: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#9A9488',
    marginTop: 8,
    textAlign: 'center',
  },
  footer: { marginTop: 'auto', paddingTop: 24, gap: 10 },
  cta: {
    height: 52,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 24,
  },
  ctaDisabled: { opacity: 0.55 },
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
