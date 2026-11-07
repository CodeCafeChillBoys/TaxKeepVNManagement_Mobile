import React, { useState, useCallback, useMemo, memo } from 'react';
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
  Platform,
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
import { taxSettlementApi } from '../../api/taxSettlementApi';
import type { TaxDeadlineCountdown } from '../../types/taxSettlement';
import { deadlineDisplay } from './homeDeadlineCountdown';
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
import { useToast } from '../../components/ui/Toast';
import { humanizeGroupCodes } from '../dependent/dependentGroupUtils';
import { formatPersonName } from '../../utils/formatPersonName';
import { sanitizeUiMessage } from '../../utils/friendlyError';
import { consultationApi } from '../../api/consultationApi';
import type { UpcomingMeetingReminderDto } from '../../types/consultation';
import { formatVietnameseDate, formatTimeRange } from '../../types/consultation';

const DEADLINE_COLORS = {
  normal: theme.colors.primaryDark,
  warning: theme.colors.warning,
  danger: theme.colors.error,
};

const NO_SHOW_TYPES = new Set([
  'USER_NO_SHOW',
  'USER_NO_SHOW_CLOSED',
  'USER_NO_SHOW_EXPERT_NOTIFIED',
  'EXPERT_NO_SHOW_REFUND',
  'EXPERT_NO_SHOW_REFUNDED',
  'EXPERT_NO_SHOW_PENALTY',
]);

const CONSULTATION_NOTIF_TYPES = new Set([
  ...NO_SHOW_TYPES,
  'CONSULTATION_COMPLETED',
  'CONSULTATION_BOOKING',
  'DISPUTE_RESOLVED',
]);

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

function extractConsultationTarget(item: NotificationItem): {
  bookingId?: string;
  isExpertView: boolean;
  isConsultationNotif: boolean;
} {
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
    CONSULTATION_NOTIF_TYPES.has(type) ||
    url.includes('/consultation') ||
    url.includes('/bookings');

  return {
    bookingId: undefined,
    isExpertView: isExpertType,
    isConsultationNotif,
  };
}

const NotificationRow = memo(function NotificationRow({
  item,
  onPress,
}: {
  item: NotificationItem;
  onPress: (item: NotificationItem) => void;
}) {
  const isAgeReminder =
    item.notificationType === 'AGE_TRANSITION_ALERT' ||
    item.title.toLowerCase().includes('18 tuổi');
  const consultationTarget = extractConsultationTarget(item);
  const isNoShowAlert = NO_SHOW_TYPES.has(item.notificationType);

  return (
    <TouchableOpacity
      style={[
        styles.notifCard,
        !item.isRead && styles.notifCardUnread,
        isNoShowAlert && !item.isRead && styles.notifCardNoShowUnread,
      ]}
      activeOpacity={0.7}
      onPress={() => onPress(item)}
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
          isNoShowAlert && styles.notifItemTitleNoShow,
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
});

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const { toast } = useToast();
  const user = useAuthStore((s) => s.user);
  const userRole = (user?.role || '').toLowerCase();
  const isExpert = userRole === 'expert' || userRole.includes('expert');

  const [reminders, setReminders] = useState<AgeReminderItemDto[]>([]);
  const [dependents, setDependents] = useState<DependentItem[]>([]);
  const [reminderPatching, setReminderPatching] = useState(false);
  const [changeGroupConfirm, setChangeGroupConfirm] =
    useState<HomeReminderConfirmPlan | null>(null);

  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notifModalVisible, setNotifModalVisible] = useState<boolean>(false);
  const [notifTab, setNotifTab] = useState<'ALL' | 'UNREAD'>('ALL');
  const [loadingNotifs, setLoadingNotifs] = useState<boolean>(false);
  const [refreshingNotifs, setRefreshingNotifs] = useState<boolean>(false);
  const [deadline, setDeadline] = useState<TaxDeadlineCountdown | null>(null);
  const [promptAnswered, setPromptAnswered] = useState(false);
  const [upcomingMeeting, setUpcomingMeeting] = useState<UpcomingMeetingReminderDto | null>(null);
  const [joiningMeeting, setJoiningMeeting] = useState<boolean>(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;

      const loadDashboard = async () => {
        const [
          deadlineRes,
          remindersRes,
          depsRes,
          unreadRes,
          notifRes,
          upcomingRes,
          profileRes,
        ] = await Promise.allSettled([
          taxSettlementApi.getDeadlineCountdown(),
          dependentDocumentApi.getAgeTransitionReminders(),
          dependentDocumentApi.getDependents({ size: 50 }),
          notificationApi.getUnreadCount(),
          notificationApi.getNotifications({ size: 20 }),
          consultationApi.getUpcomingMeetingReminder(),
          profileApi.getProfile(),
        ]);

        if (!alive) return;

        if (deadlineRes.status === 'fulfilled') {
          setDeadline(deadlineRes.value);
        } else if (__DEV__) {
          console.warn('HomeScreen deadline countdown error:', deadlineRes.reason);
        }

        const remindersData = remindersRes.status === 'fulfilled' ? remindersRes.value : [];
        const deps = depsRes.status === 'fulfilled' ? depsRes.value : [];
        const pendingUpload = buildPendingUploadAgeReminders(deps);
        setReminders(mergeAgeTransitionReminders(remindersData, pendingUpload));
        setDependents(deps);

        if (unreadRes.status === 'fulfilled') {
          setUnreadCount(unreadRes.value);
        }

        if (notifRes.status === 'fulfilled' && notifRes.value?.items) {
          setNotifications(notifRes.value.items);
        }

        if (upcomingRes.status === 'fulfilled') {
          setUpcomingMeeting(upcomingRes.value?.hasUpcomingMeeting ? upcomingRes.value : null);
        } else {
          setUpcomingMeeting(null);
        }

        if (profileRes.status === 'fulfilled') {
          const prof = profileRes.value;
          const currentUser = useAuthStore.getState().user;
          if (prof?.userRole && currentUser && currentUser.role !== prof.userRole) {
            useAuthStore.setState({
              user: { ...currentUser, role: prof.userRole },
            });
          }
        }
      };

      void loadDashboard();

      return () => {
        alive = false;
      };
    }, [])
  );

  const displayName = formatPersonName(user?.fullName) || 'Người nộp thuế';
  const deadlineView = deadline ? deadlineDisplay(deadline) : null;
  const promptTaxYear = deadline?.shouldPromptSettlementCheck ? deadline.promptTaxYear : null;

  const answerSettlementPrompt = useCallback(
    (response: 'YES' | 'NO' | 'DISMISSED') => {
      if (!promptTaxYear) return;
      setPromptAnswered(true);
      taxSettlementApi
        .acknowledgeSettlementPrompt(promptTaxYear, response)
        .catch((err) => {
          if (__DEV__) console.warn('HomeScreen acknowledge prompt error:', err);
        });
      if (response === 'NO') navigation.navigate('SettlementStart');
    },
    [navigation, promptTaxYear]
  );

  const todoItems = useMemo((): TodoItem[] => {
    const items: TodoItem[] = [];
    const reminderIds = new Set(reminders.map((r) => r.dependentId));

    for (const r of reminders) {
      const name = formatPersonName(r.fullName);
      const isSoon = r.transitionStatus === 'TURNING_18_SOON';
      items.push({
        id: `age-${r.dependentId}`,
        title: isSoon ? `${name} sắp tròn 18 tuổi` : `${name} đã tròn 18 tuổi`,
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

  const handleOpenNotifications = useCallback(async () => {
    setNotifModalVisible(true);
    setLoadingNotifs(true);
    try {
      const data = await notificationApi.getNotifications({ size: 50 });
      setNotifications(data.items);
      const unread = data.items.filter((i) => !i.isRead).length;
      setUnreadCount(unread);
    } catch (err) {
      if (__DEV__) console.warn('handleOpenNotifications error:', err);
    } finally {
      setLoadingNotifs(false);
    }
  }, []);

  const handleRefreshNotifications = useCallback(async () => {
    setRefreshingNotifs(true);
    try {
      const data = await notificationApi.getNotifications({ size: 50 });
      setNotifications(data.items);
      const unread = data.items.filter((i) => !i.isRead).length;
      setUnreadCount(unread);
    } catch (err) {
      if (__DEV__) console.warn('handleRefreshNotifications error:', err);
    } finally {
      setRefreshingNotifs(false);
    }
  }, []);

  const handleMarkAsRead = useCallback(async (item: NotificationItem) => {
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
  }, []);

  const handleMarkAllAsRead = useCallback(async () => {
    const unreadItems = notifications.filter((n) => !n.isRead);
    if (unreadItems.length === 0) return;

    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);

    await Promise.allSettled(unreadItems.map((n) => notificationApi.markAsRead(n.notificationId)));
  }, [notifications]);

  const unreadNoShowNotifications = useMemo(
    () => notifications.filter((n) => !n.isRead && NO_SHOW_TYPES.has(n.notificationType)),
    [notifications]
  );

  const filteredNotifications = useMemo(
    () => (notifTab === 'UNREAD' ? notifications.filter((n) => !n.isRead) : notifications),
    [notifTab, notifications]
  );

  const handleNotificationPress = useCallback(
    async (item: NotificationItem) => {
      await handleMarkAsRead(item);

      const consultationTarget = extractConsultationTarget(item);
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
    },
    [handleMarkAsRead, navigation]
  );

  const handleReminderUploadPress = useCallback(
    (item: AgeReminderItemDto) => {
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
    },
    [navigation, reminderPatching]
  );

  const handleConfirmReminderChangeGroup = useCallback(async () => {
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
        toast.error(
          sanitizeUiMessage(result.message, 'Vui lòng kiểm tra lại và thử lại.'),
          'Chưa chuyển được nhóm điều kiện'
        );
        return;
      }
      navigation.navigate(result.navigation.screen, result.navigation.params);
    } finally {
      setReminderPatching(false);
    }
  }, [changeGroupConfirm, navigation, reminderPatching, toast]);

  const handleTodoPress = useCallback(
    (item: TodoItem) => {
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
    },
    [handleReminderUploadPress, navigation]
  );

  const handleJoinUpcomingMeeting = useCallback(async () => {
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
    } catch {
      if (upcomingMeeting.roomUrl) {
        await Linking.openURL(upcomingMeeting.roomUrl).catch(() => {});
      } else {
        navigation.navigate('BookingDetail', { bookingId: upcomingMeeting.bookingId });
      }
    } finally {
      setJoiningMeeting(false);
    }
  }, [navigation, upcomingMeeting]);

  const renderNotifItem = useCallback(
    ({ item }: { item: NotificationItem }) => (
      <NotificationRow item={item} onPress={handleNotificationPress} />
    ),
    [handleNotificationPress]
  );

  const notifKeyExtractor = useCallback((item: NotificationItem) => item.notificationId, []);

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

      <View style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.contentWrap}>
            <View style={styles.deductionBlock} testID="homeDeadlineCountdown">
              <Text style={styles.deductionLabel}>Hạn nộp quyết toán thuế TNCN</Text>
              <Text
                style={[styles.deductionAmount, deadlineView && { color: DEADLINE_COLORS[deadlineView.tone] }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
                testID="homeDeadlineDays"
              >
                {deadlineView?.headline ?? '—'}
              </Text>
              {deadlineView ? (
                <Text style={styles.deductionMeta} numberOfLines={2}>
                  {deadlineView.meta}
                </Text>
              ) : null}
            </View>

            <GoldDoubleRule style={styles.rule} />

            <View style={styles.todoHeader}>
              <Text style={styles.todoTitle}>Cần xử lý</Text>
              <Text style={styles.todoCount}>{todoItems.length} việc</Text>
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
                  <Text style={styles.todoIndex}>{String(index + 1).padStart(2, '0')}</Text>
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

            {/* Banner cảnh báo ca tư vấn đóng do vắng mặt chưa đọc */}
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
                  style={[
                    styles.noShowCard,
                    isExpertProtected
                      ? styles.noShowCardProtected
                      : isUserNoShowForCustomer
                      ? styles.noShowCardCustomer
                      : styles.noShowCardDanger,
                  ]}
                  testID={`homeNoShowAlert_${notif.notificationId}`}
                >
                  <View style={styles.noShowHeadRow}>
                    <Ionicons
                      name={isExpertProtected ? 'shield-checkmark' : 'alert-circle'}
                      size={18}
                      color={isExpertProtected ? '#059669' : isUserNoShowForCustomer ? '#C2410C' : '#DC2626'}
                    />
                    <Text
                      style={[
                        styles.noShowTitle,
                        isExpertProtected
                          ? styles.noShowTitleProtected
                          : isUserNoShowForCustomer
                          ? styles.noShowTitleCustomer
                          : styles.noShowTitleDanger,
                      ]}
                    >
                      {humanizeGroupCodes(notif.title)}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.noShowBody,
                      isExpertProtected
                        ? styles.noShowBodyProtected
                        : isUserNoShowForCustomer
                        ? styles.noShowBodyCustomer
                        : styles.noShowBodyDanger,
                    ]}
                  >
                    {humanizeGroupCodes(notif.message)}
                  </Text>
                  <View style={styles.noShowLinkRow}>
                    <Text
                      style={[
                        styles.noShowLinkText,
                        {
                          color: isExpertProtected
                            ? '#059669'
                            : isUserNoShowForCustomer
                            ? '#C2410C'
                            : '#DC2626',
                        },
                      ]}
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

            {/* Banner lịch hẹn trực tuyến sắp diễn ra */}
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
                      !(upcomingMeeting.canJoinRoom || upcomingMeeting.isRoomOpen) &&
                        styles.upcomingViewDetailBtnFull,
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

            {/* Banner tư vấn chuyên gia thuế */}
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
                Hỗ trợ giải đáp chuyên sâu về thuế TNCN, quyết toán & hoàn thuế với đội ngũ chuyên gia đã xác
                thực chứng chỉ hành nghề.
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
          </View>
        </ScrollView>

        {/* Nút nổi mở trợ lý tra cứu thuế */}
        <TouchableOpacity
          style={styles.chatFab}
          onPress={() => navigation.navigate('TaxChat')}
          testID="homeTaxChatFab"
          accessibilityRole="button"
          accessibilityLabel="Trợ lý hỏi đáp thuế"
        >
          <Ionicons name="chatbubbles" size={20} color={theme.colors.textOnPrimary} />
          <Text style={styles.chatFabText}>Hỏi đáp thuế</Text>
        </TouchableOpacity>
      </View>

      <MainTabBar active="Home" />

      <Modal
        visible={notifModalVisible}
        animationType="fade"
        onRequestClose={() => setNotifModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer} edges={['top', 'left', 'right', 'bottom']}>
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
              data={filteredNotifications}
              keyExtractor={notifKeyExtractor}
              renderItem={renderNotifItem}
              contentContainerStyle={styles.notifListContent}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={5}
              removeClippedSubviews={Platform.OS === 'android'}
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
        primaryLabel="Chuyển nhóm"
        secondaryLabel="Giữ lại"
        onPrimary={() => {
          void handleConfirmReminderChangeGroup();
        }}
        onSecondary={() => setChangeGroupConfirm(null)}
        onRequestClose={() => setChangeGroupConfirm(null)}
        testID="homeReminderChangeGroupDialog"
      />

      <Dialog
        visible={!!promptTaxYear && !promptAnswered}
        title={`Quyết toán thuế TNCN năm ${promptTaxYear ?? ''}`}
        message={deadline?.promptQuestion ?? 'Bạn đã quyết toán thuế chưa?'}
        primaryLabel="Đã quyết toán"
        secondaryLabel="Chưa, quyết toán ngay"
        onPrimary={() => answerSettlementPrompt('YES')}
        onSecondary={() => answerSettlementPrompt('NO')}
        onRequestClose={() => answerSettlementPrompt('DISMISSED')}
        testID="homeSettlementPromptDialog"
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
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 88,
  },
  contentWrap: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  chatFab: {
    position: 'absolute',
    right: 20,
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 52,
    paddingHorizontal: 18,
    borderRadius: 26,
    backgroundColor: theme.colors.primary,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  chatFabText: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    color: theme.colors.textOnPrimary,
  },
  deductionBlock: {
    marginTop: 40,
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
    lineHeight: 50,
    alignSelf: 'stretch',
    textAlign: 'center',
    color: theme.colors.primaryDark,
    fontVariant: ['tabular-nums'],
  },
  deductionMeta: {
    ...theme.typography.helper,
    color: theme.colors.textSecondary,
    textAlign: 'center',
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
  noShowCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    marginBottom: 4,
  },
  noShowCardProtected: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  noShowCardCustomer: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
  },
  noShowCardDanger: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  noShowHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  noShowTitle: {
    flex: 1,
    fontFamily: fonts.serifBold,
    fontSize: 14,
  },
  noShowTitleProtected: { color: '#065F46' },
  noShowTitleCustomer: { color: '#9A3412' },
  noShowTitleDanger: { color: '#991B1B' },
  noShowBody: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: 8,
  },
  noShowBodyProtected: { color: '#047857' },
  noShowBodyCustomer: { color: '#C2410C' },
  noShowBodyDanger: { color: '#B91C1C' },
  noShowLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  noShowLinkText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
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
    flexWrap: 'wrap',
    gap: 6,
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
    flexWrap: 'wrap',
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
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 2,
  },
  upcomingJoinBtn: {
    flex: 1.4,
    minWidth: 140,
    minHeight: 40,
    paddingHorizontal: 10,
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
    flexShrink: 1,
  },
  upcomingViewDetailBtn: {
    flex: 1,
    minWidth: 110,
    minHeight: 40,
    paddingHorizontal: 10,
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
    flexShrink: 1,
  },
  consultBannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
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
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 2,
  },
  consultBannerPrimaryBtn: {
    flex: 1,
    minWidth: 130,
    minHeight: 40,
    paddingHorizontal: 10,
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
    flexShrink: 1,
  },
  consultBannerSecondaryBtn: {
    flex: 1,
    minWidth: 130,
    minHeight: 40,
    paddingHorizontal: 10,
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
    flexShrink: 1,
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
    minWidth: 72,
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
  notifCardNoShowUnread: {
    borderColor: '#FED7AA',
    backgroundColor: '#FFFBF5',
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
  notifItemTitleNoShow: {
    color: '#9A3412',
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
