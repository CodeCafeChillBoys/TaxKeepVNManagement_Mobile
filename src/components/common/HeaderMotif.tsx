import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';

interface HeaderMotifProps {
  title: string;
  onBack?: () => void;
  showFlag?: boolean;
  style?: ViewStyle;
}

export const HeaderMotif: React.FC<HeaderMotifProps> = ({
  title,
  onBack,
  showFlag = true,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.topRow}>
        {onBack ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholder} />
        )}

        <Text style={styles.title}>{title}</Text>

        {showFlag ? (
          <View style={styles.flagBadge}>
            <View style={styles.flagRed}>
              <Text style={styles.flagStar}>★</Text>
            </View>
            <Ionicons name="chevron-down" size={14} color={theme.colors.textSecondary} />
          </View>
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>

      {/* Dải trang trí vàng hoàng gia */}
      <View style={styles.decorLine} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
    backgroundColor: 'transparent',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  backButton: {
    padding: 6,
    borderRadius: theme.borderRadius.full,
  },
  placeholder: {
    width: 36,
  },
  title: {
    ...theme.typography.titleMedium,
    color: theme.colors.primaryDark,
    textAlign: 'center',
    fontWeight: '700',
    flex: 1,
  },
  flagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surfaceSecondary,
    gap: 2,
  },
  flagRed: {
    width: 22,
    height: 15,
    backgroundColor: '#DA251D',
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flagStar: {
    color: '#FFFF00',
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: -1,
  },
  decorLine: {
    height: 2,
    backgroundColor: theme.colors.goldLight,
    marginTop: theme.spacing.sm,
    borderRadius: 1,
    opacity: 0.8,
  },
});
