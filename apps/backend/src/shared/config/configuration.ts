import Joi from 'joi';

export type AppConfig = {
  PORT: number;
  NODE_ENV: 'development' | 'test' | 'production';
  DATABASE_URL: string;
  REDIS_URL: string;
  OPENAI_API_KEY: string;
  OPENAI_BASE_URL?: string;
  OPENAI_MODEL: string;
  SCRAPE_CRON?: string;
};

export const envSchema = Joi.object<AppConfig>({
  PORT: Joi.number().default(3001),
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  DATABASE_URL: Joi.string().uri().required(),
  REDIS_URL: Joi.string().uri().required(),
  OPENAI_API_KEY: Joi.string().min(1).required(),
  OPENAI_BASE_URL: Joi.string().uri().optional().empty(''),
  OPENAI_MODEL: Joi.string().default('gpt-5.4-nano'),
  SCRAPE_CRON: Joi.string().optional().empty(''),
});
