/** Câu hỏi gợi ý khi mở phiên chat mới */
export const SUGGESTED_QUESTIONS = [
  'Mức giảm trừ gia cảnh năm 2026 là bao nhiêu?',
  'Lương 30 triệu/tháng, 1 người phụ thuộc thì đóng thuế TNCN bao nhiêu?',
  'Những ai phải tự quyết toán thuế TNCN?',
  'Tiền làm thêm giờ có bị tính thuế không?',
];

/** Lỗi gọi chat → câu dễ hiểu cho người dùng (BE trả 503 khi AI Service lỗi / không chạy). */
export function chatErrorMessage(err: unknown): string {
  const e = err as { code?: string; response?: { status?: number; data?: { message?: string } } };
  if (e?.code === 'ECONNABORTED') return 'AI trả lời quá lâu. Vui lòng thử lại.';
  const status = e?.response?.status;
  if (status === 503) return 'Trợ lý AI tạm thời không khả dụng. Vui lòng thử lại sau.';
  if (!e?.response) return 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.';
  return e.response.data?.message || 'Không gửi được câu hỏi. Vui lòng thử lại.';
}

/** "23/10/2026 14:05" theo giờ máy; chuỗi lỗi → '' */
export function formatChatTime(iso: string): string {
  // shortcut: AI lưu now() của Postgres không kèm múi giờ, giả định DB chạy UTC → thêm 'Z'; DB đổi múi giờ thì giờ sẽ lệch
  const d = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
