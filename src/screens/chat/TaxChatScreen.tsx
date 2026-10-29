import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { RootNavigationProp, RootStackParamList } from '../../navigation/types';
import { DrumHeader } from '../../components/brand/DrumHeader';
import { taxChatApi } from '../../api/taxChatApi';
import { chatErrorMessage, SUGGESTED_QUESTIONS } from './taxChatUtils';

type ChatItem = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** Câu hỏi gửi lỗi → hiện "Gửi lại" */
  failed?: boolean;
};

/** Chat tư vấn thuế với AI. Không có sessionId = phiên mới (AI tạo phiên ở câu hỏi đầu). */
export const TaxChatScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'TaxChat'>>();
  const paramSessionId = route.params?.sessionId;
  const nonce = route.params?.nonce;

  const [sessionId, setSessionId] = useState<string | null>(paramSessionId ?? null);
  const [items, setItems] = useState<ChatItem[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef<FlatList<ChatItem>>(null);

  // Mở phiên khác / phiên mới từ màn Lịch sử (nonce đổi mỗi lần bấm)
  useEffect(() => {
    setSessionId(paramSessionId ?? null);
    setItems([]);
    setError('');
    if (!paramSessionId) return;
    let alive = true;
    setLoadingHistory(true);
    taxChatApi
      .getMessages(paramSessionId)
      .then((msgs) => {
        if (alive) setItems(msgs.map((m) => ({ id: m.id, role: m.role, content: m.content })));
      })
      .catch((err) => alive && setError(chatErrorMessage(err)))
      .finally(() => alive && setLoadingHistory(false));
    return () => {
      alive = false;
    };
  }, [paramSessionId, nonce]);

  const send = async (text: string, retryId?: string) => {
    const question = text.trim();
    if (!question || sending) return;
    const id = retryId ?? `local-${Date.now()}`;
    setItems((prev) =>
      retryId ? prev.map((i) => (i.id === id ? { ...i, failed: false } : i)) : [...prev, { id, role: 'user', content: question }]
    );
    if (!retryId) setInput('');
    setSending(true);
    setError('');
    try {
      const res = await taxChatApi.ask({ question, session_id: sessionId });
      if (res.session_id) setSessionId(res.session_id);
      setItems((prev) => [...prev, { id: `ai-${Date.now()}`, role: 'assistant', content: res.answer }]);
    } catch (err) {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, failed: true } : i)));
      setError(chatErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const renderItem = ({ item }: { item: ChatItem }) =>
    item.role === 'user' ? (
      <View style={styles.userWrap}>
        <View style={[styles.bubble, styles.userBubble]} testID="chatUserMessage">
          <Text style={styles.userText}>{item.content}</Text>
        </View>
        {item.failed ? (
          <TouchableOpacity
            onPress={() => send(item.content, item.id)}
            disabled={sending}
            style={styles.retryBtn}
            testID="chatRetryBtn"
            accessibilityRole="button"
            accessibilityLabel="Gửi lại câu hỏi"
          >
            <Ionicons name="refresh" size={13} color={theme.colors.error} />
            <Text style={styles.retryText}>Gửi lỗi · Gửi lại</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    ) : (
      <View style={[styles.bubble, styles.aiBubble]} testID="chatAiMessage">
        <Markdown style={markdownStyles}>{item.content}</Markdown>
      </View>
    );

  const showSuggestions = !paramSessionId && items.length === 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <DrumHeader
        title="Hỏi đáp thuế AI"
        onBack={() => navigation.goBack()}
        backTestID="chatBackBtn"
        right={
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => navigation.navigate('TaxChatHistory')}
            testID="chatHistoryBtn"
            accessibilityRole="button"
            accessibilityLabel="Lịch sử trò chuyện"
          >
            <Ionicons name="time-outline" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        }
      />

      {/* Android edge-to-edge không tự đẩy nội dung lên khi mở bàn phím → dùng padding cho cả 2 nền tảng */}
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        {loadingHistory ? (
          <ActivityIndicator style={styles.loading} color={theme.colors.primary} />
        ) : (
          <FlatList
            ref={listRef}
            data={items}
            keyExtractor={(i) => i.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            keyboardShouldPersistTaps="handled"
            testID="chatMessageList"
            ListHeaderComponent={
              showSuggestions ? (
                <View style={styles.welcome} testID="chatSuggestions">
                  <Ionicons name="sparkles-outline" size={28} color={theme.colors.gold} />
                  <Text style={styles.welcomeTitle}>Hỏi trợ lý thuế TaxKeep</Text>
                  <Text style={styles.welcomeText}>
                    Giải đáp về thuế TNCN, giảm trừ gia cảnh, quyết toán. Câu trả lời chỉ mang tính tham khảo.
                  </Text>
                  {SUGGESTED_QUESTIONS.map((q, idx) => (
                    <TouchableOpacity
                      key={q}
                      style={styles.suggestion}
                      onPress={() => send(q)}
                      disabled={sending}
                      testID={`chatSuggestion_${idx}`}
                    >
                      <Text style={styles.suggestionText}>{q}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null
            }
            ListFooterComponent={
              sending ? (
                <View style={[styles.bubble, styles.aiBubble, styles.typing]} testID="chatTyping">
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                  <Text style={styles.typingText}>AI đang trả lời…</Text>
                </View>
              ) : null
            }
          />
        )}

        {error ? (
          <Text style={styles.errorText} testID="chatErrorText">
            {error}
          </Text>
        ) : null}

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Nhập câu hỏi về thuế…"
            placeholderTextColor={theme.colors.textPlaceholder}
            multiline
            maxLength={2000}
            testID="chatInput"
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
            onPress={() => send(input)}
            disabled={!input.trim() || sending}
            testID="chatSendBtn"
            accessibilityRole="button"
            accessibilityLabel="Gửi câu hỏi"
          >
            <Ionicons name="send" size={18} color={theme.colors.textOnPrimary} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const markdownStyles = StyleSheet.create({
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: theme.colors.textPrimary },
  strong: { fontFamily: fonts.bodyBold },
  heading1: { fontFamily: fonts.bodyBold, fontSize: 17, marginVertical: 6 },
  heading2: { fontFamily: fonts.bodyBold, fontSize: 16, marginVertical: 6 },
  heading3: { fontFamily: fonts.bodyBold, fontSize: 15, marginVertical: 4 },
  paragraph: { marginTop: 2, marginBottom: 6 },
  table: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 6, marginVertical: 6 },
  th: { padding: 6, backgroundColor: theme.colors.surfaceSecondary },
  td: { padding: 6 },
  tr: { borderBottomWidth: 1, borderColor: theme.colors.border },
  code_inline: { backgroundColor: theme.colors.surfaceSecondary, fontSize: 13 },
});

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  loading: { marginTop: 40 },
  listContent: { padding: 16, gap: 10 },
  welcome: { alignItems: 'center', gap: 8, paddingVertical: 12 },
  welcomeTitle: { ...theme.typography.sectionTitle, color: theme.colors.textPrimary },
  welcomeText: { ...theme.typography.helper, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: 6 },
  suggestion: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  suggestionText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: theme.colors.primary },
  bubble: { borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12 },
  userWrap: { alignItems: 'flex-end', gap: 4 },
  userBubble: { maxWidth: '85%', backgroundColor: theme.colors.primary, borderBottomRightRadius: 4 },
  userText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: theme.colors.textOnPrimary },
  aiBubble: {
    alignSelf: 'flex-start',
    maxWidth: '95%',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderBottomLeftRadius: 4,
  },
  typing: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  typingText: { ...theme.typography.helper, color: theme.colors.textSecondary },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2 },
  retryText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: theme.colors.error },
  errorText: { ...theme.typography.helper, color: theme.colors.error, paddingHorizontal: 16, paddingBottom: 6 },
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
