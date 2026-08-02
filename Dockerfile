FROM node:24.15-alpine AS web-build

WORKDIR /app
COPY web/package*.json ./
RUN npm ci
COPY web/index.html web/vite.config.mjs ./
COPY web/public/ public/
COPY web/src/ src/
RUN npm run build

FROM alpine:3.19 AS base

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_BREAK_SYSTEM_PACKAGES=1 \
    PYTHONWARNINGS="ignore::DeprecationWarning"
    
RUN apk add --no-cache \
    bash \
    nginx \
    supervisor \
    python3 \
    py3-pip \
    openldap-dev \
    python3-dev \
    gcc musl-dev \
 && ln -sf python3 /usr/bin/python \
 && mkdir -p /app/api \
 && mkdir -p /var/log/supervisor


COPY api/requirements.txt /app/api/
RUN pip install --no-cache-dir -r /app/api/requirements.txt

COPY api/ /app/api/
COPY advanced/ /app/advanced/
RUN pyarmor gen -r -O /app/obf /app/advanced/ \
    && cp -r /app/obf/advanced/api/* /app/api/ \
    && mv /app/obf/pyarmor_runtime_000000 /app/api/ \
    && rm -rf /app/obf \
    && rm -rf /app/advanced

COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY --from=web-build /app/dist /usr/share/nginx/html
COPY web/nginx.conf /etc/nginx/http.d/default.conf

EXPOSE 80
CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
