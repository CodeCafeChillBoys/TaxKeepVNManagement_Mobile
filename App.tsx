import React from 'react';
import { LogBox, View, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ToastProvider } from './src/components/ui/Toast';
import { fontAssets } from './src/constants/fonts';
import { theme } from './src/constants/theme';

LogBox.ignoreLogs(['Cannot connect to Expo CLI']);

export default function App() {
  const [fontsLoaded] = useFonts(fontAssets);

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
        <StatusBar style="dark" />
        <RootNavigator />
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
