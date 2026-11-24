export const fontAssets = {
  BeVietnamPro_400Regular: require('../../assets/fonts/BeVietnamPro_400Regular.ttf'),
  BeVietnamPro_500Medium: require('../../assets/fonts/BeVietnamPro_500Medium.ttf'),
  BeVietnamPro_600SemiBold: require('../../assets/fonts/BeVietnamPro_600SemiBold.ttf'),
  BeVietnamPro_700Bold: require('../../assets/fonts/BeVietnamPro_700Bold.ttf'),
};

/**
 * Đồng bộ 1 bộ font duy nhất toàn hệ thống: Be Vietnam Pro.
 * Các key serif/serifBold vẫn giữ để tương thích ngược toàn bộ màn hình nhưng trỏ về BeVietnamPro_700Bold.
 */
export const fonts = {
  body: 'BeVietnamPro_400Regular',
  bodyMedium: 'BeVietnamPro_500Medium',
  bodySemi: 'BeVietnamPro_600SemiBold',
  bodyBold: 'BeVietnamPro_700Bold',
  bodyExtra: 'BeVietnamPro_700Bold',
  serif: 'BeVietnamPro_700Bold',
  serifBold: 'BeVietnamPro_700Bold',
};

const ICON_FONT_PATTERN = /(icon|ionicons|material|glyph|feather|fontawesome|entypo|antdesign|octicons|evilicons|foundation|simpleline|zocial)/i;

export function isIconFontFamily(fontFamily?: string | null): boolean {
  if (!fontFamily || typeof fontFamily !== 'string') return false;
  return ICON_FONT_PATTERN.test(fontFamily);
}

export function resolveFontFamilyByWeight(weight?: string | number | null): string {
  if (weight === undefined || weight === null) return fonts.body;
  const normalized = String(weight).trim().toLowerCase();
  if (
    normalized === 'bold' ||
    normalized === '700' ||
    normalized === '800' ||
    normalized === '900'
  ) {
    return fonts.bodyBold;
  }
  if (normalized === '600' || normalized === 'semibold') {
    return fonts.bodySemi;
  }
  if (normalized === '500' || normalized === 'medium') {
    return fonts.bodyMedium;
  }
  return fonts.body;
}
