FROM mcr.microsoft.com/playwright:v1.50.0-noble

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV NODE_PATH=/opt/sandbox-node/node_modules
ENV PATH=/opt/sandbox-node/node_modules/.bin:$PATH

RUN useradd -m -s /bin/bash sandbox && \
    mkdir -p /opt/sandbox-node && \
    npm install --prefix /opt/sandbox-node playwright@1.50.0 cheerio && \
    mkdir -p /home/sandbox/.cache && \
    ln -sfn /ms-playwright /home/sandbox/.cache/ms-playwright && \
    apt-get update && \
    apt-get install -y openssh-server jq && \
    rm -rf /var/lib/apt/lists/* && \
    echo "PLAYWRIGHT_BROWSERS_PATH=/ms-playwright" >> /etc/environment && \
    echo "NODE_PATH=/opt/sandbox-node/node_modules" >> /etc/environment && \
    echo "export PLAYWRIGHT_BROWSERS_PATH=/ms-playwright" >> /etc/profile.d/sandbox-node.sh && \
    echo "export NODE_PATH=/opt/sandbox-node/node_modules" >> /etc/profile.d/sandbox-node.sh && \
    echo "export PATH=/opt/sandbox-node/node_modules/.bin:\$PATH" >> /etc/profile.d/sandbox-node.sh

COPY pw-screenshot /usr/local/bin/pw-screenshot
COPY jina-read /usr/local/bin/jina-read
COPY web-search /usr/local/bin/web-search
RUN chmod +x /usr/local/bin/pw-screenshot /usr/local/bin/jina-read /usr/local/bin/web-search

COPY README.md /etc/sandbox/README.md
RUN chown -R sandbox:sandbox /opt/sandbox-node

EXPOSE 22
