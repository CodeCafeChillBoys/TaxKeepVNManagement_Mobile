import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { HomeHeaderButton, useShowHomeButton } from '../../components/navigation/HomeHeaderButton';
import { fonts } from '../../constants/fonts';
import { GoldDoubleRule } from '../../components/brand/GoldDoubleRule';
import { useToast } from '../../components/ui/Toast';
import { RootNavigationProp } from '../../navigation/types';

const YEAR_OPTIONS = [2026, 2025, 2024];

export const SettlementStartScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const showHome = useShowHomeButton();
  const [taxYear, setTaxYear] = useState(2026);
  const [showOptional, setShowOptional] = useState(false);
  const [cutoffDate, setCutoffDate] = useState('');
  const [charityText, setCharityText] = useState('');

  const defaultCutoff = useMemo(() => `${taxYear}-12-31`, [taxYear]);

  const onPreview = useCallback(() => {
    const charity = Number((charityText || '0').replace(/\./g, '').replace(/,/g, ''));
    if (Number.isNaN(charity) || charity < 0) {
      toast.warning(
        'Vui lòng nhập số tiền đóng góp từ thiện lớn hơn hoặc bằng 0 đ.',
        'Số tiền chưa hợp lệ'
      );
      return;
    }
    const cutoff = cutoffDate.trim() || undefined;
    if (cutoff && !/^\d{4}-\d{2}-\d{2}$/.test(cutoff)) {
      toast.warning(
        `Vui lòng nhập ngày chốt theo định dạng Năm-Tháng-Ngày (ví dụ: ${defaultCutoff}).`,
        'Ngày chốt chưa đúng định dạng'
      );
      return;
    }
    navigation.navigate('SettlementPreview', {
      taxYear,
      cutoffDate: cutoff,
      charityDeduction: charity,
    });
  }, [charityText, cutoffDate, defaultCutoff, navigation, taxYear, toast]);

  // Có nút Home thì nới 2 bên bằng nhau để tiêu đề vẫn ở giữa
  const sideStyle = [styles.side, showHome && styles.sideWide];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={sideStyle}
          onPress={() => navigation.goBack()}
          testID="settlementStartBack"
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          Quyết toán thuế
        </Text>
        <View style={[sideStyle, styles.sideRow]}>
          <HomeHeaderButton style={styles.homeSmall} />
          <TouchableOpacity
            onPress={() => navigation.navigate('SettlementList')}
            testID="settlementStartGoList"
            accessibilityRole="button"
          >
            <Text style={styles.link}>Hồ sơ</Text>
          </TouchableOpacity>
        </View>
      </View>
      <GoldDoubleRule />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={8}
      >
        <ScrollView
          contentContainerStyle={[
            styles.body,
            { paddingBottom: Math.max(insets.bottom, 24) + 16 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.containerInner}>
            <Text style={styles.lead}>
              Chọn năm tính thuế để tổng hợp và xem trước số liệu quyết toán thuế thu nhập cá nhân.
            </Text>

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
                    accessibilityRole="button"
                  >
                    <Text style={[styles.yearChipText, active && styles.yearChipTextOn]}>{y}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              onPress={() => setShowOptional((v) => !v)}
              style={styles.optionalToggle}
              accessibilityRole="button"
            >
              <Text style={styles.optionalToggleText}>
                {showOptional ? 'Ẩn tuỳ chọn' : 'Tuỳ chọn'}
              </Text>
            </TouchableOpacity>

            {showOptional ? (
              <View style={styles.optionalBox}>
                <Text style={styles.label}>Ngày chốt số liệu (Năm-Tháng-Ngày)</Text>
                <TextInput
                  style={styles.input}
                  value={cutoffDate}
                  onChangeText={setCutoffDate}
                  placeholder={`VD: ${defaultCutoff}`}
                  placeholderTextColor={theme.colors.textPlaceholder}
                  autoCapitalize="none"
                  testID="settlementCutoffInput"
                />
                <Text style={styles.label}>Đóng góp từ thiện, nhân đạo (đ)</Text>
                <TextInput
                  style={styles.input}
                  value={charityText}
                  onChangeText={setCharityText}
                  keyboardType="numeric"
                  placeholder="VD: 1.000.000"
                  placeholderTextColor={theme.colors.textPlaceholder}
                  testID="settlementCharityInput"
                />
              </View>
            ) : null}

            <TouchableOpacity
              style={styles.cta}
              onPress={onPreview}
              testID="settlementPreviewBtn"
              accessibilityRole="button"
            >
              <Text style={styles.ctaText}>Xem trước</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    height: 52,
  },
  side: { width: 64, height: 44, alignItems: 'center', justifyContent: 'center' },
  sideWide: { width: 100 },
  sideRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  homeSmall: { width: 36 },
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.serifBold,
    fontSize: 20,
    color: theme.colors.textPrimary,
  },
  link: { fontFamily: fonts.bodySemi, fontSize: 13, color: theme.colors.primary },
  body: { paddingHorizontal: 22, paddingTop: 16 },
  containerInner: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  lead: { fontFamily: fonts.body, fontSize: 14, lineHeight: 22, color: '#444', marginBottom: 20 },
  label: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    color: theme.colors.textPrimary,
    marginBottom: 8,
    marginTop: 8,
  },
  yearRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
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
  optionalToggle: { marginTop: 20, marginBottom: 4, alignSelf: 'flex-start', paddingVertical: 4 },
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
