import { Inject, Injectable } from '@nestjs/common';
import type { ChatMessage } from '@fakenews/shared';
import type { ChatMessageRepositoryPort } from '../../domain/ports/chat-message.repository.port';
import { CHAT_TOKENS } from '../../chat.tokens';

@Injectable()
export class GetChatHistoryUseCase {
  constructor(
    @Inject(CHAT_TOKENS.chatRepository)
    private readonly repo: ChatMessageRepositoryPort,
  ) {}

  async execute(articleId: string): Promise<ChatMessage[]> {
    return this.repo.listByArticleId(articleId);
  }
}
