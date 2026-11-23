import {
  MIN_ZOOM_SCALE,
  MAX_ZOOM_SCALE,
  DOUBLE_TAP_ZOOM_SCALE,
  clampZoomScale,
  stepZoomIn,
  stepZoomOut,
  getNextDoubleTapScale,
  calculatePinchDistance,
  calculatePinchScale,
  clampPanOffset,
  formatZoomPercent,
  isImageDocumentUri,
} from './imageZoomUtils';

describe('imageZoomUtils', () => {
  it('clamps zoom scale between MIN_ZOOM_SCALE and MAX_ZOOM_SCALE', () => {
    expect(clampZoomScale(0.2)).toBe(MIN_ZOOM_SCALE);
    expect(clampZoomScale(2.3)).toBe(2.3);
    expect(clampZoomScale(9)).toBe(MAX_ZOOM_SCALE);
    expect(clampZoomScale(Number.NaN)).toBe(MIN_ZOOM_SCALE);
  });

  it('steps zoom in and out cleanly within bounds', () => {
    expect(stepZoomIn(1)).toBe(1.5);
    expect(stepZoomIn(3.8)).toBe(MAX_ZOOM_SCALE);
    expect(stepZoomOut(2)).toBe(1.5);
    expect(stepZoomOut(1)).toBe(MIN_ZOOM_SCALE);
  });

  it('toggles double-tap zoom between 1x and 2.5x', () => {
    expect(getNextDoubleTapScale(1)).toBe(DOUBLE_TAP_ZOOM_SCALE);
    expect(getNextDoubleTapScale(2.5)).toBe(MIN_ZOOM_SCALE);
    expect(getNextDoubleTapScale(1.5)).toBe(MIN_ZOOM_SCALE);
  });

  it('calculates pinch distance and resulting scale safely', () => {
    expect(calculatePinchDistance({ pageX: 0, pageY: 0 }, { pageX: 30, pageY: 40 })).toBe(50);
    expect(calculatePinchScale(1, 100, 200)).toBe(2);
    expect(calculatePinchScale(2, 100, 300)).toBe(MAX_ZOOM_SCALE);
    expect(calculatePinchScale(1.5, 0, 100)).toBe(1.5);
  });

  it('clamps pan offsets to zoomed image bounds and resets at 1x', () => {
    expect(clampPanOffset({ x: 80, y: -50 }, 1, { width: 400, height: 600 })).toEqual({ x: 0, y: 0 });
    expect(clampPanOffset({ x: 500, y: -500 }, 2, { width: 400, height: 600 })).toEqual({ x: 200, y: -300 });
    expect(clampPanOffset({ x: 50, y: -40 }, 2, { width: 400, height: 600 })).toEqual({ x: 50, y: -40 });
  });

  it('formats zoom percent and detects image vs PDF URIs including signed query strings', () => {
    expect(formatZoomPercent(1)).toBe('100%');
    expect(formatZoomPercent(2.5)).toBe('250%');
    expect(isImageDocumentUri('https://cdn.example.com/bang_ke.jpg?token=123')).toBe(true);
    expect(isImageDocumentUri('https://cdn.example.com/bang_ke.pdf?token=123')).toBe(false);
    expect(isImageDocumentUri('https://cdn.example.com/file', 'application/pdf')).toBe(false);
    expect(isImageDocumentUri('https://cdn.example.com/file', undefined, 'bang_ke.PDF')).toBe(false);
  });
});
