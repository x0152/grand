FROM python:3.12-alpine

RUN apk add --no-cache \
        bash openssh-server openssh-client ca-certificates \
        curl wget jq \
        coreutils findutils grep sed gawk less \
        file tree htop procps \
        iputils iproute2 traceroute bind-tools whois \
        git unzip tar gzip xz \
        postgresql-client mariadb-client redis sqlite \
        libgomp libstdc++ \
        build-base libffi-dev openssl-dev \
    && adduser -D -s /bin/bash sandbox

RUN pip install --no-cache-dir --root-user-action=ignore \
        ipython \
        numpy \
        pandas \
        matplotlib \
        seaborn \
        scipy \
        sympy \
        scikit-learn \
        Pillow \
        requests \
        httpx \
        beautifulsoup4 \
        lxml \
        pyyaml \
        tabulate \
        openpyxl \
        python-dateutil \
        tqdm \
        rich \
    && apk del build-base libffi-dev openssl-dev

COPY README.md /etc/sandbox/README.md

EXPOSE 22
