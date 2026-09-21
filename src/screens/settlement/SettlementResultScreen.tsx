import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { RootNavigationProp, RootStackParamList } from '../../navigation/types';
import { settlementApi, SettlementDossierDto } from '../../api/settlementApi';
import {
  canShowPrimaryExport,
  formatDossierStatusLabel,
  getSettlementResultDisclaimer,
} from './settlementResultPlan';
import { apiClient } from '../../api/apiClient';

export const SettlementResultScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'SettlementResult'>>();
  const { dossierId } = route.params;

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [dossier, setDossier] = useState<SettlementDossierDto | null>(null);
  const [downloadPath, setDownloadPath] = useState<string>('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await settlementApi.getDossier(dossierId);
      setDossier(res.data ?? null);
      setDownloadPath(await settlementApi.downloadUrl(dossierId));
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Không thể tải kết quả.';
      Alert.alert('Lỗi', msg);
    } finally {
      setLoading(false);
    }
  }, [dossierId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleExport = async () => {
    try {
      setExporting(true);
      await settlementApi.exportDossier(dossierId);
      await load();
      Alert.alert('Thành công', 'Đã tạo gói ZIP và khóa hồ sơ (nếu đủ điều kiện).');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Xuất hồ sơ thất bại.';
      Alert.alert('Lỗi', msg);
    } finally {
      setExporting(false);
    }
  };

  const openDownload = () => {
    const base = apiClient.defaults.baseURL?.replace(/\/$/, '') ?? '';
    const url = downloadPath.startsWith('http') ? downloadPath : `${base}${downloadPath}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Không mở được liên kết', url);
    });
  };

  const showExport = dossier
    ? canShowPrimaryExport(dossier.status, dossier.isProvisional)
    : false;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} testID="backBtn">
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>KẾT QUẢ QUYẾT TOÁN</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {dossier ? (
            <View style={styles.card} testID="settlementResultStatus">
              <Text style={styles.statusTitle}>
                {formatDossierStatusLabel(dossier.status, dossier.isProvisional)}
              </Text>
              <Text style={styles.line}>Năm {dossier.taxYear} · v{dossier.version}</Text>
              <Text style={styles.line}>Trạng thái: {dossier.status}</Text>
              {dossier.zipFileUrl ? (
                <Text style={styles.line} numberOfLines={2}>
                  ZIP: {dossier.zipFileUrl}
                </Text>
              ) : null}
            </View>
          ) : null}

          <Text style={styles.disclaimer} testID="settlementResultDisclaimer">
            {getSettlementResultDisclaimer()}
          </Text>

          <Text style={styles.hint}>
            Hướng dẫn: Tải gói ZIP, đăng nhập eTax và nộp theo quy trình của Tổng cục Thuế.
          </Text>

          {showExport ? (
            <>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleExport}
                disabled={exporting}
                testID="settlementExportBtn"
              >
                {exporting ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.primaryBtnText}>Xuất & khóa hồ sơ (ZIP)</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={openDownload}
                testID="settlementDownloadBtn"
              >
                <Text style={styles.secondaryBtnText}>Tải file — {downloadPath}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.provisionalNote} testID="settlementProvisionalNote">
              Hồ sơ tạm tính: chưa hiển thị nút tải/khóa chính thức cho đến khi đủ điều kiện.
            </Text>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...theme.typography.titleMedium, color: theme.colors.primary, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: theme.spacing.md, paddingBottom: 40 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  statusTitle: { fontSize: 20, fontWeight: '700', color: theme.colors.primary },
  line: { marginTop: 6, fontSize: 13, color: theme.colors.textSecondary },
  disclaimer: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 20,
    backgroundColor: '#FDF7E7',
    padding: 12,
    borderRadius: theme.borderRadius.md,
    marginBottom: 12,
  },
  hint: { fontSize: 13, color: theme.colors.textPrimary, marginBottom: 16, lineHeight: 18 },
  primaryBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryBtnText: { color: '#FFF', fontWeight: '700' },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  secondaryBtnText: { fontSize: 12, color: theme.colors.primary, textAlign: 'center' },
  provisionalNote: { fontSize: 13, color: theme.colors.textSecondary, fontStyle: 'italic' },
});
