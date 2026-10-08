import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fonts } from '../../constants/fonts';
import { theme } from '../../constants/theme';
import { GoldDoubleRule } from '../../components/brand/GoldDoubleRule';
import {
  formatVnd,
  heroOutcome,
  SettlementDependentItem,
  SettlementIncomeItem,
  TaxSettlementPreview,
} from '../../types/taxSettlement';
import {
  clampMonthRangeToYear,
  computeBracketBreakdown,
  relationshipLabel,
  SETTLEMENT_GLOSSARY,
} from './settlementBreakdown';

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
  { key: 'notes', title: 'Ghi chú thuật ngữ' },
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
      return <IncomeSection p={p} />;
    case 'dependents':
      return <DependentsSection p={p} />;
    case 'deductions':
      return <DeductionsSection p={p} />;
    case 'brackets':
      return <BracketsSection p={p} />;
    case 'summary':
      return (
        <>
          <Row label="Thuế phải nộp cả năm" value={formatVnd(p.taxPayable)} />
          <Row label="Thuế đã khấu trừ tại nguồn" value={formatVnd(p.totalTaxWithheld)} />
          <Row label="Được hoàn" value={formatVnd(p.refundAmount)} />
          <Row label="Còn phải nộp" value={formatVnd(p.dueAmount)} />
          <Note>Kết quả = Thuế phải nộp cả năm − Thuế đã khấu trừ. Âm thì được hoàn, dương thì nộp thêm.</Note>
        </>
      );
    case 'notes':
      return (
        <>
          {SETTLEMENT_GLOSSARY.map((g) => (
            <Text key={g.term} style={styles.glossLine}>
              <Text style={styles.glossTerm}>{g.term}: </Text>
              {g.meaning}
            </Text>
          ))}
        </>
      );
    default:
      return null;
  }
}

// ── 01 Thu nhập ────────────────────────────────────────────────────────────────

function IncomeSection({ p }: { p: TaxSettlementPreview }) {
  const selected = p.incomeItems.filter((i) => i.isSelected);
  return (
    <>
      <Row label="Tổng thu nhập chịu thuế" value={formatVnd(p.totalGrossIncome)} bold />
      <Row label="Bảo hiểm bắt buộc đã trích" value={formatVnd(p.totalInsuranceDeduction)} />
      <Row label="Thuế đã khấu trừ tại nguồn" value={formatVnd(p.totalTaxWithheld)} />

      {p.incomeItems.length > 0 ? (
        <Text style={styles.subHead}>
          Gồm {selected.length} nơi chi trả · chạm từng nơi để xem chi tiết
        </Text>
      ) : (
        <Text style={styles.muted}>
          {p.totalGrossIncome > 0
            ? 'Hồ sơ này không lưu chi tiết từng nơi chi trả, chỉ còn số tổng.'
            : 'Chưa có nơi chi trả.'}
        </Text>
      )}
      {p.incomeItems.map((i) => (
        <IncomeCompanyCard key={i.incomeSourceId} item={i} total={p.totalGrossIncome} />
      ))}

      <Note>
        Chỉ gồm thu nhập chịu thuế đã được tổ chức chi trả bóc tách trên chứng từ khấu trừ thuế. Khoản nào chưa
        bóc tách được thì coi như chịu thuế.
      </Note>
    </>
  );
}

function IncomeCompanyCard({ item, total }: { item: SettlementIncomeItem; total: number }) {
  const [expanded, setExpanded] = useState(false);
  const share = total > 0 && item.isSelected ? Math.round((item.grossIncome / total) * 100) : null;
  return (
    <View style={[styles.card, !item.isSelected && styles.cardMuted]}>
      <TouchableOpacity style={styles.cardHead} onPress={() => setExpanded((v) => !v)} accessibilityRole="button">
        <View style={styles.cardTitleWrap}>
          <Text style={styles.cardTitle}>{item.companyName}</Text>
          <Text style={styles.cardAmount}>{formatVnd(item.grossIncome)}</Text>
          {!item.isSelected ? <Text style={styles.cardTag}>Không đưa vào quyết toán</Text> : null}
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#999" />
      </TouchableOpacity>
      {expanded ? (
        <View style={styles.cardBody}>
          <Row label="Mã số thuế tổ chức" value={item.companyTaxCode || '—'} />
          <Row label="Thu nhập chịu thuế" value={formatVnd(item.grossIncome)} />
          {share != null ? <Row label="Tỷ trọng trong tổng" value={`${share}%`} /> : null}
          <Row label="Bảo hiểm bắt buộc đã trích" value={formatVnd(item.insuranceDeduction)} />
          <Row label="Thuế đã khấu trừ" value={formatVnd(item.taxWithheld)} />
        </View>
      ) : null}
    </View>
  );
}

// ── 02 Người phụ thuộc ────────────────────────────────────────────────────────

function DependentsSection({ p }: { p: TaxSettlementPreview }) {
  return (
    <>
      <Row label="Tổng giảm trừ NPT" value={formatVnd(p.dependentDeductionAmount)} bold />
      <Row
        label="Mức giảm trừ"
        value={`${formatVnd(p.dependentMonthlyRate)}/người/tháng`}
      />
      <Row label="Tổng số người-tháng" value={`${p.dependentDeductionPersonMonths}`} />
      {p.dependentItems.map((d) => (
        <DependentCard key={d.dependentId} item={d} taxYear={p.taxYear} monthlyRate={p.dependentMonthlyRate} />
      ))}
      {p.dependentItems.length === 0 ? <Text style={styles.muted}>Không có NPT hợp lệ.</Text> : null}
      <Note>
        Mỗi NPT chỉ được giảm trừ cho những tháng có hiệu lực trong năm (ví dụ con sinh tháng 6 thì tính từ tháng 6;
        người thân mất tháng 6 thì tính đến tháng 6).
      </Note>
    </>
  );
}

function DependentCard({
  item,
  taxYear,
  monthlyRate,
}: {
  item: SettlementDependentItem;
  taxYear: number;
  monthlyRate: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const range = clampMonthRangeToYear(item.effectiveFromMonth, item.effectiveToMonth, taxYear);
  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.cardHead} onPress={() => setExpanded((v) => !v)} accessibilityRole="button">
        <View style={styles.cardTitleWrap}>
          <Text style={styles.cardTitle}>{item.fullName}</Text>
          <Text style={styles.cardSub}>
            {relationshipLabel(item.relationship)} · {item.validMonths} tháng
          </Text>
          <Text style={styles.cardAmount}>{formatVnd(item.deductionAmount)}</Text>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#999" />
      </TouchableOpacity>
      {expanded ? (
        <View style={styles.cardBody}>
          <Row label="Quan hệ" value={relationshipLabel(item.relationship)} />
          <Row label="Thời gian được tính" value={range ?? '—'} />
          <Row label="Số tháng" value={`${item.validMonths}`} />
          <Row
            label="Cách tính"
            value={`${item.validMonths} × ${formatAmount(monthlyRate)} = ${formatVnd(item.deductionAmount)}`}
          />
        </View>
      ) : null}
    </View>
  );
}

// ── 03 Giảm trừ ───────────────────────────────────────────────────────────────

function DeductionsSection({ p }: { p: TaxSettlementPreview }) {
  return (
    <>
      <Row label="Bảo hiểm bắt buộc" value={formatVnd(p.totalInsuranceDeduction)} />
      <Row
        label={`Bản thân (${p.personalDeductionMonths} tháng × ${formatAmount(p.personalDeductionMonthlyRate)})`}
        value={formatVnd(p.personalDeductionAmount)}
      />
      <Row
        label={`Người phụ thuộc (${p.dependentDeductionPersonMonths} người-tháng)`}
        value={formatVnd(p.dependentDeductionAmount)}
      />
      {p.charityDeduction > 0 ? (
        <Row label="Đóng góp từ thiện, nhân đạo" value={formatVnd(p.charityDeduction)} />
      ) : null}
      <Row label="Chi phí y tế" value={p.medicalDeduction > 0 ? formatVnd(p.medicalDeduction) : '—'} />
      <Row label="Chi phí giáo dục" value={p.educationDeduction > 0 ? formatVnd(p.educationDeduction) : '—'} />
      <Row label="Tổng giảm trừ" value={formatVnd(p.totalDeductions)} bold />

      {p.charityDeduction > 0 ? (
        <Note>
          Từ thiện, nhân đạo: số tiền người nộp thuế khai khi lập quyết toán, cần có chứng từ của tổ chức nhận đóng
          góp để đối chiếu.
        </Note>
      ) : null}
      <Note>
        Y tế, giáo dục: tính từ biên lai đã được xác nhận, không vượt mức trần năm theo quy định
        {p.taxYear < 2026 ? '. Khoản này chỉ áp dụng từ năm 2026 nên năm này không được trừ.' : '.'}
      </Note>
    </>
  );
}

// ── 04 Bậc thuế ───────────────────────────────────────────────────────────────

function BracketsSection({ p }: { p: TaxSettlementPreview }) {
  const { rows, totalMonthly } = computeBracketBreakdown(p.taxableIncomeMonthly, p.bracketDetails);
  const matches = Math.abs(totalMonthly - p.taxPayableMonthly) <= rows.length;

  return (
    <>
      <Row label="Tổng thu nhập chịu thuế" value={formatVnd(p.totalGrossIncome)} />
      <Row label="− Tổng giảm trừ" value={formatVnd(p.totalDeductions)} />
      <Row label="= TNTT cả năm" value={formatVnd(p.taxableIncomeYearly)} bold />
      <Row label={'TNTT bình quân tháng (÷ 12)'} value={formatVnd(p.taxableIncomeMonthly)} bold />

      <Text style={styles.subHead}>Tính lũy tiến từng phần (theo tháng)</Text>
      {rows.length === 0 ? (
        <Text style={styles.muted}>TNTT bằng 0 nên không phát sinh thuế.</Text>
      ) : (
        <View style={styles.table}>
          <View style={[styles.tr, styles.thRow]}>
            <Text style={[styles.th, styles.colNo]}>Bậc</Text>
            <Text style={[styles.th, styles.colRange]}>Phần thu nhập (đ)</Text>
            <Text style={[styles.th, styles.colRate]}>Thuế suất</Text>
            <Text style={[styles.th, styles.colTax]}>Thuế</Text>
          </View>
          {rows.map((r) => (
            <View key={r.bracketNo} style={styles.tr}>
              <Text style={[styles.td, styles.colNo]}>{r.bracketNo}</Text>
              <View style={styles.colRange}>
                <Text style={styles.td}>{formatAmount(r.portion)}</Text>
                <Text style={styles.tdSub}>
                  {r.toMonthly == null
                    ? `trên ${formatAmount(r.fromMonthly)}`
                    : `${formatAmount(r.fromMonthly)} – ${formatAmount(r.toMonthly)}`}
                </Text>
              </View>
              <Text style={[styles.td, styles.colRate]}>{formatRate(r.rate)}</Text>
              <Text style={[styles.td, styles.colTax]}>{formatVnd(r.tax)}</Text>
            </View>
          ))}
          <View style={[styles.tr, styles.totalRow]}>
            <Text style={[styles.tdBold, styles.colTotalLabel]}>Thuế mỗi tháng</Text>
            <Text style={[styles.tdBold, styles.colTax]}>{formatVnd(totalMonthly)}</Text>
          </View>
        </View>
      )}

      <Row label={'Thuế phải nộp cả năm (× 12)'} value={formatVnd(p.taxPayable)} bold />
      <Note>
        Thuế TNCN tính lũy tiến từng phần giống tiền điện: phần thu nhập nằm trong khoảng của bậc nào thì nhân với
        thuế suất của bậc đó, rồi cộng lại.
        {rows.length > 0 && matches
          ? ' Kết quả khớp với công thức rút gọn của cơ quan thuế (TNTT × thuế suất bậc cao nhất − số trừ nhanh).'
          : ''}
      </Note>
    </>
  );
}

/** Số tiền không kèm "đ" — dùng trong nhãn phụ / khoảng bậc để chữ "đ" không rớt dòng. */
function formatAmount(n: number): string {
  return Number(n ?? 0).toLocaleString('vi-VN');
}

function formatRate(rate: number): string {
  return `${Number((rate * 100).toFixed(2)).toString().replace('.', ',')}%`;
}

// ── Thành phần dùng chung ─────────────────────────────────────────────────────

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, bold && styles.rowBold]}>{value}</Text>
    </View>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.note}>
      <Ionicons name="information-circle-outline" size={14} color="#7A5A14" style={styles.noteIcon} />
      <Text style={styles.noteText}>{children}</Text>
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
  rowLabel: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: theme.colors.textSecondary },
  rowValue: {
    flexShrink: 0,
    maxWidth: '60%',
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    color: theme.colors.textPrimary,
    textAlign: 'right',
  },
  rowBold: { fontFamily: fonts.bodyBold },
  muted: { fontFamily: fonts.body, fontSize: 13, color: '#999' },
  subHead: {
    marginTop: 6,
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: '#7A5A14',
  },

  // Thẻ xổ ra (nơi chi trả, NPT)
  card: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    backgroundColor: theme.colors.surface,
  },
  cardMuted: { opacity: 0.6 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12 },
  cardTitleWrap: { flex: 1 },
  cardTitle: { fontFamily: fonts.bodySemi, fontSize: 13, color: theme.colors.textPrimary },
  cardSub: { marginTop: 2, fontFamily: fonts.body, fontSize: 11, color: theme.colors.textSecondary },
  cardTag: { marginTop: 2, fontFamily: fonts.bodyMedium, fontSize: 11, color: theme.colors.primary },
  cardAmount: { marginTop: 2, fontFamily: fonts.bodySemi, fontSize: 13, color: theme.colors.primaryDark },
  cardBody: {
    gap: 6,
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 8,
  },

  // Bảng bậc thuế
  table: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, overflow: 'hidden' },
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  thRow: { borderTopWidth: 0, backgroundColor: theme.colors.surfaceSecondary },
  totalRow: { backgroundColor: theme.colors.surfaceSecondary },
  th: { fontFamily: fonts.bodySemi, fontSize: 11, color: '#7A5A14' },
  td: { fontFamily: fonts.body, fontSize: 12, color: theme.colors.textPrimary },
  tdSub: { fontFamily: fonts.body, fontSize: 10, color: theme.colors.textSecondary },
  tdBold: { fontFamily: fonts.bodyBold, fontSize: 12, color: theme.colors.primaryDark },
  colNo: { width: 30, textAlign: 'center' },
  colRange: { flex: 1, paddingHorizontal: 4 },
  colRate: { width: 52, textAlign: 'right' },
  colTax: { width: 92, textAlign: 'right' },
  colTotalLabel: { flex: 1, paddingLeft: 4 },

  // Ghi chú
  note: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#FBF6E9',
  },
  noteIcon: { marginTop: 1 },
  noteText: { flex: 1, fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: '#5A4A22' },
  glossLine: { fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: '#444' },
  glossTerm: { fontFamily: fonts.bodySemi, color: theme.colors.textPrimary },
});
