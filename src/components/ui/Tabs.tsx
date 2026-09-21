import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, TextStyle, Platform} from 'react-native';

interface TabsContextType {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextType | null>(null);

interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  style?: ViewStyle;
}

export const Tabs: React.FC<TabsProps> = ({
  value,
  onValueChange,
  children,
  style,
}) => {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <View style={[styles.tabs, style]}>{children}</View>
    </TabsContext.Provider>
  );
};

interface TabsListProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const TabsList: React.FC<TabsListProps> = ({ children, style }) => {
  return <View style={[styles.tabsList, style]}>{children}</View>;
};

interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}

export const TabsTrigger: React.FC<TabsTriggerProps> = ({
  value,
  children,
  style,
  textStyle,
  icon,
  badge,
}) => {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error('TabsTrigger must be used within Tabs');
  }

  const isSelected = context.value === value;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => context.onValueChange(value)}
      style={[
        styles.tabsTrigger,
        isSelected && styles.tabsTriggerSelected,
        style,
      ]}
    >
      {icon && <View style={{ marginRight: 6 }}>{icon}</View>}
      {!React.isValidElement(children) ? (
        <Text
          style={[
            styles.tabsTriggerText,
            isSelected && styles.tabsTriggerTextSelected,
            textStyle,
          ]}
        >
          {children}
        </Text>
      ) : (
        children
      )}
      {badge && <View style={{ marginLeft: 6 }}>{badge}</View>}
    </TouchableOpacity>
  );
};

interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  style?: ViewStyle;
}

export const TabsContent: React.FC<TabsContentProps> = ({
  value,
  children,
  style,
}) => {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error('TabsContent must be used within Tabs');
  }

  if (context.value !== value) {
    return null;
  }

  return <View style={[styles.tabsContent, style]}>{children}</View>;
};

const styles = StyleSheet.create({
  tabs: {
    width: '100%',
  },
  tabsList: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9', // slate-100
    borderRadius: 10,
    padding: 3,
    alignItems: 'center',
  },
  tabsTrigger: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  tabsTriggerSelected: {
    backgroundColor: '#FFFFFF',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 1px 2px rgba(15, 23, 42, 0.1)' }
      : {
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.1,
          shadowRadius: 2,
          elevation: 2,
        }),
  },
  tabsTriggerText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B', // slate-500
  },
  tabsTriggerTextSelected: {
    color: '#0F172A', // slate-900
    fontWeight: '700',
  },
  tabsContent: {
    marginTop: 12,
  },
});
