import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Platform,
  StatusBar,
  useWindowDimensions,
  Animated,
  PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import {
  MIN_ZOOM_SCALE,
  MAX_ZOOM_SCALE,
  clampZoomScale,
  stepZoomIn,
  stepZoomOut,
  getNextDoubleTapScale,
  calculatePinchDistance,
  calculatePinchScale,
  clampPanOffset,
  formatZoomPercent,
  isImageDocumentUri,
} from './imageZoomUtils';

export interface DocumentViewerItem {
  uri?: string;
  title?: string;
  docType?: string;
  fileName?: string;
  uploadedAt?: string;
  isReadable?: boolean;
  mimeType?: string;
  /** Thay dòng trạng thái mặc định ("Đang xử lý • Ngày nộp…") khi tài liệu không thuộc luồng duyệt giấy tờ */
  subtitle?: string;
}

interface DocumentViewerModalProps {
  visible: boolean;
  onClose: () => void;
  document: DocumentViewerItem | null;
  onRePick?: () => void;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = React.memo(({
  visible,
  onClose,
  document,
  onRePick,
}) => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<boolean>(false);
  const [displayScale, setDisplayScale] = useState<number>(MIN_ZOOM_SCALE);

  const viewerHeight = Math.max(260, screenHeight * 0.68);
  const useNative = Platform.OS !== 'web';

  const scaleAnim = useRef(new Animated.Value(MIN_ZOOM_SCALE)).current;
  const panXAnim = useRef(new Animated.Value(0)).current;
  const panYAnim = useRef(new Animated.Value(0)).current;

  const scaleRef = useRef<number>(MIN_ZOOM_SCALE);
  const panRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const gestureStartScaleRef = useRef<number>(MIN_ZOOM_SCALE);
  const gestureStartPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pinchStartDistRef = useRef<number | null>(null);
  const isPinchingRef = useRef<boolean>(false);
  const lastTapRef = useRef<number>(0);
  const viewportRef = useRef<{ width: number; height: number }>({
    width: screenWidth,
    height: viewerHeight,
  });
  viewportRef.current = { width: screenWidth, height: viewerHeight };

  const resetZoomImmediate = useCallback(() => {
    scaleRef.current = MIN_ZOOM_SCALE;
    panRef.current = { x: 0, y: 0 };
    isPinchingRef.current = false;
    pinchStartDistRef.current = null;
    lastTapRef.current = 0;
    scaleAnim.setValue(MIN_ZOOM_SCALE);
    panXAnim.setValue(0);
    panYAnim.setValue(0);
    setDisplayScale(MIN_ZOOM_SCALE);
  }, [scaleAnim, panXAnim, panYAnim]);

  const animateToZoom = useCallback(
    (targetScale: number) => {
      const nextScale = clampZoomScale(targetScale);
      const nextPan =
        nextScale <= MIN_ZOOM_SCALE
          ? { x: 0, y: 0 }
          : clampPanOffset(panRef.current, nextScale, viewportRef.current);

      scaleRef.current = nextScale;
      panRef.current = nextPan;
      setDisplayScale(nextScale);

      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: nextScale,
          duration: 180,
          useNativeDriver: useNative,
        }),
        Animated.timing(panXAnim, {
          toValue: nextPan.x,
          duration: 180,
          useNativeDriver: useNative,
        }),
        Animated.timing(panYAnim, {
          toValue: nextPan.y,
          duration: 180,
          useNativeDriver: useNative,
        }),
      ]).start();
    },
    [scaleAnim, panXAnim, panYAnim, useNative]
  );

  const handleZoomIn = useCallback(() => {
    animateToZoom(stepZoomIn(scaleRef.current));
  }, [animateToZoom]);

  const handleZoomOut = useCallback(() => {
    animateToZoom(stepZoomOut(scaleRef.current));
  }, [animateToZoom]);

  const handleZoomReset = useCallback(() => {
    animateToZoom(MIN_ZOOM_SCALE);
  }, [animateToZoom]);

  useEffect(() => {
    if (visible && document?.uri) {
      setLoading(true);
      setLoadError(false);
      resetZoomImmediate();
    } else if (!visible) {
      resetZoomImmediate();
    }
  }, [visible, document?.uri, resetZoomImmediate]);

  const handleRetry = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    resetZoomImmediate();
  }, [resetZoomImmediate]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (evt, gestureState) =>
          evt.nativeEvent.touches.length >= 2 ||
          Math.abs(gestureState.dx) > 2 ||
          Math.abs(gestureState.dy) > 2,
        onPanResponderGrant: (evt) => {
          const touches = evt.nativeEvent.touches;
          gestureStartPanRef.current = { ...panRef.current };
          gestureStartScaleRef.current = scaleRef.current;

          if (touches.length >= 2) {
            isPinchingRef.current = true;
            pinchStartDistRef.current = calculatePinchDistance(touches[0], touches[1]);
          } else {
            isPinchingRef.current = false;
            pinchStartDistRef.current = null;
          }
        },
        onPanResponderMove: (evt, gestureState) => {
          const touches = evt.nativeEvent.touches;
          if (touches.length >= 2) {
            const dist = calculatePinchDistance(touches[0], touches[1]);
            if (!isPinchingRef.current || pinchStartDistRef.current === null) {
              isPinchingRef.current = true;
              pinchStartDistRef.current = dist;
              gestureStartScaleRef.current = scaleRef.current;
              return;
            }

            const nextScale = calculatePinchScale(
              gestureStartScaleRef.current,
              pinchStartDistRef.current,
              dist
            );
            scaleRef.current = nextScale;
            scaleAnim.setValue(nextScale);

            const clampedPan = clampPanOffset(panRef.current, nextScale, viewportRef.current);
            panRef.current = clampedPan;
            panXAnim.setValue(clampedPan.x);
            panYAnim.setValue(clampedPan.y);
            setDisplayScale(nextScale);
          } else if (!isPinchingRef.current && scaleRef.current > MIN_ZOOM_SCALE) {
            const nextPan = clampPanOffset(
              {
                x: gestureStartPanRef.current.x + gestureState.dx,
                y: gestureStartPanRef.current.y + gestureState.dy,
              },
              scaleRef.current,
              viewportRef.current
            );
            panRef.current = nextPan;
            panXAnim.setValue(nextPan.x);
            panYAnim.setValue(nextPan.y);
          }
        },
        onPanResponderRelease: (_evt, gestureState) => {
          if (
            !isPinchingRef.current &&
            Math.abs(gestureState.dx) < 10 &&
            Math.abs(gestureState.dy) < 10
          ) {
            const now = Date.now();
            if (now - lastTapRef.current < 280) {
              lastTapRef.current = 0;
              animateToZoom(getNextDoubleTapScale(scaleRef.current));
            } else {
              lastTapRef.current = now;
            }
          }
          isPinchingRef.current = false;
          pinchStartDistRef.current = null;
        },
        onPanResponderTerminate: () => {
          isPinchingRef.current = false;
          pinchStartDistRef.current = null;
        },
      }),
    [scaleAnim, panXAnim, panYAnim, animateToZoom]
  );

  if (!visible || !document) return null;

  const isImage = isImageDocumentUri(document.uri, document.mimeType, document.fileName);

  const displayDate = document.uploadedAt
    ? document.uploadedAt.split('T')[0]
    : 'Hôm nay';

  const topPad = Platform.OS === 'android'
    ? Math.max(insets.top, StatusBar.currentHeight || 24) + 10
    : Math.max(insets.top, 20) + 10;

  const canZoomOut = displayScale > MIN_ZOOM_SCALE + 0.01;
  const canZoomIn = displayScale < MAX_ZOOM_SCALE - 0.01;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />

        {/* Top Header */}
        <View style={[styles.header, { paddingTop: topPad }]}>
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
            {document.subtitle ? (
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {document.subtitle}
              </Text>
            ) : (
              <View style={styles.headerMetaRow}>
                <Ionicons
                  name={document.isReadable ? 'checkmark-circle' : 'time-outline'}
                  size={14}
                  color={document.isReadable ? '#4CAF50' : '#FFA726'}
                  style={styles.metaIcon}
                />
                <Text style={styles.headerSubtitle} numberOfLines={1}>
                  {document.isReadable ? 'Đã duyệt hợp lệ' : 'Đang xử lý'} • Ngày nộp: {displayDate}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Body Viewer */}
        <View style={styles.body}>
          {isImage && document.uri ? (
            <>
              <View
                style={[styles.zoomViewport, { width: screenWidth, height: viewerHeight }]}
                {...(!loadError ? panResponder.panHandlers : {})}
              >
                {loading && !loadError && (
                  <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color={theme.colors.gold} />
                    <Text style={styles.loadingText}>Đang tải hình ảnh minh chứng...</Text>
                  </View>
                )}

                {loadError ? (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle-outline" size={54} color="#FF6B6B" />
                    <Text style={styles.errorTitle}>Không thể tải ảnh minh chứng</Text>
                    <Text style={styles.errorDesc}>
                      Vui lòng kiểm tra kết nối mạng hoặc thử tải lại.
                    </Text>
                    <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
                      <Ionicons name="refresh" size={18} color="#FFFFFF" style={styles.btnIcon} />
                      <Text style={styles.retryBtnText}>Thử lại</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Animated.View
                    style={{
                      width: screenWidth,
                      height: viewerHeight,
                      justifyContent: 'center',
                      alignItems: 'center',
                      transform: [
                        { translateX: panXAnim },
                        { translateY: panYAnim },
                        { scale: scaleAnim },
                      ],
                    }}
                  >
                    <Image
                      source={{ uri: document.uri }}
                      style={{ width: screenWidth, height: viewerHeight }}
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
                  </Animated.View>
                )}
              </View>

              {/* Thanh điều khiển Zoom In / Zoom Out / Đặt lại (tách khỏi PanResponder để không xung đột thao tác bấm) */}
              {!loadError && (
                <View style={styles.zoomToolbar}>
                  <TouchableOpacity
                    style={[styles.zoomBtn, !canZoomOut && styles.zoomBtnDisabled]}
                    onPress={handleZoomOut}
                    disabled={!canZoomOut}
                    accessibilityRole="button"
                    accessibilityLabel="Thu nhỏ ảnh"
                    testID="documentViewerZoomOutBtn"
                  >
                    <Ionicons name="remove" size={18} color="#FFFFFF" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.zoomPercentBtn}
                    onPress={handleZoomReset}
                    disabled={!canZoomOut}
                    accessibilityRole="button"
                    accessibilityLabel="Đặt lại tỷ lệ 100%"
                    testID="documentViewerZoomResetBtn"
                  >
                    <Text style={styles.zoomPercentText}>{formatZoomPercent(displayScale)}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.zoomBtn, !canZoomIn && styles.zoomBtnDisabled]}
                    onPress={handleZoomIn}
                    disabled={!canZoomIn}
                    accessibilityRole="button"
                    accessibilityLabel="Phóng to ảnh"
                    testID="documentViewerZoomInBtn"
                  >
                    <Ionicons name="add" size={18} color="#FFFFFF" />
                  </TouchableOpacity>

                  {canZoomOut && (
                    <TouchableOpacity
                      style={styles.zoomResetIconBtn}
                      onPress={handleZoomReset}
                      accessibilityRole="button"
                      accessibilityLabel="Thu về kích thước ban đầu"
                    >
                      <Ionicons name="contract-outline" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </>
          ) : (
            <View style={[styles.pdfCard, { maxWidth: Math.min(screenWidth * 0.88, 440) }]}>
              <View style={styles.pdfIconCircle}>
                <Ionicons name="document-text" size={64} color="#D32F2F" />
              </View>
              <Text style={styles.pdfTitle}>{document.fileName || 'Tài liệu minh chứng'}</Text>
              <Text style={styles.pdfNotice}>
                Định dạng tệp: {document.mimeType || 'PDF'}{'\n'}
                Tài liệu đã được lưu trữ an toàn trong hồ sơ thuế của bạn.
              </Text>
            </View>
          )}
        </View>

        {/* Bottom Info Bar */}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.fileInfoCol}>
            <Text style={styles.fileNameText} numberOfLines={1}>
              {document.fileName || document.uri?.split('/').pop()?.split('?')[0] || 'Tài liệu'}
            </Text>
            <Text style={styles.fileHintText}>
              {isImage
                ? 'Dùng nút +/- , chạm 2 lần hoặc chụm 2 ngón tay để phóng to, kéo để di chuyển'
                : 'Tài liệu chứng từ số'}
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
                <Ionicons name="camera-reverse-outline" size={18} color="#FFFFFF" style={styles.btnIcon} />
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
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0C0E',
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
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
    flexShrink: 1,
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
  metaIcon: {
    marginRight: 4,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#B0BEC5',
    flexShrink: 1,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  zoomViewport: {
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  zoomToolbar: {
    position: 'absolute',
    bottom: 14,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.86)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    paddingHorizontal: 6,
    paddingVertical: 5,
    gap: 4,
    zIndex: 10,
    elevation: 4,
  },
  zoomBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomBtnDisabled: {
    opacity: 0.35,
  },
  zoomPercentBtn: {
    minWidth: 54,
    paddingHorizontal: 8,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomPercentText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  zoomResetIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(139, 30, 30, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  loadingOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  loadingText: {
    marginTop: 12,
    color: '#ECEFF1',
    fontSize: 14,
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
    textAlign: 'center',
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
  btnIcon: {
    marginRight: 6,
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
    paddingTop: 14,
    backgroundColor: 'rgba(18, 21, 26, 0.98)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  fileInfoCol: {
    flex: 1,
    minWidth: 150,
    marginRight: 8,
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
