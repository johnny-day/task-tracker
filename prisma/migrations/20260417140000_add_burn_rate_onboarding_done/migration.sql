-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "burnRateOnboardingDone" BOOLEAN NOT NULL DEFAULT false;

-- Existing rows: do not show first-run burn-rate prompt after upgrade
UPDATE "Settings" SET "burnRateOnboardingDone" = true;
