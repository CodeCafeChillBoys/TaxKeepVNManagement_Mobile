import type { ConsultationMessageDto } from '../../types/consultation';

/** BE chỉ cho gửi tin khi ca đã xác nhận hoặc đang diễn ra; lịch sử thì xem được mọi lúc. */
export function canSendChat(bookingStatus?: string | null): boolean {
  return bookingStatus === 'CONFIRMED' || bookingStatus === 'IN_PROGRESS';
}

/**
 * Gộp tin mới vào danh sách: bỏ trùng theo id, sắp xếp cũ → mới.
 * Tự tính isMine theo senderId vì tin phát qua SignalR luôn mang isMine = true (kể cả với người nhận),
 * và người gửi nhận lại chính tin mình qua SignalR sau khi đã có từ phản hồi POST.
 */
export function mergeChatMessages(
  current: ConsultationMessageDto[],
  incoming: ConsultationMessageDto[],
  currentUserId?: string | null
): ConsultationMessageDto[] {
  const byId = new Map<string, ConsultationMessageDto>();
  for (const m of [...current, ...incoming]) {
    byId.set(m.id, { ...m, isMine: currentUserId ? m.senderId === currentUserId : m.isMine });
  }
  return Array.from(byId.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

/** Sự kiện "MessagesRead": đánh dấu đã xem các tin trong messageIds mà người đọc không phải người gửi. */
export function applyMessagesRead(
  current: ConsultationMessageDto[],
  messageIds: string[],
  readerId: string
): ConsultationMessageDto[] {
  const ids = new Set(messageIds);
  if (!current.some((m) => ids.has(m.id) && !m.isRead && m.senderId !== readerId)) return current;
  return current.map((m) => (ids.has(m.id) && m.senderId !== readerId ? { ...m, isRead: true } : m));
}

/** Giờ gửi kiểu "14:05", khác ngày hôm nay thì thêm "dd/MM". */
export function formatChatTime(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  if (d.toDateString() === now.toDateString()) return `${hh}:${mm}`;
  const dd = String(d.getDate()).padStart(2, '0');
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  return `${hh}:${mm} ${dd}/${mo}`;
}
