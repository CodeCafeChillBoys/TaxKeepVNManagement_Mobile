import { debounce } from './useDebounce';

describe('debounce Utility', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('không thực thi ngay lập tức mà đợi đủ khoảng thời gian delay', () => {
    const fn = jest.fn();
    const debouncedFn = debounce(fn, 300);

    debouncedFn('tham số 1');
    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(299);
    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('tham số 1');
  });

  it('chỉ thực thi lần gọi cuối cùng khi được gọi liên tiếp nhanh hơn delay', () => {
    const fn = jest.fn();
    const debouncedFn = debounce(fn, 300);

    debouncedFn('lần 1');
    jest.advanceTimersByTime(100);
    debouncedFn('lần 2');
    jest.advanceTimersByTime(100);
    debouncedFn('lần 3 (chốt)');

    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('lần 3 (chốt)');
  });

  it('hủy hẹn giờ thành công khi gọi .cancel()', () => {
    const fn = jest.fn();
    const debouncedFn = debounce(fn, 300);

    debouncedFn('lần gọi sẽ bị hủy');
    expect(fn).not.toHaveBeenCalled();

    debouncedFn.cancel();
    jest.advanceTimersByTime(500);

    expect(fn).not.toHaveBeenCalled();
  });
});
