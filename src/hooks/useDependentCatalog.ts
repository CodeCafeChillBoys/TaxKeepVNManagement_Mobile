import { useCallback, useEffect, useState } from 'react';
import { dependentDocumentApi, type DependentCatalog } from '../api/dependentDocumentApi';
import {
  getCachedCatalog,
  loadDependentCatalog,
  subscribeCatalog,
} from '../api/dependentCatalogStore';

export const CATALOG_LOAD_ERROR_MESSAGE =
  'Không tải được danh mục quan hệ và nhóm người phụ thuộc. Vui lòng kiểm tra kết nối và thử lại.';

/**
 * Catalog quan hệ / nhóm NPT. Mở màn là làm mới (mặc định) nhưng vẫn hiện ngay bản đã cache.
 * Lỗi mạng: `error` có nội dung, gọi `reload()` để thử lại.
 */
export function useDependentCatalog(options?: { refreshOnMount?: boolean }): {
  catalog: DependentCatalog | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
} {
  const refreshOnMount = options?.refreshOnMount ?? true;
  const [catalog, setCatalog] = useState<DependentCatalog | null>(getCachedCatalog());
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribeCatalog(setCatalog), []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await loadDependentCatalog(dependentDocumentApi.getCatalog, { force: true });
    } catch {
      setError(CATALOG_LOAD_ERROR_MESSAGE);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (refreshOnMount || !getCachedCatalog()) {
      void reload();
    }
  }, [refreshOnMount, reload]);

  return { catalog, loading, error, reload };
}
