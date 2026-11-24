import {
  computeMissingMandatoryDocTypes,
  describeMissingDoc,
  getDependentStatusMeta,
  formatDependentDate,
  formatDependentMonth,
  formatDependentMonthRange,
  normalizeDependentNote,
  calculateDependentAge,
} from './dependentDetailUtils';

describe('dependentDetailUtils', () => {
  it('maps status and profile completeness to clear Vietnamese metadata', () => {
    expect(getDependentStatusMeta('ACTIVE', true, 0).tone).toBe('success');
    expect(getDependentStatusMeta('ACTIVE', true, 1).tone).toBe('warning');
    expect(getDependentStatusMeta('ACTIVE', true, 1).label).toBe('Chờ bổ sung minh chứng');
    expect(getDependentStatusMeta('PENDING_DOCUMENTS', false).tone).toBe('warning');
    expect(getDependentStatusMeta('INACTIVE', false).tone).toBe('neutral');
  });

  it('detects missing mandatory documents from DB rules even when BE returns empty missingDocuments', () => {
    const missing = computeMissingMandatoryDocTypes(
      {
        currentGroup: 'PARENT_RETIRED',
        missingDocuments: [],
        documents: [
          { docType: 'CITIZEN_ID', isCurrent: true },
          { docType: 'BIRTH_CERTIFICATE', isCurrent: true },
        ],
      },
      [
        { targetGroup: 'PARENT_RETIRED', docType: 'CITIZEN_ID', isMandatory: true, isActive: true },
        { targetGroup: 'PARENT_RETIRED', docType: 'BIRTH_CERTIFICATE', isMandatory: true, isActive: true },
        { targetGroup: 'PARENT_RETIRED', docType: 'RELATIONSHIP_CERTIFICATE', isMandatory: true, isActive: true },
      ]
    );
    expect(missing).toEqual(['RELATIONSHIP_CERTIFICATE']);
  });

  const altRules = [
    { targetGroup: 'PARENT_RETIRED', docType: 'CITIZEN_ID', docName: 'CCCD', isMandatory: true, alternativeGroup: null },
    { targetGroup: 'PARENT_RETIRED', docType: 'RELATIONSHIP_CERTIFICATE', docName: 'Giấy xác nhận quan hệ', isMandatory: true, alternativeGroup: 'RELATION_PROOF' },
    { targetGroup: 'PARENT_RETIRED', docType: 'BIRTH_CERTIFICATE', docName: 'Giấy khai sinh', isMandatory: true, alternativeGroup: 'RELATION_PROOF' },
  ];

  it('alternativeGroup: CCCD + giấy khai sinh là đủ, kể cả khi BE còn trả mã rule đầu', () => {
    expect(
      computeMissingMandatoryDocTypes(
        {
          currentGroup: 'PARENT_RETIRED',
          missingDocuments: ['RELATIONSHIP_CERTIFICATE'],
          documents: [{ docType: 'CITIZEN_ID' }, { docType: 'BIRTH_CERTIFICATE' }],
        },
        altRules
      )
    ).toEqual([]);
  });

  it('alternativeGroup: thiếu cả nhóm thì chỉ báo 1 mã, nhãn "Thiếu 1 trong"', () => {
    const missing = computeMissingMandatoryDocTypes(
      { currentGroup: 'PARENT_RETIRED', missingDocuments: [], documents: [{ docType: 'CITIZEN_ID' }] },
      altRules
    );
    expect(missing).toEqual(['RELATIONSHIP_CERTIFICATE']);
    expect(describeMissingDoc(missing[0], altRules, 'PARENT_RETIRED')).toBe(
      'Thiếu 1 trong: Giấy xác nhận quan hệ / Giấy khai sinh'
    );
    expect(describeMissingDoc('CITIZEN_ID', altRules, 'PARENT_RETIRED')).toBe('CCCD');
  });

  it('RULES_NOT_CONFIGURED giữ nguyên và hiện câu báo chưa cấu hình', () => {
    const missing = computeMissingMandatoryDocTypes(
      { currentGroup: 'NEW_GROUP', missingDocuments: ['RULES_NOT_CONFIGURED'], documents: [] },
      altRules
    );
    expect(missing).toEqual(['RULES_NOT_CONFIGURED']);
    expect(describeMissingDoc('RULES_NOT_CONFIGURED', altRules, 'NEW_GROUP')).toMatch(
      /chưa được cấu hình danh mục giấy tờ/
    );
  });

  it('formats dates and effective month ranges cleanly', () => {
    expect(formatDependentDate('1993-11-10T00:00:00Z')).toBe('10/11/1993');
    expect(formatDependentDate(null)).toBe('Chưa cập nhật');
    expect(formatDependentMonth('2026-01')).toBe('01/2026');
    expect(formatDependentMonthRange('2026-01', '2026-12')).toBe('01/2026 → 12/2026');
  });

  it('normalizes optional notes and enforces 500 char BE limit', () => {
    expect(normalizeDependentNote('   ')).toBeUndefined();
    expect(normalizeDependentNote('  Con học đại học  ')).toBe('Con học đại học');
    expect(normalizeDependentNote('a'.repeat(600))?.length).toBe(500);
  });

  it('calculates age accurately relative to reference date', () => {
    const ref = new Date(2026, 10, 23); // 2026-11-23
    expect(calculateDependentAge('1993-11-10T00:00:00Z', ref)).toBe(33);
    expect(calculateDependentAge('2010-12-01', ref)).toBe(15);
    expect(calculateDependentAge(undefined, ref)).toBe(0);
  });
});
