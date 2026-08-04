# syntax=docker/dockerfile:1.7

FROM node:24.15-alpine AS web-build

WORKDIR /app
COPY web/package*.json ./
RUN npm ci
COPY web/index.html web/vite.config.mjs ./
COPY web/public/ public/
COPY web/src/ src/
RUN npm run build \
    && ! find dist -type f -name '*.map' -print -quit | grep -q .

FROM alpine:3.19 AS python-build

ENV PIP_NO_CACHE_DIR=1 \
    PIP_BREAK_SYSTEM_PACKAGES=1

RUN apk add --no-cache \
    gcc \
    musl-dev \
    openldap-dev \
    py3-pip \
    python3 \
    python3-dev

COPY api/requirements.txt /tmp/requirements.txt
RUN pip wheel --no-cache-dir --wheel-dir /wheels -r /tmp/requirements.txt

FROM python-build AS advanced-build

ARG NUITKA_VERSION=4.1.3

RUN pip install --no-cache-dir "Nuitka==${NUITKA_VERSION}"
COPY build_tools/compile_advanced.py /usr/local/bin/compile_advanced.py

WORKDIR /work
RUN --mount=type=bind,source=advanced/api,target=/src/advanced/api,ro \
    set -eu; \
    NUITKA_CACHE_DIR=/tmp/nuitka-cache python /usr/local/bin/compile_advanced.py \
        --source /src/advanced/api \
        --output /out/api \
        --temp /tmp/advanced-build; \
    test "$(find /out/api -type f -name '*.so' | wc -l)" -eq 6; \
    ! find /out/api -type f \( -name '*.py' -o -name '*.pyi' -o -name '*.c' \) -print -quit | grep -q .; \
    find /out/api -type f -name '*.so' -exec strip --strip-unneeded {} +; \
    rm -rf /tmp/advanced-build /tmp/nuitka-cache

FROM alpine:3.19 AS runtime

ENV PATH=/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONWARNINGS="ignore::DeprecationWarning" \
    PIP_NO_CACHE_DIR=1 \
    PIP_BREAK_SYSTEM_PACKAGES=1

RUN apk add --no-cache \
    bash \
    libldap \
    libsasl \
    nginx \
    py3-pip \
    python3 \
    supervisor \
    && ln -sf python3 /usr/bin/python

COPY --from=python-build /wheels/ /tmp/wheels/
COPY api/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir --no-index --find-links=/tmp/wheels -r /tmp/requirements.txt \
    && apk del py3-pip \
    && rm -rf /tmp/requirements.txt /tmp/wheels

RUN addgroup -S -g 10001 kubeblast \
    && adduser -S -D -H -u 10001 -G kubeblast kubeblast \
    && mkdir -p /app/api /data /tmp/nginx \
    && chown -R kubeblast:kubeblast /data /tmp/nginx

COPY api/ /app/api/
COPY --from=advanced-build /out/api/ /app/api/
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY web/nginx-main.conf /etc/nginx/nginx.conf
COPY web/nginx.conf /etc/nginx/http.d/default.conf
COPY --from=web-build /app/dist/ /usr/share/nginx/html/

USER 10001:10001

EXPOSE 8080 8000
CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
