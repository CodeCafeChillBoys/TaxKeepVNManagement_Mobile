import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Platform,
  StatusBar,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface DocumentViewerItem {
  uri?: string;
  title?: string;
  docType?: string;
  fileName?: string;
  uploadedAt?: string;
  isReadable?: boolean;
  mimeType?: string;
}

interface DocumentViewerModalProps {
  visible: boolean;
  onClose: () => void;
  document: DocumentViewerItem | null;
  onRePick?: () => void;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  visible,
  onClose,
  document,
  onRePick,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<boolean>(false);

  useEffect(() => {
    if (visible && document?.uri) {
      setLoading(true);
      setLoadError(false);
    }
  }, [visible, document?.uri]);

  if (!document) return null;

  const isImage =
    (document.mimeType && document.mimeType.includes('image')) ||
    (document.uri && document.uri.match(/\.(png|jpe?g|webp|gif)$/i)) ||
    (!document.mimeType && !document.uri?.match(/\.pdf$/i));

  const displayDate = document.uploadedAt
    ? document.uploadedAt.split('T')[0]
    : 'Hôm nay';

  const handleRetry = () => {
    setLoading(true);
    setLoadError(false);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0D0F12" />

        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Đóng xem trước"
            testID="closeDocumentViewerBtn"
          >
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {document.title || 'Giấy tờ minh chứng'}
            </Text>
            <View style={styles.headerMetaRow}>
              <Ionicons
                name={document.isReadable ? 'checkmark-circle' : 'time-outline'}
                size={14}
                color={document.isReadable ? '#4CAF50' : '#FFA726'}
                style={{ marginRight: 4 }}
              />
              <Text style={styles.headerSubtitle}>
                {document.isReadable ? 'Đã duyệt hợp lệ' : 'Đang xử lý'} • Ngày nộp: {displayDate}
              </Text>
            </View>
          </View>
        </View>

        {/* Body Viewer */}
        <View style={styles.body}>
          {isImage && document.uri ? (
            <ScrollView
              contentContainerStyle={styles.scrollContainer}
              maximumZoomScale={4}
              minimumZoomScale={1}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              centerContent
            >
              {loading && !loadError && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="large" color={theme.colors.gold} />
                  <Text style={styles.loadingText}>Đang tải hình ảnh từ máy chủ...</Text>
                </View>
              )}

              {loadError ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle-outline" size={54} color="#FF6B6B" />
                  <Text style={styles.errorTitle}>Không thể tải ảnh minh chứng</Text>
                  <Text style={styles.errorDesc}>
                    Vui lòng kiểm tra kết nối mạng hoặc thử lại sau.
                  </Text>
                  <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
                    <Ionicons name="refresh" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.retryBtnText}>Thử lại</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Image
                  source={{ uri: document.uri }}
                  style={styles.fullImage}
                  resizeMode="contain"
                  onLoadStart={() => {
                    setLoading(true);
                    setLoadError(false);
                  }}
                  onLoadEnd={() => setLoading(false)}
                  onError={() => {
                    setLoading(false);
                    setLoadError(true);
                  }}
                />
              )}
            </ScrollView>
          ) : (
            <View style={styles.pdfCard}>
              <View style={styles.pdfIconCircle}>
                <Ionicons name="document-text" size={64} color="#D32F2F" />
              </View>
              <Text style={styles.pdfTitle}>{document.fileName || 'Tài liệu minh chứng'}</Text>
              <Text style={styles.pdfNotice}>
                Định dạng tệp: {document.mimeType || 'PDF'}{'\n'}
                Tài liệu đã được lưu trữ mã hóa và xác thực an toàn trên hệ thống máy chủ Thuế.
              </Text>
            </View>
          )}
        </View>

        {/* Bottom Info Bar */}
        <View style={styles.footer}>
          <View style={styles.fileInfoCol}>
            <Text style={styles.fileNameText} numberOfLines={1}>
              {document.fileName || document.uri?.split('/').pop() || 'Tài liệu'}
            </Text>
            <Text style={styles.fileHintText}>
              {isImage ? 'Chạm 2 lần hoặc vuốt 2 ngón tay để phóng to ảnh' : 'Tài liệu văn bản số'}
            </Text>
          </View>

          <View style={styles.footerActions}>
            {onRePick && (
              <TouchableOpacity
                style={styles.repickBtn}
                onPress={() => {
                  onClose();
                  onRePick();
                }}
                accessibilityRole="button"
                accessibilityLabel="Đổi ảnh khác"
              >
                <Ionicons name="camera-reverse-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.repickBtnText}>Đổi ảnh</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.dismissBtn}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Đóng"
            >
              <Text style={styles.dismissBtnText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0C0E',
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 10 : 54,
    paddingBottom: 14,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(18, 21, 26, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    zIndex: 10,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  headerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#B0BEC5',
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: SCREEN_WIDTH,
    minHeight: SCREEN_HEIGHT * 0.65,
  },
  loadingOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#ECEFF1',
    fontSize: 14,
  },
  fullImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.72,
  },
  errorBox: {
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  errorTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
  },
  errorDesc: {
    color: '#90A4AE',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  pdfCard: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#1E232B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    maxWidth: SCREEN_WIDTH * 0.85,
  },
  pdfIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(211, 47, 47, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  pdfTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  pdfNotice: {
    color: '#90A4AE',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'rgba(18, 21, 26, 0.98)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fileInfoCol: {
    flex: 1,
    marginRight: 12,
  },
  fileNameText: {
    color: '#ECEFF1',
    fontSize: 13,
    fontWeight: '600',
  },
  fileHintText: {
    color: '#78909C',
    fontSize: 11,
    marginTop: 2,
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  repickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  repickBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  dismissBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  dismissBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
