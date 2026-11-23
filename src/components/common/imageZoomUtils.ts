export const MIN_ZOOM_SCALE = 1;
export const MAX_ZOOM_SCALE = 4;
export const ZOOM_STEP = 0.5;
export const DOUBLE_TAP_ZOOM_SCALE = 2.5;

export interface Point2D {
  pageX: number;
  pageY: number;
}

export interface Offset2D {
  x: number;
  y: number;
}

export interface Size2D {
  width: number;
  height: number;
}

export function clampZoomScale(scale: number): number {
  if (!Number.isFinite(scale)) return MIN_ZOOM_SCALE;
  return Math.min(MAX_ZOOM_SCALE, Math.max(MIN_ZOOM_SCALE, scale));
}

export function stepZoomIn(currentScale: number): number {
  const rounded = Math.round((clampZoomScale(currentScale) + ZOOM_STEP) * 100) / 100;
  return clampZoomScale(rounded);
}

export function stepZoomOut(currentScale: number): number {
  const rounded = Math.round((clampZoomScale(currentScale) - ZOOM_STEP) * 100) / 100;
  return clampZoomScale(rounded);
}

export function getNextDoubleTapScale(currentScale: number): number {
  return clampZoomScale(currentScale) > MIN_ZOOM_SCALE + 0.05
    ? MIN_ZOOM_SCALE
    : DOUBLE_TAP_ZOOM_SCALE;
}

export function calculatePinchDistance(p1: Point2D, p2: Point2D): number {
  const dx = p1.pageX - p2.pageX;
  const dy = p1.pageY - p2.pageY;
  return Math.hypot(dx, dy);
}

export function calculatePinchScale(
  startScale: number,
  startDistance: number,
  currentDistance: number
): number {
  if (!Number.isFinite(startDistance) || startDistance <= 0 || !Number.isFinite(currentDistance) || currentDistance <= 0) {
    return clampZoomScale(startScale);
  }
  return clampZoomScale(startScale * (currentDistance / startDistance));
}

export function clampPanOffset(
  offset: Offset2D,
  scale: number,
  viewport: Size2D
): Offset2D {
  const s = clampZoomScale(scale);
  if (s <= MIN_ZOOM_SCALE || viewport.width <= 0 || viewport.height <= 0) {
    return { x: 0, y: 0 };
  }
  const maxX = Math.max(0, (viewport.width * (s - 1)) / 2);
  const maxY = Math.max(0, (viewport.height * (s - 1)) / 2);
  return {
    x: Math.min(maxX, Math.max(-maxX, Number.isFinite(offset.x) ? offset.x : 0)),
    y: Math.min(maxY, Math.max(-maxY, Number.isFinite(offset.y) ? offset.y : 0)),
  };
}

export function formatZoomPercent(scale: number): string {
  return `${Math.round(clampZoomScale(scale) * 100)}%`;
}

export function isImageDocumentUri(
  uri?: string | null,
  mimeType?: string | null,
  fileName?: string | null
): boolean {
  if (mimeType) {
    if (mimeType.toLowerCase().includes('image')) return true;
    if (mimeType.toLowerCase().includes('pdf')) return false;
  }
  const cleanUri = (uri || '').split(/[?#]/)[0].toLowerCase();
  const cleanName = (fileName || '').trim().toLowerCase();
  if (cleanUri.endsWith('.pdf') || cleanName.endsWith('.pdf')) {
    return false;
  }
  if (/\.(png|jpe?g|webp|gif|bmp|heic)$/.test(cleanUri) || /\.(png|jpe?g|webp|gif|bmp|heic)$/.test(cleanName)) {
    return true;
  }
  return Boolean(cleanUri);
}
