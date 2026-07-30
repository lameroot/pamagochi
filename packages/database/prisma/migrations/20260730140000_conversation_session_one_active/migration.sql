-- Enforce at most one active conversation session per game session.
-- Expressed as a raw partial unique index because Prisma's schema DSL
-- cannot declare filtered/partial unique constraints; see
-- packages/database/prisma/schema.prisma (ConversationSession) for the
-- accompanying comment.
CREATE UNIQUE INDEX IF NOT EXISTS "conversation_sessions_one_active_per_game_session"
  ON "conversation_sessions" ("gameSessionId")
  WHERE "status" = 'active';
