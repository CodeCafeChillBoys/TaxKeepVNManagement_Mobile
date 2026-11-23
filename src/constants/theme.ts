import { Platform, StyleSheet } from 'react-native';
import { fonts, isIconFontFamily, resolveFontFamilyByWeight } from './fonts';

export const LIGHT_THEME_COLORS = {
  // Primary palette
  primary: '#8B1E1E', // Đỏ sẫm pháp lý (tương thích hoa văn Trống đồng)
  primaryDark: '#661212',
  primaryLight: '#B23A3A',

  // Background & Surfaces
  background: '#F8F5EE', // Nền be kem ấm cúng đặc trưng trang luật
  surface: '#FFFFFF',
  surfaceSecondary: '#EFEBE2',
  inputBackground: '#EBE5DA',

  // Accents & Badges
  gold: '#C59A3F', // Vàng hoàng gia / Trống đồng
  goldLight: '#E8D4A2',

  // Text colors
  textPrimary: '#1E1E1E',
  textSecondary: '#666666',
  textPlaceholder: '#9E9E9E',
  textOnPrimary: '#FFFFFF',

  // Borders & Dividers
  border: '#DED7CB',
  borderFocus: '#8B1E1E',

  // Functional states
  error: '#D32F2F',
  errorBackground: '#FFEBEE',
  success: '#2E7D32',
  successBackground: '#E8F5E9',
  warning: '#ED6C02',
  warningBackground: '#FFF3E0',
  info: '#0288D1',
};

export const DARK_THEME_COLORS: typeof LIGHT_THEME_COLORS = {
  primary: '#B83232',
  primaryDark: '#F07575',
  primaryLight: '#D14B4B',
  background: '#141210',
  surface: '#1F1C19',
  surfaceSecondary: '#2A2622',
  inputBackground: '#2A2622',
  gold: '#D4A84B',
  goldLight: '#8C6D2E',
  textPrimary: '#F5F2EB',
  textSecondary: '#B5AEA4',
  textPlaceholder: '#7A746C',
  textOnPrimary: '#FFFFFF',
  border: '#38332E',
  borderFocus: '#D4A84B',
  error: '#EF5350',
  errorBackground: '#3B1A1A',
  success: '#4CAF50',
  successBackground: '#18331B',
  warning: '#FFA726',
  warningBackground: '#382812',
  info: '#29B6F6',
};

type RegisteredSheet = {
  target: Record<string, any>;
  original: Record<string, any>;
};

const registeredStyleSheets: RegisteredSheet[] = [];
let currentThemeMode: 'light' | 'dark' = 'light';

const DARK_BG_PAGE = new Set([
  '#f8f5ee',
  '#faf8f0',
  '#fcfcfa',
  '#fbf8f4',
  '#faf5ee',
  '#f8fafc',
]);

const DARK_BG_SURFACE = new Set(['#ffffff', '#fff']);

const DARK_BG_SECONDARY = new Set([
  '#efebe2',
  '#ebe5da',
  '#f5f5f5',
  '#f5efe6',
  '#f3efe6',
  '#f3ecd8',
  '#f1f5f9',
  '#f5ebe1',
  '#fffbeb',
  '#f0fdf4',
]);

const DARK_BORDER_SET = new Set([
  '#ded7cb',
  '#eae4dc',
  '#e8ded1',
  '#e8d5b5',
  '#e2e8f0',
  '#cbd5e1',
  '#fde68a',
]);

const DARK_TEXT_PRIMARY = new Set([
  '#1e1e1e',
  '#1e293b',
  '#333333',
  '#333',
  '#334155',
  '#222222',
  '#000000',
  '#000',
]);

const DARK_TEXT_SECONDARY = new Set([
  '#666666',
  '#666',
  '#555555',
  '#555',
  '#444444',
  '#444',
  '#4b5563',
  '#475569',
  '#64748b',
  '#7a7571',
  '#777777',
  '#9a9488',
]);

const TEXT_STYLE_KEYS = [
  'fontSize',
  'fontWeight',
  'fontFamily',
  'lineHeight',
  'letterSpacing',
  'textAlign',
  'textTransform',
  'textDecorationLine',
  'color',
] as const;

function applyUnifiedFont(rule: Record<string, any>): Record<string, any> {
  if (!rule || typeof rule !== 'object') return rule;
  const hasTextProp = TEXT_STYLE_KEYS.some((k) => rule[k] !== undefined);
  if (!hasTextProp) return rule;

  const existingFont = typeof rule.fontFamily === 'string' ? rule.fontFamily : undefined;
  if (existingFont && isIconFontFamily(existingFont)) {
    return rule;
  }

  const next = { ...rule };
  if (!existingFont || !existingFont.startsWith('BeVietnamPro_')) {
    next.fontFamily = resolveFontFamilyByWeight(next.fontWeight);
  } else if (next.fontWeight !== undefined) {
    // Nếu style có kèm fontWeight rõ ràng trên BeVietnamPro, map đúng file trọng lượng
    const weighted = resolveFontFamilyByWeight(next.fontWeight);
    if (weighted !== fonts.body || existingFont === fonts.body) {
      next.fontFamily = weighted;
    }
  }

  // Bỏ fontWeight khi đã dùng static font face BeVietnamPro_* để tránh double faux-bold trên Android/Web
  if (next.fontWeight !== undefined) {
    delete next.fontWeight;
  }

  return next;
}

function mapRuleForMode(rule: Record<string, any>, mode: 'light' | 'dark'): Record<string, any> {
  if (!rule || typeof rule !== 'object') return rule;
  const unified = applyUnifiedFont(rule);
  if (mode === 'light') {
    return unified;
  }

  const next: Record<string, any> = { ...unified };

  if (typeof next.backgroundColor === 'string') {
    const bg = next.backgroundColor.trim().toLowerCase();
    if (DARK_BG_PAGE.has(bg)) {
      next.backgroundColor = DARK_THEME_COLORS.background;
    } else if (DARK_BG_SURFACE.has(bg)) {
      next.backgroundColor = DARK_THEME_COLORS.surface;
    } else if (DARK_BG_SECONDARY.has(bg)) {
      next.backgroundColor = DARK_THEME_COLORS.surfaceSecondary;
    } else if (bg === '#ffebee' || bg === '#fef2f2') {
      next.backgroundColor = DARK_THEME_COLORS.errorBackground;
    } else if (bg === '#fff3e0' || bg === '#fff7ed') {
      next.backgroundColor = DARK_THEME_COLORS.warningBackground;
    } else if (bg === '#e8f5e9' || bg === '#ecfdf5') {
      next.backgroundColor = DARK_THEME_COLORS.successBackground;
    }
  }

  const borderKeys = [
    'borderColor',
    'borderTopColor',
    'borderBottomColor',
    'borderLeftColor',
    'borderRightColor',
  ] as const;

  for (const key of borderKeys) {
    if (typeof next[key] === 'string') {
      const bc = next[key].trim().toLowerCase();
      if (DARK_BORDER_SET.has(bc)) {
        next[key] = DARK_THEME_COLORS.border;
      }
    }
  }

  if (typeof next.color === 'string') {
    const tc = next.color.trim().toLowerCase();
    if (DARK_TEXT_PRIMARY.has(tc)) {
      next.color = DARK_THEME_COLORS.textPrimary;
    } else if (DARK_TEXT_SECONDARY.has(tc)) {
      next.color = DARK_THEME_COLORS.textSecondary;
    } else if (tc === '#661212') {
      next.color = DARK_THEME_COLORS.primaryDark;
    } else if (tc === '#8b1e1e') {
      next.color = '#E55A5A';
    } else if (tc === '#5a4a22' || tc === '#7a5a14') {
      next.color = DARK_THEME_COLORS.gold;
    }
  }

  return next;
}

const originalCreate = StyleSheet.create.bind(StyleSheet);
let isPatched = false;

if (!isPatched) {
  isPatched = true;
  (StyleSheet as any).create = function patchedStyleSheetCreate<
    T extends Record<string, any>,
  >(styles: T): T {
    const originalSnapshot: Record<string, any> = {};
    const normalizedStyles: Record<string, any> = {};
    for (const key of Object.keys(styles)) {
      const val = (styles as Record<string, any>)[key];
      originalSnapshot[key] = val && typeof val === 'object' ? { ...val } : val;
      normalizedStyles[key] =
        val && typeof val === 'object' ? mapRuleForMode(val, currentThemeMode) : val;
    }

    const created = originalCreate(normalizedStyles) as Record<string, any>;
    registeredStyleSheets.push({
      target: created,
      original: originalSnapshot,
    });

    return created as T;
  };
}

export function applyGlobalThemeMode(mode: 'light' | 'dark'): void {
  currentThemeMode = mode;
  const palette = mode === 'dark' ? DARK_THEME_COLORS : LIGHT_THEME_COLORS;
  Object.assign(theme.colors, palette);

  for (const sheet of registeredStyleSheets) {
    for (const key of Object.keys(sheet.original)) {
      sheet.target[key] = mapRuleForMode(sheet.original[key], mode);
    }
  }
}

export const theme = {
  colors: { ...LIGHT_THEME_COLORS },

  typography: {
    titleLarge: {
      fontFamily: fonts.bodyBold,
      fontSize: 22,
      lineHeight: 28,
    },
    titleMedium: {
      fontFamily: fonts.bodySemi,
      fontSize: 18,
      lineHeight: 24,
    },
    bodyLarge: {
      fontFamily: fonts.body,
      fontSize: 15,
      lineHeight: 22,
    },
    bodyMedium: {
      fontFamily: fonts.body,
      fontSize: 14,
      lineHeight: 20,
    },
    bodySmall: {
      fontFamily: fonts.body,
      fontSize: 12,
      lineHeight: 16,
    },
    caption: {
      fontFamily: fonts.bodyMedium,
      fontSize: 11,
      lineHeight: 14,
    },
    /** DanhGiaUI §8 — 1px = 1dp, không scale theo chiều rộng máy. */
    appTitle: {
      fontFamily: fonts.serifBold,
      fontSize: 36,
      lineHeight: 42,
      letterSpacing: 0,
    },
    amountLarge: {
      fontFamily: fonts.serifBold,
      fontSize: 36,
      lineHeight: 40,
      letterSpacing: -0.2,
    },
    screenTitle: {
      fontFamily: fonts.serifBold,
      fontSize: 26,
      lineHeight: 32,
    },
    sectionTitle: {
      fontFamily: fonts.serifBold,
      fontSize: 18,
      lineHeight: 24,
    },
    eyebrow: {
      fontFamily: fonts.bodySemi,
      fontSize: 12,
      lineHeight: 16,
      letterSpacing: 1,
    },
    fieldLabel: {
      fontFamily: fonts.bodySemi,
      fontSize: 13,
      lineHeight: 18,
    },
    inputText: {
      fontFamily: fonts.body,
      fontSize: 15,
      lineHeight: 20,
    },
    buttonText: {
      fontFamily: fonts.bodyBold,
      fontSize: 16,
      lineHeight: 20,
    },
    body: {
      fontFamily: fonts.body,
      fontSize: 14,
      lineHeight: 20,
    },
    helper: {
      fontFamily: fonts.body,
      fontSize: 12,
      lineHeight: 16,
    },
    indexNumber: {
      fontFamily: fonts.serifBold,
      fontSize: 15,
      lineHeight: 20,
    },
    tabBarLabel: {
      fontFamily: fonts.body,
      fontSize: 10,
      lineHeight: 12,
    },
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },

  borderRadius: {
    sm: 6,
    md: 10,
    lg: 16,
    full: 9999,
  },

  shadows: {
    card: Platform.select({
      web: {
        boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.06)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
      },
    }),
    button: Platform.select({
      web: {
        boxShadow: '0px 3px 5px rgba(139, 30, 30, 0.2)',
      },
      default: {
        shadowColor: '#8B1E1E',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
        elevation: 3,
      },
    }),
  },
};
