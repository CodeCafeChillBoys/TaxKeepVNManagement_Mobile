import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
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
    const t = setInterval(() => setNow(Date.now()), 1000);
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
  const { params } = useRoute<Route>();
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [pkg, setPkg] = useState<TaxSettlementPackageZipResponse | null>(params.package ?? null);
  const [downloading, setDownloading] = useState(false);
  const countdown = useCountdown(pkg?.expiresAt ?? null);

  const load = useCallback(async () => {
    setPhase('loading');
    setError(null);
    try {
      const data = await withMinDuration(
        taxSettlementApi.exportZip(params.dossierId, params.form),
        900
      );
      setPkg(data);
      setPhase('ready');
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        'Không đóng gói được hồ sơ ZIP.';
      setError(typeof msg === 'string' ? msg : 'Không đóng gói được hồ sơ ZIP.');
      setPhase('error');
    }
  }, [params.dossierId, params.form]);

  useFocusEffect(
    useCallback(() => {
      if (params.package) {
        setPkg(params.package);
        setPhase('ready');
        return;
      }
      void load();
    }, [load, params.package])
  );

  const goReexport = () => {
    Alert.alert(
      'Xuất lại hồ sơ?',
      'Link tải cũ sẽ không còn dùng được. Hệ thống tạo gói ZIP mới với hạn 30 phút.',
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Xuất lại',
          onPress: () =>
            navigation.replace('SettlementExportForm', {
              dossierId: params.dossierId,
              refundAmount: params.refundAmount,
            }),
        },
      ]
    );
  };

  const onDownload = async () => {
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
      const can = await Sharing.isAvailableAsync();
      if (can) {
        await Sharing.shareAsync(file.uri, {
          mimeType: file.mimeType,
          dialogTitle: file.fileName,
        });
      } else {
        Alert.alert('Đã tải', `File đã lưu tạm: ${file.fileName}`);
      }
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 410) {
        navigation.replace('SettlementDownloadExpired', {
          dossierId: params.dossierId,
          refundAmount: params.refundAmount,
        });
        return;
      }
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        'Không tải được file. Thử lại hoặc xuất lại hồ sơ.';
      Alert.alert('Tải thất bại', typeof msg === 'string' ? msg : 'Không tải được file.');
    } finally {
      setDownloading(false);
    }
  };

  const emptyDocs = (pkg?.totalDocumentsIncluded ?? 0) === 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <SettlementExportHeader
        title={phase === 'loading' ? 'Xuất hồ sơ ZIP' : 'Hồ sơ ZIP'}
        backTestID="zipReadyBack"
        homeTestID="zipReadyHome"
      />

      {phase === 'loading' ? (
        <SettlementExportLoadingPanel
          testID="zipLoading"
          title="Đang đóng gói hồ sơ (PDF + chứng từ)…"
          subtitle="Vui lòng giữ màn hình mở."
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
        <View style={styles.body} testID="zipReady">
          <Text style={styles.eyebrow}>HỒ SƠ SẴN SÀNG</Text>
          <Text style={styles.fileName}>{pkg.fileName}</Text>
          {emptyDocs ? (
            <Text style={styles.emptyHint} testID="zipEmptyDocs">
              ZIP gồm tờ khai. Chưa có biên lai y tế/giáo dục đã xác nhận.
            </Text>
          ) : (
            <Text style={styles.meta}>
              Kèm {pkg.totalDocumentsIncluded} chứng từ gốc · {formatFileSize(pkg.fileSizeBytes)}
            </Text>
          )}
          {pkg.message ? <Text style={styles.msg}>{pkg.message}</Text> : null}

          <View style={styles.expireCard}>
            <Text style={styles.expireLabel}>Hết hạn lúc</Text>
            <Text style={styles.expireAt}>{formatExpiresAt(pkg.expiresAt)}</Text>
            <Text style={[styles.countdown, countdown.expired && styles.countdownExpired]}>
              {countdown.label}
            </Text>
            <Text style={styles.expireNote}>Link tải còn hiệu lực trong khoảng 30 phút.</Text>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.cta, countdown.expired && styles.ctaDisabled]}
              onPress={onDownload}
              disabled={downloading}
              testID="zipDownloadBtn"
            >
              {downloading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="download-outline" size={18} color="#fff" />
                  <Text style={styles.ctaText}>{countdown.expired ? 'Link đã hết hạn' : 'Tải về'}</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondary} onPress={goReexport} testID="zipReexportBtn">
              <Text style={styles.secondaryText}>Xuất lại</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F5EE' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 },
  error: { fontFamily: fonts.body, fontSize: 14, color: theme.colors.error, textAlign: 'center' },
  body: { flex: 1, paddingHorizontal: 22, paddingTop: 20 },
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
    borderRadius: 4,
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
  },
  countdownExpired: { color: theme.colors.error, fontSize: 28 },
  expireNote: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#9A9488',
    marginTop: 8,
    textAlign: 'center',
  },
  footer: { marginTop: 'auto', paddingBottom: 24, gap: 10 },
  cta: {
    height: 52,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
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
