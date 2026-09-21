import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { VerifyPendingScreen } from '../screens/auth/VerifyPendingScreen';
import { HomeScreen } from '../screens/home/HomeScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { EditProfileScreen } from '../screens/profile/EditProfileScreen';
import { IncomeSourceListScreen } from '../screens/incomeSource/IncomeSourceListScreen';
import { ChangePasswordScreen } from '../screens/auth/ChangePasswordScreen';
import { LawConditionsScreen } from '../screens/home/LawConditionsScreen';
import { TaxRegistrationScreen } from '../screens/dependent/TaxRegistrationScreen';
import { ProofDocumentsScreen } from '../screens/dependent/ProofDocumentsScreen';
import { DependentListScreen } from '../screens/dependent/DependentListScreen';
import { ScanIdentityScreen } from '../screens/common/ScanIdentityScreen';
import { SettlementHomeScreen } from '../screens/settlement/SettlementHomeScreen';
import { SettlementReviewScreen } from '../screens/settlement/SettlementReviewScreen';
import { SettlementResultScreen } from '../screens/settlement/SettlementResultScreen';
import { useAuthStore } from '../stores/useAuthStore';
import { theme } from '../constants/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={isAuthenticated ? 'Home' : 'Login'}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="VerifyPending" component={VerifyPendingScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        <Stack.Screen name="IncomeSourceList" component={IncomeSourceListScreen} />
        <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
        <Stack.Screen name="LawConditions" component={LawConditionsScreen} />
        <Stack.Screen name="TaxRegistration" component={TaxRegistrationScreen} />
        <Stack.Screen name="ProofDocuments" component={ProofDocumentsScreen} />
        <Stack.Screen name="DependentList" component={DependentListScreen} />
        <Stack.Screen name="ScanIdentity" component={ScanIdentityScreen} />
        <Stack.Screen name="SettlementHome" component={SettlementHomeScreen} />
        <Stack.Screen name="SettlementReview" component={SettlementReviewScreen} />
        <Stack.Screen name="SettlementResult" component={SettlementResultScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
