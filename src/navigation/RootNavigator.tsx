import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { VerifyEmailScreen } from '../screens/auth/VerifyEmailScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { ResetPasswordScreen } from '../screens/auth/ResetPasswordScreen';
import { HomeScreen } from '../screens/home/HomeScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { SettingsScreen } from '../screens/profile/SettingsScreen';
import { EditProfileScreen } from '../screens/profile/EditProfileScreen';
import { IncomeSourceListScreen } from '../screens/incomeSource/IncomeSourceListScreen';
import { IncomeMonthFormScreen } from '../screens/income/IncomeMonthFormScreen';
import { WithholdingVoucherScreen } from '../screens/incomeSource/WithholdingVoucherScreen';
import { ChangePasswordScreen } from '../screens/auth/ChangePasswordScreen';
import { LawConditionsScreen } from '../screens/home/LawConditionsScreen';
import { TaxRegistrationScreen } from '../screens/dependent/TaxRegistrationScreen';
import { ProofDocumentsScreen } from '../screens/dependent/ProofDocumentsScreen';
import { DependentSavedScreen } from '../screens/dependent/DependentSavedScreen';
import { DependentListScreen } from '../screens/dependent/DependentListScreen';
import { ScanIdentityScreen } from '../screens/common/ScanIdentityScreen';
import { ExpenseListScreen } from '../screens/expense/ExpenseListScreen';
import { ExpenseUploadScreen } from '../screens/expense/ExpenseUploadScreen';
import { ExpenseReviewScreen } from '../screens/expense/ExpenseReviewScreen';
import { MedicalStatementScreen } from '../screens/expense/MedicalStatementScreen';
import { SettlementStartScreen } from '../screens/settlement/SettlementStartScreen';
import { SettlementPreviewScreen } from '../screens/settlement/SettlementPreviewScreen';
import { SettlementSuccessScreen } from '../screens/settlement/SettlementSuccessScreen';
import { SettlementListScreen } from '../screens/settlement/SettlementListScreen';
import { SettlementDetailScreen } from '../screens/settlement/SettlementDetailScreen';
import { SettlementExportFormScreen } from '../screens/settlement/SettlementExportFormScreen';
import { SettlementPdfViewerScreen } from '../screens/settlement/SettlementPdfViewerScreen';
import { SettlementZipReadyScreen } from '../screens/settlement/SettlementZipReadyScreen';
import { SettlementDownloadExpiredScreen } from '../screens/settlement/SettlementDownloadExpiredScreen';
import { TaxChatScreen } from '../screens/chat/TaxChatScreen';
import { TaxChatHistoryScreen } from '../screens/chat/TaxChatHistoryScreen';
import { ExpertListScreen } from '../screens/consultation/ExpertListScreen';
import { ExpertDetailScreen } from '../screens/consultation/ExpertDetailScreen';
import { BookingCreateScreen } from '../screens/consultation/BookingCreateScreen';
import { MyBookingsScreen } from '../screens/consultation/MyBookingsScreen';
import { BookingDetailScreen } from '../screens/consultation/BookingDetailScreen';
import { ConsultationChatScreen } from '../screens/consultation/ConsultationChatScreen';
import { ExpertBookingsScreen } from '../screens/consultation/ExpertBookingsScreen';
import { ExpertSlotsScreen } from '../screens/consultation/ExpertSlotsScreen';
import { ExpertApplicationScreen } from '../screens/consultation/ExpertApplicationScreen';
import { PaymentResultScreen } from '../screens/consultation/PaymentResultScreen';
import { WalletScreen } from '../screens/wallet/WalletScreen';
import { SubscriptionPlansScreen } from '../screens/subscription/SubscriptionPlansScreen';
import { SubscriptionCheckoutScreen } from '../screens/subscription/SubscriptionCheckoutScreen';
import { SubscriptionPaymentResultScreen } from '../screens/subscription/SubscriptionPaymentResultScreen';
import { SUBSCRIPTION_RETURN_PATH } from '../types/subscription';
import { SubscriptionMyScreen } from '../screens/subscription/SubscriptionMyScreen';
import { SubscriptionHistoryScreen } from '../screens/subscription/SubscriptionHistoryScreen';
import { UpgradePrompt } from '../components/subscription/UpgradePrompt';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '../stores/useAuthStore';
import { useThemeStore, DARK_COLORS, LIGHT_COLORS } from '../stores/useThemeStore';
import { theme } from '../constants/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

function withTheme<P extends object>(Component: React.ComponentType<P>): React.FC<P> {
  const ThemedScreen: React.FC<P> = (props) => {
    const mode = useThemeStore((s) => s.mode);
    return <Component {...props} data-theme={mode} />;
  };
  ThemedScreen.displayName = `WithTheme(${Component.displayName || Component.name || 'Screen'})`;
  return ThemedScreen;
}

const ThemedLoginScreen = withTheme(LoginScreen);
const ThemedRegisterScreen = withTheme(RegisterScreen);
const ThemedVerifyEmailScreen = withTheme(VerifyEmailScreen);
const ThemedForgotPasswordScreen = withTheme(ForgotPasswordScreen);
const ThemedResetPasswordScreen = withTheme(ResetPasswordScreen);
const ThemedHomeScreen = withTheme(HomeScreen);
const ThemedProfileScreen = withTheme(ProfileScreen);
const ThemedSettingsScreen = withTheme(SettingsScreen);
const ThemedEditProfileScreen = withTheme(EditProfileScreen);
const ThemedIncomeSourceListScreen = withTheme(IncomeSourceListScreen);
const ThemedIncomeMonthFormScreen = withTheme(IncomeMonthFormScreen);
const ThemedWithholdingVoucherScreen = withTheme(WithholdingVoucherScreen);
const ThemedChangePasswordScreen = withTheme(ChangePasswordScreen);
const ThemedLawConditionsScreen = withTheme(LawConditionsScreen);
const ThemedTaxRegistrationScreen = withTheme(TaxRegistrationScreen);
const ThemedProofDocumentsScreen = withTheme(ProofDocumentsScreen);
const ThemedDependentSavedScreen = withTheme(DependentSavedScreen);
const ThemedDependentListScreen = withTheme(DependentListScreen);
const ThemedScanIdentityScreen = withTheme(ScanIdentityScreen);
const ThemedExpenseListScreen = withTheme(ExpenseListScreen);
const ThemedExpenseUploadScreen = withTheme(ExpenseUploadScreen);
const ThemedExpenseReviewScreen = withTheme(ExpenseReviewScreen);
const ThemedMedicalStatementScreen = withTheme(MedicalStatementScreen);
const ThemedTaxChatScreen = withTheme(TaxChatScreen);
const ThemedTaxChatHistoryScreen = withTheme(TaxChatHistoryScreen);
const ThemedSettlementStartScreen = withTheme(SettlementStartScreen);
const ThemedSettlementPreviewScreen = withTheme(SettlementPreviewScreen);
const ThemedSettlementSuccessScreen = withTheme(SettlementSuccessScreen);
const ThemedSettlementListScreen = withTheme(SettlementListScreen);
const ThemedSettlementDetailScreen = withTheme(SettlementDetailScreen);
const ThemedSettlementExportFormScreen = withTheme(SettlementExportFormScreen);
const ThemedSettlementPdfViewerScreen = withTheme(SettlementPdfViewerScreen);
const ThemedSettlementZipReadyScreen = withTheme(SettlementZipReadyScreen);
const ThemedSettlementDownloadExpiredScreen = withTheme(SettlementDownloadExpiredScreen);
const ThemedExpertListScreen = withTheme(ExpertListScreen);
const ThemedExpertDetailScreen = withTheme(ExpertDetailScreen);
const ThemedBookingCreateScreen = withTheme(BookingCreateScreen);
const ThemedMyBookingsScreen = withTheme(MyBookingsScreen);
const ThemedBookingDetailScreen = withTheme(BookingDetailScreen);
const ThemedConsultationChatScreen = withTheme(ConsultationChatScreen);
const ThemedExpertBookingsScreen = withTheme(ExpertBookingsScreen);
const ThemedExpertSlotsScreen = withTheme(ExpertSlotsScreen);
const ThemedExpertApplicationScreen = withTheme(ExpertApplicationScreen);
const ThemedPaymentResultScreen = withTheme(PaymentResultScreen);
const ThemedWalletScreen = withTheme(WalletScreen);
const ThemedSubscriptionPlansScreen = withTheme(SubscriptionPlansScreen);
const ThemedSubscriptionCheckoutScreen = withTheme(SubscriptionCheckoutScreen);
const ThemedSubscriptionPaymentResultScreen = withTheme(SubscriptionPaymentResultScreen);
const ThemedSubscriptionMyScreen = withTheme(SubscriptionMyScreen);
const ThemedSubscriptionHistoryScreen = withTheme(SubscriptionHistoryScreen);

const tabScreenOptions = {
  animation: 'none' as const,
};

const linking = {
  prefixes: ['taxkeep://', 'fe://', 'exp://'],
  config: {
    screens: {
      VerifyEmail: 'verify-email',
      ForgotPassword: 'forgot-password',
      ResetPassword: 'reset-password',
      PaymentResult: 'payments/vnpay-return',
      SubscriptionPaymentResult: SUBSCRIPTION_RETURN_PATH,
      BookingDetail: 'bookings/:bookingId',
    },
  },
};

export const RootNavigator: React.FC = () => {
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore(
    useShallow((s) => ({
      isAuthenticated: s.isAuthenticated,
      isLoading: s.isLoading,
      checkAuth: s.checkAuth,
    }))
  );
  const isDark = useThemeStore((s) => s.isDark);
  const palette = isDark ? DARK_COLORS : LIGHT_COLORS;

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linking}
      onStateChange={() => {
        if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }}
    >
      <Stack.Navigator
        initialRouteName={isAuthenticated ? 'Home' : 'Login'}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: palette.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="Login" component={ThemedLoginScreen} />
        <Stack.Screen name="Register" component={ThemedRegisterScreen} />
        <Stack.Screen name="VerifyEmail" component={ThemedVerifyEmailScreen} />
        <Stack.Screen name="ForgotPassword" component={ThemedForgotPasswordScreen} />
        <Stack.Screen name="ResetPassword" component={ThemedResetPasswordScreen} />
        <Stack.Screen name="Home" component={ThemedHomeScreen} options={tabScreenOptions} />
        <Stack.Screen name="Profile" component={ThemedProfileScreen} options={tabScreenOptions} />
        <Stack.Screen name="Settings" component={ThemedSettingsScreen} options={tabScreenOptions} />
        <Stack.Screen name="EditProfile" component={ThemedEditProfileScreen} />
        <Stack.Screen name="IncomeSourceList" component={ThemedIncomeSourceListScreen} options={tabScreenOptions} />
        <Stack.Screen name="IncomeMonthForm" component={ThemedIncomeMonthFormScreen} />
        <Stack.Screen name="WithholdingVoucher" component={ThemedWithholdingVoucherScreen} />
        <Stack.Screen name="ChangePassword" component={ThemedChangePasswordScreen} />
        <Stack.Screen name="LawConditions" component={ThemedLawConditionsScreen} />
        <Stack.Screen name="TaxRegistration" component={ThemedTaxRegistrationScreen} />
        <Stack.Screen name="ProofDocuments" component={ThemedProofDocumentsScreen} />
        <Stack.Screen name="DependentSaved" component={ThemedDependentSavedScreen} />
        <Stack.Screen name="DependentList" component={ThemedDependentListScreen} options={tabScreenOptions} />
        <Stack.Screen name="ScanIdentity" component={ThemedScanIdentityScreen} />
        <Stack.Screen name="ExpenseList" component={ThemedExpenseListScreen} />
        <Stack.Screen name="ExpenseUpload" component={ThemedExpenseUploadScreen} />
        <Stack.Screen name="ExpenseReview" component={ThemedExpenseReviewScreen} />
        <Stack.Screen name="MedicalStatement" component={ThemedMedicalStatementScreen} />
        <Stack.Screen name="TaxChat" component={ThemedTaxChatScreen} />
        <Stack.Screen name="TaxChatHistory" component={ThemedTaxChatHistoryScreen} />
        <Stack.Screen name="SettlementStart" component={ThemedSettlementStartScreen} />
        <Stack.Screen name="SettlementPreview" component={ThemedSettlementPreviewScreen} />
        <Stack.Screen name="SettlementSuccess" component={ThemedSettlementSuccessScreen} />
        <Stack.Screen name="SettlementList" component={ThemedSettlementListScreen} />
        <Stack.Screen name="SettlementDetail" component={ThemedSettlementDetailScreen} />
        <Stack.Screen name="SettlementExportForm" component={ThemedSettlementExportFormScreen} />
        <Stack.Screen name="SettlementPdfViewer" component={ThemedSettlementPdfViewerScreen} />
        <Stack.Screen name="SettlementZipReady" component={ThemedSettlementZipReadyScreen} />
        <Stack.Screen name="SettlementDownloadExpired" component={ThemedSettlementDownloadExpiredScreen} />
        <Stack.Screen name="ExpertList" component={ThemedExpertListScreen} />
        <Stack.Screen name="ExpertDetail" component={ThemedExpertDetailScreen} />
        <Stack.Screen name="BookingCreate" component={ThemedBookingCreateScreen} />
        <Stack.Screen name="MyBookings" component={ThemedMyBookingsScreen} />
        <Stack.Screen name="BookingDetail" component={ThemedBookingDetailScreen} />
        <Stack.Screen name="ConsultationChat" component={ThemedConsultationChatScreen} />
        <Stack.Screen name="ExpertBookings" component={ThemedExpertBookingsScreen} />
        <Stack.Screen name="ExpertSlots" component={ThemedExpertSlotsScreen} />
        <Stack.Screen name="ExpertApplication" component={ThemedExpertApplicationScreen} />
        <Stack.Screen name="PaymentResult" component={ThemedPaymentResultScreen} />
        <Stack.Screen name="Wallet" component={ThemedWalletScreen} options={tabScreenOptions} />
        <Stack.Screen name="SubscriptionPlans" component={ThemedSubscriptionPlansScreen} />
        <Stack.Screen name="SubscriptionCheckout" component={ThemedSubscriptionCheckoutScreen} />
        <Stack.Screen name="SubscriptionPaymentResult" component={ThemedSubscriptionPaymentResultScreen} />
        <Stack.Screen name="SubscriptionMy" component={ThemedSubscriptionMyScreen} />
        <Stack.Screen name="SubscriptionHistory" component={ThemedSubscriptionHistoryScreen} />
      </Stack.Navigator>
      {isAuthenticated ? <UpgradePrompt navigationRef={navigationRef} /> : null}
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
