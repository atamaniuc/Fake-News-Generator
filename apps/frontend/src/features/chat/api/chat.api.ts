import type { ChatMessage } from '@fakenews/shared';
import { httpClient } from '../../../shared/api/http-client';

export type SendChatMessageInput = {
  message: string;
  requestId?: string;
};

export async function fetchChatHistory(articleId: string): Promise<ChatMessage[]> {
  const res = await httpClient.get<ChatMessage[]>(`/api/articles/${articleId}/chat`);
  return res.data;
}

export async function sendChatMessage(
  articleId: string,
  input: SendChatMessageInput,
): Promise<ChatMessage> {
  const res = await httpClient.post<ChatMessage>(`/api/articles/${articleId}/chat`, input);
  return res.data;
}
