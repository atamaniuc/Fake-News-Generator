-- Add optional requestId for idempotency across SSE vs non-stream fallbacks.
ALTER TABLE "chat_messages" ADD COLUMN "requestId" TEXT;

-- Dedupe per article/request/role. Postgres UNIQUE allows multiple NULLs, so legacy rows are unaffected.
CREATE UNIQUE INDEX "chat_messages_articleId_requestId_role_key"
  ON "chat_messages"("articleId", "requestId", "role");

