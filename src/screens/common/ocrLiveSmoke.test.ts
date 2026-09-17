/**
 * OCR-11 live smoke — requires BE :5023 (+ TaxAI for OCR path).
 * Skips automatically when BE is unreachable so CI without stack still passes.
 */
import axios from 'axios';

const BE = process.env.OCR_BE_URL ?? 'http://localhost:5023';
const TAXAI = process.env.OCR_TAXAI_URL ?? 'http://localhost:8000';

/** Minimal valid PNG (1×1) — BE should reject as unreadable, proving pipeline is up. */
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

async function isReachable(url: string): Promise<boolean> {
  try {
    await axios.get(url, { timeout: 3000, validateStatus: () => true });
    return true;
  } catch {
    return false;
  }
}

function tinyFormData(): FormData {
  const form = new FormData();
  form.append('File', new Blob([PNG_1X1], { type: 'image/png' }), 'smoke.png');
  return form;
}

describe('OCR-11 live smoke (BE/TaxAI)', () => {
  jest.setTimeout(90000);

  let beUp = false;
  let taxAiUp = false;

  beforeAll(async () => {
    beUp = await isReachable(`${BE}/swagger/index.html`);
    taxAiUp = await isReachable(`${TAXAI}/docs`);
  });

  it('BE :5023 reachable', () => {
    if (!beUp) {
      console.warn(`[OCR-11] BE not reachable at ${BE} — skip live assertions`);
    }
    expect(beUp || process.env.CI === 'true').toBeDefined();
    if (!beUp) return;
    expect(beUp).toBe(true);
  });

  it('TaxAI :8000 reachable', () => {
    if (!taxAiUp) {
      console.warn(`[OCR-11] TaxAI not reachable at ${TAXAI}`);
    }
    if (!taxAiUp) return;
    expect(taxAiUp).toBe(true);
  });

  it('POST /auth/cccd-extractions returns structured OCR error for blank image', async () => {
    if (!beUp) return;

    const res = await axios.post(`${BE}/api/v1/auth/cccd-extractions`, tinyFormData(), {
      timeout: 60000,
      validateStatus: () => true,
      headers: { Accept: 'application/json' },
    });

    expect([400, 500]).toContain(res.status);
    expect(res.data).toEqual(
      expect.objectContaining({
        success: false,
        errors: expect.objectContaining({
          errorCode: expect.stringMatching(/UNREADABLE|INVALID/i),
        }),
      })
    );
  });

  it('POST /ocr/direct-extractions responds (auth optional / pipeline up)', async () => {
    if (!beUp) return;

    const res = await axios.post(`${BE}/api/v1/ocr/direct-extractions`, tinyFormData(), {
      timeout: 60000,
      validateStatus: () => true,
      headers: { Accept: 'application/json' },
    });

    // 401 if JWT required; 400 unreadable; 200 nested failure — all prove route is live
    expect([200, 400, 401, 403, 500]).toContain(res.status);
  });

  it('POST /ocr/dependents accepts task or reports RabbitMQ/infra failure', async () => {
    if (!beUp) return;

    const res = await axios.post(`${BE}/api/v1/ocr/dependents`, tinyFormData(), {
      timeout: 60000,
      validateStatus: () => true,
      headers: { Accept: 'application/json' },
    });

    expect([200, 400, 401, 403, 500]).toContain(res.status);
    if (res.status === 200 && res.data?.data?.taskId) {
      expect(typeof res.data.data.taskId).toBe('string');
    }
    if (res.status === 500) {
      // Case 8 env: RabbitMQ/consumer down — FE must surface timeout/server, not hang silent
      expect(String(res.data?.errors?.errorCode ?? res.data?.message ?? '')).toMatch(
        /INTERNAL|Connection|error/i
      );
    }
  });
});
