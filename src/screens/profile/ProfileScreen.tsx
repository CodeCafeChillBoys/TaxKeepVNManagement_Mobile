import React, { useState, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { profileApi, UserProfileResponse } from '../../api/profileApi';
import { RootNavigationProp } from '../../navigation/types';
import { useAuthStore } from '../../stores/useAuthStore';
import { MainTabBar } from '../../components/navigation/MainTabBar';
import { DrumHeader } from '../../components/brand/DrumHeader';
import { GoldDoubleRule } from '../../components/brand/GoldDoubleRule';
import { formatPersonName } from '../../utils/formatPersonName';
import { Dialog } from '../../components/common/Dialog';
import { toFriendlyErrorMessage } from '../../utils/friendlyError';

const Field = memo(function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value || 'Chưa cập nhật'}</Text>
    </View>
  );
});

const LinkRow = memo(function LinkRow({
  label,
  onPress,
  testID,
  last,
}: {
  label: string;
  onPress: () => void;
  testID: string;
  last?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.linkRow, last && styles.linkRowLast]}
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
    >
      <Text style={styles.linkLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color="#999999" />
    </TouchableOpacity>
  );
});

export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const logout = useAuthStore((s) => s.logout);
  const authUser = useAuthStore((s) => s.user);
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showLogoutDialog, setShowLogoutDialog] = useState<boolean>(false);

  const currentRole = (profile?.userRole || authUser?.role || '').toLowerCase();
  const isExpert = currentRole === 'expert' || currentRole.includes('expert');

  const handleLogout = useCallback(() => {
    setShowLogoutDialog(true);
  }, []);

  const handleConfirmLogout = useCallback(async () => {
    setShowLogoutDialog(false);
    try {
      await logout();
    } catch (e) {
      if (__DEV__) {
        console.warn('Logout error:', e);
      }
    } finally {
      navigation.replace('Login');
    }
  }, [logout, navigation]);

  const fetchProfile = useCallback(async (isPullRefresh = false, isAlive?: () => boolean) => {
    try {
      if (isPullRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      const data = await profileApi.getProfile();
      if (isAlive && !isAlive()) return;
      setProfile(data);
      const currentAuthUser = useAuthStore.getState().user;
      if (data?.userRole && currentAuthUser && currentAuthUser.role !== data.userRole) {
        useAuthStore.setState({
          user: {
            ...currentAuthUser,
            role: data.userRole,
          },
        });
      }
    } catch (err: any) {
      if (isAlive && !isAlive()) return;
      const fallbackUser = useAuthStore.getState().user;
      if (fallbackUser) {
        setProfile({
          userId: fallbackUser.id,
          citizenId: fallbackUser.citizenId,
          fullName: fallbackUser.fullName,
          email: fallbackUser.email,
          userRole: fallbackUser.role || 'TAXPAYER',
          isVerified: true,
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } else {
        setError(toFriendlyErrorMessage(err, 'Không thể tải thông tin hồ sơ cá nhân.'));
      }
    } finally {
      if (!isAlive || isAlive()) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void fetchProfile(false, () => alive);
      return () => {
        alive = false;
      };
    }, [fetchProfile])
  );

  const handleEdit = useCallback(
    (autoFocusTaxId = false) => {
      navigation.navigate('EditProfile', { autoFocusTaxId });
    },
    [navigation]
  );

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Home');
  }, [navigation]);

  const displayName = formatPersonName(profile?.fullName) || 'Người nộp thuế';

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <DrumHeader title="Tài khoản" onBack={goBack} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Đang tải hồ sơ...</Text>
        </View>
        <MainTabBar active="Profile" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <DrumHeader
        title="Tài khoản"
        onBack={goBack}
        right={
          <TouchableOpacity
            style={styles.editHeaderBtn}
            onPress={() => handleEdit(false)}
            accessibilityRole="button"
            accessibilityLabel="Chỉnh sửa hồ sơ"
          >
            <Text style={styles.editHeaderText}>Sửa</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void fetchProfile(true)}
            colors={[theme.colors.primary]}
          />
        }
      >
        <View style={styles.contentWrap}>
          <Text style={styles.heroName}>{displayName}</Text>
          <Text style={styles.heroStatus}>
            {profile?.isVerified ? 'Đã xác thực' : 'Chưa xác thực'}
          </Text>
          {error ? <Text style={styles.warningSubtitle}>{error}</Text> : null}
          {!profile?.isVerified ? (
            <Text style={styles.warningSubtitle}>
              Một số tính năng sẽ bị hạn chế đến khi tài khoản được xác thực.
            </Text>
          ) : null}
          <GoldDoubleRule style={styles.rule} />

          <Text style={styles.sectionTitle}>Cá nhân</Text>
          <Field label="Họ và tên" value={displayName} />
          <Field label="Số căn cước" value={profile?.citizenId} />
          <Field label="Ngày sinh" value={profile?.dateOfBirth} />
          <Field label="Địa chỉ" value={profile?.address} />

          <Text style={styles.sectionTitle}>Tài khoản</Text>
          <Field label="Email" value={profile?.email} />
          <Field label="Số điện thoại" value={profile?.phoneNumber} />
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Mã số thuế</Text>
            {profile?.taxIdNumber ? (
              <Text style={styles.fieldValue}>{profile.taxIdNumber}</Text>
            ) : (
              <TouchableOpacity
                onPress={() => handleEdit(true)}
                accessibilityRole="button"
                accessibilityLabel="Bổ sung mã số thuế"
              >
                <Text style={styles.link}>Bổ sung</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.sectionTitle}>Tư vấn & Chuyên gia</Text>
          <LinkRow
            label="Lịch hẹn tư vấn của tôi"
            onPress={() => navigation.navigate('MyBookings', {})}
            testID="quickLinkMyBookings"
          />
          {isExpert ? (
            <>
              <LinkRow
                label="Quản lý ca tư vấn (Chuyên gia)"
                onPress={() => navigation.navigate('ExpertBookings', {})}
                testID="quickLinkExpertBookings"
              />
              <LinkRow
                label="Ví điện tử TaxKeep"
                onPress={() => navigation.navigate('Wallet', { walletType: 'EXPERT' })}
                testID="quickLinkExpertWallet"
              />
              <LinkRow
                label="Lịch làm việc của chuyên gia"
                onPress={() => navigation.navigate('ExpertSlots')}
                testID="quickLinkExpertSlots"
              />
            </>
          ) : (
            <LinkRow
              label="Ví điện tử TaxKeep"
              onPress={() => navigation.navigate('Wallet', { walletType: 'USER' })}
              testID="quickLinkUserWallet"
            />
          )}
          <LinkRow
            label={isExpert ? 'Hồ sơ chuyên gia thuế' : 'Đăng ký làm chuyên gia thuế'}
            onPress={() => navigation.navigate('ExpertApplication')}
            testID="quickLinkExpertApplication"
          />

          <Text style={styles.sectionTitle}>Liên kết</Text>
          <LinkRow
            label="Gói của tôi"
            onPress={() => navigation.navigate('SubscriptionMy')}
            testID="quickLinkSubscriptionMy"
          />
          <LinkRow
            label="Đổi mật khẩu"
            onPress={() => navigation.navigate('ChangePassword')}
            testID="quickLinkChangePassword"
          />
          <LinkRow
            label="Người phụ thuộc"
            onPress={() => navigation.navigate('DependentList')}
            testID="quickLinkDependentList"
          />
          <LinkRow
            label="Nơi chi trả"
            onPress={() => navigation.navigate('IncomeSourceList')}
            testID="quickLinkIncomeSource"
            last
          />

          <TouchableOpacity
            style={styles.primaryEditBtn}
            activeOpacity={0.85}
            onPress={() => handleEdit(false)}
            accessibilityRole="button"
            accessibilityLabel="Chỉnh sửa hồ sơ"
          >
            <Text style={styles.primaryEditBtnText}>Chỉnh sửa hồ sơ</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.logoutBtn}
            activeOpacity={0.85}
            onPress={handleLogout}
            accessibilityRole="button"
            accessibilityLabel="Đăng xuất"
            testID="profileLogoutBtn"
          >
            <Text style={styles.logoutBtnText}>Đăng xuất</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      <MainTabBar active="Profile" />

      <Dialog
        visible={showLogoutDialog}
        title="Đăng xuất khỏi tài khoản?"
        message="Phiên làm việc trên thiết bị này sẽ kết thúc. Bạn có thể đăng nhập lại bất cứ lúc nào."
        detailLabel="Tài khoản"
        detail={displayName}
        primaryLabel="Đăng xuất"
        secondaryLabel="Ở lại"
        destructive
        onPrimary={handleConfirmLogout}
        onSecondary={() => setShowLogoutDialog(false)}
        onRequestClose={() => setShowLogoutDialog(false)}
        testID="profileLogoutConfirmDialog"
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  editHeaderBtn: {
    minWidth: 44,
    height: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 4,
  },
  editHeaderText: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.primary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.textSecondary,
    marginTop: 12,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 40,
  },
  contentWrap: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  heroName: {
    fontFamily: fonts.serifBold,
    fontSize: 26,
    lineHeight: 32,
    color: theme.colors.primaryDark,
    textAlign: 'center',
  },
  heroStatus: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: '#5A4A22',
    textAlign: 'center',
    marginTop: 4,
  },
  warningSubtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.primary,
    textAlign: 'center',
    marginTop: 8,
  },
  rule: {
    marginTop: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 18,
    lineHeight: 24,
    color: theme.colors.textPrimary,
    marginTop: 18,
    marginBottom: 4,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  fieldLabel: {
    width: 112,
    flexShrink: 0,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textSecondary,
  },
  fieldValue: {
    flex: 1,
    flexShrink: 1,
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textPrimary,
    textAlign: 'right',
  },
  link: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.primary,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  linkRowLast: {
    borderBottomWidth: 0,
  },
  linkLabel: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.textPrimary,
  },
  primaryEditBtn: {
    minHeight: 52,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
    paddingHorizontal: 16,
  },
  primaryEditBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    lineHeight: 20,
    color: '#FFFFFF',
  },
  logoutBtn: {
    alignItems: 'center',
    paddingVertical: 16,
    cursor: Platform.OS === 'web' ? ('pointer' as any) : undefined,
  },
  logoutBtnText: {
    fontFamily: fonts.bodySemi,
    fontSize: 15,
    lineHeight: 20,
    color: theme.colors.error,
  },
});
