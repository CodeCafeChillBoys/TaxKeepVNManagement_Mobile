import { apiClient } from './apiClient';
import type { ApiResponse } from './authApi';
import type {
  TaxChatAskRequest,
  TaxChatAskResponse,
  TaxChatMessage,
  TaxChatSession,
} from '../types/taxChat';

const BASE = '/api/v1/tax-chat';
/** Gemini trả lời dài (từng bước + bảng) có thể mất 20–60s, timeout chung 15s là không đủ */
const ASK_TIMEOUT_MS = 90_000;

export const taxChatApi = {
  /** POST /api/v1/tax-chat — hỏi AI; truyền session_id để tiếp tục phiên */
  async ask(body: TaxChatAskRequest): Promise<TaxChatAskResponse> {
    const res = await apiClient.post<ApiResponse<TaxChatAskResponse>>(BASE, body, { timeout: ASK_TIMEOUT_MS });
    if (!res.data?.data) throw new Error(res.data?.message || 'AI không trả về câu trả lời.');
    return res.data.data;
  },

  /** GET /api/v1/tax-chat/sessions — phiên của user hiện tại, mới nhất trước */
  async getSessions(): Promise<TaxChatSession[]> {
    const res = await apiClient.get<ApiResponse<TaxChatSession[]>>(`${BASE}/sessions`);
    return res.data?.data ?? [];
  },

  /** GET /api/v1/tax-chat/sessions/{id}/messages */
  async getMessages(sessionId: string): Promise<TaxChatMessage[]> {
    const res = await apiClient.get<ApiResponse<TaxChatMessage[]>>(`${BASE}/sessions/${sessionId}/messages`);
    return res.data?.data ?? [];
  },

  /** DELETE /api/v1/tax-chat/sessions/{id} */
  async deleteSession(sessionId: string): Promise<void> {
    await apiClient.delete(`${BASE}/sessions/${sessionId}`);
  },
};
