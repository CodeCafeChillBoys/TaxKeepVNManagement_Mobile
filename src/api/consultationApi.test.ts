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
});
