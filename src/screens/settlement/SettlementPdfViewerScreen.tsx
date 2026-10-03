import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import * as FileSystem from 'expo-file-system/legacy';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
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
  const { params } = useRoute<Route>();
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<SavedBinaryFile | null>(null);
  const [busy, setBusy] = useState<'view' | 'share' | null>(null);

  const load = useCallback(async () => {
    setPhase('loading');
    setError(null);
    try {
      const saved = await withMinDuration(
        taxSettlementApi.exportPdf(params.dossierId, params.form),
        900
      );
      setFile(saved);
      setPhase('ready');
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        'Không tạo được tờ khai PDF. Thử lại sau.';
      setError(typeof msg === 'string' ? msg : 'Không tạo được tờ khai PDF.');
      setPhase('error');
    }
  }, [params.dossierId, params.form]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const openWithShareSheet = async (target: SavedBinaryFile) => {
    const can = await Sharing.isAvailableAsync();
    if (!can) {
      Alert.alert('Xem PDF', 'Thiết bị không hỗ trợ mở hoặc chia sẻ file.');
      return;
    }
    await Sharing.shareAsync(target.uri, {
      mimeType: target.mimeType,
      dialogTitle: target.fileName,
      UTI: 'com.adobe.pdf',
    });
  };

  /** Mở PDF bằng app xem hệ thống (Android Intent); iOS / lỗi → share sheet. */
  const onView = async () => {
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
    } catch (e: any) {
      try {
        await openWithShareSheet(file);
      } catch {
        Alert.alert('Không mở được PDF', e?.message || 'Thử Chia sẻ rồi chọn ứng dụng xem PDF.');
      }
    } finally {
      setBusy(null);
    }
  };

  const onShare = async () => {
    if (!file) return;
    try {
      setBusy('share');
      await openWithShareSheet(file);
    } catch (e: any) {
      Alert.alert('Chia sẻ thất bại', e?.message || 'Không mở được sheet chia sẻ.');
    } finally {
      setBusy(null);
    }
  };

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
          subtitle="Vui lòng giữ màn hình mở. Tờ khai sẽ sẵn sàng khi xong."
        />
      ) : phase === 'error' ? (
        <View style={styles.center} testID="pdfError">
          <Ionicons name="alert-circle-outline" size={40} color={theme.colors.error} />
          <Text style={styles.error}>{error}</Text>
          <TouchableOpacity style={styles.cta} onPress={load} testID="pdfRetry">
            <Text style={styles.ctaText}>Thử lại</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.link}>Quay lại form</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.body} testID="pdfReady">
          <View style={styles.card}>
            <Ionicons name="document-text" size={36} color={theme.colors.primary} />
            <Text style={styles.fileName}>{file?.fileName}</Text>
            <Text style={styles.hint}>
              Tờ khai đã sẵn sàng. Bấm Xem tờ khai để mở PDF bằng ứng dụng trên máy.
            </Text>
          </View>
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cta}
              onPress={onView}
              disabled={busy !== null}
              testID="pdfViewBtn"
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
            <TouchableOpacity style={styles.ghost} onPress={() => navigation.goBack()} testID="pdfDone">
              <Text style={styles.ghostText}>Xong</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F5EE' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 },
  error: { fontFamily: fonts.body, fontSize: 14, color: theme.colors.error, textAlign: 'center' },
  link: { fontFamily: fonts.bodySemi, fontSize: 15, color: theme.colors.primary, marginTop: 8 },
  body: { flex: 1, paddingHorizontal: 22, paddingTop: 24 },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#DED7CB',
    borderRadius: 4,
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
  footer: { marginTop: 'auto', paddingBottom: 24, gap: 10 },
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
