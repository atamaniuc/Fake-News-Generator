import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { OPENAI_TOKENS } from '../../../../shared/llm/openai.tokens';
import {
  getErrorMessage,
  getErrorStatus,
  isRecord,
} from '../../../../shared/utils/errors';
import { parseRetryAfterMs } from '../../../../shared/utils/text';
import type { LlmChatMessage, LlmPort } from '../../domain/ports/llm.port';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

@Injectable()
export class OpenAiChatAdapter implements LlmPort {
  private readonly model: string;

  constructor(
    @Inject(OPENAI_TOKENS.client) private readonly client: OpenAI,
    config: ConfigService,
  ) {
    this.model =
      config.get<string>('OPENAI_MODEL', { infer: true }) ?? 'gpt-5.4-nano';
  }

  /**
   * Generates a completion for a chat conversation based on the provided messages.
   * Implements a retry mechanism to handle rate limits from the chat completion provider.
   *
   * @param {LlmChatMessage[]} messages - An array of chat messages representing the conversation history.
   * @return {Promise<string>} A promise that resolves to the generated chat completion as a string.
   *                           Returns an empty string if no completion is available or an error occurs.
   */
  async completeChat(messages: LlmChatMessage[]): Promise<string> {
    // Light retry for rate limits (common with Groq/OpenAI-compatible providers).
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const res = await this.client.chat.completions.create({
          model: this.model,
          messages,
          temperature: 0.4,
          max_completion_tokens: 400,
        });
        return res.choices[0]?.message?.content?.trim() ?? '';
      } catch (e: unknown) {
        const status = getErrorStatus(e);
        const msg = getErrorMessage(e);
        if (status === 429 && attempt === 0) {
          const wait = parseRetryAfterMs(msg) ?? 12_000;
          await sleep(wait);
          continue;
        }
        throw e;
      }
    }
    return '';
  }

  /**
   * Streams chat responses from an LLM (Language Model) based on the provided messages.
   * Implemented retry logic for the rate-limiting errors (HTTP 429).
   * Using a generator to yield streaming responses.
   *
   * @param {LlmChatMessage[]} messages - An array of messages to provide as input to the LLM chat model.
   * Each message should conform to the LlmChatMessage structure.
   * @return {AsyncIterable<string>} An asynchronous iterable that yields chunks of streamed chat content response as strings.
   */
  async *streamChat(messages: LlmChatMessage[]): AsyncIterable<string> {
    // If we hit 429 before the stream starts, retry once after waiting.
    let stream: AsyncIterable<unknown> | null = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        stream = (await this.client.chat.completions.create({
          model: this.model,
          messages,
          temperature: 0.4,
          max_completion_tokens: 400,
          stream: true,
        })) as unknown as AsyncIterable<unknown>;
        break;
      } catch (e: unknown) {
        const status = getErrorStatus(e);
        const msg = getErrorMessage(e);
        if (status === 429 && attempt === 0) {
          const wait = parseRetryAfterMs(msg) ?? 12_000;
          await sleep(wait);
          continue;
        }
        throw e;
      }
    }

    if (!stream) return;
    for await (const chunk of stream) {
      // Keep parsing permissive: OpenAI-compatible providers differ slightly.
      if (!isRecord(chunk)) continue;
      const choices = chunk.choices;
      if (!Array.isArray(choices) || !choices[0] || !isRecord(choices[0]))
        continue;
      const delta = choices[0].delta;
      if (!isRecord(delta)) continue;
      const content = delta.content;
      if (typeof content === 'string' && content.length > 0) yield content;
    }
  }
}
