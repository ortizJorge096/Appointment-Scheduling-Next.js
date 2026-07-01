-- Adds the EXPORT audit action so downloads/exports of the audit log itself
-- can be recorded (who exfiltrated the trace is a security-relevant event).
ALTER TYPE "AuditAction" ADD VALUE 'EXPORT';
