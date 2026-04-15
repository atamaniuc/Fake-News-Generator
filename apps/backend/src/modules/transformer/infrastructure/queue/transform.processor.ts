import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import { parseRetryAfterMs, truncate } from '../../../../shared/utils/text';
import {
  getErrorMessage,
  getErrorStatus,
  isRecord,
} from '../../../../shared/utils/errors';

type TransformJob = {
  articleId: string;
};

// BullMQ sandboxed processors run in a separate process and cannot use Nest DI.
const prisma = new PrismaClient();

function log(msg: string) {
  const ts = new Date().toISOString();
  console.log(`[transform.processor] ${ts} ${msg}`);
}

function getEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required`);
  return v;
}

function resolveBaseUrl(apiKey: string): string | undefined {
  const configured = (process.env.OPENAI_BASE_URL ?? '').trim();
  if (configured) return configured;
  if (apiKey.startsWith('gsk_')) return 'https://api.groq.com/openai/v1';
  return undefined;
}

const apiKey = getEnv('OPENAI_API_KEY');

const openai = new OpenAI({
  apiKey,
  baseURL: resolveBaseUrl(apiKey),
});

const model = process.env.OPENAI_MODEL || 'gpt-5.4-nano';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseFakeOutput(text: string): {
  fakeTitle: string;
  fakeContent: string;
} {
  const t = String(text ?? '').trim();
  const titleIdx = t.toUpperCase().indexOf('TITLE:');
  const contentIdx = t.toUpperCase().indexOf('CONTENT:');

  if (titleIdx >= 0 && contentIdx >= 0 && contentIdx > titleIdx) {
    const fakeTitle = t.slice(titleIdx + 'TITLE:'.length, contentIdx).trim();
    const fakeContent = t.slice(contentIdx + 'CONTENT:'.length).trim();
    return { fakeTitle, fakeContent };
  }

  // Fallback: first non-empty line as title, rest as content.
  const lines = t
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const fakeTitle = lines[0] ?? '';
  const fakeContent = lines.slice(1).join('\n').trim();
  return { fakeTitle, fakeContent };
}

export default async function transformProcessor(job: {
  id?: string | number;
  data: TransformJob;
}) {
  const { articleId } = job.data;
  const baseURL = resolveBaseUrl(apiKey) ?? '(default)';
  log(
    `start jobId=${String(job.id ?? '?')} articleId=${articleId} model=${model} baseURL=${baseURL}`,
  );

  const article = await prisma.article.findUnique({
    where: { id: articleId },
    include: { fake: true, source: true },
  });
  if (!article) {
    log(`skip jobId=${String(job.id ?? '?')} reason=article_not_found`);
    return;
  }

  if (article.fake) {
    // already transformed
    log(`skip jobId=${String(job.id ?? '?')} reason=already_transformed`);
    return;
  }

  await prisma.article.update({
    where: { id: articleId },
    data: { status: 'TRANSFORMING', errorMessage: null },
  });
  log(`status jobId=${String(job.id ?? '?')} status=TRANSFORMING`);

  const originalTitle = truncate(article.title, 300);
  const originalDescription = truncate(article.description, 1200);
  const prompt =
    `Transform the following news article into a humorous, absurd version.\n` +
    `Keep it recognizable but make it funny and exaggerated.\n` +
    `Return EXACTLY this format:\n` +
    `TITLE: <fake title>\n` +
    `CONTENT: <fake content>\n\n` +
    `Original title: ${originalTitle}\n` +
    `Original description: ${originalDescription}\n`;

  try {
    let res: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        res = await openai.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: 'You write satirical fake news.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.9, // play around with temperature for enhancing the level of jokes
          max_completion_tokens: 700,
        });
        break;
      } catch (e: unknown) {
        const status = getErrorStatus(e);
        const msg = getErrorMessage(e);
        if (status === 429 && attempt === 0) {
          const wait = parseRetryAfterMs(msg) ?? 12_000;
          log(`rate_limit jobId=${String(job.id ?? '?')} waitingMs=${wait}`);
          await sleep(wait);
          continue;
        }
        throw e;
      }
    }

    let content = '';
    if (
      isRecord(res) &&
      Array.isArray(res.choices) &&
      res.choices[0] &&
      isRecord(res.choices[0])
    ) {
      const msg = res.choices[0].message;
      if (isRecord(msg) && typeof msg.content === 'string')
        content = msg.content;
    }
    const parsed = parseFakeOutput(content);
    const fakeTitle = String(parsed.fakeTitle ?? '').trim();
    const fakeContent = String(parsed.fakeContent ?? '').trim();

    if (!fakeTitle || !fakeContent) {
      throw new Error('LLM returned empty fake title/content');
    }

    await prisma.fakeArticle.create({
      data: {
        articleId,
        fakeTitle,
        fakeContent,
      },
    });

    await prisma.article.update({
      where: { id: articleId },
      data: { status: 'DONE', errorMessage: null },
    });
    log(
      `done jobId=${String(job.id ?? '?')} status=DONE fakeTitleLen=${fakeTitle.length} fakeContentLen=${fakeContent.length}`,
    );
  } catch (e: unknown) {
    const msg = getErrorMessage(e);
    const status = getErrorStatus(e);
    await prisma.article.update({
      where: { id: articleId },
      data: {
        status: status === 429 ? 'PENDING' : 'FAILED',
        errorMessage: msg,
      },
    });
    log(
      `fail jobId=${String(job.id ?? '?')} status=${status === 429 ? 'PENDING' : 'FAILED'} error=${msg}`,
    );
    throw e;
  }
}
