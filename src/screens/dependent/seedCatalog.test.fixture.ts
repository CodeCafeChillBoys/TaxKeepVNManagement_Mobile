import type { CatalogGroup, DependentCatalog } from '../../api/dependentDocumentApi';

// Bản sao dữ liệu seed BE (TaxKeepDbContext HasData) — chỉ dùng cho test.
export const SEED_GROUPS: CatalogGroup[] = [
  { code: 'CHILD_UNDER_18', name: 'Con dưới 18 tuổi', relationshipCode: 'CHILD', minAge: null, maxAge: 18, requireDisabled: false, requireStudying: false, level: 0, displayOrder: 1 },
  { code: 'CHILD_OVER_18_DISABLED', name: 'Con từ 18 tuổi trở lên bị khuyết tật', relationshipCode: 'CHILD', minAge: 18, maxAge: null, requireDisabled: true, requireStudying: false, level: 1, displayOrder: 2 },
  { code: 'CHILD_OVER_18_STUDYING', name: 'Con từ 18 tuổi trở lên đang đi học', relationshipCode: 'CHILD', minAge: 18, maxAge: null, requireDisabled: false, requireStudying: true, level: 1, displayOrder: 3 },
  { code: 'SPOUSE_DISABLED', name: 'Vợ/Chồng khuyết tật', relationshipCode: 'SPOUSE', minAge: null, maxAge: null, requireDisabled: true, requireStudying: false, level: 0, displayOrder: 4 },
  { code: 'SPOUSE_RETIRED', name: 'Vợ/Chồng ngoài độ tuổi lao động', relationshipCode: 'SPOUSE', minAge: null, maxAge: null, requireDisabled: false, requireStudying: false, level: 1, displayOrder: 5 },
  { code: 'PARENT_DISABLED', name: 'Cha/Mẹ khuyết tật', relationshipCode: 'PARENT', minAge: null, maxAge: null, requireDisabled: true, requireStudying: false, level: 0, displayOrder: 6 },
  { code: 'PARENT_RETIRED', name: 'Cha/Mẹ ngoài độ tuổi lao động', relationshipCode: 'PARENT', minAge: null, maxAge: null, requireDisabled: false, requireStudying: false, level: 1, displayOrder: 7 },
  { code: 'OTHER_HELPLESS', name: 'Cá nhân không nơi nương tựa khác', relationshipCode: 'OTHER_DEPENDENT', minAge: null, maxAge: null, requireDisabled: false, requireStudying: false, level: 0, displayOrder: 8 },
];

export const SEED_CATALOG: DependentCatalog = {
  relationships: [
    { code: 'CHILD', name: 'Con', displayOrder: 1 },
    { code: 'SPOUSE', name: 'Vợ/chồng', displayOrder: 2 },
    { code: 'PARENT', name: 'Cha/mẹ', displayOrder: 3 },
    { code: 'OTHER_DEPENDENT', name: 'Cá nhân khác không nơi nương tựa', displayOrder: 4 },
  ],
  groups: SEED_GROUPS,
};
