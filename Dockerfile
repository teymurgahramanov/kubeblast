FROM node:18-alpine AS web-build

ARG EDITION_IS_PRO=false
ENV REACT_APP_IS_PRO="${EDITION_IS_PRO}"
ENV REACT_APP_PRO_REDIRECT_URL=https://github.com/teymurgahramanov/kubeblast

WORKDIR /app
COPY web/package*.json ./
RUN npm install
COPY web/public/ public/
COPY web/src/ src/
RUN npm run build

FROM alpine:3.19 AS base

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

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_BREAK_SYSTEM_PACKAGES=1 \
    PYTHONWARNINGS="ignore::DeprecationWarning"

COPY api/requirements.txt /app/api/
RUN pip install --no-cache-dir -r /app/api/requirements.txt

COPY api/ /app/api/
COPY pro/ /app/pro/
RUN pyarmor gen -r -O /app/obf /app/pro/ \
    && cp -r /app/obf/pro/api/* /app/api/ \
    && mv /app/obf/pyarmor_runtime_000000 /app/api/ \
    && rm -rf /app/obf \
    && rm -rf /app/pro

COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY --from=web-build /app/build /usr/share/nginx/html
COPY web/nginx.conf /etc/nginx/http.d/default.conf

EXPOSE 80
CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
