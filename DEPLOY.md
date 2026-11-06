# Despliegue de Fragancias MC

Pruebas: `https://fragancias-mc.avilab.dev` (`ALLOW_INDEXING=false`).
Producción: el dominio del cliente, cuando exista. La URL pública sale de `SITE_URL`. No hay dominios fijos en el código.

El servidor no compila. GitHub Actions arma las imágenes, Docker Hub las guarda y el VPS solo las descarga. Ningún contenedor publica puertos. La entrada es un túnel de Cloudflare, así que no se abre el firewall ni se agrega este sitio al Traefik de la otra aplicación.

Imágenes: `alevaldez/fmc-api` y `alevaldez/fmc-web`. Son públicas e incluyen el código de la app. No llevan secretos, base ni fotos.

## Qué corre en cada push


| Acción              | Workflow                        | Resultado                                           |
| ------------------- | ------------------------------- | --------------------------------------------------- |
| Push o PR a `main`  | `.github/workflows/ci.yml`      | Instala, compila y chequea tipos. No publica nada.  |
| Push de un tag `v*` | `.github/workflows/release.yml` | Construye las dos imágenes y las sube a Docker Hub. |


El tag es la marca de una versión instalable. `v0.1.0` publica `fmc-api:0.1.0` y `fmc-web:0.1.0` (y también `:latest`). En el servidor se usa el número, `IMAGE_TAG=0.1.0`. `latest` se mueve con cada tag. El número queda atado a ese commit y sirve para volver atrás.

Secrets del repo (Settings → Secrets and variables → Actions):

- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN` (token de Docker Hub con permiso de escritura)



## Publicar una versión

Con el working tree limpio y el CI de `main` en verde:

```bash
git tag v0.1.1
git push origin v0.1.1
```

`git tag` solo crea el nombre local. El push del tag dispara el release. La imagen de la API tarda más porque incluye Chromium. Cuando las dos terminen, en el servidor se cambia `IMAGE_TAG` y se actualiza el stack (más abajo).

El primer despliegue que quedó andando es `0.1.0`.

## Layout en el servidor

Cada entorno es una carpeta, un `.env` y un túnel. Bases y volúmenes no se mezclan.


|                        | Pruebas                            | Producción          |
| ---------------------- | ---------------------------------- | ------------------- |
| Carpeta                | `/opt/fmc-staging`                 | `/opt/fmc-prod`     |
| `COMPOSE_PROJECT_NAME` | `fmc-staging`                      | `fmc-prod`          |
| Túnel                  | `fmc-staging`                      | `fmc-prod`          |
| `ALLOW_INDEXING`       | `false`                            | `true`              |
| URL actual             | `https://fragancias-mc.avilab.dev` | dominio del cliente |


Ahí viven `docker-compose.yml`, `.env` (`chmod 600`) y `backup.sh` (`chmod +x`). El `.env` no se commitea. La plantilla es `deploy/.env.example`.

Secretos, uno distinto por entorno:

```bash
openssl rand -hex 32    # SESSION_SECRET
openssl rand -hex 16    # S3_ACCESS_KEY
openssl rand -hex 24    # S3_SECRET_KEY y POSTGRES_PASSWORD
```

`WHATSAPP_PHONE` es el número con código de país, solo dígitos. Vacío oculta "Consultar por WhatsApp".

## Túnel y DNS

El token del túnel solo conecta el contenedor `cloudflared` con Cloudflare. No crea solo la URL pública.

La ruta se carga en el túnel, en **Routes → Add route → Published application** (en el menú viejo: **Public Hostnames**). El campo pide la URL completa:

```text
http://web:3000
```

`web` es el nombre del servicio en el compose. `web:3000` sin `http://` lo rechaza el formulario. No uses `localhost`: en el VPS ese puerto no está publicado.

Cloudflare, al guardar la ruta, tiene que poder crear un CNAME del hostname hacia `<id-del-tunel>.cfargotunnel.com`, con el proxy naranja activado. El id está en el detalle del túnel. Un registro más específico gana sobre un comodín.

En `avilab.dev` existe `*.avilab.dev` hacia la IP del VPS (`2.29.28.183`), porque la otra app resuelve tenants por ahí. Sin un CNAME exacto de `fragancias-mc`, el comodín manda el dominio a Traefik. Traefik responde con `TRAEFIK DEFAULT CERT` y `curl` falla con:

```text
SSL: no alternative certificate subject name matches target hostname 'fragancias-mc.avilab.dev'
```

El registro de pruebas, que convive con el comodín:


| Campo   | Valor                             |
| ------- | --------------------------------- |
| Tipo    | CNAME                             |
| Nombre  | `fragancias-mc`                   |
| Destino | `<id-del-tunel>.cfargotunnel.com` |
| Proxy   | naranja                           |


No hace falta un registro A hacia el VPS, ni una regla en Traefik. El resto de `*.avilab.dev` sigue en la otra aplicación.

Comprobación:

```bash
curl -sS https://fragancias-mc.avilab.dev/api/health
```

Respuesta esperada: `{"ok":true,"db":true,"storage":true}`.

Desde el servidor, `curl localhost:3000` no responde. Es así: la web solo escucha dentro de la red de Docker.

## Primera vez en el servidor

En la máquina de desarrollo, copiar la carpeta `deploy/` (el `.env` real se arma en el servidor):

```bash
sudo mkdir -p /opt/fmc-staging
sudo chown "$USER" /opt/fmc-staging
scp -r deploy/. usuario@servidor:/opt/fmc-staging/
```

En el servidor, con el túnel creado y el CNAME ya guardado:

```bash
cd /opt/fmc-staging
cp .env.example .env
chmod 600 .env
chmod +x backup.sh
# completar .env: REGISTRY_NS=alevaldez, IMAGE_TAG, SITE_URL, token, secretos

docker compose pull
docker compose up -d db storage
docker compose --profile tools run --rm migrate
docker compose up -d
docker compose ps
```

Tienen que quedar `db`, `storage`, `api` y `web` en healthy, y `tunnel` en marcha. La primera vez no hay datos: el backup puede esperar a que el sitio responda.

Catálogo viejo (idempotente; una segunda corrida no duplica):

```bash
# desde la máquina de desarrollo
scp -r ~/Escritorio/DEV/Own/Mauro/assets usuario@servidor:/opt/fmc-staging/legacy/assets

# en el servidor
cd /opt/fmc-staging
docker compose run --rm \
  -e LEGACY_PATH=/legacy \
  -v /opt/fmc-staging/legacy:/legacy:ro \
  api node dist/scripts/import-legacy.js
```

Los productos que el catálogo viejo marca a la vez como masculino y unisex entran como masculino. Los unisex se corrigen en el panel.

Admin (contraseña de al menos 12 caracteres):

```bash
docker compose --profile tools run --rm \
  -e ADMIN_EMAIL='tu-email' \
  -e ADMIN_PASSWORD='una-clave-larga' \
  create-admin
```

Panel: `https://fragancias-mc.avilab.dev/admin/login`.

Backup diario, después del primer arranque sano:

```cron
0 3 * * * cd /opt/fmc-staging && ./backup.sh >> backup.log 2>&1
```



## Actualizar

En el servidor, desde el segundo deploy en adelante, el backup va antes de migrar. Las migraciones no retroceden.

```bash
cd /opt/fmc-staging
./backup.sh
# editar .env → IMAGE_TAG=0.1.1
docker compose pull
docker compose --profile tools run --rm migrate
docker compose up -d
docker compose ps
```

Para volver a la versión anterior: poner el `IMAGE_TAG` previo y `docker compose up -d`.

Limpieza de imágenes viejas en el VPS, para no llenar el disco:

```bash
docker image prune -af --filter "until=720h"
```



## Producción, con el DNS del cliente

Pruebas se queda como está: `fmc-staging`, `ALLOW_INDEXING=false`, el CNAME de `fragancias-mc`. Producción es otra carpeta, otro `.env`, otros secretos y otro túnel. La misma imagen (`IMAGE_TAG`) puede correr en los dos.

### Antes de cambiar el dominio

El método es el mismo túnel, así que la zona del cliente tiene que estar en la misma cuenta de Cloudflare que `avilab.dev`. Si hoy el DNS está en el registrador u otro proveedor, el corte se planifica así:

1. Inventariar los registros que ya existen. Mail sobre todo: `MX`, `TXT` de SPF, DKIM y DMARC, y cualquier `autodiscover` o verificación (Google, Microsoft, Mercado Pago, etc.). También `www`, el apex y el resto de subdominios.
2. Agregar el sitio a Cloudflare y copiar esos registros antes de tocar los nameservers.
3. Bajar el TTL de los registros que se van a cambiar.
4. En el registrador, pasar los nameservers a los que indique Cloudflare.
5. Recién ahí crear el túnel `fmc-prod` y la ruta publicada.

Mientras los nameservers no sean los de Cloudflare, un CNAME armado en el panel del túnel no reemplaza el DNS que ya responde el dominio. Un registro A hacia la IP del VPS vuelve a caer en Traefik, con el mismo error de certificado de las pruebas.

### El registro público

Elegir una URL canónica y ponerla en `SITE_URL`, por ejemplo `https://dominiodelcliente.com`. Esa variable arma los enlaces, el sitemap y Open Graph.

En el túnel `fmc-prod`, la ruta de esa URL apunta otra vez a `http://web:3000`. El CNAME (o el registro de apex que crea Cloudflare, que aplana el CNAME) va con el proxy naranja. Si el cliente también usa `www`, se agrega una segunda ruta del mismo túnel hacia el mismo `http://web:3000`, o una regla de redirección en Cloudflare hacia la URL canónica. Las dos no deben indexarse como sitios distintos.

Si la zona del cliente tiene un comodín (`*.dominiodelcliente.com`), hace falta el registro exacto del hostname, igual que con `*.avilab.dev`. El comodín no se borra: el nombre exacto lo pisa solo para este sitio.

No agregar el dominio al Traefik del VPS.

### El stack

```bash
sudo mkdir -p /opt/fmc-prod
sudo chown "$USER" /opt/fmc-prod
# copiar deploy/ como en pruebas y armar un .env nuevo
```

Valores que cambian respecto de pruebas:

```bash
COMPOSE_PROJECT_NAME=fmc-prod
SITE_URL=https://dominiodelcliente.com
ALLOW_INDEXING=true
CLOUDFLARE_TUNNEL_TOKEN=   # token del túnel fmc-prod
# POSTGRES_PASSWORD, SESSION_SECRET, S3_ACCESS_KEY y S3_SECRET_KEY: generar de nuevo
```

`REGISTRY_NS` e `IMAGE_TAG` pueden ser los mismos de la versión que se quiera instalar. El orden de arranque es el de la primera vez: `db` y `storage`, `migrate`, después `up -d`.

El catálogo de pruebas no viaja solo. Para estrenar vacío, se cargan los productos por el panel o se vuelve a correr el import del catálogo viejo contra esta carpeta. Para copiar lo que ya está en pruebas: un `pg_dump` de esa base y una copia de los buckets, restaurados en los volúmenes de `fmc-prod`. Los secretos de pruebas no se reutilizan.

Cron propio, en `/opt/fmc-prod`. Conviene un `OFFSITE_REMOTE` de `rclone` (Backblaze B2, Drive o R2) y probar un restore una vez:

```bash
docker compose exec -T db pg_restore -U fmc -d fmc --clean --if-exists < backups/db/<archivo>.dump
```



### Checklist de salida

- [ ] Zona del cliente en Cloudflare, con MX y TXT de correo copiados y probados.
- [ ] Registro exacto del hostname hacia el túnel `fmc-prod`, proxy naranja. Sin registro A al VPS.
- [ ] `SITE_URL` canónico y `ALLOW_INDEXING=true`.
- [ ] Secretos nuevos. Admin con contraseña distinta a la de pruebas.
- [ ] `WHATSAPP_PHONE` del cliente.
- [ ] `curl -sS https://<dominio>/api/health` devuelve `ok: true` y el certificado es el de Cloudflare.
- [ ] Backup diario corriendo y un restore probado. Copia fuera del VPS.
- [ ] HTTPS estricto en Cloudflare y caché para `/media/*`.
- [ ] Monitoreo de uptime sobre `/api/health`.
- [ ] Textos legales (privacidad y cookies) y una revisión de las marcas en los textos del catálogo.

Pruebas sigue en `fragancias-mc.avilab.dev`, sin indexar, para el próximo cambio. Producción se actualiza con el mismo circuito de tag e `IMAGE_TAG`, en su propia carpeta.