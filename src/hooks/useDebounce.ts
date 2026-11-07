import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hàm debounce thuần túy để làm chậm thực thi hàm sau một khoảng thời gian không có cuộc gọi mới.
 * Hỗ trợ phương thức `.cancel()` để hủy hẹn giờ khi cần.
 *
 * @param func Hàm cần debounce
 * @param delay Thời gian chờ tính bằng mili-giây (mặc định: 300ms)
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number = 300
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  let timeoutId: NodeJS.Timeout | null = null;

  const debounced = (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = null;
    }, delay);
  };

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced;
}

/**
 * Hook làm chậm (debounce) một giá trị thay đổi nhanh (ví dụ: chuỗi tìm kiếm, bộ lọc).
 * Giúp tránh gọi API liên tục trên từng ký tự nhập liệu hoặc mỗi thao tác chuyển đổi bộ lọc.
 *
 * @param value Giá trị cần debounce (từ khóa tìm kiếm, tham số lọc)
 * @param delay Thời gian chờ tính bằng mili-giây (mặc định: 300ms)
 * @returns Giá trị đã được debounce sau khoảng thời gian `delay`
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook làm chậm (debounce) một hàm callback (ví dụ: hàm gọi API tìm kiếm, tính toán tạm tính).
 * Đảm bảo chỉ thực thi lần gọi cuối cùng sau khi người dùng ngừng thao tác trong khoảng `delay`.
 * Tự động hủy hẹn giờ khi component bị unmount, tránh rò rỉ bộ nhớ.
 *
 * @param callback Hàm cần debounce
 * @param delay Thời gian chờ tính bằng mili-giây (mặc định: 300ms)
 * @returns Hàm callback đã được debounce
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 300
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const debounced = useCallback(
    (...args: Parameters<T>) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        callbackRef.current(...args);
        timerRef.current = null;
      }, delay);
    },
    [delay]
  ) as ((...args: Parameters<T>) => void) & { cancel: () => void };

  debounced.cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return debounced;
}
