import { Injectable } from '@nestjs/common';
import type { ChatMessageRepositoryPort } from '../../domain/ports/chat-message.repository.port';
import type { ChatMessage, MessageRole } from '@fakenews/shared';
import { PrismaService } from '../../../../shared/database/prisma.service';

function toIso(d: Date) {
  return d.toISOString();
}

@Injectable()
export class PrismaChatMessageRepository implements ChatMessageRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findByRequestId(params: {
    articleId: string;
    role: MessageRole;
    requestId: string;
  }): Promise<ChatMessage | null> {
    const row = await this.prisma.chatMessage.findFirst({
      where: {
        articleId: params.articleId,
        role: params.role,
        requestId: params.requestId,
      },
      orderBy: { createdAt: 'asc' },
    });
    if (!row) return null;
    return {
      id: row.id,
      role: row.role as MessageRole,
      content: row.content,
      createdAt: toIso(row.createdAt),
    };
  }

  async listByArticleId(articleId: string): Promise<ChatMessage[]> {
    const rows = await this.prisma.chatMessage.findMany({
      where: { articleId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      role: r.role as MessageRole,
      content: r.content,
      createdAt: toIso(r.createdAt),
    }));
  }

  /**
   * Retrieves the last N chat messages for a specific article, ordered by their creation time.
   *
   * @param {string} articleId - The unique identifier of the article associated with the chat messages.
   * @param {number} n - The number of messages to retrieve.
   * @return {Promise<ChatMessage[]>} A promise that resolves to an array of the last N chat messages, ordered from oldest to newest.
   */
  async listLastN(articleId: string, n: number): Promise<ChatMessage[]> {
    const rows = await this.prisma.chatMessage.findMany({
      where: { articleId },
      orderBy: { createdAt: 'desc' },
      take: n,
    });
    return rows.reverse().map((r) => ({
      id: r.id,
      role: r.role as MessageRole,
      content: r.content,
      createdAt: toIso(r.createdAt),
    }));
  }

  /**
   * Creates a chat message in the database. If a requestId is provided, it attempts to update an
   * existing message with the same articleId, requestId, and role. If no requestId is provided,
   * it creates a new message.
   *
   * @param {Object} params - The parameters for creating or updating the message.
   * @param {string} params.articleId - The ID of the article associated with the message.
   * @param {MessageRole} params.role - The role of the message (e.g., user, assistant).
   * @param {string} params.content - The content of the message.
   * @param {string} [params.requestId] - The request ID used for identifying and updating an existing message.
   * @return {Promise<ChatMessage>} A promise that resolves to the created or updated chat message.
   */
  async createMessage(params: {
    articleId: string;
    role: MessageRole;
    content: string;
    requestId?: string;
  }): Promise<ChatMessage> {
    const row = params.requestId
      ? await this.prisma.chatMessage.upsert({
          where: {
            articleId_requestId_role: {
              articleId: params.articleId,
              requestId: params.requestId,
              role: params.role,
            },
          },
          create: {
            articleId: params.articleId,
            requestId: params.requestId,
            role: params.role,
            content: params.content,
          },
          update: {
            // If we retry/fallback, keep the latest content.
            content: params.content,
          },
        })
      : await this.prisma.chatMessage.create({
          data: {
            articleId: params.articleId,
            role: params.role,
            content: params.content,
          },
        });
    return {
      id: row.id,
      role: row.role as MessageRole,
      content: row.content,
      createdAt: toIso(row.createdAt),
    };
  }
}
