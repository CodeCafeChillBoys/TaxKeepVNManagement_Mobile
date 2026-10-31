import {
  canUserReview,
  canUserDispute,
  canConfirmSatisfaction,
  canExpertComplete,
  isBookingScheduleArrived,
  validateReviewInput,
  validateDisputeInput,
  validateExpertResponse,
} from './consultationBookingDetailUtils';

describe('consultationBookingDetailUtils', () => {
  describe('canUserReview', () => {
    it('returns false for expert view', () => {
      expect(canUserReview('COMPLETED', true)).toBe(false);
    });

    it('returns false if already reviewed', () => {
      expect(canUserReview('COMPLETED', false, null, true)).toBe(false);
    });

    it('returns false if status is not COMPLETED or SETTLED', () => {
      expect(canUserReview('CONFIRMED', false)).toBe(false);
      expect(canUserReview('IN_PROGRESS', false)).toBe(false);
      expect(canUserReview('UNDER_DISPUTE', false)).toBe(false);
    });

    it('returns true when COMPLETED and eligible', () => {
      expect(canUserReview('COMPLETED', false, { canReview: true, alreadyReviewed: false })).toBe(true);
      expect(canUserReview('SETTLED', false, null, false)).toBe(true);
    });

    it('returns false when review eligibility is explicitly false', () => {
      expect(canUserReview('COMPLETED', false, { canReview: false, alreadyReviewed: true })).toBe(false);
    });

    it('returns false when noShowType is USER_NO_SHOW', () => {
      expect(canUserReview('COMPLETED', false, { canReview: true, alreadyReviewed: false }, false, 'USER_NO_SHOW')).toBe(false);
      expect(canUserReview('SETTLED', false, null, false, 'USER_NO_SHOW')).toBe(false);
    });
  });

  describe('canUserDispute & canConfirmSatisfaction', () => {
    it('returns false for expert view', () => {
      expect(canUserDispute('COMPLETED', true)).toBe(false);
      expect(canConfirmSatisfaction('COMPLETED', true)).toBe(false);
    });

    it('returns false if already disputed', () => {
      expect(canUserDispute('COMPLETED', false, null, true)).toBe(false);
      expect(canConfirmSatisfaction('COMPLETED', false, null, true)).toBe(false);
    });

    it('returns false if status is not COMPLETED', () => {
      expect(canUserDispute('SETTLED', false)).toBe(false);
      expect(canUserDispute('IN_PROGRESS', false)).toBe(false);
      expect(canConfirmSatisfaction('SETTLED', false)).toBe(false);
    });

    it('returns true when status is COMPLETED and canDispute is true', () => {
      expect(canUserDispute('COMPLETED', false, { canDispute: true, alreadyDisputed: false })).toBe(true);
      expect(canConfirmSatisfaction('COMPLETED', false, { canDispute: true, alreadyDisputed: false })).toBe(true);
    });
  });

  describe('canExpertComplete', () => {
    it('returns false for customer view (isExpertView = false)', () => {
      expect(canExpertComplete('CONFIRMED', false)).toBe(false);
      expect(canExpertComplete('IN_PROGRESS', false)).toBe(false);
      expect(canExpertComplete('COMPLETED', false)).toBe(false);
    });

    it('returns true for expert view when status is CONFIRMED or IN_PROGRESS (fallback without slot)', () => {
      expect(canExpertComplete('CONFIRMED', true)).toBe(true);
      expect(canExpertComplete('IN_PROGRESS', true)).toBe(true);
    });

    it('returns false for expert view when status is already COMPLETED or other statuses', () => {
      expect(canExpertComplete('COMPLETED', true)).toBe(false);
      expect(canExpertComplete('SETTLED', true)).toBe(false);
      expect(canExpertComplete('CANCELLED', true)).toBe(false);
      expect(canExpertComplete('AWAITING_EXPERT_APPROVAL', true)).toBe(false);
    });

    it('hides complete button (returns false) when status is CONFIRMED but schedule has NOT arrived', () => {
      const refDate = new Date('2026-10-27T10:00:00');

      // Ngày tương lai
      expect(canExpertComplete('CONFIRMED', true, '2026-10-28', '09:00:00', refDate)).toBe(false);
      expect(canExpertComplete('CONFIRMED', true, '2026-11-01', '14:00:00', refDate)).toBe(false);

      // Cùng ngày nhưng chưa đến giờ hẹn
      expect(canExpertComplete('CONFIRMED', true, '2026-10-27', '10:30:00', refDate)).toBe(false);
      expect(canExpertComplete('CONFIRMED', true, '2026-10-27', '14:00', refDate)).toBe(false);
    });

    it('shows complete button (returns true) when status is CONFIRMED and schedule HAS arrived', () => {
      const refDate = new Date('2026-10-27T10:00:00');

      // Ngày quá khứ
      expect(canExpertComplete('CONFIRMED', true, '2026-10-26', '09:00:00', refDate)).toBe(true);
      expect(canExpertComplete('CONFIRMED', true, '2026-10-20', '15:00:00', refDate)).toBe(true);

      // Cùng ngày và đã đến/qua giờ hẹn
      expect(canExpertComplete('CONFIRMED', true, '2026-10-27', '09:00:00', refDate)).toBe(true);
      expect(canExpertComplete('CONFIRMED', true, '2026-10-27', '10:00:00', refDate)).toBe(true);
    });

    it('always shows complete button for IN_PROGRESS even if slot is upcoming', () => {
      const refDate = new Date('2026-10-27T10:00:00');
      expect(canExpertComplete('IN_PROGRESS', true, '2026-10-28', '14:00:00', refDate)).toBe(true);
    });
  });

  describe('isBookingScheduleArrived', () => {
    const refDate = new Date('2026-10-27T14:30:00');

    it('returns false for missing date or time', () => {
      expect(isBookingScheduleArrived(undefined, '14:00:00', refDate)).toBe(false);
      expect(isBookingScheduleArrived('2026-10-27', undefined, refDate)).toBe(false);
    });

    it('returns false when meeting date is in the future', () => {
      expect(isBookingScheduleArrived('2026-10-28', '09:00:00', refDate)).toBe(false);
    });

    it('returns true when meeting date is in the past', () => {
      expect(isBookingScheduleArrived('2026-10-26', '16:00:00', refDate)).toBe(true);
    });

    it('returns false when meeting is today but start time is in the future', () => {
      expect(isBookingScheduleArrived('2026-10-27', '15:00:00', refDate)).toBe(false);
      expect(isBookingScheduleArrived('2026-10-27', '14:31', refDate)).toBe(false);
    });

    it('returns true when meeting is today and start time has arrived or passed', () => {
      expect(isBookingScheduleArrived('2026-10-27', '14:30:00', refDate)).toBe(true);
      expect(isBookingScheduleArrived('2026-10-27', '14:00', refDate)).toBe(true);
      expect(isBookingScheduleArrived('2026-10-27', '08:00:00', refDate)).toBe(true);
    });

    it('correctly handles ISO date string format', () => {
      expect(isBookingScheduleArrived('2026-10-27T00:00:00.000Z', '14:00', refDate)).toBe(true);
      expect(isBookingScheduleArrived('2026-10-28T00:00:00.000Z', '14:00', refDate)).toBe(false);
    });
  });

  describe('validateReviewInput', () => {
    it('validates rating in range 1-5', () => {
      expect(validateReviewInput(0, 'Buổi tư vấn rất tốt và hữu ích').valid).toBe(false);
      expect(validateReviewInput(6, 'Buổi tư vấn rất tốt và hữu ích').valid).toBe(false);
      expect(validateReviewInput(5, 'Buổi tư vấn rất tốt và hữu ích').valid).toBe(true);
    });

    it('validates comment minimum 10 characters', () => {
      expect(validateReviewInput(5, 'Quá ngắn').valid).toBe(false);
      expect(validateReviewInput(5, '     ').valid).toBe(false);
      expect(validateReviewInput(5, 'Rất hài lòng về chuyên gia').valid).toBe(true);
    });
  });

  describe('validateDisputeInput', () => {
    it('requires non-empty reason and description >= 10 characters', () => {
      expect(validateDisputeInput('', 'Chuyên gia tư vấn sai luật')).toBeDefined();
      expect(validateDisputeInput('', 'Chuyên gia tư vấn sai luật').valid).toBe(false);
      expect(validateDisputeInput('WRONG_TAX_LAW_ADVICE', 'Ngắn').valid).toBe(false);
      expect(validateDisputeInput('WRONG_TAX_LAW_ADVICE', 'Chuyên gia tư vấn sai luật thuế TT87').valid).toBe(true);
    });
  });

  describe('validateExpertResponse', () => {
    it('requires response >= 10 characters', () => {
      expect(validateExpertResponse('').valid).toBe(false);
      expect(validateExpertResponse('12345').valid).toBe(false);
      expect(validateExpertResponse('Tôi đã tư vấn đúng theo quy định hiện hành của Thông tư 111').valid).toBe(true);
    });
  });
});
