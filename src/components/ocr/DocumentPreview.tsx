import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';

interface DocumentPreviewProps {
  uri?: string | null;
  onPress: () => void;
}

export const DocumentPreview: React.FC<DocumentPreviewProps> = ({ uri, onPress }) => {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      style={styles.frame}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Phóng to ảnh căn cước"
    >
      {uri ? (
        <Image source={{ uri }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={styles.empty}>
          <Ionicons name="id-card-outline" size={42} color={theme.colors.gold} />
          <Text style={styles.emptyText}>Ảnh căn cước đã chụp</Text>
        </View>
      )}
      <View style={styles.zoomChip}>
        <Ionicons name="search" size={12} color={theme.colors.primaryDark} />
        <Text style={styles.zoomText}>Phóng to</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  frame: {
    height: 168,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: '#F0EAE1',
    borderWidth: 1,
    borderColor: '#E2DBD0',
    marginBottom: theme.spacing.md,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginTop: 8,
  },
  zoomChip: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(248, 245, 238, 0.94)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.goldLight,
  },
  zoomText: {
    ...theme.typography.caption,
    color: theme.colors.primaryDark,
    fontWeight: '700',
  },
});
