import {
  clearDocNames,
  extractUploadErrorMessage,
  getDocTypeLabel,
  registerDocNames,
  resolveUploadFileName,
  RULES_NOT_CONFIGURED_LABEL,
  UNKNOWN_DOC_TYPE_LABEL,
} from './dependentDocHelpers';

describe('getDocTypeLabel', () => {
  afterEach(() => clearDocNames());

  it('ưu tiên docName truyền vào, rồi tên từ rule DB, rồi nhãn dựng sẵn', () => {
    expect(getDocTypeLabel('RESIDENCE_CT07', 'Giấy xác nhận cư trú CT07')).toBe('Giấy xác nhận cư trú CT07');
    registerDocNames([{ docType: 'birth_certificate', docName: 'Khai sinh (từ DB)' }]);
    expect(getDocTypeLabel('BIRTH_CERTIFICATE')).toBe('Khai sinh (từ DB)');
    expect(getDocTypeLabel('MARRIAGE_CERTIFICATE')).toBe('Giấy chứng nhận kết hôn');
  });

  it('mã mới chưa có tên thì không hiện mã thô', () => {
    expect(getDocTypeLabel('RESIDENCE_CT07')).toBe(UNKNOWN_DOC_TYPE_LABEL);
    expect(getDocTypeLabel(undefined)).toBe(UNKNOWN_DOC_TYPE_LABEL);
    registerDocNames([{ docType: 'NEW_CODE', docName: '  ' }]);
    expect(getDocTypeLabel('NEW_CODE')).toBe(UNKNOWN_DOC_TYPE_LABEL);
  });

  it('RULES_NOT_CONFIGURED hiện câu báo chưa cấu hình', () => {
    expect(getDocTypeLabel('RULES_NOT_CONFIGURED')).toBe(RULES_NOT_CONFIGURED_LABEL);
    expect(RULES_NOT_CONFIGURED_LABEL).toMatch(/chưa được cấu hình danh mục giấy tờ/);
  });
});

describe('extractUploadErrorMessage', () => {
  it('lấy lý do cụ thể trong errors thay vì câu chung', () => {
    const data = {
      message: 'Dữ liệu đầu vào không hợp lệ.',
      errors: { File: ['Định dạng tệp không hợp lệ. Hệ thống chỉ hỗ trợ PDF, JPG, JPEG, PNG.'] },
    };
    expect(extractUploadErrorMessage(data, 'x')).toBe(
      'Định dạng tệp không hợp lệ. Hệ thống chỉ hỗ trợ PDF, JPG, JPEG, PNG.'
    );
  });

  it('bỏ qua errorCode và dùng message của lỗi nghiệp vụ', () => {
    const data = { message: 'Họ và tên trên giấy tờ không trùng khớp.', errors: { errorCode: 'IDENTITY_MISMATCH' } };
    expect(extractUploadErrorMessage(data, 'x')).toBe('Họ và tên trên giấy tờ không trùng khớp.');
  });

  it('không có dữ liệu thì dùng fallback', () => {
    expect(extractUploadErrorMessage(undefined, 'Không thể tải lên')).toBe('Không thể tải lên');
  });
});

describe('resolveUploadFileName', () => {
  it('đổi đuôi HEIC theo file JPEG thật', () => {
    expect(resolveUploadFileName('IMG_0001.HEIC', 'file:///var/mobile/abc/ImagePicker/x.jpg', 'image/jpeg')).toBe(
      'IMG_0001.jpg'
    );
  });

  it('dùng mimeType khi uri không có đuôi (content:// Android)', () => {
    expect(resolveUploadFileName('IMG_1', 'content://media/external/images/1', 'image/png')).toBe('IMG_1.png');
  });

  it('giữ nguyên tên đã đúng đuôi', () => {
    expect(resolveUploadFileName('khai_sinh.pdf', 'file:///data/cache/khai_sinh.pdf', 'application/pdf')).toBe(
      'khai_sinh.pdf'
    );
  });
});
