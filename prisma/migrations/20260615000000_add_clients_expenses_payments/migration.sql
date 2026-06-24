-- Migration: add_clients_expenses_payments
-- Adds: Client model, Expense model, payment fields + source + clientId to Appointment

-- ─── Nuevos enums ───────────────────────────────────────────

CREATE TYPE "AppointmentSource" AS ENUM ('ONLINE', 'WHATSAPP', 'TELEFONO', 'PRESENCIAL');
CREATE TYPE "PaymentStatus"     AS ENUM ('PENDING', 'PAID', 'PARTIAL', 'WAIVED');
CREATE TYPE "PaymentMethod"     AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'NEQUI', 'DAVIPLATA');
CREATE TYPE "ExpenseCategory"   AS ENUM ('INSUMOS', 'EQUIPOS', 'SERVICIOS', 'ARRIENDO', 'MARKETING', 'OTROS');

-- ─── Tabla clients ───────────────────────────────────────────

CREATE TABLE "clients" (
    "id"        TEXT         NOT NULL,
    "name"      TEXT         NOT NULL,
    "email"     TEXT         NOT NULL,
    "phone"     TEXT,
    "notes"     TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "clients_email_key" ON "clients"("email");
CREATE INDEX "clients_email_idx" ON "clients"("email");

-- ─── Nuevas columnas en appointments ─────────────────────────

ALTER TABLE "appointments"
    ADD COLUMN "clientId"      TEXT,
    ADD COLUMN "source"        "AppointmentSource" NOT NULL DEFAULT 'ONLINE',
    ADD COLUMN "paymentStatus" "PaymentStatus"     NOT NULL DEFAULT 'PENDING',
    ADD COLUMN "paymentMethod" "PaymentMethod",
    ADD COLUMN "amountPaid"    INTEGER;

ALTER TABLE "appointments"
    ADD CONSTRAINT "appointments_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "clients"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "appointments_clientId_idx"     ON "appointments"("clientId");
CREATE INDEX "appointments_paymentStatus_idx" ON "appointments"("paymentStatus");

-- ─── Tabla expenses ───────────────────────────────────────────

CREATE TABLE "expenses" (
    "id"          TEXT              NOT NULL,
    "description" TEXT              NOT NULL,
    "amount"      INTEGER           NOT NULL,
    "date"        TIMESTAMP(3)      NOT NULL,
    "category"    "ExpenseCategory" NOT NULL DEFAULT 'OTROS',
    "notes"       TEXT,
    "createdAt"   TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3)      NOT NULL,
    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "expenses_date_idx"     ON "expenses"("date");
CREATE INDEX "expenses_category_idx" ON "expenses"("category");
