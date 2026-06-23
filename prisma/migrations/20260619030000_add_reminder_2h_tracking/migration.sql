-- AddColumn: tracks whether the 2h-before reminder was already sent
-- for a given appointment, so the more-frequent cron doesn't double-send.
ALTER TABLE "appointments" ADD COLUMN "reminder2hSentAt" TIMESTAMP(3);
