import {
  expectedExpiry,
  formatDateVi,
  formatLimit,
  historyStatus,
  freeMonthsOfYearly,
  planBenefits,
  planPrice,
  parseQuery,
  planNoun,
  purchaseOutcome,
  usageRatio,
  SubscriptionPlan,
  UserSubscription,
} from './subscription';

const premium: SubscriptionPlan = {
  id: 'p3',
  name: 'Premium',
  slug: 'premium',
  priceMonthly: 99000,
  priceYearly: 990000,
  maxAiQuestionsPerMonth: -1,
  chatHistoryRetentionDays: -1,
  maxOcrScansPerMonth: 100,
  maxIncomeSources: -1,
  maxDependents: -1,
  canExportPdf: true,
  canExportZip: true,
  bookingDiscountPercent: 10,
  freeConsultationsPerYear: 1,
  displayOrder: 3,
  isActive: true,
};

const basic: SubscriptionPlan = {
  ...premium,
  id: 'p1',
  name: 'Basic',
  slug: 'basic',
  priceMonthly: 0,
  priceYearly: 0,
  maxAiQuestionsPerMonth: 20,
  chatHistoryRetentionDays: 30,
  maxOcrScansPerMonth: 5,
  maxIncomeSources: 1,
  maxDependents: 3,
  canExportPdf: false,
  canExportZip: false,
  bookingDiscountPercent: 0,
  freeConsultationsPerYear: 0,
};

describe('subscription formatters', () => {
  it('shows -1 as unlimited', () => {
    expect(formatLimit(-1, 'câu/tháng')).toBe('Không giới hạn');
    expect(formatLimit(20, 'câu/tháng')).toBe('20 câu/tháng');
  });

  it('yearly price of 10 months gives 2 free months', () => {
    expect(freeMonthsOfYearly({ priceMonthly: 49000, priceYearly: 490000 })).toBe(2);
    expect(freeMonthsOfYearly({ priceMonthly: 0, priceYearly: 0 })).toBe(0);
  });

  it('free plan shows "Miễn phí" without suffix', () => {
    expect(planPrice(basic, 'monthly')).toEqual({ amount: 'Miễn phí', suffix: '' });
    expect(planPrice(premium, 'yearly').suffix).toBe('/năm');
  });

  it('maps plan fields to benefit rows', () => {
    const b = Object.fromEntries(planBenefits(basic).map((x) => [x.label, x.value]));
    expect(b['Lưu lịch sử chat AI']).toBe('30 ngày');
    expect(b['Xuất PDF Mẫu 02/QTT-TNCN']).toBe('Chỉ xem');
    expect(b['Đặt lịch chuyên gia']).toBe('Giá gốc');

    const p = Object.fromEntries(planBenefits(premium).map((x) => [x.label, x.value]));
    expect(p['Lưu lịch sử chat AI']).toBe('Vĩnh viễn');
    expect(p['Đặt lịch chuyên gia']).toBe('Giảm 10% · 1 ca/năm miễn phí');
  });
});

describe('subscription checkout helpers', () => {
  it('computes expected expiry like BE AddMonths / AddYears', () => {
    const from = new Date(2026, 10, 4);
    expect(formatDateVi(expectedExpiry('monthly', from))).toBe('04/12/2026');
    expect(formatDateVi(expectedExpiry('yearly', from))).toBe('04/11/2027');
    expect(formatDateVi(expectedExpiry('monthly', new Date(2027, 0, 31)))).toBe('28/02/2027');
  });

  it('resolves purchase outcome from history', () => {
    const row = (id: string, status: string): UserSubscription => ({
      id,
      planId: 'p3',
      planName: 'Premium',
      planSlug: 'premium',
      billingCycle: 'monthly',
      status,
    });
    const history = [row('a', 'active'), row('b', 'pending'), row('c', 'cancelled')];
    expect(purchaseOutcome(history, 'a')).toBe('active');
    expect(purchaseOutcome(history, 'b')).toBe('pending');
    expect(purchaseOutcome(history, 'c')).toBe('failed');
    expect(purchaseOutcome(history, 'zzz')).toBe('unknown');
  });
});

describe('parseQuery', () => {
  it('decodes VNPay return params', () => {
    expect(parseQuery('?vnp_ResponseCode=00&vnp_OrderInfo=SUB123+goi&x=')).toEqual({
      vnp_ResponseCode: '00',
      vnp_OrderInfo: 'SUB123 goi',
      x: '',
    });
    expect(parseQuery('')).toEqual({});
  });
});

describe('usageRatio', () => {
  it('returns null for unlimited and clamps to 0..1', () => {
    expect(usageRatio(5, -1)).toBeNull();
    expect(usageRatio(5, 20)).toBe(0.25);
    expect(usageRatio(25, 20)).toBe(1);
    expect(usageRatio(0, 0)).toBe(1);
  });
});

describe('planNoun', () => {
  it('does not repeat the word "gói"', () => {
    expect(planNoun('Gói Standard')).toBe('gói Standard');
    expect(planNoun('Premium')).toBe('gói Premium');
    expect(planNoun('gói Basic', true)).toBe('Gói Basic');
  });
});

describe('historyStatus', () => {
  const base = { id: 'x', planId: 'p', planName: 'Gói Standard', planSlug: 'standard', billingCycle: 'monthly' };
  it('labels each BE status', () => {
    expect(historyStatus({ ...base, status: 'active' }).label).toBe('Đang dùng');
    expect(historyStatus({ ...base, status: 'pending' }).tone).toBe('pending');
    expect(historyStatus({ ...base, status: 'expired' }).label).toBe('Đã hết hạn');
  });

  it('tells failed gateway payment apart from a plan replaced early', () => {
    expect(historyStatus({ ...base, status: 'cancelled', paymentMethod: 'VNPAY', expiresAt: null }).tone).toBe('failed');
    expect(
      historyStatus({ ...base, status: 'cancelled', paymentMethod: 'VNPAY', expiresAt: '2026-12-04T00:00:00Z' }).tone
    ).toBe('ended');
    expect(historyStatus({ ...base, status: 'cancelled', paymentMethod: 'FREE' }).tone).toBe('ended');
  });
});
