-- CreateEnum
CREATE TYPE "GameSessionStatus" AS ENUM ('pending', 'active', 'expired', 'revoked', 'completed');

-- CreateEnum
CREATE TYPE "ConversationSessionStatus" AS ENUM ('active', 'finalizing', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "ConversationSpeaker" AS ENUM ('child', 'agent', 'system_event');

-- CreateEnum
CREATE TYPE "ToolValidationResult" AS ENUM ('accepted', 'rejected_schema', 'rejected_allowlist', 'rejected_state', 'rejected_ownership', 'rejected_rate_limit', 'rejected_timeout', 'rejected_unknown_tool');

-- CreateEnum
CREATE TYPE "MemoryCategory" AS ENUM ('interest', 'preference', 'achievement', 'relationship_event', 'favorite_game_object', 'learning_preference', 'parent_note');

-- CreateEnum
CREATE TYPE "MemoryItemStatus" AS ENUM ('active', 'disabled', 'deleted');

-- CreateEnum
CREATE TYPE "MemorySource" AS ENUM ('automatic', 'parent');

-- CreateEnum
CREATE TYPE "MemoryChangedBy" AS ENUM ('system', 'parent');

-- CreateEnum
CREATE TYPE "RelationshipStage" AS ENUM ('first_meeting', 'acquainted', 'friends', 'close_friends');

-- CreateEnum
CREATE TYPE "SafetySeverity" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "SafetyCategory" AS ENUM ('prompt_injection', 'prompt_extraction', 'tool_escalation', 'memory_poisoning', 'pii', 'harmful_content', 'external_contact', 'secrecy_from_parents', 'cost_exhaustion', 'output_policy', 'other');

-- CreateEnum
CREATE TYPE "PromptVersionKind" AS ENUM ('soul', 'safety', 'runtime_template');

-- CreateEnum
CREATE TYPE "PromptVersionStatus" AS ENUM ('draft', 'active', 'retired');

-- AlterTable
ALTER TABLE "child_profiles" ADD COLUMN     "birthDate" TIMESTAMP(3),
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "mathLevel" TEXT,
ADD COLUMN     "primaryLanguage" TEXT NOT NULL DEFAULT 'ru',
ADD COLUMN     "readingLevel" TEXT;

-- CreateTable
CREATE TABLE "game_sessions" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "deviceId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "status" "GameSessionStatus" NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdByParentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_sessions" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "gameSessionId" TEXT NOT NULL,
    "livekitRoomId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "status" "ConversationSessionStatus" NOT NULL DEFAULT 'active',
    "soulVersion" TEXT,
    "safetyPolicyVersion" TEXT,
    "llmProvider" TEXT,
    "llmModel" TEXT,
    "sttProvider" TEXT,
    "ttsProvider" TEXT,
    "sessionSummary" TEXT,
    "safetyLevel" TEXT,
    "costInputTokens" INTEGER NOT NULL DEFAULT 0,
    "costOutputTokens" INTEGER NOT NULL DEFAULT 0,
    "costTtsChars" INTEGER NOT NULL DEFAULT 0,
    "costSttSeconds" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "conversation_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_turns" (
    "id" TEXT NOT NULL,
    "conversationSessionId" TEXT NOT NULL,
    "sequenceNo" INTEGER NOT NULL,
    "speaker" "ConversationSpeaker" NOT NULL,
    "text" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "wasInterrupted" BOOLEAN NOT NULL DEFAULT false,
    "playedTextLength" INTEGER,
    "safetyFlags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadataJson" JSONB NOT NULL DEFAULT '{}',
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_turns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_tool_calls" (
    "id" TEXT NOT NULL,
    "conversationSessionId" TEXT NOT NULL,
    "turnId" TEXT,
    "toolName" TEXT NOT NULL,
    "argumentsJson" JSONB NOT NULL,
    "validationResult" "ToolValidationResult" NOT NULL,
    "resultJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_tool_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_items" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "category" "MemoryCategory" NOT NULL,
    "fact" TEXT NOT NULL,
    "status" "MemoryItemStatus" NOT NULL DEFAULT 'active',
    "source" "MemorySource" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "sourceSessionId" TEXT,
    "sourceTurnIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reviewAfter" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "memory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_versions" (
    "id" TEXT NOT NULL,
    "memoryItemId" TEXT NOT NULL,
    "previousFact" TEXT,
    "newFact" TEXT NOT NULL,
    "changedBy" "MemoryChangedBy" NOT NULL,
    "changedByUserId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memory_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relationship_state" (
    "childId" TEXT NOT NULL,
    "stage" "RelationshipStage" NOT NULL DEFAULT 'first_meeting',
    "trustProgress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sharedEventsJson" JSONB NOT NULL DEFAULT '[]',
    "lastSessionAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "relationship_state_pkey" PRIMARY KEY ("childId")
);

-- CreateTable
CREATE TABLE "safety_events" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "conversationSessionId" TEXT,
    "turnId" TEXT,
    "category" "SafetyCategory" NOT NULL,
    "severity" "SafetySeverity" NOT NULL,
    "detectedBy" TEXT NOT NULL,
    "inputExcerpt" TEXT,
    "actionTaken" TEXT NOT NULL,
    "parentVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "safety_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "privacy_consents" (
    "id" TEXT NOT NULL,
    "parentUserId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "consentType" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "metadataJson" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "privacy_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_prompt_versions" (
    "id" TEXT NOT NULL,
    "kind" "PromptVersionKind" NOT NULL,
    "semanticVersion" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "status" "PromptVersionStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "releaseNotes" TEXT,

    CONSTRAINT "agent_prompt_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "game_sessions_tokenHash_key" ON "game_sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "game_sessions_childId_status_idx" ON "game_sessions"("childId", "status");

-- CreateIndex
CREATE INDEX "game_sessions_createdByParentId_idx" ON "game_sessions"("createdByParentId");

-- CreateIndex
CREATE INDEX "conversation_sessions_childId_startedAt_idx" ON "conversation_sessions"("childId", "startedAt");

-- CreateIndex
CREATE INDEX "conversation_sessions_gameSessionId_idx" ON "conversation_sessions"("gameSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_turns_conversationSessionId_sequenceNo_key" ON "conversation_turns"("conversationSessionId", "sequenceNo");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_turns_conversationSessionId_idempotencyKey_key" ON "conversation_turns"("conversationSessionId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "agent_tool_calls_conversationSessionId_createdAt_idx" ON "agent_tool_calls"("conversationSessionId", "createdAt");

-- CreateIndex
CREATE INDEX "memory_items_childId_status_idx" ON "memory_items"("childId", "status");

-- CreateIndex
CREATE INDEX "memory_items_childId_pinned_idx" ON "memory_items"("childId", "pinned");

-- CreateIndex
CREATE INDEX "memory_versions_memoryItemId_createdAt_idx" ON "memory_versions"("memoryItemId", "createdAt");

-- CreateIndex
CREATE INDEX "safety_events_childId_createdAt_idx" ON "safety_events"("childId", "createdAt");

-- CreateIndex
CREATE INDEX "privacy_consents_childId_consentType_idx" ON "privacy_consents"("childId", "consentType");

-- CreateIndex
CREATE INDEX "privacy_consents_parentUserId_idx" ON "privacy_consents"("parentUserId");

-- CreateIndex
CREATE INDEX "agent_prompt_versions_kind_status_idx" ON "agent_prompt_versions"("kind", "status");

-- CreateIndex
CREATE UNIQUE INDEX "agent_prompt_versions_kind_semanticVersion_key" ON "agent_prompt_versions"("kind", "semanticVersion");

-- CreateIndex
CREATE INDEX "child_profiles_deletedAt_idx" ON "child_profiles"("deletedAt");

-- AddForeignKey
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_childId_fkey" FOREIGN KEY ("childId") REFERENCES "child_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_createdByParentId_fkey" FOREIGN KEY ("createdByParentId") REFERENCES "parent_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_sessions" ADD CONSTRAINT "conversation_sessions_childId_fkey" FOREIGN KEY ("childId") REFERENCES "child_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_sessions" ADD CONSTRAINT "conversation_sessions_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "game_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_turns" ADD CONSTRAINT "conversation_turns_conversationSessionId_fkey" FOREIGN KEY ("conversationSessionId") REFERENCES "conversation_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_tool_calls" ADD CONSTRAINT "agent_tool_calls_conversationSessionId_fkey" FOREIGN KEY ("conversationSessionId") REFERENCES "conversation_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_tool_calls" ADD CONSTRAINT "agent_tool_calls_turnId_fkey" FOREIGN KEY ("turnId") REFERENCES "conversation_turns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_items" ADD CONSTRAINT "memory_items_childId_fkey" FOREIGN KEY ("childId") REFERENCES "child_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_items" ADD CONSTRAINT "memory_items_sourceSessionId_fkey" FOREIGN KEY ("sourceSessionId") REFERENCES "conversation_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_versions" ADD CONSTRAINT "memory_versions_memoryItemId_fkey" FOREIGN KEY ("memoryItemId") REFERENCES "memory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationship_state" ADD CONSTRAINT "relationship_state_childId_fkey" FOREIGN KEY ("childId") REFERENCES "child_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_events" ADD CONSTRAINT "safety_events_childId_fkey" FOREIGN KEY ("childId") REFERENCES "child_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_events" ADD CONSTRAINT "safety_events_conversationSessionId_fkey" FOREIGN KEY ("conversationSessionId") REFERENCES "conversation_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_events" ADD CONSTRAINT "safety_events_turnId_fkey" FOREIGN KEY ("turnId") REFERENCES "conversation_turns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "privacy_consents" ADD CONSTRAINT "privacy_consents_parentUserId_fkey" FOREIGN KEY ("parentUserId") REFERENCES "parent_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "privacy_consents" ADD CONSTRAINT "privacy_consents_childId_fkey" FOREIGN KEY ("childId") REFERENCES "child_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_prompt_versions" ADD CONSTRAINT "agent_prompt_versions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "parent_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
