import {
  buildDocSlots,
  buildProofDocumentsParams,
  expandChecklistToRules,
  isDocSlotSatisfied,
  listDocsNeedingReupload,
  resolveProofDocumentsChecklist,
  selectNewUploads,
  selectRulesForTab,
} from './proofDocumentsParams';
import { SEED_CATALOG } from './seedCatalog.test.fixture';

describe('listDocsNeedingReupload', () => {
  const docs = [
    { key: 'a', title: 'a. Giấy khai sinh' },
    { key: 'b', title: 'b. CCCD' },
    { key: 'c', title: 'c. Thẻ SV' },
  ];

  it('chỉ trả ô còn giấy cũ cần nộp lại, bỏ ô đã chọn ảnh mới', () => {
    const files = {
      a: { docId: 'd1', needsReupload: true }, // giấy cũ, chưa đổi
      b: { needsReupload: false }, // vừa chọn ảnh mới (không còn docId)
      c: { docId: 'd3', needsReupload: false }, // giấy còn hợp lệ
    };
    expect(listDocsNeedingReupload(docs, files).map((d) => d.title)).toEqual(['a. Giấy khai sinh']);
  });

  it('không có giấy cũ thì rỗng', () => {
    expect(listDocsNeedingReupload(docs, {})).toEqual([]);
  });
});

describe('selectRulesForTab', () => {
  const rules = [
    { targetGroup: 'PARENT_RETIRED', docType: 'CITIZEN_ID' },
    { targetGroup: 'PARENT_RETIRED', docType: 'RELATIONSHIP_CERTIFICATE' },
    { targetGroup: 'PARENT_DISABLED', docType: 'DISABILITY_CERTIFICATE' },
    { targetGroup: 'SPOUSE_RETIRED', docType: 'CITIZEN_ID' },
    { targetGroup: 'CHILD_UNDER_18', docType: 'BIRTH_CERTIFICATE' },
  ];

  it('NPT cha/mẹ: chỉ lấy rule đúng nhóm thật trong DB, gửi đúng RELATIONSHIP_CERTIFICATE', () => {
    expect(selectRulesForTab(rules, 3, 'PARENT_RETIRED', SEED_CATALOG).map((r) => r.docType)).toEqual([
      'CITIZEN_ID',
      'RELATIONSHIP_CERTIFICATE',
    ]);
  });

  it('chưa có NPT: gộp rule các nhóm thuộc tab, bỏ trùng mã', () => {
    expect(selectRulesForTab(rules, 3, undefined, SEED_CATALOG).map((r) => r.docType)).toEqual([
      'CITIZEN_ID',
      'RELATIONSHIP_CERTIFICATE',
      'DISABILITY_CERTIFICATE',
    ]);
  });

  it('catalog chưa về: vẫn lấy rule đúng nhóm của NPT', () => {
    expect(selectRulesForTab(rules, 3, 'PARENT_RETIRED', null).map((r) => r.docType)).toEqual([
      'CITIZEN_ID',
      'RELATIONSHIP_CERTIFICATE',
    ]);
  });

  it('nhóm DB chưa có rule thì trả rỗng, không tự đoán mã', () => {
    expect(selectRulesForTab(rules, 1, 'CHILD_OVER_18_STUDYING', SEED_CATALOG)).toEqual([]);
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
    } as any, SEED_CATALOG);
    expect(params.dependentId).toBe('dep-1');
    expect(params.groupIndex).toBe(3);
    expect(params.dependentData?.relationship).toBe('PARENT');
    expect(params.dependentData?.groupCode).toBe('PARENT_RETIRED');
  });

  it('falls back to tab 0 when the group is not in the catalog yet', () => {
    const params = buildProofDocumentsParams(
      { id: 'dep-2', fullName: 'A', birthDate: '2000-01-01', currentGroup: 'NEW_GROUP' } as any,
      null
    );
    expect(params.groupIndex).toBe(0);
    expect(params.dependentData?.groupCode).toBe('NEW_GROUP');
  });
});

describe('buildDocSlots', () => {
  const parentRetiredRules = [
    { targetGroup: 'PARENT_RETIRED', docType: 'CITIZEN_ID', isMandatory: true, alternativeGroup: null },
    { targetGroup: 'PARENT_RETIRED', docType: 'RELATIONSHIP_CERTIFICATE', isMandatory: true, alternativeGroup: 'RELATION_PROOF' },
    { targetGroup: 'PARENT_RETIRED', docType: 'BIRTH_CERTIFICATE', isMandatory: true, alternativeGroup: 'RELATION_PROOF' },
  ];

  it('PARENT_RETIRED: CCCD + 2 giấy RELATION_PROOF → 2 ô', () => {
    const slots = buildDocSlots(parentRetiredRules);
    expect(slots).toHaveLength(2);
    expect(slots[0].rules.map((r) => r.docType)).toEqual(['CITIZEN_ID']);
    expect(slots[1].alternativeGroup).toBe('RELATION_PROOF');
    expect(slots[1].rules.map((r) => r.docType)).toEqual(['RELATIONSHIP_CERTIFICATE', 'BIRTH_CERTIFICATE']);
    expect(slots.every((s) => s.isMandatory)).toBe(true);
  });

  it('nộp BIRTH_CERTIFICATE → ô quan hệ đủ, ô CCCD chưa đủ', () => {
    const [cccdSlot, relationSlot] = buildDocSlots(parentRetiredRules);
    expect(isDocSlotSatisfied(relationSlot, ['BIRTH_CERTIFICATE'])).toBe(true);
    expect(isDocSlotSatisfied(cccdSlot, ['BIRTH_CERTIFICATE'])).toBe(false);
    expect(isDocSlotSatisfied(cccdSlot, ['CITIZEN_CARD'])).toBe(true);
  });

  it('nhóm không có alternativeGroup → mỗi rule một ô', () => {
    const slots = buildDocSlots([
      { docType: 'CITIZEN_ID', isMandatory: true },
      { docType: 'STUDENT_CARD', isMandatory: true },
      { docType: 'BIRTH_CERTIFICATE', isMandatory: false },
    ]);
    expect(slots.map((s) => s.rules.map((r) => r.docType))).toEqual([
      ['CITIZEN_ID'],
      ['STUDENT_CARD'],
      ['BIRTH_CERTIFICATE'],
    ]);
    expect(new Set(slots.map((s) => s.key)).size).toBe(3);
  });

  it('giấy không bắt buộc không gộp và đứng sau ô bắt buộc', () => {
    const slots = buildDocSlots([
      { docType: 'OPTIONAL_A', isMandatory: false, alternativeGroup: 'X' },
      { docType: 'BIRTH_CERTIFICATE', isMandatory: true, alternativeGroup: 'IDENTITY_PROOF' },
      { docType: 'CITIZEN_ID', isMandatory: true, alternativeGroup: 'identity_proof' },
    ]);
    expect(slots).toHaveLength(2);
    expect(slots[0].rules.map((r) => r.docType)).toEqual(['BIRTH_CERTIFICATE', 'CITIZEN_ID']);
    expect(slots[1].isMandatory).toBe(false);
  });
});

describe('expandChecklistToRules', () => {
  const groupRules = [
    { targetGroup: 'PARENT_RETIRED', docType: 'CITIZEN_ID', isMandatory: true, alternativeGroup: null },
    { targetGroup: 'PARENT_RETIRED', docType: 'RELATIONSHIP_CERTIFICATE', isMandatory: true, alternativeGroup: 'RELATION_PROOF' },
    { targetGroup: 'PARENT_RETIRED', docType: 'BIRTH_CERTIFICATE', isMandatory: true, alternativeGroup: 'RELATION_PROOF' },
  ];
  const fallback = (docType: string) => ({ docType, isMandatory: true, alternativeGroup: null, targetGroup: '' });

  it('mã đầu của nhóm "chọn 1" kéo theo các giấy thay thế', () => {
    expect(
      expandChecklistToRules(['RELATIONSHIP_CERTIFICATE'], groupRules, fallback).map((r) => r.docType)
    ).toEqual(['RELATIONSHIP_CERTIFICATE', 'BIRTH_CERTIFICATE']);
  });

  it('bỏ RULES_NOT_CONFIGURED và tạo rule tạm cho mã lạ', () => {
    expect(expandChecklistToRules(['RULES_NOT_CONFIGURED'], groupRules, fallback)).toEqual([]);
    expect(expandChecklistToRules(['STUDENT_CARD'], groupRules, fallback)).toEqual([fallback('STUDENT_CARD')]);
  });
});
