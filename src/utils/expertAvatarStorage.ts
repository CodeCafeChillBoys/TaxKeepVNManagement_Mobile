import { apiClient, storageHelper } from '../api/apiClient';

const AVATAR_KEY_PREFIX = 'taxkeep_expert_avatar_';
const memoryAvatarCache = new Map<string, string>();

function normalizeUserId(userId?: string | null): string {
  return (userId || '').trim().toLowerCase();
}

function getSafeBaseUrl(): string {
  const clientBase = (apiClient as unknown as { defaults?: { baseURL?: string } })?.defaults
    ?.baseURL;
  if (typeof clientBase === 'string' && clientBase.trim()) {
    return clientBase.trim().replace(/\/+$/, '');
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cfg = require('../constants/config') as { getLocalApiBaseUrl?: () => string };
    return (cfg.getLocalApiBaseUrl?.() || '').replace(/\/+$/, '');
  } catch {
    return '';
  }
}

export function resolveExpertAvatarUri(url?: string | null): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('file://') ||
    trimmed.startsWith('content://') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }
  const baseUrl = getSafeBaseUrl();
  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return baseUrl ? `${baseUrl}${cleanPath}` : cleanPath;
}

export async function getCustomExpertAvatar(userId?: string | null): Promise<string | null> {
  const normUid = normalizeUserId(userId);
  if (!normUid) return null;

  const cached = memoryAvatarCache.get(normUid);
  if (cached) return cached;

  try {
    const stored = await storageHelper.getItem(`${AVATAR_KEY_PREFIX}${normUid}`);
    if (typeof stored === 'string' && stored.trim()) {
      const clean = stored.trim();
      memoryAvatarCache.set(normUid, clean);
      return clean;
    }
  } catch {
    // Bỏ qua lỗi đọc bộ nhớ cục bộ
  }
  return null;
}

export async function saveCustomExpertAvatar(userId: string, avatarUri: string): Promise<void> {
  const normUid = normalizeUserId(userId);
  const cleanUri = (avatarUri || '').trim();
  if (!normUid || !cleanUri) return;

  memoryAvatarCache.set(normUid, cleanUri);
  try {
    await storageHelper.setItem(`${AVATAR_KEY_PREFIX}${normUid}`, cleanUri);
  } catch {
    // Vẫn giữ trong memoryAvatarCache cho phiên hiện tại nếu bộ nhớ đầy
  }
}

export function clearCustomExpertAvatarCache(): void {
  memoryAvatarCache.clear();
}
