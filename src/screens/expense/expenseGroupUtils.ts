import { ExpenseOcrResult } from '../../types/expense';
import { BadgeVariant } from '../../components/ui/Badge';

export type ExpenseGroupKey =
  | 'TO_VIEN_PHI'
  | 'TO_GIAO_DUC'
  | 'TO_TU_THIEN'
  | 'TO_BAO_HIEM'
  | 'TO_KHAC';

export interface ExpenseGroup {
  key: ExpenseGroupKey;
  order: number;
  name: string;
  shortName: string;
  description: string;
  icon: string;
  color: string;
  badgeVariant: BadgeVariant;
  items: ExpenseOcrResult[];
  totalAmount: number;
  confirmedAmount: number;
  totalCount: number;
  confirmedCount: number;
}

/**
 * Lấy biểu tượng Ionicons phù hợp cho loại chứng từ dựa trên code và name
 */
export function getDocumentTypeIcon(code?: string | null, name?: string | null): string {
  const combined = `${code || ''} ${name || ''}`.toUpperCase();

  if (
    combined.includes('MEDIC') ||
    combined.includes('VIEN_PHI') ||
    combined.includes('Y_TE') ||
    combined.includes('KHAM') ||
    combined.includes('BENH') ||
    combined.includes('THUOC') ||
    combined.includes('DUOC')
  ) {
    return 'medkit';
  }

  if (
    combined.includes('EDU') ||
    combined.includes('TUITION') ||
    combined.includes('HOC_PHI') ||
    combined.includes('GIAO_DUC') ||
    combined.includes('TRUONG') ||
    combined.includes('DAO_TAO')
  ) {
    return 'school';
  }

  if (
    combined.includes('CHARITY') ||
    combined.includes('DONATION') ||
    combined.includes('TU_THIEN') ||
    combined.includes('NHAN_DAO') ||
    combined.includes('CUU_TRO') ||
    combined.includes('DONG_GOP')
  ) {
    return 'heart';
  }

  if (
    combined.includes('INSURANCE') ||
    combined.includes('BAO_HIEM') ||
    combined.includes('HUU_TRI')
  ) {
    return 'shield-checkmark';
  }

  if (
    combined.includes('VAT') ||
    combined.includes('SALES') ||
    combined.includes('BAN_HANG') ||
    combined.includes('GTGT') ||
    combined.includes('INVOICE') ||
    combined.includes('HOA_DON')
  ) {
    return 'receipt-outline';
  }

  return 'document-text-outline';
}

/**
 * Ánh xạ mã loại chứng từ do AI nhận diện hoặc do Admin cấu hình (docTypeCode) sang Tổ chứng từ tương ứng
 */
export function getGroupKeyFromDocTypeCode(docTypeCode?: string | null): ExpenseGroupKey {
  if (!docTypeCode) return 'TO_KHAC';

  const normalized = docTypeCode.trim().toUpperCase();

  if (
    normalized === 'MEDICAL_EXPENSE_INVOICE' ||
    normalized.includes('MEDICAL') ||
    normalized.includes('VIEN_PHI') ||
    normalized.includes('Y_TE') ||
    normalized.includes('KHAM') ||
    normalized.includes('BENH') ||
    normalized.includes('THUOC') ||
    normalized.includes('DUOC')
  ) {
    return 'TO_VIEN_PHI';
  }

  if (
    normalized === 'EDUCATION_EXPENSE_INVOICE' ||
    normalized === 'EDUCATION_FEE_INVOICE' ||
    normalized === 'TUITION_FEE_INVOICE' ||
    normalized.includes('TUITION') ||
    normalized.includes('EDUCATION') ||
    normalized.includes('HOC_PHI') ||
    normalized.includes('GIAO_DUC') ||
    normalized.includes('TRUONG') ||
    normalized.includes('DAO_TAO')
  ) {
    return 'TO_GIAO_DUC';
  }

  if (
    normalized === 'CHARITY_DONATION_RECEIPT' ||
    normalized === 'DONATION_VOUCHER' ||
    normalized.includes('CHARITY') ||
    normalized.includes('DONATION') ||
    normalized.includes('TU_THIEN') ||
    normalized.includes('NHAN_DAO') ||
    normalized.includes('CUU_TRO') ||
    normalized.includes('DONG_GOP')
  ) {
    return 'TO_TU_THIEN';
  }

  if (
    normalized === 'INSURANCE_PREMIUM_RECEIPT' ||
    normalized.includes('INSURANCE') ||
    normalized.includes('BAO_HIEM') ||
    normalized.includes('HUU_TRI')
  ) {
    return 'TO_BAO_HIEM';
  }

  return 'TO_KHAC';
}

/**
 * Lấy thông tin cấu hình hiển thị của từng Tổ chứng từ
 */
export function getGroupMetadata(key: ExpenseGroupKey) {
  switch (key) {
    case 'TO_VIEN_PHI':
      return {
        order: 1,
        name: 'Tổ 1: Viện phí & Chăm sóc Y tế',
        shortName: 'Viện phí & Y tế',
        description: 'Hóa đơn khám chữa bệnh, viện phí và thuốc men điều trị',
        icon: 'medkit',
        color: '#0F766E', // teal-700
        badgeVariant: 'teal' as BadgeVariant,
      };
    case 'TO_GIAO_DUC':
      return {
        order: 2,
        name: 'Tổ 2: Giáo dục & Học phí Chính quy',
        shortName: 'Giáo dục & Học phí',
        description: 'Biên lai, hóa đơn học phí các cấp đào tạo hợp pháp',
        icon: 'school',
        color: '#0284C7', // sky-600
        badgeVariant: 'info' as BadgeVariant,
      };
    case 'TO_TU_THIEN':
      return {
        order: 3,
        name: 'Tổ 3: Đóng góp Từ thiện & Nhân đạo',
        shortName: 'Từ thiện & Nhân đạo',
        description: 'Chứng từ ủng hộ các quỹ từ thiện, khắc phục thiên tai, khuyến học',
        icon: 'heart',
        color: '#E11D48', // rose-600
        badgeVariant: 'destructive' as BadgeVariant,
      };
    case 'TO_BAO_HIEM':
      return {
        order: 4,
        name: 'Tổ 4: Bảo hiểm Nhân thọ & Hưu trí Tự nguyện',
        shortName: 'Bảo hiểm & Hưu trí',
        description: 'Phí đóng bảo hiểm nhân thọ và quỹ hưu trí tự nguyện được giảm trừ',
        icon: 'shield-checkmark',
        color: '#4338CA', // indigo-700
        badgeVariant: 'indigo' as BadgeVariant,
      };
    case 'TO_KHAC':
    default:
      return {
        order: 5,
        name: 'Tổ 5: Hóa đơn & Chứng từ Hợp lệ Khác',
        shortName: 'Chứng từ khác',
        description: 'Hóa đơn bán hàng, hóa đơn GTGT và chứng từ khấu trừ thuế',
        icon: 'receipt',
        color: '#D97706', // amber-600
        badgeVariant: 'warning' as BadgeVariant,
      };
  }
}

/**
 * Nhóm danh sách chứng từ theo từng Tổ do AI phân loại
 * Trả về danh sách các nhóm Tổ, chỉ trả về các tổ có chứng từ hoặc có thể trả về tất cả
 */
export function groupExpensesByAiClassification(
  expenses: ExpenseOcrResult[],
  includeEmptyGroups: boolean = false
): ExpenseGroup[] {
  const groupsMap: Record<ExpenseGroupKey, ExpenseGroup> = {
    TO_VIEN_PHI: {
      key: 'TO_VIEN_PHI',
      ...getGroupMetadata('TO_VIEN_PHI'),
      items: [],
      totalAmount: 0,
      confirmedAmount: 0,
      totalCount: 0,
      confirmedCount: 0,
    },
    TO_GIAO_DUC: {
      key: 'TO_GIAO_DUC',
      ...getGroupMetadata('TO_GIAO_DUC'),
      items: [],
      totalAmount: 0,
      confirmedAmount: 0,
      totalCount: 0,
      confirmedCount: 0,
    },
    TO_TU_THIEN: {
      key: 'TO_TU_THIEN',
      ...getGroupMetadata('TO_TU_THIEN'),
      items: [],
      totalAmount: 0,
      confirmedAmount: 0,
      totalCount: 0,
      confirmedCount: 0,
    },
    TO_BAO_HIEM: {
      key: 'TO_BAO_HIEM',
      ...getGroupMetadata('TO_BAO_HIEM'),
      items: [],
      totalAmount: 0,
      confirmedAmount: 0,
      totalCount: 0,
      confirmedCount: 0,
    },
    TO_KHAC: {
      key: 'TO_KHAC',
      ...getGroupMetadata('TO_KHAC'),
      items: [],
      totalAmount: 0,
      confirmedAmount: 0,
      totalCount: 0,
      confirmedCount: 0,
    },
  };

  for (const doc of expenses) {
    const groupKey = getGroupKeyFromDocTypeCode(doc.docTypeCode);
    const group = groupsMap[groupKey];
    group.items.push(doc);
    const amount = Number(doc.totalAmount) || 0;
    group.totalAmount += amount;
    group.totalCount += 1;

    if (doc.status === 'CONFIRMED') {
      group.confirmedAmount += amount;
      group.confirmedCount += 1;
    }
  }

  const allGroups = [
    groupsMap.TO_VIEN_PHI,
    groupsMap.TO_GIAO_DUC,
    groupsMap.TO_TU_THIEN,
    groupsMap.TO_BAO_HIEM,
    groupsMap.TO_KHAC,
  ];

  if (includeEmptyGroups) {
    return allGroups;
  }

  return allGroups.filter((g) => g.items.length > 0);
}

/**
 * Tính toán các chỉ số KPI tổng thể cho kỳ kê khai thuế
 */
export function calculateExpenseMetrics(expenses: ExpenseOcrResult[]) {
  let totalConfirmedAmount = 0;
  let totalAmount = 0;
  let confirmedCount = 0;
  let pendingCount = 0;

  for (const doc of expenses) {
    const amount = Number(doc.totalAmount) || 0;
    totalAmount += amount;

    if (doc.status === 'CONFIRMED') {
      totalConfirmedAmount += amount;
      confirmedCount += 1;
    } else {
      pendingCount += 1;
    }
  }

  return {
    totalDocs: expenses.length,
    confirmedDocs: confirmedCount,
    pendingDocs: pendingCount,
    totalAmount,
    totalConfirmedAmount,
  };
}
