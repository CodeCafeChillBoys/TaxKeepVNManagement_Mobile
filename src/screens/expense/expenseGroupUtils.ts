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
 * Nhãn hiển thị thân thiện theo trạng thái chứng từ (không dùng thuật ngữ IT)
 */
export function getStatusLabel(status: string): string {
  switch (status) {
    case 'CONFIRMED':    return '✓ Đã duyệt';
    case 'EXTRACTED':   return '⚡ Chờ soát xét';
    case 'UPLOADED':    return '⏳ Đang xử lý';
    case 'FAILED':      return '⚠ Cần kiểm tra lại';
    case 'REJECTED':    return '✕ Bị từ chối';
    default:            return status;
  }
}

/**
 * Màu badge tương ứng với trạng thái (không dùng thuật ngữ IT)
 */
export function getStatusBadgeVariant(status: string): BadgeVariant {
  switch (status) {
    case 'CONFIRMED':  return 'success';
    case 'EXTRACTED':  return 'warning';
    case 'UPLOADED':   return 'outline';
    case 'FAILED':     return 'destructive';
    default:           return 'secondary';
  }
}

/**
 * Tìm kiếm chứng từ theo từ khóa (tên đơn vị, số hóa đơn, mã chứng từ)
 */
export function searchExpenses(expenses: ExpenseOcrResult[], keyword: string): ExpenseOcrResult[] {
  const q = keyword.trim().toLowerCase();
  if (!q) return expenses;
  return expenses.filter((doc) => {
    const sellerMatch = (doc.sellerName || '').toLowerCase().includes(q);
    const invoiceMatch = (doc.invoiceNumber || '').toLowerCase().includes(q);
    const docTypeMatch = (doc.docTypeName || '').toLowerCase().includes(q);
    const codeMatch = (doc.docTypeCode || '').toLowerCase().includes(q);
    return sellerMatch || invoiceMatch || docTypeMatch || codeMatch;
  });
}

/**
 * Trích xuất tháng (1-12) của hóa đơn dựa trên invoiceDate hoặc createdAt
 */
export function getExpenseMonth(doc: ExpenseOcrResult): number | null {
  const dateStr = doc.invoiceDate || doc.createdAt;
  if (!dateStr || typeof dateStr !== 'string') return null;

  const trimmed = dateStr.trim();
  // Check DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    const month = parseInt(dmyMatch[2], 10);
    if (month >= 1 && month <= 12) return month;
  }

  // Check YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymdMatch) {
    const month = parseInt(ymdMatch[2], 10);
    if (month >= 1 && month <= 12) return month;
  }

  // Fallback to Date.parse
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed.getMonth() + 1;
  }

  return null;
}

/**
 * Lọc chứng từ theo tháng (1-12 hoặc 'ALL')
 */
export function filterExpensesByMonth(
  expenses: ExpenseOcrResult[],
  month: number | 'ALL'
): ExpenseOcrResult[] {
  if (month === 'ALL') return expenses;
  return expenses.filter((doc) => getExpenseMonth(doc) === month);
}

/**
 * Lọc chứng từ theo danh mục cấu hình từ DB (Admin)
 */
export function filterExpensesByCategory(
  expenses: ExpenseOcrResult[],
  categoryCode: string
): ExpenseOcrResult[] {
  if (!categoryCode || categoryCode === 'ALL') return expenses;
  const target = categoryCode.trim().toLowerCase();
  return expenses.filter((doc) => {
    const code = (doc.docTypeCode || '').trim().toLowerCase();
    const name = (doc.docTypeName || '').trim().toLowerCase();
    if (code === target) return true;
    if (name === target) return true;
    if (getGroupKeyFromDocTypeCode(doc.docTypeCode).toLowerCase() === target) return true;
    return false;
  });
}

/**
 * Lọc chứng từ theo trạng thái
 */
export function filterExpensesByStatus(
  expenses: ExpenseOcrResult[],
  statusFilter: 'ALL' | 'CONFIRMED' | 'EXTRACTED' | 'UPLOADED' | 'FAILED'
): ExpenseOcrResult[] {
  if (statusFilter === 'ALL') return expenses;
  return expenses.filter((doc) => doc.status === statusFilter);
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
    combined.includes('SHOPPING') ||
    combined.includes('MUA_SAM')
  ) {
    return 'bag-handle-outline';
  }

  if (
    combined.includes('GROCERY') ||
    combined.includes('TIEU_DUNG')
  ) {
    return 'basket-outline';
  }

  if (
    combined.includes('FOOD') ||
    combined.includes('AN_UONG') ||
    combined.includes('THUC_PHAM')
  ) {
    return 'restaurant-outline';
  }

  if (
    combined.includes('ACCOMMODATION') ||
    combined.includes('LUU_TRU') ||
    combined.includes('KHACH_SAN')
  ) {
    return 'bed-outline';
  }

  if (
    combined.includes('ENTERTAINMENT') ||
    combined.includes('GIAI_TRI')
  ) {
    return 'film-outline';
  }

  if (
    combined.includes('PERSONAL_SERVICE') ||
    combined.includes('DICH_VU_CA_NHAN') ||
    combined.includes('SPA') ||
    combined.includes('LAM_DEP')
  ) {
    return 'cut-outline';
  }

  if (
    combined.includes('TRANSPORTATION') ||
    combined.includes('DI_LAI') ||
    combined.includes('TAXI')
  ) {
    return 'car-outline';
  }

  if (
    combined.includes('TRAVEL') ||
    combined.includes('DU_LICH')
  ) {
    return 'airplane-outline';
  }

  if (
    combined.includes('UTILITY') ||
    combined.includes('DIEN_NUOC') ||
    combined.includes('VIEN_THONG')
  ) {
    return 'flash-outline';
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
        name: 'Viện phí & Chăm sóc sức khỏe',
        shortName: 'Sức khỏe',
        description: 'Hóa đơn khám chữa bệnh, viện phí và thuốc men',
        icon: 'medkit',
        color: '#0F766E',
        badgeVariant: 'teal' as BadgeVariant,
      };
    case 'TO_GIAO_DUC':
      return {
        order: 2,
        name: 'Học phí & Giáo dục',
        shortName: 'Học phí',
        description: 'Biên lai học phí các cấp đào tạo hợp pháp',
        icon: 'school',
        color: '#0284C7',
        badgeVariant: 'info' as BadgeVariant,
      };
    case 'TO_TU_THIEN':
      return {
        order: 3,
        name: 'Đóng góp Từ thiện & Nhân đạo',
        shortName: 'Từ thiện',
        description: 'Chứng từ ủng hộ quỹ từ thiện và khuyến học',
        icon: 'heart',
        color: '#E11D48',
        badgeVariant: 'destructive' as BadgeVariant,
      };
    case 'TO_BAO_HIEM':
      return {
        order: 4,
        name: 'Bảo hiểm & Hưu trí Tự nguyện',
        shortName: 'Bảo hiểm',
        description: 'Phí bảo hiểm nhân thọ và quỹ hưu trí tự nguyện',
        icon: 'shield-checkmark',
        color: '#4338CA',
        badgeVariant: 'indigo' as BadgeVariant,
      };
    case 'TO_KHAC':
    default:
      return {
        order: 5,
        name: 'Chứng từ hợp lệ khác',
        shortName: 'Khác',
        description: 'Hóa đơn và chứng từ khấu trừ thuế hợp lệ khác',
        icon: 'receipt',
        color: '#D97706',
        badgeVariant: 'warning' as BadgeVariant,
      };
  }
}

/**
 * Nhóm danh sách chứng từ theo từng Tổ phân loại
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
  let processingCount = 0;
  let failedCount = 0;

  for (const doc of expenses) {
    const amount = Number(doc.totalAmount) || 0;
    totalAmount += amount;

    if (doc.status === 'CONFIRMED') {
      totalConfirmedAmount += amount;
      confirmedCount += 1;
    } else if (doc.status === 'UPLOADED') {
      processingCount += 1;
    } else if (doc.status === 'FAILED') {
      failedCount += 1;
    } else {
      pendingCount += 1;
    }
  }

  return {
    totalDocs: expenses.length,
    confirmedDocs: confirmedCount,
    pendingDocs: pendingCount,
    processingDocs: processingCount,
    failedDocs: failedCount,
    totalAmount,
    totalConfirmedAmount,
  };
}
