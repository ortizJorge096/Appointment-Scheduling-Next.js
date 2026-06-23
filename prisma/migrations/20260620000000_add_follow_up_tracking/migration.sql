-- AddColumn: tracks whether the post-appointment follow-up ("¿cómo te fue?")
-- email was already sent, so the daily cron doesn't double-send.
ALTER TABLE "appointments" ADD COLUMN "followUpSentAt" TIMESTAMP(3);
