jest.mock('../../assets/fonts/BeVietnamPro_400Regular.ttf', () => 'BeVietnamPro_400Regular.ttf');
jest.mock('../../assets/fonts/BeVietnamPro_500Medium.ttf', () => 'BeVietnamPro_500Medium.ttf');
jest.mock('../../assets/fonts/BeVietnamPro_600SemiBold.ttf', () => 'BeVietnamPro_600SemiBold.ttf');
jest.mock('../../assets/fonts/BeVietnamPro_700Bold.ttf', () => 'BeVietnamPro_700Bold.ttf');

import {
  fontAssets,
  fonts,
  isIconFontFamily,
  resolveFontFamilyByWeight,
} from './fonts';

describe('unified font system (Be Vietnam Pro)', () => {
  it('loads only BeVietnamPro assets and maps every font token exclusively to BeVietnamPro', () => {
    expect(Object.keys(fontAssets)).toEqual([
      'BeVietnamPro_400Regular',
      'BeVietnamPro_500Medium',
      'BeVietnamPro_600SemiBold',
      'BeVietnamPro_700Bold',
    ]);
    Object.values(fonts).forEach((fontName) => {
      expect(fontName).toMatch(/^BeVietnamPro_/);
      expect(fontName).not.toMatch(/NotoSerif/i);
    });
  });

  it('resolves exact BeVietnamPro weight face from fontWeight', () => {
    expect(resolveFontFamilyByWeight(undefined)).toBe(fonts.body);
    expect(resolveFontFamilyByWeight('400')).toBe(fonts.body);
    expect(resolveFontFamilyByWeight('normal')).toBe(fonts.body);
    expect(resolveFontFamilyByWeight('500')).toBe(fonts.bodyMedium);
    expect(resolveFontFamilyByWeight('600')).toBe(fonts.bodySemi);
    expect(resolveFontFamilyByWeight('700')).toBe(fonts.bodyBold);
    expect(resolveFontFamilyByWeight('800')).toBe(fonts.bodyBold);
    expect(resolveFontFamilyByWeight('bold')).toBe(fonts.bodyBold);
    expect(resolveFontFamilyByWeight(700)).toBe(fonts.bodyBold);
  });

  it('detects icon fonts so icon glyphs are never overwritten', () => {
    expect(isIconFontFamily('Ionicons')).toBe(true);
    expect(isIconFontFamily('MaterialIcons')).toBe(true);
    expect(isIconFontFamily('BeVietnamPro_400Regular')).toBe(false);
    expect(isIconFontFamily(undefined)).toBe(false);
  });
});
