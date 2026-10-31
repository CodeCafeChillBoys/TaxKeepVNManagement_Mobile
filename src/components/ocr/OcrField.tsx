import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { OcrFieldStatus } from '../../types/ocr';

interface OcrFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  onFocus?: () => void;
  status: OcrFieldStatus;
  placeholder?: string;
  unusedHint?: boolean;
  keyboardType?: 'default' | 'numeric';
}

export const OcrField: React.FC<OcrFieldProps> = ({
  label,
  value,
  onChangeText,
  onFocus,
  status,
  placeholder,
  unusedHint,
  keyboardType = 'default',
}) => {
  const isCheck = status === 'check';
  const isUnreadable = status === 'unreadable';

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {isCheck ? (
          <View style={styles.badge}>
            <Ionicons name="warning" size={12} color={theme.colors.warning} />
            <Text style={styles.badgeText}>Cần kiểm tra</Text>
          </View>
        ) : null}
      </View>

      <TextInput
        style={[
          styles.input,
          isCheck && styles.inputCheck,
          isUnreadable && styles.inputUnreadable,
        ]}
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textPlaceholder}
        keyboardType={keyboardType}
      />

      {isUnreadable ? (
        <Text style={styles.unreadableHint}>Không đọc được, vui lòng nhập tay</Text>
      ) : null}
      {unusedHint ? (
        <Text style={styles.unusedHint}>Không dùng trong luồng đăng ký</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 14,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: {
    ...theme.typography.bodyMedium,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    flex: 1,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.warningBackground,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: {
    ...theme.typography.caption,
    color: theme.colors.warning,
    fontWeight: '700',
  },
  input: {
    minHeight: 50,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1.2,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 14,
    ...theme.typography.bodyLarge,
    color: theme.colors.textPrimary,
  },
  inputCheck: {
    backgroundColor: theme.colors.warningBackground,
    borderColor: theme.colors.gold,
  },
  inputUnreadable: {
    borderColor: theme.colors.warning,
    backgroundColor: '#FFF8F0',
  },
  unreadableHint: {
    ...theme.typography.caption,
    color: theme.colors.warning,
    marginTop: 4,
  },
  unusedHint: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
});
