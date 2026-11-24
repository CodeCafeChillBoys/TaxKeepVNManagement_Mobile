import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';

interface CatalogErrorBannerProps {
  message: string;
  loading?: boolean;
  onRetry: () => void;
}

/** Báo lỗi tải danh mục quan hệ / nhóm NPT kèm nút thử lại. */
export const CatalogErrorBanner: React.FC<CatalogErrorBannerProps> = ({ message, loading, onRetry }) => (
  <View style={styles.box} testID="catalogErrorBanner">
    <Ionicons name="cloud-offline-outline" size={18} color={theme.colors.error} style={styles.icon} />
    <Text style={styles.text}>{message}</Text>
    <TouchableOpacity
      style={styles.retryBtn}
      onPress={onRetry}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel="Thử lại tải danh mục"
      testID="catalogRetryBtn"
    >
      {loading ? (
        <ActivityIndicator size="small" color={theme.colors.primary} />
      ) : (
        <Text style={styles.retryText}>Thử lại</Text>
      )}
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    backgroundColor: '#FDECEC',
    borderColor: '#F5C2C2',
    marginBottom: 12,
  },
  icon: {
    marginRight: 8,
  },
  text: {
    flex: 1,
    ...theme.typography.bodySmall,
    color: theme.colors.textPrimary,
    lineHeight: 18,
  },
  retryBtn: {
    marginLeft: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 64,
    alignItems: 'center',
  },
  retryText: {
    ...theme.typography.bodySmall,
    color: theme.colors.primary,
    fontWeight: '700',
  },
});
