#!/bin/sh
# Arranque de los contenedores de desarrollo.
# Instala dependencias una sola vez (lock compartido entre api y web) y
# después ejecuta el comando del servicio con el uid del host, para que
# dist/ y .next/ no queden como root.
set -eu

cd /repo

store=/pnpm/store
uid="${DEV_UID:-1000}"
gid="${DEV_GID:-1000}"

mkdir -p "$store"
chown "$uid:$gid" "$store"

exec 9>"$store/install.lock"
flock 9

if [ ! -d /repo/node_modules/.pnpm ] || [ ! -f "$store/stamp" ] || [ /repo/pnpm-lock.yaml -nt "$store/stamp" ]; then
  echo "Instalando dependencias..."
  setpriv --reuid="$uid" --regid="$gid" --clear-groups -- \
    env HOME=/tmp npm_config_store_dir="$store" \
    pnpm install --frozen-lockfile
  touch "$store/stamp"
else
  echo "Dependencias al día."
fi

flock -u 9
exec 9>&-

echo "Arrancando: $*"
exec setpriv --reuid="$uid" --regid="$gid" --clear-groups -- \
  env HOME=/tmp npm_config_store_dir="$store" \
  "$@"
