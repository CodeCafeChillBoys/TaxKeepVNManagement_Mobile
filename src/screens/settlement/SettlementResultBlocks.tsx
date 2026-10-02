import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fonts } from '../../constants/fonts';
import { theme } from '../../constants/theme';
import { GoldDoubleRule } from '../../components/brand/GoldDoubleRule';
import {
  formatVnd,
  heroOutcome,
  TaxSettlementPreview,
} from '../../types/taxSettlement';

type Props = {
  preview: TaxSettlementPreview;
  /** S6: read-only đã chốt */
  locked?: boolean;
};

const SECTIONS = [
  { key: 'income', title: 'Thu nhập' },
  { key: 'dependents', title: 'Người phụ thuộc' },
  { key: 'deductions', title: 'Giảm trừ' },
  { key: 'brackets', title: 'Bậc thuế' },
  { key: 'summary', title: 'Kết luận' },
] as const;

export function SettlementResultBlocks({ preview, locked }: Props) {
  const [open, setOpen] = useState<string>('summary');
  const hero = heroOutcome(preview);

  return (
    <View>
      <Text style={styles.yearLine}>
        Năm {preview.taxYear} · Chốt {preview.cutoffDate}
      </Text>
      {locked ? <Text style={styles.lockedBadge}>ĐÃ CHỐT</Text> : null}
      <Text style={styles.law}>{preview.lawGroupLabel}</Text>

      <Text style={styles.heroLabel}>{hero.label}</Text>
      <Text style={styles.heroAmount}>{formatVnd(hero.amount)}</Text>
      {preview.summaryMessage ? (
        <Text style={styles.summaryMsg}>{preview.summaryMessage.replace(/^[^\wÀ-ỹ]+/, '')}</Text>
      ) : null}

      <GoldDoubleRule style={styles.rule} />

      {SECTIONS.map((sec, idx) => {
        const isOpen = open === sec.key;
        return (
          <View key={sec.key} style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHead}
              onPress={() => setOpen(isOpen ? '' : sec.key)}
              accessibilityRole="button"
            >
              <Text style={styles.index}>{String(idx + 1).padStart(2, '0')}</Text>
              <Text style={styles.sectionTitle}>{sec.title}</Text>
              <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#999" />
            </TouchableOpacity>
            {isOpen ? <View style={styles.sectionBody}>{renderSection(sec.key, preview)}</View> : null}
          </View>
        );
      })}
    </View>
  );
}

function renderSection(key: string, p: TaxSettlementPreview) {
  switch (key) {
    case 'income':
      return (
        <>
          <Row label="Tổng thu nhập" value={formatVnd(p.totalGrossIncome)} />
          <Row label="Thuế đã khấu trừ" value={formatVnd(p.totalTaxWithheld)} />
          <Row label="Bảo hiểm" value={formatVnd(p.totalInsuranceDeduction)} />
          {p.incomeItems.map((i) => (
            <Text key={i.incomeSourceId} style={styles.itemLine}>
              {i.companyName} · {formatVnd(i.grossIncome)}
            </Text>
          ))}
          {p.incomeItems.length === 0 ? <Text style={styles.muted}>Chưa có nơi chi trả.</Text> : null}
        </>
      );
    case 'dependents':
      return (
        <>
          <Row label="Giảm trừ NPT" value={formatVnd(p.dependentDeductionAmount)} />
          {p.dependentItems.map((d) => (
            <Text key={d.dependentId} style={styles.itemLine}>
              {d.fullName} · {d.validMonths} tháng · {formatVnd(d.deductionAmount)}
            </Text>
          ))}
          {p.dependentItems.length === 0 ? <Text style={styles.muted}>Không có NPT hợp lệ.</Text> : null}
        </>
      );
    case 'deductions':
      return (
        <>
          <Row label="Bản thân" value={formatVnd(p.personalDeductionAmount)} />
          <Row label="Người phụ thuộc" value={formatVnd(p.dependentDeductionAmount)} />
          <Row label="Từ thiện" value={formatVnd(p.charityDeduction)} />
          <Row label="Y tế" value={p.medicalDeduction > 0 ? formatVnd(p.medicalDeduction) : '—'} />
          <Row label="Giáo dục" value={p.educationDeduction > 0 ? formatVnd(p.educationDeduction) : '—'} />
          <Row label="Tổng giảm trừ" value={formatVnd(p.totalDeductions)} bold />
        </>
      );
    case 'brackets':
      return (
        <>
          <Row label="TNTT năm" value={formatVnd(p.taxableIncomeYearly)} />
          <Row label="TNTT tháng" value={formatVnd(p.taxableIncomeMonthly)} />
          <Row label="Bậc áp dụng" value={`Bậc ${p.appliedBracketNo}`} />
          <Row label="Thuế phải nộp" value={formatVnd(p.taxPayable)} bold />
          {p.bracketDetails
            .filter((b) => b.isApplied)
            .map((b) => (
              <Text key={b.bracketNo} style={styles.itemLine}>
                Bậc {b.bracketNo} · {(b.rate * 100).toFixed(0)}% · {formatVnd(b.taxMonthly)}/tháng
              </Text>
            ))}
        </>
      );
    case 'summary':
      return (
        <>
          <Row label="Thuế phải nộp" value={formatVnd(p.taxPayable)} />
          <Row label="Đã khấu trừ" value={formatVnd(p.totalTaxWithheld)} />
          <Row label="Được hoàn" value={formatVnd(p.refundAmount)} />
          <Row label="Còn phải nộp" value={formatVnd(p.dueAmount)} />
        </>
      );
    default:
      return null;
  }
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, bold && styles.rowBold]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  yearLine: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: '#5A4A22',
    textAlign: 'center',
  },
  lockedBadge: {
    marginTop: 6,
    alignSelf: 'center',
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 1,
    color: theme.colors.primary,
  },
  law: {
    marginTop: 4,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  heroLabel: {
    marginTop: 18,
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    letterSpacing: 1,
    color: '#7A5A14',
    textAlign: 'center',
  },
  heroAmount: {
    marginTop: 4,
    fontFamily: fonts.serifBold,
    fontSize: 36,
    lineHeight: 42,
    color: theme.colors.primaryDark,
    textAlign: 'center',
  },
  summaryMsg: {
    marginTop: 8,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: '#444',
    textAlign: 'center',
  },
  rule: { marginTop: 16, marginBottom: 4 },
  section: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
  },
  index: {
    width: 28,
    fontFamily: fonts.serifBold,
    fontSize: 15,
    color: theme.colors.gold,
  },
  sectionTitle: {
    flex: 1,
    fontFamily: fonts.bodySemi,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  sectionBody: { paddingLeft: 38, paddingBottom: 12, gap: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowLabel: { fontFamily: fonts.body, fontSize: 13, color: theme.colors.textSecondary },
  rowValue: { fontFamily: fonts.bodySemi, fontSize: 13, color: theme.colors.textPrimary },
  rowBold: { fontFamily: fonts.bodyBold },
  itemLine: { fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: '#555' },
  muted: { fontFamily: fonts.body, fontSize: 13, color: '#999' },
});
