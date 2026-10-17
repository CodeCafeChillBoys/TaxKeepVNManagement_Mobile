import {
  canUserReview,
  canUserDispute,
  canConfirmSatisfaction,
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
