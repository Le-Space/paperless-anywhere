#!/usr/bin/env bash
# build-image.sh <out.ext4>: the Paperless rootfs as a plain ext4 image.
#
# Debian 12 with systemd, Docker (+ the compose plugin), Caddy, age and the
# compose stack in /opt/paperless. relay-button's aleph-confidential-rootfs
# action then makes it confidential (its init, a systemctl replacement, the
# SSH key) and encrypts it. The containers are pulled after the unlock, so
# the image stays small. Needs root and debootstrap.
set -euo pipefail

COMPOSE_VERSION=v5.6.0
COMPOSE_SHA256=40343e21ca777173e69cff5dbafeb37c6f81f3b0d57d9e597f036e95eb63e76a

out="${1:?usage: build-image.sh <out.ext4>}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }
work="$(mktemp -d)"
root="$work/root"
trap 'rm -rf "$work"' EXIT

debootstrap --variant=minbase \
  --include=systemd,systemd-sysv,dbus,python3,openssh-server,docker.io,caddy,age,ca-certificates,curl,iproute2,procps,perl,e2fsprogs,util-linux,kmod,jq,less \
  bookworm "$root" http://deb.debian.org/debian >/dev/null

# The compose plugin (Debian 12 ships only the old Python docker-compose).
install -d "$root/usr/libexec/docker/cli-plugins"
curl -fsSL -o "$work/docker-compose" \
  "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-x86_64"
echo "${COMPOSE_SHA256}  $work/docker-compose" | sha256sum -c - >/dev/null
install -m 755 "$work/docker-compose" "$root/usr/libexec/docker/cli-plugins/docker-compose"

install -D -m 644 "$here/files/daemon.json" "$root/etc/docker/daemon.json"
install -D -m 644 "$here/files/compose.yml" "$root/opt/paperless/compose.yml"
install -D -m 644 "$here/files/Caddyfile" "$root/etc/caddy/Caddyfile"
install -D -m 644 "$here/files/paperless-stack.service" "$root/etc/systemd/system/paperless-stack.service"
install -D -m 644 "$here/files/docker.service" "$root/etc/systemd/system/docker.service"
install -D -m 644 "$here/files/paperless-restore.service" "$root/etc/systemd/system/paperless-restore.service"
for script in paperless-secrets paperless-https paperless-anywhere-check paperless-manage paperless-restore; do
  install -D -m 755 "$here/files/$script" "$root/usr/local/sbin/$script"
done
install -d -m 700 "$root/etc/paperless-anywhere"

printf 'PermitRootLogin prohibit-password\nPasswordAuthentication no\nUseDNS no\n' \
  > "$root/etc/ssh/sshd_config.d/paperless-anywhere.conf"
echo paperless-anywhere > "$root/etc/hostname"
: > "$root/etc/resolv.conf"
# No socket activation in the confidential rootfs (see files/docker.service).
chroot "$root" systemctl disable docker.socket >/dev/null 2>&1 || true
chroot "$root" systemctl enable docker.service containerd.service caddy.service ssh.service paperless-stack.service paperless-restore.service >/dev/null 2>&1

rm -rf "$root"/var/cache/apt/* "$root"/var/lib/apt/lists/* "$root"/usr/share/doc/* \
  "$root"/usr/share/man/* "$root"/usr/share/info/* "$root"/usr/share/locale/*

size_mib=$(( $(du -sm "$root" | cut -f1) * 115 / 100 + 128 ))
echo "rootfs content: $(du -sh "$root" | cut -f1), image ${size_mib} MiB"
truncate -s "${size_mib}M" "$out"
mkfs.ext4 -q -b 4096 -T default -L paperless -d "$root" "$out"
