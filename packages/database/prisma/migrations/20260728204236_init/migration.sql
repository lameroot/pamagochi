-- CreateEnum
CREATE TYPE "ChildAvatarKey" AS ENUM ('fox', 'owl', 'panda', 'dragon');

-- CreateEnum
CREATE TYPE "SkillKey" AS ENUM ('counting', 'reading', 'colors', 'shapes');

-- CreateEnum
CREATE TYPE "QuestStatus" AS ENUM ('available', 'in_progress', 'completed');

-- CreateEnum
CREATE TYPE "AssetOwnerKind" AS ENUM ('parent', 'child');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('pending', 'completed');

-- CreateTable
CREATE TABLE "parent_accounts" (
    "id" TEXT NOT NULL,
    "authSubject" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parent_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "child_profiles" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarKey" "ChildAvatarKey" NOT NULL,
    "birthYear" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "child_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_progress" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "skillKey" "SkillKey" NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 0,
    "experience" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skill_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quest_progress" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "questKey" TEXT NOT NULL,
    "status" "QuestStatus" NOT NULL DEFAULT 'available',
    "score" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quest_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stored_assets" (
    "id" TEXT NOT NULL,
    "ownerKind" "AssetOwnerKind" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "status" "AssetStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stored_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "parent_accounts_authSubject_key" ON "parent_accounts"("authSubject");

-- CreateIndex
CREATE INDEX "child_profiles_parentId_idx" ON "child_profiles"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "skill_progress_childId_skillKey_key" ON "skill_progress"("childId", "skillKey");

-- CreateIndex
CREATE UNIQUE INDEX "quest_progress_childId_questKey_key" ON "quest_progress"("childId", "questKey");

-- CreateIndex
CREATE UNIQUE INDEX "stored_assets_key_key" ON "stored_assets"("key");

-- CreateIndex
CREATE INDEX "stored_assets_ownerKind_ownerId_idx" ON "stored_assets"("ownerKind", "ownerId");

-- AddForeignKey
ALTER TABLE "child_profiles" ADD CONSTRAINT "child_profiles_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "parent_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_progress" ADD CONSTRAINT "skill_progress_childId_fkey" FOREIGN KEY ("childId") REFERENCES "child_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quest_progress" ADD CONSTRAINT "quest_progress_childId_fkey" FOREIGN KEY ("childId") REFERENCES "child_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
