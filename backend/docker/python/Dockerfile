FROM python:3.11-alpine

# Create non-root user
RUN addgroup -S sandbox && adduser -S sandbox -G sandbox

# Create working directory
WORKDIR /home/sandbox/app

# Switch to non-root
USER sandbox

# Default shell
CMD ["/bin/sh"]