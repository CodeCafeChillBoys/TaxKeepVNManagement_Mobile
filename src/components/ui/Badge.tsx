import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';

export type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline'
  | 'success'
  | 'warning'
  | 'info'
  | 'teal'
  | 'indigo';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  style,
  textStyle,
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'secondary':
        return {
          container: styles.secondaryContainer,
          text: styles.secondaryText,
        };
      case 'destructive':
        return {
          container: styles.destructiveContainer,
          text: styles.destructiveText,
        };
      case 'outline':
        return {
          container: styles.outlineContainer,
          text: styles.outlineText,
        };
      case 'success':
        return {
          container: styles.successContainer,
          text: styles.successText,
        };
      case 'warning':
        return {
          container: styles.warningContainer,
          text: styles.warningText,
        };
      case 'info':
        return {
          container: styles.infoContainer,
          text: styles.infoText,
        };
      case 'teal':
        return {
          container: styles.tealContainer,
          text: styles.tealText,
        };
      case 'indigo':
        return {
          container: styles.indigoContainer,
          text: styles.indigoText,
        };
      case 'default':
      default:
        return {
          container: styles.defaultContainer,
          text: styles.defaultText,
        };
    }
  };

  const vStyles = getVariantStyles();

  return (
    <View style={[styles.baseBadge, vStyles.container, style]}>
      <Text style={[styles.baseText, vStyles.text, textStyle]}>{children}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  baseBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  baseText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  defaultContainer: {
    backgroundColor: '#8B1E1E',
  },
  defaultText: {
    color: '#FFFFFF',
  },
  secondaryContainer: {
    backgroundColor: '#F1F5F9', // slate-100
  },
  secondaryText: {
    color: '#475569', // slate-600
  },
  destructiveContainer: {
    backgroundColor: '#FEE2E2', // red-100
  },
  destructiveText: {
    color: '#DC2626', // red-600
  },
  outlineContainer: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#CBD5E1', // slate-300
  },
  outlineText: {
    color: '#334155', // slate-700
  },
  successContainer: {
    backgroundColor: '#DCFCE7', // green-100
  },
  successText: {
    color: '#16A34A', // green-600
  },
  warningContainer: {
    backgroundColor: '#FEF3C7', // amber-100
  },
  warningText: {
    color: '#D97706', // amber-600
  },
  infoContainer: {
    backgroundColor: '#E0F2FE', // sky-100
  },
  infoText: {
    color: '#0284C7', // sky-600
  },
  tealContainer: {
    backgroundColor: '#CCFBF1', // teal-100
  },
  tealText: {
    color: '#0F766E', // teal-700
  },
  indigoContainer: {
    backgroundColor: '#E0E7FF', // indigo-100
  },
  indigoText: {
    color: '#4338CA', // indigo-700
  },
});
