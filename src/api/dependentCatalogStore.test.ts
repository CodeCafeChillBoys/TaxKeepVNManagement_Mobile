import {
  getCachedCatalog,
  loadDependentCatalog,
  setCachedCatalog,
  subscribeCatalog,
} from './dependentCatalogStore';
import type { DependentCatalog } from './dependentDocumentApi';

const catalogA: DependentCatalog = {
  relationships: [{ code: 'CHILD', name: 'Con', displayOrder: 1 }],
  groups: [],
};
const catalogB: DependentCatalog = {
  relationships: [{ code: 'SPOUSE', name: 'Vợ/chồng', displayOrder: 1 }],
  groups: [],
};

describe('dependentCatalogStore', () => {
  beforeEach(() => setCachedCatalog(null));

  it('fetches once and serves the cache afterwards', async () => {
    const fetcher = jest.fn().mockResolvedValue(catalogA);
    await expect(loadDependentCatalog(fetcher)).resolves.toBe(catalogA);
    await expect(loadDependentCatalog(fetcher)).resolves.toBe(catalogA);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(getCachedCatalog()).toBe(catalogA);
  });

  it('force refreshes and notifies subscribers', async () => {
    setCachedCatalog(catalogA);
    const listener = jest.fn();
    const unsubscribe = subscribeCatalog(listener);
    await loadDependentCatalog(jest.fn().mockResolvedValue(catalogB), { force: true });
    expect(getCachedCatalog()).toBe(catalogB);
    expect(listener).toHaveBeenCalledWith(catalogB);
    unsubscribe();
  });

  it('shares one request between concurrent callers', async () => {
    const fetcher = jest.fn().mockResolvedValue(catalogA);
    await Promise.all([
      loadDependentCatalog(fetcher, { force: true }),
      loadDependentCatalog(fetcher, { force: true }),
    ]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('keeps the old cache and rethrows on network error (no fallback list)', async () => {
    setCachedCatalog(catalogA);
    await expect(
      loadDependentCatalog(jest.fn().mockRejectedValue(new Error('Network Error')), { force: true })
    ).rejects.toThrow('Network Error');
    expect(getCachedCatalog()).toBe(catalogA);

    setCachedCatalog(null);
    await expect(
      loadDependentCatalog(jest.fn().mockRejectedValue(new Error('Network Error')))
    ).rejects.toThrow();
    expect(getCachedCatalog()).toBeNull();
  });
});
