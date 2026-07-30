-- AlterTable
ALTER TABLE "intro_progress" ADD COLUMN IF NOT EXISTS "lastIdempotencyKey" TEXT;
