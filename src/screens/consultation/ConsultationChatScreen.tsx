import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { RootNavigationProp, RootStackParamList } from '../../navigation/types';
import { DrumHeader } from '../../components/brand/DrumHeader';
import { consultationApi } from '../../api/consultationApi';
import { useAuthStore } from '../../stores/useAuthStore';
import { connectConsultationHub, ConsultationHubConnection } from '../../services/consultationHub';
import { formatBookingStatus } from '../../types/consultation';
import type {
  ConsultationChatPartnerDto,
  ConsultationMessageDto,
} from '../../types/consultation';
import { applyMessagesRead, canSendChat, formatChatTime, mergeChatMessages } from './consultationChatUtils';

const PAGE_SIZE = 30;
const TYPING_IDLE_MS = 3000;

const MessageBubble = memo(({ item }: { item: ConsultationMessageDto }) => (
  <View style={[styles.row, item.isMine ? styles.rowMine : styles.rowOther]}>
    <View style={[styles.bubble, item.isMine ? styles.bubbleMine : styles.bubbleOther]}>
      <Text style={item.isMine ? styles.textMine : styles.textOther}>{item.content}</Text>
    </View>
    <Text style={styles.time}>
      {formatChatTime(item.createdAt)}
      {item.isMine && item.isRead ? ' · Đã xem' : ''}
    </Text>
  </View>
));

/** Chat 1-1 giữa người nộp thuế và chuyên gia trong một ca tư vấn (dùng chung cho cả hai vai trò). */
export const ConsultationChatScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'ConsultationChat'>>();
  const { bookingId } = route.params;
  const currentUserId = useAuthStore((s) => s.user?.id);

  const [messages, setMessages] = useState<ConsultationMessageDto[]>([]);
  const [partner, setPartner] = useState<ConsultationChatPartnerDto | null>(null);
  const [topicTitle, setTopicTitle] = useState('');
  const [bookingStatus, setBookingStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [page, setPage] = useState(1);
  const [hasOlder, setHasOlder] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [error, setError] = useState('');

  const hubRef = useRef<ConsultationHubConnection | null>(null);
  const typingSentRef = useRef(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const partnerTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markRead = useCallback(() => {
    consultationApi.markChatRead(bookingId).catch(() => {});
  }, [bookingId]);

  // Tải trang mới nhất (lần đầu, khi nối lại SignalR hoặc khi ca đổi trạng thái)
  const loadLatest = useCallback(async () => {
    try {
      const res = await consultationApi.getChatHistory(bookingId, 1, PAGE_SIZE);
      setPartner(res.partner);
      setTopicTitle(res.topicTitle);
      setBookingStatus(res.bookingStatus);
      setMessages((prev) => mergeChatMessages(prev, res.messages.items, currentUserId));
      setHasOlder(res.messages.pagination.totalPages > 1);
      setError('');
      markRead();
    } catch (err: any) {
      setError(err?.message || 'Không thể tải lịch sử tin nhắn.');
    } finally {
      setLoading(false);
    }
  }, [bookingId, currentUserId, markRead]);

  const loadOlder = useCallback(async () => {
    if (!hasOlder || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const next = page + 1;
      const res = await consultationApi.getChatHistory(bookingId, next, PAGE_SIZE);
      setMessages((prev) => mergeChatMessages(prev, res.messages.items, currentUserId));
      setPage(next);
      setHasOlder(next < res.messages.pagination.totalPages);
    } catch {
      // giữ nguyên danh sách, người dùng kéo lại để thử tiếp
    } finally {
      setLoadingOlder(false);
    }
  }, [bookingId, currentUserId, hasOlder, loadingOlder, page]);

  useEffect(() => {
    loadLatest();
  }, [loadLatest]);

  // Kết nối realtime; nếu không nối được thì vẫn chat được qua REST, chỉ không tự nhận tin mới
  useEffect(() => {
    let alive = true;
    connectConsultationHub(bookingId, {
      onMessage: (msg) => {
        setMessages((prev) => mergeChatMessages(prev, [msg], currentUserId));
        if (msg.senderId !== currentUserId) {
          setPartnerTyping(false);
          markRead();
        }
      },
      onTyping: (evt) => {
        if (evt.userId === currentUserId) return;
        setPartnerTyping(evt.isTyping);
        if (partnerTypingTimerRef.current) clearTimeout(partnerTypingTimerRef.current);
        // phòng khi tín hiệu "ngừng gõ" bị rơi
        if (evt.isTyping) partnerTypingTimerRef.current = setTimeout(() => setPartnerTyping(false), TYPING_IDLE_MS * 2);
      },
      onMessagesRead: (evt) => {
        if (evt.readerId === currentUserId) return;
        setMessages((prev) => applyMessagesRead(prev, evt.messageIds, evt.readerId));
      },
      onSessionChanged: () => loadLatest(),
    })
      .then((hub) => {
        if (alive) hubRef.current = hub;
        else hub.stop();
      })
      .catch((err) => {
        if (alive) setError('Chưa kết nối được realtime. Chạm vào đây để tải tin mới.');
        if (__DEV__) console.warn('[ConsultationHub] connect failed', err);
      });

    return () => {
      alive = false;
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (partnerTypingTimerRef.current) clearTimeout(partnerTypingTimerRef.current);
      hubRef.current?.stop();
      hubRef.current = null;
    };
  }, [bookingId, currentUserId, loadLatest, markRead]);

  const stopTyping = useCallback(() => {
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (typingSentRef.current) {
      typingSentRef.current = false;
      hubRef.current?.sendTyping(false);
    }
  }, []);

  const handleChangeText = (value: string) => {
    setText(value);
    if (!value.trim()) {
      stopTyping();
      return;
    }
    if (!typingSentRef.current) {
      typingSentRef.current = true;
      hubRef.current?.sendTyping(true);
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(stopTyping, TYPING_IDLE_MS);
  };

  const handleSend = async () => {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setError('');
    stopTyping();
    try {
      const sent = await consultationApi.sendChatMessage(bookingId, content);
      setMessages((prev) => mergeChatMessages(prev, [sent], currentUserId));
      setText('');
    } catch (err: any) {
      // Giữ nguyên nội dung trong ô nhập để người dùng gửi lại
      setError(err?.message || 'Không thể gửi tin nhắn.');
    } finally {
      setSending(false);
    }
  };

  // FlatList inverted: phần tử đầu nằm dưới cùng → đưa tin mới nhất lên đầu mảng
  const listData = useMemo(() => [...messages].reverse(), [messages]);
  const keyExtractor = useCallback((m: ConsultationMessageDto) => m.id, []);
  const renderItem = useCallback(({ item }: { item: ConsultationMessageDto }) => <MessageBubble item={item} />, []);

  const sendable = canSendChat(bookingStatus);
  const statusInfo = bookingStatus
    ? formatBookingStatus(bookingStatus, null, partner?.role === 'taxpayer')
    : null;
  const subtitle = [partner?.jobTitle, partner?.specializationName].filter(Boolean).join(' · ');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <DrumHeader
        title={partner?.fullName || 'Trò chuyện tư vấn'}
        onBack={() => navigation.goBack()}
        backTestID="consultationChatBackBtn"
      />

      <View style={styles.infoBar} testID="consultationChatInfo">
        <View style={styles.flex}>
          {topicTitle ? (
            <Text style={styles.topic} numberOfLines={1}>
              {topicTitle}
            </Text>
          ) : null}
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {statusInfo ? (
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
            <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
          </View>
        ) : null}
      </View>

      {/* Android edge-to-edge không tự đẩy nội dung khi mở bàn phím → padding cho cả 2 nền tảng (giống TaxChatScreen) */}
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        {loading ? (
          <ActivityIndicator style={styles.loading} color={theme.colors.primary} />
        ) : (
          <FlatList
            inverted
            data={listData}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            onEndReached={loadOlder}
            onEndReachedThreshold={0.2}
            keyboardShouldPersistTaps="handled"
            testID="consultationChatList"
            removeClippedSubviews={Platform.OS !== 'web'}
            ListHeaderComponent={
              partnerTyping ? (
                <Text style={styles.typingText} testID="consultationChatTyping">
                  {partner?.fullName || 'Đối phương'} đang nhập…
                </Text>
              ) : undefined
            }
            ListFooterComponent={
              loadingOlder ? <ActivityIndicator style={styles.olderLoading} color={theme.colors.primary} /> : undefined
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="chatbubbles-outline" size={32} color={theme.colors.textSecondary} />
                <Text style={styles.emptyText}>Chưa có tin nhắn nào. Hãy gửi lời chào để bắt đầu.</Text>
              </View>
            }
          />
        )}

        {error ? (
          <TouchableOpacity onPress={loadLatest} testID="consultationChatError">
            <Text style={styles.errorText}>{error}</Text>
          </TouchableOpacity>
        ) : null}

        {sendable ? (
          <View style={styles.inputBar}>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={handleChangeText}
              placeholder="Nhập tin nhắn…"
              placeholderTextColor={theme.colors.textPlaceholder}
              multiline
              maxLength={4000}
              testID="consultationChatInput"
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!text.trim() || sending}
              testID="consultationChatSendBtn"
              accessibilityRole="button"
              accessibilityLabel="Gửi tin nhắn"
            >
              {sending ? (
                <ActivityIndicator size="small" color={theme.colors.textOnPrimary} />
              ) : (
                <Ionicons name="send" size={18} color={theme.colors.textOnPrimary} />
              )}
            </TouchableOpacity>
          </View>
        ) : !loading ? (
          <Text style={styles.closedNote} testID="consultationChatClosed">
            Chỉ nhắn tin được khi lịch hẹn đã xác nhận hoặc đang tư vấn. Bạn vẫn xem được lịch sử trò chuyện.
          </Text>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  loading: { marginTop: 40 },
  infoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  topic: { fontFamily: fonts.bodyBold, fontSize: 14, color: theme.colors.textPrimary },
  subtitle: { ...theme.typography.helper, color: theme.colors.textSecondary },
  statusBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontFamily: fonts.bodyMedium, fontSize: 11 },
  listContent: { padding: 16, gap: 8 },
  row: { maxWidth: '85%', gap: 2 },
  rowMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  rowOther: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12 },
  bubbleMine: { backgroundColor: theme.colors.primary, borderBottomRightRadius: 4 },
  bubbleOther: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderBottomLeftRadius: 4,
  },
  textMine: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: theme.colors.textOnPrimary },
  textOther: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: theme.colors.textPrimary },
  time: { fontFamily: fonts.body, fontSize: 11, color: theme.colors.textSecondary },
  typingText: { ...theme.typography.helper, color: theme.colors.textSecondary, fontStyle: 'italic' },
  olderLoading: { marginVertical: 8 },
  // inverted list lật cả phần rỗng → lật lại cho đúng chiều
  empty: { alignItems: 'center', gap: 8, paddingVertical: 40, transform: [{ scaleY: -1 }] },
  emptyText: { ...theme.typography.helper, color: theme.colors.textSecondary, textAlign: 'center' },
  errorText: { ...theme.typography.helper, color: theme.colors.error, paddingHorizontal: 16, paddingBottom: 6 },
  closedNote: {
    ...theme.typography.helper,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 40,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: theme.colors.inputBackground,
    fontFamily: fonts.body,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
  },
  sendBtnDisabled: { opacity: 0.4 },
});
