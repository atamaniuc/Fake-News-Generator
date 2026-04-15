'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useChatHistory } from '../model/use-chat-history';
import { useSendMessage } from '../model/use-send-message';
import { useSSE } from 'use-next-sse';
import type { ChatMessage } from '@fakenews/shared';

type StreamEvent =
  | { type: 'delta'; delta: string }
  | { type: 'done'; messageId: string }
  | { type: 'rate_limit'; message: string; retryAfterMs: number | null }
  | { type: 'error'; message: string };

export function ChatPanel({ articleId }: { articleId: string }) {
  const history = useChatHistory(articleId);
  const send = useSendMessage(articleId);
  const [text, setText] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [assistantDraft, setAssistantDraft] = useState('');
  const [streamUrl, setStreamUrl] = useState('');
  const [streamError, setStreamError] = useState<string | null>(null);
  const finishedRef = useRef(false);
  const streamingRef = useRef(false);
  const pendingErrorTimerRef = useRef<number | null>(null);
  const assistantDraftRef = useRef('');
  const lastSentMessageRef = useRef<string | null>(null);
  const lastRequestIdRef = useRef<string | null>(null);

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  const encoded = useMemo(() => encodeURIComponent(text.trim()), [text]);

  const sse = useSSE<StreamEvent>({
    url: streamUrl,
    eventName: 'message',
    reconnect: false,
  });

  useEffect(() => {
    streamingRef.current = streaming;
  }, [streaming]);

  useEffect(() => {
    assistantDraftRef.current = assistantDraft;
  }, [assistantDraft]);

  useEffect(() => {
    const ev = sse.data;
    if (!ev) return;
    if (ev.type === 'delta') {
      setAssistantDraft((d) => d + ev.delta);
      return;
    }
    if (ev.type === 'done') {
      finishedRef.current = true;
      if (pendingErrorTimerRef.current) {
        window.clearTimeout(pendingErrorTimerRef.current);
        pendingErrorTimerRef.current = null;
      }
      setStreaming(false);
      setStreamError(null);
      sse.close();
      setStreamUrl('');
      setAssistantDraft('');
      lastSentMessageRef.current = null;
      lastRequestIdRef.current = null;
      history.refetch();
      return;
    }
    if (ev.type === 'rate_limit') {
      finishedRef.current = true;
      if (pendingErrorTimerRef.current) {
        window.clearTimeout(pendingErrorTimerRef.current);
        pendingErrorTimerRef.current = null;
      }
      setStreaming(false);
      setStreamError(
        ev.retryAfterMs
          ? `Rate limited. Try again in ~${Math.ceil(ev.retryAfterMs / 1000)}s.`
          : 'Rate limited. Try again shortly.',
      );
      sse.close();
      setStreamUrl('');
      lastSentMessageRef.current = null;
      lastRequestIdRef.current = null;
      return;
    }
    if (ev.type === 'error') {
      finishedRef.current = true;
      if (pendingErrorTimerRef.current) {
        window.clearTimeout(pendingErrorTimerRef.current);
        pendingErrorTimerRef.current = null;
      }
      setStreaming(false);
      setStreamError(ev.message || 'Stream error');
      sse.close();
      setStreamUrl('');
      lastSentMessageRef.current = null;
      lastRequestIdRef.current = null;
    }
  }, [sse.data]);

  useEffect(() => {
    // use-next-sse treats *any* close as an error event. When the backend finishes a stream, EventSource
    // often emits an `error` immediately after the final `done` message. Debounce to avoid false errors.
    if (!sse.error) return;
    if (!streamingRef.current) return;
    if (finishedRef.current) return;

    if (pendingErrorTimerRef.current) {
      window.clearTimeout(pendingErrorTimerRef.current);
      pendingErrorTimerRef.current = null;
    }

    pendingErrorTimerRef.current = window.setTimeout(() => {
      pendingErrorTimerRef.current = null;
      if (!streamingRef.current) return;
      if (finishedRef.current) return;

      const errMsg = sse.error?.message ?? 'Stream error';
      const hadAnyDelta = assistantDraftRef.current.length > 0;

      // If the stream dropped before we got any deltas, automatically fall back to non-stream endpoint.
      // Thanks to requestId dedupe, this won't create duplicates even if the server already persisted the USER message.
      if (!hadAnyDelta && lastSentMessageRef.current && lastRequestIdRef.current) {
        const message = lastSentMessageRef.current;
        const requestId = lastRequestIdRef.current;
        setStreaming(false);
        setStreamError(null);
        setStreamUrl('');
        sse.close();
        send
          .mutateAsync({ message, requestId })
          .then(() => {
            history.refetch();
          })
          .catch((e) => {
            setStreamError(String((e as any)?.message ?? errMsg));
          })
          .finally(() => {
            lastSentMessageRef.current = null;
            lastRequestIdRef.current = null;
          });
        return;
      }

      // Otherwise, we show a friendly error (and keep any partial draft visible).
      setStreaming(false);
      setStreamError(
        hadAnyDelta ? 'Stream disconnected before finishing. Partial response shown.' : errMsg,
      );
      setStreamUrl('');
      sse.close();
    }, 250);

    return () => {
      if (pendingErrorTimerRef.current) {
        window.clearTimeout(pendingErrorTimerRef.current);
        pendingErrorTimerRef.current = null;
      }
    };
  }, [sse.error, streaming]);

  const messages: ChatMessage[] = history.data ?? [];

  return (
    <div className="rounded-lg border bg-white">
      <div className="border-b px-4 py-3">
        <div className="text-sm font-medium">Chat</div>
        <div className="mt-1 text-xs text-zinc-600">
          Try: “Summarize this article with one sentence”, “Key entities?”, “How was it changed?”
        </div>
      </div>

      <div className="max-h-[420px] overflow-auto px-4 py-3">
        {history.isLoading && <div className="text-sm text-zinc-600">Loading chat…</div>}
        {history.isError && <div className="text-sm text-red-600">Failed to load chat.</div>}

        <div className="flex flex-col gap-2">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-[90%] rounded-md px-3 py-2 text-sm ${
                m.role === 'USER' ? 'ml-auto bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-900'
              }`}
            >
              {m.content}
            </div>
          ))}

          {streaming && assistantDraft && (
            <div className="max-w-[90%] rounded-md bg-zinc-100 px-3 py-2 text-sm text-zinc-900">
              {assistantDraft}
            </div>
          )}
        </div>
      </div>

      <div className="border-t p-3">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const msg = text.trim();
            if (!msg) return;

            // Prefer SSE streaming; fallback to non-stream if no API base.
            finishedRef.current = false;
            setStreaming(true);
            setAssistantDraft('');
            setStreamError(null);
            const requestId = crypto.randomUUID();
            lastSentMessageRef.current = msg;
            lastRequestIdRef.current = requestId;
            setStreamUrl(
              `${apiBase}/api/articles/${articleId}/chat/stream?message=${encoded}&requestId=${encodeURIComponent(
                requestId,
              )}`,
            );
            setText('');
            // Optimistic: also persist non-streaming user msg if the stream fails; we rely on backend persisting.
            // If SSE fails entirely (e.g. EventSource blocked), user can refresh and use the non-stream endpoint.
          }}
        >
          <input
            className="flex-1 rounded-md border px-3 py-2 text-sm"
            placeholder="Ask something…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={send.isPending || streaming}
          />
          <button
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            disabled={send.isPending || streaming}
            type="submit"
          >
            Send
          </button>
        </form>
        {streamError && (
          <div className="mt-2 text-xs text-red-600">Stream error: {streamError}</div>
        )}
      </div>
    </div>
  );
}
