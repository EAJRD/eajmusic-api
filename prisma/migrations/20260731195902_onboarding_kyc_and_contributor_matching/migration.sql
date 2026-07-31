-- CreateEnum
CREATE TYPE "MatchRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "ContributorRole" ADD VALUE 'CO_PRODUCER';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "date_of_birth" DATE,
ADD COLUMN     "id_document_key" TEXT,
ADD COLUMN     "id_document_url" TEXT,
ADD COLUMN     "onboarding_completed_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "contributor_match_requests" (
    "id" TEXT NOT NULL,
    "contributor_name" TEXT NOT NULL,
    "matched_user_id" TEXT NOT NULL,
    "track_ids" TEXT[],
    "status" "MatchRequestStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "resolved_by" TEXT,

    CONSTRAINT "contributor_match_requests_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "contributor_match_requests" ADD CONSTRAINT "contributor_match_requests_matched_user_id_fkey" FOREIGN KEY ("matched_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
