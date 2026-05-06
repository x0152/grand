FROM alpine:3.20

RUN apk add --no-cache \
        openssh-server openssh-client sshpass bash \
        curl jq ca-certificates \
        coreutils grep sed gawk less \
    && adduser -D -s /bin/bash sandbox

COPY bin/runtimectl /usr/local/bin/runtimectl
RUN chmod +x /usr/local/bin/runtimectl

COPY README.md /etc/sandbox/README.md

EXPOSE 22
