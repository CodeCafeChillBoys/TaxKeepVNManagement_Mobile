import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { RootNavigationProp, RootStackParamList } from '../../navigation/types';
import {
  settlementApi,
  SettlementDossierDto,
  SettlementRuleContextDto,
} from '../../api/settlementApi';
import {
  canConfirmSettlement,
  SETTLEMENT_LI04_DISCLAIMER,
  shouldAutoPrepareOnLoad,
} from './settlementReviewPlan';
import { formatDossierStatusLabel } from './settlementResultPlan';

export const SettlementReviewScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'SettlementReview'>>();
  const { dossierId } = route.params;

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [dossier, setDossier] = useState<SettlementDossierDto | null>(null);
  const [ruleContext, setRuleContext] = useState<SettlementRuleContextDto | null>(null);
  const [commitmentAccepted, setCommitmentAccepted] = useState(false);
  const [blockingWarnings] = useState<string[]>([]);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [dRes, rRes] = await Promise.all([
        settlementApi.getDossier(dossierId),
        settlementApi.getRuleContext(dossierId),
      ]);
      const d = dRes.data ?? null;
      setDossier(d);
      setRuleContext(rRes.data ?? null);

      if (d && shouldAutoPrepareOnLoad(d.status)) {
        await settlementApi.collect(dossierId);
        await settlementApi.calculate(dossierId);
        const refreshed = await settlementApi.getDossier(dossierId);
        setDossier(refreshed.data ?? null);
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Không thể tải hồ sơ quyết toán.';
      Alert.alert('Lỗi', msg);
    } finally {
      setLoading(false);
    }
  }, [dossierId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const runAction = async (key: string, fn: () => Promise<unknown>) => {
    try {
      setBusy(key);
      await fn();
      const refreshed = await settlementApi.getDossier(dossierId);
      setDossier(refreshed.data ?? null);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Thao tác thất bại.';
      Alert.alert('Lỗi', msg);
    } finally {
      setBusy(null);
    }
  };

  const handleConfirm = async () => {
    if (!dossier) return;
    const plan = canConfirmSettlement({
      commitmentAccepted,
      isStale: dossier.isStale,
      blockingWarningCodes: blockingWarnings,
    });
    if (!plan.ok) {
      Alert.alert('Chưa thể xác nhận', plan.message);
      return;
    }
    try {
      setBusy('confirm');
      await settlementApi.confirm(dossierId, { commitmentAccepted: true });
      navigation.replace('SettlementResult', { dossierId });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Xác nhận thất bại.';
      Alert.alert('Lỗi', msg);
    } finally {
      setBusy(null);
    }
  };

  const confirmPlan = dossier
    ? canConfirmSettlement({
        commitmentAccepted,
        isStale: dossier.isStale,
        blockingWarningCodes: blockingWarnings,
      })
    : { ok: false as const, message: '' };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} testID="backBtn">
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>RÀ SOÁT HỒ SƠ</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {dossier ? (
            <View style={styles.statusCard} testID="settlementReviewStatus">
              <Text style={styles.statusTitle}>
                {formatDossierStatusLabel(dossier.status, dossier.isProvisional)}
              </Text>
              <Text style={styles.statusLine}>Mã hồ sơ: {dossier.id}</Text>
              <Text style={styles.statusLine}>Năm {dossier.taxYear} · Phiên bản v{dossier.version}</Text>
              {dossier.isStale ? (
                <View style={styles.staleBanner}>
                  <Ionicons name="warning-outline" size={18} color={theme.colors.error} />
                  <Text style={styles.staleText}>Dữ liệu nguồn đã thay đổi (W-STALE). Vui lòng làm mới.</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {ruleContext ? (
            <View style={styles.ruleCard} testID="settlementRuleContext">
              <Text style={styles.sectionTitle}>Căn cứ pháp lý (B3)</Text>
              <Text style={styles.ruleLine}>Số hiệu: {ruleContext.documentNumber ?? '—'}</Text>
              <Text style={styles.ruleLine}>Ngày chốt: {ruleContext.cutOffDate ?? dossier?.cutOffDate ?? '—'}</Text>
              {ruleContext.pdfUrl ? (
                <Text style={styles.ruleLink} numberOfLines={2}>
                  PDF: {ruleContext.pdfUrl}
                </Text>
              ) : null}
            </View>
          ) : null}

          <View style={styles.actions}>
            <ActionButton
              label="Gom dữ liệu (Collect)"
              testID="settlementCollectBtn"
              loading={busy === 'collect'}
              onPress={() => runAction('collect', () => settlementApi.collect(dossierId))}
            />
            <ActionButton
              label="Tính toán (Calculate)"
              testID="settlementCalculateBtn"
              loading={busy === 'calculate'}
              onPress={() => runAction('calculate', () => settlementApi.calculate(dossierId))}
            />
            {dossier?.isStale ? (
              <ActionButton
                label="Làm mới (Refresh)"
                testID="settlementRefreshBtn"
                loading={busy === 'refresh'}
                onPress={() => runAction('refresh', () => settlementApi.refresh(dossierId))}
              />
            ) : null}
          </View>

          <View style={styles.commitRow}>
            <Switch
              value={commitmentAccepted}
              onValueChange={setCommitmentAccepted}
              testID="settlementCommitmentSwitch"
            />
            <Text style={styles.commitText}>
              Tôi cam kết đã rà soát số liệu và chịu trách nhiệm với nội dung quyết toán.
            </Text>
          </View>

          <Text style={styles.disclaimer}>{SETTLEMENT_LI04_DISCLAIMER}</Text>

          <TouchableOpacity
            style={[styles.confirmBtn, !confirmPlan.ok && styles.confirmDisabled]}
            onPress={handleConfirm}
            disabled={busy === 'confirm'}
            testID="settlementConfirmBtn"
          >
            {busy === 'confirm' ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.confirmText}>Xác nhận hồ sơ</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const ActionButton: React.FC<{
  label: string;
  testID: string;
  loading: boolean;
  onPress: () => void;
}> = ({ label, testID, loading, onPress }) => (
  <TouchableOpacity
    style={styles.actionBtn}
    onPress={onPress}
    disabled={loading}
    testID={testID}
  >
    {loading ? (
      <ActivityIndicator color={theme.colors.primary} />
    ) : (
      <Text style={styles.actionBtnText}>{label}</Text>
    )}
  </TouchableOpacity>
);

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
  statusCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  statusTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.primary },
  statusLine: { marginTop: 4, fontSize: 13, color: theme.colors.textSecondary },
  staleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    padding: 8,
    backgroundColor: '#FFF3F3',
    borderRadius: 8,
  },
  staleText: { flex: 1, fontSize: 12, color: theme.colors.error },
  ruleCard: {
    backgroundColor: '#FAF8F5',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  sectionTitle: { fontWeight: '700', color: theme.colors.textPrimary, marginBottom: 6 },
  ruleLine: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 },
  ruleLink: { fontSize: 12, color: theme.colors.primary, marginTop: 6 },
  actions: { gap: 10, marginBottom: theme.spacing.md },
  actionBtn: {
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionBtnText: { color: theme.colors.primary, fontWeight: '600' },
  commitRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  commitText: { flex: 1, fontSize: 13, color: theme.colors.textPrimary, lineHeight: 18 },
  disclaimer: { fontSize: 12, color: theme.colors.textSecondary, lineHeight: 18, marginBottom: 16 },
  confirmBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  confirmDisabled: { opacity: 0.5 },
  confirmText: { color: '#FFF', fontWeight: '700' },
});
