# syntax=docker/dockerfile:1
# Imagen solo de desarrollo. El código no se copia: compose lo monta
# desde el host para que los watchers vean cada archivo guardado.
FROM node:24-bookworm-slim

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV npm_config_store_dir=/pnpm/store
ENV CHROMIUM_PATH=/usr/bin/chromium
ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates \
      chromium \
      fonts-liberation \
      fonts-noto-color-emoji \
      tini \
      util-linux \
 && rm -rf /var/lib/apt/lists/* \
 && npm install -g pnpm@12.16.1 \
 && mkdir -p /pnpm/store && chmod 777 /pnpm/store

WORKDIR /repo

COPY scripts/dev-entrypoint.sh /usr/local/bin/dev-entrypoint.sh
RUN chmod +x /usr/local/bin/dev-entrypoint.sh

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/dev-entrypoint.sh"]
CMD ["pnpm", "dev"]
