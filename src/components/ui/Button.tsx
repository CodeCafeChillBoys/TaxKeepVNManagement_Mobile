import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  View,
  Platform,
} from 'react-native';

export type ButtonVariant =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline'
  | 'ghost'
  | 'link';

export type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

interface ButtonProps {
  onPress: () => void;
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  onPress,
  children,
  variant = 'default',
  size = 'default',
  disabled = false,
  loading = false,
  style,
  textStyle,
  icon,
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'secondary':
        return {
          container: styles.secondaryContainer,
          text: styles.secondaryText,
          spinnerColor: '#475569',
        };
      case 'destructive':
        return {
          container: styles.destructiveContainer,
          text: styles.destructiveText,
          spinnerColor: '#FFFFFF',
        };
      case 'outline':
        return {
          container: styles.outlineContainer,
          text: styles.outlineText,
          spinnerColor: '#334155',
        };
      case 'ghost':
        return {
          container: styles.ghostContainer,
          text: styles.ghostText,
          spinnerColor: '#334155',
        };
      case 'link':
        return {
          container: styles.linkContainer,
          text: styles.linkText,
          spinnerColor: '#8B1E1E',
        };
      case 'default':
      default:
        return {
          container: styles.defaultContainer,
          text: styles.defaultText,
          spinnerColor: '#FFFFFF',
        };
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return {
          container: styles.smContainer,
          text: styles.smText,
        };
      case 'lg':
        return {
          container: styles.lgContainer,
          text: styles.lgText,
        };
      case 'icon':
        return {
          container: styles.iconContainer,
          text: styles.smText,
        };
      case 'default':
      default:
        return {
          container: styles.defaultSizeContainer,
          text: styles.defaultSizeText,
        };
    }
  };

  const vStyles = getVariantStyles();
  const sStyles = getSizeStyles();

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.baseButton,
        vStyles.container,
        sStyles.container,
        disabled && styles.disabledButton,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={vStyles.spinnerColor} />
      ) : (
        <View style={styles.contentRow}>
          {icon && <View style={styles.iconWrapper}>{icon}</View>}
          {!React.isValidElement(children) ? (
            <Text
              style={[
                styles.baseText,
                vStyles.text,
                sStyles.text,
                disabled && styles.disabledText,
                textStyle,
              ]}
            >
              {children}
            </Text>
          ) : (
            children
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  baseButton: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    marginRight: 6,
  },
  baseText: {
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  defaultContainer: {
    backgroundColor: '#8B1E1E', // Signature primary
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 2px 3px rgba(139, 30, 30, 0.15)' }
      : {
          shadowColor: '#8B1E1E',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 3,
          elevation: 2,
        }),
  },
  defaultText: {
    color: '#FFFFFF',
  },
  secondaryContainer: {
    backgroundColor: '#F1F5F9', // slate-100
  },
  secondaryText: {
    color: '#0F172A', // slate-900
  },
  destructiveContainer: {
    backgroundColor: '#DC2626', // red-600
  },
  destructiveText: {
    color: '#FFFFFF',
  },
  outlineContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0', // slate-200
  },
  outlineText: {
    color: '#0F172A',
  },
  ghostContainer: {
    backgroundColor: 'transparent',
  },
  ghostText: {
    color: '#334155',
  },
  linkContainer: {
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  linkText: {
    color: '#8B1E1E',
    textDecorationLine: 'underline',
  },
  defaultSizeContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 42,
  },
  defaultSizeText: {
    fontSize: 14,
  },
  smContainer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 32,
    borderRadius: 6,
  },
  smText: {
    fontSize: 12,
  },
  lgContainer: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    minHeight: 48,
    borderRadius: 10,
  },
  lgText: {
    fontSize: 15,
  },
  iconContainer: {
    width: 36,
    height: 36,
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
  disabledText: {
    color: '#94A3B8',
  },
});
