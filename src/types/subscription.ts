/** GET /api/v1/subscription/plans — khớp SubscriptionPlanResponse (BE). -1 = không giới hạn */
export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  priceMonthly: number;
  priceYearly: number;
  maxAiQuestionsPerMonth: number;
  chatHistoryRetentionDays: number;
  maxOcrScansPerMonth: number;
  canExportPdf: boolean;
  canExportZip: boolean;
  bookingDiscountPercent: number;
  freeConsultationsPerYear: number;
  displayOrder: number;
  isActive: boolean;
}

/** GET /api/v1/subscription/my và /history (UserSubscriptionResponse) — chỉ lấy các trường app dùng */
export interface UserSubscription {
  id: string;
  planId: string;
  planName: string;
  planSlug: string;
  billingCycle: string; // free | monthly | yearly
  status: string; // active | pending | cancelled | expired
  amountPaid?: number;
  paymentMethod?: string; // FREE | WALLET | VNPAY | VIETQR
  startsAt?: string;
  expiresAt?: string | null;
  remainingDays?: number | null;
}

/** GET /api/v1/subscription/quota — hạn mức gói hiện tại; -1 = không giới hạn */
export interface SubscriptionQuotaStatus {
  planName: string;
  planSlug: string;
  billingCycle: string; // free | monthly | yearly
  expiresAt?: string | null;
  remainingDays?: number | null;
  aiQuestionsUsed: number;
  maxAiQuestionsPerMonth: number;
  ocrScansUsed: number;
  maxOcrScansPerMonth: number;
  canExportPdf: boolean;
  canExportZip: boolean;
  bookingDiscountPercent: number;
  freeConsultationsPerYear: number;
}

export type BillingCycle = 'monthly' | 'yearly';

export type PaymentMethod = 'WALLET' | 'VNPAY' | 'VIETQR';

/** POST /api/v1/subscription/purchase */
export interface PurchaseSubscriptionRequest {
  planId: string;
  billingCycle: BillingCycle;
  paymentMethod: PaymentMethod;
  /** Trang VNPay chuyển về sau khi thanh toán; bỏ trống thì BE dùng URL cấu hình sẵn */
  returnUrl?: string;
}

/** Đường dẫn trong app nhận kết quả VNPay của đơn mua gói (khai báo trong linking) */
export const SUBSCRIPTION_RETURN_PATH = 'subscription/vnpay-return';

/** Tách query string ("?a=1&b=x+y") thành object, dùng cho tham số VNPay trả về */
export function parseQuery(search: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of search.replace(/^\?/, '').split('&')) {
    if (!part) continue;
    const [k, v = ''] = part.split('=');
    try {
      result[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
    } catch {
      result[k] = v;
    }
  }
  return result;
}

export interface SubscriptionPurchaseResult {
  subscriptionId?: string | null;
  orderCode: number;
  amount: number;
  paymentMethod: string; // FREE | WALLET | VNPAY | VIETQR
  isCompleted: boolean;
  checkoutUrl?: string | null;
  qrCode?: string | null;
  message: string;
}

export const UNLIMITED = -1;

export function formatPlanVnd(amount: number): string {
  return `${Math.round(amount).toLocaleString('vi-VN')}đ`;
}

export function formatLimit(value: number, unit = ''): string {
  if (value === UNLIMITED) return 'Không giới hạn';
  return unit ? `${value} ${unit}` : String(value);
}

/** Số tháng được tặng khi mua năm, tính từ giá admin cấu hình (mặc định 12 - 10 = 2) */
export function freeMonthsOfYearly(plan: Pick<SubscriptionPlan, 'priceMonthly' | 'priceYearly'>): number {
  if (plan.priceMonthly <= 0 || plan.priceYearly <= 0) return 0;
  return Math.max(0, Math.round(12 - plan.priceYearly / plan.priceMonthly));
}

export function planPrice(plan: SubscriptionPlan, cycle: BillingCycle): { amount: string; suffix: string } {
  const value = cycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;
  if (value <= 0) return { amount: 'Miễn phí', suffix: '' };
  return { amount: formatPlanVnd(value), suffix: cycle === 'yearly' ? '/năm' : '/tháng' };
}

export interface PlanBenefit {
  label: string;
  value: string;
  included: boolean;
}

export function planBenefits(plan: SubscriptionPlan): PlanBenefit[] {
  const booking: string[] = [];
  if (plan.bookingDiscountPercent > 0) booking.push(`Giảm ${plan.bookingDiscountPercent}% chi phí`);
  if (plan.freeConsultationsPerYear > 0) booking.push(`Miễn phí ${plan.freeConsultationsPerYear} buổi/năm`);

  return [
    { label: 'Trợ lý thuế', value: formatLimit(plan.maxAiQuestionsPerMonth, 'câu/tháng'), included: true },
    {
      label: 'Lưu lịch sử trao đổi',
      value: plan.chatHistoryRetentionDays === UNLIMITED ? 'Dài lâu' : `${plan.chatHistoryRetentionDays} ngày`,
      included: true,
    },
    { label: 'Quét hóa đơn, chứng từ', value: formatLimit(plan.maxOcrScansPerMonth, 'lượt/tháng'), included: true },
    { label: 'Đối soát dữ liệu & luật thuế', value: 'Có', included: true },
    { label: 'Tải tờ khai thuế (Mẫu 02/QTT-TNCN)', value: plan.canExportPdf ? 'Được tải về' : 'Chỉ xem trước', included: plan.canExportPdf },
    { label: 'Tải trọn bộ hồ sơ chứng từ', value: plan.canExportZip ? 'Được tải về' : 'Chưa hỗ trợ', included: plan.canExportZip },
    {
      label: 'Tư vấn cùng chuyên gia thuế',
      value: booking.length ? booking.join(' · ') : 'Theo giá chuẩn',
      included: booking.length > 0,
    },
  ];
}

/** Ngày hết hạn dự kiến nếu kích hoạt ngay — khớp BE: now.AddMonths(1) / AddYears(1) */
export function expectedExpiry(cycle: BillingCycle, from: Date = new Date()): Date {
  const d = new Date(from);
  const day = d.getDate();
  d.setDate(1);
  if (cycle === 'yearly') d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  // Như .NET: 31/01 + 1 tháng = 28/02, không tràn sang tháng 3
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
}

export function formatDateVi(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export type PurchaseOutcome = 'active' | 'pending' | 'failed' | 'unknown';

/** Trạng thái đơn mua gói, tra trong GET /history theo subscriptionId */
export function purchaseOutcome(history: UserSubscription[], subscriptionId: string): PurchaseOutcome {
  const sub = history.find((h) => h.id === subscriptionId);
  if (!sub) return 'unknown';
  const status = sub.status.toLowerCase();
  if (status === 'active') return 'active';
  if (status === 'pending') return 'pending';
  if (status === 'cancelled' || status === 'expired') return 'failed';
  return 'unknown';
}

/** Tỉ lệ đã dùng 0..1 cho thanh hạn mức; null khi không giới hạn */
export function usageRatio(used: number, max: number): number | null {
  if (max === UNLIMITED) return null;
  if (max <= 0) return 1;
  return Math.min(1, Math.max(0, used / max));
}

/** Tên gói trong câu: admin đặt tên "Gói Standard" hay "Standard" đều ra "gói Standard", không lặp chữ "gói" */
export function planNoun(name: string, capitalize = false): string {
  const noun = `gói ${name.replace(/^gói\s+/i, '').trim()}`;
  return capitalize ? `G${noun.slice(1)}` : noun;
}

/** Chuyển tên gói sang tiếng Việt thân thiện, không để từ tiếng Anh */
export function friendlyPlanName(name?: string | null): string {
  if (!name) return 'Gói dịch vụ';
  const clean = name.trim();
  const lower = clean.toLowerCase();
  if (lower === 'basic' || lower === 'gói basic') return 'Gói Cơ bản';
  if (lower === 'standard' || lower === 'gói standard') return 'Gói Tiêu chuẩn';
  if (lower === 'pro' || lower === 'gói pro' || lower === 'professional') return 'Gói Chuyên nghiệp';
  if (lower === 'premium' || lower === 'gói premium') return 'Gói Cao cấp';
  if (lower === 'free' || lower === 'gói free') return 'Gói Miễn phí';
  if (lower === 'enterprise' || lower === 'gói enterprise') return 'Gói Doanh nghiệp';

  const withoutPrefix = clean.replace(/^gói\s+/i, '');
  const lowerWithout = withoutPrefix.toLowerCase();
  if (lowerWithout === 'basic') return 'Gói Cơ bản';
  if (lowerWithout === 'standard') return 'Gói Tiêu chuẩn';
  if (lowerWithout === 'pro' || lowerWithout === 'professional') return 'Gói Chuyên nghiệp';
  if (lowerWithout === 'premium') return 'Gói Cao cấp';
  if (lowerWithout === 'free') return 'Gói Miễn phí';
  if (lowerWithout === 'enterprise') return 'Gói Doanh nghiệp';

  return clean.startsWith('Gói ') || clean.startsWith('gói ')
    ? `Gói ${withoutPrefix}`
    : `Gói ${clean}`;
}

/** Tên gói tiếng Việt dùng trong câu (vd: "gói Cơ bản", "gói Cao cấp") */
export function friendlyPlanNoun(name?: string | null, capitalize = false): string {
  const friendly = friendlyPlanName(name);
  const noun = `gói ${friendly.replace(/^gói\s+/i, '').trim()}`;
  return capitalize ? `G${noun.slice(1)}` : noun;
}

export type HistoryTone = 'active' | 'pending' | 'failed' | 'ended';

/** Nhãn trạng thái một dòng lịch sử gói */
export function historyStatus(sub: UserSubscription): { label: string; tone: HistoryTone } {
  const status = sub.status.toLowerCase();
  if (status === 'active') return { label: 'Đang dùng', tone: 'active' };
  if (status === 'pending') return { label: 'Chờ thanh toán', tone: 'pending' };
  if (status === 'expired') return { label: 'Đã hết hạn', tone: 'ended' };
  // shortcut: BE chưa trả paymentStatus; đơn cổng thanh toán chưa từng có ngày hết hạn = thanh toán không thành công.
  // Khi BE trả paymentStatus thì đọc thẳng trường đó.
  const method = (sub.paymentMethod ?? '').toUpperCase();
  if (!sub.expiresAt && (method === 'VNPAY' || method === 'VIETQR')) {
    return { label: 'Thanh toán thất bại', tone: 'failed' };
  }
  return { label: 'Kết thúc trước hạn', tone: 'ended' };
}

export function paymentMethodLabel(method?: string): string {
  switch ((method ?? '').toUpperCase()) {
    case 'WALLET':
      return 'Ví TaxKeep';
    case 'VNPAY':
      return 'VNPay';
    case 'VIETQR':
      return 'VietQR';
    default:
      return 'Miễn phí';
  }
}
