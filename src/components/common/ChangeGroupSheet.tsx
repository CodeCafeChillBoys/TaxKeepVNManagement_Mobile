import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { getGroupTitle } from '../../api/dependentDocumentApi';

export type ChangeGroupSheetProps = {
  visible: boolean;
  fullName: string;
  currentGroup: string;
  options: string[];
  loading?: boolean;
  onSelect: (groupCode: string) => void;
  onCancel: () => void;
};

/** Bottom sheet chọn nhóm NPT — đồng bộ palette TaxKeep (không dùng Alert hệ thống). */
export const ChangeGroupSheet: React.FC<ChangeGroupSheetProps> = ({
  visible,
  fullName,
  currentGroup,
  options,
  loading = false,
  onSelect,
  onCancel,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.scrim} onPress={loading ? undefined : onCancel}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <View style={styles.handle} />
          <Text style={styles.title}>Đổi nhóm điều kiện</Text>
          <Text style={styles.message}>
            Chọn nhóm mới cho{' '}
            <Text style={styles.nameEmph}>{fullName}</Text>
          </Text>
          <View style={styles.currentBox}>
            <Text style={styles.currentLabel}>Hiện tại</Text>
            <Text style={styles.currentValue}>{getGroupTitle(currentGroup)}</Text>
          </View>

          <ScrollView
            style={styles.optionsScroll}
            contentContainerStyle={styles.optionsContent}
            showsVerticalScrollIndicator={false}
          >
            {options.map((code) => (
              <TouchableOpacity
                key={code}
                style={[styles.optionCard, loading && styles.optionDisabled]}
                activeOpacity={0.85}
                disabled={loading}
                onPress={() => onSelect(code)}
                testID={`changeGroupOption_${code}`}
                accessibilityRole="button"
                accessibilityLabel={getGroupTitle(code)}
              >
                <View style={styles.optionIcon}>
                  <Ionicons name="people-outline" size={20} color={theme.colors.primary} />
                </View>
                <Text style={styles.optionTitle}>{getGroupTitle(code)}</Text>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            ))}
          </ScrollView>

          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={theme.colors.primary} />
              <Text style={styles.loadingText}>Đang chuyển nhóm…</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel="Hủy"
            >
              <Text style={styles.cancelBtnText}>Hủy</Text>
            </TouchableOpacity>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    maxHeight: '78%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  title: {
    ...theme.typography.titleMedium,
    color: theme.colors.primaryDark,
    fontWeight: '700',
    marginBottom: 8,
  },
  message: {
    ...theme.typography.bodyLarge,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  nameEmph: {
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  currentBox: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  currentLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  currentValue: {
    ...theme.typography.bodyMedium,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  optionsScroll: {
    flexGrow: 0,
  },
  optionsContent: {
    gap: 10,
    paddingBottom: 8,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  optionDisabled: {
    opacity: 0.55,
  },
  optionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTitle: {
    flex: 1,
    ...theme.typography.bodyMedium,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
  },
  loadingText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.textSecondary,
  },
  cancelBtn: {
    marginTop: 12,
    minHeight: 46,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    ...theme.typography.bodyMedium,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
});
