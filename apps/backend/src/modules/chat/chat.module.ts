import { Module } from '@nestjs/common';
import { ChatController } from './presentation/http/chat.controller';
import { CHAT_TOKENS } from './chat.tokens';
import { PrismaChatMessageRepository } from './infrastructure/persistence/prisma-chat-message.repository';
import { OpenAiChatAdapter } from './infrastructure/llm/openai-chat.adapter';
import { GetChatHistoryUseCase } from './application/use-cases/get-chat-history.use-case';
import { SendMessageUseCase } from './application/use-cases/send-message.use-case';

@Module({
  controllers: [ChatController],
  providers: [
    PrismaChatMessageRepository,
    OpenAiChatAdapter,
    GetChatHistoryUseCase,
    SendMessageUseCase,
    {
      provide: CHAT_TOKENS.chatRepository,
      useExisting: PrismaChatMessageRepository,
    },
    { provide: CHAT_TOKENS.llmProvider, useExisting: OpenAiChatAdapter },
  ],
})
export class ChatModule {}
