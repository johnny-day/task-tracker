-- AlterTable
ALTER TABLE "Task" ADD COLUMN "repeatDaily" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Task" ADD COLUMN "lastCompletedLocalDate" TEXT;

UPDATE "Task" SET category = 'misc' WHERE category = 'general';

ALTER TABLE "Task" ALTER COLUMN "category" SET DEFAULT 'misc';
