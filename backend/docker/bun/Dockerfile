FROM oven/bun:1-alpine

RUN apk add --no-cache \
    bash \
    build-base \
    ca-certificates \
    curl \
    git \
    openssh-client \
    tini

# Create non-root user with home directory
RUN deluser --remove-home bun && \
    addgroup -g 1000 sandbox && adduser -u 1000 -G sandbox -h /home/sandbox -D sandbox

# Ensure writable runtime directories for package managers and shells
RUN mkdir -p /home/sandbox/app /home/sandbox/.cache /home/sandbox/.local \
    && chown -R sandbox:sandbox /home/sandbox

WORKDIR /home/sandbox/app

ENV HOME=/home/sandbox
ENV PATH=/home/sandbox/.local/bin:$PATH

USER sandbox

CMD ["/sbin/tini", "--", "/bin/sh"]
