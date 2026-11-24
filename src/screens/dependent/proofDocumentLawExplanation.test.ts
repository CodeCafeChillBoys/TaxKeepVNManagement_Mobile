import type { TaxRuleSetDetailData, TaxRuleSetSummary } from '../../api/taxRuleApi';
import {
  buildProofDocLawExplanation,
  extractYearFromEffectiveMonth,
  selectActiveRuleSetForYear,
} from './proofDocumentLawExplanation';

const SAMPLE_TAX_RULE_DETAIL: TaxRuleSetDetailData = {
  taxRuleSet: {
    ruleSetId: 'rs-2026',
    name: 'Quy tắc thuế TNCN năm 2026',
    taxYear: 2026,
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    status: 'Active',
  },
  taxRules: [
    {
      ruleCode: 'PIT_DEDUCTION_DEPENDENT',
      ruleName: 'Giảm trừ người phụ thuộc',
      ruleType: 'DEDUCTION',
      value: 6200000,
      unit: 'VND/person/month',
      legalDocument: 'Nghị quyết 110/2025/UBTVQH15',
      article: '1',
      clause: '2',
      point: 'd',
      sourceUrl: 'https://thuvienphapluat.vn/example',
      status: 'Active',
    },
  ],
  dependentRules: [
    {
      id: 'dep-1',
      dependentType: 'CHILD_UNDER_18',
      name: 'Con dưới 18 tuổi',
      maxAge: 18,
      maxMonthlyIncome: null,
      isStudying: false,
      isDisabled: false,
      conditions: ['Con đẻ, con nuôi hợp pháp tính đủ theo tháng sinh dưới 18 tuổi'],
      requiredDocuments: [
        {
          docType: 'BIRTH_CERTIFICATE',
          name: 'Giấy khai sinh (Bản sao)',
          isMandatory: true,
          description: 'Chứng minh quan hệ cha, mẹ, con và ngày tháng năm sinh dưới 18 tuổi',
        },
        {
          docType: 'CITIZEN_CARD',
          name: 'Căn cước công dân',
          isMandatory: false,
          description: 'Xác thực số định danh cá nhân nếu trẻ đã được cấp CCCD',
        },
      ],
      status: 'Active',
    },
  ],
};

describe('proofDocumentLawExplanation', () => {
  it('selects Active rule set matching preferred year, or latest Active rule set', () => {
    const sets: TaxRuleSetSummary[] = [
      { ruleSetId: 'rs-2025', name: 'Luật 2025', taxYear: 2025, status: 'Active' },
      { ruleSetId: 'rs-2026', name: 'Luật 2026', taxYear: 2026, status: 'Active' },
      { ruleSetId: 'rs-2027-draft', name: 'Dự thảo 2027', taxYear: 2027, status: 'Draft' },
    ];

    expect(selectActiveRuleSetForYear(sets, 2025)?.ruleSetId).toBe('rs-2025');
    expect(selectActiveRuleSetForYear(sets, 2026)?.ruleSetId).toBe('rs-2026');
    expect(selectActiveRuleSetForYear(sets, 2028)?.ruleSetId).toBe('rs-2026');
    expect(selectActiveRuleSetForYear(sets, null)?.ruleSetId).toBe('rs-2026');
    expect(extractYearFromEffectiveMonth('2026-03')).toBe(2026);
    expect(extractYearFromEffectiveMonth(undefined)).toBeNull();
  });

  it('builds reason, group conditions, and legal basis dynamically from Admin Tax Rules', () => {
    const result = buildProofDocLawExplanation({
      docType: 'BIRTH_CERTIFICATE',
      docTitle: 'Giấy khai sinh (Bản sao)',
      isMandatory: true,
      targetGroup: 'CHILD_UNDER_18',
      groupIndex: 0,
      ruleDescription: 'Mô tả ngắn từ dependent-rules',
      taxRuleDetail: SAMPLE_TAX_RULE_DETAIL,
    });

    expect(result.hasDynamicData).toBe(true);
    expect(result.reasonText).toBe(
      'Chứng minh quan hệ cha, mẹ, con và ngày tháng năm sinh dưới 18 tuổi'
    );
    expect(result.dependentGroupName).toBe('Con dưới 18 tuổi');
    expect(result.groupConditions).toContain('Giới hạn độ tuổi theo quy tắc: 18 tuổi.');
    expect(result.groupConditions).toContain(
      'Con đẻ, con nuôi hợp pháp tính đủ theo tháng sinh dưới 18 tuổi'
    );
    expect(result.ruleSetLabel).toBe('Quy tắc thuế TNCN năm 2026 (Kỳ thuế 2026)');
    expect(result.legalBasis).toBe('Điều 1 · Khoản 2 · Điểm d · Nghị quyết 110/2025/UBTVQH15');
    expect(result.deductionAmountLabel).toBe('6.200.000 VNĐ/người/tháng');
    expect(result.sourceUrl).toBe('https://thuvienphapluat.vn/example');
  });

  it('matches docType aliases (CITIZEN_ID vs CITIZEN_CARD) from Admin Tax Rules', () => {
    const result = buildProofDocLawExplanation({
      docType: 'CITIZEN_ID',
      docTitle: 'Căn cước công dân',
      isMandatory: false,
      targetGroup: 'CHILD_UNDER_18',
      groupIndex: 0,
      taxRuleDetail: SAMPLE_TAX_RULE_DETAIL,
    });

    expect(result.reasonText).toBe('Xác thực số định danh cá nhân nếu trẻ đã được cấp CCCD');
  });

  it('falls back to dependent-rules description without hardcoding any law text when taxRuleDetail is null', () => {
    const withDesc = buildProofDocLawExplanation({
      docType: 'BIRTH_CERTIFICATE',
      docTitle: 'Giấy khai sinh (Bản sao)',
      isMandatory: true,
      ruleDescription: 'Chứng minh quan hệ cha, mẹ, con',
      taxRuleDetail: null,
    });

    expect(withDesc.hasDynamicData).toBe(true);
    expect(withDesc.reasonText).toBe('Chứng minh quan hệ cha, mẹ, con');
    expect(withDesc.legalBasis).toBeUndefined();
    expect(withDesc.groupConditions).toEqual([]);

    const withoutAnyData = buildProofDocLawExplanation({
      docType: 'BIRTH_CERTIFICATE',
      docTitle: 'Giấy khai sinh (Bản sao)',
      isMandatory: true,
      taxRuleDetail: null,
    });

    expect(withoutAnyData.hasDynamicData).toBe(false);
    expect(withoutAnyData.reasonText).toBeUndefined();
  });
});
