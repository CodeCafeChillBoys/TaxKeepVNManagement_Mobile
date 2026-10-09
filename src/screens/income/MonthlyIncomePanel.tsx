import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { GoldDoubleRule } from '../../components/brand/GoldDoubleRule';
import { incomeApi } from '../../api/incomeApi';
import { IncomeCompanyGroup, IncomeMonthItem } from '../../types/income';
import { RootNavigationProp } from '../../navigation/types';
import { extractApiErrorMessage } from './incomeFormUtils';

const YEAR_OPTIONS = [2026, 2025, 2024];

const vnd = (n?: number | null) => `${Number(n ?? 0).toLocaleString('vi-VN')} đ`;

/**
 * Thu nhập theo tháng (bảng incomes): nhóm theo tổ chức chi trả → các tháng.
 * Hiển thị trong tab "Thu nhập" ở chế độ "Theo tháng".
 */
export function MonthlyIncomePanel() {
  const navigation = useNavigation<RootNavigationProp>();
  const [year, setYear] = useState<number>(2026);
  const [groups, setGroups] = useState<IncomeCompanyGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        setGroups(await incomeApi.getMyIncomes(year));
        setError('');
      } catch (err) {
        setError(extractApiErrorMessage(err, 'Không tải được danh sách thu nhập theo tháng.'));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [year]
  );

  // Tải lại mỗi khi quay về từ màn hình thêm/sửa
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const totals = groups.reduce(
    (acc, g) => {
      for (const d of g.details) {
        acc.income += d.totalTaxableIncome;
        acc.insurance += d.insuranceDeducted;
        acc.tax += d.taxAlreadyDeducted;
        acc.months += 1;
      }
      return acc;
    },
    { income: 0, insurance: 0, tax: 0, months: 0 }
  );

  const openForm = (item?: IncomeMonthItem) => navigation.navigate('IncomeMonthForm', { year, item, groups });
  const groupKey = (g: IncomeCompanyGroup) => `${g.taxIdNumber ?? ''}|${g.organizationName}`;

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[theme.colors.primary]} />}
      testID="monthlyIncomeScroll"
    >
      {/* Năm */}
      <View style={styles.yearRow}>
        <Text style={styles.yearLabel}>Năm thu nhập:</Text>
        {YEAR_OPTIONS.map((y) => (
          <TouchableOpacity
            key={y}
            style={[styles.yearChip, y === year && styles.yearChipOn]}
            onPress={() => setYear(y)}
            testID={`monthlyYear_${y}`}
          >
            <Text style={[styles.yearChipText, y === year && styles.yearChipTextOn]}>{y}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tổng */}
      <View style={styles.summary} testID="monthlyIncomeSummary">
        <Text style={styles.summaryTitle}>Tổng thu nhập chịu thuế năm {year}</Text>
        <Text style={styles.summaryValue}>{vnd(totals.income)}</Text>
        <Text style={styles.summarySub}>
          Bảo hiểm đã trích {vnd(totals.insurance)} · Thuế đã khấu trừ {vnd(totals.tax)}
        </Text>
        <Text style={styles.summarySub}>
          {groups.length} nơi chi trả · {totals.months} tháng đã khai
        </Text>
        <GoldDoubleRule style={styles.rule} />
      </View>

      {/* Hành động */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => openForm()} testID="addMonthlyIncomeBtn">
          <Ionicons name="scan-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryBtnText}>Thêm thu nhập tháng</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.actionHint}>Quét ảnh phiếu lương để tự điền, hoặc nhập tay.</Text>

      <View style={styles.note}>
        <Ionicons name="information-circle-outline" size={14} color="#7A5A14" style={styles.noteIcon} />
        <Text style={styles.noteText}>
          Chỉ khai thu nhập chịu thuế đã được tổ chức chi trả bóc tách trên phiếu lương / chứng từ. Khoản chưa bóc tách
          được thì coi như chịu thuế.
        </Text>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => load()} testID="monthlyRetryBtn">
            <Text style={styles.retryText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.muted}>Đang tải thu nhập theo tháng...</Text>
        </View>
      ) : groups.length === 0 && !error ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Chưa có thu nhập tháng nào của năm {year}</Text>
          <Text style={styles.muted}>Bấm "Thêm tháng" để quét phiếu lương hoặc nhập tay.</Text>
        </View>
      ) : (
        groups.map((g) => {
          const key = groupKey(g);
          const open = !!expanded[key];
          return (
            <View key={key} style={styles.card} testID={`monthlyGroup_${g.taxIdNumber || g.organizationName}`}>
              <TouchableOpacity
                style={styles.cardHead}
                onPress={() => setExpanded((s) => ({ ...s, [key]: !open }))}
                accessibilityRole="button"
              >
                <View style={styles.cardTitleWrap}>
                  <Text style={styles.cardTitle}>{g.organizationName}</Text>
                  <Text style={styles.cardSub}>
                    {g.taxIdNumber ? `MST ${g.taxIdNumber} · ` : ''}
                    {g.details.length} tháng
                  </Text>
                  <Text style={styles.cardAmount}>{vnd(g.totalIncomeCompany)}</Text>
                </View>
                <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color="#999" />
              </TouchableOpacity>

              {open
                ? g.details.map((d) => (
                    <TouchableOpacity
                      key={d.id}
                      style={styles.monthRow}
                      onPress={() => openForm(d)}
                      testID={`monthlyRow_${d.id}`}
                    >
                      <View style={styles.monthBadge}>
                        <Text style={styles.monthBadgeText}>T{d.month}</Text>
                      </View>
                      <View style={styles.monthInfo}>
                        <Text style={styles.monthIncome}>{vnd(d.totalTaxableIncome)}</Text>
                        <Text style={styles.monthMeta}>
                          BH {vnd(d.insuranceDeducted)} · Thuế {vnd(d.taxAlreadyDeducted)}
                        </Text>
                        {d.payslipFileUrl ? <Text style={styles.monthTag}>Có phiếu lương</Text> : null}
                      </View>
                      <Ionicons name="create-outline" size={18} color={theme.colors.primary} />
                    </TouchableOpacity>
                  ))
                : null}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 22, paddingBottom: 120, gap: 12 },
  yearRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  yearLabel: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary },
  yearChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  yearChipOn: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  yearChipText: { fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary },
  yearChipTextOn: { color: '#FFFFFF', fontWeight: '700' },
  summary: { alignItems: 'center', marginTop: 6 },
  summaryTitle: { fontFamily: fonts.bodyMedium, fontSize: 12, color: '#5A4A22' },
  summaryValue: { fontFamily: fonts.serifBold, fontSize: 30, lineHeight: 36, color: theme.colors.primaryDark, marginTop: 4 },
  summarySub: { fontFamily: fonts.body, fontSize: 12, color: theme.colors.textSecondary, marginTop: 2, textAlign: 'center' },
  rule: { marginTop: 12, alignSelf: 'stretch' },
  actions: { gap: 8 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  primaryBtnText: { flexShrink: 1, fontFamily: fonts.bodySemi, fontSize: 14, color: '#FFFFFF', textAlign: 'center' },
  actionHint: { marginTop: -4, fontFamily: fonts.body, fontSize: 11, color: theme.colors.textSecondary, textAlign: 'center' },
  note: { flexDirection: 'row', gap: 6, padding: 8, borderRadius: 8, backgroundColor: '#FBF6E9' },
  noteIcon: { marginTop: 1 },
  noteText: { flex: 1, fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: '#5A4A22' },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#FDECEC',
  },
  errorText: { flex: 1, fontFamily: fonts.body, fontSize: 12, color: theme.colors.primaryDark },
  retryText: { fontFamily: fonts.bodySemi, fontSize: 13, color: theme.colors.primary },
  center: { alignItems: 'center', paddingVertical: 28, gap: 6 },
  emptyTitle: { fontFamily: fonts.bodySemi, fontSize: 14, color: theme.colors.textPrimary, textAlign: 'center' },
  muted: { fontFamily: fonts.body, fontSize: 12, color: '#999', textAlign: 'center' },
  card: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  cardTitleWrap: { flex: 1 },
  cardTitle: { fontFamily: fonts.bodySemi, fontSize: 14, color: theme.colors.textPrimary },
  cardSub: { marginTop: 2, fontFamily: fonts.body, fontSize: 11, color: theme.colors.textSecondary },
  cardAmount: { marginTop: 4, fontFamily: fonts.bodyBold, fontSize: 15, color: theme.colors.primaryDark },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  monthBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthBadgeText: { fontFamily: fonts.bodyBold, fontSize: 12, color: theme.colors.primaryDark },
  monthInfo: { flex: 1 },
  monthIncome: { fontFamily: fonts.bodySemi, fontSize: 13, color: theme.colors.textPrimary },
  monthMeta: { marginTop: 2, fontFamily: fonts.body, fontSize: 11, color: theme.colors.textSecondary },
  monthTag: { marginTop: 2, fontFamily: fonts.bodyMedium, fontSize: 10, color: '#7A5A14' },
});
