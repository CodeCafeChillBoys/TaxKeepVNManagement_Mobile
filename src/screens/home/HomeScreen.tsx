import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { useAuthStore } from '../../stores/useAuthStore';
import { RootNavigationProp } from '../../navigation/types';
import { dependentDocumentApi, AgeReminderItemDto } from '../../api/dependentDocumentApi';
import { dependentLifecycleApi } from '../../api/dependentLifecycleApi';
import { notificationApi, NotificationItem } from '../../api/notificationApi';
import {
  buildHomeReminderChangeGroupPlan,
  runHomeReminderChangeGroup,
} from './homeReminderChangeGroup';

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const { user, logout } = useAuthStore();

  // Nhắc nhở chuyển nhóm tuổi NPT: GET /api/v1/dependents/reminders/age-transitions
  const [reminders, setReminders] = useState<AgeReminderItemDto[]>([]);
  const [reminderPatching, setReminderPatching] = useState(false);

  // Thông báo hệ thống: GET /api/v1/notifications & PATCH /api/v1/notifications/{id}/read
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notifModalVisible, setNotifModalVisible] = useState<boolean>(false);
  const [notifTab, setNotifTab] = useState<'ALL' | 'UNREAD'>('ALL');
  const [loadingNotifs, setLoadingNotifs] = useState<boolean>(false);
  const [refreshingNotifs, setRefreshingNotifs] = useState<boolean>(false);

  // Tải dữ liệu nhắc nhở và thông báo khi màn hình hiển thị
  const fetchDashboardData = useCallback(async () => {
    try {
      // 1. Gọi API nhắc nhở chuyển nhóm tuổi NPT (Điều 4.1.a & Điều 4.1.đ TT 111/2013/TT-BTC)
      const remindersData = await dependentDocumentApi.getAgeTransitionReminders();
      setReminders(remindersData);

      // 2. Lấy số lượng thông báo chưa đọc hiển thị badge
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
        prev.map((n) => (n.notificationId === item.notificationId ? { ...n, isRead: true } : n))
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

    // Chuyển hướng thông minh theo ngữ cảnh của thông báo
    if (
      item.notificationType === 'AGE_TRANSITION_ALERT' ||
      item.title.toLowerCase().includes('18 tuổi') ||
      item.message.toLowerCase().includes('sinh viên')
    ) {
      setNotifModalVisible(false);
      navigation.navigate('ProofDocuments', {
        groupIndex: 1, // Nhóm 2: Con từ 18 tuổi trở lên đang theo học (CHILD_STUDYING)
      });
    } else if (item.notificationType === 'DEPENDENT_REGISTRATION') {
      setNotifModalVisible(false);
      navigation.navigate('TaxRegistration');
    }
  };

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

  /** NPT-03: confirm → PATCH /group → ProofDocuments (không skip PATCH). */
  const handleReminderUploadPress = (item: AgeReminderItemDto) => {
    if (reminderPatching) return;
    const plan = buildHomeReminderChangeGroupPlan({
      dependentId: item.dependentId,
      fullName: item.fullName,
      recommendedGroup: item.recommendedGroup || 'CHILD_OVER_18_STUDYING',
    });

    Alert.alert(plan.confirmTitle, plan.confirmMessage, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xác nhận',
        onPress: async () => {
          setReminderPatching(true);
          try {
            const result = await runHomeReminderChangeGroup({
              dependentId: plan.dependentId,
              newGroup: plan.newGroup,
              updateDependentGroup: dependentLifecycleApi.updateDependentGroup,
            });
            if (!result.ok) {
              Alert.alert('Không thể chuyển nhóm', result.message);
              return;
            }
            navigation.navigate(
              result.navigation.screen,
              result.navigation.params
            );
          } finally {
            setReminderPatching(false);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Bar theo Figma iPhone 17 - 16 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.userInfoRow}
          onPress={() => navigation.navigate('Profile')}
          activeOpacity={0.8}
        >
          <View style={styles.avatar}>
            <Ionicons name="person" size={24} color="#FFFFFF" />
          </View>
          <View>
            <Text style={styles.welcomeText}>Xin chào,</Text>
            <Text style={styles.userName}>{user?.fullName || 'Người nộp thuế'}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          {/* Chuông thông báo có Badge số lượng chưa đọc */}
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={handleOpenNotifications}
            testID="notificationBellBtn"
            accessibilityLabel="Thông báo hệ thống"
          >
            <Ionicons name="notifications-outline" size={22} color={theme.colors.textPrimary} />
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={[styles.iconBtn, { marginLeft: 8 }]} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={22} color={theme.colors.error} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Banner Country & Pride theo Figma */}
        <View style={styles.heroBanner}>
          <View style={styles.bannerTextCol}>
            <Text style={styles.bannerTag}>PHÁP LUẬT THUẾ TNCN</Text>
            <Text style={styles.bannerTitle}>TaxKeep VN</Text>
            <Text style={styles.bannerSubtitle}>
              Hệ thống kê khai và giảm trừ gia cảnh thông minh
            </Text>
          </View>
          <View style={styles.bannerBadge}>
            <Ionicons name="shield-checkmark" size={36} color={theme.colors.gold} />
          </View>
        </View>

        {/* Banner Cảnh báo chuyển nhóm tuổi NPT (Điều 4.1.đ TT111 / GET /api/v1/dependents/reminders/age-transitions) */}
        {reminders.length > 0 && (
          <View style={styles.reminderBanner} testID="ageTransitionReminderBanner">
            <View style={styles.reminderHeader}>
              <View style={styles.reminderIconCircle}>
                <Ionicons name="alert-circle" size={24} color={theme.colors.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.reminderTitleRow}>
                  <Text style={styles.reminderTitle}>Cảnh báo chuyển nhóm tuổi NPT</Text>
                  <View style={styles.statusPill}>
                    <Text style={styles.statusPillText}>
                      {reminders[0].transitionStatus === 'TURNING_18_SOON'
                        ? `Còn ${reminders[0].daysRemaining} ngày`
                        : 'Đã tròn 18 tuổi'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.reminderDesc}>{reminders[0].message}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.reminderActionBtn}
              activeOpacity={0.8}
              disabled={reminderPatching}
              onPress={() => handleReminderUploadPress(reminders[0])}
              testID="btnUploadStudentCardReminder"
              accessibilityRole="button"
              accessibilityLabel="Bổ sung hồ sơ sinh viên ngay"
            >
              {reminderPatching ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.reminderActionBtnText}>Bổ sung hồ sơ sinh viên ngay</Text>
                  <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Thanh tìm kiếm */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color={theme.colors.textSecondary} />
          <Text style={styles.searchPlaceholder}>Tìm kiếm quy định luật, hồ sơ...</Text>
        </View>

        {/* Mục Tiện ích */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Tiện ích nổi bật</Text>
          <Text style={styles.sectionMore}>Xem tất cả</Text>
        </View>

        <View style={styles.gridContainer}>
          {/* Nút vào màn Đơn đăng ký người phụ thuộc (iPhone 17 - 13) */}
          <TouchableOpacity
            style={styles.gridCardHighlight}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('TaxRegistration')}
            testID="homeTaxRegistrationCard"
            accessibilityRole="button"
            accessibilityLabel="Đơn đăng ký người phụ thuộc"
          >
            <View style={styles.gridIconCircleHighlight}>
              <Ionicons name="document-text" size={24} color="#FFFFFF" />
            </View>
            <Text style={styles.gridTitleHighlight}>Đơn đăng ký người phụ thuộc</Text>
            <Text style={styles.gridSubtitleHighlight}>Khai người phụ thuộc theo luật</Text>
          </TouchableOpacity>

          {/* Tiện ích 2: Danh sách người phụ thuộc */}
          <TouchableOpacity
            style={styles.gridCard}
            onPress={() => navigation.navigate('DependentList')}
            accessibilityRole="button"
            accessibilityLabel="Danh sách người phụ thuộc"
            testID="homeDependentListCard"
          >
            <View style={styles.gridIconCircle}>
              <Ionicons name="people-outline" size={22} color={theme.colors.primary} />
            </View>
            <Text style={styles.gridTitle}>Danh sách NPT</Text>
            <Text style={styles.gridSubtitle}>Quản lý hồ sơ</Text>
          </TouchableOpacity>

          {/* Tiện ích 3: Điều kiện luật */}
          <TouchableOpacity
            style={styles.gridCard}
            onPress={() => navigation.navigate('LawConditions')}
            accessibilityRole="button"
            accessibilityLabel="Điều kiện luật 5 nhóm giảm trừ"
            testID="homeLawConditionsCard"
          >
            <View style={styles.gridIconCircle}>
              <Ionicons name="book-outline" size={22} color={theme.colors.primary} />
            </View>
            <Text style={styles.gridTitle}>Điều kiện luật</Text>
            <Text style={styles.gridSubtitle}>5 nhóm giảm trừ</Text>
          </TouchableOpacity>

          {/* Tiện ích 4: Hồ sơ cá nhân (Task 1.3.T3) */}
          <TouchableOpacity
            style={styles.gridCard}
            onPress={() => navigation.navigate('Profile')}
            accessibilityRole="button"
            accessibilityLabel="Hồ sơ cá nhân"
            testID="homeProfileCard"
          >
            <View style={styles.gridIconCircle}>
              <Ionicons name="person-circle-outline" size={22} color={theme.colors.primary} />
            </View>
            <Text style={styles.gridTitle}>Hồ sơ cá nhân</Text>
            <Text style={styles.gridSubtitle}>Xem và chỉnh sửa</Text>
          </TouchableOpacity>

          {/* Tiện ích 5: Nơi chi trả thu nhập */}
          <TouchableOpacity
            style={styles.gridCard}
            onPress={() => navigation.navigate('IncomeSourceList')}
            accessibilityRole="button"
            accessibilityLabel="Nơi chi trả thu nhập"
            testID="homeIncomeSourceCard"
          >
            <View style={styles.gridIconCircle}>
              <Ionicons name="business-outline" size={22} color={theme.colors.primary} />
            </View>
            <Text style={styles.gridTitle}>Nơi chi trả</Text>
            <Text style={styles.gridSubtitle}>Nguồn thu nhập</Text>
          </TouchableOpacity>

          {/* Tiện ích 6: Hóa đơn & Chi phí trừ thuế (SPEC_EXPENSE_OCR) */}
          <TouchableOpacity
            style={styles.gridCard}
            onPress={() => navigation.navigate('ExpenseList')}
            accessibilityRole="button"
            accessibilityLabel="Hóa đơn & Chi phí trừ thuế"
            testID="homeExpenseListCard"
          >
            <View style={styles.gridIconCircle}>
              <Ionicons name="receipt-outline" size={22} color={theme.colors.primary} />
            </View>
            <Text style={styles.gridTitle}>Hóa đơn chi phí</Text>
            <Text style={styles.gridSubtitle}>Đã duyệt & Upload</Text>
          </TouchableOpacity>
        </View>

        {/* Thông tin tài khoản hiện tại */}
        <View style={styles.accountCard}>
          <Text style={styles.accountCardTitle}>Thông tin xác thực phiên làm việc</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Số CCCD:</Text>
            <Text style={styles.infoVal}>{user?.citizenId || 'Chưa cập nhật'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email:</Text>
            <Text style={styles.infoVal}>{user?.email || 'Chưa cập nhật'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Trạng thái:</Text>
            <Text style={[styles.infoVal, { color: theme.colors.success }]}>✓ Đang hoạt động</Text>
          </View>
        </View>
      </ScrollView>

      {/* Modal Danh sách thông báo: GET /api/v1/notifications & PATCH /api/v1/notifications/{id}/read */}
      <Modal
        visible={notifModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setNotifModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderTitleRow}>
              <Text style={styles.modalTitle}>Thông báo hệ thống</Text>
              {unreadCount > 0 && (
                <View style={styles.modalBadge}>
                  <Text style={styles.modalBadgeText}>{unreadCount} mới</Text>
                </View>
              )}
            </View>
            <View style={styles.modalHeaderActions}>
              {unreadCount > 0 && (
                <TouchableOpacity onPress={handleMarkAllAsRead} style={styles.markAllBtn}>
                  <Text style={styles.markAllBtnText}>Đã đọc tất cả</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => setNotifModalVisible(false)}
                style={styles.closeModalBtn}
                accessibilityLabel="Đóng"
              >
                <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Filter Tabs */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabItem, notifTab === 'ALL' && styles.tabItemActive]}
              onPress={() => setNotifTab('ALL')}
            >
              <Text style={[styles.tabItemText, notifTab === 'ALL' && styles.tabItemTextActive]}>
                Tất cả ({notifications.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabItem, notifTab === 'UNREAD' && styles.tabItemActive]}
              onPress={() => setNotifTab('UNREAD')}
            >
              <Text
                style={[
                  styles.tabItemText,
                  notifTab === 'UNREAD' && styles.tabItemTextActive,
                ]}
              >
                Chưa đọc ({unreadCount})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Danh sách thông báo */}
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
                  <Ionicons
                    name="notifications-off-outline"
                    size={48}
                    color={theme.colors.textPlaceholder}
                  />
                  <Text style={styles.emptyText}>
                    {notifTab === 'UNREAD'
                      ? 'Không có thông báo chưa đọc nào.'
                      : 'Bạn chưa có thông báo nào từ hệ thống.'}
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const isAgeReminder =
                  item.notificationType === 'AGE_TRANSITION_ALERT' ||
                  item.title.toLowerCase().includes('18 tuổi');
                return (
                  <TouchableOpacity
                    style={[
                      styles.notifCard,
                      !item.isRead && styles.notifCardUnread,
                    ]}
                    activeOpacity={0.7}
                    onPress={() => handleNotificationPress(item)}
                  >
                    <View
                      style={[
                        styles.notifIconCircle,
                        isAgeReminder && { backgroundColor: theme.colors.warningBackground },
                      ]}
                    >
                      <Ionicons
                        name={
                          isAgeReminder
                            ? 'time-outline'
                            : item.notificationType === 'TAX_FILING'
                            ? 'document-text-outline'
                            : 'notifications-outline'
                        }
                        size={20}
                        color={isAgeReminder ? theme.colors.warning : theme.colors.primary}
                      />
                    </View>

                    <View style={styles.notifBody}>
                      <View style={styles.notifTitleRow}>
                        <Text
                          style={[
                            styles.notifItemTitle,
                            !item.isRead && styles.notifItemTitleUnread,
                          ]}
                          numberOfLines={1}
                        >
                          {item.title}
                        </Text>
                        {!item.isRead && <View style={styles.unreadDot} />}
                      </View>

                      <Text style={styles.notifMessage} numberOfLines={3}>
                        {item.message}
                      </Text>

                      <View style={styles.notifFooterRow}>
                        <Text style={styles.notifTime}>
                          {new Date(item.createdAt).toLocaleDateString('vi-VN', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                        {isAgeReminder && (
                          <Text style={styles.notifActionPrompt}>Bổ sung giấy tờ →</Text>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </SafeAreaView>
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
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeText: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
  userName: {
    ...theme.typography.titleMedium,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    padding: 8,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surfaceSecondary,
    position: 'relative',
  },
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: theme.colors.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: theme.colors.surface,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  heroBanner: {
    backgroundColor: theme.colors.primaryDark,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...theme.shadows.button,
    marginBottom: theme.spacing.md,
  },
  bannerTextCol: {
    flex: 1,
  },
  bannerTag: {
    ...theme.typography.caption,
    color: theme.colors.goldLight,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  bannerTitle: {
    ...theme.typography.titleLarge,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  bannerSubtitle: {
    ...theme.typography.bodySmall,
    color: '#E0E0E0',
  },
  bannerBadge: {
    padding: 8,
    borderRadius: theme.borderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },

  // Reminder Banner Styles
  reminderBanner: {
    backgroundColor: theme.colors.warningBackground,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    borderWidth: 1.5,
    borderColor: theme.colors.warning,
    marginBottom: theme.spacing.md,
    ...theme.shadows.card,
  },
  reminderHeader: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  reminderIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFE0B2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    flexWrap: 'wrap',
    gap: 6,
  },
  reminderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#B74700',
  },
  statusPill: {
    backgroundColor: theme.colors.warning,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  reminderDesc: {
    ...theme.typography.bodySmall,
    color: '#5C3800',
    lineHeight: 18,
  },
  reminderActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.warning,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: theme.borderRadius.sm,
    gap: 6,
  },
  reminderActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    height: 46,
    marginBottom: theme.spacing.lg,
    gap: 10,
  },
  searchPlaceholder: {
    ...theme.typography.bodyMedium,
    color: theme.colors.textPlaceholder,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  sectionTitle: {
    ...theme.typography.titleMedium,
    color: theme.colors.textPrimary,
  },
  sectionMore: {
    ...theme.typography.bodySmall,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: theme.spacing.lg,
  },
  gridCardHighlight: {
    width: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    ...theme.shadows.button,
  },
  gridIconCircleHighlight: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  gridTitleHighlight: {
    ...theme.typography.titleMedium,
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  gridSubtitleHighlight: {
    ...theme.typography.caption,
    color: '#F0EAE1',
    marginTop: 2,
  },
  gridCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  gridIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  gridTitle: {
    ...theme.typography.bodyLarge,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  gridSubtitle: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  accountCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  accountCardTitle: {
    ...theme.typography.bodyLarge,
    fontWeight: '700',
    color: theme.colors.primaryDark,
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  infoLabel: {
    ...theme.typography.bodyMedium,
    color: theme.colors.textSecondary,
  },
  infoVal: {
    ...theme.typography.bodyMedium,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },

  // Modal Notification Styles
  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 4,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  modalBadge: {
    backgroundColor: theme.colors.error,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  modalBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  markAllBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surfaceSecondary,
  },
  markAllBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  closeModalBtn: {
    padding: 4,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tabItem: {
    paddingVertical: 12,
    marginRight: 20,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: theme.colors.primary,
  },
  tabItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  tabItemTextActive: {
    color: theme.colors.primary,
  },
  notifListContent: {
    padding: theme.spacing.md,
    paddingBottom: 40,
  },
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  notifCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 12,
    ...theme.shadows.card,
  },
  notifCardUnread: {
    backgroundColor: '#FFFFFF',
    borderColor: theme.colors.goldLight,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
  notifIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBody: {
    flex: 1,
  },
  notifTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  notifItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    flex: 1,
  },
  notifItemTitleUnread: {
    fontWeight: '700',
    color: theme.colors.primaryDark,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
    marginLeft: 6,
  },
  notifMessage: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 18,
    marginBottom: 6,
  },
  notifFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notifTime: {
    fontSize: 11,
    color: theme.colors.textPlaceholder,
  },
  notifActionPrompt: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.warning,
  },
});
