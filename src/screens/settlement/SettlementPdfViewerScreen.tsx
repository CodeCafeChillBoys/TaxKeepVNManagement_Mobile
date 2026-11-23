import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import * as FileSystem from 'expo-file-system/legacy';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { useToast } from '../../components/ui/Toast';
import { toFriendlyErrorMessage } from '../../utils/friendlyError';
import { SettlementExportHeader } from '../../components/navigation/SettlementExportHeader';
import {
  SettlementExportLoadingPanel,
  withMinDuration,
} from '../../components/settlement/SettlementExportLoadingPanel';
import { RootNavigationProp, RootStackParamList } from '../../navigation/types';
import { taxSettlementApi, SavedBinaryFile } from '../../api/taxSettlementApi';

type Route = RouteProp<RootStackParamList, 'SettlementPdfViewer'>;

type Phase = 'loading' | 'ready' | 'error';

export const SettlementPdfViewerScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const { params } = useRoute<Route>();
  const isMountedRef = useRef(true);
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<SavedBinaryFile | null>(null);
  const [busy, setBusy] = useState<'view' | 'share' | null>(null);

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
      const saved = await withMinDuration(
        taxSettlementApi.exportPdf(params.dossierId, params.form),
        900
      );
      if (!isMountedRef.current) return;
      setFile(saved);
      setPhase('ready');
    } catch (e: unknown) {
      if (!isMountedRef.current) return;
      const friendly = toFriendlyErrorMessage(
        e,
        'Chưa thể khởi tạo tờ khai PDF lúc này. Vui lòng thử lại sau ít phút.'
      );
      setError(friendly);
      setPhase('error');
      toast.error(friendly, 'Chưa thể tạo tờ khai');
    }
  }, [params.dossierId, params.form, toast]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        setPhase('loading');
        setError(null);
        try {
          const saved = await withMinDuration(
            taxSettlementApi.exportPdf(params.dossierId, params.form),
            900
          );
          if (!alive || !isMountedRef.current) return;
          setFile(saved);
          setPhase('ready');
        } catch (e: unknown) {
          if (!alive || !isMountedRef.current) return;
          const friendly = toFriendlyErrorMessage(
            e,
            'Chưa thể khởi tạo tờ khai PDF lúc này. Vui lòng thử lại sau ít phút.'
          );
          setError(friendly);
          setPhase('error');
          toast.error(friendly, 'Chưa thể tạo tờ khai');
        }
      })();
      return () => {
        alive = false;
      };
    }, [params.dossierId, params.form, toast])
  );

  const openWithShareSheet = useCallback(
    async (target: SavedBinaryFile): Promise<boolean> => {
      const can = await Sharing.isAvailableAsync();
      if (!can) {
        toast.warning(
          'Thiết bị hiện tại chưa hỗ trợ mở hoặc chia sẻ tệp tờ khai trực tiếp.',
          'Chưa hỗ trợ chia sẻ'
        );
        return false;
      }
      await Sharing.shareAsync(target.uri, {
        mimeType: target.mimeType,
        dialogTitle: target.fileName,
        UTI: 'com.adobe.pdf',
      });
      return true;
    },
    [toast]
  );

  /** Mở PDF bằng ứng dụng xem hệ thống (Android Intent); iOS hoặc dự phòng → bảng chia sẻ. */
  const onView = useCallback(async () => {
    if (!file) return;
    try {
      setBusy('view');
      if (Platform.OS === 'android') {
        const contentUri = await FileSystem.getContentUriAsync(file.uri);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1,
          type: 'application/pdf',
        });
        return;
      }
      await openWithShareSheet(file);
    } catch (e: unknown) {
      try {
        await openWithShareSheet(file);
      } catch (fallbackErr: unknown) {
        if (!isMountedRef.current) return;
        toast.error(
          toFriendlyErrorMessage(
            fallbackErr ?? e,
            'Vui lòng bấm "Chia sẻ" rồi chọn ứng dụng đọc tờ khai PDF trên thiết bị.'
          ),
          'Chưa mở được tờ khai'
        );
      }
    } finally {
      if (isMountedRef.current) {
        setBusy(null);
      }
    }
  }, [file, openWithShareSheet, toast]);

  const onShare = useCallback(async () => {
    if (!file) return;
    try {
      setBusy('share');
      const shared = await openWithShareSheet(file);
      if (shared && isMountedRef.current) {
        toast.success('Tệp tờ khai quyết toán đã sẵn sàng để lưu trữ.', 'Đã mở bảng chia sẻ');
      }
    } catch (e: unknown) {
      if (!isMountedRef.current) return;
      toast.error(
        toFriendlyErrorMessage(
          e,
          'Chưa thể mở bảng chia sẻ tệp tờ khai lúc này. Vui lòng thử lại.'
        ),
        'Chưa thể chia sẻ tờ khai'
      );
    } finally {
      if (isMountedRef.current) {
        setBusy(null);
      }
    }
  }, [file, openWithShareSheet, toast]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <SettlementExportHeader
        title={phase === 'loading' ? 'Xuất tờ khai PDF' : 'Tờ khai PDF'}
        backTestID="pdfViewerBack"
        homeTestID="pdfViewerHome"
      />

      {phase === 'loading' ? (
        <SettlementExportLoadingPanel
          testID="pdfLoading"
          title="Đang tạo tờ khai 02/QTT-TNCN…"
          subtitle="Vui lòng giữ màn hình mở. Tờ khai sẽ sẵn sàng ngay khi hoàn tất."
        />
      ) : phase === 'error' ? (
        <View style={styles.center} testID="pdfError">
          <Ionicons name="alert-circle-outline" size={40} color={theme.colors.error} />
          <Text style={styles.error}>{error}</Text>
          <TouchableOpacity style={styles.cta} onPress={load} testID="pdfRetry">
            <Text style={styles.ctaText}>Thử lại</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button">
            <Text style={styles.link}>Quay lại thông tin tờ khai</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.scrollBody,
            { paddingBottom: Math.max(insets.bottom, 24) },
          ]}
          testID="pdfReady"
        >
          <View style={styles.containerInner}>
            <View style={styles.card}>
              <Ionicons name="document-text" size={36} color={theme.colors.primary} />
              <Text style={styles.fileName}>{file?.fileName}</Text>
              <Text style={styles.hint}>
                Tờ khai 02/QTT-TNCN đã sẵn sàng. Bấm "Xem tờ khai" để mở bằng ứng dụng trên thiết bị hoặc chia sẻ lưu trữ.
              </Text>
            </View>
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.cta}
                onPress={onView}
                disabled={busy !== null}
                testID="pdfViewBtn"
                accessibilityRole="button"
              >
                {busy === 'view' ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="eye-outline" size={18} color="#fff" />
                    <Text style={styles.ctaText}>Xem tờ khai</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondary}
                onPress={onShare}
                disabled={busy !== null}
                testID="pdfShareBtn"
                accessibilityRole="button"
              >
                {busy === 'share' ? (
                  <ActivityIndicator color={theme.colors.primary} />
                ) : (
                  <View style={styles.secondaryRow}>
                    <Ionicons name="share-outline" size={18} color={theme.colors.primary} />
                    <Text style={styles.secondaryText}>Chia sẻ</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.ghost}
                onPress={() => navigation.goBack()}
                testID="pdfDone"
                accessibilityRole="button"
              >
                <Text style={styles.ghostText}>Hoàn tất</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      )}
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
  link: { fontFamily: fonts.bodySemi, fontSize: 15, color: theme.colors.primary, marginTop: 8 },
  scrollBody: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 24 },
  containerInner: {
    flex: 1,
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#DED7CB',
    borderRadius: 10,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  fileName: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  hint: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: '#666', textAlign: 'center' },
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
  ctaText: { fontFamily: fonts.bodyBold, fontSize: 16, color: '#fff' },
  secondary: {
    height: 52,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  secondaryText: { fontFamily: fonts.bodyBold, fontSize: 16, color: theme.colors.primary },
  ghost: { height: 44, alignItems: 'center', justifyContent: 'center' },
  ghostText: { fontFamily: fonts.bodySemi, fontSize: 15, color: '#666' },
});
