import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
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

export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const logout = useAuthStore((s) => s.logout);
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogout = () => {
    Alert.alert('Đăng xuất', 'Bạn có chắc chắn muốn đăng xuất khỏi ứng dụng?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Đăng xuất',
        style: 'destructive',
        onPress: async () => {
          await logout();
          navigation.replace('Login');
        },
      },
    ]);
  };

  const fetchProfile = async (isPullRefresh = false) => {
    try {
      if (isPullRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      const data = await profileApi.getProfile();
      setProfile(data);
    } catch (err: any) {
      const authUser = useAuthStore.getState().user;
      if (authUser) {
        setProfile({
          userId: authUser.id,
          citizenId: authUser.citizenId,
          fullName: authUser.fullName,
          email: authUser.email,
          userRole: authUser.role || 'TAXPAYER',
          isVerified: true,
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } else {
        const msg = err.response?.data?.message || 'Không thể tải thông tin hồ sơ cá nhân.';
        setError(msg);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [])
  );

  const handleEdit = (autoFocusTaxId = false) => {
    navigation.navigate('EditProfile', { autoFocusTaxId });
  };

  const goBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Home');
  };

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
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchProfile(true)} colors={[theme.colors.primary]} />
        }
      >
        <Text style={styles.heroName}>{displayName}</Text>
        <Text style={styles.heroStatus}>
          {profile?.isVerified ? 'Đã xác thực' : 'Chưa xác thực'}
        </Text>
        {error ? <Text style={styles.warningSubtitle}>{error}</Text> : null}
        {!profile?.isVerified ? (
          <Text style={styles.warningSubtitle}>
            Một số việc sẽ bị hạn chế đến khi tài khoản được xác thực.
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

        <Text style={styles.sectionTitle}>Liên kết</Text>
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
      </ScrollView>
      <MainTabBar active="Profile" />
    </SafeAreaView>
  );
};

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value || 'Chưa cập nhật'}</Text>
    </View>
  );
}

function LinkRow({
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
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerSide: {
    width: 40,
    height: 40,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  headerTitle: {
    ...theme.typography.titleMedium,
    fontWeight: '700',
    color: theme.colors.primaryDark,
    letterSpacing: 0.5,
  },
  editHeaderBtn: {
    minWidth: 44,
    height: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 4,
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
    paddingBottom: 28,
  },
  editHeaderText: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.primary,
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
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  linkRowLast: {
    borderBottomWidth: 0,
  },
  linkLabel: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.textPrimary,
  },
  userCard: {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    ...theme.shadows.button,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  userName: {
    ...theme.typography.titleLarge,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 5,
  },
  badgeVerified: {
    backgroundColor: 'rgba(46, 125, 50, 0.1)',
  },
  badgeUnverified: {
    backgroundColor: 'rgba(237, 108, 2, 0.1)',
  },
  badgeText: {
    ...theme.typography.caption,
    fontWeight: '600',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF8E1',
    borderWidth: 1,
    borderColor: '#FFE082',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  warningTitle: {
    ...theme.typography.bodyMedium,
    fontWeight: '700',
    color: '#E65100',
    marginBottom: 2,
  },
  warningSubtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.primary,
    textAlign: 'center',
    marginTop: 8,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: {
    ...theme.typography.titleMedium,
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.primaryDark,
    letterSpacing: 0.5,
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
  labelWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fieldLabel: {
    width: 108,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textSecondary,
  },
  fieldValue: {
    flex: 1,
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textPrimary,
    textAlign: 'right',
  },
  monospace: {
    letterSpacing: 0.5,
    fontFamily: 'monospace',
  },
  divider: {
    height: 1,
    backgroundColor: '#ECE7DE',
    marginVertical: 4,
  },
  taxIdBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: theme.colors.borderFocus,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
    gap: 6,
  },
  taxIdText: {
    ...theme.typography.bodyMedium,
    fontWeight: '700',
    color: theme.colors.primary,
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  taxIdEmptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  emptyText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.textPlaceholder,
    fontStyle: 'italic',
  },
  addTaxBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
    gap: 4,
  },
  addTaxBtnText: {
    ...theme.typography.caption,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  quickLinksHeader: {
    ...theme.typography.titleMedium,
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  quickLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  quickLinkLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quickLinkText: {
    ...theme.typography.bodyMedium,
    fontWeight: '500',
    color: theme.colors.textPrimary,
  },
  primaryEditBtn: {
    height: 52,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
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
  },
  logoutBtnText: {
    fontFamily: fonts.bodySemi,
    fontSize: 15,
    lineHeight: 20,
    color: theme.colors.error,
  },
});
