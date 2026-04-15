import type { ChatMessage, MessageRole } from '@fakenews/shared';

export interface ChatMessageRepositoryPort {
  listByArticleId(articleId: string): Promise<ChatMessage[]>;
  findByRequestId(params: {
    articleId: string;
    role: MessageRole;
    requestId: string;
  }): Promise<ChatMessage | null>;
  createMessage(params: {
    articleId: string;
    role: MessageRole;
    content: string;
    requestId?: string;
  }): Promise<ChatMessage>;
  listLastN(articleId: string, n: number): Promise<ChatMessage[]>;
}
