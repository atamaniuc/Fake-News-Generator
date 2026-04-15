import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { OPENAI_TOKENS } from './openai.tokens';

@Global()
@Module({
  providers: [
    {
      provide: OPENAI_TOKENS.client,
      useFactory: (config: ConfigService) => {
        const logger = new Logger(OpenAiModule.name);
        const apiKey = config.get<string>('OPENAI_API_KEY', { infer: true });
        if (!apiKey) throw new Error('OPENAI_API_KEY is required');
        const configuredBaseURL = (
          config.get<string>('OPENAI_BASE_URL', { infer: true }) ?? ''
        ).trim();
        let baseURL = configuredBaseURL;

        // If you pass a Groq key (gsk_*), you almost certainly want Groq's OpenAI-compatible base URL.
        // Defaulting here prevents "Incorrect API key provided" from the OpenAI endpoint.
        if (apiKey.startsWith('gsk_') && !baseURL) {
          baseURL = 'https://api.groq.com/openai/v1';
          logger.warn(
            `Detected Groq key (gsk_*). Defaulting OPENAI_BASE_URL to ${baseURL}`,
          );
        }

        return new OpenAI({ apiKey, baseURL: baseURL || undefined });
      },
      inject: [ConfigService],
    },
  ],
  exports: [OPENAI_TOKENS.client],
})
export class OpenAiModule {}
