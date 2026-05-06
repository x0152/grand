FROM alpine:3.20

RUN apk add --no-cache \
        bash openssh-server openssh-client ca-certificates \
        ffmpeg mediainfo imagemagick \
        curl wget file jq \
        coreutils \
    && adduser -D -s /bin/bash sandbox

COPY README.md /etc/sandbox/README.md

EXPOSE 22
