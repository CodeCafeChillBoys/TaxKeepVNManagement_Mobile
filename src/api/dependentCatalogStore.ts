// Cache catalog quan hệ / nhóm NPT dùng chung cho cả app (không import react-native để test được bằng jest).
import type { DependentCatalog } from './dependentDocumentApi';

let cached: DependentCatalog | null = null;
let inflight: Promise<DependentCatalog> | null = null;
const listeners = new Set<(catalog: DependentCatalog | null) => void>();

export const getCachedCatalog = (): DependentCatalog | null => cached;

export const setCachedCatalog = (catalog: DependentCatalog | null): void => {
  cached = catalog;
  listeners.forEach((fn) => fn(cached));
};

export const subscribeCatalog = (fn: (catalog: DependentCatalog | null) => void): (() => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

/**
 * Nạp catalog qua `fetcher`. Có cache thì trả luôn trừ khi `force`.
 * Nhiều màn gọi cùng lúc chỉ tạo một request. Lỗi thì giữ cache cũ và ném lỗi cho màn hình xử lý.
 */
export const loadDependentCatalog = async (
  fetcher: () => Promise<DependentCatalog>,
  options?: { force?: boolean }
): Promise<DependentCatalog> => {
  if (cached && !options?.force) return cached;
  if (!inflight) {
    inflight = fetcher()
      .then((catalog) => {
        setCachedCatalog(catalog);
        return catalog;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
};
