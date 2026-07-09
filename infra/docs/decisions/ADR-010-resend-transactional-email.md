# ADR-010 — Resend para email transaccional (reemplaza SES)

**Status:** Accepted · **Date:** 2026-07-08

## Contexto

La app envía 7 tipos de email transaccional (confirmación de cita,
reprogramación, recordatorios 24h/2h, follow-up y notificaciones al admin por
nueva reserva / cancelación). Todo el envío pasa por un único `sendEmail()` en
`src/lib/email.ts`.

El proveedor original era **AWS SES**, pero AWS no habilitó la salida del
sandbox de la cuenta: sin acceso de producción, SES solo envía a direcciones
verificadas una a una — inviable para clientes reales. Había que cambiar de
proveedor.

Opciones:

1. **Insistir con SES** — esperar la aprobación de producción de AWS. Tiempo
   indefinido y fuera de nuestro control.
2. **Resend** — API HTTP, SDK `resend`, free tier ~3.000 emails/mes (100/día),
   verificación de dominio por DNS (SPF/DKIM).
3. **SMTP genérico** (Gmail u otro) — límites de envío bajos y no es
   transaccional; riesgo de spam/bloqueo.
4. **SendGrid / Mailgun / Postmark** — válidos, pero más pesados de integrar y
   con más fricción de onboarding para el scope de un estudio.

## Decisión

**Resend** vía el SDK `resend`, detrás del mismo `sendEmail()`.

## Por qué

- **API HTTP, sin IAM.** No requiere permisos de AWS en el nodo; basta una API
  key. Permite **eliminar la IAM policy de SES** del instance profile.
- **Free tier suficiente.** El volumen del estudio cabe de sobra en ~3.000
  emails/mes.
- **Verificación de dominio simple.** Records SPF/DKIM en DNS, sin proceso de
  aprobación como el sandbox de SES.
- **Swap de un solo punto.** Como todo el envío pasa por `sendEmail()`, el
  cambio fue un archivo de app (`lib/email.ts`) + su cableado de infra.
- **Errores explícitos.** Resend devuelve `{ data, error }` en vez de lanzar;
  auditamos los fallos como `EMAIL_FAILED`.

## Flujo (consistente con [ADR-009](ADR-009-ssm-parameter-store-secrets.md))

1. `RESEND_API_KEY` vive en **SSM SecureString** (`/<env>/resend/api-key`),
   provisionada "por código" con `TF_VAR_resend_api_key` + `ignore_changes`
   sobre el value — mismo patrón que la Google Calendar key.
2. `scripts/render-app-secret.sh` (el MISMO script para user-data y para el
   deploy de CI/CD) la lee de SSM y la inyecta en el K8s Secret.
3. El remitente va en el ConfigMap y debe ser de un **dominio verificado en
   Resend**.
4. `ENABLE_EMAILS` actúa de switch (`!== 'false'` → activo salvo que sea
   literalmente `false`); en dev se deja apagado.

## Qué se removió

- El módulo `infra/terraform/modules/ses/` (solo exponía una IAM policy
  `ses:SendEmail` / `ses:SendRawEmail`; no había identidad de dominio en TF) y
  su attachment al instance profile en dev y prod.
- La dependencia `@aws-sdk/client-ses`.

Al aplicar Terraform, esto **destruye** la policy de SES y la desasocia del rol
del nodo — decomiso intencional.

## Deuda menor consciente (nombres legacy)

La variable TF `ses_from_email` y la clave de ConfigMap `SES_FROM_EMAIL` se
**conservan** como el remitente de Resend, para no romper el Secret/ConfigMap ya
desplegados. Están anotadas como tal en el código. Renombrarlas a `EMAIL_FROM`
es un cambio cosmético pendiente, sin urgencia.

## Cuándo reconsiderar

- Si AWS habilita SES en la cuenta y el costo/volumen justifica volver a
  AWS-native (integración IAM + CloudWatch).
- Si el volumen supera el free tier de Resend — evaluar su plan pago vs. SES.
- Si se necesita un caso que Resend no cubre bien (p.ej. envíos masivos de
  marketing; Resend está orientado a transaccional).
