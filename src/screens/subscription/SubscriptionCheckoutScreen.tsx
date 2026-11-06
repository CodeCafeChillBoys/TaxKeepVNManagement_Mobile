import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Linking,
  AppState,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { config } from '../../constants/config';
import { fonts } from '../../constants/fonts';
import { GoldDoubleRule } from '../../components/brand/GoldDoubleRule';
import { RootNavigationProp, RootStackParamList } from '../../navigation/types';
import { subscriptionApi } from '../../api/subscriptionApi';
import { walletApi } from '../../api/walletApi';
import {
  expectedExpiry,
  formatDateVi,
  formatPlanVnd,
  freeMonthsOfYearly,
  PaymentMethod,
  planNoun,
  purchaseOutcome,
  SUBSCRIPTION_RETURN_PATH,
  SubscriptionPurchaseResult,
} from '../../types/subscription';

type Route = RouteProp<RootStackParamList, 'SubscriptionCheckout'>;

/** Trạng thái sau khi bấm thanh toán */
type Stage = 'form' | 'waiting' | 'done' | 'failed';

const METHODS: { key: PaymentMethod; title: string; sub: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'WALLET', title: 'Ví TaxKeep', sub: '', icon: 'wallet-outline' },
  { key: 'VNPAY', title: 'VNPay', sub: 'Thẻ ATM, Internet Banking, ví VNPay', icon: 'card-outline' },
  { key: 'VIETQR', title: 'Chuyển khoản VietQR', sub: 'Quét mã bằng ứng dụng ngân hàng', icon: 'qr-code-outline' },
];

const DotLeader: React.FC = () => (
  <View style={styles.leaderClip}>
    <View style={styles.leader} />
  </View>
);

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <DotLeader />
    <Text style={styles.rowValue}>{value}</Text>
  </View>
);

export const SubscriptionCheckoutScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const { plan, cycle, currentPlanName } = useRoute<Route>().params;

  const amount = cycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;
  const isFree = amount <= 0;
  const freeMonths = cycle === 'yearly' ? freeMonthsOfYearly(plan) : 0;

  const [balance, setBalance] = useState<number | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('VNPAY');
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('form');
  const [order, setOrder] = useState<SubscriptionPurchaseResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const walletEnough = balance !== null && balance >= amount;

  useFocusEffect(
    useCallback(() => {
      if (isFree) return;
      walletApi
        .getMyWallet('USER')
        .then((w) => setBalance(w.availableBalance))
        .catch(() => setBalance(null));
    }, [isFree])
  );

  const checkStatus = useCallback(
    async (silent = false) => {
      if (!order?.subscriptionId) return;
      setChecking(true);
      if (!silent) setNotice(null);
      try {
        const outcome = purchaseOutcome(await subscriptionApi.getHistory(), order.subscriptionId);
        if (outcome === 'active') setStage('done');
        else if (outcome === 'failed') setStage('failed');
        else if (!silent) setNotice('Chưa nhận được thanh toán. Nếu bạn vừa thanh toán, đợi vài giây rồi kiểm tra lại.');
      } catch (e: any) {
        if (!silent) setNotice(e?.response?.data?.message || 'Không kiểm tra được trạng thái. Kiểm tra kết nối mạng.');
      } finally {
        setChecking(false);
      }
    },
    [order]
  );

  // Quay lại app từ trình duyệt VNPay thì tự kiểm tra trạng thái đơn
  const stageRef = useRef(stage);
  stageRef.current = stage;
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && stageRef.current === 'waiting') void checkStatus(true);
    });
    return () => sub.remove();
  }, [checkStatus]);

  const pay = async () => {
    setSubmitting(true);
    setError(null);
    // Web: VNPay chuyển thẳng về màn kết quả của app trong cùng tab.
    // shortcut: native chưa có deep link trả về (cần expo-web-browser), vẫn để VNPay về BE rồi tự kiểm tra khi quay lại app
    const onWeb = Platform.OS === 'web' && typeof window !== 'undefined';
    try {
      const res = await subscriptionApi.purchase({
        planId: plan.id,
        billingCycle: cycle,
        paymentMethod: isFree ? 'WALLET' : method,
        returnUrl: onWeb ? `${config.webFrontendUrl}/${SUBSCRIPTION_RETURN_PATH}` : undefined,
      });
      setOrder(res);
      if (res.isCompleted) {
        setStage('done');
      } else if (res.checkoutUrl && onWeb) {
        window.location.assign(res.checkoutUrl);
        return;
      } else {
        setStage('waiting');
        if (res.checkoutUrl) await Linking.openURL(res.checkoutUrl);
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Không tạo được đơn mua gói.');
    } finally {
      setSubmitting(false);
    }
  };

  const backToPlans = () => navigation.navigate('SubscriptionMy');

  const header = (
    <>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.side}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
          testID="subscriptionCheckoutBack"
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{isFree ? 'Chuyển gói' : 'Thanh toán gói'}</Text>
        <View style={styles.side} />
      </View>
      <GoldDoubleRule />
    </>
  );

  if (stage === 'done' || stage === 'failed') {
    const ok = stage === 'done';
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
        {header}
        <View style={styles.result} testID={ok ? 'subscriptionCheckoutSuccess' : 'subscriptionCheckoutFailed'}>
          <Ionicons
            name={ok ? 'checkmark-circle' : 'close-circle'}
            size={64}
            color={ok ? theme.colors.success : theme.colors.error}
          />
          <Text style={styles.resultTitle}>{ok ? `Đã kích hoạt ${planNoun(plan.name)}` : 'Thanh toán chưa thành công'}</Text>
          <Text style={styles.resultSub}>
            {ok
              ? `Gói có hiệu lực đến ${formatDateVi(expectedExpiry(cycle))}.`
              : 'Đơn đã bị hủy hoặc thanh toán thất bại. Bạn chưa bị trừ tiền cho gói này.'}
          </Text>
          <TouchableOpacity style={styles.cta} onPress={ok ? backToPlans : () => setStage('form')} accessibilityRole="button">
            <Text style={styles.ctaText}>{ok ? 'Xem gói của tôi' : 'Thanh toán lại'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (stage === 'waiting' && order) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
        {header}
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>
              {order.qrCode ? 'Quét mã để chuyển khoản' : 'Hoàn tất thanh toán trên VNPay'}
            </Text>
            <Text style={styles.sheetSub}>
              {order.qrCode
                ? 'Giữ nguyên số tiền và nội dung chuyển khoản để hệ thống nhận đúng đơn.'
                : 'Trang VNPay đã mở trong trình duyệt. Thanh toán xong, quay lại app để kích hoạt gói.'}
            </Text>

            {order.qrCode ? (
              <View style={styles.qrWrap}>
                <Image source={{ uri: order.qrCode }} style={styles.qr} resizeMode="contain" accessibilityLabel="Mã VietQR" />
              </View>
            ) : null}

            <View style={styles.rule} />
            <Row label="Số tiền" value={formatPlanVnd(order.amount)} />
            <Row label="Nội dung" value={`SUB${order.orderCode}`} />
          </View>

          {notice ? <Text style={styles.notice}>{notice}</Text> : null}

          {order.checkoutUrl ? (
            <TouchableOpacity
              style={styles.secondary}
              onPress={() => order.checkoutUrl && Linking.openURL(order.checkoutUrl)}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryText}>Mở lại trang VNPay</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.cta, checking && styles.ctaDisabled]}
            disabled={checking}
            onPress={() => checkStatus()}
            accessibilityRole="button"
            testID="subscriptionCheckoutCheck"
          >
            {checking ? (
              <ActivityIndicator color={theme.colors.textOnPrimary} />
            ) : (
              <Text style={styles.ctaText}>Tôi đã thanh toán, kiểm tra</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const disabled = submitting || (!isFree && method === 'WALLET' && !walletEnough);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      {header}
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.sheet}>
          <Text style={styles.planName}>{plan.name}</Text>
          <Text style={styles.sheetSub}>{cycle === 'yearly' ? 'Thanh toán theo năm' : 'Thanh toán theo tháng'}</Text>
          <View style={styles.rule} />
          <Row label="Thời hạn" value={cycle === 'yearly' ? '12 tháng' : '1 tháng'} />
          {freeMonths > 0 ? <Row label="Ưu đãi" value={`Tặng ${freeMonths} tháng`} /> : null}
          <Row label="Hiệu lực đến" value={formatDateVi(expectedExpiry(cycle))} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Tổng thanh toán</Text>
            <Text style={styles.total}>{isFree ? '0đ' : formatPlanVnd(amount)}</Text>
          </View>
        </View>

        {currentPlanName && currentPlanName !== plan.name ? (
          <Text style={styles.warn}>
            {planNoun(currentPlanName, true)} hiện tại sẽ kết thúc ngay khi {planNoun(plan.name)} được kích hoạt. Thời gian còn lại của
            gói cũ không được hoàn tiền.
          </Text>
        ) : null}

        {!isFree ? (
          <>
            <Text style={styles.sectionTitle}>Phương thức thanh toán</Text>
            <View style={styles.methods} accessibilityRole="radiogroup">
              {METHODS.map((m, i) => {
                const active = method === m.key;
                const isWallet = m.key === 'WALLET';
                const sub = isWallet
                  ? balance === null
                    ? 'Không tải được số dư ví'
                    : `Số dư ${formatPlanVnd(balance)}${walletEnough ? '' : ', không đủ để thanh toán'}`
                  : m.sub;
                return (
                  <TouchableOpacity
                    key={m.key}
                    style={[styles.method, i > 0 && styles.methodDivider]}
                    onPress={() => setMethod(m.key)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                    testID={`subscriptionMethod_${m.key}`}
                  >
                    <Ionicons name={m.icon} size={22} color={theme.colors.textSecondary} />
                    <View style={styles.methodText}>
                      <Text style={styles.methodTitle}>{m.title}</Text>
                      <Text style={[styles.methodSub, isWallet && !walletEnough && styles.methodSubWarn]}>{sub}</Text>
                    </View>
                    <View style={[styles.radio, active && styles.radioActive]}>
                      {active ? <View style={styles.radioDot} /> : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            {method === 'WALLET' && !walletEnough ? (
              <TouchableOpacity
                onPress={() => navigation.navigate('Wallet', { walletType: 'USER' })}
                accessibilityRole="link"
              >
                <Text style={styles.link}>Nạp tiền vào ví</Text>
              </TouchableOpacity>
            ) : null}
          </>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.cta, disabled && styles.ctaDisabled]}
          disabled={disabled}
          onPress={pay}
          accessibilityRole="button"
          testID="subscriptionCheckoutPay"
        >
          {submitting ? (
            <ActivityIndicator color={theme.colors.textOnPrimary} />
          ) : (
            <Text style={styles.ctaText}>
              {isFree ? `Chuyển sang ${planNoun(plan.name)}` : `Thanh toán ${formatPlanVnd(amount)}`}
            </Text>
          )}
        </TouchableOpacity>
      </View>
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
  sheetTitle: { fontFamily: fonts.serifBold, fontSize: 20, color: theme.colors.textPrimary },
  sheetSub: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: theme.colors.textSecondary, marginTop: 4 },
  rule: { height: 1, backgroundColor: theme.colors.border, marginTop: 16, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'flex-end', paddingVertical: 8 },
  rowLabel: { fontFamily: fonts.body, fontSize: 14, color: theme.colors.textPrimary },
  rowValue: { fontFamily: fonts.bodySemi, fontSize: 14, color: theme.colors.textPrimary, textAlign: 'right' },
  // Viền chấm 1 cạnh không ổn định trên Android: vẽ khung chấm đầy đủ rồi cắt chỉ lấy cạnh trên
  leaderClip: { flex: 1, minWidth: 16, height: 1, overflow: 'hidden', marginHorizontal: 6, marginBottom: 5 },
  leader: { height: 3, borderWidth: 1, borderStyle: 'dotted', borderColor: theme.colors.textPlaceholder },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.textPrimary,
  },
  totalLabel: { fontFamily: fonts.bodySemi, fontSize: 15, color: theme.colors.textPrimary },
  total: { fontFamily: fonts.serifBold, fontSize: 28, color: theme.colors.primary },

  warn: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.warning,
    backgroundColor: theme.colors.warningBackground,
    padding: 12,
    borderRadius: 4,
    marginTop: 14,
  },

  sectionTitle: { fontFamily: fonts.serifBold, fontSize: 17, color: theme.colors.textPrimary, marginTop: 24, marginBottom: 10 },
  methods: {
    backgroundColor: theme.colors.surface,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  method: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 16, paddingVertical: 12 },
  methodDivider: { borderTopWidth: 1, borderTopColor: theme.colors.border },
  methodText: { flex: 1 },
  methodTitle: { fontFamily: fonts.bodySemi, fontSize: 15, color: theme.colors.textPrimary },
  methodSub: { fontFamily: fonts.body, fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 },
  methodSubWarn: { color: theme.colors.warning },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: theme.colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.primary },

  qrWrap: { alignItems: 'center', marginTop: 16 },
  qr: { width: 240, height: 240 },
  notice: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: theme.colors.textSecondary, marginTop: 14 },
  secondary: { alignSelf: 'center', marginTop: 14, padding: 10 },
  secondaryText: { fontFamily: fonts.bodySemi, fontSize: 14, color: theme.colors.primary },

  link: { fontFamily: fonts.bodySemi, fontSize: 14, color: theme.colors.primary, paddingVertical: 10 },
  error: { fontFamily: fonts.body, fontSize: 14, color: theme.colors.error, marginTop: 14 },

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
  ctaDisabled: { opacity: 0.45 },
  ctaText: { fontFamily: fonts.bodySemi, fontSize: 16, color: theme.colors.textOnPrimary },

  result: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 },
  resultTitle: { fontFamily: fonts.serifBold, fontSize: 22, color: theme.colors.textPrimary, textAlign: 'center' },
  resultSub: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
});
