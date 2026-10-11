import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fonts } from '../../constants/fonts';
import { theme } from '../../constants/theme';
import type { IncomeMonthItem } from '../../types/income';
import { groupMonthsByQuarter } from '../../screens/income/incomeQuarterUtils';

type Props = {
  months: IncomeMonthItem[];
  year: number;
  /** Có thì từng tháng bấm được (mở xem/sửa); không có thì chỉ xem */
  onPressMonth?: (item: IncomeMonthItem) => void;
  testIDPrefix?: string;
};

const money = (n: number) => Number(n || 0).toLocaleString('vi-VN');

/**
 * Bảng thu nhập theo quý của 1 nơi chi trả (tham khảo bản Lovable "Chi tiết Nguồn Thu Nhập"):
 * mỗi dòng 1 quý = tổng 3 tháng, dòng Tổng cộng cuối bảng; bấm quý để xem từng tháng.
 */
export function QuarterIncomeTable({ months, year, onPressMonth, testIDPrefix = 'quarter' }: Props) {
  const [openQuarter, setOpenQuarter] = useState<number | null>(null);
  const { quarters, total } = groupMonthsByQuarter(months, year);

  if (quarters.length === 0) return null;

  return (
    <View style={styles.table} testID={`${testIDPrefix}Table`}>
      <View style={[styles.row, styles.headRow]}>
        <Text style={[styles.colTime, styles.head]}>Thời gian</Text>
        <Text style={[styles.colNum, styles.colWide, styles.head]}>Thu nhập chịu thuế</Text>
        <Text style={[styles.colNum, styles.head]}>Bảo hiểm</Text>
        <Text style={[styles.colNum, styles.head]}>Thuế đã khấu trừ</Text>
      </View>

      {quarters.map((q) => {
        const open = openQuarter === q.quarter;
        return (
          <View key={q.quarter}>
            <TouchableOpacity
              style={styles.row}
              onPress={() => setOpenQuarter(open ? null : q.quarter)}
              accessibilityRole="button"
              accessibilityLabel={`Quý ${q.quarter}, bấm để ${open ? 'thu gọn' : 'xem từng tháng'}`}
              testID={`${testIDPrefix}Row_Q${q.quarter}`}
            >
              <View style={styles.colTime}>
                <View style={styles.timeLine}>
                  <Text style={styles.cellTime} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                    {q.label}
                  </Text>
                  <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={12} color="#999" />
                </View>
                {q.monthCount < 3 ? <Text style={styles.partial}>{q.monthCount}/3 tháng</Text> : null}
              </View>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[styles.colNum, styles.colWide, styles.cell]}>{money(q.income)}</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[styles.colNum, styles.cell]}>{money(q.insurance)}</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[styles.colNum, styles.cell]}>{money(q.tax)}</Text>
            </TouchableOpacity>

            {open
              ? q.months.map((m) => {
                  const content = (
                    <>
                      <View style={[styles.colTime, styles.timeLine]}>
                        <Text style={styles.cellMonth}>Tháng {m.month}</Text>
                        {onPressMonth ? <Ionicons name="chevron-forward" size={12} color={theme.colors.primary} /> : null}
                      </View>
                      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[styles.colNum, styles.colWide, styles.cellSub]}>{money(m.totalTaxableIncome)}</Text>
                      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[styles.colNum, styles.cellSub]}>{money(m.insuranceDeducted)}</Text>
                      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[styles.colNum, styles.cellSub]}>{money(m.taxAlreadyDeducted)}</Text>
                    </>
                  );
                  return onPressMonth ? (
                    <TouchableOpacity
                      key={m.id}
                      style={[styles.row, styles.monthRow]}
                      onPress={() => onPressMonth(m)}
                      testID={`${testIDPrefix}Month_${m.month}`}
                    >
                      {content}
                    </TouchableOpacity>
                  ) : (
                    <View key={m.id} style={[styles.row, styles.monthRow]} testID={`${testIDPrefix}Month_${m.month}`}>
                      {content}
                    </View>
                  );
                })
              : null}
          </View>
        );
      })}

      <View style={[styles.row, styles.totalRow]} testID={`${testIDPrefix}Total`}>
        <Text style={[styles.colTime, styles.totalText]}>Tổng cộng</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[styles.colNum, styles.colWide, styles.totalText]}>{money(total.income)}</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[styles.colNum, styles.totalText]}>{money(total.insurance)}</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[styles.colNum, styles.totalText]}>{money(total.tax)}</Text>
      </View>
      <Text style={styles.unit}>Đơn vị: đồng · bấm vào quý để xem từng tháng</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  table: { borderTopWidth: 1, borderTopColor: theme.colors.border },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: 6,
  },
  headRow: { backgroundColor: theme.colors.surfaceSecondary, paddingVertical: 7 },
  head: { fontFamily: fonts.bodySemi, fontSize: 10, color: theme.colors.textSecondary, textTransform: 'uppercase' },
  colTime: { flex: 1.2 },
  colNum: { flex: 1, textAlign: 'right' },
  colWide: { flex: 1.25 },
  timeLine: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  // flexShrink để nhãn co lại nhường chỗ cho mũi tên, không bị xuống dòng
  cellTime: { flexShrink: 1, fontFamily: fonts.bodyMedium, fontSize: 12, color: theme.colors.textPrimary },
  partial: { marginTop: 1, fontFamily: fonts.body, fontSize: 10, color: '#8A5A00' },
  cell: { fontFamily: fonts.bodyMedium, fontSize: 12, color: theme.colors.textPrimary },
  monthRow: { backgroundColor: '#FBF8F1', paddingVertical: 7 },
  cellMonth: { paddingLeft: 10, fontFamily: fonts.body, fontSize: 11, color: theme.colors.textSecondary },
  cellSub: { fontFamily: fonts.body, fontSize: 11, color: theme.colors.textSecondary },
  totalRow: { borderBottomWidth: 0 },
  totalText: { fontFamily: fonts.bodyBold, fontSize: 12, color: theme.colors.textPrimary },
  unit: { paddingHorizontal: 12, paddingBottom: 8, fontFamily: fonts.body, fontSize: 10, color: '#999' },
});
