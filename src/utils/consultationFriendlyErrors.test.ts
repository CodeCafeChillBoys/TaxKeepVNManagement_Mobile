import {
  formatCertVerificationNote,
  cleanRawTechnicalStrings,
  formatRefundStatus,
  toFriendlyConsultationError,
  formatThousands,
  parseThousands,
  formatVndWithDots,
} from './consultationFriendlyErrors';

describe('formatCertVerificationNote', () => {
  it('chuyển đổi ghi chú chứa thuật ngữ AI OCR kỹ thuật sang tiếng Việt ngắn gọn, chuyên nghiệp', () => {
    const rawAiNote =
      "AI tự động xác thực thành công. Khớp Họ tên ('VÕ VĂN CƯỜNG'). Loại: TAX_AGENT. Độ tin cậy: 99%.";
    expect(formatCertVerificationNote(rawAiNote)).toBe(
      'Chứng chỉ hợp lệ, thông tin trùng khớp với hồ sơ chuyên gia.'
    );
  });

  it('xử lý các biến thể ghi chú có chứa OCR hoặc TAX_AGENT hoặc RABBITMQ', () => {
    expect(
      formatCertVerificationNote('Xác thực qua AI OCR thành công với độ tin cậy cao')
    ).toBe('Chứng chỉ hợp lệ, thông tin trùng khớp với hồ sơ chuyên gia.');

    expect(
      formatCertVerificationNote('Hệ thống khớp họ tên người đại diện thuế TAX_AGENT')
    ).toBe('Chứng chỉ hợp lệ, thông tin trùng khớp với hồ sơ chuyên gia.');
  });

  it('giữ nguyên các thông điệp nghiệp vụ chuẩn từ Tổng cục Thuế hoặc quản trị viên', () => {
    const standardNote = 'Đã tra cứu đối soát hợp lệ trên Cổng thông tin Tổng cục Thuế.';
    expect(formatCertVerificationNote(standardNote)).toBe(standardNote);

    const validNote = 'Chứng chỉ hợp lệ';
    expect(formatCertVerificationNote(validNote)).toBe(validNote);
  });

  it('trả về chuỗi rỗng khi ghi chú null, undefined hoặc rỗng', () => {
    expect(formatCertVerificationNote(null)).toBe('');
    expect(formatCertVerificationNote(undefined)).toBe('');
    expect(formatCertVerificationNote('   ')).toBe('');
  });
});

describe('toFriendlyConsultationError', () => {
  it('chặn lỗi 500 hoặc ngoại lệ DbUpdate không để lọt thuật ngữ IT ra người dùng', () => {
    const error500 = {
      response: {
        status: 500,
        data: {
          message: 'An error occurred while saving entity changes foreign key constraint',
        },
      },
    };
    const friendly = toFriendlyConsultationError(
      error500,
      'Không thể xóa ca làm việc',
      'Không thể xóa ca làm việc lúc này do đã có giao dịch.'
    );
    expect(friendly.title).toBe('Không thể xóa ca làm việc');
    expect(friendly.message).toBe('Không thể xóa ca làm việc lúc này do đã có giao dịch.');
  });

  it('xử lý unhappy case khi backend trả về JSON dạng chuỗi (stringified JSON)', () => {
    const jsonStringError = {
      response: {
        status: 400,
        data: JSON.stringify({
          errorCode: 'FEE_OUT_OF_RANGE',
          message:
            'Mức phí đề xuất cho hình thức ONLINE_MEETING (60 phút) phải nằm trong khoảng 200,000 VNĐ - 2,000,000 VNĐ.',
        }),
      },
    };
    const friendly = toFriendlyConsultationError(jsonStringError);
    expect(friendly.title).toBe('Mức phí ngoài khung quy định');
    expect(friendly.message).toContain('Họp trực tuyến (Gọi video)');
    expect(friendly.message).not.toContain('ONLINE_MEETING');
  });

  it('xử lý unhappy case chuẩn ASP.NET ModelState validation dictionary', () => {
    const modelStateError = {
      response: {
        status: 400,
        data: {
          type: 'https://tools.ietf.org/html/rfc7231#section-6.5.1',
          title: 'One or more validation errors occurred.',
          status: 400,
          errors: {
            'FeeProposals[0].ProposedFee': [
              'Mức phí đề xuất không được nhỏ hơn mức sàn quy định.',
            ],
          },
        },
      },
    };
    const friendly = toFriendlyConsultationError(modelStateError);
    expect(friendly.message).toBe(
      'Mức phí đề xuất không được nhỏ hơn mức sàn quy định.'
    );
    expect(friendly.message).not.toContain('FeeProposals');
    expect(friendly.message).not.toContain('One or more validation errors');
  });

  it('xử lý ProblemDetails RFC 7807 có trường detail', () => {
    const problemDetailsError = {
      response: {
        status: 400,
        data: {
          title: 'Bad Request',
          status: 400,
          detail: 'Khung giờ này đã được khách hàng đặt hẹn.',
        },
      },
    };
    const friendly = toFriendlyConsultationError(problemDetailsError);
    expect(friendly.title).toBe('Khung giờ đã có khách');
    expect(friendly.message).toContain('đã được khách hàng đặt hẹn');
  });

  it('xử lý mã lỗi FEE_PROPOSAL_REQUIRED sang tiếng Việt thân thiện', () => {
    const feeReqError = {
      response: {
        status: 400,
        data: {
          errorCode: 'FEE_PROPOSAL_REQUIRED',
          message: 'Vui lòng đề xuất mức phí tư vấn trước khi nộp hồ sơ.',
        },
      },
    };
    const friendly = toFriendlyConsultationError(feeReqError);
    expect(friendly.title).toBe('Chưa nhập biểu phí');
    expect(friendly.message).toContain('Vui lòng nhập mức phí tư vấn');
  });

  it('xử lý lỗi mạng và mất kết nối không lộ AxiosError', () => {
    const netError = {
      code: 'ERR_NETWORK',
      message: 'Network Error',
    };
    const friendly = toFriendlyConsultationError(netError);
    expect(friendly.title).toBe('Lỗi kết nối');
    expect(friendly.message).toContain('Không thể kết nối đến máy chủ');
    expect(friendly.message).not.toContain('AxiosError');
    expect(friendly.message).not.toContain('ERR_NETWORK');
  });

  it('xử lý lỗi phản hồi HTML từ Gateway hoặc Proxy', () => {
    const htmlGatewayError = {
      response: {
        status: 504,
        data: '<html><head><title>504 Gateway Time-out</title></head><body>504 Gateway Time-out</body></html>',
      },
    };
    const friendly = toFriendlyConsultationError(htmlGatewayError);
    expect(friendly.message).toContain('Máy chủ phản hồi chậm hoặc đang bảo trì');
    expect(friendly.message).not.toContain('<html>');
  });
});

describe('formatThousands & parseThousands & formatVndWithDots', () => {
  it('định dạng số và chuỗi thành chuỗi có dấu chấm phân cách hàng nghìn', () => {
    expect(formatThousands(200000)).toBe('200.000');
    expect(formatThousands('200000')).toBe('200.000');
    expect(formatThousands(1500000)).toBe('1.500.000');
    expect(formatThousands('1500000')).toBe('1.500.000');
    expect(formatThousands('200.000')).toBe('200.000');
    expect(formatThousands(50000)).toBe('50.000');
    expect(formatThousands('')).toBe('');
    expect(formatThousands(null)).toBe('');
    expect(formatThousands(undefined)).toBe('');
    expect(formatThousands('abc')).toBe('');
  });

  it('chuyển đổi chuỗi có dấu chấm phân cách hàng nghìn thành số nguyên chính xác', () => {
    expect(parseThousands('200.000')).toBe(200000);
    expect(parseThousands('1.500.000')).toBe(1500000);
    expect(parseThousands('50.000')).toBe(50000);
    expect(parseThousands(200000)).toBe(200000);
    expect(parseThousands('')).toBe(0);
    expect(parseThousands(null)).toBe(0);
    expect(parseThousands(undefined)).toBe(0);
    expect(parseThousands('invalid')).toBe(0);
  });

  it('định dạng số tiền có dấu chấm kèm đơn vị VNĐ', () => {
    expect(formatVndWithDots(200000)).toBe('200.000 VNĐ');
    expect(formatVndWithDots('200000')).toBe('200.000 VNĐ');
    expect(formatVndWithDots('200.000')).toBe('200.000 VNĐ');
    expect(formatVndWithDots(1500000)).toBe('1.500.000 VNĐ');
    expect(formatVndWithDots(0)).toBe('0 VNĐ');
  });
});


