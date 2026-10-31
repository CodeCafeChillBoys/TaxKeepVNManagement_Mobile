/** Viết hoa chữ cái đầu mỗi từ trong họ tên hiển thị. */
export function formatPersonName(name?: string | null): string {
  const raw = (name ?? '').trim().replace(/\s+/g, ' ');
  if (!raw) return '';
  return raw
    .split(' ')
    .map((word) => {
      const chars = Array.from(word);
      if (chars.length === 0) return word;
      const head = chars[0].toLocaleUpperCase('vi-VN');
      const tail = chars.slice(1).join('').toLocaleLowerCase('vi-VN');
      return head + tail;
    })
    .join(' ');
}
