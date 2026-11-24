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
  primary: '#E04848',
  primaryDark: '#FF9E9E',
  primaryLight: '#F06A6A',
  background: '#12100E',
  surface: '#24201C',
  surfaceSecondary: '#36302A',
  inputBackground: '#2E2924',
  gold: '#EAC066',
  goldLight: '#9E7B34',
  textPrimary: '#FAF7F2',
  textSecondary: '#D4CEC3',
  textPlaceholder: '#A39B90',
  textOnPrimary: '#FFFFFF',
  border: '#52493F',
  borderFocus: '#EAC066',
  error: '#F87171',
  errorBackground: '#3F1D1D',
  success: '#4ADE80',
  successBackground: '#173823',
  warning: '#FBBF24',
  warningBackground: '#3D2B12',
  info: '#38BDF8',
};

type RegisteredSheet = {
  target: Record<string, any>;
  original: Record<string, any>;
};

const registeredStyleSheets: RegisteredSheet[] = [];
let currentThemeMode: 'light' | 'dark' = 'light';

const DARK_BG_PAGE = new Set([
  '#f8f5ee',
  '#f8f4ec',
  '#f9f6f0',
  '#f9f7f2',
  '#faf8f0',
  '#fcfcfa',
  '#fbf8f4',
  '#fbf8f1',
  '#fbf9f4',
  '#fbf5ee',
  '#fbf6e9',
  '#faf5ee',
  '#faf5ea',
  '#faf6ee',
  '#faf7f0',
  '#faf7f1',
  '#faf7f2',
  '#faf8f3',
  '#faf8f5',
  '#faf4eb',
  '#faf3e3',
  '#faf0e8',
  '#fdfbf7',
  '#fef9f3',
  '#f8fafc',
]);

const DARK_BG_SURFACE = new Set([
  '#ffffff',
  '#fff',
  '#fffdf7',
  '#fafafa',
  '#f9f9f9',
  '#f9fafb',
]);

const DARK_BG_SECONDARY = new Set([
  '#efebe2',
  '#ebe5da',
  '#ebe5d8',
  '#e4dccf',
  '#e5d5b5',
  '#e5e0d4',
  '#e5e7eb',
  '#eae3d5',
  '#eaeaee',
  '#ede8de',
  '#efe3bf',
  '#efeae0',
  '#f0eae1',
  '#f0ebe1',
  '#f0f0f2',
  '#f2f2f7',
  '#f3f4f6',
  '#f4efe6',
  '#f4f3f0',
  '#f5f5f5',
  '#f5f5f7',
  '#f5efe6',
  '#f5efeb',
  '#f5f1ea',
  '#f5f2eb',
  '#f3efe6',
  '#f3ecd8',
  '#f1f5f9',
  '#f5ebe1',
  '#e2e8f0',
  '#ded7cb',
  '#d6cfc2',
  '#d6c7b2',
  'rgba(255, 255, 255, 0.75)',
  'rgba(255, 255, 255, 0.85)',
  'rgba(255, 255, 255, 0.88)',
  'rgba(255, 255, 255, 0.90)',
  'rgba(255, 253, 247, 0.92)',
  'rgba(255, 253, 247, 0.94)',
  'rgba(248, 245, 238, 0.94)',
  'rgba(243, 239, 230, 0.85)',
]);

const DARK_BG_ERROR_TINT = new Set([
  '#ffebee',
  '#fef2f2',
  '#fee2e2',
  '#fcecec',
  '#fdecec',
  '#fdede8',
  '#fdf2f2',
  '#fdf7f7',
  '#fdf8f8',
  '#fff1f2',
  '#fff5f5',
  '#fff8f8',
  '#8b1e1e0b',
  '#8b1e1e10',
  '#8b1e1e12',
  '#8b1e1e14',
  '#8b1e1e1c',
  '#8b1e1e1f',
]);

const DARK_BG_WARNING_TINT = new Set([
  '#fff3e0',
  '#fff7ed',
  '#fffbeb',
  '#fef3c7',
  '#fce4a6',
  '#fde68a',
  '#fff0c2',
  '#fff1d6',
  '#fff6e0',
  '#fff8f0',
  '#fff9e6',
  '#fffbf2',
  '#fffbf5',
  '#fdf8ee',
]);

const DARK_BG_SUCCESS_TINT = new Set([
  '#e8f5e9',
  '#ecfdf5',
  '#f0fdf4',
  '#dcfce7',
  '#ccfbf1',
  '#eef6ee',
  '#f2fbf5',
]);

const DARK_BG_INFO_TINT = new Set([
  '#e0e7ff',
  '#e0f2fe',
  '#e3f2fd',
  '#eef2ff',
  '#eff6ff',
  '#f0f9ff',
  '#ebf4f6',
]);

const DARK_BORDER_SET = new Set([
  '#ded7cb',
  '#dfd7cc',
  '#ddd5c4',
  '#d6cfc2',
  '#d4d4d8',
  '#d1d5db',
  '#cbd5e1',
  '#cccccc',
  '#dddddd',
  '#eeeeee',
  '#e2d7c2',
  '#e2dac8',
  '#e2dacb',
  '#e2dbd0',
  '#e2dcd0',
  '#e2e8f0',
  '#e4d6be',
  '#e5d5b5',
  '#e5d8c3',
  '#e5ddcb',
  '#e5dec9',
  '#e5e7eb',
  '#e6d5b8',
  '#e6dcbf',
  '#e6dece',
  '#e6decf',
  '#e7dcb9',
  '#e7dec9',
  '#e8d5b5',
  '#e8d8ca',
  '#e8dec8',
  '#e8ded1',
  '#e8dfc9',
  '#e8e2d5',
  '#e8e2d6',
  '#eae2d2',
  '#eae4dc',
  '#eae6df',
  '#ebe5d8',
  '#ece4d4',
  '#ece4d8',
  '#ece5d6',
  '#ece6da',
  '#ece6dc',
  '#efe8d8',
  '#efe8db',
  '#efe8dc',
  '#efe9dd',
  '#efeae0',
  '#efebe1',
  '#f0eae1',
  '#f0ebe0',
  '#f0ebe1',
  '#f0ece4',
  '#f0f0f0',
  '#f0f0f2',
  '#f1ece4',
  '#f1f5f9',
  '#f2f2f7',
  '#f3efe6',
  '#f3f4f6',
  '#f5f1e8',
  '#f7e7c4',
  '#f7f7f8',
  '#bdb5a6',
]);

const DARK_TEXT_PRIMARY = new Set([
  '#000000',
  '#000',
  '#0f172a',
  '#111827',
  '#1a1a1a',
  '#1c1917',
  '#1e1e1e',
  '#1e293b',
  '#1f2937',
  '#222222',
  '#262626',
  '#2c3e50',
  '#333333',
  '#333',
  '#334155',
  '#374151',
  '#3a2e25',
  '#3b3632',
]);

const DARK_TEXT_SECONDARY = new Set([
  '#444444',
  '#444',
  '#475569',
  '#4b3f35',
  '#4b5563',
  '#555555',
  '#555',
  '#64748b',
  '#666666',
  '#666',
  '#6b7280',
  '#777777',
  '#786f66',
  '#78909c',
  '#7a6a53',
  '#7a746c',
  '#7a7571',
  '#888888',
  '#8a8175',
  '#8c7653',
  '#8c827a',
  '#8e8e93',
  '#90a4ae',
  '#94a3b8',
  '#999999',
  '#999',
  '#9a9488',
  '#9a9a9a',
  '#9c9287',
  '#9ca3af',
  '#9e9e9e',
  '#a3a3a3',
  '#a8a29e',
]);

const DARK_TEXT_MAROON_HEADING = new Set([
  '#5c1010',
  '#5e1212',
  '#661212',
  '#6b1414',
  '#7a1616',
  '#7f1d1d',
  '#881337',
]);

const DARK_TEXT_RED_ACCENT = new Set([
  '#8b1e1e',
  '#991b1b',
  '#9f1239',
  '#b23a3a',
  '#b3261e',
  '#b83232',
  '#b91c1c',
  '#be123c',
  '#d32f2f',
  '#d61f26',
  '#dc2626',
]);

const DARK_TEXT_AMBER_GOLD = new Set([
  '#5a2a14',
  '#5a4a22',
  '#6b4600',
  '#78350f',
  '#7a5a14',
  '#7a5b00',
  '#8a2a00',
  '#8a5a00',
  '#8a6800',
  '#92400e',
  '#9a3412',
  '#b45309',
  '#c2410c',
  '#c59a3f',
  '#d97706',
  '#e65100',
  '#ea580c',
  '#ed6c02',
]);

const DARK_TEXT_GREEN = new Set([
  '#047857',
  '#059669',
  '#065f46',
  '#0d9488',
  '#0f766e',
  '#14532d',
  '#15803d',
  '#166534',
  '#16a34a',
  '#1b5e20',
  '#2e7d32',
  '#3d5c3a',
]);

const DARK_TEXT_BLUE = new Set([
  '#0284c7',
  '#0288d1',
  '#0369a1',
  '#075985',
  '#0c4a6e',
  '#1565c0',
  '#1d4ed8',
  '#1e3a8a',
  '#1e40af',
  '#2563eb',
  '#3730a3',
  '#3b82f6',
  '#4338ca',
]);

function parseHexRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return [r, g, b];
    return null;
  }
  if (clean.length === 6 || clean.length === 8) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return [r, g, b];
  }
  return null;
}

const INNER_INPUT_KEY_RE =
  /(?:input|select|search|picker|dropdown|textarea|field)/i;
const INNER_COMPONENT_KEY_RE =
  /(?:chip|pill|tag|badge|option|slot|filter|tab|method|icon|emblem|thumb|preview|code|quote|detail|note|hint|secondaryBtn|outlineBtn|exportBtn|ghostBtn|quickAmount|bankSelector|dateSelector)/i;
const CONTAINER_KEY_RE =
  /(?:card|sheet|modal|screen|safe|container|page|bar|header|footer|list|section|wrap|block|root)/i;

export function mapTextColorForDark(rawColor: string): string {
  const tc = rawColor.trim().toLowerCase();
  if (
    tc === '#ffffff' ||
    tc === '#fff' ||
    tc === '#fffdf7' ||
    tc === '#ffff00' ||
    tc === DARK_THEME_COLORS.textPrimary.toLowerCase() ||
    tc === DARK_THEME_COLORS.textSecondary.toLowerCase() ||
    tc === DARK_THEME_COLORS.primaryDark.toLowerCase() ||
    tc === DARK_THEME_COLORS.gold.toLowerCase()
  ) {
    return rawColor;
  }
  if (DARK_TEXT_PRIMARY.has(tc)) return DARK_THEME_COLORS.textPrimary;
  if (DARK_TEXT_SECONDARY.has(tc)) return DARK_THEME_COLORS.textSecondary;
  if (DARK_TEXT_MAROON_HEADING.has(tc)) return DARK_THEME_COLORS.primaryDark;
  if (DARK_TEXT_RED_ACCENT.has(tc)) return '#FF7B7B';
  if (DARK_TEXT_AMBER_GOLD.has(tc)) return DARK_THEME_COLORS.gold;
  if (DARK_TEXT_GREEN.has(tc)) return '#4ADE80';
  if (DARK_TEXT_BLUE.has(tc)) return '#60A5FA';

  if (tc.startsWith('#')) {
    const rgb = parseHexRgb(tc);
    if (rgb) {
      const [r, g, b] = rgb;
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      if (lum < 0.54) {
        if (r - Math.max(g, b) > 32) {
          if (g > b + 20) return '#FBBF24';
          return lum < 0.25 ? DARK_THEME_COLORS.primaryDark : '#FF7B7B';
        }
        if (g - Math.max(r, b) > 18) return '#4ADE80';
        if (b - Math.max(r, g) > 18) return '#60A5FA';
        return lum < 0.28 ? DARK_THEME_COLORS.textPrimary : DARK_THEME_COLORS.textSecondary;
      }
    }
  }
  return rawColor;
}

export function mapBackgroundColorForDark(rawBg: string, ruleKey?: string): string {
  const bg = rawBg.trim().toLowerCase();
  if (bg === 'transparent' || bg === 'none') return rawBg;

  const isInputKey = Boolean(
    ruleKey && INNER_INPUT_KEY_RE.test(ruleKey) && !CONTAINER_KEY_RE.test(ruleKey)
  );
  const isInnerComponentKey = Boolean(
    ruleKey && INNER_COMPONENT_KEY_RE.test(ruleKey) && !CONTAINER_KEY_RE.test(ruleKey)
  );

  if (DARK_BG_PAGE.has(bg)) {
    return isInputKey
      ? DARK_THEME_COLORS.inputBackground
      : isInnerComponentKey
      ? DARK_THEME_COLORS.surfaceSecondary
      : DARK_THEME_COLORS.background;
  }
  if (DARK_BG_SURFACE.has(bg)) {
    return isInputKey
      ? DARK_THEME_COLORS.inputBackground
      : isInnerComponentKey
      ? DARK_THEME_COLORS.surfaceSecondary
      : DARK_THEME_COLORS.surface;
  }
  if (DARK_BG_SECONDARY.has(bg)) {
    return isInputKey ? DARK_THEME_COLORS.inputBackground : DARK_THEME_COLORS.surfaceSecondary;
  }
  if (DARK_BG_ERROR_TINT.has(bg)) return DARK_THEME_COLORS.errorBackground;
  if (DARK_BG_WARNING_TINT.has(bg)) return DARK_THEME_COLORS.warningBackground;
  if (DARK_BG_SUCCESS_TINT.has(bg)) return DARK_THEME_COLORS.successBackground;
  if (DARK_BG_INFO_TINT.has(bg)) return '#172B42';

  // Các nút chính màu đỏ đô sẫm -> nâng sáng nhẹ để nổi bật trên nền tối
  if (bg === '#8b1e1e' || bg === '#7a1616' || bg === '#5c1010' || bg === '#661212') {
    return '#C93838';
  }
  // Vạch mốc ngưỡng màu tối trên thanh progress
  if (bg === '#1e293b' && ruleKey && /marker|indicator/i.test(ruleKey)) {
    return DARK_THEME_COLORS.textPrimary;
  }

  if (bg.startsWith('#')) {
    const rgb = parseHexRgb(bg);
    if (rgb) {
      const [r, g, b] = rgb;
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      if (lum > 0.72) {
        if (r > g + 14 && r > b + 14) return DARK_THEME_COLORS.errorBackground;
        if (r > b + 24 && g > b + 16) return DARK_THEME_COLORS.warningBackground;
        if (g > r + 8 && g >= b) return DARK_THEME_COLORS.successBackground;
        if (b > r + 8) return '#172B42';
        if (isInputKey) return DARK_THEME_COLORS.inputBackground;
        if (isInnerComponentKey) return DARK_THEME_COLORS.surfaceSecondary;
        return lum > 0.96 ? DARK_THEME_COLORS.surface : DARK_THEME_COLORS.surfaceSecondary;
      }
    }
  }
  return rawBg;
}

export function mapBorderColorForDark(rawBorder: string, ruleKey?: string): string {
  const bc = rawBorder.trim().toLowerCase();
  if (bc === 'transparent') return rawBorder;
  const isInner = Boolean(
    ruleKey && (INNER_INPUT_KEY_RE.test(ruleKey) || INNER_COMPONENT_KEY_RE.test(ruleKey))
  );
  if (DARK_BORDER_SET.has(bc)) {
    return isInner ? '#63584C' : DARK_THEME_COLORS.border;
  }
  if (bc === '#8b1e1e' || bc === '#b3261e' || bc === '#dc2626') {
    return DARK_THEME_COLORS.primary;
  }
  if (bc === '#c59a3f' || bc === '#d4af37' || bc === '#d99b26' || bc === '#e0a800') {
    return DARK_THEME_COLORS.gold;
  }
  if (bc.startsWith('#')) {
    const rgb = parseHexRgb(bc);
    if (rgb) {
      const [r, g, b] = rgb;
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      if (lum > 0.62) {
        if (r > g + 18 && r > b + 18) return '#7F2D2D';
        if (r > b + 28 && g > b + 18) return '#785520';
        if (g > r + 12) return '#235C38';
        if (b > r + 12) return '#264B73';
        return isInner ? '#63584C' : DARK_THEME_COLORS.border;
      }
    }
  }
  return rawBorder;
}

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

function mapRuleForMode(
  rule: Record<string, any>,
  mode: 'light' | 'dark',
  ruleKey?: string
): Record<string, any> {
  if (!rule || typeof rule !== 'object') return rule;
  const unified = applyUnifiedFont(rule);
  if (mode === 'light') {
    return unified;
  }

  const next: Record<string, any> = { ...unified };

  if (typeof next.backgroundColor === 'string') {
    next.backgroundColor = mapBackgroundColorForDark(next.backgroundColor, ruleKey);
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
      next[key] = mapBorderColorForDark(next[key], ruleKey);
    }
  }

  if (typeof next.color === 'string') {
    next.color = mapTextColorForDark(next.color);
  }

  return next;
}

function normalizeStyleForDark(style: any, ruleHint?: string): any {
  if (!style) return style;
  if (Array.isArray(style)) {
    let changed = false;
    const mapped = style.map((item) => {
      const res = normalizeStyleForDark(item, ruleHint);
      if (res !== item) changed = true;
      return res;
    });
    return changed ? mapped : style;
  }
  if (typeof style === 'object') {
    const hasColorKey =
      typeof style.backgroundColor === 'string' ||
      typeof style.color === 'string' ||
      typeof style.borderColor === 'string' ||
      typeof style.borderTopColor === 'string' ||
      typeof style.borderBottomColor === 'string' ||
      typeof style.borderLeftColor === 'string' ||
      typeof style.borderRightColor === 'string';
    if (!hasColorKey) return style;
    return mapRuleForMode(style, 'dark', ruleHint);
  }
  return style;
}

function normalizePropsForDark(type: any, props: any): any {
  if (currentThemeMode !== 'dark' || !props || typeof props !== 'object') {
    return props;
  }

  const isTextInput =
    typeof props.onChangeText === 'function' ||
    props.placeholder !== undefined ||
    type?.displayName === 'TextInput' ||
    type?.name === 'TextInput';
  const ruleHint = isTextInput ? 'inputField' : undefined;

  let nextProps: Record<string, any> | null = null;

  if (props.style) {
    const mappedStyle = normalizeStyleForDark(props.style, ruleHint);
    if (mappedStyle !== props.style) {
      nextProps = { ...props, style: mappedStyle };
    }
  }

  if (typeof props.color === 'string') {
    const mappedColor = mapTextColorForDark(props.color);
    if (mappedColor !== props.color) {
      nextProps = { ...(nextProps || props), color: mappedColor };
    }
  }

  if (typeof props.placeholderTextColor === 'string') {
    const mappedPlaceholder = mapTextColorForDark(props.placeholderTextColor);
    const resolvedPlaceholder =
      mappedPlaceholder === props.placeholderTextColor
        ? DARK_THEME_COLORS.textPlaceholder
        : mappedPlaceholder;
    if (resolvedPlaceholder !== props.placeholderTextColor) {
      nextProps = {
        ...(nextProps || props),
        placeholderTextColor: resolvedPlaceholder,
      };
    }
  }

  return nextProps || props;
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
        val && typeof val === 'object' ? mapRuleForMode(val, currentThemeMode, key) : val;
    }

    const created = originalCreate(normalizedStyles) as Record<string, any>;
    registeredStyleSheets.push({
      target: created,
      original: originalSnapshot,
    });

    return created as T;
  };

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const React = require('react');
    if (React && typeof React.createElement === 'function') {
      const origCreateElement = React.createElement;
      React.createElement = function themedCreateElement(
        type: any,
        props: any,
        ...children: any[]
      ) {
        return origCreateElement(type, normalizePropsForDark(type, props), ...children);
      };
    }
  } catch {}

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const jsxRuntime = require('react/jsx-runtime');
    if (jsxRuntime && typeof jsxRuntime.jsx === 'function') {
      const origJsx = jsxRuntime.jsx;
      jsxRuntime.jsx = function themedJsx(type: any, props: any, key: any) {
        return origJsx(type, normalizePropsForDark(type, props), key);
      };
    }
    if (jsxRuntime && typeof jsxRuntime.jsxs === 'function') {
      const origJsxs = jsxRuntime.jsxs;
      jsxRuntime.jsxs = function themedJsxs(type: any, props: any, key: any) {
        return origJsxs(type, normalizePropsForDark(type, props), key);
      };
    }
  } catch {}

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const jsxDevRuntime = require('react/jsx-dev-runtime');
    if (jsxDevRuntime && typeof jsxDevRuntime.jsxDEV === 'function') {
      const origJsxDEV = jsxDevRuntime.jsxDEV;
      jsxDevRuntime.jsxDEV = function themedJsxDEV(
        type: any,
        props: any,
        key: any,
        isStaticChildren: any,
        source: any,
        self: any
      ) {
        return origJsxDEV(
          type,
          normalizePropsForDark(type, props),
          key,
          isStaticChildren,
          source,
          self
        );
      };
    }
  } catch {}
}

export function applyGlobalThemeMode(mode: 'light' | 'dark'): void {
  currentThemeMode = mode;
  const palette = mode === 'dark' ? DARK_THEME_COLORS : LIGHT_THEME_COLORS;
  Object.assign(theme.colors, palette);

  for (const sheet of registeredStyleSheets) {
    for (const key of Object.keys(sheet.original)) {
      sheet.target[key] = mapRuleForMode(sheet.original[key], mode, key);
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
