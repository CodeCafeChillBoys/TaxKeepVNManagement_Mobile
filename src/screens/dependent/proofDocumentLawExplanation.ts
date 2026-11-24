import type {
  DependentRuleItem,
  DependentRuleRequiredDocument,
  TaxRuleItem,
  TaxRuleSetDetailData,
  TaxRuleSetSummary,
} from '../../api/taxRuleApi';
import { groupCodeToIndex } from './dependentGroupUtils';

export interface ProofDocLawModalData {
  title: string;
  isMandatory: boolean;
  ruleSetLabel?: string;
  effectiveRangeLabel?: string;
  legalBasis?: string;
  deductionAmountLabel?: string;
  reasonText?: string;
  dependentGroupName?: string;
  groupConditions: string[];
  sourceUrl?: string;
  hasDynamicData: boolean;
}

const DOC_TYPE_CANONICAL_MAP: Record<string, string> = {
  CITIZEN_CARD: 'CITIZEN_ID',
  CCCD: 'CITIZEN_ID',
  ID_CARD: 'CITIZEN_ID',
  STUDENT_DOCUMENT: 'STUDENT_CARD',
  STUDENT_CONFIRMATION: 'STUDENT_CARD',
};

export function normalizeProofDocTypeCode(docType?: string | null): string {
  const clean = String(docType || '').trim().toUpperCase();
  return DOC_TYPE_CANONICAL_MAP[clean] || clean;
}

export function isSameProofDocType(a?: string | null, b?: string | null): boolean {
  const na = normalizeProofDocTypeCode(a);
  const nb = normalizeProofDocTypeCode(b);
  return Boolean(na && nb && na === nb);
}

/**
 * Chọn bộ Quy tắc thuế đang hiệu lực (Active) phù hợp nhất từ danh sách cấu hình Admin.
 * Ưu tiên bộ Active khớp năm hiệu lực của NPT; nếu không có thì lấy bộ Active năm mới nhất.
 */
export function selectActiveRuleSetForYear(
  ruleSets: TaxRuleSetSummary[],
  preferredYear?: number | null
): TaxRuleSetSummary | null {
  if (!Array.isArray(ruleSets) || ruleSets.length === 0) return null;

  const activeSets = ruleSets.filter(
    (s) => String(s.status || '').trim().toLowerCase() === 'active'
  );
  const pool = activeSets.length > 0 ? activeSets : ruleSets;

  if (preferredYear && Number.isFinite(preferredYear)) {
    const exact = pool.find((s) => Number(s.taxYear) === Number(preferredYear));
    if (exact) return exact;
  }

  return [...pool].sort((a, b) => (Number(b.taxYear) || 0) - (Number(a.taxYear) || 0))[0] || null;
}

export function extractYearFromEffectiveMonth(effectiveFromMonth?: string | null): number | null {
  if (!effectiveFromMonth) return null;
  const match = String(effectiveFromMonth).trim().match(/^(\d{4})/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  return Number.isFinite(year) && year > 1900 ? year : null;
}

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

function formatLegalBasis(rule?: TaxRuleItem | null): string | undefined {
  if (!rule) return undefined;
  const parts: string[] = [];
  if (rule.article) {
    const art = String(rule.article).trim();
    if (art) parts.push(/^điều/i.test(art) ? art : `Điều ${art}`);
  }
  if (rule.clause) {
    const cls = String(rule.clause).trim();
    if (cls) parts.push(/^khoản/i.test(cls) ? cls : `Khoản ${cls}`);
  }
  if (rule.point) {
    const pt = String(rule.point).trim();
    if (pt) parts.push(/^điểm/i.test(pt) ? pt : `Điểm ${pt}`);
  }
  if (rule.legalDocument) {
    const doc = String(rule.legalDocument).trim();
    if (doc) parts.push(doc);
  }
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

function parseConditionEntries(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .flatMap((item) => parseConditionEntries(item))
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (
      (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
      (trimmed.startsWith('{') && trimmed.endsWith('}'))
    ) {
      try {
        return parseConditionEntries(JSON.parse(trimmed));
      } catch {
        // Giữ nguyên dạng chuỗi
      }
    }
    return trimmed
      .split(/\r?\n|;/)
      .map((line) => line.replace(/^[-•*]\s*/, '').trim())
      .filter(Boolean);
  }
  if (typeof raw === 'object') {
    const out: string[] = [];
    if (raw.description) {
      out.push(...parseConditionEntries(raw.description));
    }
    if (raw.conditions) {
      out.push(...parseConditionEntries(raw.conditions));
    }
    return out;
  }
  return [];
}

function findDependentDeductionTaxRule(taxRules: TaxRuleItem[]): TaxRuleItem | undefined {
  if (!Array.isArray(taxRules) || taxRules.length === 0) return undefined;

  return (
    taxRules.find((r) => String(r.ruleCode || '').trim().toUpperCase() === 'PIT_DEDUCTION_DEPENDENT') ||
    taxRules.find((r) => {
      const code = String(r.ruleCode || '').toUpperCase();
      const name = String(r.ruleName || '').toLowerCase();
      return (
        String(r.ruleType || '').toUpperCase() === 'DEDUCTION' &&
        (code.includes('DEPENDENT') || name.includes('phụ thuộc'))
      );
    }) ||
    taxRules.find((r) => String(r.legalDocument || '').trim().length > 0)
  );
}

function extractEligibilityEntryFromTaxRule(
  depTaxRule: TaxRuleItem | undefined,
  targetGroup?: string | null,
  groupIndex?: number
): any | null {
  if (!depTaxRule?.condition) return null;
  let condObj: any = depTaxRule.condition;
  if (typeof condObj === 'string') {
    try {
      condObj = JSON.parse(condObj);
    } catch {
      return null;
    }
  }
  if (!condObj || !Array.isArray(condObj.eligibility)) return null;

  const upperTarget = String(targetGroup || '').trim().toUpperCase();
  if (upperTarget) {
    const exact = condObj.eligibility.find(
      (e: any) => String(e?.type || e?.dependentType || '').trim().toUpperCase() === upperTarget
    );
    if (exact) return exact;
  }

  if (typeof groupIndex === 'number') {
    const byIdx = condObj.eligibility.find((e: any) => {
      const code = String(e?.type || e?.dependentType || '').trim().toUpperCase();
      return code && groupCodeToIndex(code) === groupIndex;
    });
    if (byIdx) return byIdx;
  }

  return null;
}

function findMatchingDependentRule(
  dependentRules: DependentRuleItem[],
  targetGroup?: string | null,
  groupIndex?: number,
  docType?: string | null
): DependentRuleItem | undefined {
  if (!Array.isArray(dependentRules) || dependentRules.length === 0) return undefined;

  const upperTarget = String(targetGroup || '').trim().toUpperCase();
  if (upperTarget) {
    const exact = dependentRules.find(
      (dr) => String(dr.dependentType || '').trim().toUpperCase() === upperTarget
    );
    if (exact) return exact;
  }

  if (typeof groupIndex === 'number') {
    const sameTab = dependentRules.filter((dr) => {
      const code = String(dr.dependentType || '').trim().toUpperCase();
      return code && groupCodeToIndex(code) === groupIndex;
    });
    if (sameTab.length > 0) {
      if (docType) {
        const withDoc = sameTab.find((dr) =>
          (dr.requiredDocuments || []).some((d) => isSameProofDocType(d.docType, docType))
        );
        if (withDoc) return withDoc;
      }
      return sameTab[0];
    }
  }

  return undefined;
}

function findMatchingRequiredDocument(
  matchedDepRule: DependentRuleItem | undefined,
  allDependentRules: DependentRuleItem[],
  docType: string
): DependentRuleRequiredDocument | undefined {
  const fromMatched = (matchedDepRule?.requiredDocuments || []).find((d) =>
    isSameProofDocType(d.docType, docType)
  );
  if (fromMatched) return fromMatched;

  for (const dr of allDependentRules) {
    const found = (dr.requiredDocuments || []).find(
      (d) => isSameProofDocType(d.docType, docType) && String(d.description || '').trim().length > 0
    );
    if (found) return found;
  }
  return undefined;
}

function dedupeLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

export interface BuildProofDocLawParams {
  docType: string;
  docTitle: string;
  isMandatory: boolean;
  targetGroup?: string | null;
  groupIndex?: number;
  ruleDescription?: string | null;
  taxRuleDetail?: TaxRuleSetDetailData | null;
}

/**
 * Tổng hợp nội dung giải thích pháp lý & lý do cần nộp chứng từ hoàn toàn từ
 * bộ Quy tắc thuế đang áp dụng của Admin (/api/tax-rules) và quy tắc chứng từ NPT (/api/v1/dependent-rules).
 * Không hard code nội dung luật trên FE.
 */
export function buildProofDocLawExplanation(
  params: BuildProofDocLawParams
): ProofDocLawModalData {
  const {
    docType,
    docTitle,
    isMandatory,
    targetGroup,
    groupIndex,
    ruleDescription,
    taxRuleDetail,
  } = params;

  const taxRules = taxRuleDetail?.taxRules || [];
  const dependentRules = taxRuleDetail?.dependentRules || [];
  const taxRuleSet = taxRuleDetail?.taxRuleSet;

  const depTaxRule = findDependentDeductionTaxRule(taxRules);
  const matchedDepRule = findMatchingDependentRule(
    dependentRules,
    targetGroup,
    groupIndex,
    docType
  );
  const matchedReqDoc = findMatchingRequiredDocument(
    matchedDepRule,
    dependentRules,
    docType
  );
  const eligibilityEntry = extractEligibilityEntryFromTaxRule(
    depTaxRule,
    targetGroup,
    groupIndex
  );

  // 1. Lý do cần nộp giấy tờ: lấy từ mô tả chứng từ Admin cấu hình trong Quy tắc thuế / Dependent Rules
  const reasonCandidates = [
    matchedReqDoc?.description,
    ruleDescription,
    eligibilityEntry?.documentReason,
  ];
  const reasonText = reasonCandidates
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .find(Boolean);

  // 2. Điều kiện nhóm đối tượng NPT theo cấu hình Admin
  const rawConditions: string[] = [];
  if (matchedDepRule) {
    if (matchedDepRule.maxAge !== null && matchedDepRule.maxAge !== undefined) {
      rawConditions.push(`Giới hạn độ tuổi theo quy tắc: ${matchedDepRule.maxAge} tuổi.`);
    }
    if (
      matchedDepRule.maxMonthlyIncome !== null &&
      matchedDepRule.maxMonthlyIncome !== undefined
    ) {
      rawConditions.push(
        `Thu nhập bình quân tháng không vượt quá ${Number(matchedDepRule.maxMonthlyIncome).toLocaleString('vi-VN')} VNĐ/tháng.`
      );
    }
    if (matchedDepRule.isStudying) {
      rawConditions.push('Áp dụng cho đối tượng đang theo học.');
    }
    if (matchedDepRule.isDisabled) {
      rawConditions.push('Áp dụng cho đối tượng bị khuyết tật / không có khả năng lao động.');
    }
    rawConditions.push(...parseConditionEntries(matchedDepRule.conditions));
  }
  if (eligibilityEntry) {
    rawConditions.push(...parseConditionEntries(eligibilityEntry.conditions));
    if (typeof eligibilityEntry.description === 'string') {
      rawConditions.push(...parseConditionEntries(eligibilityEntry.description));
    }
  }
  const groupConditions = dedupeLines(rawConditions);

  // 3. Thông tin bộ Quy tắc thuế & căn cứ pháp lý của Admin
  const ruleSetLabel = taxRuleSet?.name
    ? taxRuleSet.taxYear
      ? `${taxRuleSet.name} (Kỳ thuế ${taxRuleSet.taxYear})`
      : taxRuleSet.name
    : undefined;

  let effectiveRangeLabel: string | undefined;
  if (taxRuleSet?.effectiveFrom || taxRuleSet?.effectiveTo) {
    const from = taxRuleSet.effectiveFrom || '';
    const to = taxRuleSet.effectiveTo || '';
    effectiveRangeLabel = from && to ? `Hiệu lực: ${from} – ${to}` : from ? `Hiệu lực từ: ${from}` : `Hiệu lực đến: ${to}`;
  }

  const legalBasis = formatLegalBasis(depTaxRule);

  let deductionAmountLabel: string | undefined;
  if (depTaxRule && depTaxRule.value !== null && depTaxRule.value !== undefined && Number.isFinite(Number(depTaxRule.value))) {
    const formatted = Number(depTaxRule.value).toLocaleString('vi-VN');
    const unitLabel = formatUnitVi(depTaxRule.unit);
    deductionAmountLabel = unitLabel ? `${formatted} ${unitLabel}` : `${formatted} VNĐ`;
  }

  const rawSourceUrl = typeof depTaxRule?.sourceUrl === 'string' ? depTaxRule.sourceUrl.trim() : '';
  const sourceUrl = /^https?:\/\//i.test(rawSourceUrl) ? rawSourceUrl : undefined;

  const dependentGroupName =
    (matchedDepRule?.name && matchedDepRule.name.trim()) ||
    (typeof eligibilityEntry?.name === 'string' && eligibilityEntry.name.trim()) ||
    undefined;

  const hasDynamicData = Boolean(
    reasonText ||
      groupConditions.length > 0 ||
      legalBasis ||
      ruleSetLabel ||
      deductionAmountLabel
  );

  return {
    title: docTitle,
    isMandatory,
    ruleSetLabel,
    effectiveRangeLabel,
    legalBasis,
    deductionAmountLabel,
    reasonText: reasonText || undefined,
    dependentGroupName,
    groupConditions,
    sourceUrl,
    hasDynamicData,
  };
}
