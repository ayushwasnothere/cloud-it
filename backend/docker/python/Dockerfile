FROM python:3.11-alpine

RUN apk add --no-cache \
    bash \
    build-base \
    ca-certificates \
    curl \
    git \
    libffi-dev \
    openssl-dev \
    tini

# Create non-root user
RUN addgroup -g 1000 sandbox && adduser -u 1000 -G sandbox -h /home/sandbox -D sandbox

# Ensure sandbox owns writable home/app paths for venv and pip installs
RUN mkdir -p /home/sandbox/app /home/sandbox/.cache/pip /home/sandbox/.local \
    && chown -R sandbox:sandbox /home/sandbox

# Create working directory
WORKDIR /home/sandbox/app

ENV HOME=/home/sandbox
ENV PIP_CACHE_DIR=/home/sandbox/.cache/pip
ENV PATH=/home/sandbox/.local/bin:$PATH

# Switch to non-root
USER sandbox

# Default shell
CMD ["/sbin/tini", "--", "/bin/sh"]
