import { Platform, Linking } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';

export interface AppVersionInfo {
  versionCode: number;
  versionName: string;
  downloadUrl: string;
  releaseNotes: string;
  publishedAt: string;
}

// URL file version.json trên AWS S3
const UPDATE_METADATA_URL =
  'https://taxkeep-mobile-builds.s3.ap-southeast-2.amazonaws.com/apks/version.json';

// Build number hiện tại của app (được inject trong GitHub Actions)
export const CURRENT_BUILD_NUMBER = Number(
  process.env.EXPO_PUBLIC_BUILD_NUMBER || 1
);

/**
 * Kiểm tra xem có phiên bản mới hơn trên server S3 hay không.
 */
export async function checkForAppUpdate(): Promise<AppVersionInfo | null> {
  // Chỉ kiểm tra trên Android máy thật hoặc release build
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    return null;
  }

  try {
    // Thêm timestamp để bypass cache HTTP của S3 / CDN
    const response = await fetch(`${UPDATE_METADATA_URL}?t=${Date.now()}`);
    if (!response.ok) {
      return null;
    }

    const data: AppVersionInfo = await response.json();
    if (data && typeof data.versionCode === 'number') {
      if (data.versionCode > CURRENT_BUILD_NUMBER) {
        return data;
      }
    }
    return null;
  } catch {
    // Lỗi mạng hoặc server không phản hồi -> Bỏ qua, không làm gián đoạn app
    return null;
  }
}

/**
 * Tải file APK từ AWS S3 và kích hoạt trình cài đặt Android đè lên phiên bản cũ.
 */
export async function downloadAndInstallApk(
  downloadUrl: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  if (Platform.OS !== 'android') {
    // Nếu là iOS hoặc nền tảng khác, mở link tải qua trình duyệt
    await Linking.openURL(downloadUrl);
    return;
  }

  try {
    const targetFileUri = `${FileSystem.cacheDirectory || FileSystem.documentDirectory}taxkeep-update.apk`;

    // Xóa file update cũ nếu có
    const fileInfo = await FileSystem.getInfoAsync(targetFileUri);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(targetFileUri, { idempotent: true });
    }

    // Tải file APK với tiến trình
    const downloadResumable = FileSystem.createDownloadResumable(
      downloadUrl,
      targetFileUri,
      {},
      (downloadProgress) => {
        if (downloadProgress.totalBytesExpectedToWrite > 0 && onProgress) {
          const progress =
            downloadProgress.totalBytesWritten /
            downloadProgress.totalBytesExpectedToWrite;
          onProgress(Math.min(Math.max(progress, 0), 1));
        }
      }
    );

    const downloadResult = await downloadResumable.downloadAsync();
    if (!downloadResult || !downloadResult.uri) {
      throw new Error('Tải bản cập nhật thất bại.');
    }

    // Chuyển file URI thành Content URI chuẩn của Android
    const contentUri = await FileSystem.getContentUriAsync(downloadResult.uri);

    // Kích hoạt Package Installer của hệ điều hành Android
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: contentUri,
      flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
      type: 'application/vnd.android.package-archive',
    });
  } catch (error) {
    // Fallback: Nếu không gọi được Package Installer trực tiếp, mở trình duyệt để tải
    await Linking.openURL(downloadUrl);
  }
}

