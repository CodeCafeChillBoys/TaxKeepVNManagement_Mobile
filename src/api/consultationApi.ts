import { Platform } from 'react-native';
import { apiClient } from './apiClient';
import type { ApiResponse } from './authApi';
import type {
  ExpertDetailResponse,
  ExpertListItemResponse,
  ExpertSearchResultDto,
  ExpertSearchQueryParameters,
  ExpertAvailableSlotDto,
  ExpertPublicReviewDto,
  PagedResult,
  SpecializationDto,
  BookingPreviewRequest,
  BookingPreviewResponse,
  BookingDetailResponse,
  BookingListItemResponse,
  CreateBookingRequest,
  ExpertApplicationDetailResponse,
  SaveExpertApplicationDraftRequest,
  CertificateResponseDto,
  ExpertCertificateConfigDto,
  ConsultationFeeConfigDto,
  PaymentLinkResponse,
  EscrowTransactionResponse,
  ConsultationSessionResponse,
  JoinConsultationResponse,
  SharedTaxDossierResponse,
  UpcomingMeetingReminderDto,
  CreateExpertSlotRequest,
  UpdateExpertSlotRequest,
  CreateRecurringSlotRequest,
  RecurringSlotBatchResultResponse,
  ExpertSortOptionsResponse,
  ExpertSlotFilterParameters,
  ExpertSlotDetailResponse,
  EmergencyCancelSlotResponse,
  CreateReviewRequest,
  ReviewDetailResponse,
  ReviewEligibilityResponse,
  CreateDisputeRequest,
  DisputeDetailResponse,
  DisputeEligibilityResponse,
  ExpertRespondDisputeRequest,
} from '../types/consultation';

function unwrap<T>(res: { data: ApiResponse<T> }, fallbackMsg: string): T {
  const body = res.data;
  if (!body?.success || body.data === undefined || body.data === null) {
    throw new Error(body?.message || body?.errorCode || fallbackMsg);
  }
  return body.data;
}

function unwrapVoid(res: { data: ApiResponse<any> }, fallbackMsg: string): void {
  const body = res.data;
  if (!body?.success) {
    throw new Error(body?.message || body?.errorCode || fallbackMsg);
  }
}

export const consultationApi = {
  /**
   * Tìm kiếm, lọc và phân trang danh sách chuyên gia
   * GET /api/v1/experts
   */
  async searchExperts(query: ExpertSearchQueryParameters): Promise<ExpertSearchResultDto> {
    const params = new URLSearchParams();
    if (query.keyword?.trim()) params.append('keyword', query.keyword.trim());
    if (query.specializationIds && query.specializationIds.length > 0) {
      query.specializationIds.forEach((id) => params.append('specializationIds', String(id)));
    }
    if (query.minFee !== undefined && query.minFee !== null) params.append('minFee', String(query.minFee));
    if (query.maxFee !== undefined && query.maxFee !== null) params.append('maxFee', String(query.maxFee));
    if (query.minRating !== undefined && query.minRating !== null) params.append('minRating', String(query.minRating));
    if (query.timeFilter && query.timeFilter !== 'All') params.append('timeFilter', query.timeFilter);
    if (query.sortBy) params.append('sortBy', query.sortBy);
    params.append('page', String(query.page || 1));
    params.append('size', String(query.size || 10));

    const res = await apiClient.get<ApiResponse<ExpertSearchResultDto>>(
      `/api/v1/experts?${params.toString()}`
    );
    return unwrap(res, 'Không thể tải danh sách chuyên gia.');
  },

  /**
   * Lấy cấu hình tiêu chí sắp xếp và danh sách option tìm kiếm từ Admin
   * GET /api/v1/experts/sort-options
   */
  async getExpertSortOptions(): Promise<ExpertSortOptionsResponse> {
    const res = await apiClient.get<ApiResponse<ExpertSortOptionsResponse>>(
      '/api/v1/experts/sort-options'
    );
    return unwrap(res, 'Không thể tải tiêu chí sắp xếp chuyên gia.');
  },

  /**
   * Lấy danh sách chuyên gia nổi bật / đề xuất trang chủ
   * GET /api/v1/experts/featured?count=6
   */
  async getFeaturedExperts(count = 6): Promise<ExpertListItemResponse[]> {
    const res = await apiClient.get<ApiResponse<ExpertListItemResponse[]>>(
      `/api/v1/experts/featured?count=${count}`
    );
    return unwrap(res, 'Không thể tải danh sách chuyên gia nổi bật.');
  },

  /**
   * Xem thông tin chi tiết hồ sơ công khai của chuyên gia
   * GET /api/v1/experts/{id}
   */
  async getExpertDetail(id: string): Promise<ExpertDetailResponse> {
    const res = await apiClient.get<ApiResponse<ExpertDetailResponse>>(`/api/v1/experts/${id}`);
    return unwrap(res, 'Không thể tải thông tin chi tiết chuyên gia.');
  },

  /**
   * Lấy danh sách đánh giá của khách hàng về chuyên gia
   * GET /api/v1/experts/{id}/reviews?page=1&size=10&rating=5
   */
  async getExpertReviews(
    id: string,
    params?: { page?: number; size?: number; rating?: number }
  ): Promise<PagedResult<ExpertPublicReviewDto>> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', String(params.page));
    if (params?.size) query.append('size', String(params.size));
    if (params?.rating) query.append('rating', String(params.rating));

    const res = await apiClient.get<ApiResponse<PagedResult<ExpertPublicReviewDto>>>(
      `/api/v1/experts/${id}/reviews?${query.toString()}`
    );
    return unwrap(res, 'Không thể tải danh sách đánh giá của chuyên gia.');
  },

  /**
   * Lấy danh sách khung giờ rảnh sắp tới của chuyên gia
   * GET /api/v1/experts/{id}/upcoming-slots
   */
  async getExpertUpcomingSlots(
    id: string,
    fromDate?: string,
    days = 14
  ): Promise<ExpertAvailableSlotDto[]> {
    const query = new URLSearchParams();
    if (fromDate) query.append('fromDate', fromDate);
    query.append('days', String(days));

    const res = await apiClient.get<ApiResponse<ExpertAvailableSlotDto[]>>(
      `/api/v1/experts/${id}/upcoming-slots?${query.toString()}`
    );
    return unwrap(res, 'Không thể tải danh sách khung giờ rảnh.');
  },

  /**
   * Lấy danh mục lĩnh vực chuyên môn tư vấn
   * GET /api/v1/specializations?isActive=true
   */
  async getSpecializations(isActive = true): Promise<SpecializationDto[]> {
    const res = await apiClient.get<ApiResponse<SpecializationDto[]>>(
      `/api/v1/specializations?isActive=${isActive}`
    );
    return unwrap(res, 'Không thể tải danh mục lĩnh vực chuyên môn.');
  },

  /**
   * Lấy lịch rảnh khả dụng của chuyên gia để đặt lịch (đã lọc lead-time và hold)
   * GET /api/v1/bookings/experts/{expertProfileId}/calendar
   */
  async getAvailableSlotsForBooking(
    expertProfileId: string,
    fromDate?: string,
    days = 14
  ): Promise<ExpertAvailableSlotDto[]> {
    const query = new URLSearchParams();
    if (fromDate) query.append('fromDate', fromDate);
    query.append('days', String(days));

    const res = await apiClient.get<ApiResponse<ExpertAvailableSlotDto[]>>(
      `/api/v1/bookings/experts/${expertProfileId}/calendar?${query.toString()}`
    );
    return unwrap(res, 'Không thể tải lịch khả dụng để đặt hẹn.');
  },

  /**
   * Dry-run preview: Kiểm tra tính hợp lệ và chi phí trước khi đặt lịch
   * POST /api/v1/bookings/preview
   */
  async previewBooking(request: BookingPreviewRequest): Promise<BookingPreviewResponse> {
    const res = await apiClient.post<ApiResponse<BookingPreviewResponse>>(
      '/api/v1/bookings/preview',
      request
    );
    return unwrap(res, 'Không thể xem trước thông tin đặt lịch.');
  },

  /**
   * Khởi tạo lịch hẹn tư vấn và tạm khóa slot 10 phút (Hold slot)
   * Gửi JSON thuần theo quy định bảo mật mới (Đã loại bỏ đính kèm tệp)
   * POST /api/v1/bookings
   */
  async createBooking(request: CreateBookingRequest | {
    expertSlotId: string;
    specializationId: number;
    topicTitle: string;
    problemDescription: string;
    attachments?: any;
  }): Promise<BookingDetailResponse> {
    const payload: CreateBookingRequest = {
      expertSlotId: request.expertSlotId,
      specializationId: Number(request.specializationId),
      topicTitle: request.topicTitle?.trim() || '',
      problemDescription: request.problemDescription?.trim() || '',
    };

    const res = await apiClient.post<ApiResponse<BookingDetailResponse>>(
      '/api/v1/bookings',
      payload
    );
    return unwrap(res, 'Không thể khởi tạo lịch hẹn tư vấn.');
  },

  /**
   * Lấy danh sách lịch hẹn của tôi (Khách hàng)
   * GET /api/v1/bookings/my-bookings
   */
  async getMyBookings(params?: {
    status?: string;
    page?: number;
    size?: number;
  }): Promise<PagedResult<BookingListItemResponse>> {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    query.append('page', String(params?.page || 1));
    query.append('size', String(params?.size || 10));

    const res = await apiClient.get<ApiResponse<PagedResult<BookingListItemResponse>>>(
      `/api/v1/bookings/my-bookings?${query.toString()}`
    );
    return unwrap(res, 'Không thể tải danh sách lịch hẹn của bạn.');
  },

  /**
   * Xem chi tiết một ca tư vấn theo Booking ID
   * GET /api/v1/bookings/{id}
   */
  async getBookingDetail(id: string): Promise<BookingDetailResponse> {
    const res = await apiClient.get<ApiResponse<BookingDetailResponse>>(`/api/v1/bookings/${id}`);
    return unwrap(res, 'Không thể tải thông tin chi tiết lịch hẹn.');
  },

  /**
   * Khách hàng chủ động hủy lịch hẹn
   * POST /api/v1/bookings/{id}/cancel
   */
  async cancelBooking(id: string, reason?: string): Promise<BookingDetailResponse> {
    const res = await apiClient.post<ApiResponse<BookingDetailResponse>>(
      `/api/v1/bookings/${id}/cancel`,
      reason ? JSON.stringify(reason) : JSON.stringify('Khách hàng chủ động hủy.')
    );
    return unwrap(res, 'Không thể hủy lịch hẹn.');
  },

  /**
   * Lấy đường dẫn tải an toàn cho tệp chứng từ đính kèm
   * GET /api/v1/bookings/{id}/attachments/{attachmentId}/download
   */
  async getAttachmentDownloadUrl(bookingId: string, attachmentId: string): Promise<string> {
    const res = await apiClient.get<ApiResponse<string>>(
      `/api/v1/bookings/${bookingId}/attachments/${attachmentId}/download`
    );
    return unwrap(res, 'Không thể lấy đường dẫn tải chứng từ.');
  },

  // ══════════════════════════════════════════════════════════════════
  // DÀNH RIÊNG CHO CHUYÊN GIA (EXPERT PORTAL APIS)
  // ══════════════════════════════════════════════════════════════════

  /**
   * Lấy danh sách ca tư vấn chờ chuyên gia tiếp nhận trong vòng 2 giờ (SLA 2h)
   * GET /api/v1/expert/bookings/pending
   */
  async getExpertPendingBookings(params?: {
    page?: number;
    size?: number;
  }): Promise<PagedResult<BookingListItemResponse>> {
    const query = new URLSearchParams();
    query.append('page', String(params?.page || 1));
    query.append('size', String(params?.size || 10));

    const res = await apiClient.get<ApiResponse<PagedResult<BookingListItemResponse>>>(
      `/api/v1/expert/bookings/pending?${query.toString()}`
    );
    return unwrap(res, 'Không thể tải danh sách ca tư vấn chờ tiếp nhận.');
  },

  /**
   * Lấy toàn bộ danh sách lịch hẹn của chuyên gia (có lọc trạng thái)
   * GET /api/v1/expert/bookings
   */
  async getExpertBookings(params?: {
    status?: string;
    page?: number;
    size?: number;
  }): Promise<PagedResult<BookingListItemResponse>> {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    query.append('page', String(params?.page || 1));
    query.append('size', String(params?.size || 10));

    const res = await apiClient.get<ApiResponse<PagedResult<BookingListItemResponse>>>(
      `/api/v1/expert/bookings?${query.toString()}`
    );
    return unwrap(res, 'Không thể tải danh sách lịch hẹn của chuyên gia.');
  },

  /**
   * Chuyên gia đồng ý tiếp nhận ca tư vấn trong 2 giờ
   * POST /api/v1/expert/bookings/{id}/accept
   */
  async acceptBooking(id: string): Promise<BookingDetailResponse> {
    const res = await apiClient.post<ApiResponse<BookingDetailResponse>>(
      `/api/v1/expert/bookings/${id}/accept`
    );
    return unwrap(res, 'Không thể tiếp nhận ca tư vấn.');
  },

  /**
   * Chuyên gia từ chối tiếp nhận ca tư vấn (bắt buộc nhập lý do)
   * POST /api/v1/expert/bookings/{id}/reject
   */
  async rejectBooking(id: string, reason: string): Promise<BookingDetailResponse> {
    const res = await apiClient.post<ApiResponse<BookingDetailResponse>>(
      `/api/v1/expert/bookings/${id}/reject`,
      { reason: reason.trim() }
    );
    return unwrap(res, 'Không thể từ chối ca tư vấn.');
  },

  // ══════════════════════════════════════════════════════════════════
  // ĐĂNG KÝ TRỞ THÀNH CHUYÊN GIA (EXPERT APPLICATION APIS)
  // ══════════════════════════════════════════════════════════════════

  /**
   * Xem chi tiết hồ sơ đăng ký hiện tại của tôi
   * GET /api/v1/expert-applications/my-application
   */
  async getMyApplication(): Promise<ExpertApplicationDetailResponse | null> {
    try {
      const res = await apiClient.get<ApiResponse<ExpertApplicationDetailResponse>>(
        '/api/v1/expert-applications/my-application'
      );
      return unwrap(res, 'Không thể tải hồ sơ đăng ký.');
    } catch (err: any) {
      if (err?.response?.status === 404 || err?.status === 404) {
        return null;
      }
      throw err;
    }
  },

  /**
   * Tạo mới hoặc lưu cập nhật bản nháp hồ sơ chuyên gia
   * POST /api/v1/expert-applications/draft
   */
  async saveDraftApplication(
    request: SaveExpertApplicationDraftRequest
  ): Promise<ExpertApplicationDetailResponse> {
    const res = await apiClient.post<ApiResponse<ExpertApplicationDetailResponse>>(
      '/api/v1/expert-applications/draft',
      request
    );
    return unwrap(res, 'Không thể lưu bản nháp hồ sơ.');
  },

  /**
   * Tải lên ảnh chân dung / avatar chuyên gia (multipart)
   * POST /api/v1/expert-applications/avatar
   */
  async uploadApplicationAvatar(file: {
    uri: string;
    name: string;
    type: string;
    blob?: any;
  }): Promise<{ avatarUrl: string }> {
    const formData = new FormData();
    if (Platform.OS === 'web') {
      if (file.blob) {
        formData.append('file', file.blob, file.name);
      } else if ((file as any).file) {
        formData.append('file', (file as any).file, file.name);
      } else {
        try {
          const fetched = await fetch(file.uri);
          const blob = await fetched.blob();
          formData.append('file', blob, file.name);
        } catch {
          formData.append('file', file as any);
        }
      }
    } else {
      let cleanUri = file.uri;
      if (Platform.OS === 'android' && cleanUri && !cleanUri.startsWith('file://') && !cleanUri.startsWith('content://')) {
        cleanUri = `file://${cleanUri}`;
      }
      formData.append('file', {
        uri: cleanUri,
        name: file.name || 'avatar.jpg',
        type: file.type || 'image/jpeg',
      } as any);
    }

    const res = await apiClient.post<ApiResponse<{ avatarUrl: string }>>(
      '/api/v1/expert-applications/avatar',
      formData,
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': undefined as unknown as string,
        },
        transformRequest: (data) => data,
        timeout: 120000,
      }
    );
    return unwrap(res, 'Không thể tải lên ảnh đại diện.');
  },

  /**
   * Tải lên và đính kèm chứng chỉ vào hồ sơ (multipart)
   * POST /api/v1/expert-applications/certificates
   */
  async uploadApplicationCertificate(
    file: {
      uri: string;
      name: string;
      type: string;
      blob?: any;
      file?: any;
    },
    meta: {
      certificateType: string;
      certificateName: string;
      certificateNumber: string;
      issuingAuthority: string;
      issueDate: string;
      hasExpiry: boolean;
      expiryDate?: string | null;
    }
  ): Promise<CertificateResponseDto> {
    const formData = new FormData();
    if (Platform.OS === 'web') {
      if (file.blob) {
        formData.append('file', file.blob, file.name);
      } else if (file.file) {
        formData.append('file', file.file, file.name);
      } else {
        try {
          const fetched = await fetch(file.uri);
          const blob = await fetched.blob();
          formData.append('file', blob, file.name);
        } catch {
          formData.append('file', file as any);
        }
      }
    } else {
      let cleanUri = file.uri;
      if (Platform.OS === 'android' && cleanUri && !cleanUri.startsWith('file://') && !cleanUri.startsWith('content://')) {
        cleanUri = `file://${cleanUri}`;
      }
      formData.append('file', {
        uri: cleanUri,
        name: file.name || 'certificate.pdf',
        type: file.type || 'application/pdf',
      } as any);
    }
    formData.append('certificateType', meta.certificateType);
    formData.append('certificateName', meta.certificateName);
    formData.append('certificateNumber', meta.certificateNumber);
    formData.append('issuingAuthority', meta.issuingAuthority);
    formData.append('issueDate', meta.issueDate);
    formData.append('hasExpiry', String(meta.hasExpiry));
    if (meta.hasExpiry && meta.expiryDate) {
      formData.append('expiryDate', meta.expiryDate);
    }

    const res = await apiClient.post<ApiResponse<CertificateResponseDto>>(
      '/api/v1/expert-applications/certificates',
      formData,
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': undefined as unknown as string,
        },
        transformRequest: (data) => data,
        timeout: 120000,
      }
    );
    return unwrap(res, 'Không thể tải lên chứng chỉ.');
  },

  /**
   * Xóa chứng chỉ khỏi hồ sơ bản nháp
   * DELETE /api/v1/expert-applications/certificates/{certificateId}
   */
  async deleteApplicationCertificate(certificateId: string): Promise<boolean> {
    const res = await apiClient.delete<ApiResponse<boolean>>(
      `/api/v1/expert-applications/certificates/${certificateId}`
    );
    return unwrap(res, 'Không thể xóa chứng chỉ.');
  },

  /**
   * Nộp hồ sơ chính thức (Draft -> PendingReview)
   * POST /api/v1/expert-applications/submit
   */
  async submitApplication(): Promise<ExpertApplicationDetailResponse> {
    const res = await apiClient.post<ApiResponse<ExpertApplicationDetailResponse>>(
      '/api/v1/expert-applications/submit'
    );
    return unwrap(res, 'Không thể nộp hồ sơ xét duyệt.');
  },

  /**
   * Lấy danh sách loại chứng chỉ hợp lệ được phép áp dụng (do Admin cấu hình)
   * GET /api/v1/expert-certificate-configs
   */
  async getActiveCertificateConfigs(): Promise<ExpertCertificateConfigDto[]> {
    const res = await apiClient.get<ApiResponse<ExpertCertificateConfigDto[]>>(
      '/api/v1/expert-certificate-configs'
    );
    return unwrap(res, 'Không thể tải danh mục chứng chỉ áp dụng.');
  },

  /**
   * Lấy danh mục khung cấu hình phí tư vấn hệ thống
   * GET /api/v1/consultation-fee-configs
   */
  async getConsultationFeeConfigs(params?: {
    sessionType?: string;
    isActive?: boolean;
  }): Promise<ConsultationFeeConfigDto[]> {
    const query = new URLSearchParams();
    if (params?.sessionType) query.append('sessionType', params.sessionType);
    if (params?.isActive !== undefined) query.append('isActive', String(params.isActive));

    const res = await apiClient.get<ApiResponse<ConsultationFeeConfigDto[]>>(
      `/api/v1/consultation-fee-configs?${query.toString()}`
    );
    return unwrap(res, 'Không thể tải cấu hình mức phí.');
  },

  // ══════════════════════════════════════════════════════════════════
  // THANH TOÁN VNPAY / VIETQR & KÝ QUỸ ESCROW (Đặc tả 4)
  // ══════════════════════════════════════════════════════════════════

  /**
   * Khởi tạo hoặc lấy lại link thanh toán VNPay & mã VietQR hoặc thanh toán bằng ví
   * POST /api/v1/bookings/{bookingId}/payment-link
   */
  async createPaymentLink(
    bookingId: string,
    returnUrl?: string,
    paymentMethod: 'GATEWAY' | 'WALLET' = 'GATEWAY'
  ): Promise<PaymentLinkResponse> {
    const payload: { returnUrl?: string; paymentMethod: 'GATEWAY' | 'WALLET' } = {
      paymentMethod,
    };
    if (returnUrl) payload.returnUrl = returnUrl;
    const res = await apiClient.post<ApiResponse<PaymentLinkResponse>>(
      `/api/v1/bookings/${bookingId}/payment-link`,
      payload
    );
    return unwrap(res, 'Không thể khởi tạo giao dịch thanh toán.');
  },

  /**
   * Xem chi tiết giao dịch tạm giữ tiền bảo chứng (Escrow) của Booking
   * GET /api/v1/bookings/{bookingId}/escrow
   */
  async getBookingEscrow(bookingId: string): Promise<EscrowTransactionResponse> {
    const res = await apiClient.get<ApiResponse<EscrowTransactionResponse>>(
      `/api/v1/bookings/${bookingId}/escrow`
    );
    return unwrap(res, 'Không thể tải thông tin ký quỹ bảo đảm.');
  },

  /**
   * Điều hướng trả về và xử lý kết quả từ cổng thanh toán VNPay (Đặc tả 4)
   * GET /api/v1/payments/vnpay-return
   */
  async handleVnPayReturn(
    params: Record<string, string | number | undefined>
  ): Promise<EscrowTransactionResponse | null> {
    const cleanParams: Record<string, string> = {};
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) {
        cleanParams[k] = String(v);
      }
    });

    const res = await apiClient.get<ApiResponse<EscrowTransactionResponse | null>>(
      '/api/v1/payments/vnpay-return',
      { params: cleanParams }
    );
    return unwrap(res, 'Không thể xử lý kết quả thanh toán VNPay.');
  },

  // ══════════════════════════════════════════════════════════════════
  // PHIÊN TƯ VẤN TRỰC TUYẾN 1-1 (LIVE CONSULTATION - Đặc tả 5)
  // ══════════════════════════════════════════════════════════════════

  /**
   * Điểm danh và lấy đường dẫn phòng họp trực tuyến Jitsi Meet
   * POST /api/v1/consultations/{bookingId}/join
   */
  async joinConsultation(bookingId: string): Promise<JoinConsultationResponse> {
    const res = await apiClient.post<ApiResponse<JoinConsultationResponse>>(
      `/api/v1/consultations/${bookingId}/join`
    );
    return unwrap(res, 'Không thể vào phòng tư vấn trực tuyến.');
  },

  /**
   * Lấy trạng thái chi tiết của phòng tư vấn trực tuyến
   * GET /api/v1/consultations/{bookingId}/session
   */
  async getConsultationSession(bookingId: string): Promise<ConsultationSessionResponse> {
    const res = await apiClient.get<ApiResponse<ConsultationSessionResponse>>(
      `/api/v1/consultations/${bookingId}/session`
    );
    return unwrap(res, 'Không thể tải trạng thái phiên tư vấn.');
  },

  /**
   * Xem toàn bộ hồ sơ thuế nội bộ được chia sẻ (Read-only)
   * GET /api/v1/consultations/{bookingId}/shared-dossier
   */
  async getSharedTaxDossier(bookingId: string): Promise<SharedTaxDossierResponse> {
    const res = await apiClient.get<ApiResponse<SharedTaxDossierResponse>>(
      `/api/v1/consultations/${bookingId}/shared-dossier`
    );
    return unwrap(res, 'Không thể tải bộ hồ sơ thuế được chia sẻ.');
  },

  /**
   * Chuyên gia cập nhật biên bản ghi chú tư vấn trong phòng họp
   * PUT /api/v1/consultations/{bookingId}/notes
   */
  async updateConsultationNotes(
    bookingId: string,
    notes: string
  ): Promise<ConsultationSessionResponse> {
    const res = await apiClient.put<ApiResponse<ConsultationSessionResponse>>(
      `/api/v1/consultations/${bookingId}/notes`,
      { sharedNotes: notes.trim() }
    );
    return unwrap(res, 'Không thể lưu ghi chú kết luận tư vấn.');
  },

  /**
   * Chuyên gia chốt biên bản kết luận và kết thúc phiên tư vấn (BR-5.3: tối thiểu 10 ký tự)
   * POST /api/v1/consultations/{bookingId}/complete
   */
  async completeConsultation(
    bookingId: string,
    notes: string
  ): Promise<ConsultationSessionResponse> {
    const cleanNotes = notes.trim();
    if (cleanNotes.length < 10) {
      throw new Error('Nội dung biên bản kết luận phải có tối thiểu 10 ký tự theo quy định.');
    }
    const res = await apiClient.post<ApiResponse<ConsultationSessionResponse>>(
      `/api/v1/consultations/${bookingId}/complete`,
      { sharedNotes: cleanNotes }
    );
    return unwrap(res, 'Không thể hoàn tất phiên tư vấn.');
  },

  /**
   * Báo cáo đối phương vắng mặt không phép (No-Show quá 15 phút)
   * POST /api/v1/consultations/{bookingId}/report-no-show
   */
  async reportNoShow(
    bookingId: string,
    reason?: string
  ): Promise<ConsultationSessionResponse> {
    const res = await apiClient.post<ApiResponse<ConsultationSessionResponse>>(
      `/api/v1/consultations/${bookingId}/report-no-show`,
      { reason: reason?.trim() || null }
    );
    return unwrap(res, 'Không thể báo cáo vắng mặt.');
  },

  // ══════════════════════════════════════════════════════════════════
  // NHẮC NHỞ LỊCH HẸN MEETING SẮP TỚI (DASHBOARD & BANNER)
  // ══════════════════════════════════════════════════════════════════

  /**
   * Xem thông tin nhắc nhở lịch hẹn meeting trực tuyến sắp tới
   * GET /api/v1/consultations/upcoming-reminder
   */
  async getUpcomingMeetingReminder(): Promise<UpcomingMeetingReminderDto> {
    const res = await apiClient.get<ApiResponse<UpcomingMeetingReminderDto>>(
      '/api/v1/consultations/upcoming-reminder'
    );
    return unwrap(res, 'Không thể tải thông tin nhắc nhở lịch hẹn.');
  },

  // ══════════════════════════════════════════════════════════════════
  // QUẢN LÝ KHUNG GIỜ LÀM VIỆC CỦA CHUYÊN GIA (EXPERT SLOTS CRUD)
  // ══════════════════════════════════════════════════════════════════

  /**
   * Lấy danh sách toàn bộ khung giờ làm việc của chuyên gia
   * GET /api/v1/expert/slots
   */
  async getMySlots(filters?: ExpertSlotFilterParameters): Promise<ExpertSlotDetailResponse[]> {
    const params = new URLSearchParams();
    if (filters?.fromDate) params.append('fromDate', filters.fromDate);
    if (filters?.toDate) params.append('toDate', filters.toDate);
    if (filters?.sessionType) params.append('sessionType', filters.sessionType);
    if (filters?.isBooked !== undefined) params.append('isBooked', String(filters.isBooked));
    if (filters?.isActive !== undefined) params.append('isActive', String(filters.isActive));

    const queryStr = params.toString();
    const url = queryStr ? `/api/v1/expert/slots?${queryStr}` : '/api/v1/expert/slots';
    const res = await apiClient.get<ApiResponse<ExpertSlotDetailResponse[]>>(url);
    return unwrap(res, 'Không thể tải danh sách khung giờ làm việc.');
  },

  /**
   * Xem thông tin chi tiết 1 khung giờ theo ID
   * GET /api/v1/expert/slots/{id}
   */
  async getSlotById(id: string): Promise<ExpertSlotDetailResponse> {
    const res = await apiClient.get<ApiResponse<ExpertSlotDetailResponse>>(
      `/api/v1/expert/slots/${id}`
    );
    return unwrap(res, 'Không thể tải chi tiết khung giờ.');
  },

  /**
   * Tạo hàng loạt khung giờ làm việc định kỳ theo tuần (Batch Recurring Slots)
   * POST /api/v1/expert/slots/recurring
   */
  async createRecurringSlots(
    request: CreateRecurringSlotRequest
  ): Promise<RecurringSlotBatchResultResponse> {
    const res = await apiClient.post<ApiResponse<RecurringSlotBatchResultResponse>>(
      '/api/v1/expert/slots/recurring',
      request
    );
    return unwrap(res, 'Không thể tạo lịch làm việc định kỳ.');
  },

  /**
   * Chuyên gia tạo mới 1 khung giờ làm việc
   * POST /api/v1/expert/slots
   */
  async createSlot(request: CreateExpertSlotRequest): Promise<ExpertSlotDetailResponse> {
    const res = await apiClient.post<ApiResponse<ExpertSlotDetailResponse>>(
      '/api/v1/expert/slots',
      request
    );
    return unwrap(res, 'Không thể tạo mới khung giờ làm việc.');
  },

  /**
   * Cập nhật thông tin khung giờ làm việc
   * PUT /api/v1/expert/slots/{id}
   */
  async updateSlot(id: string, request: UpdateExpertSlotRequest): Promise<ExpertSlotDetailResponse> {
    const res = await apiClient.put<ApiResponse<ExpertSlotDetailResponse>>(
      `/api/v1/expert/slots/${id}`,
      request
    );
    return unwrap(res, 'Không thể cập nhật khung giờ làm việc.');
  },

  /**
   * Bật hoặc tắt nhanh trạng thái nhận hẹn của khung giờ
   * PATCH /api/v1/expert/slots/{id}/toggle-active
   */
  async toggleSlotActive(id: string): Promise<ExpertSlotDetailResponse> {
    const res = await apiClient.patch<ApiResponse<ExpertSlotDetailResponse>>(
      `/api/v1/expert/slots/${id}/toggle-active`
    );
    return unwrap(res, 'Không thể thay đổi trạng thái khung giờ.');
  },

  /**
   * Xóa khung giờ làm việc
   * DELETE /api/v1/expert/slots/{id}
   */
  async deleteSlot(id: string): Promise<void> {
    const res = await apiClient.delete<ApiResponse<any>>(`/api/v1/expert/slots/${id}`);
    unwrapVoid(res, 'Không thể xóa khung giờ làm việc.');
  },

  /**
   * Hủy lịch làm việc khẩn cấp (kể cả khi đã có khách hàng đặt lịch)
   * POST /api/v1/expert/slots/{id}/emergency-cancel
   */
  async emergencyCancelSlot(
    id: string,
    reason: string
  ): Promise<EmergencyCancelSlotResponse> {
    const res = await apiClient.post<ApiResponse<EmergencyCancelSlotResponse>>(
      `/api/v1/expert/slots/${id}/emergency-cancel`,
      { reason: reason.trim() }
    );
    return unwrap(res, 'Không thể hủy khung giờ làm việc khẩn cấp.');
  },

  // ══════════════════════════════════════════════════════════════════
  // ĐÁNH GIÁ & FEEDBACK (ĐẶC TẢ 6)
  // ══════════════════════════════════════════════════════════════════

  /**
   * Kiểm tra điều kiện gửi đánh giá cho ca tư vấn
   * GET /api/v1/bookings/{bookingId}/review-eligibility
   */
  async checkReviewEligibility(bookingId: string): Promise<ReviewEligibilityResponse> {
    const res = await apiClient.get<ApiResponse<ReviewEligibilityResponse>>(
      `/api/v1/bookings/${bookingId}/review-eligibility`
    );
    return unwrap(res, 'Không thể kiểm tra điều kiện đánh giá.');
  },

  /**
   * Gửi đánh giá và nhận xét sau phiên tư vấn
   * POST /api/v1/bookings/{bookingId}/reviews
   */
  async submitReview(
    bookingId: string,
    request: CreateReviewRequest
  ): Promise<ReviewDetailResponse> {
    if (request.rating < 1 || request.rating > 5) {
      throw new Error('Số sao đánh giá phải từ 1 đến 5 sao.');
    }
    if (!request.comment || request.comment.trim().length < 10) {
      throw new Error('Nội dung nhận xét tối thiểu phải từ 10 ký tự.');
    }
    const res = await apiClient.post<ApiResponse<ReviewDetailResponse>>(
      `/api/v1/bookings/${bookingId}/reviews`,
      request
    );
    return unwrap(res, 'Không thể gửi đánh giá cho ca tư vấn.');
  },

  /**
   * Xem thông tin đánh giá của ca tư vấn
   * GET /api/v1/bookings/{bookingId}/review
   */
  async getBookingReview(bookingId: string): Promise<ReviewDetailResponse | null> {
    const res = await apiClient.get<ApiResponse<ReviewDetailResponse | null>>(
      `/api/v1/bookings/${bookingId}/review`
    );
    return res.data?.data ?? null;
  },

  // ══════════════════════════════════════════════════════════════════
  // GIẢI NGÂN & KHIẾU NẠI TRANH CHẤP (ĐẶC TẢ 7)
  // ══════════════════════════════════════════════════════════════════

  /**
   * Khách hàng xác nhận hài lòng sớm trong 24h Cool-down để giải ngân cho chuyên gia
   * POST /api/v1/bookings/{bookingId}/confirm-satisfaction
   */
  async confirmSatisfaction(bookingId: string): Promise<string> {
    const res = await apiClient.post<ApiResponse<string>>(
      `/api/v1/bookings/${bookingId}/confirm-satisfaction`
    );
    return res.data?.message || 'Xác nhận hài lòng thành công.';
  },

  /**
   * Kiểm tra điều kiện và thời hạn khiếu nại chất lượng ca tư vấn
   * GET /api/v1/bookings/{bookingId}/dispute-eligibility
   */
  async checkDisputeEligibility(bookingId: string): Promise<DisputeEligibilityResponse> {
    const res = await apiClient.get<ApiResponse<DisputeEligibilityResponse>>(
      `/api/v1/bookings/${bookingId}/dispute-eligibility`
    );
    return unwrap(res, 'Không thể kiểm tra điều kiện khiếu nại.');
  },

  /**
   * Gửi khiếu nại chất lượng ca tư vấn để đóng băng Escrow
   * POST /api/v1/bookings/{bookingId}/disputes
   */
  async submitDispute(
    bookingId: string,
    request: CreateDisputeRequest
  ): Promise<DisputeDetailResponse> {
    if (!request.reason) {
      throw new Error('Vui lòng chọn lý do khiếu nại.');
    }
    if (!request.description || request.description.trim().length < 10) {
      throw new Error('Mô tả chi tiết sự việc tối thiểu 10 ký tự.');
    }
    const res = await apiClient.post<ApiResponse<DisputeDetailResponse>>(
      `/api/v1/bookings/${bookingId}/disputes`,
      request
    );
    return unwrap(res, 'Không thể gửi khiếu nại cho phiên tư vấn.');
  },

  /**
   * Xem thông tin khiếu nại của Booking
   * GET /api/v1/bookings/{bookingId}/dispute
   */
  async getBookingDispute(bookingId: string): Promise<DisputeDetailResponse | null> {
    const res = await apiClient.get<ApiResponse<DisputeDetailResponse | null>>(
      `/api/v1/bookings/${bookingId}/dispute`
    );
    return res.data?.data ?? null;
  },

  /**
   * Chuyên gia gửi giải trình / phản hồi khiếu nại
   * POST /api/v1/expert/disputes/{id}/respond
   */
  async expertRespondDispute(
    disputeId: string,
    request: ExpertRespondDisputeRequest
  ): Promise<DisputeDetailResponse> {
    if (!request.response || request.response.trim().length < 10) {
      throw new Error('Nội dung giải trình tối thiểu 10 ký tự.');
    }
    const res = await apiClient.post<ApiResponse<DisputeDetailResponse>>(
      `/api/v1/expert/disputes/${disputeId}/respond`,
      request
    );
    return unwrap(res, 'Không thể gửi phản hồi giải trình khiếu nại.');
  },
};


