import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { HomeHeaderButton } from '../../components/navigation/HomeHeaderButton';
import { fonts } from '../../constants/fonts';
import { toFriendlyErrorMessage } from '../../utils/friendlyError';
import { RootNavigationProp, RootStackParamList } from '../../navigation/types';
import { taxSettlementApi } from '../../api/taxSettlementApi';
import { TaxSettlementPreview } from '../../types/taxSettlement';
import { SettlementResultBlocks } from './SettlementResultBlocks';

type Route = RouteProp<RootStackParamList, 'SettlementDetail'>;

function formatDossierRefCode(rawId: string | undefined, taxYear: number): string {
  const clean = String(rawId ?? '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
  if (!clean) return `QTT-${taxYear}`;
  return `QTT-${taxYear}-${clean.slice(-6)}`;
}

export const SettlementDetailScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const insets = useSafeAreaInsets();
  const { params } = useRoute<Route>();
  const isMountedRef = useRef(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<TaxSettlementPreview | null>(null);

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
      const data = await taxSettlementApi.getById(params.id);
      if (!isMountedRef.current) return;
      setPreview(data);
    } catch (e: unknown) {
      if (!isMountedRef.current) return;
      setError(
        toFriendlyErrorMessage(
          e,
          'Chưa thể tải chi tiết hồ sơ quyết toán lúc này. Vui lòng thử lại.'
        )
      );
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [params.id]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        setLoading(true);
        setError(null);
        try {
          const data = await taxSettlementApi.getById(params.id);
          if (!alive || !isMountedRef.current) return;
          setPreview(data);
        } catch (e: unknown) {
          if (!alive || !isMountedRef.current) return;
          setError(
            toFriendlyErrorMessage(
              e,
              'Chưa thể tải chi tiết hồ sơ quyết toán lúc này. Vui lòng thử lại.'
            )
          );
        } finally {
          if (alive && isMountedRef.current) {
            setLoading(false);
          }
        }
      })();
      return () => {
        alive = false;
      };
    }, [params.id])
  );

  const isLocked = String(preview?.status ?? '').toUpperCase() === 'LOCKED';
  const refCode = useMemo(
    () => (preview ? formatDossierRefCode(preview.dossierId || params.id, preview.taxYear) : ''),
    [params.id, preview]
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.side}
          onPress={() => navigation.goBack()}
          testID="settlementDetailBack"
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          Chi tiết hồ sơ
        </Text>
        <View style={styles.side}>
          <HomeHeaderButton />
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <TouchableOpacity onPress={load} accessibilityRole="button">
            <Text style={styles.link}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : preview ? (
        <>
          <ScrollView
            contentContainerStyle={[
              styles.scroll,
              !isLocked && { paddingBottom: Math.max(insets.bottom, 24) + 16 },
            ]}
            testID="settlementDetailScroll"
          >
            <View style={styles.containerInner}>
              <SettlementResultBlocks preview={preview} locked />
              <Text style={styles.refHint}>Mã tham chiếu hồ sơ: {refCode}</Text>
            </View>
          </ScrollView>
          {isLocked ? (
            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 18) }]}>
              <View style={styles.footerInner}>
                <TouchableOpacity
                  style={styles.exportBtn}
                  testID="settlementDetailPdf"
                  accessibilityRole="button"
                  onPress={() =>
                    navigation.navigate('SettlementExportForm', {
                      dossierId: preview.dossierId || params.id,
                      taxYear: preview.taxYear,
                      refundAmount: preview.refundAmount,
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
                  testID="settlementDetailZip"
                  accessibilityRole="button"
                  onPress={() =>
                    navigation.navigate('SettlementExportForm', {
                      dossierId: preview.dossierId || params.id,
                      taxYear: preview.taxYear,
                      refundAmount: preview.refundAmount,
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
        </>
      ) : null}
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
  scroll: { paddingHorizontal: 22, paddingBottom: 32, paddingTop: 8 },
  containerInner: {
    width: '100%',
    maxWidth: 700,
    alignSelf: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  error: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.error,
    textAlign: 'center',
    maxWidth: 420,
  },
  link: { fontFamily: fonts.bodySemi, color: theme.colors.primary, paddingVertical: 6 },
  refHint: {
    marginTop: 20,
    fontFamily: fonts.body,
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#DED7CB',
    backgroundColor: theme.colors.background,
  },
  footerInner: {
    width: '100%',
    maxWidth: 700,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  exportBtn: {
    flex: 1,
    height: 48,
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
});
