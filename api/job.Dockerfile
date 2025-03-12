
# Set environment variables for JMeter
FROM alpine:3.18

ENV JMETER_VERSION=5.6.2 \
    JMETER_HOME=/opt/jmeter

# Install necessary packages including JMeter and MinIO Client
RUN apk add --no-cache \
    openjdk17-jre \
    curl \
    unzip \
    && curl -sL https://archive.apache.org/dist/jmeter/binaries/apache-jmeter-${JMETER_VERSION}.tgz \
    | tar -xz -C /opt \
    && mv /opt/apache-jmeter-${JMETER_VERSION} ${JMETER_HOME} \
    && rm -rf ${JMETER_HOME}/docs ${JMETER_HOME}/printable_docs \
    && curl -O https://dl.min.io/client/mc/release/linux-amd64/mc \
    && chmod +x mc \
    && mv mc /usr/local/bin/mc

# Set JMeter binary in PATH
ENV PATH="${JMETER_HOME}/bin:${PATH}"

WORKDIR ${JMETER_HOME}

ENTRYPOINT ["jmeter"]