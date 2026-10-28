import { chatErrorMessage, formatChatTime } from './taxChatUtils';

describe('chatErrorMessage', () => {
  it('timeout → báo AI trả lời quá lâu', () => {
    expect(chatErrorMessage({ code: 'ECONNABORTED' })).toBe('AI trả lời quá lâu. Vui lòng thử lại.');
  });

  it('503 từ BE (AI Service lỗi) → báo AI tạm không khả dụng', () => {
    expect(chatErrorMessage({ response: { status: 503, data: { message: 'Không thể kết nối tới Tax AI Service.' } } })).toBe(
      'Trợ lý AI tạm thời không khả dụng. Vui lòng thử lại sau.'
    );
  });

  it('không có response (mất mạng) → báo kiểm tra mạng', () => {
    expect(chatErrorMessage(new Error('Network Error'))).toBe('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.');
  });

  it('lỗi khác → dùng message của BE, thiếu thì câu mặc định', () => {
    expect(chatErrorMessage({ response: { status: 400, data: { message: 'Câu hỏi trống' } } })).toBe('Câu hỏi trống');
    expect(chatErrorMessage({ response: { status: 500 } })).toBe('Không gửi được câu hỏi. Vui lòng thử lại.');
  });
});

describe('formatChatTime', () => {
  const local = (iso: string) => {
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
  };

  it('chuỗi không múi giờ được hiểu là UTC', () => {
    expect(formatChatTime('2026-10-23T03:05:00')).toBe(local('2026-10-23T03:05:00Z'));
  });

  it('chuỗi đã có múi giờ giữ nguyên', () => {
    expect(formatChatTime('2026-10-23T10:05:00+07:00')).toBe(local('2026-10-23T10:05:00+07:00'));
  });

  it('chuỗi lỗi → rỗng', () => {
    expect(formatChatTime('abc')).toBe('');
  });
});
