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
import { taxSettlementApi } from '../../api/taxSettlementApi';
import { formatVnd, heroOutcome, TaxSettlementListItem } from '../../types/taxSettlement';

export const SettlementListScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<TaxSettlementListItem[]>([]);

  const load = useCallback(async (pull = false) => {
    if (pull) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await taxSettlementApi.getList();
      setItems(data);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Không tải danh sách.');
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

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.side}
          onPress={() => navigation.navigate('Home')}
          testID="settlementListBack"
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Hồ sơ quyết toán</Text>
        <TouchableOpacity
          style={styles.side}
          onPress={() => navigation.navigate('SettlementStart')}
          testID="settlementListNew"
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
          <TouchableOpacity onPress={() => load()}>
            <Text style={styles.link}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[theme.colors.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Chưa có hồ sơ đã chốt</Text>
              <Text style={styles.emptySub}>Bấm + để xem trước và chốt quyết toán năm.</Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const hero = heroOutcome(item);
            return (
              <TouchableOpacity
                style={styles.row}
                onPress={() => navigation.navigate('SettlementDetail', { id: item.id })}
                testID={`settlementListItem_${item.id}`}
              >
                <Text style={styles.index}>{String(index + 1).padStart(2, '0')}</Text>
                <View style={styles.main}>
                  <Text style={styles.rowTitle}>Năm {item.taxYear}</Text>
                  <Text style={styles.rowMeta}>
                    {item.status} · Chốt {item.cutoffDate} · {hero.label} {formatVnd(hero.amount)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#999" />
              </TouchableOpacity>
            );
          }}
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
  list: { paddingHorizontal: 22, paddingBottom: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  index: { width: 28, fontFamily: fonts.serifBold, fontSize: 15, color: theme.colors.gold },
  main: { flex: 1 },
  rowTitle: { fontFamily: fonts.bodySemi, fontSize: 16, color: theme.colors.textPrimary },
  rowMeta: { fontFamily: fonts.body, fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  error: { fontFamily: fonts.body, color: theme.colors.error, textAlign: 'center' },
  link: { fontFamily: fonts.bodySemi, color: theme.colors.primary },
  empty: { paddingTop: 48 },
  emptyTitle: { fontFamily: fonts.serifBold, fontSize: 18, color: theme.colors.textPrimary },
  emptySub: { fontFamily: fonts.body, fontSize: 14, color: '#666', marginTop: 8 },
});
