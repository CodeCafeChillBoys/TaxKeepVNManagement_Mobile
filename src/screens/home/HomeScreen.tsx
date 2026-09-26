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
    } catch (err) {
      console.warn('HomeScreen fetchDashboardData error:', err);
    }
  }, []);

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

  const handleNotificationPress = async (item: NotificationItem) => {
    await handleMarkAsRead(item);

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
            style={[styles.shortcutCell, styles.shortcutBorderRight]}
            onPress={() => navigation.navigate('IncomeSourceList')}
            testID="homeIncomeSourceCard"
            accessibilityRole="button"
            accessibilityLabel="Nơi chi trả"
          >
            <Ionicons name="business-outline" size={20} color={theme.colors.primary} />
            <Text style={styles.shortcutLabel}>Nơi chi trả</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.shortcutCell}
            onPress={() => navigation.navigate('ExpenseList')}
            testID="homeExpenseListCard"
            accessibilityRole="button"
            accessibilityLabel="Hóa đơn chi phí"
          >
            <Ionicons name="receipt-outline" size={20} color={theme.colors.primary} />
            <Text style={styles.shortcutLabel}>Hóa đơn chi phí</Text>
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
                return (
                  <TouchableOpacity
                    style={[styles.notifCard, !item.isRead && styles.notifCardUnread]}
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
                      style={[styles.notifItemTitle, !item.isRead && styles.notifItemTitleUnread]}
                      numberOfLines={2}
                    >
                      {humanizeGroupCodes(item.title)}
                    </Text>
                    <Text style={styles.notifMessage} numberOfLines={4}>
                      {humanizeGroupCodes(item.message)}
                    </Text>
                    {isAgeReminder ? (
                      <Text style={styles.notifActionPrompt}>Bổ sung giấy tờ</Text>
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
