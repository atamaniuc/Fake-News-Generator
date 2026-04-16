import { Inject, Injectable } from '@nestjs/common';
import type { ChatMessage } from '@fakenews/shared';
import type { ChatMessageRepositoryPort } from '../../domain/ports/chat-message.repository.port';
import type { LlmPort } from '../../domain/ports/llm.port';
import { CHAT_TOKENS } from '../../chat.tokens';
import { PrismaService } from '../../../../shared/database/prisma.service';

function buildSystemPrompt(article: {
  title: string;
  description: string;
  fake?: { fakeTitle: string; fakeContent: string } | null;
}) {
  const fakeTitle = article.fake?.fakeTitle ?? '(not transformed yet)';
  const fakeContent = article.fake?.fakeContent ?? '(not transformed yet)';
  return `You are an AI assistant analyzing a news article.\nOriginal article: ${article.title} — ${article.description}\nFake version: ${fakeTitle} — ${fakeContent}\n\nAnswer questions about this article concisely and helpfully.`;
}

@Injectable()
export class SendMessageUseCase {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CHAT_TOKENS.chatRepository)
    private readonly repo: ChatMessageRepositoryPort,
    @Inject(CHAT_TOKENS.llmProvider)
    private readonly llm: LlmPort,
  ) {}

  /**
   * Executes the main logic for handling user messages and generating a response from the assistant.
   *
   * @param {string} articleId - The unique identifier of the article associated with the conversation.
   * @param {string} userMessage - The user's message that serves as input for generating a response.
   * @param {string} [requestId] - An optional unique identifier for the request, used for tracking purposes.
   * @return {Promise<{ assistant: ChatMessage }>} A promise that resolves to an object containing the assistant's response message.
   * @throws {Error} If the corresponding article cannot be found in the database.
   */
  async execute(
    articleId: string,
    userMessage: string,
    requestId?: string,
  ): Promise<{ assistant: ChatMessage }> {
    await this.repo.createMessage({
      articleId,
      role: 'USER',
      content: userMessage,
      requestId,
    });

    const article = await this.prisma.article.findUnique({
      where: { id: articleId },
      include: { fake: true },
    });
    if (!article) {
      // If article was deleted between request and now, we still persisted user msg; keep simple.
      throw new Error('Article not found');
    }

    const history = await this.repo.listLastN(articleId, 10);
    const messages = [
      {
        role: 'system' as const,
        content: buildSystemPrompt(article),
      },
      ...history.map((m) => ({
        role: m.role === 'USER' ? ('user' as const) : ('assistant' as const),
        content: m.content,
      })),
      { role: 'user' as const, content: userMessage },
    ];

    const assistantContent = await this.llm.completeChat(messages);
    const assistant = await this.repo.createMessage({
      articleId,
      role: 'ASSISTANT',
      content: assistantContent,
      requestId,
    });
    return { assistant };
  }
}
