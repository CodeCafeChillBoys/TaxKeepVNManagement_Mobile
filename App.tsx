import React from 'react';
import { LogBox, View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ToastProvider } from './src/components/ui/Toast';
import { AppUpdateModal } from './src/components/common/AppUpdateModal';
import { fontAssets, fonts } from './src/constants/fonts';
import { theme } from './src/constants/theme';
import { useThemeStore } from './src/stores/useThemeStore';

if (__DEV__) {
  LogBox.ignoreLogs(['Cannot connect to Expo CLI']);
}

export default function App() {
  const [fontsLoaded] = useFonts(fontAssets);
  const isDark = useThemeStore((s) => s.isDark);
  const loadTheme = useThemeStore((s) => s.loadTheme);

  React.useEffect(() => {
    void loadTheme();
  }, [loadTheme]);

  // Đồng bộ font chữ mặc định trên Web cho toàn bộ text/input không gắn StyleSheet
  React.useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const styleId = 'taxkeep-unified-font-style';
    if (document.getElementById(styleId)) return;
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = `
      html, body, input, textarea, button, select {
        font-family: '${fonts.body}', 'Be Vietnam Pro', -apple-system, BlinkMacSystemFont, sans-serif;
      }
    `;
    document.head.appendChild(styleEl);
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ToastProvider>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <RootNavigator />
        <AppUpdateModal />
      </ToastProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
});
