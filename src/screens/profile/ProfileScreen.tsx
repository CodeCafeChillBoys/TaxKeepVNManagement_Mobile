import React, { useState, useCallback, useEffect, memo } from 'react';
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
import { useNavigation, useRoute, useFocusEffect, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { profileApi, UserProfileResponse } from '../../api/profileApi';
import { RootNavigationProp, RootStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../stores/useAuthStore';
import { useThemeStore, DARK_COLORS, LIGHT_COLORS } from '../../stores/useThemeStore';
import { MainTabBar } from '../../components/navigation/MainTabBar';
import { DrumHeader } from '../../components/brand/DrumHeader';
import { GoldDoubleRule } from '../../components/brand/GoldDoubleRule';
import { formatPersonName } from '../../utils/formatPersonName';
import { Dialog } from '../../components/common/Dialog';
import { toFriendlyErrorMessage } from '../../utils/friendlyError';
import { sanitizeProfileAddress } from '../../constants/vietnamProvinces';

type ProfileTab = 'personal' | 'settings';

const Field = memo(function Field({
  label,
  value,
  isDark,
}: {
  label: string;
  value?: string | null;
  isDark?: boolean;
}) {
  const palette = isDark ? DARK_COLORS : LIGHT_COLORS;
  return (
    <View style={[styles.fieldRow, { borderBottomColor: palette.border }]}>
      <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>{label}</Text>
      <Text style={[styles.fieldValue, { color: palette.textPrimary }]}>
        {value || 'Chưa cập nhật'}
      </Text>
    </View>
  );
});

const LinkRow = memo(function LinkRow({
  label,
  icon,
  onPress,
  testID,
  last,
  isDark,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  testID: string;
  last?: boolean;
  isDark?: boolean;
}) {
  const palette = isDark ? DARK_COLORS : LIGHT_COLORS;
  return (
    <TouchableOpacity
      style={[
        styles.linkRow,
        { borderBottomColor: palette.border },
        last && styles.linkRowLast,
      ]}
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
    >
      <View style={styles.linkLeft}>
        {icon ? (
          <View
            style={[
              styles.linkIconBox,
              { backgroundColor: isDark ? '#2A2622' : '#F5EFE6' },
            ]}
          >
            <Ionicons name={icon} size={18} color={palette.primary} />
          </View>
        ) : null}
        <Text style={[styles.linkLabel, { color: palette.textPrimary }]}>{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={palette.textSecondary} />
    </TouchableOpacity>
  );
});

export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'Profile'>>();
  const logout = useAuthStore((s) => s.logout);
  const authUser = useAuthStore((s) => s.user);
  const { mode: themeMode, isDark, setMode } = useThemeStore();
  const palette = isDark ? DARK_COLORS : LIGHT_COLORS;

  const [activeTab, setActiveTab] = useState<ProfileTab>(
    route.params?.initialTab ?? 'settings'
  );
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showLogoutDialog, setShowLogoutDialog] = useState<boolean>(false);

  useEffect(() => {
    if (route.params?.initialTab) {
      setActiveTab(route.params.initialTab);
    }
  }, [route.params?.initialTab]);

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
  const headerTitle = activeTab === 'personal' ? 'Cá nhân' : 'Cài đặt';

  if (loading && !refreshing) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: palette.background }]}
        edges={['top', 'left', 'right']}
      >
        <DrumHeader title={headerTitle} onBack={goBack} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={palette.primary} />
          <Text style={[styles.loadingText, { color: palette.textSecondary }]}>
            Đang tải hồ sơ...
          </Text>
        </View>
        <MainTabBar active="Profile" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.background }]}
      edges={['top', 'left', 'right']}
    >
      <DrumHeader
        title={headerTitle}
        onBack={goBack}
        right={
          <TouchableOpacity
            style={styles.editHeaderBtn}
            onPress={() => handleEdit(false)}
            accessibilityRole="button"
            accessibilityLabel="Chỉnh sửa hồ sơ"
          >
            <Text style={[styles.editHeaderText, { color: palette.primary }]}>Sửa</Text>
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
            colors={[palette.primary]}
          />
        }
      >
        <View style={styles.contentWrap}>
          <Text style={[styles.heroName, { color: palette.primaryDark }]}>{displayName}</Text>
          <Text style={[styles.heroStatus, { color: isDark ? palette.gold : '#5A4A22' }]}>
            {profile?.isVerified ? 'Đã xác thực' : 'Chưa xác thực'}
          </Text>
          {error ? (
            <Text style={[styles.warningSubtitle, { color: palette.primary }]}>{error}</Text>
          ) : null}
          {!profile?.isVerified ? (
            <Text style={[styles.warningSubtitle, { color: palette.primary }]}>
              Một số tính năng sẽ bị hạn chế đến khi tài khoản được xác thực.
            </Text>
          ) : null}
          <GoldDoubleRule style={styles.rule} />

          {/* ── Bộ chuyển đổi 2 Tab riêng biệt: Cá nhân | Cài đặt ── */}
          <View
            style={[
              styles.tabSwitchContainer,
              {
                backgroundColor: isDark ? '#1F1C19' : '#EFEBE2',
                borderColor: palette.border,
              },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.tabSwitchBtn,
                activeTab === 'personal' && [
                  styles.tabSwitchBtnActive,
                  { backgroundColor: palette.primary },
                ],
              ]}
              activeOpacity={0.85}
              onPress={() => setActiveTab('personal')}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === 'personal' }}
              testID="profileTabPersonal"
            >
              <Ionicons
                name="person-outline"
                size={16}
                color={activeTab === 'personal' ? '#FFFFFF' : palette.textSecondary}
              />
              <Text
                style={[
                  styles.tabSwitchText,
                  { color: activeTab === 'personal' ? '#FFFFFF' : palette.textSecondary },
                ]}
              >
                Cá nhân
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabSwitchBtn,
                activeTab === 'settings' && [
                  styles.tabSwitchBtnActive,
                  { backgroundColor: palette.primary },
                ],
              ]}
              activeOpacity={0.85}
              onPress={() => setActiveTab('settings')}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === 'settings' }}
              testID="profileTabSettings"
            >
              <Ionicons
                name="settings-outline"
                size={16}
                color={activeTab === 'settings' ? '#FFFFFF' : palette.textSecondary}
              />
              <Text
                style={[
                  styles.tabSwitchText,
                  { color: activeTab === 'settings' ? '#FFFFFF' : palette.textSecondary },
                ]}
              >
                Cài đặt
              </Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'personal' ? (
            <>
              {/* ── TAB CÁ NHÂN ── */}
              <View
                style={[
                  styles.cardBlock,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                  },
                ]}
              >
                <Field label="Họ và tên:" value={displayName} isDark={isDark} />
                <Field label="Số căn cước:" value={profile?.citizenId} isDark={isDark} />
                <Field label="Ngày sinh:" value={profile?.dateOfBirth} isDark={isDark} />
                <Field
                  label="Địa chỉ:"
                  value={sanitizeProfileAddress(profile?.address, profile?.citizenId)}
                  isDark={isDark}
                />
                <Field label="Email:" value={profile?.email} isDark={isDark} />
                <Field label="Số điện thoại:" value={profile?.phoneNumber} isDark={isDark} />
                <View style={[styles.fieldRow, styles.linkRowLast]}>
                  <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>
                    Mã số thuế:
                  </Text>
                  {profile?.taxIdNumber ? (
                    <Text style={[styles.fieldValue, { color: palette.textPrimary }]}>
                      {profile.taxIdNumber}
                    </Text>
                  ) : (
                    <TouchableOpacity
                      onPress={() => handleEdit(true)}
                      accessibilityRole="button"
                      accessibilityLabel="Bổ sung mã số thuế"
                    >
                      <Text style={[styles.link, { color: palette.primary }]}>Bổ sung</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>Tiện ích</Text>
              <View
                style={[
                  styles.cardBlock,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                  },
                ]}
              >
                <LinkRow
                  label="Người phụ thuộc"
                  icon="people-outline"
                  onPress={() => navigation.navigate('DependentList')}
                  testID="quickLinkDependentList"
                  isDark={isDark}
                />
                <LinkRow
                  label="Nơi chi trả"
                  icon="business-outline"
                  onPress={() => navigation.navigate('IncomeSourceList')}
                  testID="quickLinkIncomeSource"
                  isDark={isDark}
                />
                <LinkRow
                  label="Lịch hẹn tư vấn của tôi"
                  icon="calendar-outline"
                  onPress={() => navigation.navigate('MyBookings', {})}
                  testID="quickLinkMyBookings"
                  isDark={isDark}
                />
                {isExpert ? (
                  <>
                    <LinkRow
                      label="Quản lý ca tư vấn (Chuyên gia)"
                      icon="briefcase-outline"
                      onPress={() => navigation.navigate('ExpertBookings', {})}
                      testID="quickLinkExpertBookings"
                      isDark={isDark}
                    />
                    <LinkRow
                      label="Ví điện tử TaxKeep"
                      icon="wallet-outline"
                      onPress={() => navigation.navigate('Wallet', { walletType: 'EXPERT' })}
                      testID="quickLinkExpertWallet"
                      isDark={isDark}
                    />
                    <LinkRow
                      label="Lịch làm việc của chuyên gia"
                      icon="time-outline"
                      onPress={() => navigation.navigate('ExpertSlots')}
                      testID="quickLinkExpertSlots"
                      isDark={isDark}
                    />
                  </>
                ) : (
                  <LinkRow
                    label="Ví điện tử TaxKeep"
                    icon="wallet-outline"
                    onPress={() => navigation.navigate('Wallet', { walletType: 'USER' })}
                    testID="quickLinkUserWallet"
                    isDark={isDark}
                  />
                )}
                <LinkRow
                  label={isExpert ? 'Hồ sơ chuyên gia thuế' : 'Đăng ký làm chuyên gia thuế'}
                  icon="school-outline"
                  onPress={() => navigation.navigate('ExpertApplication')}
                  testID="quickLinkExpertApplication"
                  last
                  isDark={isDark}
                />
              </View>
            </>
          ) : (
            <>
              {/* ── TAB CÀI ĐẶT ── */}
              <View
                style={[
                  styles.cardBlock,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                  },
                ]}
              >
                <LinkRow
                  label="Chỉnh sửa hồ sơ cá nhân"
                  icon="person-outline"
                  onPress={() => handleEdit(false)}
                  testID="quickLinkEditProfile"
                  isDark={isDark}
                />
                <LinkRow
                  label="Đổi mật khẩu"
                  icon="lock-closed-outline"
                  onPress={() => navigation.navigate('ChangePassword')}
                  testID="quickLinkChangePassword"
                  isDark={isDark}
                />
                <LinkRow
                  label="Gói thành viên"
                  icon="ribbon-outline"
                  onPress={() => navigation.navigate('SubscriptionMy')}
                  testID="quickLinkSubscriptionMy"
                  isDark={isDark}
                />

                {/* Chế độ giao diện Sáng / Tối */}
                <View style={styles.themeRow} testID="themeToggleRow">
                  <View style={styles.linkLeft}>
                    <View
                      style={[
                        styles.linkIconBox,
                        { backgroundColor: isDark ? '#2A2622' : '#F5EFE6' },
                      ]}
                    >
                      <Ionicons
                        name={isDark ? 'moon-outline' : 'sunny-outline'}
                        size={18}
                        color={palette.primary}
                      />
                    </View>
                    <Text style={[styles.linkLabel, { color: palette.textPrimary }]}>
                      Chế độ giao diện
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.themeSegmentWrap,
                      {
                        backgroundColor: isDark ? '#141210' : '#F3EFE6',
                        borderColor: palette.border,
                      },
                    ]}
                  >
                    <TouchableOpacity
                      style={[
                        styles.themeSegmentBtn,
                        themeMode === 'light' && [
                          styles.themeSegmentBtnActive,
                          { backgroundColor: palette.primary },
                        ],
                      ]}
                      activeOpacity={0.8}
                      onPress={() => void setMode('light')}
                      accessibilityRole="button"
                      accessibilityLabel="Chế độ sáng"
                      testID="themeModeLightBtn"
                    >
                      <Ionicons
                        name="sunny"
                        size={14}
                        color={themeMode === 'light' ? '#FFFFFF' : palette.textSecondary}
                      />
                      <Text
                        style={[
                          styles.themeSegmentText,
                          { color: themeMode === 'light' ? '#FFFFFF' : palette.textSecondary },
                        ]}
                      >
                        Sáng
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.themeSegmentBtn,
                        themeMode === 'dark' && [
                          styles.themeSegmentBtnActive,
                          { backgroundColor: palette.primary },
                        ],
                      ]}
                      activeOpacity={0.8}
                      onPress={() => void setMode('dark')}
                      accessibilityRole="button"
                      accessibilityLabel="Chế độ tối"
                      testID="themeModeDarkBtn"
                    >
                      <Ionicons
                        name="moon"
                        size={13}
                        color={themeMode === 'dark' ? '#FFFFFF' : palette.textSecondary}
                      />
                      <Text
                        style={[
                          styles.themeSegmentText,
                          { color: themeMode === 'dark' ? '#FFFFFF' : palette.textSecondary },
                        ]}
                      >
                        Tối
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={styles.logoutBtn}
                activeOpacity={0.85}
                onPress={handleLogout}
                accessibilityRole="button"
                accessibilityLabel="Đăng xuất"
                testID="profileLogoutBtn"
              >
                <Ionicons name="log-out-outline" size={18} color={palette.error} />
                <Text style={[styles.logoutBtnText, { color: palette.error }]}>Đăng xuất</Text>
              </TouchableOpacity>
            </>
          )}
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
    marginBottom: 14,
  },
  tabSwitchContainer: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    padding: 4,
    gap: 6,
    marginBottom: 16,
  },
  tabSwitchBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  tabSwitchBtnActive: {
    ...theme.shadows.button,
  },
  tabSwitchText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    lineHeight: 18,
  },
  sectionTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 18,
    lineHeight: 24,
    color: theme.colors.textPrimary,
    marginTop: 18,
    marginBottom: 8,
  },
  cardBlock: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    ...theme.shadows.card,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  fieldLabel: {
    width: 118,
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
  linkLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  linkIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkLabel: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.textPrimary,
  },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
  },
  themeSegmentWrap: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    padding: 2,
    gap: 2,
  },
  themeSegmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  themeSegmentBtnActive: {
    ...theme.shadows.button,
  },
  themeSegmentText: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    lineHeight: 16,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20,
    paddingVertical: 14,
    cursor: Platform.OS === 'web' ? ('pointer' as any) : undefined,
  },
  logoutBtnText: {
    fontFamily: fonts.bodySemi,
    fontSize: 15,
    lineHeight: 20,
    color: theme.colors.error,
  },
});
