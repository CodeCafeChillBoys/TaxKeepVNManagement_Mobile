/**
 * Danh sách 34 Tỉnh / Thành phố của Việt Nam sau sáp nhập (Nghị quyết 202/2025/QH15)
 * (6 Thành phố trực thuộc Trung ương đặt đầu danh sách để tiện chọn nhanh,
 * tiếp theo là 28 tỉnh xếp theo thứ tự bảng chữ cái).
 */
export const VIETNAM_PROVINCES: readonly string[] = [
  'Hà Nội',
  'TP. Hồ Chí Minh',
  'Đà Nẵng',
  'Hải Phòng',
  'Cần Thơ',
  'Huế',
  'An Giang',
  'Bắc Ninh',
  'Cà Mau',
  'Cao Bằng',
  'Đắk Lắk',
  'Điện Biên',
  'Đồng Nai',
  'Đồng Tháp',
  'Gia Lai',
  'Hà Tĩnh',
  'Hưng Yên',
  'Khánh Hòa',
  'Lai Châu',
  'Lâm Đồng',
  'Lạng Sơn',
  'Lào Cai',
  'Nghệ An',
  'Ninh Bình',
  'Phú Thọ',
  'Quảng Ngãi',
  'Quảng Ninh',
  'Quảng Trị',
  'Sơn La',
  'Tây Ninh',
  'Thái Nguyên',
  'Thanh Hóa',
  'Tuyên Quang',
  'Vĩnh Long',
] as const;

/**
 * Chuẩn hóa chuỗi tiếng Việt: bỏ dấu, chuyển chữ thường, gộp khoảng trắng
 * để phục vụ tìm kiếm nhanh và tự động khớp địa chỉ OCR CCCD.
 */
export function normalizeVietnameseText(input?: string | null): string {
  if (!input) return '';
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const PROVINCE_ALIASES: Record<string, string[]> = {
  'TP. Hồ Chí Minh': [
    'tp ho chi minh',
    'thanh pho ho chi minh',
    'ho chi minh',
    'tphcm',
    'tp hcm',
    'hcm',
    'sai gon',
    'binh duong',
    'ba ria vung tau',
    'ba ria',
    'vung tau',
    'br vt',
    'brvt',
  ],
  'Hà Nội': ['ha noi', 'thanh pho ha noi', 'tp ha noi', 'thu do ha noi'],
  'Đà Nẵng': ['da nang', 'thanh pho da nang', 'tp da nang', 'quang nam'],
  'Hải Phòng': ['hai phong', 'thanh pho hai phong', 'tp hai phong', 'hai duong'],
  'Cần Thơ': ['can tho', 'thanh pho can tho', 'tp can tho', 'hau giang', 'soc trang'],
  'Huế': ['thua thien hue', 'thanh pho hue', 'tp hue', 'tinh thua thien hue', 'hue'],
  'An Giang': ['an giang', 'kien giang'],
  'Bắc Ninh': ['bac ninh', 'bac giang'],
  'Cà Mau': ['ca mau', 'bac lieu'],
  'Đắk Lắk': ['dak lak', 'dac lak', 'daklak', 'daclac', 'phu yen'],
  'Đồng Nai': ['dong nai', 'binh phuoc'],
  'Đồng Tháp': ['dong thap', 'tien giang'],
  'Gia Lai': ['gia lai', 'binh dinh'],
  'Hưng Yên': ['hung yen', 'thai binh'],
  'Khánh Hòa': ['khanh hoa', 'ninh thuan'],
  'Lâm Đồng': ['lam dong', 'dak nong', 'dac nong', 'daknong', 'binh thuan'],
  'Lào Cai': ['lao cai', 'yen bai'],
  'Ninh Bình': ['ninh binh', 'ha nam', 'nam dinh'],
  'Phú Thọ': ['phu tho', 'vinh phuc', 'hoa binh'],
  'Quảng Ngãi': ['quang ngai', 'kon tum', 'kontum'],
  'Quảng Trị': ['quang tri', 'quang binh'],
  'Tây Ninh': ['tay ninh', 'long an'],
  'Thái Nguyên': ['thai nguyen', 'bac kan', 'bac can'],
  'Tuyên Quang': ['tuyen quang', 'ha giang'],
  'Vĩnh Long': ['vinh long', 'ben tre', 'tra vinh'],
};

/**
 * Lọc danh sách tỉnh/thành theo từ khóa tìm kiếm (hỗ trợ có dấu & không dấu).
 */
export function filterVietnamProvinces(query?: string | null): string[] {
  const normalizedQuery = normalizeVietnameseText(query);
  if (!normalizedQuery) {
    return [...VIETNAM_PROVINCES];
  }

  return VIETNAM_PROVINCES.filter((province) => {
    const normProvince = normalizeVietnameseText(province);
    if (normProvince.includes(normalizedQuery)) return true;
    const aliases = PROVINCE_ALIASES[province] || [];
    return aliases.some((alias) => alias.includes(normalizedQuery));
  });
}

/**
 * Tự động nhận diện Tỉnh/Thành phố từ chuỗi địa chỉ đầy đủ (ví dụ từ OCR CCCD).
 * Ưu tiên kết quả xuất hiện ở cuối chuỗi địa chỉ (vì địa chỉ CCCD luôn kết thúc bằng Tỉnh/Thành phố).
 */
export function matchVietnamProvince(rawAddress?: string | null): string | null {
  if (!rawAddress || !rawAddress.trim()) return null;

  const trimmed = rawAddress.trim();
  const exact = VIETNAM_PROVINCES.find(
    (p) => p.toLowerCase() === trimmed.toLowerCase()
  );
  if (exact) return exact;

  const normAddress = ` ${normalizeVietnameseText(trimmed)} `;
  let bestProvince: string | null = null;
  let bestIndex = -1;
  let bestLength = 0;

  for (const province of VIETNAM_PROVINCES) {
    const candidates = [
      normalizeVietnameseText(province),
      ...(PROVINCE_ALIASES[province] || []),
    ].filter(Boolean);

    for (const candidate of candidates) {
      const token = ` ${candidate} `;
      const idx = normAddress.lastIndexOf(token);
      if (idx !== -1) {
        const endPos = idx + candidate.length;
        if (endPos > bestIndex || (endPos === bestIndex && candidate.length > bestLength)) {
          bestIndex = endPos;
          bestLength = candidate.length;
          bestProvince = province;
        }
      }
    }
  }

  return bestProvince;
}

/**
 * Làm sạch địa chỉ hồ sơ:
 * - Loại bỏ trường hợp dữ liệu cũ bị lưu nhầm thành dãy số CCCD / MST (9-13 chữ số) hoặc trùng citizenId.
 * - Nếu chuỗi khớp với 1 trong 34 Tỉnh/Thành phố (kể cả tên tỉnh cũ trước sáp nhập), chuẩn hóa về tên Tỉnh/Thành phố mới.
 */
export function sanitizeProfileAddress(
  rawAddress?: string | null,
  citizenId?: string | null
): string {
  if (!rawAddress) return '';
  const trimmed = rawAddress.trim();
  if (!trimmed) return '';

  // Bỏ qua nếu chuỗi chỉ toàn chữ số/khoảng trắng (ví dụ số CCCD 001187024680 hoặc MST)
  const digitsOnly = trimmed.replace(/[\s-]/g, '');
  if (/^\d{8,15}$/.test(digitsOnly)) {
    return '';
  }

  if (citizenId && trimmed === citizenId.trim()) {
    return '';
  }

  return matchVietnamProvince(trimmed) || trimmed;
}


