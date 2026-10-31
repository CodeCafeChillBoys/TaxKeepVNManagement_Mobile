import {
  isSlotExpired,
  isSlotDeletable,
  getDeletableSlotsByStatus,
  getDeletableSlotsFromFiltered,
} from './expertSlotsBulkDeleteUtils';
import type { ExpertSlotDetailResponse } from '../../types/consultation';

describe('expertSlotsBulkDeleteUtils', () => {
  const fixedNow = new Date(2026, 9, 22, 10, 0); // 2026-10-22 10:00

  const createMockSlot = (overrides: Partial<ExpertSlotDetailResponse>): ExpertSlotDetailResponse => ({
    id: 'slot-1',
    expertProfileId: 'expert-1',
    slotDate: '2026-10-23',
    startTime: '09:00:00',
    endTime: '10:00:00',
    durationMinutes: 60,
    sessionType: 'ONLINE_MEETING',
    isBooked: false,
    isActive: true,
    isHolding: false,
    createdAt: '2026-10-20T00:00:00Z',
    updatedAt: '2026-10-20T00:00:00Z',
    ...overrides,
  });

  describe('isSlotExpired', () => {
    it('returns true for past dates', () => {
      expect(isSlotExpired('2026-10-20', '15:00:00', fixedNow)).toBe(true);
    });

    it('returns true if same day but endTime is before or equal to current time', () => {
      expect(isSlotExpired('2026-10-22', '09:30:00', fixedNow)).toBe(true);
      expect(isSlotExpired('2026-10-22', '10:00:00', fixedNow)).toBe(true);
    });

    it('returns false if same day and endTime is after current time', () => {
      expect(isSlotExpired('2026-10-22', '10:30:00', fixedNow)).toBe(false);
      expect(isSlotExpired('2026-10-22', '14:00:00', fixedNow)).toBe(false);
    });

    it('returns false for future dates', () => {
      expect(isSlotExpired('2026-10-25', '08:00:00', fixedNow)).toBe(false);
    });
  });

  describe('isSlotDeletable', () => {
    it('returns false for booked slots', () => {
      expect(isSlotDeletable({ isBooked: true, isHolding: false })).toBe(false);
    });

    it('returns false for slots currently on hold', () => {
      expect(isSlotDeletable({ isBooked: false, isHolding: true })).toBe(false);
    });

    it('returns true for available or expired unbooked slots', () => {
      expect(isSlotDeletable({ isBooked: false, isHolding: false })).toBe(true);
    });
  });

  describe('getDeletableSlotsFromFiltered', () => {
    it('filters out booked and holding slots from any filtered list', () => {
      const filtered: ExpertSlotDetailResponse[] = [
        createMockSlot({ id: 's-1', isBooked: false, isHolding: false }),
        createMockSlot({ id: 's-2', isBooked: true, isHolding: false }),
        createMockSlot({ id: 's-3', isBooked: false, isHolding: true }),
        createMockSlot({ id: 's-4', isBooked: false, isHolding: false }),
      ];

      const res = getDeletableSlotsFromFiltered(filtered);
      expect(res.map((s) => s.id)).toEqual(['s-1', 's-4']);
    });

    it('returns empty array if filteredSlots is empty or not array', () => {
      expect(getDeletableSlotsFromFiltered([])).toEqual([]);
      expect(getDeletableSlotsFromFiltered(null as any)).toEqual([]);
    });
  });

  describe('getDeletableSlotsByStatus', () => {
    const slots: ExpertSlotDetailResponse[] = [
      createMockSlot({ id: 's-expired-1', slotDate: '2026-10-20', endTime: '11:00:00' }), // EXPIRED
      createMockSlot({ id: 's-expired-2', slotDate: '2026-10-22', endTime: '09:00:00' }), // EXPIRED today past 9:00
      createMockSlot({ id: 's-available-1', slotDate: '2026-10-23', isActive: true }), // AVAILABLE
      createMockSlot({ id: 's-available-2', slotDate: '2026-10-24', isActive: true }), // AVAILABLE
      createMockSlot({ id: 's-inactive-1', slotDate: '2026-10-25', isActive: false }), // INACTIVE
      createMockSlot({ id: 's-booked-1', slotDate: '2026-10-26', isBooked: true }), // BOOKED
      createMockSlot({ id: 's-holding-1', slotDate: '2026-10-27', isHolding: true }), // HOLDING
    ];

    it('returns all expired unbooked slots for EXPIRED status', () => {
      const res = getDeletableSlotsByStatus(slots, 'EXPIRED', fixedNow);
      expect(res.map((s) => s.id)).toEqual(['s-expired-1', 's-expired-2']);
    });

    it('returns all inactive unbooked future slots for INACTIVE status', () => {
      const res = getDeletableSlotsByStatus(slots, 'INACTIVE', fixedNow);
      expect(res.map((s) => s.id)).toEqual(['s-inactive-1']);
    });

    it('returns all available unbooked future slots for AVAILABLE status', () => {
      const res = getDeletableSlotsByStatus(slots, 'AVAILABLE', fixedNow);
      expect(res.map((s) => s.id)).toEqual(['s-available-1', 's-available-2']);
    });

    it('always returns empty list for BOOKED status to protect client reservations', () => {
      const res = getDeletableSlotsByStatus(slots, 'BOOKED', fixedNow);
      expect(res).toEqual([]);
    });
  });
});
