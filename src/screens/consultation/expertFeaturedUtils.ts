import type {
  ExpertListItemResponse,
  ExpertSortBy,
  ExpertSortOptionsResponse,
} from '../../types/consultation';

export const DEFAULT_FEATURED_COUNT = 6;

export interface SortOptionItem {
  key: ExpertSortBy;
  label: string;
}

/**
 * Danh sách tiêu chí sắp xếp chuẩn khớp 100% với BE ExpertController.GetSortOptions & ExpertSortBy enum
 */
export const DEFAULT_SORT_OPTIONS: SortOptionItem[] = [
  { key: 'Recommended', label: 'Đề xuất ưu tiên' },
  { key: 'RatingDesc', label: 'Đánh giá sao cao nhất' },
  { key: 'CompletedSessionsDesc', label: 'Nhiều ca tư vấn hoàn thành nhất' },
  { key: 'FeeAsc', label: 'Mức phí thấp nhất' },
  { key: 'FeeDesc', label: 'Mức phí cao nhất' },
  { key: 'ExperienceDesc', label: 'Nhiều năm kinh nghiệm nhất' },
];

const SORT_BY_BY_CODE: Record<number, ExpertSortBy> = {
  0: 'Recommended',
  1: 'RatingDesc',
  2: 'FeeAsc',
  3: 'FeeDesc',
  4: 'ExperienceDesc',
  5: 'CompletedSessionsDesc',
};

const SORT_BY_BY_LOWER: Record<string, ExpertSortBy> = {
  recommended: 'Recommended',
  ratingdesc: 'RatingDesc',
  feeasc: 'FeeAsc',
  feedesc: 'FeeDesc',
  experiencedesc: 'ExperienceDesc',
  completedsessionsdesc: 'CompletedSessionsDesc',
  sessionsdesc: 'CompletedSessionsDesc',
};

export function normalizeExpertSortBy(value: unknown): ExpertSortBy | null {
  if (typeof value === 'number' && value in SORT_BY_BY_CODE) {
    return SORT_BY_BY_CODE[value];
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const asNum = Number(trimmed);
    if (!Number.isNaN(asNum) && asNum in SORT_BY_BY_CODE) {
      return SORT_BY_BY_CODE[asNum];
    }
    const matched = SORT_BY_BY_LOWER[trimmed.toLowerCase()];
    if (matched) return matched;
  }
  return null;
}

export function getDefaultSortLabel(
  sortBy: ExpertSortBy,
  options: SortOptionItem[] = DEFAULT_SORT_OPTIONS
): string {
  return (
    options.find((o) => o.key === sortBy)?.label ||
    DEFAULT_SORT_OPTIONS.find((o) => o.key === sortBy)?.label ||
    'Đề xuất ưu tiên'
  );
}

export interface ResolvedAdminSortConfig {
  defaultSortBy: ExpertSortBy;
  defaultSortLabel: string;
  options: SortOptionItem[];
}

/**
 * Chuẩn hóa phản hồi GET /api/v1/experts/sort-options từ BE theo cấu hình Admin.
 * Đảm bảo luôn cập nhật defaultSortBy ngay cả khi AllowedSortOptions rỗng hoặc trả dạng mã số enum.
 */
export function resolveAdminSortConfig(
  sortConfig?: ExpertSortOptionsResponse | null,
  fallbackOptions: SortOptionItem[] = DEFAULT_SORT_OPTIONS
): ResolvedAdminSortConfig {
  const mappedOptions: SortOptionItem[] = [];
  const seen = new Set<ExpertSortBy>();

  if (Array.isArray(sortConfig?.options)) {
    for (const opt of sortConfig.options) {
      const normalizedKey =
        normalizeExpertSortBy(opt?.value) ?? normalizeExpertSortBy(opt?.code);
      if (!normalizedKey || seen.has(normalizedKey)) continue;
      seen.add(normalizedKey);
      const label =
        typeof opt?.label === 'string' && opt.label.trim().length > 0
          ? opt.label.trim()
          : getDefaultSortLabel(normalizedKey, fallbackOptions);
      mappedOptions.push({ key: normalizedKey, label });
    }
  }

  const effectiveOptions =
    mappedOptions.length > 0 ? mappedOptions : [...fallbackOptions];

  const defaultFromFlag = Array.isArray(sortConfig?.options)
    ? sortConfig.options.find((opt) => Boolean(opt?.isDefault))
    : undefined;

  const resolvedDefaultSortBy =
    normalizeExpertSortBy(sortConfig?.defaultSortBy) ??
    normalizeExpertSortBy(defaultFromFlag?.value) ??
    normalizeExpertSortBy(defaultFromFlag?.code) ??
    effectiveOptions[0]?.key ??
    'Recommended';

  const defaultSortLabel = getDefaultSortLabel(
    resolvedDefaultSortBy,
    effectiveOptions
  );

  return {
    defaultSortBy: resolvedDefaultSortBy,
    defaultSortLabel,
    options: effectiveOptions,
  };
}

/**
 * Đồng bộ lại lựa chọn sort của user sau khi Admin thay đổi cấu hình:
 * - Nếu tiêu chí user đang chọn không còn trong AllowedSortOptions -> quay về mặc định (null).
 * - Nếu tiêu chí user đang chọn trùng với DefaultSortBy mới của Admin -> chuẩn hóa về null để luôn theo BE.
 */
export function reconcileUserSelectedSort(
  prevSelected: ExpertSortBy | null,
  nextDefaultSort: ExpertSortBy,
  allowedOptions: SortOptionItem[]
): ExpertSortBy | null {
  if (!prevSelected) return null;
  if (prevSelected === nextDefaultSort) return null;
  if (!allowedOptions.some((o) => o.key === prevSelected)) return null;
  return prevSelected;
}

export interface MinimalAuthUser {
  id?: string | null;
  fullName?: string | null;
  role?: string | null;
}

/**
 * Kiểm tra chuyên gia có phải chính bản thân user đang đăng nhập hay không.
 * Ưu tiên so khớp chính xác theo userId / profileId để tránh ẩn nhầm chuyên gia trùng tên.
 */
export function isSelfExpertProfile(
  expert: Pick<ExpertListItemResponse, 'id' | 'userId' | 'fullName'>,
  currentUser?: MinimalAuthUser | null
): boolean {
  if (!currentUser) return false;
  const myId = String(currentUser.id || '').trim().toLowerCase();
  const expUserId = String(expert.userId || '').trim().toLowerCase();
  const expProfileId = String(expert.id || '').trim().toLowerCase();

  if (myId) {
    if (expUserId && myId === expUserId) return true;
    if (expProfileId && myId === expProfileId) return true;
    return false;
  }

  const myName = String(currentUser.fullName || '').trim().toLowerCase();
  const expName = String(expert.fullName || '').trim().toLowerCase();
  return Boolean(myName && expName && myName === expName);
}

/**
 * Lọc danh sách Top chuyên gia đề xuất hiển thị trên bảng đỏ:
 * giữ nguyên thứ tự xếp hạng từ BE theo cấu hình Admin, chỉ bỏ bản thân mình và giới hạn maxCount.
 */
export function selectDisplayedFeaturedExperts(
  featuredItems: ExpertListItemResponse[],
  currentUser?: MinimalAuthUser | null,
  maxCount = DEFAULT_FEATURED_COUNT
): ExpertListItemResponse[] {
  if (!Array.isArray(featuredItems) || featuredItems.length === 0) return [];
  const limit = Math.max(1, maxCount);
  return featuredItems
    .filter((exp) => !isSelfExpertProfile(exp, currentUser))
    .slice(0, limit);
}

/**
 * Chữ ký danh sách chuyên gia đề xuất để phát hiện thay đổi thứ tự/dữ liệu khi Admin cập nhật cấu hình
 * và reset carousel về TOP #1 ngay lập tức.
 */
export function buildFeaturedListSignature(
  items: ExpertListItemResponse[]
): string {
  if (!Array.isArray(items) || items.length === 0) return '';
  return items
    .map(
      (item, idx) =>
        `${idx}:${item.id}:${item.rankingScore}:${item.rating}:${item.startingFee}:${item.completedConsultationsCount}:${item.yearsOfExperience}`
    )
    .join('|');
}

/**
 * Định dạng điểm đánh giá trung thực theo dữ liệu BE.
 * Không giả mạo '5.0' cho chuyên gia chưa có lượt đánh giá (rating === 0).
 */
export function formatExpertRatingDisplay(
  rating?: number | null,
  totalReviews?: number | null
): { label: string; hasReviews: boolean } {
  const numRating = Number(rating ?? 0);
  const numReviews = Number(totalReviews ?? 0);
  if (Number.isFinite(numRating) && numRating > 0) {
    return {
      label: numRating.toFixed(1),
      hasReviews: numReviews > 0 || numRating > 0,
    };
  }
  return {
    label: 'Chưa có',
    hasReviews: false,
  };
}

/**
 * Phụ đề bảng Top chuyên gia đề xuất phản ánh đúng tiêu chí DefaultSortBy mà Admin đang cấu hình.
 */
export function getFeaturedBannerSubtitle(
  defaultSortBy: ExpertSortBy,
  defaultSortLabel?: string
): string {
  const label = defaultSortLabel?.trim() || getDefaultSortLabel(defaultSortBy);
  return `Xếp hạng theo cấu hình: ${label}`;
}
