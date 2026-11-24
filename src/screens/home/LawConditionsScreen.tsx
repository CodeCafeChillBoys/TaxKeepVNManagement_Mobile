import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { RootNavigationProp } from '../../navigation/types';
import {
  taxRuleApi,
  TaxRuleSetSummary,
  TaxRuleSetDetailData,
  TaxRuleItem,
  DependentRuleItem,
} from '../../api/taxRuleApi';
import { DrumHeader } from '../../components/brand/DrumHeader';
import { GoldDoubleRule } from '../../components/brand/GoldDoubleRule';
import { groupCodeToTitle } from '../dependent/dependentGroupUtils';

type CategoryTab = 'ALL' | 'BRACKET' | 'DEDUCTION' | 'DEPENDENT' | 'EXEMPTION';

const CATEGORY_TABS: { key: CategoryTab; label: string }[] = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'BRACKET', label: 'Biểu thuế lũy tiến' },
  { key: 'DEDUCTION', label: 'Giảm trừ gia cảnh' },
  { key: 'DEPENDENT', label: 'Người phụ thuộc' },
  { key: 'EXEMPTION', label: 'Thuế suất & Miễn thuế' },
];

function formatUnitVi(unit?: string | null): string {
  if (!unit) return '';
  const u = String(unit).trim().toLowerCase();
  if (u.includes('person') && u.includes('month')) return 'VNĐ/người/tháng';
  if (u.includes('person') && u.includes('year')) return 'VNĐ/người/năm';
  if (u === 'vnd/month' || u === 'vnđ/month') return 'VNĐ/tháng';
  if (u === 'vnd/year' || u === 'vnđ/year') return 'VNĐ/năm';
  if (u === 'vnd' || u === 'vnđ') return 'VNĐ';
  if (u === 'percent' || u === '%') return '%';
  return String(unit)
    .replace(/VND/gi, 'VNĐ')
    .replace(/person/gi, 'người')
    .replace(/month/gi, 'tháng')
    .replace(/year/gi, 'năm');
}

function formatRuleValueVi(rule: TaxRuleItem): string | null {
  if (rule.value === null || rule.value === undefined) {
    if (rule.ruleType === 'EXEMPTION') return 'Miễn thuế';
    return null;
  }
  const num = Number(rule.value);
  if (isNaN(num)) return String(rule.value);

  const unitLower = String(rule.unit || '').trim().toLowerCase();
  if (
    rule.ruleType === 'BRACKET' ||
    rule.ruleType === 'RATE' ||
    unitLower === '%' ||
    unitLower === 'percent'
  ) {
    if (num > 0 && num <= 1) {
      const pct = Number((num * 100).toFixed(1));
      return `${pct}%`;
    }
    return `${num}%`;
  }

  const formattedNum = num.toLocaleString('vi-VN');
  const unitLabel = formatUnitVi(rule.unit);
  return unitLabel ? `${formattedNum} ${unitLabel}` : `${formattedNum} VNĐ`;
}

function mapSubjectVi(subject?: string | null): string {
  if (!subject) return '';
  const s = String(subject).trim().toUpperCase();
  const map: Record<string, string> = {
    DEPENDENT: 'Người phụ thuộc',
    TAXPAYER: 'Người nộp thuế (Bản thân)',
    SELF: 'Bản thân người nộp thuế',
    RESIDENT: 'Cá nhân cư trú',
    NON_RESIDENT: 'Cá nhân không cư trú',
    INDIVIDUAL: 'Cá nhân',
    HOUSEHOLD_BUSINESS: 'Hộ, cá nhân kinh doanh',
    BUSINESS_INDIVIDUAL: 'Cá nhân kinh doanh',
    EMPLOYEE: 'Người lao động',
    OTHER: 'Đối tượng khác',
  };
  return map[s] || String(subject);
}

function formatConditionVi(cond: any): string {
  if (!cond) return 'Theo quy định pháp luật hiện hành.';
  let parsed = cond;
  if (typeof cond === 'string') {
    const trimmed = cond.trim();
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        parsed = trimmed;
      }
    }
  }

  if (typeof parsed === 'string') {
    return parsed
      .replace(/DEPENDENT/gi, 'Người phụ thuộc')
      .replace(/TAXPAYER/gi, 'Người nộp thuế')
      .replace(/RESIDENT/gi, 'Cá nhân cư trú')
      .replace(/NON_RESIDENT/gi, 'Cá nhân không cư trú')
      .replace(/VND\/person\/month/gi, 'VNĐ/người/tháng')
      .replace(/VND\/month/gi, 'VNĐ/tháng')
      .replace(/VND\/year/gi, 'VNĐ/năm')
      .replace(/VND/gi, 'VNĐ');
  }

  if (Array.isArray(parsed)) {
    return parsed.map((item) => formatConditionVi(item)).join('; ');
  }

  if (typeof parsed === 'object') {
    if (parsed.description) return formatConditionVi(parsed.description);
    if (parsed.subject && Array.isArray(parsed.eligibility)) {
      return `Áp dụng cho ${mapSubjectVi(parsed.subject).toLowerCase()} đủ điều kiện giảm trừ gia cảnh (${parsed.eligibility.length} nhóm đối tượng).`;
    }
    if (parsed.subject) return `Đối tượng áp dụng: ${mapSubjectVi(parsed.subject)}`;
    if (parsed.minIncome !== undefined || parsed.maxIncome !== undefined) {
      const parts: string[] = [];
      if (parsed.minIncome !== undefined) {
        parts.push(`Từ ${Number(parsed.minIncome).toLocaleString('vi-VN')} đ`);
      }
      if (parsed.maxIncome !== undefined) {
        parts.push(`đến ${Number(parsed.maxIncome).toLocaleString('vi-VN')} đ`);
      }
      return parts.join(' ');
    }
  }

  return 'Theo quy định pháp luật hiện hành.';
}

function parseDependentConditionsList(conds: any): string[] {
  if (!conds) return [];
  if (Array.isArray(conds)) {
    return conds.map((c) => String(c).trim()).filter(Boolean);
  }
  if (typeof conds === 'string') {
    const trimmed = conds.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((c) => String(c).trim()).filter(Boolean);
        }
      } catch {
        // Bỏ qua
      }
    }
    return trimmed
      .split(/\n|;/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function formatLegalBasis(rule: TaxRuleItem): string {
  const parts: string[] = [];
  if (rule.article) {
    const art = String(rule.article).trim();
    parts.push(/^điều/i.test(art) ? art : `Điều ${art}`);
  }
  if (rule.clause) {
    const cls = String(rule.clause).trim();
    parts.push(/^khoản/i.test(cls) ? cls : `Khoản ${cls}`);
  }
  if (rule.point) {
    const pt = String(rule.point).trim();
    parts.push(/^điểm/i.test(pt) ? pt : `Điểm ${pt}`);
  }
  if (rule.legalDocument) {
    parts.push(String(rule.legalDocument).trim());
  }
  return parts.join(' · ');
}

function formatStatusVi(status?: string | null): string {
  const s = String(status || '').trim().toLowerCase();
  if (s === 'active') return 'Đang áp dụng';
  if (s === 'expired') return 'Hết hiệu lực';
  if (s === 'archived') return 'Đã lưu trữ';
  return 'Bản nháp';
}

export const LawConditionsScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();

  const [ruleSets, setRuleSets] = useState<TaxRuleSetSummary[]>([]);
  const [selectedRuleSetId, setSelectedRuleSetId] = useState<string>('');
  const [detailData, setDetailData] = useState<TaxRuleSetDetailData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<CategoryTab>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});

  const toggleExpand = useCallback((key: string) => {
    setExpandedKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const loadData = useCallback(
    async (targetRuleSetId?: string, isRefresh = false) => {
      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
        setError(null);

        let sets = ruleSets;
        if (sets.length === 0 || isRefresh) {
          sets = await taxRuleApi.getAllRuleSets();
          setRuleSets(sets);
        }

        const chosenId =
          targetRuleSetId ||
          selectedRuleSetId ||
          sets.find((s) => s.status.toLowerCase() === 'active')?.ruleSetId ||
          sets[0]?.ruleSetId ||
          '';

        if (!chosenId) {
          setDetailData(null);
          return;
        }

        if (chosenId !== selectedRuleSetId) {
          setSelectedRuleSetId(chosenId);
        }

        const detail = await taxRuleApi.getRuleSetDetail(chosenId);
        setDetailData(detail);

        // Mặc định mở sẵn mục đầu tiên của mỗi nhóm để người dùng dễ xem ngay
        const defaultOpen: Record<string, boolean> = {};
        if (detail.taxRules[0]?.ruleCode) {
          defaultOpen[`rule_${detail.taxRules[0].ruleCode}`] = true;
        }
        if (detail.dependentRules[0]) {
          const firstDepKey =
            detail.dependentRules[0].id ||
            detail.dependentRules[0].dependentType ||
            'dep_0';
          defaultOpen[`dep_${firstDepKey}`] = true;
        }
        setExpandedKeys((prev) =>
          Object.keys(prev).length > 0 ? prev : defaultOpen
        );
      } catch (err: any) {
        setError(
          err?.message ||
            'Không thể tải dữ liệu Luật thuế TNCN từ hệ thống. Vui lòng thử lại.'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [ruleSets, selectedRuleSetId]
  );

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const { brackets, deductions, rateExemptions, dependents } = useMemo(() => {
    const allRules = detailData?.taxRules || [];
    const allDeps = detailData?.dependentRules || [];

    const matchRule = (r: TaxRuleItem) => {
      if (!normalizedQuery) return true;
      const condStr = formatConditionVi(r.condition).toLowerCase();
      return (
        (r.ruleName || '').toLowerCase().includes(normalizedQuery) ||
        (r.ruleCode || '').toLowerCase().includes(normalizedQuery) ||
        condStr.includes(normalizedQuery) ||
        (r.article || '').toLowerCase().includes(normalizedQuery) ||
        (r.legalDocument || '').toLowerCase().includes(normalizedQuery)
      );
    };

    const matchDep = (d: DependentRuleItem) => {
      if (!normalizedQuery) return true;
      const conds = parseDependentConditionsList(d.conditions).join(' ').toLowerCase();
      const docs = (d.requiredDocuments || [])
        .map((doc) => `${doc.name} ${doc.description || ''}`)
        .join(' ')
        .toLowerCase();
      return (
        (d.name || '').toLowerCase().includes(normalizedQuery) ||
        groupCodeToTitle(d.dependentType).toLowerCase().includes(normalizedQuery) ||
        conds.includes(normalizedQuery) ||
        docs.includes(normalizedQuery)
      );
    };

    return {
      brackets: allRules.filter((r) => r.ruleType === 'BRACKET' && matchRule(r)),
      deductions: allRules.filter((r) => r.ruleType === 'DEDUCTION' && matchRule(r)),
      rateExemptions: allRules.filter(
        (r) =>
          r.ruleType !== 'BRACKET' &&
          r.ruleType !== 'DEDUCTION' &&
          matchRule(r)
      ),
      dependents: allDeps.filter(matchDep),
    };
  }, [detailData, normalizedQuery]);

  const renderTaxRuleCard = (rule: TaxRuleItem, index: number) => {
    const key = `rule_${rule.ruleCode || index}`;
    const isOpen = Boolean(expandedKeys[key]);
    const formattedValue = formatRuleValueVi(rule);
    const conditionText = formatConditionVi(rule.condition);
    const legalBasis = formatLegalBasis(rule);

    return (
      <View key={key} style={styles.section}>
        <TouchableOpacity
          style={styles.sectionHead}
          onPress={() => toggleExpand(key)}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityState={{ expanded: isOpen }}
        >
          <Text style={styles.index}>{String(index + 1).padStart(2, '0')}</Text>
          <View style={styles.sectionTitles}>
            <View style={styles.titleValueRow}>
              <Text style={styles.groupTitle}>{rule.ruleName}</Text>
              {formattedValue ? (
                <View style={styles.valueBadge}>
                  <Text style={styles.valueBadgeText}>{formattedValue}</Text>
                </View>
              ) : null}
            </View>
            {!isOpen ? (
              <Text style={styles.preview} numberOfLines={2}>
                {conditionText}
              </Text>
            ) : null}
          </View>
          <Ionicons
            name={isOpen ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={theme.colors.textSecondary}
          />
        </TouchableOpacity>

        {isOpen ? (
          <View style={styles.body}>
            <Text style={styles.note}>{conditionText}</Text>

            <View style={styles.metaGrid}>
              {formattedValue ? (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Mức áp dụng:</Text>
                  <Text style={styles.metaValueHighlight}>{formattedValue}</Text>
                </View>
              ) : null}
              {legalBasis ? (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Căn cứ pháp lý:</Text>
                  <Text style={styles.metaValue}>{legalBasis}</Text>
                </View>
              ) : null}
              {rule.effectiveFrom ? (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Hiệu lực từ:</Text>
                  <Text style={styles.metaValue}>
                    {rule.effectiveFrom}
                    {rule.effectiveTo ? ` đến ${rule.effectiveTo}` : ''}
                  </Text>
                </View>
              ) : null}
            </View>

            {rule.sourceUrl ? (
              <TouchableOpacity
                style={styles.sourceLinkBtn}
                onPress={() => void Linking.openURL(rule.sourceUrl!)}
                accessibilityRole="link"
              >
                <Ionicons
                  name="open-outline"
                  size={15}
                  color={theme.colors.primary}
                />
                <Text style={styles.sourceLinkText}>Xem văn bản pháp luật gốc</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  };

  const renderDependentRuleCard = (dep: DependentRuleItem, index: number) => {
    const key = `dep_${dep.id || dep.dependentType || index}`;
    const isOpen = Boolean(expandedKeys[key]);
    const title = dep.name || groupCodeToTitle(dep.dependentType);
    const conditionsList = parseDependentConditionsList(dep.conditions);
    const previewText =
      conditionsList.join(' · ') || groupCodeToTitle(dep.dependentType);

    return (
      <View key={key} style={styles.section}>
        <TouchableOpacity
          style={styles.sectionHead}
          onPress={() => toggleExpand(key)}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityState={{ expanded: isOpen }}
        >
          <Text style={styles.index}>{String(index + 1).padStart(2, '0')}</Text>
          <View style={styles.sectionTitles}>
            <Text style={styles.groupTitle}>{title}</Text>
            {!isOpen && previewText ? (
              <Text style={styles.preview} numberOfLines={2}>
                {previewText}
              </Text>
            ) : null}
          </View>
          <Ionicons
            name={isOpen ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={theme.colors.textSecondary}
          />
        </TouchableOpacity>

        {isOpen ? (
          <View style={styles.body}>
            {conditionsList.length > 0 ? (
              <View style={styles.conditionBlock}>
                <Text style={styles.docsLabel}>Điều kiện áp dụng</Text>
                {conditionsList.map((cond, cIdx) => (
                  <Text key={cIdx} style={styles.noteBullet}>
                    • {cond}
                  </Text>
                ))}
              </View>
            ) : null}

            <View style={styles.metaGrid}>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Độ tuổi tối đa:</Text>
                <Text style={styles.metaValueHighlight}>
                  {dep.maxAge !== null && dep.maxAge !== undefined
                    ? `≤ ${dep.maxAge} tuổi`
                    : 'Không giới hạn'}
                </Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Thu nhập tối đa:</Text>
                <Text style={styles.metaValue}>
                  {dep.maxMonthlyIncome !== null &&
                  dep.maxMonthlyIncome !== undefined
                    ? `≤ ${Number(dep.maxMonthlyIncome).toLocaleString('vi-VN')} VNĐ/tháng`
                    : 'Theo quy định Bộ Tài chính'}
                </Text>
              </View>
              {(dep.isStudying || dep.isDisabled) ? (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Yêu cầu đặc thù:</Text>
                  <Text style={styles.metaValue}>
                    {[
                      dep.isStudying ? 'Đang theo học chính quy' : null,
                      dep.isDisabled ? 'Khuyết tật / Không có khả năng lao động' : null,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.docsLabel}>
              Giấy tờ cần nộp ({dep.requiredDocuments.length})
            </Text>
            {dep.requiredDocuments.length === 0 ? (
              <Text style={styles.note}>
                Chưa có danh mục giấy tờ yêu cầu cho nhóm đối tượng này.
              </Text>
            ) : (
              dep.requiredDocuments.map((doc, dIdx) => (
                <View
                  key={doc.id || `${doc.docType}_${dIdx}`}
                  style={styles.docItem}
                >
                  <Text style={styles.docLetter}>
                    {String.fromCharCode(97 + dIdx)}
                  </Text>
                  <View style={styles.docCopy}>
                    <View style={styles.docHeaderRow}>
                      <Text style={styles.docText}>{doc.name}</Text>
                      <View
                        style={[
                          styles.mandatoryChip,
                          doc.isMandatory
                            ? styles.mandatoryChipRequired
                            : styles.mandatoryChipOptional,
                        ]}
                      >
                        <Text
                          style={[
                            styles.mandatoryChipText,
                            doc.isMandatory
                              ? styles.mandatoryChipTextRequired
                              : styles.mandatoryChipTextOptional,
                          ]}
                        >
                          {doc.isMandatory ? 'Bắt buộc' : 'Tùy chọn'}
                        </Text>
                      </View>
                    </View>
                    {doc.description && doc.description !== doc.name ? (
                      <Text style={styles.subItem}>{doc.description}</Text>
                    ) : null}
                  </View>
                </View>
              ))
            )}
          </View>
        ) : null}
      </View>
    );
  };

  const ruleSet = detailData?.taxRuleSet;
  const showBrackets = activeTab === 'ALL' || activeTab === 'BRACKET';
  const showDeductions = activeTab === 'ALL' || activeTab === 'DEDUCTION';
  const showDependents = activeTab === 'ALL' || activeTab === 'DEPENDENT';
  const showExemptions = activeTab === 'ALL' || activeTab === 'EXEMPTION';

  const totalDisplayed =
    (showBrackets ? brackets.length : 0) +
    (showDeductions ? deductions.length : 0) +
    (showDependents ? dependents.length : 0) +
    (showExemptions ? rateExemptions.length : 0);

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={['top', 'left', 'right', 'bottom']}
    >
      <DrumHeader
        title="Luật thuế TNCN"
        onBack={() => navigation.goBack()}
        backTestID="lawConditionsBackBtn"
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadData(selectedRuleSetId, true)}
            colors={[theme.colors.primary]}
          />
        }
      >
        <View style={styles.contentWrap}>
          {/* Chọn bộ quy tắc nếu có nhiều năm / nhiều bộ luật */}
          {ruleSets.length > 1 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.ruleSetChipsRow}
            >
              {ruleSets.map((rs) => {
                const selected = rs.ruleSetId === selectedRuleSetId;
                return (
                  <TouchableOpacity
                    key={rs.ruleSetId}
                    style={[
                      styles.ruleSetChip,
                      selected && styles.ruleSetChipActive,
                    ]}
                    onPress={() => void loadData(rs.ruleSetId, false)}
                    accessibilityRole="button"
                  >
                    <Text
                      style={[
                        styles.ruleSetChipText,
                        selected && styles.ruleSetChipTextActive,
                      ]}
                    >
                      Năm {rs.taxYear} · {rs.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : null}

          {/* Thẻ tóm tắt bộ quy tắc thuế của Admin */}
          {ruleSet ? (
            <View style={styles.ruleSetSummaryCard}>
              <View style={styles.ruleSetHeaderRow}>
                <View style={styles.ruleSetTitleWrap}>
                  <Text style={styles.ruleSetEyebrow}>
                    BỘ QUY TẮC THUẾ NĂM {ruleSet.taxYear}
                  </Text>
                  <Text style={styles.ruleSetName}>{ruleSet.name}</Text>
                </View>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>
                    {formatStatusVi(ruleSet.status)}
                  </Text>
                </View>
              </View>
              {ruleSet.effectiveFrom ? (
                <Text style={styles.ruleSetMeta}>
                  Hiệu lực áp dụng từ: {ruleSet.effectiveFrom}
                  {ruleSet.effectiveTo ? ` đến ${ruleSet.effectiveTo}` : ''}
                </Text>
              ) : null}
            </View>
          ) : (
            <Text style={styles.lead}>
              Tra cứu toàn bộ biểu thuế lũy tiến, mức giảm trừ gia cảnh, tiêu chí người phụ thuộc và các khoản miễn thuế TNCN từ hệ thống quy tắc thuế.
            </Text>
          )}

          {/* Ô tìm kiếm nhanh */}
          <View style={styles.searchInputWrap}>
            <Ionicons
              name="search-outline"
              size={18}
              color={theme.colors.textSecondary}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm quy tắc, bậc thuế, đối tượng, giấy tờ..."
              placeholderTextColor={theme.colors.textPlaceholder}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 ? (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                accessibilityRole="button"
                accessibilityLabel="Xóa từ khóa"
              >
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={theme.colors.textSecondary}
                />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Thanh tab phân loại quy tắc thuế */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryTabsRow}
          >
            {CATEGORY_TABS.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[
                    styles.categoryTabChip,
                    active && styles.categoryTabChipActive,
                  ]}
                  onPress={() => setActiveTab(tab.key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    style={[
                      styles.categoryTabText,
                      active && styles.categoryTabTextActive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <GoldDoubleRule style={styles.rule} />

          {loading ? (
            <View style={styles.stateBox}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.stateText}>
                Đang tải quy tắc Luật thuế TNCN...
              </Text>
            </View>
          ) : error ? (
            <View style={styles.stateBox}>
              <Ionicons
                name="alert-circle-outline"
                size={32}
                color={theme.colors.error}
              />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={() => void loadData(selectedRuleSetId, false)}
                accessibilityRole="button"
              >
                <Text style={styles.retryBtnText}>Thử lại</Text>
              </TouchableOpacity>
            </View>
          ) : totalDisplayed === 0 ? (
            <View style={styles.stateBox}>
              <Text style={styles.stateText}>
                Không tìm thấy quy tắc thuế phù hợp.
              </Text>
            </View>
          ) : (
            <>
              {/* 1. Biểu thuế lũy tiến */}
              {showBrackets && brackets.length > 0 ? (
                <View style={styles.categoryBlock}>
                  <Text style={styles.categoryHeading}>
                    Biểu thuế lũy tiến ({brackets.length})
                  </Text>
                  {brackets.map((item, idx) => renderTaxRuleCard(item, idx))}
                </View>
              ) : null}

              {/* 2. Giảm trừ gia cảnh */}
              {showDeductions && deductions.length > 0 ? (
                <View style={styles.categoryBlock}>
                  <Text style={styles.categoryHeading}>
                    Giảm trừ gia cảnh ({deductions.length})
                  </Text>
                  {deductions.map((item, idx) => renderTaxRuleCard(item, idx))}
                </View>
              ) : null}

              {/* 3. Tiêu chí Người phụ thuộc */}
              {showDependents && dependents.length > 0 ? (
                <View style={styles.categoryBlock}>
                  <Text style={styles.categoryHeading}>
                    Tiêu chí Người phụ thuộc ({dependents.length})
                  </Text>
                  {dependents.map((item, idx) =>
                    renderDependentRuleCard(item, idx)
                  )}
                </View>
              ) : null}

              {/* 4. Thuế suất khác & Miễn thuế */}
              {showExemptions && rateExemptions.length > 0 ? (
                <View style={styles.categoryBlock}>
                  <Text style={styles.categoryHeading}>
                    Thuế suất khác & Miễn thuế ({rateExemptions.length})
                  </Text>
                  {rateExemptions.map((item, idx) =>
                    renderTaxRuleCard(item, idx)
                  )}
                </View>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
  },
  contentWrap: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  lead: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.textSecondary,
  },
  ruleSetChipsRow: {
    gap: 8,
    paddingBottom: 10,
  },
  ruleSetChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: theme.colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  ruleSetChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  ruleSetChipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12.5,
    color: theme.colors.textPrimary,
  },
  ruleSetChipTextActive: {
    fontFamily: fonts.bodySemi,
    color: '#FFFFFF',
  },
  ruleSetSummaryCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    marginBottom: 12,
    ...theme.shadows.card,
  },
  ruleSetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  ruleSetTitleWrap: {
    flex: 1,
  },
  ruleSetEyebrow: {
    fontFamily: fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 0.6,
    color: theme.colors.gold,
    marginBottom: 2,
  },
  ruleSetName: {
    fontFamily: fonts.serifBold,
    fontSize: 17,
    lineHeight: 23,
    color: theme.colors.primaryDark,
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: theme.colors.successBackground,
  },
  statusBadgeText: {
    fontFamily: fonts.bodySemi,
    fontSize: 11.5,
    color: theme.colors.success,
  },
  ruleSetMeta: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    color: theme.colors.textSecondary,
    marginTop: 6,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 42,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13.5,
    color: theme.colors.textPrimary,
    paddingVertical: 6,
  },
  categoryTabsRow: {
    gap: 8,
    paddingVertical: 4,
  },
  categoryTabChip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: theme.colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  categoryTabChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  categoryTabText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  categoryTabTextActive: {
    fontFamily: fonts.bodySemi,
    color: '#FFFFFF',
  },
  rule: {
    marginTop: 12,
    marginBottom: 8,
  },
  stateBox: {
    paddingVertical: 44,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  stateText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  errorText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: theme.colors.error,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  retryBtn: {
    marginTop: 6,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: theme.colors.primary,
  },
  retryBtnText: {
    fontFamily: fonts.bodySemi,
    fontSize: 13.5,
    color: '#FFFFFF',
  },
  categoryBlock: {
    marginTop: 14,
  },
  categoryHeading: {
    fontFamily: fonts.serifBold,
    fontSize: 16,
    lineHeight: 22,
    color: theme.colors.primaryDark,
    marginBottom: 4,
  },
  section: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 14,
  },
  index: {
    width: 26,
    fontFamily: fonts.serifBold,
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.gold,
  },
  sectionTitles: {
    flex: 1,
    gap: 4,
  },
  titleValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  groupTitle: {
    flex: 1,
    fontFamily: fonts.bodySemi,
    fontSize: 14.5,
    lineHeight: 21,
    color: theme.colors.textPrimary,
  },
  valueBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: theme.colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  valueBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: theme.colors.primary,
  },
  preview: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.textSecondary,
  },
  body: {
    paddingLeft: 38,
    paddingBottom: 14,
  },
  conditionBlock: {
    marginBottom: 8,
  },
  note: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    lineHeight: 20,
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  noteBullet: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    lineHeight: 20,
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  metaGrid: {
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  metaLabel: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    color: theme.colors.textSecondary,
  },
  metaValue: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 12.5,
    color: theme.colors.textPrimary,
    textAlign: 'right',
  },
  metaValueHighlight: {
    flex: 1,
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: theme.colors.primary,
    textAlign: 'right',
  },
  sourceLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
  },
  sourceLinkText: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    color: theme.colors.primary,
    textDecorationLine: 'underline',
  },
  docsLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.4,
    color: theme.colors.gold,
    marginTop: 4,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  docItem: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  docLetter: {
    width: 16,
    fontFamily: fonts.serifBold,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.primaryDark,
  },
  docCopy: {
    flex: 1,
  },
  docHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  docText: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 13.5,
    lineHeight: 20,
    color: theme.colors.textPrimary,
  },
  mandatoryChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  mandatoryChipRequired: {
    backgroundColor: theme.colors.errorBackground,
  },
  mandatoryChipOptional: {
    backgroundColor: theme.colors.surfaceSecondary,
  },
  mandatoryChipText: {
    fontFamily: fonts.bodySemi,
    fontSize: 11,
  },
  mandatoryChipTextRequired: {
    color: theme.colors.primary,
  },
  mandatoryChipTextOptional: {
    color: theme.colors.textSecondary,
  },
  subItem: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    lineHeight: 18,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
});
