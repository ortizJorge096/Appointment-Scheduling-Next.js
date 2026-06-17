-- AlterEnum
-- Adds the SCHEDULE value to AuditEntity so schedule/blocked-date changes can be audited.
-- Safe on PostgreSQL 12+ (the new value is only ADDED here, not used in the same transaction).
ALTER TYPE "AuditEntity" ADD VALUE 'SCHEDULE';
