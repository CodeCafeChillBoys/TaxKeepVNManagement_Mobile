import { Platform } from 'react-native';
export const theme = {
  colors: {
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
  },
  
  typography: {
    titleLarge: {
      fontSize: 22,
      fontWeight: '700' as const,
      lineHeight: 28,
    },
    titleMedium: {
      fontSize: 18,
      fontWeight: '600' as const,
      lineHeight: 24,
    },
    bodyLarge: {
      fontSize: 15,
      fontWeight: '400' as const,
      lineHeight: 22,
    },
    bodyMedium: {
      fontSize: 14,
      fontWeight: '400' as const,
      lineHeight: 20,
    },
    bodySmall: {
      fontSize: 12,
      fontWeight: '400' as const,
      lineHeight: 16,
    },
    caption: {
      fontSize: 11,
      fontWeight: '500' as const,
      lineHeight: 14,
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
