import {
  Body,
  Controller,
  Get,
  MessageEvent,
  Param,
  Post,
  Query,
  Sse,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { GetChatHistoryUseCase } from '../../application/use-cases/get-chat-history.use-case';
import { SendMessageUseCase } from '../../application/use-cases/send-message.use-case';
import { SendMessageDto } from './dtos/send-message.dto';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { PrismaChatMessageRepository } from '../../infrastructure/persistence/prisma-chat-message.repository';
import { OpenAiChatAdapter } from '../../infrastructure/llm/openai-chat.adapter';
import {
  getErrorMessage,
  getErrorStatus,
} from '../../../../shared/utils/errors';
import { parseRetryAfterMs, truncate } from '../../../../shared/utils/text';

function buildSystemPrompt(article: {
  title: string;
  description: string;
  fake?: { fakeTitle: string; fakeContent: string } | null;
}) {
  const fakeTitle = article.fake?.fakeTitle ?? '(not transformed yet)';
  const fakeContent = article.fake?.fakeContent ?? '(not transformed yet)';
  // Keep context bounded to reduce token usage and rate-limit risk.
  const original = truncate(`${article.title} — ${article.description}`, 1400);
  const fake = truncate(`${fakeTitle} — ${fakeContent}`, 1400);
  return `You are an AI assistant analyzing a news article.\nOriginal article: ${original}\nFake version: ${fake}\n\nAnswer questions about this article concisely and helpfully.`;
}

@Controller('/api/articles/:articleId/chat')
export class ChatController {
  constructor(
    private readonly getHistory: GetChatHistoryUseCase,
    private readonly sendMessage: SendMessageUseCase,
    private readonly prisma: PrismaService,
    private readonly chatRepo: PrismaChatMessageRepository,
    private readonly llm: OpenAiChatAdapter,
  ) {}

  @Get()
  async history(@Param('articleId') articleId: string) {
    return this.getHistory.execute(articleId);
  }

  @Post()
  async send(
    @Param('articleId') articleId: string,
    @Body() dto: SendMessageDto,
  ) {
    const res = await this.sendMessage.execute(
      articleId,
      dto.message,
      dto.requestId,
    );
    return res.assistant;
  }

  @Sse('/stream')
  stream(
    @Param('articleId') articleId: string,
    @Query('message') message?: string,
    @Query('requestId') requestId?: string,
  ): Observable<MessageEvent> {
    const userMessage = (message ?? '').trim();
    if (!userMessage) {
      return new Observable((sub) => {
        sub.next({ data: { type: 'error', message: 'message is required' } });
        sub.complete();
      });
    }

    return new Observable<MessageEvent>((sub) => {
      let cancelled = false;

      (async () => {
        const reqId = (requestId ?? '').trim() || undefined;

        // If a fallback non-stream request already completed, avoid re-streaming and just return "done".
        if (reqId) {
          const existing = await this.chatRepo.findByRequestId({
            articleId,
            role: 'ASSISTANT',
            requestId: reqId,
          });
          if (existing) {
            sub.next({ data: { type: 'done', messageId: existing.id } });
            sub.complete();
            return;
          }
        }

        await this.chatRepo.createMessage({
          articleId,
          role: 'USER',
          content: userMessage,
          requestId: reqId,
        });

        const article = await this.prisma.article.findUnique({
          where: { id: articleId },
          include: { fake: true },
        });
        if (!article) {
          sub.next({ data: { type: 'error', message: 'Article not found' } });
          sub.complete();
          return;
        }

        const history = await this.chatRepo.listLastN(articleId, 10);
        const messages = [
          { role: 'system' as const, content: buildSystemPrompt(article) },
          ...history.map((m) => ({
            role:
              m.role === 'USER' ? ('user' as const) : ('assistant' as const),
            content: m.content,
          })),
          { role: 'user' as const, content: userMessage },
        ];

        let full = '';
        for await (const delta of this.llm.streamChat(messages)) {
          if (cancelled) return;
          full += delta;
          sub.next({ data: { type: 'delta', delta } });
        }

        if (cancelled) return;
        const saved = await this.chatRepo.createMessage({
          articleId,
          role: 'ASSISTANT',
          content: full.trim(),
          requestId: reqId,
        });
        sub.next({ data: { type: 'done', messageId: saved.id } });
        sub.complete();
      })().catch((e) => {
        const msg = getErrorMessage(e);
        const status = getErrorStatus(e);
        if (status === 429) {
          sub.next({
            data: {
              type: 'rate_limit',
              message: msg,
              retryAfterMs: parseRetryAfterMs(msg) ?? null,
            },
          });
        } else {
          sub.next({ data: { type: 'error', message: msg } });
        }
        sub.complete();
      });

      return () => {
        cancelled = true;
      };
    });
  }
}
