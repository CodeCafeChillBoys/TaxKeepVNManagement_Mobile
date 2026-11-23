import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { GoldDoubleRule } from '../../components/brand/GoldDoubleRule';
import { RootNavigationProp, RootStackParamList } from '../../navigation/types';
import { consultationApi } from '../../api/consultationApi';
import { subscriptionApi } from '../../api/subscriptionApi';
import { formatPlanVnd, friendlyPlanName, parseQuery, UserSubscription } from '../../types/subscription';

type Route = RouteProp<RootStackParamList, 'SubscriptionPaymentResult'>;

/** VNPay chuyển về đây sau khi thanh toán gói; gửi tham số cho BE xác nhận đơn rồi hiện kết quả */
export const SubscriptionPaymentResultScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const route = useRoute<Route>();
  const [loading, setLoading] = useState(true);
  const [ok, setOk] = useState(false);
  const [mine, setMine] = useState<UserSubscription | null>(null);
  const [amount, setAmount] = useState<number | null>(null);

  useEffect(() => {
    const params: Record<string, string> = {
      ...(Platform.OS === 'web' && typeof window !== 'undefined' ? parseQuery(window.location.search) : {}),
    };
    Object.entries(route.params ?? {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null) params[k] = String(v);
    });
    const paid = params.vnp_ResponseCode === '00';
    if (params.vnp_Amount) setAmount(Number(params.vnp_Amount) / 100); // VNPay gửi số tiền x100

    (async () => {
      try {
        // BE kiểm tra chữ ký VNPay và kích hoạt gói; đơn đã xác nhận trước đó thì báo lỗi, bỏ qua
        if (params.vnp_TxnRef) await consultationApi.handleVnPayReturn(params).catch(() => null);
        const current = await subscriptionApi.getMySubscription().catch(() => null);
        setMine(current);
        setOk(paid && !!current && current.planSlug !== 'basic');
      } finally {
        setLoading(false);
      }
    })();
  }, [route.params]);

  const goPlans = () =>
    navigation.reset({ index: 1, routes: [{ name: 'Profile' }, { name: ok ? 'SubscriptionMy' : 'SubscriptionPlans' }] });

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>Kết quả thanh toán</Text>
      </View>
      <GoldDoubleRule />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.sub}>Đang xác nhận kết quả thanh toán</Text>
        </View>
      ) : (
        <View style={styles.center} testID={ok ? 'subscriptionPaymentSuccess' : 'subscriptionPaymentFailed'}>
          <Ionicons
            name={ok ? 'checkmark-circle' : 'close-circle'}
            size={64}
            color={ok ? theme.colors.success : theme.colors.error}
          />
          <Text style={styles.resultTitle}>
            {ok ? `Đã kích hoạt ${friendlyPlanName(mine?.planName)} thành công` : 'Thanh toán chưa thành công'}
          </Text>
          <Text style={styles.sub}>
            {ok
              ? `${amount ? `Đã thanh toán ${formatPlanVnd(amount)}. ` : ''}${
                  mine?.remainingDays != null ? `Gói còn ${mine.remainingDays} ngày sử dụng.` : ''
                }`
              : 'Giao dịch chưa hoàn tất hoặc bị hủy nên gói chưa được kích hoạt. Bạn có thể chọn lại gói và thanh toán bất cứ lúc nào.'}
          </Text>
          <TouchableOpacity style={styles.cta} onPress={goPlans} accessibilityRole="button" testID="subscriptionPaymentDone">
            <Text style={styles.ctaText}>{ok ? 'Xem gói của tôi' : 'Quay lại danh sách gói'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  header: { height: 52, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.serifBold, fontSize: 20, color: theme.colors.textPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 },
  resultTitle: { fontFamily: fonts.serifBold, fontSize: 22, color: theme.colors.textPrimary, textAlign: 'center' },
  sub: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  cta: {
    minHeight: 52,
    alignSelf: 'stretch',
    borderRadius: 8,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  ctaText: { fontFamily: fonts.bodySemi, fontSize: 16, color: theme.colors.textOnPrimary },
});
