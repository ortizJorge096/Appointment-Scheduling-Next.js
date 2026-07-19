# Runbook — Migrar la BD de PROD a una cuenta free-tier separada

Implementa [ADR-013](../decisions/ADR-013-prod-db-cuenta-separada.md). **El orden importa:**
nada de teardown hasta que la BD nueva conteste y esté verificada. Esto toca **datos
reales de clientas + pagos** — hacelo en **ventana de mantenimiento**.

> Contexto: la BD de prod es **privada** (`publicly_accessible=false`), con
> `deletion_protection=true` y PITR de 1 día. Confirmá el identifier real:
> `cd infra/terraform/environments/prod && terraform output db_endpoint`.

## 0. Pre-flight

```bash
curl -s https://checkip.amazonaws.com                                   # tu IP → /32
cd infra/terraform/environments/prod && terraform output app_public_ip  # EIP cluster → /32
```

Elegí una **ventana de bajo tráfico** (madrugada Bogotá). Avisá si aplica.

## 1. Congelar escrituras + snapshot de seguridad

```bash
NS=appointment-scheduling
# Freeze: bajar la app a 0 réplicas para que no entren reservas durante el corte.
sudo k3s kubectl -n "$NS" scale deploy/appointment-scheduling --replicas=0   # (desde el box, o kubectl remoto)

# Snapshot manual (además del PITR)
aws rds create-db-snapshot \
  --db-instance-identifier appointment-scheduling-pg \
  --db-snapshot-identifier appointment-scheduling-premigration-$(date +%Y%m%d) --region us-east-1
aws rds wait db-snapshot-completed --db-snapshot-identifier appointment-scheduling-premigration-$(date +%Y%m%d)
```

## 2. Dump `.sql` vía túnel SSM (port-forward — la fuente NO se expone)

En vez de correr pods en la namespace `restricted`, tunelamos la RDS privada a la
laptop y usamos el cliente de Postgres local. **Terminal 1** (dejar abierto):

```bash
cd infra/terraform/environments/prod
INSTANCE_ID=$(aws ec2 describe-instances --region us-east-1 \
  --filters "Name=tag:aws:autoscaling:groupName,Values=$(terraform output -raw asg_name)" \
            "Name=instance-state-name,Values=running" \
  --query "Reservations[0].Instances[0].InstanceId" --output text)
RDS_HOST=$(terraform output -raw db_endpoint | cut -d: -f1)
aws ssm start-session --region us-east-1 --target "$INSTANCE_ID" \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters "{\"host\":[\"$RDS_HOST\"],\"portNumber\":[\"5432\"],\"localPortNumber\":[\"5433\"]}"
```

**Terminal 2** — dump a través del túnel:

```bash
OLD=$(aws ssm get-parameter --region us-east-1 \
  --name "$(cd infra/terraform/environments/prod && terraform output -raw database_url_ssm_parameter)" \
  --with-decryption --query Parameter.Value --output text)
# Dos ajustes al URL, SOLO para las CLI (el SSM que lee la app queda intacto):
#  1) host:5432 → localhost:5433 (el túnel). sslmode=require sigue OK (cifra sin
#     verificar hostname; NO uses verify-full).
#  2) quitar `schema=public`: es un param de Prisma, libpq lo rechaza con
#     "invalid URI query parameter: schema".
OLD_TUN=$(echo "$OLD" | sed -E 's#@[^:/]+:5432#@localhost:5433#; s#schema=public&##')

pg_dump --version                                    # ≥ 16 (major del server); si no: apt install postgresql-client-16
# A ~/ (home de WSL, ext4): fuera del repo (el .sql NO está gitignored → un `git add .`
# lo subiría) y fuera de /mnt/c (donde el chmod no pega). Es PII de prod.
pg_dump --no-owner --no-privileges "$OLD_TUN" > ~/prod-dump-$(date +%F).sql
chmod 600 ~/prod-dump-$(date +%F).sql
head -5 ~/prod-dump-$(date +%F).sql                  # sanity: comentarios/SET, no logs
```

> El **freeze** del paso 1 (scale a 0) sí requiere una sesión SSM corta al box para
> correr `kubectl scale`, o kubectl remoto. El dump/restore ya no toca k8s.

Cuando termine el restore (paso 4), **borrá el dump**: `shred -u ~/prod-dump-$(date +%F).sql`.

## 3. Crear la BD nueva (cuenta free-tier, Terraform standalone, prod-grade)

### 3.0 Acceso a la cuenta free-tier + backend de state

Terraform se autentica a la cuenta nueva vía un perfil de la CLI (`var.aws_profile` y el
`profile` del backend). Configuralo con una **access key de un usuario IAM** (NO la root;
mejor aún, SSO). Los valores los ingresás vos — nadie más debería verlos.

```bash
aws configure --profile freetier                # Access Key ID + Secret + region us-east-1
aws sts get-caller-identity --profile freetier  # confirmá: Account = la cuenta NUEVA, no prod
```

El state vive en **S3 en la cuenta free-tier** (`backend.tf`), separado de la cuenta
principal. Guarda la master password de la BD, así que el bucket va **privado + versionado**,
y **tiene que existir antes** del `init`:

```bash
B=096jortiz-tfstate-freetier
aws s3api create-bucket --bucket "$B" --region us-east-1 --profile freetier
aws s3api put-bucket-versioning --bucket "$B" --versioning-configuration Status=Enabled --profile freetier
aws s3api put-public-access-block --bucket "$B" --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true --profile freetier
```

> La encriptación del state la fuerza el backend (`encrypt=true`) y S3 cifra por defecto.
> **Borrá/desactivá la access key** al terminar; en `~/.aws/credentials` queda en texto plano.

### 3.1 Crear la BD

```bash
cd infra/terraform/environments/prod-db-freetier
cp terraform.tfvars.example terraform.tfvars   # aws_profile="freetier", operator_ip_cidr/32, cluster_eip_cidr/32
terraform init                                 # toma el backend S3 (o `-migrate-state` si había state local)
terraform plan                                 # revisá: publicly_accessible=true, deletion_protection=true, ingress SOLO a los 2 /32
terraform apply
NEW="$(aws ssm get-parameter --profile freetier --region us-east-1 --with-decryption \
       --name "$(terraform output -raw database_url_ssm_parameter)" \
       --query Parameter.Value --output text)"
```

## 4. Restore + verificación (ANTES de repuntar la app)

La BD nueva es **pública** → conectás directo desde la laptop (tu IP está en su /32),
sin túnel ni pods.

> **CRÍTICO — restaurá ANTES de repuntar la app (paso 5).** Apenas la app apunta a la BD
> nueva, su **init-container corre `prisma migrate deploy`** (ADR-006) y le crea el
> **esquema vacío**. Si restaurás después, el dump choca (`ERROR: type "..." already exists`)
> y con `ON_ERROR_STOP=1` aborta sin cargar nada — y el sitio queda arriba pero **sin
> servicios y sin login** (BD vacía). Si ya pasó, **limpiá el esquema primero** (seguro solo
> si confirmaste que la nueva está vacía, `select count(*)` = 0):
>
> ```bash
> psql "$NEW_CLI" -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
> ```

```bash
# Mismo strip de `schema=public` que en el dump (libpq no lo entiende).
NEW_CLI=$(echo "$NEW" | sed -E 's#schema=public&##')

# Si la app ya tocó la BD nueva y la migró (esquema vacío), descomentá:
# psql "$NEW_CLI" -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
psql -v ON_ERROR_STOP=1 "$NEW_CLI" < ~/prod-dump-$(date +%F).sql

# Conteos nueva vs. vieja (la vieja por el túnel del paso 2, localhost:5433). Deben coincidir.
for t in appointments clients services expenses quick_sales; do
  echo "$t  nueva=$(psql -tAc "select count(*) from \"$t\"" "$NEW_CLI")  vieja=$(psql -tAc "select count(*) from \"$t\"" "$OLD_TUN")"
done
```

## 5. Repunte + smoke test (reversible, sin teardown todavía)

```bash
# Ruta SSM real derivada de Terraform (no la hardcodees: el name_prefix de prod puede
# no ser "appointment-scheduling").
DBPARAM=$(cd infra/terraform/environments/prod && terraform output -raw database_url_ssm_parameter)
aws ssm put-parameter --name "$DBPARAM" --type SecureString --value "$NEW" --overwrite --region us-east-1

# Levantar la app de nuevo + redeploy (kubectl → sesión SSM corta al box o kubectl remoto)
sudo k3s kubectl -n appointment-scheduling scale deploy/appointment-scheduling --replicas=2
```

**Smoke test — probá el camino de ESCRITURA, no solo lectura.** "Se ven los datos" solo prueba
lectura. En vjbeautystudio.com: login admin, **creá una cita de prueba y registrá un pago** (que
la app ESCRIBA en la nueva), y revisá contabilidad/dashboard.

> **NO corras `terraform apply` en main/prod mientras estés en este estado reversible.** El
> `module.rds` de prod todavía es dueño de `$DBPARAM`; un apply lo recalcula al endpoint del
> RDS **viejo** (que sigue con datos) y la app salta de base sin avisar. El estado gestionado
> llega en el paso 7.

**Reconciliar el gap del dump** (si NO frenaste escrituras en el paso 1): pudieron entrar
reservas a la vieja después del dump. Antes del teardown, confirmá que la vieja no tenga citas
más nuevas que la nueva:
```bash
psql "$OLD_TUN" -c 'select count(*), max("createdAt") from appointments;'
psql "$NEW_CLI" -c 'select count(*), max("createdAt") from appointments;'
```
Si la vieja tiene más citas o un `max` más reciente, entraron post-dump → reconciliá esas filas
antes de apagar la vieja.

**Rollback**: `aws ssm put-parameter --name "$DBPARAM" --value "$OLD" --overwrite` + redeploy.
La BD vieja sigue intacta hasta el paso 7.

## 6. Rotar credenciales de la BD nueva

La BD es pública: rotá la master password ahora que migraste (en la cuenta free-tier),
y actualizá el SSM `$DBPARAM` con la nueva URL. (O dejá la generada
por TF si nunca se expuso en claro.)

## 7. Permanente + apagar el RDS viejo (con snapshot final)

Recién cuando la app corre bien contra la nueva.

> **CRÍTICO — 3 applies separados, NO todo junto.** Un único apply con las 3 vars falla:
> (a) `deletion_protection=true` bloquea el destroy y el `-var` no se aplica antes (el RDS
> se va con `count=0`, no se actualiza); (b) el `database_url_external` y el
> `module.rds[0].aws_ssm_parameter.database_url` tienen el **mismo nombre** → colisión
> (`ParameterAlreadyExists`) si se crean/destruyen en el mismo apply. El `moved` block del
> config evita que agregar `count` destruya/recree la BD; verificá que el paso 1 muestre
> **`0 to destroy`**.

```bash
cd infra/terraform/environments/prod

# 1) Quitar deletion_protection. El `moved` migra module.rds → module.rds[0] y actualiza
#    IN-PLACE. El plan DEBE decir "0 to destroy" (solo el move + 1 change). Si muestra la
#    BD en destroy, PARÁ.
terraform apply -var 'db_deletion_protection=false'

# 2) Destruir el RDS viejo CON snapshot final. external_database_url SIN setear todavía
#    (para no colisionar el /db/url). El plan debe mostrar `final_snapshot_identifier`.
terraform apply -var 'db_deletion_protection=false' -var 'enable_local_rds=false'

# 3) Publicar el DATABASE_URL externo gestionado (ya sin el del módulo → sin colisión).
terraform apply -var 'db_deletion_protection=false' -var 'enable_local_rds=false' \
  -var "external_database_url=$NEW"
```

> Entre el paso 2 y el 3, `/…/db/url` queda **ausente** unos segundos (el del módulo se
> destruyó, el externo aún no). La app corriendo sigue OK (tiene la URL en el Secret);
> **no hagas deploy/redeploy en esa ventana**. Corré 2 y 3 seguidos.
>
> El snapshot final queda como `<name_prefix>-pg-final-<timestamp>`.

### 7.1 Persistir el estado durable en `terraform.tfvars`

Los `-var` de arriba son **solo para la secuencia**; no quedan guardados. Un `terraform apply`
futuro sin ellos volvería a `enable_local_rds=true` → **intentaría recrear la BD local y pisar
el SSM**. Así que, terminada la migración, dejalo fijo en `terraform.tfvars` (gitignored):

```hcl
enable_local_rds       = false
db_deletion_protection = false
external_database_url  = "postgresql://appsched:…@…freetier…:5432/appointment_scheduling?schema=public&sslmode=require"
```

`external_database_url` es **sensitive** y trae la password → va en `terraform.tfvars`, nunca en
el `.example`. Confirmá con un `terraform plan` limpio (sin `-var`): debe dar **`No changes`**.

## Reversa total

Restaurá el snapshot (final o premigración) a una instancia nueva, `enable_local_rds=true`,
`db_deletion_protection=true`, `external_database_url=""`, `terraform apply`.

## Notas

- Si la EIP del clúster cambia (recreación del nodo), actualizá `cluster_eip_cidr` en
  `prod-db-freetier` y `terraform apply` en la cuenta free-tier, o la app pierde la BD.
- **Plan de salida** (ADR-013): volver a una cuenta gestionada antes de que venza el Free
  Tier (12 meses); una suspensión de la cuenta personal = caída de prod.
- Postgres público = expuesto a scans. Mitigado por SG /32 + SSL forzado + password fuerte.

## Troubleshooting (gotchas de esta corrida)

Indexado por síntoma — buscá el error que te salga:

- **`Cannot perform start session: EOF`** al abrir SSM → lo pipeaste a `bash` (sin TTY). Usá
  `eval "$(terraform output -raw ssm_session_command)"`.
- **`Permission denied` al redirigir a un archivo** en la sesión SSM → arranca en un dir no
  escribible (`/usr/bin`). `cd ~` primero.
- **`pods "..." is forbidden: violates PodSecurity "restricted"`** → la namespace fuerza PSA
  restricted; no corras pods pelados. Usá el **túnel SSM + cliente local** (pasos 2 y 4).
- **`pg_dump/psql: invalid URI query parameter: "schema"`** → el URL es formato Prisma;
  `schema=public` no es de libpq. Quitalo solo para las CLI: `sed -E 's#schema=public&##'`.
- **`FreeTierRestrictionError: ... backup retention period exceeds the maximum`** → el nuevo
  Free Tier capea backups. `backup_retention_days = 1` (o `0` si tampoco lo permite).
- **`psql: connection timed out`** a la BD pública → tu IP actual no está en el SG /32.
  `curl -s https://checkip.amazonaws.com` y actualizá `operator_ip_cidr` + `terraform apply`.
- **`ERROR: type "..." already exists`** al restaurar → la app ya migró la BD nueva (esquema
  vacío). `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` y restaurá de nuevo.
- **Sitio arriba pero sin servicios y sin login** → la app está en la BD nueva **vacía** (el
  restore no cargó o falló). Verificá `select count(*) from services` = 0 y re-restaurá.
- **La app volvió sola a la BD vieja** → alguien corrió `terraform apply` en main/prod y
  revirtió el SSM. Hacé el paso 7 (estado gestionado) para que no vuelva a pasar.
