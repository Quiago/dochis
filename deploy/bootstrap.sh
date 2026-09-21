#!/usr/bin/env bash
# EC2 user data (Ubuntu 24.04 arm64): installs everything except secrets. Runs once as root at first boot.
set -euxo pipefail
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt-get install -y nodejs git postgresql-client debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
apt-get update && apt-get install -y caddy
snap install aws-cli --classic

useradd --system --create-home --shell /bin/bash dochis
git clone https://github.com/Quiago/dochis.git /opt/dochis
chown -R dochis:dochis /opt/dochis
echo 'dochis ALL=(root) NOPASSWD: /usr/bin/systemctl restart dochis' > /etc/sudoers.d/dochis
cp /opt/dochis/deploy/dochis.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable dochis
touch /var/lib/dochis-bootstrap-done
