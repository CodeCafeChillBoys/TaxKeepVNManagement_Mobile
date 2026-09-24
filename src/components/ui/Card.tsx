import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle, TextStyle, Platform } from 'react-native';
import { theme } from '../../constants/theme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const Card: React.FC<CardProps> = ({ children, style }) => {
  return <View style={[styles.card, style]}>{children}</View>;
};

export const CardHeader: React.FC<CardProps> = ({ children, style }) => {
  return <View style={[styles.cardHeader, style]}>{children}</View>;
};

interface CardTitleProps {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}

export const CardTitle: React.FC<CardTitleProps> = ({ children, style }) => {
  return <Text style={[styles.cardTitle, style]}>{children}</Text>;
};

export const CardDescription: React.FC<CardTitleProps> = ({ children, style }) => {
  return <Text style={[styles.cardDescription, style]}>{children}</Text>;
};

export const CardContent: React.FC<CardProps> = ({ children, style }) => {
  return <View style={[styles.cardContent, style]}>{children}</View>;
};

export const CardFooter: React.FC<CardProps> = ({ children, style }) => {
  return <View style={[styles.cardFooter, style]}>{children}</View>;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0', // Shadcn slate-200
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 1px 4px rgba(15, 23, 42, 0.05)' }
      : {
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
          elevation: 2,
        }),
    marginVertical: 6,
    overflow: 'hidden',
  },
  cardHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A', // Shadcn slate-900
    letterSpacing: -0.2,
  },
  cardDescription: {
    fontSize: 13,
    color: '#64748B', // Shadcn slate-500
    marginTop: 3,
    lineHeight: 18,
  },
  cardContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  cardFooter: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9', // Shadcn slate-100
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAFAFA',
  },
});
