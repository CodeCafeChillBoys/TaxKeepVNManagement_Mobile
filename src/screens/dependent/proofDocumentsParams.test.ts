import { resolveProofDocumentsChecklist } from './proofDocumentsParams';

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
