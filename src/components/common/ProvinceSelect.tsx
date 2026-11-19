import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { useThemeStore } from '../../stores/useThemeStore';
import {
  filterVietnamProvinces,
  matchVietnamProvince,
} from '../../constants/vietnamProvinces';

export interface ProvinceSelectProps {
  label?: string;
  required?: boolean;
  value?: string;
  placeholder?: string;
  error?: string;
  helperText?: string;
  onChange: (province: string) => void;
  onBlur?: () => void;
  containerStyle?: object;
}

export const ProvinceSelect: React.FC<ProvinceSelectProps> = React.memo(({
  label = 'Địa chỉ thường trú',
  required = false,
  value = '',
  placeholder = 'Chọn Tỉnh / Thành phố',
  error,
  helperText,
  onChange,
  onBlur,
  containerStyle,
}) => {
  const [visible, setVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  useThemeStore((s) => s.mode);

  const displayValue = useMemo(() => {
    if (!value) return '';
    return matchVietnamProvince(value) || value;
  }, [value]);

  const filteredProvinces = useMemo(
    () => filterVietnamProvinces(searchQuery),
    [searchQuery]
  );

  const handleOpen = useCallback(() => {
    setSearchQuery('');
    setVisible(true);
  }, []);

  const handleClose = useCallback(() => {
    setVisible(false);
    setSearchQuery('');
    onBlur?.();
  }, [onBlur]);

  const handleSelect = useCallback(
    (province: string) => {
      onChange(province);
      setVisible(false);
      setSearchQuery('');
      onBlur?.();
    },
    [onBlur, onChange]
  );

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          {required ? <Text style={styles.requiredMark}> *</Text> : null}
        </View>
      ) : null}

      <TouchableOpacity
        activeOpacity={0.75}
        style={[
          styles.selectBox,
          visible && styles.selectBoxFocused,
          error ? styles.selectBoxError : null,
        ]}
        onPress={handleOpen}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Text
          style={[
            styles.selectText,
            !displayValue && styles.placeholderText,
          ]}
          numberOfLines={1}
        >
          {displayValue || placeholder}
        </Text>
        <View style={styles.rightActions}>
          {displayValue ? (
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => onChange('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Xóa lựa chọn"
            >
              <Ionicons name="close-circle" size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
          <Ionicons
            name="chevron-down"
            size={18}
            color={theme.colors.textSecondary}
          />
        </View>
      </TouchableOpacity>

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <Pressable style={styles.backdrop} onPress={handleClose} />

          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Chọn Tỉnh / Thành phố</Text>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={handleClose}
                accessibilityRole="button"
                accessibilityLabel="Đóng"
              >
                <Ionicons name="close" size={22} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchBox}>
              <Ionicons
                name="search-outline"
                size={18}
                color={theme.colors.textSecondary}
                style={styles.searchIcon}
              />
              <TextInput
                style={styles.searchInput}
                placeholder="Tìm tỉnh, thành phố..."
                placeholderTextColor={theme.colors.textPlaceholder}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCorrect={false}
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons
                    name="close-circle"
                    size={18}
                    color={theme.colors.textSecondary}
                  />
                </TouchableOpacity>
              ) : null}
            </View>

            <FlatList
              data={filteredProvinces}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={styles.list}
              ListEmptyComponent={
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>
                    Không tìm thấy tỉnh/thành phố phù hợp.
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const isSelected = item === displayValue;
                return (
                  <TouchableOpacity
                    style={[
                      styles.optionRow,
                      isSelected && styles.optionRowSelected,
                    ]}
                    onPress={() => handleSelect(item)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        isSelected && styles.optionTextSelected,
                      ]}
                    >
                      {item}
                    </Text>
                    {isSelected ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={theme.colors.primary}
                      />
                    ) : null}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
});

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
  selectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  selectBoxFocused: {
    borderColor: theme.colors.borderFocus,
    borderWidth: 1.5,
  },
  selectBoxError: {
    borderColor: theme.colors.error,
    backgroundColor: theme.colors.errorBackground,
  },
  selectText: {
    flex: 1,
    ...theme.typography.inputText,
    color: theme.colors.textPrimary,
    marginRight: 8,
  },
  placeholderText: {
    color: theme.colors.textPlaceholder,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  clearBtn: {
    padding: 2,
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
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(28, 22, 16, 0.5)',
  },
  sheet: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '80%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  sheetTitle: {
    ...theme.typography.titleMedium,
    color: theme.colors.primaryDark,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    minHeight: 42,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    ...theme.typography.inputText,
    color: theme.colors.textPrimary,
    paddingVertical: 6,
  },
  list: {
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.sm,
  },
  optionRowSelected: {
    backgroundColor: theme.colors.surfaceSecondary,
  },
  optionText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.textPrimary,
  },
  optionTextSelected: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  emptyBox: {
    paddingVertical: 28,
    alignItems: 'center',
  },
  emptyText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.textSecondary,
  },
});

