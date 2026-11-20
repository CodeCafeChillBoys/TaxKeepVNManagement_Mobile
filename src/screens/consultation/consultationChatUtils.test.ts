import { applyMessagesRead, canSendChat, formatChatTime, mergeChatMessages } from './consultationChatUtils';
import type { ConsultationMessageDto } from '../../types/consultation';

const msg = (id: string, senderId: string, createdAt: string, isMine = true): ConsultationMessageDto => ({
  id,
  bookingId: 'b1',
  senderId,
  senderRole: 'taxpayer',
  senderName: 'A',
  content: id,
  isRead: false,
  createdAt,
  isMine,
});

describe('consultationChatUtils', () => {
  it('canSendChat chỉ mở khi CONFIRMED hoặc IN_PROGRESS', () => {
    expect(canSendChat('CONFIRMED')).toBe(true);
    expect(canSendChat('IN_PROGRESS')).toBe(true);
    expect(canSendChat('COMPLETED')).toBe(false);
    expect(canSendChat(undefined)).toBe(false);
  });

  it('mergeChatMessages bỏ trùng id, sắp cũ → mới, tính lại isMine theo senderId', () => {
    const current = [msg('m2', 'me', '2026-11-19T08:02:00Z')];
    const incoming = [
      msg('m1', 'other', '2026-11-19T08:01:00Z', true), // SignalR gửi isMine = true cho cả người nhận
      msg('m2', 'me', '2026-11-19T08:02:00Z'), // bản lặp của tin mình vừa gửi
    ];
    const out = mergeChatMessages(current, incoming, 'me');
    expect(out.map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(out[0].isMine).toBe(false);
    expect(out[1].isMine).toBe(true);
  });

  it('applyMessagesRead chỉ đánh dấu đã xem tin trong danh sách và không phải của người đọc', () => {
    const list = [msg('m1', 'me', '2026-11-19T08:01:00Z'), msg('m2', 'me', '2026-11-19T08:02:00Z'), msg('m3', 'other', '2026-11-19T08:03:00Z')];
    const out = applyMessagesRead(list, ['m1', 'm3'], 'other');
    expect(out.map((m) => m.isRead)).toEqual([true, false, false]);
    expect(applyMessagesRead(out, ['m1'], 'other')).toBe(out); // không đổi gì → giữ nguyên tham chiếu, tránh render lại
  });

  it('formatChatTime chỉ hiện giờ nếu cùng ngày, khác ngày thêm ngày/tháng', () => {
    const now = new Date(2026, 10, 19, 15, 0);
    expect(formatChatTime(new Date(2026, 10, 19, 9, 5).toISOString(), now)).toBe('09:05');
    expect(formatChatTime(new Date(2026, 10, 18, 9, 5).toISOString(), now)).toBe('09:05 18/11');
  });
});
