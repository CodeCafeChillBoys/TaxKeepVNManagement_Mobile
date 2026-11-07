import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Platform,
} from 'react-native';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';

interface DialogProps {
  visible: boolean;
  title: string;
  message: string;
  /** Optional highlighted detail (vd. tên nhóm điều kiện, số tiền, khung giờ hẹn). */
  detail?: string;
  detailLabel?: string;
  primaryLabel: string;
  secondaryLabel?: string;
  onPrimary: () => void;
  onSecondary?: () => void;
  onRequestClose?: () => void;
  destructive?: boolean;
  testID?: string;
}

const NOOP = () => undefined;

export const Dialog: React.FC<DialogProps> = React.memo(({
  visible,
  title,
  message,
  detail,
  detailLabel,
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
  onRequestClose,
  destructive = false,
  testID,
}) => {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onRequestClose ?? onSecondary}
    >
      <Pressable style={styles.scrim} onPress={onRequestClose ?? onSecondary}>
        <Pressable
          style={styles.sheet}
          onPress={NOOP}
          testID={testID}
          accessibilityRole="summary"
        >
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          {detail ? (
            <View style={styles.detailBox}>
              {detailLabel ? (
                <Text style={styles.detailLabel}>{detailLabel}</Text>
              ) : null}
              <Text style={styles.detailValue}>{detail}</Text>
            </View>
          ) : null}
          <View style={styles.actions}>
            {secondaryLabel ? (
              <TouchableOpacity
                style={[styles.btn, styles.btnGhost]}
                onPress={onSecondary}
                accessibilityRole="button"
                accessibilityLabel={secondaryLabel}
              >
                <Text style={styles.btnGhostText}>{secondaryLabel}</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[styles.btn, destructive ? styles.btnDanger : styles.btnPrimary]}
              onPress={onPrimary}
              accessibilityRole="button"
              accessibilityLabel={primaryLabel}
            >
              <Text style={styles.btnPrimaryText}>{primaryLabel}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
});

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  sheet: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: theme.colors.surface,
    borderRadius: 18,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.2)' }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 10,
          elevation: 8,
        }),
  },
  title: {
    fontFamily: fonts.serifBold,
    fontSize: 19,
    lineHeight: 25,
    color: theme.colors.primaryDark,
    marginBottom: 8,
  },
  message: {
    ...theme.typography.body,
    fontSize: 14.5,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
    lineHeight: 22,
  },
  detailBox: {
    backgroundColor: theme.colors.warningBackground,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: '#F5C48A',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: theme.spacing.lg,
  },
  detailLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    lineHeight: 15,
    color: theme.colors.warning,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  detailValue: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textPrimary,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 10,
  },
  btn: {
    minHeight: 42,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 1,
  },
  btnGhost: {
    backgroundColor: theme.colors.surfaceSecondary,
  },
  btnGhostText: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    lineHeight: 19,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  btnPrimary: {
    backgroundColor: theme.colors.primary,
  },
  btnDanger: {
    backgroundColor: theme.colors.error,
  },
  btnPrimaryText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    lineHeight: 19,
    color: '#FFFFFF',
    textAlign: 'center',
  },
});
