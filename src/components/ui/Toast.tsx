import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export type ToastVariant = 'default' | 'destructive' | 'success' | 'warning' | 'info';

export interface ToastOptions {
  title?: string;
  description: string;
  variant?: ToastVariant;
  duration?: number;
  actionText?: string;
  onAction?: () => void;
}

interface ToastInternalItem extends ToastOptions {
  id: string;
}

interface ToastContextType {
  toast: {
    show: (options: ToastOptions) => void;
    error: (description: string, title?: string) => void;
    success: (description: string, title?: string) => void;
    warning: (description: string, title?: string) => void;
    info: (description: string, title?: string) => void;
    dismiss: (id?: string) => void;
  };
}

const ToastContext = createContext<ToastContextType | null>(null);

// Global static reference for calling outside React tree if needed
let globalToastRef: ToastContextType['toast'] | null = null;

export const globalToast = {
  show: (options: ToastOptions) => globalToastRef?.show(options),
  error: (description: string, title?: string) => globalToastRef?.error(description, title),
  success: (description: string, title?: string) => globalToastRef?.success(description, title),
  warning: (description: string, title?: string) => globalToastRef?.warning(description, title),
  info: (description: string, title?: string) => globalToastRef?.info(description, title),
  dismiss: (id?: string) => globalToastRef?.dismiss(id),
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastInternalItem[]>([]);
  const insets = useSafeAreaInsets();

  const dismiss = useCallback((id?: string) => {
    setToasts((prev) => (id ? prev.filter((t) => t.id !== id) : []));
  }, []);

  const show = useCallback((options: ToastOptions) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newItem: ToastInternalItem = { ...options, id };
    setToasts((prev) => [...prev.slice(-2), newItem]); // Max 2 toasts stacked
  }, []);

  const error = useCallback((description: string, title: string = 'Đã có lỗi xảy ra') => {
    show({ description, title, variant: 'destructive', duration: 4500 });
  }, [show]);

  const success = useCallback((description: string, title: string = 'Thành công') => {
    show({ description, title, variant: 'success', duration: 3500 });
  }, [show]);

  const warning = useCallback((description: string, title: string = 'Lưu ý') => {
    show({ description, title, variant: 'warning', duration: 4000 });
  }, [show]);

  const info = useCallback((description: string, title?: string) => {
    show({ description, title, variant: 'info', duration: 3500 });
  }, [show]);

  const toastMethods = { show, error, success, warning, info, dismiss };
  globalToastRef = toastMethods;

  return (
    <ToastContext.Provider value={{ toast: toastMethods }}>
      {children}
      <View
        pointerEvents="box-none"
        style={[
          styles.container,
          { top: Math.max(insets.top, 12) + 6 },
        ]}
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </View>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return { toast: globalToast };
  }
  return ctx;
};

// Internal Shadcn Toast Component
const ToastCard: React.FC<{ item: ToastInternalItem; onDismiss: () => void }> = ({ item, onDismiss }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        friction: 8,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      handleClose();
    }, item.duration || 4000);

    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -14,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  };

  const getVariantConfig = () => {
    switch (item.variant) {
      case 'destructive':
        return {
          icon: 'alert-circle' as const,
          iconColor: '#DC2626',
          bg: '#FEF2F2',
          border: '#FECACA',
          titleColor: '#991B1B',
          descColor: '#7F1D1D',
        };
      case 'success':
        return {
          icon: 'checkmark-circle' as const,
          iconColor: '#16A34A',
          bg: '#F0FDF4',
          border: '#BBF7D0',
          titleColor: '#166534',
          descColor: '#14532D',
        };
      case 'warning':
        return {
          icon: 'warning' as const,
          iconColor: '#D97706',
          bg: '#FFFBEB',
          border: '#FDE68A',
          titleColor: '#92400E',
          descColor: '#78350F',
        };
      case 'info':
        return {
          icon: 'information-circle' as const,
          iconColor: '#0284C7',
          bg: '#F0F9FF',
          border: '#BAE6FD',
          titleColor: '#075985',
          descColor: '#0C4A6E',
        };
      case 'default':
      default:
        return {
          icon: 'notifications' as const,
          iconColor: '#475569',
          bg: '#FFFFFF',
          border: '#E2E8F0',
          titleColor: '#0F172A',
          descColor: '#334155',
        };
    }
  };

  const config = getVariantConfig();

  return (
    <Animated.View
      style={[
        styles.toastWrapper,
        {
          backgroundColor: config.bg,
          borderColor: config.border,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={styles.iconCol}>
        <Ionicons name={config.icon} size={20} color={config.iconColor} />
      </View>
      <View style={styles.textCol}>
        {item.title ? (
          <Text style={[styles.title, { color: config.titleColor }]}>
            {item.title}
          </Text>
        ) : null}
        <Text style={[styles.description, { color: config.descColor }]}>
          {item.description}
        </Text>
        {item.actionText && item.onAction ? (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => {
              item.onAction?.();
              handleClose();
            }}
          >
            <Text style={[styles.actionBtnText, { color: config.titleColor }]}>
              {item.actionText}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <TouchableOpacity
        style={styles.closeBtn}
        onPress={handleClose}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="close" size={16} color={config.iconColor} />
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 99999,
    alignItems: 'center',
    gap: 8,
  },
  toastWrapper: {
    width: '100%',
    maxWidth: 520,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 4px 16px rgba(15, 23, 42, 0.12)' }
      : {
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.12,
          shadowRadius: 10,
          elevation: 6,
        }),
  },
  iconCol: {
    marginRight: 10,
    marginTop: 1,
  },
  textCol: {
    flex: 1,
    paddingRight: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
    letterSpacing: -0.1,
  },
  description: {
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '500',
  },
  actionBtn: {
    marginTop: 6,
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 2,
    marginTop: 1,
  },
});
