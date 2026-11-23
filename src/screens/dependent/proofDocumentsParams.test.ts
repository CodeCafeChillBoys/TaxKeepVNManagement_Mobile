import {
  buildProofDocumentsParams,
  resolveProofDocumentsChecklist,
  selectNewUploads,
  selectRulesForTab,
} from './proofDocumentsParams';

describe('selectRulesForTab', () => {
  const rules = [
    { targetGroup: 'PARENT_RETIRED', docType: 'CITIZEN_ID' },
    { targetGroup: 'PARENT_RETIRED', docType: 'RELATIONSHIP_CERTIFICATE' },
    { targetGroup: 'PARENT_DISABLED', docType: 'DISABILITY_CERTIFICATE' },
    { targetGroup: 'SPOUSE_RETIRED', docType: 'CITIZEN_ID' },
    { targetGroup: 'CHILD_UNDER_18', docType: 'BIRTH_CERTIFICATE' },
  ];

  it('NPT cha/mẹ: chỉ lấy rule đúng nhóm thật trong DB, gửi đúng RELATIONSHIP_CERTIFICATE', () => {
    expect(selectRulesForTab(rules, 3, 'PARENT_RETIRED').map((r) => r.docType)).toEqual([
      'CITIZEN_ID',
      'RELATIONSHIP_CERTIFICATE',
    ]);
  });

  it('chưa có NPT: gộp rule các nhóm thuộc tab, bỏ trùng mã', () => {
    expect(selectRulesForTab(rules, 3).map((r) => r.docType)).toEqual([
      'CITIZEN_ID',
      'RELATIONSHIP_CERTIFICATE',
      'DISABILITY_CERTIFICATE',
    ]);
  });

  it('nhóm DB chưa có rule thì trả rỗng, không tự đoán mã', () => {
    expect(selectRulesForTab(rules, 1, 'CHILD_OVER_18_STUDYING')).toEqual([]);
  });
});

describe('resolveProofDocumentsChecklist', () => {
  const fallback = ['BIRTH_CERTIFICATE', 'CITIZEN_ID'];

  it('prefers requiredDocuments from navigation params when non-empty', () => {
    expect(
      resolveProofDocumentsChecklist({
        requiredDocuments: ['STUDENT_CARD'],
        fallbackDocTypes: fallback,
      })
    ).toEqual(['STUDENT_CARD']);
  });

  it('falls back when params missing or empty', () => {
    expect(
      resolveProofDocumentsChecklist({
        requiredDocuments: undefined,
        fallbackDocTypes: fallback,
      })
    ).toEqual(fallback);
    expect(
      resolveProofDocumentsChecklist({
        requiredDocuments: [],
        fallbackDocTypes: fallback,
      })
    ).toEqual(fallback);
  });
});

describe('selectNewUploads', () => {
  it('skips files synced from server (docId) and keys not on screen', () => {
    const files: Record<string, { name: string; docId?: string }> = {
      g4_cccd: { name: 'cccd.jpg', docId: 'srv-1' },
      g4_relation: { name: 'khai-sinh.jpg' },
      old_key: { name: 'other.jpg' },
    };
    expect(selectNewUploads(files, ['g4_cccd', 'g4_relation']).map(([k]) => k)).toEqual(['g4_relation']);
  });
});

describe('buildProofDocumentsParams', () => {
  it('opens the dependent’s own group instead of group 1', () => {
    const params = buildProofDocumentsParams({
      id: 'dep-1',
      fullName: 'Vũ Thị Lan',
      birthDate: '1945-03-22',
      relationship: 'PARENT',
      currentGroup: 'PARENT_RETIRED',
    } as any);
    expect(params.dependentId).toBe('dep-1');
    expect(params.groupIndex).toBe(3);
    expect(params.dependentData?.relationship).toBe('PARENT');
    expect(params.dependentData?.groupCode).toBe('PARENT_RETIRED');
  });
});
