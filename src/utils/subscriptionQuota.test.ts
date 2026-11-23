import { emitQuotaExceeded, onQuotaExceeded, quotaErrorFrom } from './subscriptionQuota';

describe('quotaErrorFrom', () => {
  it('detects quota error codes from BE response', () => {
    const err = { response: { data: { errorCode: 'OCR_QUOTA_EXCEEDED', message: 'Hết 5 lượt OCR' } } };
    expect(quotaErrorFrom(err)).toEqual({ code: 'OCR_QUOTA_EXCEEDED', message: 'Hết 5 lượt OCR' });
  });

  it('ignores other errors', () => {
    expect(quotaErrorFrom({ response: { data: { errorCode: 'VALIDATION_ERROR' } } })).toBeNull();
    expect(quotaErrorFrom(new Error('network'))).toBeNull();
  });

  it('delivers events to the registered listener until unsubscribed', () => {
    const seen: string[] = [];
    const off = onQuotaExceeded((e) => seen.push(e.code));
    emitQuotaExceeded({ code: 'OCR_QUOTA_EXCEEDED', message: 'x' });
    off();
    emitQuotaExceeded({ code: 'OCR_QUOTA_EXCEEDED', message: 'x' });
    expect(seen).toEqual(['OCR_QUOTA_EXCEEDED']);
  });
});
