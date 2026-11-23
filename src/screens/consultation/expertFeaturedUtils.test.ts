import type { ExpertListItemResponse } from '../../types/consultation';
import {
  DEFAULT_SORT_OPTIONS,
  buildFeaturedListSignature,
  formatExpertRatingDisplay,
  getFeaturedBannerSubtitle,
  isSelfExpertProfile,
  normalizeExpertSortBy,
  reconcileUserSelectedSort,
  resolveAdminSortConfig,
  selectDisplayedFeaturedExperts,
} from './expertFeaturedUtils';

const makeExpert = (
  overrides: Partial<ExpertListItemResponse>
): ExpertListItemResponse => ({
  id: 'exp-1',
  userId: 'user-1',
  fullName: 'Võ Văn Cường',
  avatarUrl: null,
  jobTitle: 'Luật sư Thuế',
  companyName: 'Công ty VCC',
  bio: null,
  yearsOfExperience: 10,
  rating: 4.8,
  totalReviews: 12,
  completedConsultationsCount: 20,
  startingFee: 300000,
  specializationNames: ['Quyết toán thuế TNCN'],
  verifiedCertificateCount: 1,
  hasAvailableSlotSoon: true,
  earliestAvailableDate: '2026-11-25',
  rankingScore: 45.5,
  ...overrides,
});

describe('expertFeaturedUtils', () => {
  describe('normalizeExpertSortBy', () => {
    it('normalizes BE string enum names and numeric codes', () => {
      expect(normalizeExpertSortBy('Recommended')).toBe('Recommended');
      expect(normalizeExpertSortBy('feeasc')).toBe('FeeAsc');
      expect(normalizeExpertSortBy('CompletedSessionsDesc')).toBe('CompletedSessionsDesc');
      expect(normalizeExpertSortBy('SessionsDesc')).toBe('CompletedSessionsDesc');
      expect(normalizeExpertSortBy(0)).toBe('Recommended');
      expect(normalizeExpertSortBy(1)).toBe('RatingDesc');
      expect(normalizeExpertSortBy(2)).toBe('FeeAsc');
      expect(normalizeExpertSortBy(3)).toBe('FeeDesc');
      expect(normalizeExpertSortBy(4)).toBe('ExperienceDesc');
      expect(normalizeExpertSortBy(5)).toBe('CompletedSessionsDesc');
      expect(normalizeExpertSortBy('2')).toBe('FeeAsc');
      expect(normalizeExpertSortBy('Unknown')).toBeNull();
      expect(normalizeExpertSortBy(null)).toBeNull();
    });
  });

  describe('resolveAdminSortConfig', () => {
    it('applies admin defaultSortBy and allowed options from BE', () => {
      const resolved = resolveAdminSortConfig({
        defaultSortBy: 'FeeAsc',
        options: [
          { value: 'FeeAsc', code: 2, label: 'Mức phí thấp nhất', isDefault: true },
          { value: 'RatingDesc', code: 1, label: 'Đánh giá sao cao nhất', isDefault: false },
        ],
      });

      expect(resolved.defaultSortBy).toBe('FeeAsc');
      expect(resolved.defaultSortLabel).toBe('Mức phí thấp nhất');
      expect(resolved.options).toEqual([
        { key: 'FeeAsc', label: 'Mức phí thấp nhất' },
        { key: 'RatingDesc', label: 'Đánh giá sao cao nhất' },
      ]);
    });

    it('still updates defaultSortBy even when BE returns empty options array', () => {
      const resolved = resolveAdminSortConfig({
        defaultSortBy: 'ExperienceDesc',
        options: [],
      });

      expect(resolved.defaultSortBy).toBe('ExperienceDesc');
      expect(resolved.defaultSortLabel).toBe('Nhiều năm kinh nghiệm nhất');
      expect(resolved.options).toEqual(DEFAULT_SORT_OPTIONS);
    });

    it('falls back to isDefault flag when defaultSortBy field is missing', () => {
      const resolved = resolveAdminSortConfig({
        defaultSortBy: '',
        options: [
          { value: 'Recommended', code: 0, label: 'Đề xuất ưu tiên', isDefault: false },
          { value: 'CompletedSessionsDesc', code: 5, label: 'Nhiều ca tư vấn hoàn thành nhất', isDefault: true },
        ],
      });

      expect(resolved.defaultSortBy).toBe('CompletedSessionsDesc');
      expect(resolved.defaultSortLabel).toBe('Nhiều ca tư vấn hoàn thành nhất');
    });
  });

  describe('reconcileUserSelectedSort', () => {
    const allowed = [
      { key: 'Recommended' as const, label: 'Đề xuất ưu tiên' },
      { key: 'RatingDesc' as const, label: 'Đánh giá sao cao nhất' },
    ];

    it('returns null when user selection is removed from allowed options or equals new admin default', () => {
      expect(reconcileUserSelectedSort('FeeAsc', 'Recommended', allowed)).toBeNull();
      expect(reconcileUserSelectedSort('RatingDesc', 'RatingDesc', allowed)).toBeNull();
      expect(reconcileUserSelectedSort('RatingDesc', 'Recommended', allowed)).toBe('RatingDesc');
      expect(reconcileUserSelectedSort(null, 'RatingDesc', allowed)).toBeNull();
    });
  });

  describe('isSelfExpertProfile & selectDisplayedFeaturedExperts', () => {
    it('matches by userId or profileId and does not hide another expert with the same name', () => {
      const selfExp = makeExpert({ id: 'p-1', userId: 'u-me', fullName: 'Nguyễn Văn A' });
      const sameNameOtherExp = makeExpert({ id: 'p-2', userId: 'u-other', fullName: 'Nguyễn Văn A' });
      const currentUser = { id: 'u-me', fullName: 'Nguyễn Văn A' };

      expect(isSelfExpertProfile(selfExp, currentUser)).toBe(true);
      expect(isSelfExpertProfile(sameNameOtherExp, currentUser)).toBe(false);

      const displayed = selectDisplayedFeaturedExperts([selfExp, sameNameOtherExp], currentUser, 6);
      expect(displayed.map((e) => e.id)).toEqual(['p-2']);
    });

    it('preserves exact BE order and slices to maxCount after filtering self', () => {
      const items = Array.from({ length: 7 }, (_, i) =>
        makeExpert({ id: `p-${i + 1}`, userId: `u-${i + 1}`, fullName: `Expert ${i + 1}` })
      );
      const displayed = selectDisplayedFeaturedExperts(items, { id: 'u-2', fullName: 'Expert 2' }, 6);
      expect(displayed.map((e) => e.id)).toEqual(['p-1', 'p-3', 'p-4', 'p-5', 'p-6', 'p-7']);
    });
  });

  describe('buildFeaturedListSignature', () => {
    it('changes when expert ranking order changes even with the same expert IDs', () => {
      const a = makeExpert({ id: 'a', rankingScore: 50 });
      const b = makeExpert({ id: 'b', rankingScore: 40 });
      expect(buildFeaturedListSignature([a, b])).not.toBe(buildFeaturedListSignature([b, a]));
    });
  });

  describe('formatExpertRatingDisplay', () => {
    it('does not display fake 5.0 when expert has 0 rating / 0 reviews', () => {
      expect(formatExpertRatingDisplay(0, 0)).toEqual({ label: 'Chưa có', hasReviews: false });
      expect(formatExpertRatingDisplay(null, 0)).toEqual({ label: 'Chưa có', hasReviews: false });
      expect(formatExpertRatingDisplay(4.5, 3)).toEqual({ label: '4.5', hasReviews: true });
      expect(formatExpertRatingDisplay(5, 1)).toEqual({ label: '5.0', hasReviews: true });
    });
  });

  describe('getFeaturedBannerSubtitle', () => {
    it('reflects the admin-configured default sort criterion', () => {
      expect(getFeaturedBannerSubtitle('FeeAsc', 'Mức phí thấp nhất')).toBe(
        'Xếp hạng theo cấu hình: Mức phí thấp nhất'
      );
      expect(getFeaturedBannerSubtitle('Recommended')).toBe(
        'Xếp hạng theo cấu hình: Đề xuất ưu tiên'
      );
    });
  });
});
