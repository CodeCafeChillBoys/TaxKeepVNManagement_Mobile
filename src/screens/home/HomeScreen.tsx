import React, { useState, useCallback, useMemo, useRef, useEffect, memo } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
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
import { useNavigation, useRoute, useFocusEffect, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { useAuthStore } from '../../stores/useAuthStore';
import { RootNavigationProp, RootStackParamList } from '../../navigation/types';
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
import { buildProofDocumentsParams } from '../dependent/proofDocumentsParams';
import { formatPersonName } from '../../utils/formatPersonName';
import { sanitizeUiMessage } from '../../utils/friendlyError';
import { consultationApi } from '../../api/consultationApi';
import type { UpcomingMeetingReminderDto } from '../../types/consultation';
import { formatVietnameseDate, formatTimeRange } from '../../types/consultation';
import { storageHelper } from '../../api/apiClient';
import { normalizeVietnameseText } from '../../constants/vietnamProvinces';

const CONSULT_BANNER_IMAGE = require('../../../assets/brand/consult-banner.jpg');
const EXPERT_PARTNER_BANNER_IMAGE = require('../../../assets/brand/expert-partner-banner.jpg');
const FAVORITE_UTILITIES_STORAGE_KEY = 'taxkeep_favorite_utilities';

type HomeUtilityItem = {
  id: string;
  label: string;
  keywords: string;
  icon: keyof typeof Ionicons.glyphMap;
  inServiceGroup?: boolean;
  testID?: string;
  onNavigate: (nav: RootNavigationProp, isExpert: boolean) => void;
};

const ALL_HOME_UTILITIES: HomeUtilityItem[] = [
  {
    id: 'tax_registration',
    label: 'Khai báo người phụ thuộc',
    keywords: 'khai bao npt nguoi phu thuoc giam tru gia canh',
    icon: 'person-add-outline',
    inServiceGroup: true,
    testID: 'homeTaxRegistrationCard',
    onNavigate: (nav) => nav.navigate('TaxRegistration'),
  },
  {
    id: 'settlement_start',
    label: 'Quyết toán thuế',
    keywords: 'quyet toan thue tncn hoan thue to khai',
    icon: 'calculator-outline',
    inServiceGroup: true,
    testID: 'homeSettlementCard',
    onNavigate: (nav) => nav.navigate('SettlementStart'),
  },
  {
    id: 'expense_list',
    label: 'Hóa đơn chứng từ',
    keywords: 'hoa don chung tu khau tru tai lieu',
    icon: 'receipt-outline',
    inServiceGroup: true,
    testID: 'homeExpenseListCard',
    onNavigate: (nav) => nav.navigate('ExpenseList'),
  },
  {
    id: 'expert_list',
    label: 'Tư vấn chuyên gia',
    keywords: 'tu van chuyen gia dat lich hoi dap',
    icon: 'chatbubbles-outline',
    inServiceGroup: true,
    testID: 'homeExpertListCard',
    onNavigate: (nav) => nav.navigate('ExpertList'),
  },
  {
    id: 'income_source',
    label: 'Nơi chi trả',
    keywords: 'noi chi tra nguon thu nhap cong ty luong',
    icon: 'business-outline',
    inServiceGroup: true,
    testID: 'homeIncomeSourceCard',
    onNavigate: (nav) => nav.navigate('IncomeSourceList'),
  },
  {
    id: 'my_bookings',
    label: 'Lịch hẹn tư vấn',
    keywords: 'lich hen tu van cuoc hop chuyen gia',
    icon: 'calendar-outline',
    inServiceGroup: true,
    testID: 'homeMyBookingsCard',
    onNavigate: (nav) => nav.navigate('MyBookings', {}),
  },
  {
    id: 'law_conditions',
    label: 'Điều kiện luật',
    keywords: 'dieu kien luat thue quy dinh van ban',
    icon: 'book-outline',
    inServiceGroup: true,
    testID: 'homeLawConditionsCard',
    onNavigate: (nav) => nav.navigate('LawConditions'),
  },
  {
    id: 'profile_cccd',
    label: 'Hồ sơ cá nhân',
    keywords: 'ho so ca nhan the can cuoc cccd dinh danh',
    icon: 'id-card-outline',
    onNavigate: (nav) => nav.navigate('Profile'),
  },
  {
    id: 'dependent_list',
    label: 'Người phụ\nthuộc',
    keywords: 'danh sach nguoi phu thuoc con cai cha me',
    icon: 'heart-outline',
    onNavigate: (nav) => nav.navigate('DependentList'),
  },
  {
    id: 'expense_upload',
    label: 'Tải lên\nchứng từ',
    keywords: 'tai len upload chung tu quet ocr',
    icon: 'cloud-upload-outline',
    onNavigate: (nav) => nav.navigate('ExpenseUpload'),
  },
  {
    id: 'wallet_taxkeep',
    label: 'Ví điện tử\nTaxKeep',
    keywords: 'vi dien tu taxkeep nap tien rut tien so du',
    icon: 'wallet-outline',
    onNavigate: (nav, isExp) =>
      nav.navigate('Wallet', { walletType: isExp ? 'EXPERT' : 'USER' }),
  },
  {
    id: 'tax_chat_ai',
    label: 'Trợ lý\nTaxKeep VN',
    keywords: 'tro ly taxkeep vn ai thue chatbot hoi dap tu van tu dong',
    icon: 'sparkles-outline',
    onNavigate: (nav) => nav.navigate('TaxChat'),
  },
  {
    id: 'subscription_my',
    label: 'Gói thành\nviên',
    keywords: 'goi thanh vien nang cap dich vu',
    icon: 'ribbon-outline',
    onNavigate: (nav) => nav.navigate('SubscriptionMy'),
  },
  {
    id: 'settings',
    label: 'Cài đặt',
    keywords: 'cai dat giao dien sang toi doi mat khau huong dan dieu khoan su dung',
    icon: 'settings-outline',
    onNavigate: (nav) => nav.navigate('Settings'),
  },
];

const DEFAULT_FAVORITE_IDS = [
  'profile_cccd',
  'settlement_start',
  'expense_list',
  'income_source',
  'my_bookings',
  'dependent_list',
];

const SERVICE_GROUP_ITEMS = ALL_HOME_UTILITIES.filter((u) => u.inServiceGroup);

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
  const route = useRoute<RouteProp<RootStackParamList, 'Home'>>();
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
  const [bannerSlideIndex, setBannerSlideIndex] = useState<number>(0);
  const [bannerCardWidth, setBannerCardWidth] = useState<number>(0);
  const bannerScrollRef = useRef<any>(null);

  const [favoriteIds, setFavoriteIds] = useState<string[]>(DEFAULT_FAVORITE_IDS);
  const [editFavoritesVisible, setEditFavoritesVisible] = useState<boolean>(false);
  const [draftFavoriteIds, setDraftFavoriteIds] = useState<string[]>(DEFAULT_FAVORITE_IDS);
  const [searchModalVisible, setSearchModalVisible] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        const raw = await storageHelper.getItem(FAVORITE_UTILITIES_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const validIds = parsed.filter((id) =>
              ALL_HOME_UTILITIES.some((u) => u.id === id)
            );
            if (validIds.length > 0) {
              setFavoriteIds(validIds);
            }
          }
        }
      } catch {}
    })();
  }, []);

  const favoriteUtilities = useMemo(
    () =>
      favoriteIds
        .map((id) => ALL_HOME_UTILITIES.find((u) => u.id === id))
        .filter((u): u is HomeUtilityItem => Boolean(u)),
    [favoriteIds]
  );

  const filteredSearchUtilities = useMemo(() => {
    const q = normalizeVietnameseText(searchQuery);
    if (!q) return ALL_HOME_UTILITIES;
    return ALL_HOME_UTILITIES.filter((item) => {
      const labelNorm = normalizeVietnameseText(item.label.replace(/\n/g, ' '));
      return labelNorm.includes(q) || item.keywords.includes(q);
    });
  }, [searchQuery]);

  const handleOpenEditFavorites = useCallback(() => {
    setDraftFavoriteIds(favoriteIds);
    setEditFavoritesVisible(true);
  }, [favoriteIds]);

  const handleToggleDraftFavorite = useCallback((id: string) => {
    setDraftFavoriteIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev;
        return prev.filter((item) => item !== id);
      }
      return [...prev, id];
    });
  }, []);

  const handleSaveFavorites = useCallback(async () => {
    setFavoriteIds(draftFavoriteIds);
    setEditFavoritesVisible(false);
    try {
      await storageHelper.setItem(
        FAVORITE_UTILITIES_STORAGE_KEY,
        JSON.stringify(draftFavoriteIds)
      );
    } catch {}
  }, [draftFavoriteIds]);

  const bannerInnerWidth = Math.max(0, bannerCardWidth - 2);
  const slide1Height =
    bannerInnerWidth > 0 ? Math.round(bannerInnerWidth * (341 / 1024)) : 0;
  const slide2Height =
    bannerInnerWidth > 0 ? Math.round(bannerInnerWidth * (576 / 1024)) : 0;
  const activeBannerHeight =
    bannerSlideIndex === 0 ? slide1Height : slide2Height;

  const goToBannerSlide = useCallback(
    (index: number) => {
      setBannerSlideIndex(index);
      if (bannerInnerWidth > 0 && bannerScrollRef.current) {
        bannerScrollRef.current.scrollTo({
          x: index * bannerInnerWidth,
          animated: true,
        });
      }
    },
    [bannerInnerWidth]
  );

  // Giữ vị trí scroll khớp chính xác khi đổi kích thước màn hình / xoay ngang
  useEffect(() => {
    if (!isExpert && bannerInnerWidth > 0 && bannerScrollRef.current) {
      bannerScrollRef.current.scrollTo({
        x: bannerSlideIndex * bannerInnerWidth,
        animated: false,
      });
    }
  }, [bannerInnerWidth, isExpert]);

  useEffect(() => {
    if (isExpert) {
      setBannerSlideIndex(0);
      return;
    }
    if (bannerInnerWidth <= 0) return;

    const timer = setInterval(() => {
      setBannerSlideIndex((prev) => {
        const next = prev === 0 ? 1 : 0;
        bannerScrollRef.current?.scrollTo({
          x: next * bannerInnerWidth,
          animated: true,
        });
        return next;
      });
    }, 5500);

    return () => clearInterval(timer);
  }, [bannerInnerWidth, isExpert]);

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

  React.useEffect(() => {
    if (route.params?.openNotifications) {
      navigation.setParams({ openNotifications: undefined });
      void handleOpenNotifications();
    }
  }, [handleOpenNotifications, navigation, route.params?.openNotifications]);

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
        navigation.navigate('ProofDocuments', buildProofDocumentsParams(item.dependent));
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
          style={styles.searchHeaderBtn}
          onPress={() => {
            setSearchQuery('');
            setSearchModalVisible(true);
          }}
          testID="homeSearchUtilityBtn"
          accessibilityRole="button"
          accessibilityLabel="Tìm kiếm tiện ích"
        >
          <Ionicons name="search-outline" size={22} color={theme.colors.textPrimary} />
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

            {/* Slide Banner: Tư vấn chuyên gia thuế & Đăng ký làm chuyên gia thuế (khi !isExpert) */}
            <View
              style={styles.consultBannerWrap}
              onLayout={(e) => {
                const w = Math.round(e.nativeEvent.layout.width);
                if (w > 0 && w !== bannerCardWidth) {
                  setBannerCardWidth(w);
                }
              }}
            >
              {isExpert ? (
                <TouchableOpacity
                  style={styles.consultBannerCard}
                  onPress={() => navigation.navigate('ExpertList')}
                  activeOpacity={0.9}
                  testID="homeConsultBanner"
                  accessibilityRole="button"
                  accessibilityLabel="Tư vấn cùng chuyên gia thuế - Đặt lịch tư vấn ngay"
                >
                  <Image
                    source={CONSULT_BANNER_IMAGE}
                    style={[
                      styles.consultBannerImage,
                      bannerInnerWidth > 0 && {
                        width: bannerInnerWidth,
                        height: slide1Height,
                      },
                    ]}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              ) : (
                <>
                  <View
                    style={[
                      styles.consultBannerCard,
                      activeBannerHeight > 0 && { height: activeBannerHeight + 2 },
                    ]}
                    testID="homeConsultBanner"
                  >
                    {bannerInnerWidth > 0 ? (
                      <ScrollView
                        ref={bannerScrollRef}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        scrollEventThrottle={16}
                        style={{ width: bannerInnerWidth, height: activeBannerHeight }}
                        contentContainerStyle={styles.bannerScrollContent}
                        onMomentumScrollEnd={(e) => {
                          const idx = Math.round(
                            e.nativeEvent.contentOffset.x / bannerInnerWidth
                          );
                          setBannerSlideIndex(idx === 1 ? 1 : 0);
                        }}
                      >
                        {/* Slide 1: Tư vấn cùng chuyên gia thuế */}
                        <TouchableOpacity
                          style={[
                            styles.bannerSlideItem,
                            { width: bannerInnerWidth, height: slide1Height },
                          ]}
                          onPress={() => navigation.navigate('ExpertList')}
                          activeOpacity={0.9}
                          accessibilityRole="button"
                          accessibilityLabel="Tư vấn cùng chuyên gia thuế - Đặt lịch tư vấn ngay"
                          testID="homeConsultBannerSlide1"
                        >
                          <Image
                            source={CONSULT_BANNER_IMAGE}
                            style={{ width: bannerInnerWidth, height: slide1Height }}
                            resizeMode="contain"
                          />
                        </TouchableOpacity>

                        {/* Slide 2: Đăng ký làm chuyên gia thuế */}
                        <TouchableOpacity
                          style={[
                            styles.bannerSlideItem,
                            { width: bannerInnerWidth, height: slide2Height },
                          ]}
                          onPress={() => navigation.navigate('ExpertApplication')}
                          activeOpacity={0.9}
                          accessibilityRole="button"
                          accessibilityLabel="Đăng ký làm chuyên gia thuế TaxKeep VN"
                          testID="homeConsultBannerSlide2"
                        >
                          <Image
                            source={EXPERT_PARTNER_BANNER_IMAGE}
                            style={{ width: bannerInnerWidth, height: slide2Height }}
                            resizeMode="contain"
                          />
                        </TouchableOpacity>
                      </ScrollView>
                    ) : (
                      <TouchableOpacity
                        style={styles.bannerSlideItem}
                        onPress={() => navigation.navigate('ExpertList')}
                        activeOpacity={0.9}
                      >
                        <Image
                          source={CONSULT_BANNER_IMAGE}
                          style={styles.consultBannerImage}
                          resizeMode="contain"
                        />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Chấm chỉ báo chuyển slide */}
                  <View style={styles.bannerDotsRow}>
                    <TouchableOpacity
                      onPress={() => goToBannerSlide(0)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityRole="button"
                      accessibilityLabel="Slide 1: Tư vấn cùng chuyên gia thuế"
                    >
                      <View
                        style={[
                          styles.bannerDot,
                          bannerSlideIndex === 0 && styles.bannerDotActive,
                        ]}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => goToBannerSlide(1)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityRole="button"
                      accessibilityLabel="Slide 2: Đăng ký làm chuyên gia thuế"
                    >
                      <View
                        style={[
                          styles.bannerDot,
                          bannerSlideIndex === 1 && styles.bannerDotActive,
                        ]}
                      />
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>

            {/* ── NHÓM DỊCH VỤ (Logo icon hình tròn đỏ) ── */}
            <View style={styles.serviceGroupSection} testID="homeShortcutGrid">
              <Text style={styles.serviceGroupTitle}>Nhóm dịch vụ</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.serviceGroupScroll}
              >
                {SERVICE_GROUP_ITEMS.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.serviceCircleItem}
                    activeOpacity={0.8}
                    onPress={() => item.onNavigate(navigation, isExpert)}
                    testID={item.testID}
                    accessibilityRole="button"
                    accessibilityLabel={item.label.replace(/\n/g, ' ')}
                  >
                    <View style={styles.serviceCircleOuter}>
                      <View style={styles.serviceCircleRed}>
                        <View style={styles.serviceCircleCrescent} />
                        <Ionicons name={item.icon} size={26} color="#FFFFFF" />
                      </View>
                    </View>
                    <Text style={styles.serviceCircleLabel} numberOfLines={3}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* ── TIỆN ÍCH YÊU THÍCH (Lưới 3 cột có nút Chỉnh sửa theo ảnh mẫu 2) ── */}
            <View style={styles.favoriteSection} testID="homeFavoriteUtilities">
              <View style={styles.favoriteHeaderRow}>
                <Text style={styles.serviceGroupTitle}>Tiện ích yêu thích</Text>
                <TouchableOpacity
                  style={styles.favoriteEditBtn}
                  onPress={handleOpenEditFavorites}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel="Chỉnh sửa tiện ích yêu thích"
                  testID="homeEditFavoritesBtn"
                >
                  <Text style={styles.favoriteEditText}>Chỉnh sửa</Text>
                  <View style={styles.favoriteEditIconWrap}>
                    <Ionicons name="pencil-outline" size={15} color="#D61F26" />
                    <View style={styles.favoriteEditUnderline} />
                  </View>
                </TouchableOpacity>
              </View>

              <View style={styles.favoriteGrid}>
                {favoriteUtilities.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.favoriteCell}
                    activeOpacity={0.8}
                    onPress={() => item.onNavigate(navigation, isExpert)}
                    accessibilityRole="button"
                    accessibilityLabel={item.label.replace(/\n/g, ' ')}
                    testID={`homeFav_${item.id}`}
                  >
                    <View style={styles.favoriteEmblem}>
                      <View style={styles.favoriteEmblemRedArc} />
                      <View style={styles.favoriteEmblemGoldCard}>
                        <Ionicons name={item.icon} size={22} color="#B91C1C" />
                      </View>
                    </View>
                    <Text style={styles.favoriteLabel} numberOfLines={3}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Nút nổi mở Trợ lý TaxKeep VN */}
        <TouchableOpacity
          style={styles.chatFab}
          onPress={() => navigation.navigate('TaxChat')}
          testID="homeTaxChatFab"
          accessibilityRole="button"
          accessibilityLabel="Trợ lý TaxKeep VN"
        >
          <Ionicons name="chatbubbles" size={20} color={theme.colors.textOnPrimary} />
          <Text style={styles.chatFabText}>Trợ lý TaxKeep VN</Text>
        </TouchableOpacity>
      </View>

      <MainTabBar
        active={notifModalVisible ? 'Notifications' : 'Home'}
        onOpenNotifications={handleOpenNotifications}
        unreadCount={unreadCount}
      />

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

      {/* ── MODAL TÌM KIẾM TIỆN ÍCH ── */}
      <Modal
        visible={searchModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSearchModalVisible(false)}
      >
        <View style={styles.utilityModalBackdrop}>
          <View style={styles.utilityModalSheet}>
            <View style={styles.utilityModalHeader}>
              <Text style={styles.utilityModalTitle}>Tìm kiếm tiện ích</Text>
              <TouchableOpacity
                onPress={() => setSearchModalVisible(false)}
                style={styles.utilityModalCloseBtn}
                accessibilityRole="button"
                accessibilityLabel="Đóng"
              >
                <Ionicons name="close" size={22} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.utilitySearchInputBox}>
              <Ionicons name="search-outline" size={18} color={theme.colors.textSecondary} />
              <TextInput
                style={styles.utilitySearchInput}
                placeholder="Nhập tên dịch vụ, tiện ích cần tìm..."
                placeholderTextColor={theme.colors.textPlaceholder}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              ) : null}
            </View>

            <ScrollView
              style={styles.utilityModalList}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {filteredSearchUtilities.length === 0 ? (
                <View style={styles.utilityEmptyWrap}>
                  <Text style={styles.utilityEmptyText}>
                    Không tìm thấy tiện ích phù hợp với từ khóa.
                  </Text>
                </View>
              ) : (
                filteredSearchUtilities.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.utilityListRow}
                    activeOpacity={0.75}
                    onPress={() => {
                      setSearchModalVisible(false);
                      item.onNavigate(navigation, isExpert);
                    }}
                  >
                    <View style={styles.utilityListIconCircle}>
                      <Ionicons name={item.icon} size={20} color="#FFFFFF" />
                    </View>
                    <Text style={styles.utilityListLabel}>
                      {item.label.replace(/\n/g, ' ')}
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={theme.colors.textSecondary}
                    />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── MODAL CHỈNH SỬA TIỆN ÍCH YÊU THÍCH ── */}
      <Modal
        visible={editFavoritesVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditFavoritesVisible(false)}
      >
        <View style={styles.utilityModalBackdrop}>
          <View style={styles.utilityModalSheet}>
            <View style={styles.utilityModalHeader}>
              <Text style={styles.utilityModalTitle}>Chỉnh sửa tiện ích yêu thích</Text>
              <TouchableOpacity
                onPress={() => setEditFavoritesVisible(false)}
                style={styles.utilityModalCloseBtn}
                accessibilityRole="button"
                accessibilityLabel="Đóng"
              >
                <Ionicons name="close" size={22} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.utilityModalSubtitle}>
              Chọn các tiện ích bạn thường dùng để hiển thị nhanh trên Trang chủ ({draftFavoriteIds.length} đã chọn)
            </Text>

            <ScrollView
              style={styles.utilityModalList}
              showsVerticalScrollIndicator={false}
            >
              {ALL_HOME_UTILITIES.map((item) => {
                const isSelected = draftFavoriteIds.includes(item.id);
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.utilityListRow}
                    activeOpacity={0.75}
                    onPress={() => handleToggleDraftFavorite(item.id)}
                  >
                    <View
                      style={[
                        styles.utilityListIconCircle,
                        !isSelected && styles.utilityListIconCircleInactive,
                      ]}
                    >
                      <Ionicons
                        name={item.icon}
                        size={20}
                        color={isSelected ? '#FFFFFF' : theme.colors.primary}
                      />
                    </View>
                    <Text style={styles.utilityListLabel}>
                      {item.label.replace(/\n/g, ' ')}
                    </Text>
                    <Ionicons
                      name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={22}
                      color={isSelected ? '#D61F26' : theme.colors.textPlaceholder}
                    />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.utilityModalFooter}>
              <TouchableOpacity
                style={styles.utilityCancelBtn}
                onPress={() => setEditFavoritesVisible(false)}
              >
                <Text style={styles.utilityCancelBtnText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.utilitySaveBtn}
                onPress={() => void handleSaveFavorites()}
              >
                <Text style={styles.utilitySaveBtnText}>Lưu thay đổi</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  searchHeaderBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceGroupSection: {
    marginTop: 22,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  serviceGroupTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 17,
    lineHeight: 22,
    color: theme.colors.textPrimary,
  },
  serviceGroupScroll: {
    paddingTop: 14,
    paddingRight: 8,
    gap: 14,
  },
  serviceCircleItem: {
    width: 78,
    alignItems: 'center',
  },
  serviceCircleOuter: {
    width: 62,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 8,
  },
  serviceCircleRed: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#D61F26',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    elevation: 3,
    shadowColor: '#8B1E1E',
    shadowOpacity: 0.25,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  serviceCircleCrescent: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(130, 10, 15, 0.38)',
    bottom: -14,
    right: -14,
  },
  serviceCircleLabel: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    lineHeight: 17,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  favoriteSection: {
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  favoriteHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  favoriteEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  favoriteEditText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  favoriteEditIconWrap: {
    alignItems: 'center',
  },
  favoriteEditUnderline: {
    width: 14,
    height: 1.8,
    backgroundColor: '#D61F26',
    marginTop: 1,
  },
  favoriteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 18,
  },
  favoriteCell: {
    width: '33.33%',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  favoriteEmblem: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F4F3F0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#EAE6DF',
  },
  favoriteEmblemRedArc: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 14,
    backgroundColor: '#B81D24',
  },
  favoriteEmblemGoldCard: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#FCE4A6',
    borderWidth: 1.5,
    borderColor: '#D99B26',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  favoriteLabel: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    lineHeight: 17,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  utilityModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  utilityModalSheet: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '82%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  utilityModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  utilityModalTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 18,
    color: theme.colors.primaryDark,
  },
  utilityModalCloseBtn: {
    padding: 4,
  },
  utilityModalSubtitle: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    lineHeight: 18,
    color: theme.colors.textSecondary,
    marginBottom: 12,
  },
  utilitySearchInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F5F2EB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 12,
  },
  utilitySearchInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    color: theme.colors.textPrimary,
    paddingVertical: 0,
  },
  utilityModalList: {
    maxHeight: 360,
  },
  utilityListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  utilityListIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#D61F26',
    alignItems: 'center',
    justifyContent: 'center',
  },
  utilityListIconCircleInactive: {
    backgroundColor: '#F5EFE6',
  },
  utilityListLabel: {
    flex: 1,
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  utilityEmptyWrap: {
    paddingVertical: 28,
    alignItems: 'center',
  },
  utilityEmptyText: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    color: theme.colors.textSecondary,
  },
  utilityModalFooter: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  utilityCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  utilityCancelBtnText: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  utilitySaveBtn: {
    flex: 1.5,
    height: 44,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  utilitySaveBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: '#FFFFFF',
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
  consultBannerWrap: {
    marginTop: 18,
    width: '100%',
  },
  consultBannerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E8D5B5',
    ...theme.shadows.card,
  },
  bannerScrollContent: {
    alignItems: 'flex-start',
  },
  bannerSlideItem: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  consultBannerImage: {
    width: '100%',
    aspectRatio: 1024 / 341,
  },
  partnerBannerImage: {
    width: '100%',
    aspectRatio: 1024 / 576,
  },
  bannerDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  bannerDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#D6CFC2',
  },
  bannerDotActive: {
    width: 20,
    backgroundColor: theme.colors.primary,
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
