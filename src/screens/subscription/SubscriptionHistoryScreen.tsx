import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { GoldDoubleRule } from '../../components/brand/GoldDoubleRule';
import { RootNavigationProp } from '../../navigation/types';
import { subscriptionApi } from '../../api/subscriptionApi';
import {
  formatDateVi,
  formatPlanVnd,
  historyStatus,
  HistoryTone,
  paymentMethodLabel,
  planNoun,
  UserSubscription,
} from '../../types/subscription';

const TONE: Record<HistoryTone, { color: string; bg: string }> = {
  active: { color: theme.colors.success, bg: theme.colors.successBackground },
  pending: { color: theme.colors.warning, bg: theme.colors.warningBackground },
  failed: { color: theme.colors.error, bg: theme.colors.errorBackground },
  ended: { color: theme.colors.textSecondary, bg: theme.colors.surfaceSecondary },
};

const cycleLabel = (cycle: string) =>
  cycle === 'yearly' ? 'Theo năm' : cycle === 'monthly' ? 'Theo tháng' : 'Không thời hạn';

export const SubscriptionHistoryScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const [items, setItems] = useState<UserSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (pull = false) => {
    if (pull) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setItems(await subscriptionApi.getHistory());
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Không tải được lịch sử gói. Kiểm tra kết nối mạng rồi tải lại.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const renderItem = ({ item }: { item: UserSubscription }) => {
    const status = historyStatus(item);
    const tone = TONE[status.tone];
    const amount = item.amountPaid ?? 0;
    const from = item.startsAt ? formatDateVi(new Date(item.startsAt)) : null;
    const to = item.expiresAt ? formatDateVi(new Date(item.expiresAt)) : null;
    // Đơn chưa thanh toán xong thì ngày bắt đầu là ngày tạo đơn
    const period =
      status.tone === 'pending' || status.tone === 'failed'
        ? from && `Tạo đơn ${from}`
        : from && (to ? `${from} đến ${to}` : `Từ ${from}`);

    return (
      <View style={styles.row} testID={`subscriptionHistory_${item.id}`}>
        <View style={styles.rowHead}>
          <Text style={styles.planName}>{planNoun(item.planName, true)}</Text>
          <Text style={[styles.amount, status.tone === 'failed' && styles.amountStruck]}>
            {amount > 0 ? formatPlanVnd(amount) : 'Miễn phí'}
          </Text>
        </View>
        <Text style={styles.meta}>
          {cycleLabel(item.billingCycle)}
          {amount > 0 ? `, ${paymentMethodLabel(item.paymentMethod)}` : ''}
        </Text>
        <View style={styles.rowFoot}>
          <Text style={styles.period}>{period ?? ''}</Text>
          <View style={[styles.chip, { backgroundColor: tone.bg }]}>
            <Text style={[styles.chipText, { color: tone.color }]}>{status.label}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.side}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
          testID="subscriptionHistoryBack"
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Lịch sử gói</Text>
        <View style={styles.side} />
      </View>
      <GoldDoubleRule />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <TouchableOpacity onPress={() => load()} accessibilityRole="button">
            <Text style={styles.link}>Tải lại</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[theme.colors.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Chưa có lần mua gói nào</Text>
              <Text style={styles.emptySub}>Các lần mua, nâng cấp và gia hạn gói sẽ hiện ở đây.</Text>
              <TouchableOpacity onPress={() => navigation.navigate('SubscriptionPlans')} accessibilityRole="button">
                <Text style={styles.link}>Xem các gói</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
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
  list: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  row: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  planName: { flexShrink: 1, fontFamily: fonts.serifBold, fontSize: 18, color: theme.colors.textPrimary },
  amount: { fontFamily: fonts.bodySemi, fontSize: 16, color: theme.colors.textPrimary },
  amountStruck: { color: theme.colors.textPlaceholder, textDecorationLine: 'line-through' },
  meta: { fontFamily: fonts.body, fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 },
  rowFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, gap: 12 },
  period: { flexShrink: 1, fontFamily: fonts.body, fontSize: 13, color: theme.colors.textSecondary },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  chipText: { fontFamily: fonts.bodySemi, fontSize: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  error: { fontFamily: fonts.body, color: theme.colors.error, textAlign: 'center' },
  link: { fontFamily: fonts.bodySemi, color: theme.colors.primary, padding: 8 },
  empty: { paddingTop: 48, alignItems: 'flex-start', gap: 6 },
  emptyTitle: { fontFamily: fonts.serifBold, fontSize: 18, color: theme.colors.textPrimary },
  emptySub: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: theme.colors.textSecondary },
});
