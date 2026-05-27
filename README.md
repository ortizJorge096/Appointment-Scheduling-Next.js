# valentinajimenez — Guía de Deploy en AWS

## Arquitectura

```
Internet → Route53 → EC2 (Next.js) → RDS PostgreSQL
                                   → SES (emails)
                                   → S3 (imágenes)
```

---

## 1. Prerrequisitos

- Cuenta de AWS activa
- AWS CLI instalado y configurado (`aws configure`)
- Dominio registrado (en Route53 o externo)
- Node.js 20+ en tu máquina local

---

## 2. Base de datos — AWS RDS PostgreSQL

### Crear la instancia RDS

1. Ir a **RDS → Create database**
2. Configurar:
   - Engine: **PostgreSQL 16**
   - Template: **Free tier** (para empezar) o **Production**
   - DB instance identifier: `valentinajimenez-db`
   - Master username: `valentinajimenez`
   - Master password: _(guárdala de inmediato)_
   - Instance class: `db.t3.micro`
   - Storage: 20 GB gp2
   - VPC: default
   - **Public access: No** (la EC2 accede por VPC)
   - Security group: crear uno nuevo `valentinajimenez-rds-sg`

3. En el security group de RDS, agregar inbound rule:
   - Type: PostgreSQL (5432)
   - Source: security group de la EC2 (lo crearás en el paso 3)

4. Anotar el **Endpoint** de RDS (ej: `valentinajimenez-db.xxxx.us-east-1.rds.amazonaws.com`)

---

## 3. Servidor — AWS EC2

### Lanzar la instancia

1. Ir a **EC2 → Launch instance**
2. Configurar:
   - AMI: **Ubuntu 24.04 LTS**
   - Instance type: `t3.small` (mínimo recomendado)
   - Key pair: crear uno nuevo, descargar `.pem`
   - Security group `valentinajimenez-ec2-sg` con reglas:
     - SSH (22) desde tu IP
     - HTTP (80) desde cualquier lugar
     - HTTPS (443) desde cualquier lugar
3. Storage: 20 GB gp3
4. Lanzar instancia

### Conectarse y preparar el servidor

```bash
# Conectarse por SSH
chmod 400 tu-key.pem
ssh -i tu-key.pem ubuntu@<IP-PUBLICA-EC2>

# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Instalar PM2 (gestor de procesos)
sudo npm install -g pm2

# Instalar Nginx
sudo apt install -y nginx

# Instalar Git
sudo apt install -y git
```

---

## 4. Configurar AWS SES (emails)

1. Ir a **SES → Verified identities → Create identity**
2. Verificar tu dominio o email remitente
3. Si tu cuenta está en modo sandbox, verificar también el email del cliente
4. Crear credenciales IAM para SES:
   - IAM → Users → Create user → `valentinajimenez-ses`
   - Adjuntar política: `AmazonSESFullAccess`
   - Crear Access Key → guardar `Access Key ID` y `Secret`

---

## 5. Deploy de la aplicación

### En la EC2, clonar y configurar el proyecto

```bash
# Clonar repositorio
cd /home/ubuntu
git clone https://github.com/tu-usuario/valentinajimenez.git
cd valentinajimenez

# Instalar dependencias
npm install

# Crear archivo de variables de entorno
nano .env.local
```

Pegar el contenido de `.env.example` y completar con los valores reales:

```bash
DATABASE_URL="postgresql://valentinajimenez:TU_PASSWORD@valentinajimenez-db.xxxx.us-east-1.rds.amazonaws.com:5432/valentinajimenez"
NEXTAUTH_SECRET="$(openssl rand -base64 32)"
NEXTAUTH_URL="https://tudominio.com"
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="AKIA..."
AWS_SECRET_ACCESS_KEY="..."
SES_FROM_EMAIL="noreply@tudominio.com"
AWS_S3_BUCKET="valentinajimenez-assets"
NEXT_PUBLIC_APP_NAME="valentinajimenez"
NEXT_PUBLIC_APP_URL="https://tudominio.com"
```

### Aplicar migraciones y seed

```bash
# Crear la base de datos
npx prisma migrate deploy

# Poblar con datos iniciales
npm run db:seed
```

### Build y arrancar con PM2

```bash
# Build de producción
npm run build

# Iniciar con PM2
pm2 start npm --name "valentinajimenez" -- start
pm2 save
pm2 startup  # seguir las instrucciones que muestre

# Verificar que corre
pm2 status
pm2 logs valentinajimenez
```

---

## 6. Configurar Nginx como proxy reverso

```bash
sudo nano /etc/nginx/sites-available/valentinajimenez
```

Pegar la siguiente configuración:

```nginx
server {
    listen 80;
    server_name tudominio.com www.tudominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Activar el sitio
sudo ln -s /etc/nginx/sites-available/valentinajimenez /etc/nginx/sites-enabled/
sudo nginx -t  # verificar configuración
sudo systemctl restart nginx
```

---

## 7. SSL con Let's Encrypt (HTTPS)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d tudominio.com -d www.tudominio.com

# Renovación automática (ya se configura sola, pero verificar)
sudo certbot renew --dry-run
```

---

## 8. DNS con Route53

1. Ir a **Route53 → Hosted zones → Create hosted zone**
2. Dominio: `tudominio.com`
3. Crear record:
   - Tipo: **A**
   - Name: `@` (raíz)
   - Value: **IP pública de la EC2**
   - TTL: 300
4. Crear record para `www`:
   - Tipo: **CNAME**
   - Name: `www`
   - Value: `tudominio.com`
5. Actualizar los nameservers en tu registrador de dominio con los NS de Route53

---

## 9. Cron job para recordatorios

```bash
# Abrir crontab
crontab -e

# Agregar esta línea (ejecuta todos los días a las 8:00 AM)
0 8 * * * cd /home/ubuntu/valentinajimenez && /usr/bin/npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/send-reminders.ts >> /var/log/valentinajimenez-reminders.log 2>&1
```

---

## 10. Actualizaciones futuras

```bash
# En la EC2, para actualizar el código
cd /home/ubuntu/valentinajimenez
git pull origin main
npm install
npx prisma migrate deploy
npm run build
pm2 restart valentinajimenez
```

---

## Rutas de la aplicación

| Ruta                  | Descripción                        | Acceso    |
|-----------------------|------------------------------------|-----------|
| `/`                   | Landing page                       | Público   |
| `/agendar`            | Formulario de agendamiento         | Público   |
| `/confirmacion?id=xx` | Confirmación post-cita             | Público   |
| `/admin`              | Dashboard de administración        | Solo admin|
| `/admin/citas`        | Lista y gestión de citas           | Solo admin|
| `/admin/citas/[id]`   | Detalle de cita con acciones       | Solo admin|
| `/admin/servicios`    | CRUD de servicios                  | Solo admin|
| `/admin/horarios`     | Horarios y fechas bloqueadas       | Solo admin|
| `/admin/login`        | Login de administración            | Público   |
| `/api/availability`   | Slots disponibles (GET)            | Público   |
| `/api/appointments`   | Crear/listar citas                 | Mixto     |
| `/api/services`       | Catálogo de servicios              | Mixto     |

---

## Costos estimados AWS (mes)

| Servicio          | Tier          | Costo aprox. |
|-------------------|---------------|--------------|
| EC2 t3.small      | On-Demand     | ~$15 USD     |
| RDS db.t3.micro   | On-Demand     | ~$15 USD     |
| SES               | 1000 emails   | ~$0.10 USD   |
| Route53           | Hosted zone   | ~$0.50 USD   |
| S3                | 5 GB          | ~$0.12 USD   |
| **Total**         |               | **~$31 USD** |

> Para reducir costos iniciales: usar **EC2 t3.micro** (~$8) + **RDS Free Tier** (primer año gratuito) = ~$9/mes el primer año.
