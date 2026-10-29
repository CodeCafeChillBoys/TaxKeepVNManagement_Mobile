/** Chat tư vấn thuế với AI — BE /api/v1/tax-chat (field snake_case theo AI Service) */

export type TaxChatAskRequest = {
  question: string;
  /** Bỏ trống = phiên mới; AI tạo phiên và trả session_id */
  session_id?: string | null;
};

export type TaxChatAskResponse = {
  session_id: string | null;
  question: string;
  answer: string;
};

export type TaxChatSession = {
  id: string;
  user_id: string | null;
  /** 50 ký tự đầu của câu hỏi đầu tiên */
  title: string;
  created_at: string;
  updated_at: string;
};

export type TaxChatMessage = {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};
