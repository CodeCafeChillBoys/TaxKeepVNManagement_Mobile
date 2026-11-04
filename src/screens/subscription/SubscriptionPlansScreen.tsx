import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { GoldDoubleRule } from '../../components/brand/GoldDoubleRule';
import { RootNavigationProp } from '../../navigation/types';
import { subscriptionApi } from '../../api/subscriptionApi';
import {
  BillingCycle,
  freeMonthsOfYearly,
  planBenefits,
  planNoun,
  planPrice,
  SubscriptionPlan,
  UserSubscription,
} from '../../types/subscription';

/** Đường chấm nối nhãn và giá trị, như ô điền trên tờ khai */
const DotLeader: React.FC = () => (
  <View style={styles.leaderClip}>
    <View style={styles.leader} />
  </View>
);

export const SubscriptionPlansScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [current, setCurrent] = useState<UserSubscription | null>(null);
  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async (pull = false) => {
    if (pull) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [planList, mine] = await Promise.all([
        subscriptionApi.getPlans(),
        // Không có gói hiện tại vẫn hiển thị được danh sách
        subscriptionApi.getMySubscription().catch(() => null),
      ]);
      setPlans(planList);
      setCurrent(mine);
      setSelectedId((prev) =>
        prev && planList.some((p) => p.id === prev) ? prev : (mine?.planId ?? planList[0]?.id ?? null)
      );
    } catch (e: any) {
      setError(
        e?.response?.data?.message || e?.message || 'Không tải được danh sách gói. Kiểm tra kết nối mạng rồi tải lại.'
      );
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

  const selected = plans.find((p) => p.id === selectedId) ?? plans[0];
  const yearlyGift = Math.max(0, ...plans.map(freeMonthsOfYearly));

  const renderSheet = (plan: SubscriptionPlan) => {
    const isCurrent = current?.planId === plan.id;
    const price = planPrice(plan, cycle);
    const freeMonths = cycle === 'yearly' ? freeMonthsOfYearly(plan) : 0;

    return (
      <View style={styles.sheet} testID={`subscriptionPlan_${plan.slug}`}>
        {isCurrent ? (
          <View style={styles.currentBar} accessible accessibilityLabel="Gói bạn đang dùng">
            <Ionicons name="checkmark-circle" size={16} color={theme.colors.primaryDark} />
            <Text style={styles.currentText}>Gói bạn đang dùng</Text>
            {current?.remainingDays != null ? (
              <Text style={styles.currentDays}>Còn {current.remainingDays} ngày</Text>
            ) : null}
          </View>
        ) : null}

        <Text style={styles.planName}>{plan.name}</Text>
        {plan.description ? <Text style={styles.desc}>{plan.description}</Text> : null}

        <View style={styles.priceRow}>
          <Text style={styles.price}>{price.amount}</Text>
          {price.suffix ? <Text style={styles.priceSuffix}>{price.suffix}</Text> : null}
        </View>
        {freeMonths > 0 ? <Text style={styles.gift}>Đã gồm {freeMonths} tháng tặng khi mua theo năm</Text> : null}

        <View style={styles.rule} />

        {planBenefits(plan).map((b) => (
          <View key={b.label} style={styles.benefitRow}>
            <Text style={[styles.benefitLabel, !b.included && styles.muted]}>{b.label}</Text>
            <DotLeader />
            <Text style={[styles.benefitValue, !b.included && styles.muted]}>{b.value}</Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.side}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
          testID="subscriptionPlansBack"
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Gói dịch vụ</Text>
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
      ) : !selected ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Chưa có gói nào mở bán</Text>
          <Text style={styles.emptySub}>Quản trị viên chưa mở bán gói nào.</Text>
          <TouchableOpacity onPress={() => load()} accessibilityRole="button">
            <Text style={styles.link}>Tải lại</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[theme.colors.primary]} />
          }
        >
          <View style={styles.cycleWrap} accessibilityRole="tablist">
            {(['monthly', 'yearly'] as BillingCycle[]).map((c) => {
              const active = cycle === c;
              return (
                <TouchableOpacity
                  key={c}
                  style={[styles.cycleBtn, active && styles.cycleBtnActive]}
                  onPress={() => setCycle(c)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  testID={`subscriptionCycle_${c}`}
                >
                  <Text style={[styles.cycleText, active && styles.cycleTextActive]}>
                    {c === 'monthly' ? 'Theo tháng' : 'Theo năm'}
                  </Text>
                  {c === 'yearly' && yearlyGift > 0 ? (
                    <Text style={[styles.cycleSub, active && styles.cycleSubActive]}>Tặng {yearlyGift} tháng</Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.tabs} accessibilityRole="tablist">
            {plans.map((p) => {
              const active = p.id === selected.id;
              const price = planPrice(p, cycle);
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.tab, active && styles.tabActive]}
                  onPress={() => setSelectedId(p.id)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  testID={`subscriptionTab_${p.slug}`}
                >
                  <View style={styles.tabNameRow}>
                    {current?.planId === p.id ? <View style={styles.tabDot} /> : null}
                    <Text style={[styles.tabName, active && styles.tabNameActive]} numberOfLines={1}>
                      {p.name}
                    </Text>
                  </View>
                  <Text style={styles.tabPrice} numberOfLines={1}>
                    {price.amount}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {renderSheet(selected)}
        </ScrollView>
      )}

      {selected && !loading && !error
        ? (() => {
            const isCurrent = current?.planId === selected.id;
            const isFree = (cycle === 'yearly' ? selected.priceYearly : selected.priceMonthly) <= 0;
            // Cùng gói: chỉ cho đổi chu kỳ; đang dùng đúng gói + chu kỳ thì không hiện nút
            if (isCurrent && (isFree || current?.billingCycle === cycle)) return null;
            // Mua gói miễn phí khi đang có gói trả phí: BE hủy gói trả phí ngay, không hoàn tiền -> không cho chọn
            const hasPaidPlan = !!current && current.billingCycle !== 'free';
            if (isFree && hasPaidPlan) {
              return (
                <View style={styles.footer}>
                  <Text style={styles.footerNote}>
                    {`Bạn đang dùng ${current?.planName}${
                      current?.remainingDays != null ? `, còn ${current.remainingDays} ngày` : ''
                    }. Khi hết hạn, tài khoản tự chuyển về ${selected.name}.`}
                  </Text>
                </View>
              );
            }
            return (
              <View style={styles.footer}>
                <TouchableOpacity
                  style={styles.cta}
                  onPress={() =>
                    navigation.navigate('SubscriptionCheckout', {
                      plan: selected,
                      cycle,
                      currentPlanName: current?.planName,
                    })
                  }
                  accessibilityRole="button"
                  testID="subscriptionPlansChoose"
                >
                  <Text style={styles.ctaText}>
                    {isCurrent
                      ? `Chuyển sang thanh toán ${cycle === 'yearly' ? 'theo năm' : 'theo tháng'}`
                      : `Chọn ${planNoun(selected.name)}`}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })()
        : null}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    height: 52,
  },
  side: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.serifBold,
    fontSize: 20,
    color: theme.colors.textPrimary,
  },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },

  cycleWrap: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceSecondary,
  },
  cycleBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cycleBtnActive: { backgroundColor: theme.colors.surface },
  cycleText: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  cycleTextActive: { color: theme.colors.textPrimary },
  cycleSub: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  cycleSubActive: { color: theme.colors.success },

  tabs: { flexDirection: 'row', gap: 8, marginTop: 18 },
  tab: {
    flex: 1,
    minHeight: 56,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.border,
  },
  tabActive: { borderBottomColor: theme.colors.gold, borderBottomWidth: 3 },
  tabName: {
    fontFamily: fonts.bodySemi,
    fontSize: 15,
    color: theme.colors.textSecondary,
  },
  tabNameActive: { color: theme.colors.textPrimary },
  tabPrice: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },

  sheet: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 14,
    backgroundColor: theme.colors.surface,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  planName: {
    fontFamily: fonts.serifBold,
    fontSize: 26,
    color: theme.colors.textPrimary,
  },
  desc: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 14 },
  price: {
    fontFamily: fonts.serifBold,
    fontSize: 34,
    color: theme.colors.primary,
  },
  priceSuffix: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: theme.colors.textSecondary,
    marginLeft: 4,
  },
  gift: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: theme.colors.success,
    marginTop: 2,
  },
  rule: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginTop: 16,
    marginBottom: 6,
  },

  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingVertical: 8,
  },
  benefitLabel: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: theme.colors.textPrimary,
    flexShrink: 1,
  },
  benefitValue: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    color: theme.colors.textPrimary,
    textAlign: 'right',
    maxWidth: '48%',
  },
  muted: { color: theme.colors.textPlaceholder },
  // Viền chấm 1 cạnh không ổn định trên Android: vẽ khung chấm đầy đủ rồi cắt chỉ lấy cạnh trên
  leaderClip: {
    flex: 1,
    minWidth: 16,
    height: 1,
    overflow: 'hidden',
    marginHorizontal: 6,
    marginBottom: 5,
  },
  leader: {
    height: 3,
    borderWidth: 1,
    borderStyle: 'dotted',
    borderColor: theme.colors.textPlaceholder,
  },

  currentBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: -20,
    marginTop: -22,
    marginBottom: 18,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: theme.colors.goldLight,
  },
  currentText: {
    flex: 1,
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    color: theme.colors.primaryDark,
  },
  currentDays: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: theme.colors.primaryDark,
  },
  tabNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tabDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.gold,
  },

  footer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  footerNote: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 6,
  },
  cta: {
    minHeight: 52,
    borderRadius: 8,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  ctaText: {
    fontFamily: fonts.bodySemi,
    fontSize: 16,
    color: theme.colors.textOnPrimary,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 10,
  },
  error: {
    fontFamily: fonts.body,
    color: theme.colors.error,
    textAlign: 'center',
  },
  link: { fontFamily: fonts.bodySemi, color: theme.colors.primary, padding: 8 },
  emptyTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 18,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  emptySub: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
});
