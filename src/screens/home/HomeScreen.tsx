import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { useAuthStore } from '../../stores/useAuthStore';
import { RootNavigationProp } from '../../navigation/types';
import {
  dependentDocumentApi,
  AgeReminderItemDto,
  DependentItem,
} from '../../api/dependentDocumentApi';
import { dependentLifecycleApi } from '../../api/dependentLifecycleApi';
import { notificationApi, NotificationItem } from '../../api/notificationApi';
import { profileApi } from '../../api/profileApi';
import {
  buildHomeReminderChangeGroupPlan,
  runHomeReminderChangeGroup,
  type HomeReminderConfirmPlan,
} from './homeReminderChangeGroup';
import {
  buildPendingUploadAgeReminders,
  isReminderAwaitingUploadOnly,
  mergeAgeTransitionReminders,
  proofNavFromAgeReminder,
} from './homeAgeReminderBanner';
import { Dialog } from '../../components/common/Dialog';
import { DrumPatternBackdrop } from '../../components/brand/DrumPatternBackdrop';
import { GoldDoubleRule } from '../../components/brand/GoldDoubleRule';
import { MainTabBar } from '../../components/navigation/MainTabBar';
import { humanizeGroupCodes } from '../dependent/dependentGroupUtils';
import { formatPersonName } from '../../utils/formatPersonName';
import { consultationApi } from '../../api/consultationApi';
import type { UpcomingMeetingReminderDto } from '../../types/consultation';
import { formatVietnameseDate, formatTimeRange } from '../../types/consultation';

const DEDUCTION_PER_DEPENDENT = 6_200_000;

type TodoItem = {
  id: string;
  title: string;
  subtitle: string;
  kind: 'age' | 'incomplete';
  reminder?: AgeReminderItemDto;
  dependent?: DependentItem;
};

function initialFromName(name?: string | null): string {
  const trimmed = (name || '').trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  return (parts[parts.length - 1] || '?').charAt(0).toUpperCase();
}

function formatMoney(amount: number): string {
  return `${amount.toLocaleString('vi-VN')} đ`;
}

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const { user } = useAuthStore();
  const userRole = (user?.role || '').toLowerCase();
  const isExpert = userRole === 'expert' || userRole.includes('expert');

  const [reminders, setReminders] = useState<AgeReminderItemDto[]>([]);
  const [dependents, setDependents] = useState<DependentItem[]>([]);
  const [reminderPatching, setReminderPatching] = useState(false);
  const [changeGroupConfirm, setChangeGroupConfirm] =
    useState<HomeReminderConfirmPlan | null>(null);
  const [infoDialog, setInfoDialog] = useState<{
    title: string;
    message: string;
  } | null>(null);

  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notifModalVisible, setNotifModalVisible] = useState<boolean>(false);
  const [notifTab, setNotifTab] = useState<'ALL' | 'UNREAD'>('ALL');
  const [loadingNotifs, setLoadingNotifs] = useState<boolean>(false);
  const [refreshingNotifs, setRefreshingNotifs] = useState<boolean>(false);
  const [upcomingMeeting, setUpcomingMeeting] = useState<UpcomingMeetingReminderDto | null>(null);
  const [joiningMeeting, setJoiningMeeting] = useState<boolean>(false);

  const fetchDashboardData = useCallback(async () => {
    try {
      const [remindersData, deps] = await Promise.all([
        dependentDocumentApi.getAgeTransitionReminders(),
        dependentDocumentApi.getDependents({ size: 50 }),
      ]);
      const pendingUpload = buildPendingUploadAgeReminders(deps);
      setReminders(mergeAgeTransitionReminders(remindersData, pendingUpload));
      setDependents(deps);

      const count = await notificationApi.getUnreadCount();
      setUnreadCount(count);

      notificationApi
        .getNotifications({ size: 20 })
        .then((notifData) => {
          if (notifData?.items) {
            setNotifications(notifData.items);
          }
        })
        .catch(() => {});

      // Nhắc nhở ca họp trực tuyến sắp diễn ra
      consultationApi
        .getUpcomingMeetingReminder()
        .then((reminder) => {
          setUpcomingMeeting(reminder?.hasUpcomingMeeting ? reminder : null);
        })
        .catch(() => {
          setUpcomingMeeting(null);
        });

      // Đồng bộ thông tin vai trò người dùng (nếu vừa được duyệt chuyên gia)
      profileApi.getProfile().then((prof) => {
        if (prof?.userRole && user && user.role !== prof.userRole) {
          useAuthStore.setState({
            user: { ...user, role: prof.userRole },
          });
        }
      }).catch(() => {});
    } catch (err) {
      console.warn('HomeScreen fetchDashboardData error:', err);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchDashboardData();
    }, [fetchDashboardData])
  );

  const displayName = formatPersonName(user?.fullName) || 'Người nộp thuế';
  const completeCount = dependents.filter((d) => d.isProfileComplete).length;
  const pendingProofCount = dependents.filter((d) => !d.isProfileComplete).length;
  const deductionAmount = dependents.length * DEDUCTION_PER_DEPENDENT;

  const todoItems = useMemo((): TodoItem[] => {
    const items: TodoItem[] = [];
    const reminderIds = new Set(reminders.map((r) => r.dependentId));

    for (const r of reminders) {
      const name = formatPersonName(r.fullName);
      const isSoon = r.transitionStatus === 'TURNING_18_SOON';
      items.push({
        id: `age-${r.dependentId}`,
        title: isSoon
          ? `${name} sắp tròn 18 tuổi`
          : `${name} đã tròn 18 tuổi`,
        subtitle: 'Nộp giấy tờ sinh viên để không bị tạm dừng giảm trừ',
        kind: 'age',
        reminder: r,
      });
    }

    for (const dep of dependents) {
      if (dep.isProfileComplete || reminderIds.has(dep.id)) continue;
      const name = formatPersonName(dep.fullName);
      items.push({
        id: `inc-${dep.id}`,
        title: `${name} thiếu giấy tờ minh chứng`,
        subtitle: 'Hồ sơ chưa được tính giảm trừ',
        kind: 'incomplete',
        dependent: dep,
      });
    }

    return items;
  }, [reminders, dependents]);

  const handleOpenNotifications = async () => {
    setNotifModalVisible(true);
    setLoadingNotifs(true);
    try {
      const data = await notificationApi.getNotifications({ size: 50 });
      setNotifications(data.items);
      const unread = data.items.filter((i) => !i.isRead).length;
      setUnreadCount(unread);
    } catch (err) {
      console.warn('handleOpenNotifications error:', err);
    } finally {
      setLoadingNotifs(false);
    }
  };

  const handleRefreshNotifications = async () => {
    setRefreshingNotifs(true);
    try {
      const data = await notificationApi.getNotifications({ size: 50 });
      setNotifications(data.items);
      const unread = data.items.filter((i) => !i.isRead).length;
      setUnreadCount(unread);
    } catch (err) {
      console.warn('handleRefreshNotifications error:', err);
    } finally {
      setRefreshingNotifs(false);
    }
  };

  const handleMarkAsRead = async (item: NotificationItem) => {
    if (item.isRead) return;
    const success = await notificationApi.markAsRead(item.notificationId);
    if (success) {
      setNotifications((prev) =>
        prev.map((n) =>
          n.notificationId === item.notificationId ? { ...n, isRead: true } : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  };

  const handleMarkAllAsRead = async () => {
    const unreadItems = notifications.filter((n) => !n.isRead);
    if (unreadItems.length === 0) return;

    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);

    await Promise.all(unreadItems.map((n) => notificationApi.markAsRead(n.notificationId)));
  };

  const extractConsultationBookingTarget = useCallback(
    (
      item: NotificationItem
    ): { bookingId?: string; isExpertView: boolean; isConsultationNotif: boolean } => {
      const url = item.targetActionUrl || '';
      const type = item.notificationType || '';
      const expertMatch = url.match(/\/expert\/bookings\/([0-9a-fA-F-]{36})/i);
      if (expertMatch?.[1]) {
        return { bookingId: expertMatch[1], isExpertView: true, isConsultationNotif: true };
      }
      const userMatch = url.match(/\/(?:consultation\/bookings|consultations|bookings)\/([0-9a-fA-F-]{36})/i);
      const isExpertType =
        type === 'USER_NO_SHOW_EXPERT_NOTIFIED' || type === 'EXPERT_NO_SHOW_PENALTY';
      if (userMatch?.[1]) {
        return {
          bookingId: userMatch[1],
          isExpertView: isExpertType,
          isConsultationNotif: true,
        };
      }
      const isConsultationNotif =
        [
          'USER_NO_SHOW',
          'USER_NO_SHOW_CLOSED',
          'USER_NO_SHOW_EXPERT_NOTIFIED',
          'EXPERT_NO_SHOW_REFUND',
          'EXPERT_NO_SHOW_REFUNDED',
          'EXPERT_NO_SHOW_PENALTY',
          'CONSULTATION_COMPLETED',
          'CONSULTATION_BOOKING',
          'DISPUTE_RESOLVED',
        ].includes(type) ||
        url.includes('/consultation') ||
        url.includes('/bookings');

      return {
        bookingId: undefined,
        isExpertView: isExpertType,
        isConsultationNotif,
      };
    },
    []
  );

  const unreadNoShowNotifications = useMemo(
    () =>
      notifications.filter(
        (n) =>
          !n.isRead &&
          [
            'USER_NO_SHOW',
            'USER_NO_SHOW_CLOSED',
            'USER_NO_SHOW_EXPERT_NOTIFIED',
            'EXPERT_NO_SHOW_REFUND',
            'EXPERT_NO_SHOW_REFUNDED',
            'EXPERT_NO_SHOW_PENALTY',
          ].includes(n.notificationType)
      ),
    [notifications]
  );

  const handleNotificationPress = async (item: NotificationItem) => {
    await handleMarkAsRead(item);

    const consultationTarget = extractConsultationBookingTarget(item);
    if (consultationTarget.isConsultationNotif) {
      setNotifModalVisible(false);
      if (consultationTarget.bookingId) {
        navigation.navigate('BookingDetail', {
          bookingId: consultationTarget.bookingId,
          isExpertView: consultationTarget.isExpertView,
        });
      } else if (consultationTarget.isExpertView) {
        navigation.navigate('ExpertBookings');
      } else {
        navigation.navigate('MyBookings');
      }
      return;
    }

    if (
      item.notificationType === 'AGE_TRANSITION_ALERT' ||
      item.title.toLowerCase().includes('18 tuổi') ||
      item.message.toLowerCase().includes('sinh viên')
    ) {
      setNotifModalVisible(false);
      navigation.navigate('ProofDocuments', {
        groupIndex: 1,
      });
    } else if (item.notificationType === 'DEPENDENT_REGISTRATION') {
      setNotifModalVisible(false);
      navigation.navigate('TaxRegistration');
    }
  };

  const handleReminderUploadPress = (item: AgeReminderItemDto) => {
    if (reminderPatching) return;
    if (isReminderAwaitingUploadOnly(item)) {
      const nav = proofNavFromAgeReminder(item);
      navigation.navigate(nav.screen, nav.params);
      return;
    }
    setChangeGroupConfirm(
      buildHomeReminderChangeGroupPlan({
        dependentId: item.dependentId,
        fullName: item.fullName,
        recommendedGroup: item.recommendedGroup || 'CHILD_OVER_18_STUDYING',
      })
    );
  };

  const handleConfirmReminderChangeGroup = async () => {
    if (!changeGroupConfirm || reminderPatching) return;
    const plan = changeGroupConfirm;
    setChangeGroupConfirm(null);
    setReminderPatching(true);
    try {
      const result = await runHomeReminderChangeGroup({
        dependentId: plan.dependentId,
        newGroup: plan.newGroup,
        updateDependentGroup: dependentLifecycleApi.updateDependentGroup,
      });
      if (!result.ok) {
        setInfoDialog({ title: 'Không thể chuyển nhóm', message: result.message });
        return;
      }
      navigation.navigate(result.navigation.screen, result.navigation.params);
    } finally {
      setReminderPatching(false);
    }
  };

  const handleTodoPress = (item: TodoItem) => {
    if (item.kind === 'age' && item.reminder) {
      handleReminderUploadPress(item.reminder);
      return;
    }
    if (item.dependent) {
      navigation.navigate('ProofDocuments', {
        dependentId: item.dependent.id,
        groupIndex: 0,
      });
    }
  };

  const handleJoinUpcomingMeeting = async () => {
    if (!upcomingMeeting?.bookingId) return;
    setJoiningMeeting(true);
    try {
      const res = await consultationApi.joinConsultation(upcomingMeeting.bookingId);
      if (res?.roomUrl) {
        await Linking.openURL(res.roomUrl);
      } else if (upcomingMeeting.roomUrl) {
        await Linking.openURL(upcomingMeeting.roomUrl);
      } else {
        navigation.navigate('BookingDetail', { bookingId: upcomingMeeting.bookingId });
      }
    } catch (err: any) {
      if (upcomingMeeting.roomUrl) {
        await Linking.openURL(upcomingMeeting.roomUrl).catch(() => {});
      } else {
        navigation.navigate('BookingDetail', { bookingId: upcomingMeeting.bookingId });
      }
    } finally {
      setJoiningMeeting(false);
    }
  };

  const deductionSubtitle =
    dependents.length === 0
      ? 'Chưa có người phụ thuộc'
      : `${dependents.length} người · ${completeCount} đủ hồ sơ · ${pendingProofCount} chờ minh chứng`;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <DrumPatternBackdrop variant="soft" />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.avatar}
          onPress={() => navigation.navigate('Profile')}
          activeOpacity={0.8}
          accessibilityLabel="Hồ sơ cá nhân"
        >
          <Text style={styles.avatarLetter}>{initialFromName(displayName)}</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.welcomeText}>Xin chào</Text>
          <Text style={styles.userName} numberOfLines={1}>
            {displayName}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.bellBtn}
          onPress={handleOpenNotifications}
          testID="notificationBellBtn"
          accessibilityLabel="Thông báo hệ thống"
        >
          <Ionicons name="notifications-outline" size={24} color={theme.colors.textPrimary} />
          {unreadCount > 0 ? <View style={styles.unreadDotHeader} /> : null}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.deductionBlock}>
          <Text style={styles.deductionLabel}>Giảm trừ người phụ thuộc mỗi tháng</Text>
          <Text style={styles.deductionAmount}>{formatMoney(deductionAmount)}</Text>
          <Text style={styles.deductionMeta}>{deductionSubtitle}</Text>
        </View>

        <GoldDoubleRule style={styles.rule} />

        <View style={styles.todoHeader}>
          <Text style={styles.todoTitle}>Cần xử lý</Text>
          <Text style={styles.todoCount}>
            {todoItems.length} việc
          </Text>
        </View>

        {todoItems.length === 0 ? (
          <View style={styles.todoEmpty}>
            <Text style={styles.todoEmptyText}>Không có việc cần xử lý lúc này.</Text>
          </View>
        ) : (
          todoItems.map((item, index) => (
            <TouchableOpacity
              key={item.id}
              style={styles.todoRow}
              activeOpacity={0.7}
              onPress={() => handleTodoPress(item)}
              disabled={reminderPatching}
              testID={
                item.kind === 'age' ? 'btnUploadStudentCardReminder' : `homeTodo_${item.id}`
              }
              accessibilityRole="button"
            >
              <Text style={styles.todoIndex}>
                {String(index + 1).padStart(2, '0')}
              </Text>
              <View style={styles.todoBody}>
                <Text style={styles.todoItemTitle}>{item.title}</Text>
                <Text style={styles.todoItemSubtitle}>{item.subtitle}</Text>
              </View>
              {reminderPatching && item.kind === 'age' ? (
                <ActivityIndicator size="small" color={theme.colors.gold} />
              ) : (
                <Ionicons name="chevron-forward" size={16} color="#999999" />
              )}
            </TouchableOpacity>
          ))
        )}

        {/* ── BANNER CẢNH BÁO CA TƯ VẤN ĐÓNG DO VẮNG MẶT (NO-SHOW) CHƯA ĐỌC ── */}
        {unreadNoShowNotifications.map((notif) => {
          const isUserNoShowForCustomer =
            notif.notificationType === 'USER_NO_SHOW' ||
            notif.notificationType === 'USER_NO_SHOW_CLOSED';
          const isExpertProtected = notif.notificationType === 'USER_NO_SHOW_EXPERT_NOTIFIED';
          return (
            <TouchableOpacity
              key={notif.notificationId}
              activeOpacity={0.85}
              onPress={() => handleNotificationPress(notif)}
              style={{
                backgroundColor: isExpertProtected
                  ? '#ECFDF5'
                  : isUserNoShowForCustomer
                  ? '#FFF7ED'
                  : '#FEF2F2',
                borderWidth: 1,
                borderColor: isExpertProtected
                  ? '#A7F3D0'
                  : isUserNoShowForCustomer
                  ? '#FED7AA'
                  : '#FECACA',
                borderRadius: 12,
                padding: 14,
                marginBottom: 14,
              }}
              testID={`homeNoShowAlert_${notif.notificationId}`}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Ionicons
                  name={isExpertProtected ? 'shield-checkmark' : 'alert-circle'}
                  size={18}
                  color={isExpertProtected ? '#059669' : isUserNoShowForCustomer ? '#C2410C' : '#DC2626'}
                />
                <Text
                  style={{
                    flex: 1,
                    fontFamily: fonts.serifBold,
                    fontSize: 14,
                    color: isExpertProtected ? '#065F46' : isUserNoShowForCustomer ? '#9A3412' : '#991B1B',
                  }}
                >
                  {notif.title}
                </Text>
              </View>
              <Text
                style={{
                  fontFamily: fonts.body,
                  fontSize: 12.5,
                  lineHeight: 18,
                  color: isExpertProtected ? '#047857' : isUserNoShowForCustomer ? '#C2410C' : '#B91C1C',
                  marginBottom: 8,
                }}
              >
                {notif.message}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                <Text
                  style={{
                    fontFamily: fonts.bodyBold,
                    fontSize: 12,
                    color: isExpertProtected ? '#059669' : isUserNoShowForCustomer ? '#C2410C' : '#DC2626',
                  }}
                >
                  Xem chi tiết ca tư vấn
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={14}
                  color={isExpertProtected ? '#059669' : isUserNoShowForCustomer ? '#C2410C' : '#DC2626'}
                />
              </View>
            </TouchableOpacity>
          );
        })}

        {/* ── BANNER NHẮC NHỞ LỊCH HẸN TRỰC TUYẾN SẮP DIỄN RA ── */}
        {upcomingMeeting && upcomingMeeting.hasUpcomingMeeting ? (
          <View
            style={[
              styles.upcomingCard,
              upcomingMeeting.urgencyLevel === 'IN_PROGRESS' && styles.upcomingCardInProgress,
              upcomingMeeting.urgencyLevel === 'OPENED' && styles.upcomingCardOpened,
            ]}
            testID="homeUpcomingMeetingBanner"
          >
            <View style={styles.upcomingHeader}>
              <View
                style={[
                  styles.upcomingBadge,
                  upcomingMeeting.urgencyLevel === 'IN_PROGRESS' && styles.upcomingBadgeInProgress,
                  upcomingMeeting.urgencyLevel === 'OPENED' && styles.upcomingBadgeOpened,
                ]}
              >
                <Ionicons
                  name={
                    upcomingMeeting.urgencyLevel === 'IN_PROGRESS' || upcomingMeeting.urgencyLevel === 'OPENED'
                      ? 'videocam'
                      : 'alarm-outline'
                  }
                  size={12}
                  color="#FFFFFF"
                />
                <Text style={styles.upcomingBadgeText}>
                  {upcomingMeeting.urgencyLevel === 'IN_PROGRESS'
                    ? 'ĐANG DIỄN RA'
                    : upcomingMeeting.urgencyLevel === 'OPENED'
                    ? 'PHÒNG ĐÃ MỞ'
                    : upcomingMeeting.urgencyLevel === 'SOON'
                    ? 'SẮP BẮT ĐẦU'
                    : 'LỊCH HẸN SẮP TỚI'}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => {
                  if (upcomingMeeting.bookingId) {
                    navigation.navigate('BookingDetail', { bookingId: upcomingMeeting.bookingId });
                  }
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.upcomingDetailLink}
                accessibilityRole="button"
                accessibilityLabel="Xem chi tiết lịch hẹn"
              >
                <Text style={styles.upcomingDetailLinkText}>Chi tiết</Text>
                <Ionicons name="chevron-forward" size={12} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.upcomingTitle} numberOfLines={2}>
              {upcomingMeeting.topicTitle || 'Tư vấn trực tuyến cùng chuyên gia thuế'}
            </Text>

            <View style={styles.upcomingMetaRow}>
              <Ionicons name="person-outline" size={13} color="#444444" />
              <Text style={styles.upcomingMetaText} numberOfLines={1}>
                {upcomingMeeting.partnerRole === 'TAXPAYER' ? 'Khách hàng: ' : 'Chuyên gia: '}
                {upcomingMeeting.partnerName || 'Chuyên gia tư vấn'}
              </Text>
            </View>

            <View style={styles.upcomingTimeRow}>
              <View style={styles.upcomingTimePill}>
                <Ionicons name="calendar-outline" size={13} color={theme.colors.primaryDark} />
                <Text style={styles.upcomingTimeText}>
                  {formatVietnameseDate(upcomingMeeting.slotDate ?? undefined)}
                </Text>
              </View>
              <View style={styles.upcomingTimePill}>
                <Ionicons name="time-outline" size={13} color={theme.colors.primaryDark} />
                <Text style={styles.upcomingTimeText}>
                  {formatTimeRange(upcomingMeeting.startTime ?? undefined, upcomingMeeting.endTime ?? undefined)}
                </Text>
              </View>
            </View>

            {upcomingMeeting.reminderMessage ? (
              <Text style={styles.upcomingMessage}>{upcomingMeeting.reminderMessage}</Text>
            ) : null}

            <View style={styles.upcomingActionsRow}>
              {upcomingMeeting.canJoinRoom || upcomingMeeting.isRoomOpen ? (
                <TouchableOpacity
                  style={styles.upcomingJoinBtn}
                  onPress={handleJoinUpcomingMeeting}
                  disabled={joiningMeeting}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Vào phòng tư vấn ngay"
                >
                  {joiningMeeting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="videocam" size={16} color="#FFFFFF" />
                      <Text style={styles.upcomingJoinBtnText}>Vào phòng họp ngay</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.upcomingViewDetailBtn,
                  !(upcomingMeeting.canJoinRoom || upcomingMeeting.isRoomOpen) && styles.upcomingViewDetailBtnFull,
                ]}
                onPress={() => {
                  if (upcomingMeeting.bookingId) {
                    navigation.navigate('BookingDetail', { bookingId: upcomingMeeting.bookingId });
                  }
                }}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Xem chi tiết lịch hẹn"
              >
                <Ionicons name="calendar-outline" size={15} color={theme.colors.primary} />
                <Text style={styles.upcomingViewDetailBtnText}>
                  {upcomingMeeting.canJoinRoom || upcomingMeeting.isRoomOpen
                    ? 'Hồ sơ hẹn'
                    : 'Xem chi tiết'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* ── BANNER TƯ VẤN CHUYÊN GIA THUẾ ── */}
        <View style={styles.consultBannerCard} testID="homeConsultBanner">
          <View style={styles.consultBannerHeader}>
            <View style={styles.consultBannerTag}>
              <Ionicons name="ribbon" size={12} color="#FFFFFF" />
              <Text style={styles.consultBannerTagText}>TƯ VẤN CHUYÊN GIA</Text>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('MyBookings', {})}
              style={styles.myBookingsLink}
              accessibilityRole="button"
              accessibilityLabel="Lịch hẹn của tôi"
            >
              <Ionicons name="calendar-outline" size={13} color={theme.colors.primary} />
              <Text style={styles.myBookingsLinkText}>Lịch hẹn của tôi</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.consultBannerTitle}>Đặt lịch tư vấn thuế cùng chuyên gia</Text>
          <Text style={styles.consultBannerSubtitle}>
            Hỗ trợ giải đáp chuyên sâu về thuế TNCN, quyết toán & hoàn thuế với đội ngũ chuyên gia đã xác thực chứng chỉ hành nghề.
          </Text>
          <View style={styles.consultBannerBtnRow}>
            <TouchableOpacity
              style={styles.consultBannerPrimaryBtn}
              onPress={() => navigation.navigate('ExpertList')}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Tìm và đặt lịch ngay"
            >
              <Ionicons name="search" size={15} color="#FFFFFF" />
              <Text style={styles.consultBannerPrimaryBtnText}>Tìm & Đặt lịch</Text>
            </TouchableOpacity>

            {!isExpert && (
              <TouchableOpacity
                style={styles.consultBannerSecondaryBtn}
                onPress={() => navigation.navigate('ExpertApplication')}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Trở thành chuyên gia"
              >
                <Ionicons name="ribbon-outline" size={15} color={theme.colors.primary} />
                <Text style={styles.consultBannerSecondaryBtnText}>Đăng ký chuyên gia</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.shortcutGrid} testID="homeShortcutGrid">
          <TouchableOpacity
            style={[styles.shortcutCell, styles.shortcutBorderRight, styles.shortcutBorderBottom]}
            onPress={() => navigation.navigate('TaxRegistration')}
            testID="homeTaxRegistrationCard"
            accessibilityRole="button"
            accessibilityLabel="Khai báo NPT"
          >
            <Ionicons name="person-add-outline" size={20} color={theme.colors.primary} />
            <Text style={styles.shortcutLabel}>Khai báo NPT</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.shortcutCell, styles.shortcutBorderBottom]}
            onPress={() => navigation.navigate('LawConditions')}
            testID="homeLawConditionsCard"
            accessibilityRole="button"
            accessibilityLabel="Điều kiện luật"
          >
            <Ionicons name="book-outline" size={20} color={theme.colors.primary} />
            <Text style={styles.shortcutLabel}>Điều kiện luật</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.shortcutCell, styles.shortcutBorderRight, styles.shortcutBorderBottom]}
            onPress={() => navigation.navigate('IncomeSourceList')}
            testID="homeIncomeSourceCard"
            accessibilityRole="button"
            accessibilityLabel="Nơi chi trả"
          >
            <Ionicons name="business-outline" size={20} color={theme.colors.primary} />
            <Text style={styles.shortcutLabel}>Nơi chi trả</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.shortcutCell, styles.shortcutBorderBottom]}
            onPress={() => navigation.navigate('ExpenseList')}
            testID="homeExpenseListCard"
            accessibilityRole="button"
            accessibilityLabel="Hóa đơn chứng từ"
          >
            <Ionicons name="receipt-outline" size={20} color={theme.colors.primary} />
            <Text style={styles.shortcutLabel}>Hóa đơn chứng từ</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.shortcutCell, styles.shortcutBorderRight, styles.shortcutBorderBottom]}
            onPress={() => navigation.navigate('ExpertList')}
            testID="homeExpertListCard"
            accessibilityRole="button"
            accessibilityLabel="Tư vấn chuyên gia"
          >
            <Ionicons name="chatbubbles-outline" size={20} color={theme.colors.primary} />
            <Text style={styles.shortcutLabel}>Tư vấn chuyên gia</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.shortcutCell, styles.shortcutBorderBottom]}
            onPress={() => navigation.navigate('MyBookings', {})}
            testID="homeMyBookingsCard"
            accessibilityRole="button"
            accessibilityLabel="Lịch hẹn tư vấn"
          >
            <Ionicons name="calendar-outline" size={20} color={theme.colors.primary} />
            <Text style={styles.shortcutLabel}>Lịch hẹn tư vấn</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.shortcutCell, styles.shortcutFullWidth]}
            onPress={() => navigation.navigate('SettlementStart')}
            testID="homeSettlementCard"
            accessibilityRole="button"
            accessibilityLabel="Quyết toán thuế"
          >
            <Ionicons name="calculator-outline" size={20} color={theme.colors.primary} />
            <Text style={styles.shortcutLabel}>Quyết toán thuế</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <MainTabBar active="Home" />

      <Modal
        visible={notifModalVisible}
        animationType="fade"
        onRequestClose={() => setNotifModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer} edges={['top', 'left', 'right']}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setNotifModalVisible(false)}
              style={styles.closeModalBtn}
              accessibilityRole="button"
              accessibilityLabel="Đóng"
            >
              <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Thông báo</Text>
            {unreadCount > 0 ? (
              <TouchableOpacity onPress={handleMarkAllAsRead} style={styles.markAllBtn}>
                <Text style={styles.markAllBtnText}>Đọc hết</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.closeModalBtn} />
            )}
          </View>

          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabItem, notifTab === 'ALL' && styles.tabItemActive]}
              onPress={() => setNotifTab('ALL')}
            >
              <Text style={[styles.tabItemText, notifTab === 'ALL' && styles.tabItemTextActive]}>
                Tất cả
              </Text>
              <Text style={[styles.tabCount, notifTab === 'ALL' && styles.tabCountActive]}>
                {notifications.length}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabItem, notifTab === 'UNREAD' && styles.tabItemActive]}
              onPress={() => setNotifTab('UNREAD')}
            >
              <Text style={[styles.tabItemText, notifTab === 'UNREAD' && styles.tabItemTextActive]}>
                Chưa đọc
              </Text>
              <Text style={[styles.tabCount, notifTab === 'UNREAD' && styles.tabCountActive]}>
                {unreadCount}
              </Text>
            </TouchableOpacity>
          </View>

          {loadingNotifs ? (
            <View style={styles.loadingCenter}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.loadingText}>Đang tải thông báo...</Text>
            </View>
          ) : (
            <FlatList
              data={
                notifTab === 'UNREAD'
                  ? notifications.filter((n) => !n.isRead)
                  : notifications
              }
              keyExtractor={(item) => item.notificationId}
              contentContainerStyle={styles.notifListContent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshingNotifs}
                  onRefresh={handleRefreshNotifications}
                  colors={[theme.colors.primary]}
                />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    {notifTab === 'UNREAD'
                      ? 'Không còn thông báo chưa đọc.'
                      : 'Chưa có thông báo.'}
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const isAgeReminder =
                  item.notificationType === 'AGE_TRANSITION_ALERT' ||
                  item.title.toLowerCase().includes('18 tuổi');
                const consultationTarget = extractConsultationBookingTarget(item);
                const isNoShowAlert = [
                  'USER_NO_SHOW',
                  'USER_NO_SHOW_CLOSED',
                  'USER_NO_SHOW_EXPERT_NOTIFIED',
                  'EXPERT_NO_SHOW_REFUND',
                  'EXPERT_NO_SHOW_REFUNDED',
                  'EXPERT_NO_SHOW_PENALTY',
                ].includes(item.notificationType);
                return (
                  <TouchableOpacity
                    style={[
                      styles.notifCard,
                      !item.isRead && styles.notifCardUnread,
                      isNoShowAlert && !item.isRead && { borderColor: '#FED7AA', backgroundColor: '#FFFBF5' },
                    ]}
                    activeOpacity={0.7}
                    onPress={() => handleNotificationPress(item)}
                  >
                    <Text style={styles.notifTime}>
                      {new Date(item.createdAt).toLocaleDateString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                    <Text
                      style={[
                        styles.notifItemTitle,
                        !item.isRead && styles.notifItemTitleUnread,
                        isNoShowAlert && { color: '#9A3412' },
                      ]}
                      numberOfLines={2}
                    >
                      {humanizeGroupCodes(item.title)}
                    </Text>
                    <Text style={styles.notifMessage} numberOfLines={4}>
                      {humanizeGroupCodes(item.message)}
                    </Text>
                    {isAgeReminder ? (
                      <Text style={styles.notifActionPrompt}>Bổ sung giấy tờ</Text>
                    ) : consultationTarget.isConsultationNotif ? (
                      <Text style={styles.notifActionPrompt}>Xem chi tiết ca tư vấn →</Text>
                    ) : null}
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </SafeAreaView>
      </Modal>

      <Dialog
        visible={!!changeGroupConfirm}
        title={changeGroupConfirm?.confirmTitle ?? ''}
        message={changeGroupConfirm?.confirmMessage ?? ''}
        detailLabel="Nhóm đích"
        detail={changeGroupConfirm?.newGroupLabel}
        primaryLabel="Xác nhận"
        secondaryLabel="Hủy"
        onPrimary={() => {
          void handleConfirmReminderChangeGroup();
        }}
        onSecondary={() => setChangeGroupConfirm(null)}
        onRequestClose={() => setChangeGroupConfirm(null)}
        testID="homeReminderChangeGroupDialog"
      />

      <Dialog
        visible={!!infoDialog}
        title={infoDialog?.title ?? ''}
        message={infoDialog?.message ?? ''}
        primaryLabel="Đóng"
        onPrimary={() => setInfoDialog(null)}
        onRequestClose={() => setInfoDialog(null)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    zIndex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    lineHeight: 20,
    color: '#FFFFFF',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  welcomeText: {
    ...theme.typography.helper,
    color: '#5A4A22',
  },
  userName: {
    fontFamily: fonts.bodyBold,
    fontSize: 17,
    lineHeight: 22,
    color: theme.colors.textPrimary,
  },
  bellBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  unreadDotHeader: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.error,
    borderWidth: 1.5,
    borderColor: '#ECE9C2',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  deductionBlock: {
    marginTop: 46,
    alignItems: 'center',
    gap: 4,
  },
  deductionLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    lineHeight: 16,
    color: '#5A4A22',
  },
  deductionAmount: {
    ...theme.typography.amountLarge,
    color: theme.colors.primaryDark,
    fontVariant: ['tabular-nums'],
  },
  deductionMeta: {
    ...theme.typography.helper,
    color: theme.colors.textSecondary,
  },
  rule: {
    marginTop: 24,
  },
  todoHeader: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  todoTitle: {
    ...theme.typography.sectionTitle,
    color: theme.colors.textPrimary,
  },
  todoCount: {
    ...theme.typography.fieldLabel,
    color: theme.colors.primary,
  },
  todoEmpty: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  todoEmptyText: {
    ...theme.typography.body,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  todoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  todoIndex: {
    ...theme.typography.indexNumber,
    color: theme.colors.gold,
    width: 28,
  },
  todoBody: {
    flex: 1,
    gap: 3,
  },
  todoItemTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textPrimary,
  },
  todoItemSubtitle: {
    ...theme.typography.helper,
    color: theme.colors.textSecondary,
  },
  consultBannerCard: {
    marginTop: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#E8D5B5',
    ...theme.shadows.card,
  },
  // Upcoming meeting banner styles
  upcomingCard: {
    marginTop: 18,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
    ...theme.shadows.card,
  },
  upcomingCardOpened: {
    borderColor: '#A7F3D0',
    backgroundColor: '#F0FDF4',
  },
  upcomingCardInProgress: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  upcomingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  upcomingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D97706',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 4,
  },
  upcomingBadgeOpened: {
    backgroundColor: '#059669',
  },
  upcomingBadgeInProgress: {
    backgroundColor: '#DC2626',
  },
  upcomingBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  upcomingDetailLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  upcomingDetailLinkText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: theme.colors.primary,
  },
  upcomingTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 15,
    color: theme.colors.primaryDark,
    lineHeight: 20,
    marginBottom: 6,
  },
  upcomingMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  upcomingMetaText: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: '#333333',
    flex: 1,
  },
  upcomingTimeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  upcomingTimePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  upcomingTimeText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: theme.colors.textPrimary,
  },
  upcomingMessage: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#4B5563',
    lineHeight: 17,
    marginBottom: 10,
  },
  upcomingActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  upcomingJoinBtn: {
    flex: 1.4,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    borderRadius: 8,
    gap: 6,
    ...theme.shadows.button,
  },
  upcomingJoinBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: '#FFFFFF',
  },
  upcomingViewDetailBtn: {
    flex: 1,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: 8,
    gap: 5,
  },
  upcomingViewDetailBtnFull: {
    flex: 1,
  },
  upcomingViewDetailBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: theme.colors.primary,
  },
  consultBannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  consultBannerTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 4,
  },
  consultBannerTagText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  myBookingsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  myBookingsLinkText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: theme.colors.primary,
  },
  consultBannerTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 15,
    color: theme.colors.primaryDark,
    lineHeight: 20,
    marginBottom: 4,
  },
  consultBannerSubtitle: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#555555',
    lineHeight: 17,
    marginBottom: 12,
  },
  consultBannerBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  consultBannerPrimaryBtn: {
    flex: 1,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    gap: 6,
    ...theme.shadows.button,
  },
  consultBannerPrimaryBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: '#FFFFFF',
  },
  consultBannerSecondaryBtn: {
    flex: 1,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: 8,
    gap: 5,
  },
  consultBannerSecondaryBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: theme.colors.primary,
  },
  shortcutGrid: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    flexWrap: 'wrap',
    overflow: 'hidden',
  },
  shortcutCell: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  shortcutBorderRight: {
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
  },
  shortcutBorderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  shortcutFullWidth: {
    width: '100%',
  },
  shortcutLabel: {
    ...theme.typography.fieldLabel,
    color: theme.colors.textPrimary,
    flexShrink: 1,
  },

  // Notification modal (giữ logic cũ)
  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
  modalTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.serifBold,
    fontSize: 20,
    lineHeight: 26,
    color: theme.colors.textPrimary,
  },
  markAllBtn: {
    width: 72,
    height: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 8,
  },
  markAllBtnText: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    color: theme.colors.primary,
  },
  closeModalBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 22,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    paddingVertical: 10,
    marginRight: 22,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
    marginBottom: -1,
  },
  tabItemActive: {
    borderBottomColor: theme.colors.gold,
  },
  tabItemText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  tabItemTextActive: {
    fontFamily: fonts.bodySemi,
    color: theme.colors.textPrimary,
  },
  tabCount: {
    fontFamily: fonts.serif,
    fontSize: 13,
    color: '#999999',
  },
  tabCountActive: {
    color: theme.colors.gold,
  },
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  notifListContent: {
    paddingHorizontal: 22,
    paddingBottom: 32,
    flexGrow: 1,
  },
  emptyContainer: {
    paddingTop: 48,
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 22,
    color: theme.colors.textSecondary,
  },
  notifCard: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: 4,
  },
  notifCardUnread: {
    borderLeftWidth: 2,
    borderLeftColor: theme.colors.primary,
    paddingLeft: 12,
  },
  notifItemTitle: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 21,
    color: theme.colors.textPrimary,
  },
  notifItemTitleUnread: {
    fontFamily: fonts.bodySemi,
  },
  notifMessage: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textSecondary,
  },
  notifTime: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
    color: '#8A8175',
  },
  notifActionPrompt: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.primary,
    marginTop: 4,
  },
});
