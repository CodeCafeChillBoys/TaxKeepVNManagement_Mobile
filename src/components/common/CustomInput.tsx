import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';

interface CustomInputProps extends TextInputProps {
  label?: string;
  required?: boolean;
  error?: string;
  helperText?: string;
  isPassword?: boolean;
  containerStyle?: object;
}

export const CustomInput: React.FC<CustomInputProps> = ({
  label,
  required = false,
  error,
  helperText,
  isPassword = false,
  containerStyle,
  style,
  ...rest
}) => {
  const [showPassword, setShowPassword] = useState(!isPassword);
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          {required ? <Text style={styles.requiredMark}> *</Text> : null}
        </View>
      ) : null}

      <View
        style={[
          styles.inputWrapper,
          isFocused && styles.inputWrapperFocused,
          error ? styles.inputWrapperError : null,
        ]}
      >
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={theme.colors.textPlaceholder}
          secureTextEntry={isPassword && !showPassword}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...rest}
        />

        {isPassword ? (
          <TouchableOpacity
            style={styles.eyeIcon}
            onPress={() => setShowPassword(!showPassword)}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          >
            <Ionicons
              name={showPassword ? 'eye-outline' : 'eye-off-outline'}
              size={20}
              color={theme.colors.textSecondary}
            />
          </TouchableOpacity>
        ) : null}
      </View>

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    marginBottom: 6,
    alignItems: 'center',
  },
  label: {
    ...theme.typography.fieldLabel,
    color: theme.colors.textPrimary,
  },
  requiredMark: {
    color: theme.colors.error,
    fontWeight: '700',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  inputWrapperFocused: {
    borderColor: theme.colors.borderFocus,
    borderWidth: 1.5,
    backgroundColor: '#FFFFFF',
  },
  inputWrapperError: {
    borderColor: theme.colors.error,
    backgroundColor: theme.colors.errorBackground,
  },
  input: {
    flex: 1,
    ...theme.typography.inputText,
    color: theme.colors.textPrimary,
    paddingVertical: 0,
  },
  eyeIcon: {
    padding: 6,
  },
  errorText: {
    ...theme.typography.caption,
    color: theme.colors.error,
    marginTop: 4,
    marginLeft: 2,
  },
  helperText: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginTop: 4,
    marginLeft: 2,
  },
});
