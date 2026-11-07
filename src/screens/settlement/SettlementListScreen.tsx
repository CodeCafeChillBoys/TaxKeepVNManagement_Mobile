import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Platform,
  ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { GoldDoubleRule } from '../../components/brand/GoldDoubleRule';
import { sanitizeUiMessage, toFriendlyErrorMessage } from '../../utils/friendlyError';
import { RootNavigationProp } from '../../navigation/types';
import { taxSettlementApi } from '../../api/taxSettlementApi';
import { formatVnd, heroOutcome, TaxSettlementListItem } from '../../types/taxSettlement';

function formatSettlementStatus(status?: string | null): string {
  const upper = String(status ?? '').trim().toUpperCase();
  if (upper === 'LOCKED') return 'Đã chốt';
  if (upper === 'DRAFT') return 'Bản nháp';
  if (upper === 'EXPORTED') return 'Đã xuất hồ sơ';
  return sanitizeUiMessage(status, 'Đã chốt');
}

type RowProps = {
  item: TaxSettlementListItem;
  index: number;
  onPress: (id: string) => void;
};

const SettlementListRow = React.memo<RowProps>(({ item, index, onPress }) => {
  const hero = heroOutcome(item);
  const statusLabel = formatSettlementStatus(item.status);

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => onPress(item.id)}
      testID={`settlementListItem_${item.id}`}
      accessibilityRole="button"
    >
      <Text style={styles.index}>{String(index + 1).padStart(2, '0')}</Text>
      <View style={styles.main}>
        <View style={styles.rowTopLine}>
          <Text style={styles.rowTitle}>Năm {item.taxYear}</Text>
          <View style={styles.statusChip}>
            <Text style={styles.statusChipText}>{statusLabel}</Text>
          </View>
        </View>
        <Text style={styles.rowMeta} numberOfLines={1}>
          Chốt {item.cutoffDate}
        </Text>
        <Text
          style={styles.rowOutcome}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {hero.label}: <Text style={styles.rowOutcomeAmount}>{formatVnd(hero.amount)}</Text>
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#999" style={styles.chevron} />
    </TouchableOpacity>
  );
});

export const SettlementListScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const insets = useSafeAreaInsets();
  const isMountedRef = useRef(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<TaxSettlementListItem[]>([]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const load = useCallback(async (pull = false) => {
    if (pull) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await taxSettlementApi.getList();
      if (!isMountedRef.current) return;
      setItems(data);
    } catch (e: unknown) {
      if (!isMountedRef.current) return;
      setError(
        toFriendlyErrorMessage(
          e,
          'Chưa thể tải danh sách hồ sơ quyết toán lúc này. Vui lòng thử lại.'
        )
      );
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        setLoading(true);
        setError(null);
        try {
          const data = await taxSettlementApi.getList();
          if (!alive || !isMountedRef.current) return;
          setItems(data);
        } catch (e: unknown) {
          if (!alive || !isMountedRef.current) return;
          setError(
            toFriendlyErrorMessage(
              e,
              'Chưa thể tải danh sách hồ sơ quyết toán lúc này. Vui lòng thử lại.'
            )
          );
        } finally {
          if (alive && isMountedRef.current) {
            setLoading(false);
            setRefreshing(false);
          }
        }
      })();
      return () => {
        alive = false;
      };
    }, [])
  );

  const handleOpenDetail = useCallback(
    (id: string) => {
      navigation.navigate('SettlementDetail', { id });
    },
    [navigation]
  );

  const keyExtractor = useCallback(
    (item: TaxSettlementListItem, index: number) => item.id || `settlement-${index}`,
    []
  );

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<TaxSettlementListItem>) => (
      <SettlementListRow item={item} index={index} onPress={handleOpenDetail} />
    ),
    [handleOpenDetail]
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.side}
          onPress={() => navigation.navigate('Home')}
          testID="settlementListBack"
          accessibilityRole="button"
          accessibilityLabel="Về trang chủ"
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          Hồ sơ quyết toán
        </Text>
        <TouchableOpacity
          style={styles.side}
          onPress={() => navigation.navigate('SettlementStart')}
          testID="settlementListNew"
          accessibilityRole="button"
          accessibilityLabel="Tạo hồ sơ quyết toán mới"
        >
          <Ionicons name="add" size={26} color={theme.colors.primary} />
        </TouchableOpacity>
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
            <Text style={styles.link}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: Math.max(insets.bottom, 24) + 16 },
          ]}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews={Platform.OS === 'android'}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              colors={[theme.colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Chưa có hồ sơ đã chốt</Text>
              <Text style={styles.emptySub}>
                Bấm dấu + ở góc trên bên phải để xem trước và chốt quyết toán thuế năm.
              </Text>
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
  list: {
    paddingHorizontal: 22,
    width: '100%',
    maxWidth: 700,
    alignSelf: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  index: { width: 28, fontFamily: fonts.serifBold, fontSize: 15, color: theme.colors.gold },
  main: { flex: 1, minWidth: 0 },
  rowTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowTitle: { fontFamily: fonts.bodySemi, fontSize: 16, color: theme.colors.textPrimary },
  statusChip: {
    backgroundColor: '#F3ECD8',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusChipText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: '#7A5A14',
  },
  rowMeta: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  rowOutcome: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: theme.colors.textPrimary,
    marginTop: 2,
    flexShrink: 1,
  },
  rowOutcomeAmount: {
    fontFamily: fonts.bodyBold,
    color: theme.colors.primaryDark,
  },
  chevron: { marginLeft: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  error: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.error,
    textAlign: 'center',
    maxWidth: 420,
  },
  link: { fontFamily: fonts.bodySemi, color: theme.colors.primary, paddingVertical: 6 },
  empty: { paddingTop: 48 },
  emptyTitle: { fontFamily: fonts.serifBold, fontSize: 18, color: theme.colors.textPrimary },
  emptySub: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: '#666', marginTop: 8 },
});
