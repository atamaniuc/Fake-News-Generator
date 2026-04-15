'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useArticle } from '../model/use-article';
import { ChatPanel } from '../../chat/ui/ChatPanel';
import { stripHtmlToText } from '@/shared/lib/strip-html';

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString();
}

export function ArticleDetailPage({ articleId }: { articleId: string }) {
  const q = useArticle(articleId);
  const [showOriginal, setShowOriginal] = useState(false);

  if (q.isLoading) {
    return <div className="p-6 text-sm text-zinc-600">Loading…</div>;
  }

  if (q.isError || !q.data) {
    return <div className="p-6 text-sm text-red-600">Failed to load article.</div>;
  }

  const a = q.data;
  const fakeTitle = a.fake?.fakeTitle ?? '(not transformed yet)';
  const fakeContent = a.fake?.fakeContent ?? '(not transformed yet)';

  return (
    <div className="min-h-full bg-zinc-50 text-zinc-900">
      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <Link href="/" className="text-sm text-zinc-700 underline underline-offset-4">
          Back
        </Link>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-lg border bg-white p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs text-zinc-500">
                  {a.source.name} · {formatDate(a.publishedAt)} · status {a.status}
                </div>
                <h1 className="mt-2 text-xl font-semibold tracking-tight">
                  {showOriginal ? a.title : fakeTitle}
                </h1>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showOriginal}
                  onChange={(e) => setShowOriginal(e.target.checked)}
                />
                Original
              </label>
            </div>

            <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-zinc-800">
              {stripHtmlToText(showOriginal ? a.description : fakeContent)}
            </div>

            <div className="mt-4 text-sm">
              <a
                href={a.originalUrl}
                target="_blank"
                rel="noreferrer"
                className="text-zinc-700 underline underline-offset-4"
              >
                Open original source
              </a>
            </div>
          </div>

          <div className="lg:col-span-1">
            <ChatPanel articleId={articleId} />
          </div>
        </div>
      </div>
    </div>
  );
}
