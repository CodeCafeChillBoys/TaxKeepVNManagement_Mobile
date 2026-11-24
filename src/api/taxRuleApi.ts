import axios from 'axios';
import { apiClient } from './apiClient';
import { config } from '../constants/config';
import {
  dependentDocumentApi,
  getDocTypeLabel,
} from './dependentDocumentApi';
import { findCatalogGroup, groupName } from '../screens/dependent/dependentGroupUtils';
import { getCachedCatalog } from './dependentCatalogStore';

export interface TaxRuleSetSummary {
  ruleSetId: string;
  adminId?: string | null;
  name: string;
  taxYear: number;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  status: string;
  approvedBy?: string | null;
  approvedAt?: string | null;
}

export interface TaxRuleItem {
  ruleCode: string;
  ruleName: string;
  ruleType: 'BRACKET' | 'DEDUCTION' | 'RATE' | 'EXEMPTION' | string;
  condition?: string | Record<string, any> | null;
  value?: number | null;
  unit?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  legalDocument?: string | null;
  article?: string | null;
  clause?: string | null;
  point?: string | null;
  sourceUrl?: string | null;
  status?: string;
}

export interface DependentRuleRequiredDocument {
  id?: string | null;
  dependentRuleId?: string | null;
  docType: string;
  name: string;
  isMandatory: boolean;
  description?: string | null;
}

export interface DependentRuleItem {
  id?: string | null;
  ruleId?: string | null;
  ruleSetId?: string | null;
  dependentType: string;
  name: string;
  maxAge?: number | null;
  maxMonthlyIncome?: number | null;
  isStudying: boolean;
  isDisabled: boolean;
  conditions?: string | string[] | Record<string, any> | null;
  requiredDocuments: DependentRuleRequiredDocument[];
  status?: string;
}

export interface TaxRuleSetDetailData {
  taxRuleSet: TaxRuleSetSummary;
  taxRules: TaxRuleItem[];
  dependentRules: DependentRuleItem[];
}

function getFallbackAiCandidateUrls(path: string): string[] {
  const urls: string[] = [];
  const aiBase = (config.aiBaseUrl || '').replace(/\/+$/, '');
  if (aiBase) {
    urls.push(`${aiBase}${path}`);
    const strippedAi = aiBase.replace(/\/ai$/i, '');
    if (strippedAi && strippedAi !== aiBase) {
      urls.push(`${strippedAi}${path}`);
    }
  }
  urls.push(`http://13.236.166.3:5000${path}`);
  urls.push(`http://localhost:8000${path}`);
  return Array.from(new Set(urls));
}

async function getFromTaxRuleEndpoint<T>(path: string): Promise<T> {
  try {
    const res = await apiClient.get<T>(path, {
      suppressPermissionToast: true,
    } as any);
    return res.data;
  } catch (primaryErr: any) {
    const candidates = getFallbackAiCandidateUrls(path);
    for (const fullUrl of candidates) {
      try {
        const res = await axios.get<T>(fullUrl, { timeout: 15000 });
        return res.data;
      } catch {
        // Thử candidate tiếp theo
      }
    }
    throw primaryErr;
  }
}

function normalizeRuleSetSummary(raw: any): TaxRuleSetSummary {
  return {
    ruleSetId: String(raw?.ruleSetId || raw?.rule_set_id || raw?.id || ''),
    adminId: raw?.adminId ?? raw?.admin_id ?? null,
    name: String(raw?.name || 'Luật Thuế Thu nhập cá nhân'),
    taxYear: Number(raw?.taxYear ?? raw?.tax_year ?? new Date().getFullYear()),
    effectiveFrom: raw?.effectiveFrom ?? raw?.effective_from ?? null,
    effectiveTo: raw?.effectiveTo ?? raw?.effective_to ?? null,
    status: String(raw?.status || 'Draft'),
    approvedBy: raw?.approvedBy ?? raw?.approved_by ?? null,
    approvedAt: raw?.approvedAt ?? raw?.approved_at ?? null,
  };
}

function normalizeTaxRuleItem(raw: any): TaxRuleItem {
  return {
    ruleCode: String(raw?.ruleCode ?? raw?.rule_code ?? ''),
    ruleName: String(raw?.ruleName ?? raw?.rule_name ?? ''),
    ruleType: String(raw?.ruleType ?? raw?.rule_type ?? '').toUpperCase(),
    condition: raw?.condition ?? null,
    value:
      raw?.value !== undefined && raw?.value !== null && raw?.value !== ''
        ? Number(raw.value)
        : null,
    unit: raw?.unit ?? null,
    effectiveFrom: raw?.effectiveFrom ?? raw?.effective_from ?? null,
    effectiveTo: raw?.effectiveTo ?? raw?.effective_to ?? null,
    legalDocument: raw?.legalDocument ?? raw?.legal_document ?? null,
    article: raw?.article ?? null,
    clause: raw?.clause ?? null,
    point: raw?.point ?? null,
    sourceUrl: raw?.sourceUrl ?? raw?.source_url ?? null,
    status: String(raw?.status || 'Active'),
  };
}

function extractRequiredDocsFromCondition(
  dependentType: string,
  taxRules: TaxRuleItem[]
): DependentRuleRequiredDocument[] {
  const depDeduction = taxRules.find(
    (r) => r.ruleCode === 'PIT_DEDUCTION_DEPENDENT' || r.ruleType === 'DEDUCTION'
  );
  if (!depDeduction?.condition) return [];
  let condObj: any = depDeduction.condition;
  if (typeof condObj === 'string') {
    try {
      condObj = JSON.parse(condObj);
    } catch {
      return [];
    }
  }
  if (!condObj || !Array.isArray(condObj.eligibility)) return [];
  const matched = condObj.eligibility.find(
    (e: any) =>
      String(e?.type || e?.dependentType || '').toUpperCase() ===
      dependentType.toUpperCase()
  );
  const rawDocs = matched?.requiredDocuments ?? matched?.required_documents;
  if (!Array.isArray(rawDocs)) return [];
  return rawDocs.map((d: any) => ({
    id: d?.id ?? null,
    dependentRuleId: d?.dependentRuleId ?? d?.dependent_rule_id ?? null,
    docType: String(d?.docType ?? d?.doc_type ?? 'OTHER'),
    name: String(
      d?.name || getDocTypeLabel(String(d?.docType ?? d?.doc_type ?? 'OTHER'))
    ),
    isMandatory: (d?.isMandatory ?? d?.is_mandatory) !== false,
    description: d?.description ?? null,
  }));
}

function normalizeDependentRuleItem(
  raw: any,
  taxRules: TaxRuleItem[]
): DependentRuleItem {
  const dependentType = String(
    raw?.dependentType ?? raw?.dependent_type ?? ''
  ).trim();
  const rawDocs = raw?.requiredDocuments ?? raw?.required_documents;
  let requiredDocuments: DependentRuleRequiredDocument[] = [];

  if (Array.isArray(rawDocs) && rawDocs.length > 0) {
    requiredDocuments = rawDocs.map((d: any) => {
      if (typeof d === 'string') {
        return {
          docType: 'OTHER',
          name: d,
          isMandatory: true,
          description: null,
        };
      }
      const docType = String(d?.docType ?? d?.doc_type ?? 'OTHER');
      return {
        id: d?.id ?? null,
        dependentRuleId: d?.dependentRuleId ?? d?.dependent_rule_id ?? null,
        docType,
        name: String(d?.name || getDocTypeLabel(docType)),
        isMandatory: (d?.isMandatory ?? d?.is_mandatory) !== false,
        description: d?.description ?? null,
      };
    });
  } else if (dependentType) {
    requiredDocuments = extractRequiredDocsFromCondition(dependentType, taxRules);
  }

  return {
    id: raw?.id ?? null,
    ruleId: raw?.ruleId ?? raw?.rule_id ?? null,
    ruleSetId: raw?.ruleSetId ?? raw?.rule_set_id ?? null,
    dependentType,
    name: String(raw?.name || groupName(getCachedCatalog(), dependentType) || dependentType),
    maxAge:
      raw?.maxAge !== undefined && raw?.maxAge !== null
        ? Number(raw.maxAge)
        : raw?.max_age !== undefined && raw?.max_age !== null
        ? Number(raw.max_age)
        : null,
    maxMonthlyIncome:
      raw?.maxMonthlyIncome !== undefined && raw?.maxMonthlyIncome !== null
        ? Number(raw.maxMonthlyIncome)
        : raw?.max_monthly_income !== undefined && raw?.max_monthly_income !== null
        ? Number(raw.max_monthly_income)
        : null,
    isStudying: Boolean(raw?.isStudying ?? raw?.is_studying ?? false),
    isDisabled: Boolean(raw?.isDisabled ?? raw?.is_disabled ?? false),
    conditions: raw?.conditions ?? null,
    requiredDocuments,
    status: String(raw?.status || 'Active'),
  };
}

export const taxRuleApi = {
  /**
   * Lấy danh sách tất cả các bộ quy tắc thuế của Admin (GET /api/tax-rules)
   */
  async getAllRuleSets(): Promise<TaxRuleSetSummary[]> {
    const raw = await getFromTaxRuleEndpoint<any>('/api/tax-rules');
    const list = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.data)
      ? raw.data
      : [];
    const normalized = list
      .map(normalizeRuleSetSummary)
      .filter((s: TaxRuleSetSummary) => Boolean(s.ruleSetId));

    // Ưu tiên bộ luật đang Active và năm tính thuế mới nhất
    return normalized.sort((a: TaxRuleSetSummary, b: TaxRuleSetSummary) => {
      const aActive = a.status.toLowerCase() === 'active' ? 1 : 0;
      const bActive = b.status.toLowerCase() === 'active' ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      return (b.taxYear || 0) - (a.taxYear || 0);
    });
  },

  /**
   * Lấy chi tiết toàn bộ nội dung bộ quy tắc thuế (GET /api/tax-rules/{ruleSetId})
   */
  async getRuleSetDetail(ruleSetId: string): Promise<TaxRuleSetDetailData> {
    const raw = await getFromTaxRuleEndpoint<any>(`/api/tax-rules/${ruleSetId}`);
    const payload = raw?.data?.taxRuleSet || raw?.data?.taxRules ? raw.data : raw;

    const taxRuleSet = normalizeRuleSetSummary(payload?.taxRuleSet || payload);
    const rawTaxRules = Array.isArray(payload?.taxRules ?? payload?.tax_rules)
      ? payload.taxRules ?? payload.tax_rules
      : [];
    const taxRules: TaxRuleItem[] = rawTaxRules.map(normalizeTaxRuleItem);

    const rawDepRules = Array.isArray(
      payload?.dependentRules ?? payload?.dependent_rules
    )
      ? payload.dependentRules ?? payload.dependent_rules
      : [];
    let dependentRules: DependentRuleItem[] = rawDepRules.map((dr: any) =>
      normalizeDependentRuleItem(dr, taxRules)
    );

    // Nếu bộ luật chưa có dependentRules riêng, gom từ /api/v1/dependent-rules đã đồng bộ trên BE
    if (dependentRules.length === 0) {
      const syncedDocRules = await dependentDocumentApi.getRules();
      if (syncedDocRules.length > 0) {
        const grouped = new Map<string, DependentRuleRequiredDocument[]>();
        for (const r of syncedDocRules) {
          const group = (r.targetGroup || '').trim().toUpperCase();
          if (!group) continue;
          const list = grouped.get(group) || [];
          list.push({
            id: r.ruleId,
            docType: r.docType,
            name: getDocTypeLabel(r.docType, r.docName),
            isMandatory: r.isMandatory,
            description: r.description || null,
          });
          grouped.set(group, list);
        }
        const catalog = getCachedCatalog();
        dependentRules = Array.from(grouped.entries()).map(([group, docs]) => {
          const catalogGroup = findCatalogGroup(catalog, group);
          return {
            id: group,
            dependentType: group,
            name: groupName(catalog, group),
            isStudying: Boolean(catalogGroup?.requireStudying),
            isDisabled: Boolean(catalogGroup?.requireDisabled),
            requiredDocuments: docs,
            status: 'Active',
          };
        });
      }
    }

    return {
      taxRuleSet,
      taxRules,
      dependentRules,
    };
  },
};
