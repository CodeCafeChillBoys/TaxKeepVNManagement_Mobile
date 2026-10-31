import type { ExpertSlotDetailResponse } from '../../types/consultation';

/**
 * Kiểm tra xem khung giờ đã hết hạn so với thời điểm hiện tại chưa
 */
export function isSlotExpired(slotDate: string, endTime: string, refDate = new Date()): boolean {
  if (!slotDate) return false;
  const pad = (n: number) => String(n).padStart(2, '0');
  const todayStr = `${refDate.getFullYear()}-${pad(refDate.getMonth() + 1)}-${pad(refDate.getDate())}`;

  if (slotDate < todayStr) return true;
  if (slotDate === todayStr) {
    const nowTimeStr = `${pad(refDate.getHours())}:${pad(refDate.getMinutes())}`;
    const cleanEndTime = endTime ? endTime.slice(0, 5) : '23:59';
    return cleanEndTime <= nowTimeStr;
  }
  return false;
}

/**
 * Kiểm tra xem 1 khung giờ có đủ điều kiện để xóa không.
 * Ca đã có khách đặt (isBooked = true) hoặc đang tạm giữ thanh toán (isHolding = true)
 * KHÔNG ĐƯỢC PHÉP xóa để bảo đảm quyền lợi khách hàng.
 */
export function isSlotDeletable(slot: { isBooked: boolean; isHolding?: boolean }): boolean {
  if (!slot) return false;
  return !slot.isBooked && !slot.isHolding;
}

/**
 * Lọc danh sách các ca có thể xóa từ một danh sách đã lọc (filter) bất kỳ.
 * Tự động loại trừ các ca đã có khách đặt hoặc đang tạm giữ thanh toán.
 */
export function getDeletableSlotsFromFiltered(
  filteredSlots: ExpertSlotDetailResponse[]
): ExpertSlotDetailResponse[] {
  if (!Array.isArray(filteredSlots)) return [];
  return filteredSlots.filter((s) => isSlotDeletable(s));
}

/**
 * Lọc danh sách các ca có thể xóa theo từng trạng thái cụ thể.
 * - 'EXPIRED': Các ca đã hết hạn và chưa ai đặt
 * - 'INACTIVE': Các ca đang tạm tắt và chưa ai đặt
 * - 'AVAILABLE': Các ca đang mở sẵn sàng và chưa ai đặt
 * - 'BOOKED': Luôn trả về mảng rỗng vì ca đã đặt không được phép xóa
 */
export function getDeletableSlotsByStatus(
  slots: ExpertSlotDetailResponse[],
  targetStatus: 'EXPIRED' | 'INACTIVE' | 'AVAILABLE' | 'BOOKED',
  refDate = new Date()
): ExpertSlotDetailResponse[] {
  if (!Array.isArray(slots) || targetStatus === 'BOOKED') {
    return [];
  }

  return slots.filter((s) => {
    if (!isSlotDeletable(s)) return false;
    const expired = isSlotExpired(s.slotDate, s.endTime, refDate);

    if (targetStatus === 'EXPIRED') {
      return expired;
    }
    if (targetStatus === 'INACTIVE') {
      return !s.isActive && !expired;
    }
    if (targetStatus === 'AVAILABLE') {
      return s.isActive && !expired;
    }
    return false;
  });
}
