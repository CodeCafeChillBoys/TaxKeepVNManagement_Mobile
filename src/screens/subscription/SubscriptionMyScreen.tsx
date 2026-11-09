import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { GoldDoubleRule } from '../../components/brand/GoldDoubleRule';
import { Dialog } from '../../components/common/Dialog';
import { RootNavigationProp } from '../../navigation/types';
import { subscriptionApi } from '../../api/subscriptionApi';
import {
  formatDateVi,
  friendlyPlanName,
  friendlyPlanNoun,
  SubscriptionQuotaStatus,
  UNLIMITED,
  usageRatio,
} from '../../types/subscription';

const UsageRow: React.FC<{ label: string; used: number; max: number; period?: string }> = ({
  label,
  used,
  max,
  period,
}) => {
  const ratio = usageRatio(used, max);
  const color =
    ratio === null || ratio < 0.8 ? theme.colors.primary : ratio < 1 ? theme.colors.warning : theme.colors.error;
  return (
    <View style={styles.usage}>
      <View style={styles.usageHead}>
        <Text style={styles.usageLabel}>{label}</Text>
        <Text style={styles.usageValue}>{max === UNLIMITED ? `${used} / Không giới hạn` : `${used} / ${max}`}</Text>
      </View>
      {ratio !== null ? (
        <View
          style={styles.track}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max, now: Math.min(used, max) }}
        >
          <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: color }]} />
        </View>
      ) : null}
      {max !== UNLIMITED && used > max ? (
        <Text style={[styles.usagePeriod, styles.over]}>
          Đã đạt mức tối đa của gói: dữ liệu đã lưu vẫn an toàn, tạm thời chưa thể thêm mới
        </Text>
      ) : period ? (
        <Text style={styles.usagePeriod}>{period}</Text>
      ) : null}
    </View>
  );
};

const DotLeader: React.FC = () => (
  <View style={styles.leaderClip}>
    <View style={styles.leader} />
  </View>
);

export const SubscriptionMyScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const [quota, setQuota] = useState<SubscriptionQuotaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async (pull = false) => {
    if (pull) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setQuota(await subscriptionApi.getQuota());
    } catch (e: any) {
      setError(
        e?.response?.data?.message ||
          e?.message ||
          'Không thể tải thông tin gói dịch vụ. Bạn vui lòng kiểm tra kết nối mạng rồi thử lại.'
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

  const doCancel = async () => {
    setCancelling(true);
    try {
      await subscriptionApi.cancel();
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Chưa thể hủy gói dịch vụ lúc này. Bạn vui lòng thử lại sau.');
    } finally {
      setConfirmCancel(false);
      setCancelling(false);
    }
  };

  const isPaid = !!quota && quota.billingCycle !== 'free';
  const now = new Date();
  const monthLabel = `Tháng ${now.getMonth() + 1}/${now.getFullYear()} · Tự động làm mới vào ngày 1 tháng sau`;

  const booking: string[] = [];
  if (quota?.bookingDiscountPercent) booking.push(`Giảm ${quota.bookingDiscountPercent}% chi phí`);
  if (quota?.freeConsultationsPerYear) booking.push(`Miễn phí ${quota.freeConsultationsPerYear} buổi/năm`);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.side}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
          testID="subscriptionMyBack"
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Gói của tôi</Text>
        <View style={styles.side} />
      </View>
      <GoldDoubleRule />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : !quota ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <TouchableOpacity onPress={() => load()} accessibilityRole="button">
            <Text style={styles.link}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={styles.content}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[theme.colors.primary]} />
            }
          >
            <View style={styles.sheet} testID="subscriptionMySheet">
              <Text style={styles.planName}>{friendlyPlanName(quota.planName)}</Text>
              <Text style={styles.sub}>
                {isPaid
                  ? `${quota.billingCycle === 'yearly' ? 'Gói đăng ký theo năm' : 'Gói đăng ký theo tháng'}${
                      quota.expiresAt ? ` · Hết hạn ngày ${formatDateVi(new Date(quota.expiresAt))}` : ''
                    }`
                  : 'Gói miễn phí · Sử dụng dài lâu, không giới hạn thời gian'}
              </Text>
              {isPaid && quota.remainingDays != null ? (
                <Text style={styles.days}>Còn {quota.remainingDays} ngày sử dụng</Text>
              ) : null}

              <View style={styles.rule} />
              <UsageRow
                label="Lượt hỏi Trợ lý thuế"
                used={quota.aiQuestionsUsed}
                max={quota.maxAiQuestionsPerMonth}
                period={monthLabel}
              />
              <UsageRow
                label="Lượt quét hóa đơn, chứng từ"
                used={quota.ocrScansUsed}
                max={quota.maxOcrScansPerMonth}
                period={monthLabel}
              />
              <UsageRow
                label="Số nguồn thu nhập"
                used={quota.currentIncomeSourcesCount}
                max={quota.maxIncomeSources}
              />
              <UsageRow
                label="Số người phụ thuộc"
                used={quota.currentDependentsCount}
                max={quota.maxDependents}
              />

              <View style={styles.rule} />
              {[
                {
                  label: 'Tải tờ khai thuế (Mẫu 02/QTT-TNCN)',
                  value: quota.canExportPdf ? 'Được tải về' : 'Chỉ xem trước',
                  on: quota.canExportPdf,
                },
                {
                  label: 'Tải trọn bộ hồ sơ chứng từ',
                  value: quota.canExportZip ? 'Được tải về' : 'Chưa hỗ trợ',
                  on: quota.canExportZip,
                },
                {
                  label: 'Tư vấn cùng chuyên gia thuế',
                  value: booking.length ? booking.join(' · ') : 'Theo giá chuẩn',
                  on: booking.length > 0,
                },
              ].map((r) => (
                <View key={r.label} style={styles.row}>
                  <Text style={[styles.rowLabel, !r.on && styles.muted]}>{r.label}</Text>
                  <DotLeader />
                  <Text style={[styles.rowValue, !r.on && styles.muted]}>{r.value}</Text>
                </View>
              ))}
            </View>

            {error ? <Text style={styles.errorInline}>{error}</Text> : null}

            {isPaid ? (
              <>
                <Text style={styles.note}>
                  {`${friendlyPlanNoun(quota.planName, true)} được sử dụng đến hết ngày ${
                    quota.expiresAt ? formatDateVi(new Date(quota.expiresAt)) : 'thời hạn đăng ký'
                  }. Sau thời gian này, tài khoản sẽ tự động chuyển về gói Cơ bản. Bạn không cần thao tác hủy gói nếu muốn dùng đến hết hạn.`}
                </Text>
                <TouchableOpacity
                  style={styles.cancel}
                  onPress={() => setConfirmCancel(true)}
                  accessibilityRole="button"
                  testID="subscriptionMyCancel"
                >
                  <Text style={styles.cancelText}>Hủy gói trước thời hạn</Text>
                </TouchableOpacity>
              </>
            ) : null}

            <TouchableOpacity
              style={styles.historyLink}
              onPress={() => navigation.navigate('SubscriptionHistory')}
              accessibilityRole="button"
              testID="subscriptionMyHistory"
            >
              <Ionicons name="time-outline" size={18} color={theme.colors.primary} />
              <Text style={styles.historyText}>Lịch sử đăng ký gói</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.primary} />
            </TouchableOpacity>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cta}
              onPress={() => navigation.navigate('SubscriptionPlans')}
              accessibilityRole="button"
              testID="subscriptionMyPlans"
            >
              <Text style={styles.ctaText}>{isPaid ? 'Đổi sang gói khác' : 'Nâng cấp gói dịch vụ'}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}


      <Dialog
        visible={confirmCancel}
        title={`Xác nhận hủy ${friendlyPlanNoun(quota?.planName ?? 'gói dịch vụ')}?`}
        message={`Gói dịch vụ sẽ dừng hiệu lực ngay và tài khoản được chuyển về gói Cơ bản. ${
          quota?.remainingDays != null ? `${quota.remainingDays} ngày sử dụng còn lại` : 'Thời gian sử dụng còn lại'
        } sẽ không được hoàn phí. Bạn vẫn có thể tiếp tục sử dụng các quyền lợi của gói Cơ bản.`}
        primaryLabel={cancelling ? 'Đang xử lý...' : 'Xác nhận hủy'}
        secondaryLabel="Giữ lại gói"
        destructive
        onPrimary={() => {
          if (!cancelling) void doCancel();
        }}
        onSecondary={() => setConfirmCancel(false)}
        testID="subscriptionMyCancelDialog"
      />
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
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
  sheet: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: theme.colors.surface,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  planName: { fontFamily: fonts.serifBold, fontSize: 26, color: theme.colors.textPrimary },
  sub: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: theme.colors.textSecondary, marginTop: 4 },
  days: { fontFamily: fonts.bodySemi, fontSize: 14, color: theme.colors.primary, marginTop: 2 },
  rule: { height: 1, backgroundColor: theme.colors.border, marginTop: 16, marginBottom: 6 },

  usage: { paddingVertical: 10 },
  usageHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  usageLabel: { fontFamily: fonts.body, fontSize: 14, color: theme.colors.textPrimary },
  usageValue: { fontFamily: fonts.bodySemi, fontSize: 14, color: theme.colors.textPrimary },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.surfaceSecondary,
    marginTop: 8,
    overflow: 'hidden',
  },
  fill: { height: 6, borderRadius: 3 },
  over: { color: theme.colors.error },
  usagePeriod: { fontFamily: fonts.body, fontSize: 12, color: theme.colors.textSecondary, marginTop: 4 },

  row: { flexDirection: 'row', alignItems: 'flex-end', paddingVertical: 8 },
  rowLabel: { fontFamily: fonts.body, fontSize: 14, color: theme.colors.textPrimary, flexShrink: 1 },
  rowValue: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    color: theme.colors.textPrimary,
    textAlign: 'right',
    maxWidth: '48%',
  },
  muted: { color: theme.colors.textPlaceholder },
  // Viền chấm 1 cạnh không ổn định trên Android: vẽ khung chấm đầy đủ rồi cắt chỉ lấy cạnh trên
  leaderClip: { flex: 1, minWidth: 16, height: 1, overflow: 'hidden', marginHorizontal: 6, marginBottom: 5 },
  leader: { height: 3, borderWidth: 1, borderStyle: 'dotted', borderColor: theme.colors.textPlaceholder },

  historyLink: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, marginTop: 10 },
  historyText: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 14, color: theme.colors.primary },
  cancel: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', marginTop: 4 },
  cancelText: { fontFamily: fonts.bodySemi, fontSize: 14, color: theme.colors.error },
  note: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: theme.colors.textSecondary, marginTop: 14 },
  errorInline: { fontFamily: fonts.body, fontSize: 14, color: theme.colors.error, marginTop: 14 },

  footer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  cta: {
    minHeight: 52,
    borderRadius: 8,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  ctaText: { fontFamily: fonts.bodySemi, fontSize: 16, color: theme.colors.textOnPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  error: { fontFamily: fonts.body, color: theme.colors.error, textAlign: 'center' },
  link: { fontFamily: fonts.bodySemi, color: theme.colors.primary, padding: 8 },
});
