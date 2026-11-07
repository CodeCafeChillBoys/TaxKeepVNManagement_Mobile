import {
  buildProofDocumentsParams,
  relationDocTypeFor,
  resolveProofDocumentsChecklist,
  selectNewUploads,
} from './proofDocumentsParams';

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

describe('relationDocTypeFor', () => {
  it('uses marriage certificate for spouse and parents-in-law, birth certificate for parents', () => {
    expect(relationDocTypeFor('SPOUSE')).toBe('MARRIAGE_CERTIFICATE');
    expect(relationDocTypeFor('PARENT_IN_LAW')).toBe('MARRIAGE_CERTIFICATE');
    expect(relationDocTypeFor('PARENT')).toBe('BIRTH_CERTIFICATE');
    expect(relationDocTypeFor(undefined)).toBe('BIRTH_CERTIFICATE');
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
