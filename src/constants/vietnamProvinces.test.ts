import {
  VIETNAM_PROVINCES,
  filterVietnamProvinces,
  matchVietnamProvince,
  sanitizeProfileAddress,
} from './vietnamProvinces';

describe('vietnamProvinces', () => {
  it('chứa đủ 34 tỉnh/thành phố Việt Nam sau sáp nhập', () => {
    expect(VIETNAM_PROVINCES).toHaveLength(34);
    expect(new Set(VIETNAM_PROVINCES).size).toBe(34);
  });

  it('lọc tỉnh/thành theo từ khóa có dấu, không dấu và tên tỉnh cũ trước sáp nhập', () => {
    expect(filterVietnamProvinces('ha noi')).toContain('Hà Nội');
    expect(filterVietnamProvinces('hcm')).toContain('TP. Hồ Chí Minh');
    expect(filterVietnamProvinces('Đà Nẵng')).toEqual(['Đà Nẵng']);
    expect(filterVietnamProvinces('vung tau')).toEqual(['TP. Hồ Chí Minh']);
    expect(filterVietnamProvinces('binh duong')).toEqual(['TP. Hồ Chí Minh']);
    expect(filterVietnamProvinces('quang nam')).toEqual(['Đà Nẵng']);
  });

  it('tự động khớp tỉnh/thành từ địa chỉ OCR CCCD đầy đủ (bao gồm tỉnh cũ)', () => {
    expect(matchVietnamProvince('Ha Noi')).toBe('Hà Nội');
    expect(
      matchVietnamProvince('Số 12 Điện Biên Phủ, Phường Đa Kao, Quận 1, Thành phố Hồ Chí Minh')
    ).toBe('TP. Hồ Chí Minh');
    expect(
      matchVietnamProvince('Phường Đông Hòa, TP. Dĩ An, Tỉnh Bình Dương')
    ).toBe('TP. Hồ Chí Minh');
    expect(
      matchVietnamProvince('Thôn 2, Xã Hòa Tiến, Huyện Hòa Vang, Đà Nẵng')
    ).toBe('Đà Nẵng');
    expect(
      matchVietnamProvince('15 Lê Lợi, Phường Phú Hội, Tỉnh Thừa Thiên Huế')
    ).toBe('Huế');
    expect(matchVietnamProvince('')).toBeNull();
    expect(matchVietnamProvince(null)).toBeNull();
  });

  it('loại bỏ số CCCD/MST bị lưu nhầm trong địa chỉ hồ sơ', () => {
    expect(sanitizeProfileAddress('001187024680', '001187024680')).toBe('');
    expect(sanitizeProfileAddress('079201001234')).toBe('');
    expect(sanitizeProfileAddress('Bình Dương')).toBe('TP. Hồ Chí Minh');
    expect(sanitizeProfileAddress('Hà Nội')).toBe('Hà Nội');
  });
});

