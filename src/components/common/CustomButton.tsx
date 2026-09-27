import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  Platform,
} from 'react-native';
import { theme } from '../../constants/theme';

interface CustomButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'gold';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export const CustomButton: React.FC<CustomButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  textStyle,
  icon,
}) => {
  const isButtonDisabled = disabled || loading;

  const getButtonStyle = () => {
    switch (variant) {
      case 'gold':
        return styles.btnGold;
      case 'secondary':
        return styles.btnSecondary;
      case 'outline':
        return styles.btnOutline;
      case 'primary':
      default:
        return styles.btnPrimary;
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'gold':
        return styles.textGold;
      case 'secondary':
        return styles.textSecondary;
      case 'outline':
        return styles.textOutline;
      case 'primary':
      default:
        return styles.textPrimary;
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      style={[
        styles.button,
        getButtonStyle(),
        isButtonDisabled && styles.buttonDisabled,
        style,
      ]}
      onPress={onPress}
      disabled={isButtonDisabled}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'outline' ? theme.colors.primary : '#FFFFFF'}
        />
      ) : (
        <>
          {icon ? icon : null}
          <Text
            style={[
              styles.text,
              getTextStyle(),
              isButtonDisabled && styles.textDisabled,
              icon ? { marginLeft: 8 } : null,
              textStyle,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: theme.borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  btnPrimary: {
    backgroundColor: theme.colors.primary,
    ...theme.shadows.button,
  },
  btnGold: {
    backgroundColor: theme.colors.gold,
    ...theme.shadows.button,
  },
  btnSecondary: {
    backgroundColor: theme.colors.surfaceSecondary,
  },
  btnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
  },
  buttonDisabled: {
    backgroundColor: '#CCCCCC',
    borderColor: '#CCCCCC',
    ...(Platform.OS === 'web'
      ? { boxShadow: 'none' }
      : { shadowOpacity: 0, elevation: 0 }),
  },
  text: {
    ...theme.typography.buttonText,
    textAlign: 'center',
  },
  textPrimary: {
    color: '#FFFFFF',
  },
  textGold: {
    color: '#FFFFFF',
  },
  textSecondary: {
    color: theme.colors.textPrimary,
  },
  textOutline: {
    color: theme.colors.primary,
  },
  textDisabled: {
    color: '#888888',
  },
});
