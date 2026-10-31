/** Màn trước đăng nhập — không có Trang chủ để về */
const PUBLIC_ROUTES = new Set(['Login', 'Register', 'VerifyPending']);

/**
 * Nút về Trang chủ trên header. Ẩn khi: chưa đăng nhập, đang ở Trang chủ,
 * hoặc bấm lùi đã về thẳng Trang chủ (màn trước là Home / không có màn trước).
 */
export function shouldShowHomeButton(
  routeName: string,
  isAuthenticated: boolean,
  previousRouteName: string | undefined
): boolean {
  if (!isAuthenticated) return false;
  if (routeName === 'Home' || PUBLIC_ROUTES.has(routeName)) return false;
  return previousRouteName !== undefined && previousRouteName !== 'Home';
}
