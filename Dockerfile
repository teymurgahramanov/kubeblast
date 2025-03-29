# Build stage for the web frontend
FROM node:18-alpine AS web-build
WORKDIR /app
COPY web/package*.json ./
RUN npm install
COPY web/public/ public/
COPY web/src/ src/
RUN npm run build

# Main stage that combines all services
FROM alpine:3.19 AS base

# Install runtime dependencies
RUN apk add --no-cache \
    bash \
    nginx \
    supervisor \
    python3 \
    py3-pip \
    && ln -sf python3 /usr/bin/python && \
    mkdir -p /app/api && \
    mkdir -p /app/worker && \
    mkdir -p /var/log/supervisor

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_BREAK_SYSTEM_PACKAGES=1

# Copy and install API dependencies
COPY api/requirements.txt /app/api/
COPY worker/requirements.txt /app/worker/
RUN pip install --no-cache-dir -r /app/api/requirements.txt && pip install --no-cache-dir -r /app/worker/requirements.txt

# Copy application code
COPY api/ /app/api/
COPY worker/ /app/worker/
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY --from=web-build /app/build /usr/share/nginx/html
COPY web/nginx.conf /etc/nginx/http.d/default.conf

EXPOSE 80

CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/conf.d/supervisord.conf"] 