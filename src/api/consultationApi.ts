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
  ExpertApplicationDetailResponse,
  SaveExpertApplicationDraftRequest,
  CertificateResponseDto,
  ConsultationFeeConfigDto,
} from '../types/consultation';

function unwrap<T>(res: { data: ApiResponse<T> }, fallbackMsg: string): T {
  const body = res.data;
  if (!body?.success || body.data === undefined || body.data === null) {
    throw new Error(body?.message || body?.errorCode || fallbackMsg);
  }
  return body.data;
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
   * Nhận multipart/form-data
   * POST /api/v1/bookings
   */
  async createBooking(request: {
    expertSlotId: string;
    specializationId: number;
    topicTitle: string;
    problemDescription: string;
    attachments?: Array<{
      uri: string;
      name: string;
      type: string;
      blob?: any;
    }>;
  }): Promise<BookingDetailResponse> {
    const formData = new FormData();
    formData.append('ExpertSlotId', request.expertSlotId);
    formData.append('SpecializationId', String(request.specializationId));
    formData.append('TopicTitle', request.topicTitle.trim());
    formData.append('ProblemDescription', request.problemDescription.trim());

    if (request.attachments && request.attachments.length > 0) {
      for (const file of request.attachments) {
        if (Platform.OS === 'web' && file.blob) {
          formData.append('Attachments', file.blob, file.name);
        } else {
          formData.append('Attachments', {
            uri: file.uri,
            name: file.name,
            type: file.type || 'application/octet-stream',
          } as any);
        }
      }
    }

    const res = await apiClient.post<ApiResponse<BookingDetailResponse>>(
      '/api/v1/bookings',
      formData
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
};

