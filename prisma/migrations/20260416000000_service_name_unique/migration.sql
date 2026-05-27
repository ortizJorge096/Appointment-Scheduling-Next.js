-- AlterTable: agregar restricción UNIQUE a services.name
ALTER TABLE "services" ADD CONSTRAINT "services_name_key" UNIQUE ("name");
