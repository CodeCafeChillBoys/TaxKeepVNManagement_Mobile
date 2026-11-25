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
import { useThemeStore, DARK_COLORS, LIGHT_COLORS } from '../../stores/useThemeStore';
import { MainTabBar } from '../../components/navigation/MainTabBar';
import { DrumHeader } from '../../components/brand/DrumHeader';
import { GoldDoubleRule } from '../../components/brand/GoldDoubleRule';
import { formatPersonName } from '../../utils/formatPersonName';
import { toFriendlyErrorMessage } from '../../utils/friendlyError';
import { sanitizeProfileAddress } from '../../constants/vietnamProvinces';

const Field = memo(function Field({
  label,
  value,
  isDark,
  last,
}: {
  label: string;
  value?: string | null;
  isDark?: boolean;
  last?: boolean;
}) {
  const palette = isDark ? DARK_COLORS : LIGHT_COLORS;
  return (
    <View
      style={[
        styles.fieldRow,
        { borderBottomColor: palette.border },
        last && styles.fieldRowLast,
      ]}
    >
      <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>{label}</Text>
      <Text
        style={[styles.fieldValue, { color: palette.textPrimary }]}
        numberOfLines={2}
        ellipsizeMode="tail"
      >
        {value || 'Chưa cập nhật'}
      </Text>
    </View>
  );
});

export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const isDark = useThemeStore((s) => s.isDark);
  const palette = isDark ? DARK_COLORS : LIGHT_COLORS;

  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

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
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: palette.background }]}
        edges={['top', 'left', 'right']}
      >
        <DrumHeader title="Cá nhân" onBack={goBack} />
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
        title="Cá nhân"
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

          {/* Thẻ thông tin cá nhân */}
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
            <View style={[styles.fieldRow, styles.fieldRowLast]}>
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

          {(profile?.userRole || '').toLowerCase().includes('expert') ? (
            <TouchableOpacity
              style={[
                styles.expertProfileLinkCard,
                {
                  backgroundColor: palette.surface,
                  borderColor: isDark ? palette.gold : '#D99B26',
                },
              ]}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('ExpertProfile')}
              accessibilityRole="button"
              accessibilityLabel="Xem hồ sơ hành nghề chuyên gia"
              testID="profileOpenExpertProfileBtn"
            >
              <View style={styles.expertProfileLinkIcon}>
                <Ionicons name="medal-outline" size={20} color="#8B1E1E" />
              </View>
              <View style={styles.expertProfileLinkTextCol}>
                <Text style={[styles.expertProfileLinkTitle, { color: palette.textPrimary }]}>
                  Hồ sơ hành nghề chuyên gia
                </Text>
                <Text style={[styles.expertProfileLinkSub, { color: palette.textSecondary }]}>
                  Chuyên môn, biểu phí, chứng chỉ &amp; đánh giá khách hàng
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={palette.primary} />
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={[styles.primaryEditBtn, { backgroundColor: palette.primary }]}
            activeOpacity={0.85}
            onPress={() => handleEdit(false)}
            accessibilityRole="button"
            accessibilityLabel="Chỉnh sửa hồ sơ cá nhân"
            testID="profileEditBtn"
          >
            <Ionicons name="create-outline" size={18} color="#FFFFFF" />
            <Text style={styles.primaryEditBtnText}>Chỉnh sửa hồ sơ cá nhân</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      <MainTabBar active="Profile" />
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
    marginBottom: 18,
  },
  cardBlock: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  fieldRowLast: {
    borderBottomWidth: 0,
  },
  fieldLabel: {
    flexShrink: 0,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textSecondary,
  },
  fieldValue: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textPrimary,
    textAlign: 'right',
    ...(Platform.OS === 'web'
      ? ({ wordBreak: 'break-word', overflowWrap: 'anywhere' } as any)
      : {}),
  },
  link: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.primary,
  },
  primaryEditBtn: {
    minHeight: 50,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 18,
    paddingHorizontal: 16,
    ...theme.shadows.button,
  },
  expertProfileLinkCard: {
    marginTop: 18,
    borderRadius: 12,
    borderWidth: 1.2,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...theme.shadows.card,
  },
  expertProfileLinkIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FCE4A6',
    borderWidth: 1,
    borderColor: '#D99B26',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expertProfileLinkTextCol: {
    flex: 1,
    minWidth: 0,
  },
  expertProfileLinkTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    lineHeight: 19,
  },
  expertProfileLinkSub: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  primaryEditBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    lineHeight: 20,
    color: '#FFFFFF',
  },
});
