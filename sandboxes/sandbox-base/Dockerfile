FROM alpine:3.20

RUN apk add --no-cache \
        openssh-server openssh-client bash ca-certificates \
        coreutils \
    && adduser -D -s /bin/bash sandbox

EXPOSE 22
