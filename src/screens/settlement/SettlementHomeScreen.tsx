import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { RootNavigationProp, RootStackParamList } from '../../navigation/types';
import {
  settlementApi,
  SettlementDossierDto,
} from '../../api/settlementApi';
import {
  buildTaxYearOptions,
  findContinuableDossier,
  mapSettlementCreateError,
  planStartSettlement,
} from './settlementHomePlan';
import { formatDossierStatusLabel } from './settlementResultPlan';
import { SETTLEMENT_LI04_DISCLAIMER } from './settlementReviewPlan';

const NOW_YEAR = new Date().getFullYear();

export const SettlementHomeScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'SettlementHome'>>();
  const prefillYear = route.params?.taxYear;

  const yearOptions = useMemo(() => buildTaxYearOptions(NOW_YEAR), []);
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    const initial = prefillYear ?? NOW_YEAR;
    return initial <= NOW_YEAR ? initial : NOW_YEAR;
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dossiers, setDossiers] = useState<SettlementDossierDto[]>([]);

  const fetchDossiers = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const res = await settlementApi.listDossiers(selectedYear);
      setDossiers(res.data ?? []);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Không thể tải danh sách hồ sơ quyết toán.';
      Alert.alert('Lỗi', msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    fetchDossiers();
  }, [fetchDossiers]);

  const continuable = findContinuableDossier(dossiers, selectedYear);

  const openReview = (dossierId: string) => {
    navigation.navigate('SettlementReview', { dossierId });
  };

  const handlePrimaryCta = async () => {
    const plan = planStartSettlement(selectedYear, NOW_YEAR);
    if (!plan.ok) {
      Alert.alert('Không hợp lệ', plan.message);
      return;
    }
    if (continuable) {
      openReview(continuable.id);
      return;
    }
    try {
      setSubmitting(true);
      const res = await settlementApi.createDossier({ taxYear: selectedYear });
      const id = res.data?.id;
      if (!id) {
        Alert.alert('Lỗi', 'Không nhận được mã hồ sơ từ máy chủ.');
        return;
      }
      openReview(id);
    } catch (err: unknown) {
      Alert.alert('Không tạo được hồ sơ', mapSettlementCreateError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          testID="backBtn"
          accessibilityLabel="Quay lại"
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>QUYẾT TOÁN THUẾ</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.banner}>
        <Ionicons name="calculator-outline" size={22} color={theme.colors.primary} />
        <Text style={styles.bannerText}>
          Lập hồ sơ quyết toán thuế TNCN theo năm. {SETTLEMENT_LI04_DISCLAIMER}
        </Text>
      </View>

      <View style={styles.yearRow}>
        <Text style={styles.yearLabel}>Năm tính thuế:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.yearScroll}>
          {yearOptions.map((yr) => {
            const selected = selectedYear === yr;
            return (
              <TouchableOpacity
                key={yr}
                style={[styles.yearChip, selected && styles.yearChipSelected]}
                onPress={() => setSelectedYear(yr)}
                testID={`settlementYear_${yr}`}
              >
                <Text style={[styles.yearChipText, selected && styles.yearChipTextSelected]}>
                  {yr}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={dossiers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchDossiers(true)} />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>Chưa có hồ sơ nào cho năm {selectedYear}.</Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => openReview(item.id)}
              testID={`settlementDossier_${item.id}`}
            >
              <Text style={styles.cardTitle}>
                Hồ sơ v{item.version} — {formatDossierStatusLabel(item.status, item.isProvisional)}
              </Text>
              <Text style={styles.cardMeta}>Trạng thái: {item.status}</Text>
              {item.isStale ? (
                <Text style={styles.staleTag}>Cần làm mới dữ liệu</Text>
              ) : null}
            </TouchableOpacity>
          )}
        />
      )}

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.ctaBtn, submitting && styles.ctaDisabled]}
          onPress={handlePrimaryCta}
          disabled={submitting}
          testID="settlementPrimaryCta"
        >
          {submitting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.ctaText}>
              {continuable ? 'Tiếp tục hồ sơ nháp' : 'Tạo hồ sơ quyết toán'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
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
  headerTitle: {
    ...theme.typography.titleMedium,
    color: theme.colors.primary,
    fontWeight: '700',
  },
  banner: {
    flexDirection: 'row',
    gap: 10,
    margin: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: '#FDF7E7',
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: '#E8DED1',
  },
  bannerText: { flex: 1, ...theme.typography.caption, color: theme.colors.textSecondary, lineHeight: 18 },
  yearRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.md },
  yearLabel: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, marginRight: 8 },
  yearScroll: { gap: 8 },
  yearChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#FAF5EE',
    borderWidth: 1,
    borderColor: '#E8DED1',
  },
  yearChipSelected: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  yearChipText: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary },
  yearChipTextSelected: { color: '#FFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: theme.spacing.md, paddingBottom: 100 },
  emptyText: { textAlign: 'center', color: theme.colors.textSecondary, marginTop: 24 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardTitle: { fontWeight: '700', color: theme.colors.textPrimary },
  cardMeta: { marginTop: 4, fontSize: 12, color: theme.colors.textSecondary },
  staleTag: { marginTop: 6, fontSize: 12, color: theme.colors.error, fontWeight: '600' },
  footer: {
    padding: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  ctaBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  ctaDisabled: { opacity: 0.7 },
  ctaText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
});
