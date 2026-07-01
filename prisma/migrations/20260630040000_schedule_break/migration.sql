-- Optional lunch break per weekday (e.g. 12:00–14:00). Slots overlapping it are
-- not offered by the availability engine. Both null = continuous day.
ALTER TABLE "schedules" ADD COLUMN "breakStart" TEXT;
ALTER TABLE "schedules" ADD COLUMN "breakEnd"   TEXT;
