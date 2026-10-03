import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { RootNavigationProp, RootStackParamList } from '../../navigation/types';
import { taxSettlementApi } from '../../api/taxSettlementApi';
import { TaxSettlementPreview } from '../../types/taxSettlement';
import { SettlementResultBlocks } from './SettlementResultBlocks';

type Route = RouteProp<RootStackParamList, 'SettlementDetail'>;

export const SettlementDetailScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const { params } = useRoute<Route>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<TaxSettlementPreview | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await taxSettlementApi.getById(params.id);
      setPreview(data);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Không tải chi tiết.');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.side} onPress={() => navigation.goBack()} testID="settlementDetailBack">
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Chi tiết hồ sơ</Text>
        <View style={styles.side} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <TouchableOpacity onPress={load}>
            <Text style={styles.link}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : preview ? (
        <>
          <ScrollView contentContainerStyle={styles.scroll} testID="settlementDetailScroll">
            <SettlementResultBlocks preview={preview} locked />
            <Text style={styles.idHint}>Mã nội bộ: {preview.dossierId || params.id}</Text>
          </ScrollView>
          {String(preview.status).toUpperCase() === 'LOCKED' ? (
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.exportBtn}
                testID="settlementDetailPdf"
                onPress={() =>
                  navigation.navigate('SettlementExportForm', {
                    dossierId: preview.dossierId || params.id,
                    taxYear: preview.taxYear,
                    refundAmount: preview.refundAmount,
                  })
                }
              >
                <Ionicons name="document-text-outline" size={18} color={theme.colors.primary} />
                <Text style={styles.exportBtnText}>Tờ khai PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.exportBtn}
                testID="settlementDetailZip"
                onPress={() =>
                  navigation.navigate('SettlementExportForm', {
                    dossierId: preview.dossierId || params.id,
                    taxYear: preview.taxYear,
                    refundAmount: preview.refundAmount,
                  })
                }
              >
                <Ionicons name="archive-outline" size={18} color={theme.colors.primary} />
                <Text style={styles.exportBtnText}>Hồ sơ ZIP</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </>
      ) : null}
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
  scroll: { paddingHorizontal: 22, paddingBottom: 40, paddingTop: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  error: { fontFamily: fonts.body, color: theme.colors.error, textAlign: 'center' },
  link: { fontFamily: fonts.bodySemi, color: theme.colors.primary },
  idHint: {
    marginTop: 20,
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#999',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 18,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#DED7CB',
    backgroundColor: theme.colors.background,
  },
  exportBtn: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  exportBtnText: { fontFamily: fonts.bodyBold, fontSize: 14, color: theme.colors.primary },
});
