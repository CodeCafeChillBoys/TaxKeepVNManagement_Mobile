import type { AxiosInstance } from 'axios';

jest.mock('./apiClient', () => ({
  apiClient: { post: jest.fn(), get: jest.fn() },
}));

import { createOcrApi, OcrPollTimeoutError } from './ocrApi';

const front = { uri: 'file:///front.jpg', name: 'front.jpg', type: 'image/jpeg' };
const back = { uri: 'file:///back.jpg', name: 'back.jpg', type: 'image/jpeg' };

function createHttpMock() {
  return {
    post: jest.fn(),
    get: jest.fn(),
  } as unknown as AxiosInstance & { post: jest.Mock; get: jest.Mock };
}

describe('ocrApi', () => {
  describe('extractUserCccd', () => {
    it('POSTs multipart to /api/v1/auth/cccd-extractions and returns ApiResponse data', async () => {
      const http = createHttpMock();
      const body = {
        success: true,
        message: 'ok',
        data: {
          fullName: 'NGUYEN VAN A',
          citizenId: '079301001234',
          dateOfBirth: '1990-05-12',
          gender: 'MALE',
          address: 'Ha Noi',
          isAvailable: true,
          warning: null,
        },
      };
      http.post.mockResolvedValue({ data: body, status: 200 });

      const api = createOcrApi(http);
      const result = await api.extractUserCccd(front, back);

      expect(result).toEqual(body);
      expect(http.post).toHaveBeenCalledTimes(1);
      const [url, formData, config] = http.post.mock.calls[0];
      expect(url).toBe('/api/v1/auth/cccd-extractions');
      expect(formData).toBeInstanceOf(FormData);
      expect(config.timeout).toBe(30000);
      expect(config.headers?.['Content-Type']).not.toBe('application/json');
    });
  });

  describe('extractDirect', () => {
    it('POSTs multipart to /api/v1/ocr/direct-extractions and returns ApiResponse', async () => {
      const http = createHttpMock();
      const body = {
        success: true,
        message: 'ok',
        data: {
          taskId: 't1',
          success: true,
          statusCode: 200,
          message: 'done',
          data: { fullName: 'A', isReadable: true },
        },
      };
      http.post.mockResolvedValue({ data: body, status: 200 });

      const api = createOcrApi(http);
      const result = await api.extractDirect(front);

      expect(result).toEqual(body);
      const [url, formData, config] = http.post.mock.calls[0];
      expect(url).toBe('/api/v1/ocr/direct-extractions');
      expect(formData).toBeInstanceOf(FormData);
      expect(config.timeout).toBe(30000);
      expect(config.headers?.['Content-Type']).not.toBe('application/json');
    });
  });

  describe('createDependentOcrTask', () => {
    it('POSTs to /api/v1/ocr/dependents and returns 202 task payload', async () => {
      const http = createHttpMock();
      const body = {
        success: true,
        message: 'queued',
        data: {
          taskId: '11111111-1111-1111-1111-111111111111',
          checkStatusUrl: '/api/v1/ocr/tasks/11111111-1111-1111-1111-111111111111',
        },
      };
      http.post.mockResolvedValue({ data: body, status: 202 });

      const api = createOcrApi(http);
      const result = await api.createDependentOcrTask(front, back);

      expect(result).toEqual(body);
      expect(http.post.mock.calls[0][0]).toBe('/api/v1/ocr/dependents');
      expect(http.post.mock.calls[0][1]).toBeInstanceOf(FormData);
      expect(http.post.mock.calls[0][2].timeout).toBe(30000);
    });
  });

  describe('getOcrTask', () => {
    it('GETs /api/v1/ocr/tasks/{taskId} and returns ApiResponse', async () => {
      const http = createHttpMock();
      const taskId = '22222222-2222-2222-2222-222222222222';
      const body = {
        success: true,
        message: 'ok',
        data: {
          taskId,
          success: true,
          statusCode: 200,
          message: 'done',
          data: { fullName: 'B', isReadable: true },
        },
      };
      http.get.mockResolvedValue({ data: body, status: 200 });

      const api = createOcrApi(http);
      const result = await api.getOcrTask(taskId);

      expect(result).toEqual(body);
      expect(http.get).toHaveBeenCalledWith(
        `/api/v1/ocr/tasks/${taskId}`,
        expect.objectContaining({ timeout: 30000 })
      );
    });
  });

  describe('pollOcrTask', () => {
    it('keeps polling on 404 then returns when task succeeds', async () => {
      jest.useFakeTimers();
      const http = createHttpMock();
      const taskId = '33333333-3333-3333-3333-333333333333';
      const done = {
        success: true,
        message: 'ok',
        data: {
          taskId,
          success: true,
          statusCode: 200,
          message: 'done',
          data: { fullName: 'C', isReadable: true },
        },
      };

      const notFound = Object.assign(new Error('Not Found'), {
        response: { status: 404, data: { errors: { errorCode: 'TASK_NOT_FOUND_OR_PROCESSING' } } },
        isAxiosError: true,
      });

      http.get
        .mockRejectedValueOnce(notFound)
        .mockRejectedValueOnce(notFound)
        .mockResolvedValueOnce({ data: done, status: 200 });

      const api = createOcrApi(http);
      const promise = api.pollOcrTask(taskId, { intervalMs: 1000, timeoutMs: 10000 });

      await jest.advanceTimersByTimeAsync(0);
      await jest.advanceTimersByTimeAsync(1000);
      await jest.advanceTimersByTimeAsync(1000);

      await expect(promise).resolves.toEqual(done);
      expect(http.get).toHaveBeenCalledTimes(3);

      jest.useRealTimers();
    });

    it('throws OcrPollTimeoutError when still 404 after timeout', async () => {
      jest.useFakeTimers();
      const http = createHttpMock();
      const taskId = '44444444-4444-4444-4444-444444444444';
      const notFound = Object.assign(new Error('Not Found'), {
        response: { status: 404 },
        isAxiosError: true,
      });
      http.get.mockRejectedValue(notFound);

      const api = createOcrApi(http);
      const promise = api.pollOcrTask(taskId, { intervalMs: 2000, timeoutMs: 5000 });
      promise.catch(() => undefined);

      await jest.advanceTimersByTimeAsync(0);
      await jest.advanceTimersByTimeAsync(2000);
      await jest.advanceTimersByTimeAsync(2000);
      await jest.advanceTimersByTimeAsync(2000);

      await expect(promise).rejects.toBeInstanceOf(OcrPollTimeoutError);

      jest.useRealTimers();
    });

    it('stops polling when AbortSignal is aborted', async () => {
      jest.useFakeTimers();
      const http = createHttpMock();
      const taskId = '55555555-5555-5555-5555-555555555555';
      const notFound = Object.assign(new Error('Not Found'), {
        response: { status: 404 },
        isAxiosError: true,
      });
      http.get.mockRejectedValue(notFound);

      const controller = new AbortController();
      const api = createOcrApi(http);
      const promise = api.pollOcrTask(taskId, {
        intervalMs: 2000,
        timeoutMs: 30000,
        signal: controller.signal,
      });
      promise.catch(() => undefined);

      await jest.advanceTimersByTimeAsync(0);
      controller.abort();
      await jest.advanceTimersByTimeAsync(2000);

      await expect(promise).rejects.toMatchObject({ name: 'AbortError' });

      jest.useRealTimers();
    });
  });
});
