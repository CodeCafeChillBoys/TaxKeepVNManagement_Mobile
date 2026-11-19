import React, { useState, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { RootNavigationProp } from '../../navigation/types';
import { useAuthStore } from '../../stores/useAuthStore';
import { useThemeStore, DARK_COLORS, LIGHT_COLORS } from '../../stores/useThemeStore';
import { MainTabBar } from '../../components/navigation/MainTabBar';
import { DrumHeader } from '../../components/brand/DrumHeader';
import { formatPersonName } from '../../utils/formatPersonName';
import { Dialog } from '../../components/common/Dialog';

type InfoModalType = 'guide' | 'terms' | null;

const USER_GUIDE_SECTIONS = [
  {
    title: '1. Hoàn thiện hồ sơ & Mã số thuế',
    body: 'Vào mục Cá nhân hoặc Chỉnh sửa hồ sơ cá nhân để kiểm tra họ tên, địa chỉ thường trú (34 tỉnh/thành sau sáp nhập) và bổ sung Mã số thuế cá nhân (10 số hoặc CCCD 12 số đã đăng ký với Cơ quan Thuế).',
  },
  {
    title: '2. Khai báo & Quản lý người phụ thuộc',
    body: 'Chọn "Khai báo người phụ thuộc" tại Trang chủ, quét CCCD/giấy khai sinh bằng AI OCR và tải lên giấy tờ minh chứng để tự động tính mức giảm trừ gia cảnh đúng quy định.',
  },
  {
    title: '3. Tải lên chứng từ & Kê khai thu nhập',
    body: 'Nhấn nút đỏ ở chính giữa thanh điều hướng dưới để tải lên chứng từ khấu trừ thuế, hóa đơn y tế/giáo dục/từ thiện hoặc phiếu lương. Hệ thống sẽ tự động bóc tách dữ liệu và đối chiếu theo năm tính thuế.',
  },
  {
    title: '4. Quyết toán thuế TNCN',
    body: 'Chọn "Quyết toán thuế" để hệ thống tổng hợp thu nhập chịu thuế, các khoản giảm trừ và dự tính số thuế được hoàn hoặc phải nộp thêm, đồng thời hỗ trợ xuất tờ khai PDF và bộ hồ sơ ZIP.',
  },
  {
    title: '5. Tư vấn chuyên gia & Ví TaxKeep',
    body: 'Bạn có thể đặt lịch tư vấn trực tuyến với các chuyên gia thuế đã xác thực chứng chỉ hành nghề, quản lý số dư nạp/rút tại tab Ví TaxKeep và trò chuyện nhanh với Trợ lý TaxKeep VN bất cứ lúc nào.',
  },
];

const TERMS_SECTIONS = [
  {
    title: '1. Phạm vi dịch vụ',
    body: 'TaxKeep VN cung cấp công cụ số hóa hỗ trợ người nộp thuế lưu trữ chứng từ, tính toán dự thảo quyết toán thuế TNCN, tra cứu văn bản pháp luật thuế và kết nối với chuyên gia tư vấn độc lập.',
  },
  {
    title: '2. Bảo mật dữ liệu cá nhân',
    body: 'Toàn bộ thông tin định danh (CCCD, mã số thuế, thu nhập, giấy tờ người phụ thuộc) được mã hóa và bảo mật theo Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân. Dữ liệu chỉ được sử dụng cho mục đích kê khai, quyết toán và tư vấn thuế theo yêu cầu của bạn.',
  },
  {
    title: '3. Trách nhiệm người dùng',
    body: 'Người dùng chịu trách nhiệm về tính chính xác, trung thực của hồ sơ, chứng từ cung cấp và có nghĩa vụ kiểm tra lại kết quả trích xuất OCR cũng như dự thảo tờ khai trước khi nộp chính thức cho Cơ quan Thuế.',
  },
  {
    title: '4. Thanh toán & Gói thành viên',
    body: 'Phí dịch vụ tư vấn chuyên gia và nâng cấp gói thành viên được hiển thị minh bạch trước khi xác nhận. Chính sách hoàn tiền khi hủy lịch hẹn hoặc khiếu nại ca tư vấn được áp dụng theo quy định hiện hành của nền tảng.',
  },
  {
    title: '5. Liên hệ hỗ trợ',
    body: 'Mọi thắc mắc liên quan đến tài khoản, bảo mật hoặc điều khoản dịch vụ, vui lòng liên hệ tổng đài hỗ trợ kỹ thuật TaxKeep VN (1900 6868) hoặc qua mục Trợ lý TaxKeep VN.',
  },
];

const SettingsRow = memo(function SettingsRow({
  label,
  icon,
  onPress,
  testID,
  last,
  isDark,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  testID: string;
  last?: boolean;
  isDark: boolean;
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
        <View
          style={[
            styles.linkIconBox,
            { backgroundColor: isDark ? '#2A2622' : '#F5EFE6' },
          ]}
        >
          <Ionicons name={icon} size={18} color={palette.primary} />
        </View>
        <Text style={[styles.linkLabel, { color: palette.textPrimary }]}>{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={palette.textSecondary} />
    </TouchableOpacity>
  );
});

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const logout = useAuthStore((s) => s.logout);
  const authUser = useAuthStore((s) => s.user);
  const { mode: themeMode, isDark, setMode } = useThemeStore();
  const palette = isDark ? DARK_COLORS : LIGHT_COLORS;

  const [showLogoutDialog, setShowLogoutDialog] = useState<boolean>(false);
  const [infoModal, setInfoModal] = useState<InfoModalType>(null);

  const displayName = formatPersonName(authUser?.fullName) || 'Người nộp thuế';

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Home');
  }, [navigation]);

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

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.background }]}
      edges={['top', 'left', 'right']}
    >
      <DrumHeader title="Cài đặt" onBack={goBack} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentWrap}>
          {/* Nhóm Tài khoản & Giao diện */}
          <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>
            Tài khoản & Giao diện
          </Text>
          <View
            style={[
              styles.cardBlock,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
              },
            ]}
          >
            <SettingsRow
              label="Chỉnh sửa hồ sơ cá nhân"
              icon="person-outline"
              onPress={() => navigation.navigate('EditProfile', { autoFocusTaxId: false })}
              testID="quickLinkEditProfile"
              isDark={isDark}
            />
            <SettingsRow
              label="Đổi mật khẩu"
              icon="lock-closed-outline"
              onPress={() => navigation.navigate('ChangePassword')}
              testID="quickLinkChangePassword"
              isDark={isDark}
            />
            <SettingsRow
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

          {/* Nhóm Hỗ trợ & Pháp lý */}
          <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>
            Hỗ trợ & Pháp lý
          </Text>
          <View
            style={[
              styles.cardBlock,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
              },
            ]}
          >
            <SettingsRow
              label="Hướng dẫn sử dụng"
              icon="book-outline"
              onPress={() => setInfoModal('guide')}
              testID="settingsUserGuideBtn"
              isDark={isDark}
            />
            <SettingsRow
              label="Điều khoản sử dụng"
              icon="document-text-outline"
              onPress={() => setInfoModal('terms')}
              testID="settingsTermsBtn"
              last
              isDark={isDark}
            />
          </View>

          <TouchableOpacity
            style={styles.logoutBtn}
            activeOpacity={0.85}
            onPress={() => setShowLogoutDialog(true)}
            accessibilityRole="button"
            accessibilityLabel="Đăng xuất"
            testID="profileLogoutBtn"
          >
            <Ionicons name="log-out-outline" size={18} color={palette.error} />
            <Text style={[styles.logoutBtnText, { color: palette.error }]}>Đăng xuất</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <MainTabBar active="Settings" />

      {/* Modal Hướng dẫn sử dụng / Điều khoản sử dụng */}
      <Modal
        visible={infoModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setInfoModal(null)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
              },
            ]}
          >
            <View style={[styles.modalHeader, { borderBottomColor: palette.border }]}>
              <Text style={[styles.modalTitle, { color: palette.primaryDark }]}>
                {infoModal === 'guide' ? 'Hướng dẫn sử dụng' : 'Điều khoản sử dụng'}
              </Text>
              <TouchableOpacity
                onPress={() => setInfoModal(null)}
                style={styles.modalCloseBtn}
                accessibilityRole="button"
                accessibilityLabel="Đóng"
              >
                <Ionicons name="close" size={22} color={palette.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {(infoModal === 'guide' ? USER_GUIDE_SECTIONS : TERMS_SECTIONS).map(
                (sec, idx) => (
                  <View key={idx} style={styles.infoBlock}>
                    <Text style={[styles.infoHeading, { color: palette.textPrimary }]}>
                      {sec.title}
                    </Text>
                    <Text style={[styles.infoBody, { color: palette.textSecondary }]}>
                      {sec.body}
                    </Text>
                  </View>
                )
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalConfirmBtn, { backgroundColor: palette.primary }]}
              onPress={() => setInfoModal(null)}
              activeOpacity={0.85}
            >
              <Text style={styles.modalConfirmBtnText}>Đã hiểu</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },
  contentWrap: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  sectionTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 17,
    lineHeight: 24,
    color: theme.colors.textPrimary,
    marginTop: 14,
    marginBottom: 8,
  },
  cardBlock: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    ...theme.shadows.card,
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
    width: 34,
    height: 34,
    borderRadius: 9,
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
    marginTop: 22,
    paddingVertical: 14,
    cursor: Platform.OS === 'web' ? ('pointer' as any) : undefined,
  },
  logoutBtnText: {
    fontFamily: fonts.bodySemi,
    fontSize: 15,
    lineHeight: 20,
    color: theme.colors.error,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.52)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  modalSheet: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '82%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    ...theme.shadows.card,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    marginBottom: 12,
  },
  modalTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 19,
    lineHeight: 24,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalScroll: {
    maxHeight: 380,
  },
  modalScrollContent: {
    paddingBottom: 8,
    gap: 14,
  },
  infoBlock: {
    gap: 4,
  },
  infoHeading: {
    fontFamily: fonts.bodyBold,
    fontSize: 14.5,
    lineHeight: 20,
  },
  infoBody: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    lineHeight: 20,
  },
  modalConfirmBtn: {
    marginTop: 14,
    height: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: '#FFFFFF',
  },
});
