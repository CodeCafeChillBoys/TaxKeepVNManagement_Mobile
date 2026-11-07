import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import {
  checkForAppUpdate,
  downloadAndInstallApk,
  type AppVersionInfo,
  CURRENT_BUILD_NUMBER,
} from '../../services/appUpdateService';

export const AppUpdateModal: React.FC = () => {
  const [updateInfo, setUpdateInfo] = useState<AppVersionInfo | null>(null);
  const [visible, setVisible] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Tự động kiểm tra bản cập nhật khi mở app
    const check = async () => {
      const update = await checkForAppUpdate();
      if (update) {
        setUpdateInfo(update);
        setVisible(true);
      }
    };

    check();
  }, []);

  const handleUpdateNow = useCallback(async () => {
    if (!updateInfo) return;
    setDownloading(true);
    setProgress(0);

    try {
      await downloadAndInstallApk(updateInfo.downloadUrl, (p) => {
        setProgress(p);
      });
    } catch {
      // Fallback đóng modal nếu xảy ra lỗi
      setVisible(false);
    } finally {
      setDownloading(false);
    }
  }, [updateInfo]);

  const handleDismiss = useCallback(() => {
    if (downloading) return;
    setVisible(false);
  }, [downloading]);

  if (!visible || !updateInfo) {
    return null;
  }

  const percent = Math.round(progress * 100);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header Icon */}
          <View style={styles.iconCircle}>
            <Ionicons name="sparkles" size={28} color={theme.colors.gold} />
          </View>

          {/* Title & Version */}
          <Text style={styles.title}>Đã có bản cập nhật mới!</Text>
          <View style={styles.versionBadge}>
            <Text style={styles.versionText}>
              Phiên bản {updateInfo.versionName} (Bản hiện tại: Build #{CURRENT_BUILD_NUMBER})
            </Text>
          </View>

          {/* Release Notes */}
          <Text style={styles.notes}>
            {updateInfo.releaseNotes ||
              'Bản cập nhật mới với các tối ưu hiệu năng và sửa lỗi giúp trải nghiệm của bạn mượt mà hơn.'}
          </Text>

          {/* Progress bar khi đang tải */}
          {downloading ? (
            <View style={styles.progressContainer}>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${percent}%` }]} />
              </View>
              <Text style={styles.progressText}>Đang tải bản cài đặt: {percent}%</Text>
            </View>
          ) : null}

          {/* Action Buttons */}
          <View style={styles.actions}>
            {!downloading ? (
              <TouchableOpacity
                style={styles.btnSecondary}
                onPress={handleDismiss}
                accessibilityRole="button"
              >
                <Text style={styles.btnSecondaryText}>Để sau</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={[styles.btnPrimary, downloading && styles.btnPrimaryDisabled]}
              onPress={handleUpdateNow}
              disabled={downloading}
              accessibilityRole="button"
            >
              {downloading ? (
                <View style={styles.btnLoadingRow}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.btnPrimaryText}> Đang tải...</Text>
                </View>
              ) : (
                <Text style={styles.btnPrimaryText}>Cập nhật ngay</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F8F5EE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: theme.colors.goldLight,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  versionBadge: {
    backgroundColor: '#F5EBE1',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 14,
  },
  versionText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.primaryDark,
  },
  notes: {
    fontSize: 14,
    color: '#555555',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  progressContainer: {
    width: '100%',
    marginBottom: 16,
  },
  progressBarBg: {
    width: '100%',
    height: 8,
    backgroundColor: '#EBE5DA',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 4,
  },
  btnSecondary: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DED7CB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666666',
  },
  btnPrimary: {
    flex: 2,
    height: 46,
    borderRadius: 12,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryDisabled: {
    opacity: 0.8,
  },
  btnPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
