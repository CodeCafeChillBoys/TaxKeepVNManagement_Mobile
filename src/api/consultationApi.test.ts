jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: jest.fn((dict: any) => dict.ios),
  },
}));

jest.mock('./apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
  storageHelper: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

import { consultationApi } from './consultationApi';
import { apiClient } from './apiClient';

describe('consultationApi', () => {
  const mockGet = apiClient.get as jest.Mock;
  const mockPost = apiClient.post as jest.Mock;
  const mockPut = apiClient.put as jest.Mock;
  const mockPatch = apiClient.patch as jest.Mock;
  const mockDelete = apiClient.delete as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Customer Discovery & Search', () => {
    it('searchExperts calls GET /api/v1/experts with proper query string', async () => {
      const mockResult = {
        items: [{ id: 'exp-1', fullName: 'Chuyên gia A' }],
        pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
      };
      mockGet.mockResolvedValueOnce({
        data: { success: true, data: mockResult },
      });

      const res = await consultationApi.searchExperts({
        keyword: 'Thuế',
        page: 1,
        size: 10,
        sortBy: 'Recommended',
      });

      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/experts?')
      );
      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining('keyword=Thu%E1%BA%BF')
      );
      expect(res).toEqual(mockResult);
    });

    it('getFeaturedExperts calls GET /api/v1/experts/featured', async () => {
      const mockList = [{ id: 'exp-1', fullName: 'Chuyên gia VIP' }];
      mockGet.mockResolvedValueOnce({
        data: { success: true, data: mockList },
      });

      const res = await consultationApi.getFeaturedExperts(4);
      expect(mockGet).toHaveBeenCalledWith('/api/v1/experts/featured?count=4');
      expect(res).toEqual(mockList);
    });

    it('getExpertDetail calls GET /api/v1/experts/{id}', async () => {
      const mockDetail = { id: 'exp-1', fullName: 'Chuyên gia A', rating: 4.9 };
      mockGet.mockResolvedValueOnce({
        data: { success: true, data: mockDetail },
      });

      const res = await consultationApi.getExpertDetail('exp-1');
      expect(mockGet).toHaveBeenCalledWith('/api/v1/experts/exp-1');
      expect(res).toEqual(mockDetail);
    });

    it('getSpecializations calls GET /api/v1/specializations', async () => {
      const mockSpecs = [{ id: 1, code: 'PIT', name: 'Thuế TNCN', isActive: true }];
      mockGet.mockResolvedValueOnce({
        data: { success: true, data: mockSpecs },
      });

      const res = await consultationApi.getSpecializations(true);
      expect(mockGet).toHaveBeenCalledWith('/api/v1/specializations?isActive=true');
      expect(res).toEqual(mockSpecs);
    });
  });

  describe('Customer Booking Flow', () => {
    it('previewBooking calls POST /api/v1/bookings/preview', async () => {
      const mockPreview = {
        expertSlotId: 'slot-1',
        totalFee: 200000,
        isValid: true,
      };
      mockPost.mockResolvedValueOnce({
        data: { success: true, data: mockPreview },
      });

      const res = await consultationApi.previewBooking({
        expertSlotId: 'slot-1',
        specializationId: 1,
      });

      expect(mockPost).toHaveBeenCalledWith('/api/v1/bookings/preview', {
        expertSlotId: 'slot-1',
        specializationId: 1,
      });
      expect(res).toEqual(mockPreview);
    });

    it('getMyBookings calls GET /api/v1/bookings/my-bookings', async () => {
      const mockBookings = {
        items: [{ id: 'b-1', bookingCode: 'BK123', status: 'CONFIRMED' }],
        pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
      };
      mockGet.mockResolvedValueOnce({
        data: { success: true, data: mockBookings },
      });

      const res = await consultationApi.getMyBookings({ status: 'CONFIRMED', page: 1 });
      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/bookings/my-bookings?')
      );
      expect(res).toEqual(mockBookings);
    });

    it('cancelBooking calls POST /api/v1/bookings/{id}/cancel', async () => {
      const mockUpdated = { id: 'b-1', status: 'CANCELLED_BY_USER' };
      mockPost.mockResolvedValueOnce({
        data: { success: true, data: mockUpdated },
      });

      const res = await consultationApi.cancelBooking('b-1', 'Bận việc riêng');
      expect(mockPost).toHaveBeenCalledWith(
        '/api/v1/bookings/b-1/cancel',
        JSON.stringify('Bận việc riêng')
      );
      expect(res).toEqual(mockUpdated);
    });
  });

  describe('Expert Portal Actions', () => {
    it('getExpertPendingBookings calls GET /api/v1/expert/bookings/pending', async () => {
      const mockPending = {
        items: [{ id: 'b-pending', bookingCode: 'BK-SLA', status: 'AWAITING_EXPERT_APPROVAL' }],
        pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
      };
      mockGet.mockResolvedValueOnce({
        data: { success: true, data: mockPending },
      });

      const res = await consultationApi.getExpertPendingBookings({ page: 1, size: 10 });
      expect(mockGet).toHaveBeenCalledWith('/api/v1/expert/bookings/pending?page=1&size=10');
      expect(res).toEqual(mockPending);
    });

    it('getExpertBookings calls GET /api/v1/expert/bookings with status filter', async () => {
      const mockAll = {
        items: [{ id: 'b-all', bookingCode: 'BK-CONF', status: 'CONFIRMED' }],
        pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
      };
      mockGet.mockResolvedValueOnce({
        data: { success: true, data: mockAll },
      });

      const res = await consultationApi.getExpertBookings({ status: 'CONFIRMED', page: 1 });
      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/expert/bookings?')
      );
      expect(res).toEqual(mockAll);
    });

    it('acceptBooking calls POST /api/v1/expert/bookings/{id}/accept', async () => {
      const mockAccepted = { id: 'b-1', status: 'CONFIRMED' };
      mockPost.mockResolvedValueOnce({
        data: { success: true, data: mockAccepted },
      });

      const res = await consultationApi.acceptBooking('b-1');
      expect(mockPost).toHaveBeenCalledWith('/api/v1/expert/bookings/b-1/accept');
      expect(res).toEqual(mockAccepted);
    });

    it('rejectBooking calls POST /api/v1/expert/bookings/{id}/reject with reason', async () => {
      const mockRejected = { id: 'b-1', status: 'REJECTED_BY_EXPERT' };
      mockPost.mockResolvedValueOnce({
        data: { success: true, data: mockRejected },
      });

      const res = await consultationApi.rejectBooking('b-1', 'Bận việc tại cục thuế');
      expect(mockPost).toHaveBeenCalledWith('/api/v1/expert/bookings/b-1/reject', {
        reason: 'Bận việc tại cục thuế',
      });
      expect(res).toEqual(mockRejected);
    });
  });

  describe('Expert Application Workflow', () => {
    it('getMyApplication returns application data on 200', async () => {
      const mockApp = { id: 'app-1', status: 'Draft', fullName: 'Nguyen Van B' };
      mockGet.mockResolvedValueOnce({
        data: { success: true, data: mockApp },
      });

      const res = await consultationApi.getMyApplication();
      expect(mockGet).toHaveBeenCalledWith('/api/v1/expert-applications/my-application');
      expect(res).toEqual(mockApp);
    });

    it('getMyApplication returns null on 404', async () => {
      mockGet.mockRejectedValueOnce({
        response: { status: 404 },
      });

      const res = await consultationApi.getMyApplication();
      expect(res).toBeNull();
    });

    it('saveDraftApplication calls POST /api/v1/expert-applications/draft', async () => {
      const payload = {
        fullName: 'Nguyen Van B',
        jobTitle: 'Kế toán trưởng',
        yearsOfExperience: 5,
        experienceDescription: 'Kinh nghiệm quyết toán thuế 5 năm',
        specializationIds: [1, 2],
        feeProposals: [],
      };
      const mockResponse = { id: 'app-1', ...payload, status: 'Draft' };
      mockPost.mockResolvedValueOnce({
        data: { success: true, data: mockResponse },
      });

      const res = await consultationApi.saveDraftApplication(payload);
      expect(mockPost).toHaveBeenCalledWith('/api/v1/expert-applications/draft', payload);
      expect(res).toEqual(mockResponse);
    });

    it('deleteApplicationCertificate calls DELETE /api/v1/expert-applications/certificates/{id}', async () => {
      mockDelete.mockResolvedValueOnce({
        data: { success: true, data: true },
      });

      const res = await consultationApi.deleteApplicationCertificate('cert-123');
      expect(mockDelete).toHaveBeenCalledWith('/api/v1/expert-applications/certificates/cert-123');
      expect(res).toBe(true);
    });

    it('submitApplication calls POST /api/v1/expert-applications/submit', async () => {
      const mockSubmitted = { id: 'app-1', status: 'PendingReview' };
      mockPost.mockResolvedValueOnce({
        data: { success: true, data: mockSubmitted },
      });

      const res = await consultationApi.submitApplication();
      expect(mockPost).toHaveBeenCalledWith('/api/v1/expert-applications/submit');
      expect(res).toEqual(mockSubmitted);
    });

    it('getConsultationFeeConfigs calls GET /api/v1/consultation-fee-configs', async () => {
      const mockConfigs = [
        { id: 1, sessionType: 'ONLINE_MEETING', minFee: 100000, maxFee: 1000000 },
      ];
      mockGet.mockResolvedValueOnce({
        data: { success: true, data: mockConfigs },
      });

      const res = await consultationApi.getConsultationFeeConfigs({ isActive: true });
      expect(mockGet).toHaveBeenCalledWith('/api/v1/consultation-fee-configs?isActive=true');
      expect(res).toEqual(mockConfigs);
    });
  });

  describe('Payment, Escrow and Live Consultation Flow (Đặc tả 4 & 5)', () => {
    it('createPaymentLink calls POST /api/v1/bookings/{id}/payment-link', async () => {
      const mockPayment = {
        bookingId: 'b-1',
        checkoutUrl: 'https://sandbox.vnpayment.vn/payment',
        qrCode: 'https://img.vietqr.io/image/970405-5402205457446.png',
        amount: 200000,
        escrowStatus: 'PendingPayment',
      };
      mockPost.mockResolvedValueOnce({
        data: { success: true, data: mockPayment },
      });

      const res = await consultationApi.createPaymentLink('b-1', 'taxkeep://return');
      expect(mockPost).toHaveBeenCalledWith('/api/v1/bookings/b-1/payment-link', {
        returnUrl: 'taxkeep://return',
        paymentMethod: 'GATEWAY',
      });
      expect(res).toEqual(mockPayment);
    });

    it('getBookingEscrow calls GET /api/v1/bookings/{id}/escrow', async () => {
      const mockEscrow = {
        id: 'escrow-1',
        bookingId: 'b-1',
        amount: 200000,
        escrowStatus: 'HeldInEscrow',
        commissionRate: 10,
      };
      mockGet.mockResolvedValueOnce({
        data: { success: true, data: mockEscrow },
      });

      const res = await consultationApi.getBookingEscrow('b-1');
      expect(mockGet).toHaveBeenCalledWith('/api/v1/bookings/b-1/escrow');
      expect(res).toEqual(mockEscrow);
    });

    it('handleVnPayReturn calls GET /api/v1/payments/vnpay-return', async () => {
      const mockResult = {
        id: 'escrow-1',
        bookingId: 'b-1',
        amount: 300000,
        escrowStatus: 'HeldInEscrow',
        commissionRate: 10,
      };
      mockGet.mockResolvedValueOnce({
        data: { success: true, data: mockResult },
      });

      const res = await consultationApi.handleVnPayReturn({
        vnp_ResponseCode: '00',
        vnp_TxnRef: '123456',
      });
      expect(mockGet).toHaveBeenCalledWith('/api/v1/payments/vnpay-return', {
        params: {
          vnp_ResponseCode: '00',
          vnp_TxnRef: '123456',
        },
      });
      expect(res).toEqual(mockResult);
    });

    it('joinConsultation calls POST /api/v1/consultations/{id}/join', async () => {
      const mockJoin = {
        sessionId: 's-1',
        bookingId: 'b-1',
        roomUrl: 'https://meet.jit.si/TaxKeepVN_BK123',
        bothPresent: true,
        bookingStatus: 'IN_PROGRESS',
      };
      mockPost.mockResolvedValueOnce({
        data: { success: true, data: mockJoin },
      });

      const res = await consultationApi.joinConsultation('b-1');
      expect(mockPost).toHaveBeenCalledWith('/api/v1/consultations/b-1/join');
      expect(res).toEqual(mockJoin);
    });

    it('getConsultationSession calls GET /api/v1/consultations/{id}/session', async () => {
      const mockSession = {
        id: 's-1',
        bookingId: 'b-1',
        status: 'IN_PROGRESS',
        remainingMinutes: 45,
      };
      mockGet.mockResolvedValueOnce({
        data: { success: true, data: mockSession },
      });

      const res = await consultationApi.getConsultationSession('b-1');
      expect(mockGet).toHaveBeenCalledWith('/api/v1/consultations/b-1/session');
      expect(res).toEqual(mockSession);
    });

    it('getSharedTaxDossier calls GET /api/v1/consultations/{id}/shared-dossier', async () => {
      const mockDossier = {
        bookingId: 'b-1',
        taxYear: 2026,
        taxpayerFullName: 'Tran Van C',
        incomeSources: [],
        dependents: [],
      };
      mockGet.mockResolvedValueOnce({
        data: { success: true, data: mockDossier },
      });

      const res = await consultationApi.getSharedTaxDossier('b-1');
      expect(mockGet).toHaveBeenCalledWith('/api/v1/consultations/b-1/shared-dossier');
      expect(res).toEqual(mockDossier);
    });

    it('updateConsultationNotes calls PUT /api/v1/consultations/{id}/notes', async () => {
      const mockSession = { id: 's-1', sharedNotes: 'Nội dung tư vấn giảm trừ gia cảnh' };
      apiClient.put = jest.fn().mockResolvedValueOnce({
        data: { success: true, data: mockSession },
      });

      const res = await consultationApi.updateConsultationNotes('b-1', 'Nội dung tư vấn giảm trừ gia cảnh');
      expect(apiClient.put).toHaveBeenCalledWith('/api/v1/consultations/b-1/notes', {
        sharedNotes: 'Nội dung tư vấn giảm trừ gia cảnh',
      });
      expect(res).toEqual(mockSession);
    });

    it('completeConsultation validates >= 10 chars and calls POST /api/v1/consultations/{id}/complete', async () => {
      await expect(consultationApi.completeConsultation('b-1', 'ngắn')).rejects.toThrow(
        'Nội dung biên bản kết luận phải có tối thiểu 10 ký tự'
      );

      const mockCompleted = { id: 's-1', status: 'COMPLETED' };
      mockPost.mockResolvedValueOnce({
        data: { success: true, data: mockCompleted },
      });

      const res = await consultationApi.completeConsultation('b-1', 'Đã tư vấn giải pháp quyết toán thuế thành công');
      expect(mockPost).toHaveBeenCalledWith('/api/v1/consultations/b-1/complete', {
        sharedNotes: 'Đã tư vấn giải pháp quyết toán thuế thành công',
      });
      expect(res).toEqual(mockCompleted);
    });

    it('reportNoShow calls POST /api/v1/consultations/{id}/report-no-show', async () => {
      const mockNoShow = { id: 's-1', noShowType: 'EXPERT_NO_SHOW' };
      mockPost.mockResolvedValueOnce({
        data: { success: true, data: mockNoShow },
      });

      const res = await consultationApi.reportNoShow('b-1', 'Quá 15 phút không vào');
      expect(mockPost).toHaveBeenCalledWith('/api/v1/consultations/b-1/report-no-show', {
        reason: 'Quá 15 phút không vào',
      });
      expect(res).toEqual(mockNoShow);
    });

    it('getUpcomingMeetingReminder calls GET /api/v1/consultations/upcoming-reminder', async () => {
      const mockReminder = {
        hasUpcomingMeeting: true,
        bookingId: 'b-100',
        topicTitle: 'Họp quyết toán thuế',
        partnerName: 'Nguyễn Văn A',
        partnerRole: 'TAXPAYER',
        isRoomOpen: true,
        canJoinRoom: true,
        urgencyLevel: 'OPENED',
      };
      mockGet.mockResolvedValueOnce({
        data: { success: true, data: mockReminder },
      });

      const res = await consultationApi.getUpcomingMeetingReminder();
      expect(mockGet).toHaveBeenCalledWith('/api/v1/consultations/upcoming-reminder');
      expect(res).toEqual(mockReminder);
    });
  });

  describe('Expert Slot Management (CRUD)', () => {
    it('getMySlots calls GET /api/v1/expert/slots with query params', async () => {
      const mockPagedSlots = {
        items: [{ id: 'slot-1', slotDate: '2026-10-20', startTime: '09:00', endTime: '10:00' }],
        pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      };
      mockGet.mockResolvedValueOnce({
        data: { success: true, data: mockPagedSlots },
      });

      const res = await consultationApi.getMySlots({ isBooked: false, isActive: true });
      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/expert/slots?isBooked=false&isActive=true')
      );
      expect(res).toEqual(mockPagedSlots);
    });

    it('createSlot calls POST /api/v1/expert/slots', async () => {
      const req = {
        slotDate: '2026-10-20',
        startTime: '09:00',
        endTime: '10:00',
        sessionType: 'ONLINE_MEETING' as const,
      };
      const mockCreated = { id: 'slot-new', ...req, isActive: true };
      mockPost.mockResolvedValueOnce({
        data: { success: true, data: mockCreated },
      });

      const res = await consultationApi.createSlot(req);
      expect(mockPost).toHaveBeenCalledWith('/api/v1/expert/slots', req);
      expect(res).toEqual(mockCreated);
    });

    it('updateSlot calls PUT /api/v1/expert/slots/{id}', async () => {
      const req = {
        slotDate: '2026-10-20',
        startTime: '10:00',
        endTime: '11:00',
        sessionType: 'ONLINE_MEETING' as const,
        isActive: true,
      };
      const mockUpdated = { id: 'slot-1', ...req };
      (apiClient.put as jest.Mock).mockResolvedValueOnce({
        data: { success: true, data: mockUpdated },
      });

      const res = await consultationApi.updateSlot('slot-1', req);
      expect(apiClient.put).toHaveBeenCalledWith('/api/v1/expert/slots/slot-1', req);
      expect(res).toEqual(mockUpdated);
    });

    it('toggleSlotActive calls PATCH /api/v1/expert/slots/{id}/toggle-active', async () => {
      const mockToggled = { id: 'slot-1', isActive: false };
      (apiClient.patch as jest.Mock).mockResolvedValueOnce({
        data: { success: true, data: mockToggled },
      });

      const res = await consultationApi.toggleSlotActive('slot-1');
      expect(apiClient.patch).toHaveBeenCalledWith('/api/v1/expert/slots/slot-1/toggle-active');
      expect(res).toEqual(mockToggled);
    });

    it('deleteSlot calls DELETE /api/v1/expert/slots/{id}', async () => {
      (apiClient.delete as jest.Mock).mockResolvedValueOnce({
        data: { success: true, message: 'Đã xóa' },
      });

      await consultationApi.deleteSlot('slot-1');
      expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/expert/slots/slot-1');
    });

    it('emergencyCancelSlot calls POST /api/v1/expert/slots/{id}/emergency-cancel', async () => {
      const mockResult = {
        slotId: 'slot-1',
        slotDate: '2026-10-28',
        startTime: '09:00',
        endTime: '10:00',
        hadBooking: true,
        bookingCode: 'BK-123',
        isLateCancel: false,
        penaltyAmount: 0,
        message: 'Hủy thành công',
      };
      (apiClient.post as jest.Mock).mockResolvedValueOnce({
        data: { success: true, data: mockResult },
      });

      const res = await consultationApi.emergencyCancelSlot('slot-1', 'Lý do hủy khẩn cấp do sự cố sức khỏe');
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/expert/slots/slot-1/emergency-cancel',
        { reason: 'Lý do hủy khẩn cấp do sự cố sức khỏe' }
      );
      expect(res).toEqual(mockResult);
    });
  });

  describe('Review and Feedback Flow (Đặc tả 6)', () => {
    it('checkReviewEligibility calls GET /api/v1/bookings/{id}/review-eligibility', async () => {
      const mockElig = { canReview: true, alreadyReviewed: false };
      mockGet.mockResolvedValueOnce({ data: { success: true, data: mockElig } });
      const res = await consultationApi.checkReviewEligibility('b-1');
      expect(mockGet).toHaveBeenCalledWith('/api/v1/bookings/b-1/review-eligibility');
      expect(res).toEqual(mockElig);
    });

    it('submitReview calls POST /api/v1/bookings/{id}/reviews', async () => {
      const req = {
        rating: 5,
        comment: 'Chuyên gia tư vấn rất nhiệt tình và chính xác.',
      };
      const mockReview = { id: 'rev-1', bookingId: 'b-1', rating: 5 };
      mockPost.mockResolvedValueOnce({ data: { success: true, data: mockReview } });
      const res = await consultationApi.submitReview('b-1', req);
      expect(mockPost).toHaveBeenCalledWith('/api/v1/bookings/b-1/reviews', req);
      expect(res).toEqual(mockReview);
    });

    it('getBookingReview calls GET /api/v1/bookings/{id}/review', async () => {
      const mockReview = { id: 'rev-1', rating: 5, comment: 'Tuyệt vời' };
      mockGet.mockResolvedValueOnce({ data: { success: true, data: mockReview } });
      const res = await consultationApi.getBookingReview('b-1');
      expect(mockGet).toHaveBeenCalledWith('/api/v1/bookings/b-1/review');
      expect(res).toEqual(mockReview);
    });
  });

  describe('Disbursement and Dispute Flow (Đặc tả 7)', () => {
    it('confirmSatisfaction calls POST /api/v1/bookings/{id}/confirm-satisfaction', async () => {
      mockPost.mockResolvedValueOnce({
        data: { success: true, message: 'Xác nhận hài lòng thành công.' },
      });
      const res = await consultationApi.confirmSatisfaction('b-1');
      expect(mockPost).toHaveBeenCalledWith('/api/v1/bookings/b-1/confirm-satisfaction');
      expect(res).toBe('Xác nhận hài lòng thành công.');
    });

    it('checkDisputeEligibility calls GET /api/v1/bookings/{id}/dispute-eligibility', async () => {
      const mockElig = { canDispute: true, alreadyDisputed: false };
      mockGet.mockResolvedValueOnce({ data: { success: true, data: mockElig } });
      const res = await consultationApi.checkDisputeEligibility('b-1');
      expect(mockGet).toHaveBeenCalledWith('/api/v1/bookings/b-1/dispute-eligibility');
      expect(res).toEqual(mockElig);
    });

    it('submitDispute calls POST /api/v1/bookings/{id}/disputes', async () => {
      const req = {
        reason: 'WRONG_TAX_LAW_ADVICE',
        description: 'Chuyên gia hướng dẫn sai quy định thuế TNCN 2026.',
      };
      const mockDispute = { id: 'disp-1', bookingId: 'b-1', status: 'PENDING_EXPERT_RESPONSE' };
      mockPost.mockResolvedValueOnce({ data: { success: true, data: mockDispute } });
      const res = await consultationApi.submitDispute('b-1', req);
      expect(mockPost).toHaveBeenCalledWith('/api/v1/bookings/b-1/disputes', req);
      expect(res).toEqual(mockDispute);
    });

    it('getBookingDispute calls GET /api/v1/bookings/{id}/dispute', async () => {
      const mockDispute = { id: 'disp-1', status: 'PENDING_ADMIN_REVIEW' };
      mockGet.mockResolvedValueOnce({ data: { success: true, data: mockDispute } });
      const res = await consultationApi.getBookingDispute('b-1');
      expect(mockGet).toHaveBeenCalledWith('/api/v1/bookings/b-1/dispute');
      expect(res).toEqual(mockDispute);
    });

    it('expertRespondDispute calls POST /api/v1/expert/disputes/{id}/respond', async () => {
      const req = { response: 'Tôi đã giải thích đầy đủ các điều khoản luật.' };
      const mockDisp = { id: 'disp-1', status: 'PENDING_ADMIN_REVIEW' };
      mockPost.mockResolvedValueOnce({ data: { success: true, data: mockDisp } });
      const res = await consultationApi.expertRespondDispute('disp-1', req);
      expect(mockPost).toHaveBeenCalledWith('/api/v1/expert/disputes/disp-1/respond', req);
      expect(res).toEqual(mockDisp);
    });
  });

  describe('Updated Features', () => {
    it('creates recurring slots', async () => {
      const req = {
        startDate: '2026-10-20',
        numberOfWeeks: 4,
        weeklySlots: [
          {
            dayOfWeek: 1,
            startTime: '08:30:00',
            endTime: '11:30:00',
            sessionType: 'ONLINE_MEETING' as const,
          },
        ],
      };
      const mockResult = {
        totalCreated: 4,
        totalSkipped: 0,
        fromDate: '2026-10-20',
        toDate: '2026-11-17',
        createdSlots: [],
      };
      mockPost.mockResolvedValueOnce({ data: { success: true, data: mockResult } });

      const res = await consultationApi.createRecurringSlots(req);
      expect(mockPost).toHaveBeenCalledWith('/api/v1/expert/slots/recurring', req);
      expect(res).toEqual(mockResult);
    });

    it('gets expert sort options', async () => {
      const mockConfig = {
        defaultSortBy: 'Recommended',
        options: [
          { value: 'Recommended', code: 0, label: 'Đề xuất ưu tiên', isDefault: true },
          { value: 'RatingDesc', code: 1, label: 'Đánh giá sao cao nhất', isDefault: false },
        ],
      };
      mockGet.mockResolvedValueOnce({ data: { success: true, data: mockConfig } });

      const res = await consultationApi.getExpertSortOptions();
      expect(mockGet).toHaveBeenCalledWith('/api/v1/experts/sort-options');
      expect(res).toEqual(mockConfig);
    });

    it('gets active certificate configs', async () => {
      const mockConfigs = [
        { id: 1, code: 'TAX_AGENT', name: 'Đại lý thuế', requiresExpiryDate: false },
        { id: 2, code: 'CPA', name: 'Kiểm toán viên (CPA)', requiresExpiryDate: false },
      ];
      mockGet.mockResolvedValueOnce({ data: { success: true, data: mockConfigs } });

      const res = await consultationApi.getActiveCertificateConfigs();
      expect(mockGet).toHaveBeenCalledWith('/api/v1/expert-certificate-configs');
      expect(res).toEqual(mockConfigs);
    });
  });
});


