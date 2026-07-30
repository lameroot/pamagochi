-- CreateTable
CREATE TABLE "intro_progress" (
    "childId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'SHIP_DARK',
    "sharedEventsJson" JSONB NOT NULL DEFAULT '[]',
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intro_progress_pkey" PRIMARY KEY ("childId")
);

-- AddForeignKey
ALTER TABLE "intro_progress" ADD CONSTRAINT "intro_progress_childId_fkey" FOREIGN KEY ("childId") REFERENCES "child_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
