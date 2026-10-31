import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';

interface InfoNoteProps {
  text: string;
  tone?: 'privacy' | 'review';
}

export const InfoNote: React.FC<InfoNoteProps> = ({ text, tone = 'privacy' }) => {
  const isReview = tone === 'review';
  return (
    <View style={[styles.box, isReview ? styles.boxReview : styles.boxPrivacy]}>
      <Ionicons
        name={isReview ? 'alert-circle-outline' : 'information-circle-outline'}
        size={18}
        color={isReview ? theme.colors.warning : theme.colors.primary}
        style={styles.icon}
      />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
  },
  boxPrivacy: {
    backgroundColor: '#FAF0E8',
    borderColor: '#E8D8CA',
  },
  boxReview: {
    backgroundColor: theme.colors.warningBackground,
    borderColor: theme.colors.goldLight,
  },
  icon: {
    marginRight: 8,
    marginTop: 1,
  },
  text: {
    flex: 1,
    ...theme.typography.bodySmall,
    color: theme.colors.textPrimary,
    lineHeight: 18,
  },
});
