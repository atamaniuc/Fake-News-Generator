'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useArticles } from '../model/use-articles';
import { useScrape } from '../model/use-scrape';
import { useSourcesSummary } from '../model/use-sources-summary';
import { useFilterStore } from '../../../shared/store/filter.store';

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString();
}

export function NewsFeedPage() {
  const { selectedSource, setSource } = useFilterStore();
  const [page, setPage] = useState(1);
  const limit = 10;

  const query = useArticles({ source: selectedSource, page, limit });
  const scrape = useScrape();
  const sourcesSummary = useSourcesSummary();
  const hasAnyDone = (sourcesSummary.data?.total ?? 0) > 0;

  const totalPages = useMemo(() => {
    if (!query.data) return 1;
    return Math.max(1, Math.ceil(query.data.total / query.data.limit));
  }, [query.data]);

  return (
    <div className="min-h-full bg-zinc-50 text-zinc-900">
      <div className="mx-auto w-full max-w-5xl px-4 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Fake News Generator</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Scrape real RSS, transform via LLM, and chat per article.
            </p>
          </div>
          <button
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            onClick={() => scrape.mutate()}
            disabled={scrape.isPending}
          >
            {scrape.isPending ? 'Scraping…' : 'Scrape News'}
          </button>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="text-sm text-zinc-600">Source:</span>
          {sourcesSummary.data?.sources.map((s) => (
            <button
              key={s.id}
              className={`rounded-md border px-3 py-1 text-sm ${
                selectedSource === s.name
                  ? 'border-zinc-900 bg-white'
                  : 'border-zinc-200 bg-white'
              }`}
              onClick={() => {
                setPage(1);
                setSource(selectedSource === s.name ? null : s.name);
              }}
            >
              {s.name} ({s.count})
            </button>
          ))}
          <button
            className="ml-2 text-sm text-zinc-700 underline underline-offset-4"
            onClick={() => {
              setPage(1);
              setSource(null);
            }}
          >
            Clear
          </button>
        </div>

        <div className="mt-2 text-sm text-zinc-600">
          Total News: {sourcesSummary.data?.total ?? 0}
        </div>

        <div className="mt-6">
          {query.isLoading && <div className="text-sm text-zinc-600">Loading…</div>}
          {query.isError && (
            <div className="text-sm text-red-600">Failed to load articles.</div>
          )}

          {query.data && query.data.data.length === 0 && (
            <div className="rounded-lg border border-dashed bg-white p-6 text-sm text-zinc-600">
              {hasAnyDone
                ? 'Loading latest transformed articles…'
                : 'No transformed articles yet. Click “Scrape News”, then wait for background transforms to finish.'}
            </div>
          )}

          {/*TODO: Add a pretty preloader here for the refreshing state*/}
          {query.isFetching && !query.isLoading && (
            <div className="mb-3 text-xs text-zinc-500">Refreshing…</div>
          )}

          <div className="grid grid-cols-1 gap-3">
            {query.data?.data.map((a) => (
              <Link
                key={a.id}
                href={`/article/${a.id}`}
                className="rounded-lg border bg-white p-4 hover:border-zinc-400"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="text-sm font-medium">
                    {a.fake?.fakeTitle ?? a.title}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {a.source.name} · {formatDate(a.publishedAt)}
                  </div>
                </div>
                <div className="mt-2 text-sm text-zinc-600">
                  {a.fake?.fakeContent?.slice(0, 160) ?? a.description.slice(0, 160)}
                  {(a.fake?.fakeContent?.length ?? a.description.length) > 160 ? '…' : ''}
                </div>
              </Link>
            ))}
          </div>

          {query.data && totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <button
                className="rounded-md border bg-white px-3 py-1 text-sm disabled:opacity-50"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Prev
              </button>
              <div className="text-sm text-zinc-600">
                Page {page} / {totalPages}
              </div>
              <button
                className="rounded-md border bg-white px-3 py-1 text-sm disabled:opacity-50"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
