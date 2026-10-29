import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { RootNavigationProp } from '../../navigation/types';
import { DrumHeader } from '../../components/brand/DrumHeader';
import { Dialog } from '../../components/common/Dialog';
import { taxChatApi } from '../../api/taxChatApi';
import type { TaxChatSession } from '../../types/taxChat';
import { chatErrorMessage, formatChatTime } from './taxChatUtils';

/** Danh sách phiên chat AI của user: mở lại, xóa, tạo phiên mới. */
export const TaxChatHistoryScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const [sessions, setSessions] = useState<TaxChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<TaxChatSession | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSessions(await taxChatApi.getSessions());
      setError('');
    } catch (err) {
      setError(chatErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // popTo: quay về màn Chat bên dưới (không chồng thêm màn); nonce để Chat nạp lại kể cả khi mở cùng phiên
  const openChat = (sessionId?: string) => navigation.popTo('TaxChat', { sessionId, nonce: Date.now() });

  const doDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await taxChatApi.deleteSession(confirmDelete.id);
      setSessions((prev) => prev.filter((s) => s.id !== confirmDelete.id));
      setError('');
    } catch (err) {
      setError(chatErrorMessage(err));
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <DrumHeader title="Lịch sử trò chuyện" onBack={() => navigation.goBack()} backTestID="chatHistoryBackBtn" />

      <TouchableOpacity style={styles.newBtn} onPress={() => openChat()} testID="chatNewSessionBtn" accessibilityRole="button">
        <Ionicons name="add-circle-outline" size={20} color={theme.colors.textOnPrimary} />
        <Text style={styles.newBtnText}>Cuộc trò chuyện mới</Text>
      </TouchableOpacity>

      {error ? (
        <Text style={styles.errorText} testID="chatHistoryError">
          {error}
        </Text>
      ) : null}

      {loading && sessions.length === 0 ? (
        <ActivityIndicator style={styles.loading} color={theme.colors.primary} />
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.listContent}
          onRefresh={load}
          refreshing={loading}
          testID="chatSessionList"
          ListEmptyComponent={
            error ? null : (
              <Text style={styles.empty} testID="chatHistoryEmpty">
                Chưa có cuộc trò chuyện nào.
              </Text>
            )
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <TouchableOpacity
                style={styles.rowMain}
                onPress={() => openChat(item.id)}
                testID={`chatSession_${item.id}`}
                accessibilityRole="button"
              >
                <Ionicons name="chatbubble-ellipses-outline" size={20} color={theme.colors.primary} />
                <View style={styles.rowText}>
                  <Text style={styles.title} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.time}>{formatChatTime(item.updated_at)}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => setConfirmDelete(item)}
                testID={`chatSessionDelete_${item.id}`}
                accessibilityRole="button"
                accessibilityLabel="Xóa cuộc trò chuyện"
              >
                <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      <Dialog
        visible={!!confirmDelete}
        title="Xóa cuộc trò chuyện?"
        message="Toàn bộ tin nhắn trong cuộc trò chuyện này sẽ bị xóa và không khôi phục được."
        detailLabel="Cuộc trò chuyện"
        detail={confirmDelete?.title}
        primaryLabel={deleting ? 'Đang xóa…' : 'Xóa'}
        secondaryLabel="Hủy"
        destructive
        onPrimary={() => {
          if (!deleting) void doDelete();
        }}
        onSecondary={() => setConfirmDelete(null)}
        testID="chatDeleteDialog"
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  newBtn: {
    marginHorizontal: 16,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
  },
  newBtnText: { fontFamily: fonts.bodySemi, fontSize: 14, color: theme.colors.textOnPrimary },
  errorText: { ...theme.typography.helper, color: theme.colors.error, paddingHorizontal: 16, paddingTop: 10 },
  loading: { marginTop: 40 },
  listContent: { padding: 16, gap: 10, flexGrow: 1 },
  empty: { ...theme.typography.helper, color: theme.colors.textSecondary, textAlign: 'center', marginTop: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    backgroundColor: theme.colors.surface,
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingLeft: 12 },
  rowText: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.bodyMedium, fontSize: 14, color: theme.colors.textPrimary },
  time: { ...theme.typography.helper, color: theme.colors.textSecondary },
  deleteBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});
