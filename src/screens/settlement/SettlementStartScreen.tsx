import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { GoldDoubleRule } from '../../components/brand/GoldDoubleRule';
import { RootNavigationProp } from '../../navigation/types';

const YEAR_OPTIONS = [2026, 2025, 2024];

export const SettlementStartScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const [taxYear, setTaxYear] = useState(2026);
  const [showOptional, setShowOptional] = useState(false);
  const [cutoffDate, setCutoffDate] = useState('');
  const [charityText, setCharityText] = useState('');

  const defaultCutoff = useMemo(() => `${taxYear}-12-31`, [taxYear]);

  const onPreview = () => {
    const charity = Number((charityText || '0').replace(/\./g, '').replace(/,/g, ''));
    if (Number.isNaN(charity) || charity < 0) {
      Alert.alert('Từ thiện không hợp lệ', 'Nhập số tiền từ thiện ≥ 0.');
      return;
    }
    const cutoff = cutoffDate.trim() || undefined;
    if (cutoff && !/^\d{4}-\d{2}-\d{2}$/.test(cutoff)) {
      Alert.alert('Ngày chốt', 'Dùng định dạng YYYY-MM-DD, ví dụ 2026-12-31.');
      return;
    }
    navigation.navigate('SettlementPreview', {
      taxYear,
      cutoffDate: cutoff,
      charityDeduction: charity,
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.side} onPress={() => navigation.goBack()} testID="settlementStartBack">
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Quyết toán thuế</Text>
        <TouchableOpacity
          style={styles.side}
          onPress={() => navigation.navigate('SettlementList')}
          testID="settlementStartGoList"
        >
          <Text style={styles.link}>Hồ sơ</Text>
        </TouchableOpacity>
      </View>
      <GoldDoubleRule />

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.lead}>Chọn năm để xem trước số liệu quyết toán thu nhập cá nhân.</Text>

        <Text style={styles.label}>Năm tính thuế</Text>
        <View style={styles.yearRow}>
          {YEAR_OPTIONS.map((y) => {
            const active = y === taxYear;
            return (
              <TouchableOpacity
                key={y}
                style={[styles.yearChip, active && styles.yearChipOn]}
                onPress={() => setTaxYear(y)}
                testID={`settlementYear_${y}`}
              >
                <Text style={[styles.yearChipText, active && styles.yearChipTextOn]}>{y}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity onPress={() => setShowOptional((v) => !v)} style={styles.optionalToggle}>
          <Text style={styles.optionalToggleText}>{showOptional ? 'Ẩn tuỳ chọn' : 'Tuỳ chọn'}</Text>
        </TouchableOpacity>

        {showOptional ? (
          <View style={styles.optionalBox}>
            <Text style={styles.label}>Ngày chốt (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={cutoffDate}
              onChangeText={setCutoffDate}
              placeholder={defaultCutoff}
              placeholderTextColor={theme.colors.textPlaceholder}
              testID="settlementCutoffInput"
            />
            <Text style={styles.label}>Từ thiện (đ)</Text>
            <TextInput
              style={styles.input}
              value={charityText}
              onChangeText={setCharityText}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={theme.colors.textPlaceholder}
              testID="settlementCharityInput"
            />
          </View>
        ) : null}

        <TouchableOpacity style={styles.cta} onPress={onPreview} testID="settlementPreviewBtn">
          <Text style={styles.ctaText}>Xem trước</Text>
        </TouchableOpacity>
      </ScrollView>
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
  side: { width: 64, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.serifBold,
    fontSize: 20,
    color: theme.colors.textPrimary,
  },
  link: { fontFamily: fonts.bodySemi, fontSize: 13, color: theme.colors.primary },
  body: { paddingHorizontal: 22, paddingTop: 16, paddingBottom: 40 },
  lead: { fontFamily: fonts.body, fontSize: 14, lineHeight: 22, color: '#444', marginBottom: 20 },
  label: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    color: theme.colors.textPrimary,
    marginBottom: 8,
    marginTop: 8,
  },
  yearRow: { flexDirection: 'row', gap: 8 },
  yearChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  yearChipOn: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  yearChipText: { fontFamily: fonts.bodySemi, fontSize: 14, color: theme.colors.textSecondary },
  yearChipTextOn: { color: '#fff' },
  optionalToggle: { marginTop: 20, marginBottom: 4 },
  optionalToggleText: { fontFamily: fonts.bodySemi, fontSize: 13, color: theme.colors.primary },
  optionalBox: { marginTop: 4 },
  input: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingVertical: 10,
    fontFamily: fonts.body,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  cta: {
    marginTop: 32,
    height: 52,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { fontFamily: fonts.bodyBold, fontSize: 16, color: '#fff' },
});
