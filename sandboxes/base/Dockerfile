FROM python:3.12-slim-bookworm

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        bash openssh-server openssh-client ca-certificates \
        curl wget jq \
        coreutils findutils grep sed gawk less \
        file tree htop procps \
        iputils-ping iproute2 traceroute dnsutils whois \
        git unzip tar gzip xz-utils \
        postgresql-client default-mysql-client redis-tools sqlite3 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -m -s /bin/bash sandbox

RUN pip install --no-cache-dir --root-user-action=ignore --only-binary :all: \
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
        rich

COPY README.md /etc/sandbox/README.md

EXPOSE 22
