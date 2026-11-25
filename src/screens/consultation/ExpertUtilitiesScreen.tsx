import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { DrumHeader } from '../../components/brand/DrumHeader';
import { GoldDoubleRule } from '../../components/brand/GoldDoubleRule';
import { MainTabBar } from '../../components/navigation/MainTabBar';
import { RootNavigationProp } from '../../navigation/types';
import { useAuthStore } from '../../stores/useAuthStore';
import { formatPersonName } from '../../utils/formatPersonName';
import { consultationApi } from '../../api/consultationApi';
import { getCustomExpertAvatar, resolveExpertAvatarUri } from '../../utils/expertAvatarStorage';
import type { UpcomingMeetingReminderDto } from '../../types/consultation';
import {
  formatVietnameseDate,
  formatTimeRange,
  isValidAvatarUrl,
} from '../../types/consultation';

type ExpertUtilityRowSpec = {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  badgeCount?: number;
  testID: string;
  onPress: () => void;
};

export const ExpertUtilitiesScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const user = useAuthStore((s) => s.user);
  const displayName = formatPersonName(user?.fullName) || 'Chuyên gia thuế';

  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [avatarUri, setAvatarUri] = useState<string>('');
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [totalBookingsCount, setTotalBookingsCount] = useState<number>(0);
  const [upcomingMeeting, setUpcomingMeeting] = useState<UpcomingMeetingReminderDto | null>(null);
  const [joiningMeeting, setJoiningMeeting] = useState<boolean>(false);

  const loadExpertOverview = useCallback(async (isPullRefresh = false) => {
    if (isPullRefresh) {
      setRefreshing(true);
    }

    try {
      const savedAvatar = user?.id ? await getCustomExpertAvatar(user.id) : null;
      if (savedAvatar && isValidAvatarUrl(savedAvatar)) {
        setAvatarUri(resolveExpertAvatarUri(savedAvatar));
      }

      const [pendingRes, bookingsRes, upcomingRes] = await Promise.allSettled([
        consultationApi.getExpertPendingBookings({ page: 1, size: 20 }),
        consultationApi.getExpertBookings({ page: 1, size: 1 }),
        consultationApi.getUpcomingMeetingReminder(),
      ]);

      if (pendingRes.status === 'fulfilled') {
        setPendingCount(
          pendingRes.value?.pagination?.totalItems ?? pendingRes.value?.items?.length ?? 0
        );
      }
      if (bookingsRes.status === 'fulfilled') {
        setTotalBookingsCount(
          bookingsRes.value?.pagination?.totalItems ?? bookingsRes.value?.items?.length ?? 0
        );
      }
      if (upcomingRes.status === 'fulfilled') {
        setUpcomingMeeting(upcomingRes.value?.hasUpcomingMeeting ? upcomingRes.value : null);
      } else {
        setUpcomingMeeting(null);
      }
    } finally {
      setRefreshing(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadExpertOverview(false);
    }, [loadExpertOverview])
  );

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Home');
    }
  }, [navigation]);

  const handleJoinUpcoming = useCallback(async () => {
    if (!upcomingMeeting?.bookingId) return;
    setJoiningMeeting(true);
    try {
      const res = await consultationApi.joinConsultation(upcomingMeeting.bookingId);
      if (res?.roomUrl) {
        await Linking.openURL(res.roomUrl);
      } else if (upcomingMeeting.roomUrl) {
        await Linking.openURL(upcomingMeeting.roomUrl);
      } else {
        navigation.navigate('BookingDetail', {
          bookingId: upcomingMeeting.bookingId,
          isExpertView: true,
        });
      }
    } catch {
      if (upcomingMeeting.roomUrl) {
        await Linking.openURL(upcomingMeeting.roomUrl).catch(() => {});
      } else {
        navigation.navigate('BookingDetail', {
          bookingId: upcomingMeeting.bookingId,
          isExpertView: true,
        });
      }
    } finally {
      setJoiningMeeting(false);
    }
  }, [navigation, upcomingMeeting]);

  const utilityItems: ExpertUtilityRowSpec[] = [
    {
      id: 'expert_bookings',
      title: 'Quản lý ca tư vấn',
      subtitle:
        totalBookingsCount > 0
          ? `Theo dõi ${totalBookingsCount} lịch hẹn, phòng họp Video 1-1 & Chat`
          : 'Danh sách lịch hẹn khách hàng, vào phòng họp & lịch sử tư vấn',
      icon: 'briefcase-outline',
      testID: 'expertUtil_Bookings',
      onPress: () => navigation.navigate('ExpertBookings', { initialTab: 'all' }),
    },
    {
      id: 'expert_pending',
      title: 'Yêu cầu đặt lịch chờ duyệt',
      subtitle:
        pendingCount > 0
          ? `Có ${pendingCount} yêu cầu mới đang chờ chuyên gia phản hồi`
          : 'Tiếp nhận hoặc từ chối yêu cầu đặt lịch mới từ người nộp thuế',
      icon: 'time-outline',
      badgeCount: pendingCount,
      testID: 'expertUtil_Pending',
      onPress: () => navigation.navigate('ExpertBookings', { initialTab: 'pending' }),
    },
    {
      id: 'expert_slots',
      title: 'Lịch làm việc & Khung giờ rảnh',
      subtitle: 'Mở ca tư vấn theo ngày hoặc thiết lập lịch cố định hàng tuần',
      icon: 'calendar-clear-outline',
      testID: 'expertUtil_Slots',
      onPress: () => navigation.navigate('ExpertSlots'),
    },
    {
      id: 'expert_profile_fees',
      title: 'Hồ sơ chuyên gia',
      subtitle: 'Xem hồ sơ hành nghề, biểu phí đang áp dụng, chứng chỉ & phản hồi đánh giá',
      icon: 'medal-outline',
      testID: 'expertUtil_ProfileFees',
      onPress: () => navigation.navigate('ExpertProfile'),
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <DrumHeader
        title="Tiện ích chuyên gia"
        onBack={handleBack}
        backTestID="expertUtilitiesBackBtn"
        right={
          <TouchableOpacity
            style={styles.refreshHeaderBtn}
            onPress={() => void loadExpertOverview(true)}
            accessibilityRole="button"
            accessibilityLabel="Làm mới"
          >
            <Ionicons name="refresh" size={20} color={theme.colors.primary} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadExpertOverview(true)}
            colors={[theme.colors.primary]}
          />
        }
      >
        <View style={styles.contentWrap}>
          {/* Định danh chuyên gia */}
          <View style={styles.identityBanner}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.identityAvatarImage} />
            ) : (
              <View style={styles.identityAvatar}>
                <Ionicons name="shield-checkmark" size={22} color="#FFFFFF" />
              </View>
            )}
            <View style={styles.flex}>
              <Text style={styles.identityRoleLabel}>TÀI KHOẢN CHUYÊN GIA ĐÃ XÁC THỰC</Text>
              <Text style={styles.identityName} numberOfLines={1}>
                {displayName}
              </Text>
            </View>
          </View>

          <GoldDoubleRule style={styles.rule} />

          {/* Ca tư vấn sắp diễn ra (nếu có) */}
          {upcomingMeeting && upcomingMeeting.hasUpcomingMeeting ? (
            <View style={styles.upcomingCard} testID="expertUtilitiesUpcomingCard">
              <View style={styles.upcomingHeadRow}>
                <View style={styles.upcomingTag}>
                  <Ionicons name="videocam" size={12} color="#FFFFFF" />
                  <Text style={styles.upcomingTagText}>CA TƯ VẤN SẮP TỚI</Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    if (upcomingMeeting.bookingId) {
                      navigation.navigate('BookingDetail', {
                        bookingId: upcomingMeeting.bookingId,
                        isExpertView: true,
                      });
                    }
                  }}
                >
                  <Text style={styles.upcomingDetailLink}>Chi tiết →</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.upcomingTopic} numberOfLines={2}>
                {upcomingMeeting.topicTitle || 'Phiên tư vấn trực tuyến cùng khách hàng'}
              </Text>
              <Text style={styles.upcomingMeta}>
                {formatVietnameseDate(upcomingMeeting.slotDate ?? undefined)} •{' '}
                {formatTimeRange(
                  upcomingMeeting.startTime ?? undefined,
                  upcomingMeeting.endTime ?? undefined
                )}
              </Text>
              {(upcomingMeeting.canJoinRoom || upcomingMeeting.isRoomOpen) && (
                <TouchableOpacity
                  style={styles.joinNowBtn}
                  activeOpacity={0.85}
                  disabled={joiningMeeting}
                  onPress={() => void handleJoinUpcoming()}
                >
                  {joiningMeeting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="videocam-outline" size={16} color="#FFFFFF" />
                      <Text style={styles.joinNowBtnText}>Vào phòng tư vấn ngay</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          ) : null}

          {/* Danh mục các tiện ích của riêng chuyên gia */}
          <Text style={styles.sectionHeading}>Chức năng dành riêng cho chuyên gia</Text>

          <View style={styles.utilityListCard}>
            {utilityItems.map((item, idx) => {
              const isLast = idx === utilityItems.length - 1;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.utilityRow, !isLast && styles.utilityRowBorder]}
                  activeOpacity={0.78}
                  onPress={item.onPress}
                  accessibilityRole="button"
                  accessibilityLabel={item.title}
                  testID={item.testID}
                >
                  <View style={styles.utilityIconBox}>
                    <Ionicons name={item.icon} size={22} color="#8B1E1E" />
                  </View>

                  <View style={styles.utilityTextCol}>
                    <View style={styles.utilityTitleRow}>
                      <Text style={styles.utilityTitle}>{item.title}</Text>
                      {item.badgeCount && item.badgeCount > 0 ? (
                        <View style={styles.pendingBadge}>
                          <Text style={styles.pendingBadgeText}>{item.badgeCount}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.utilitySubtitle}>{item.subtitle}</Text>
                  </View>

                  <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <MainTabBar />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  flex: {
    flex: 1,
  },
  refreshHeaderBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 36,
  },
  contentWrap: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  identityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  identityAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityAvatarImage: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#D99B26',
  },
  identityRoleLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 10.5,
    lineHeight: 14,
    letterSpacing: 0.6,
    color: '#8B1E1E',
  },
  identityName: {
    fontFamily: fonts.serifBold,
    fontSize: 19,
    lineHeight: 25,
    color: theme.colors.primaryDark,
    marginTop: 1,
  },
  rule: {
    marginVertical: 14,
  },
  upcomingCard: {
    marginBottom: 16,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 14,
  },
  upcomingHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  upcomingTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D97706',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
  },
  upcomingTagText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    lineHeight: 14,
    color: '#FFFFFF',
  },
  upcomingDetailLink: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    lineHeight: 16,
    color: theme.colors.primary,
  },
  upcomingTopic: {
    fontFamily: fonts.bodyBold,
    fontSize: 14.5,
    lineHeight: 20,
    color: theme.colors.primaryDark,
  },
  upcomingMeta: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    lineHeight: 17,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  joinNowBtn: {
    marginTop: 10,
    minHeight: 40,
    borderRadius: 9,
    backgroundColor: '#059669',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  joinNowBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    lineHeight: 18,
    color: '#FFFFFF',
  },
  sectionHeading: {
    fontFamily: fonts.serifBold,
    fontSize: 17,
    lineHeight: 23,
    color: theme.colors.primaryDark,
    marginTop: 4,
    marginBottom: 10,
  },
  utilityListCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  utilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 15,
    paddingHorizontal: 14,
  },
  utilityRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  utilityIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FCE4A6',
    borderWidth: 1,
    borderColor: '#D99B26',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  utilityTextCol: {
    flex: 1,
    minWidth: 0,
  },
  utilityTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  utilityTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 14.5,
    lineHeight: 20,
    color: theme.colors.textPrimary,
  },
  pendingBadge: {
    minWidth: 22,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    lineHeight: 14,
    color: '#FFFFFF',
  },
  utilitySubtitle: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    lineHeight: 18,
    color: theme.colors.textSecondary,
    marginTop: 3,
  },
});
