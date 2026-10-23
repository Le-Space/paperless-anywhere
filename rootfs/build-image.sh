#!/usr/bin/env bash
# build-image.sh <out.ext4>: the Paperless rootfs as a plain ext4 image.
#
# Debian 12 with systemd, Docker (+ the compose plugin), Caddy, age and the
# compose stack in /opt/paperless. relay-button's aleph-confidential-rootfs
# action then makes it confidential (its init, a systemctl replacement, the
# SSH key) and encrypts it. The containers are pulled after the unlock, so
# the image stays small. Needs root and debootstrap.
set -euo pipefail

# Node and the backup tool (Le-Space/paperless-backup-filecoin), for the
# backups the VM makes itself with a session key.
NODE_VERSION=v22.21.0
NODE_SHA256=71a04f4b9144870c9407b8019fe912514229e50246bc706862eded3ac8e9025d
BACKUP_TOOL_REPO=https://github.com/Le-Space/paperless-backup-filecoin.git
BACKUP_TOOL_COMMIT=f2de20798cccd2fb8bd8dff3b55e303b679b845b
ESBUILD_VERSION=0.25.10

COMPOSE_VERSION=v5.6.0
COMPOSE_SHA256=40343e21ca777173e69cff5dbafeb37c6f81f3b0d57d9e597f036e95eb63e76a

out="${1:?usage: build-image.sh <out.ext4>}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }
work="$(mktemp -d)"
root="$work/root"
trap 'rm -rf "$work"' EXIT

debootstrap --variant=minbase \
  --include=systemd,systemd-sysv,dbus,python3,openssh-server,docker.io,caddy,age,ca-certificates,curl,iproute2,procps,e2fsprogs,util-linux,kmod,jq,less \
  bookworm "$root" http://deb.debian.org/debian >/dev/null

# The compose plugin (Debian 12 ships only the old Python docker-compose).
install -d "$root/usr/libexec/docker/cli-plugins"
curl -fsSL -o "$work/docker-compose" \
  "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-x86_64"
echo "${COMPOSE_SHA256}  $work/docker-compose" | sha256sum -c - >/dev/null
install -m 755 "$work/docker-compose" "$root/usr/libexec/docker/cli-plugins/docker-compose"

curl -fsSL -o "$work/node.tar.xz" "https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-linux-x64.tar.xz"
echo "${NODE_SHA256}  $work/node.tar.xz" | sha256sum -c - >/dev/null
install -d "$root/usr/local/lib/nodejs"
tar -xJf "$work/node.tar.xz" -C "$root/usr/local/lib/nodejs" --strip-components=1 \
  --exclude='*/include' --exclude='*/share' --exclude='*/lib/node_modules/corepack'
ln -sf /usr/local/lib/nodejs/bin/node "$root/usr/local/bin/node"

git clone -q "$BACKUP_TOOL_REPO" "$work/backup-tool"
git -C "$work/backup-tool" checkout -q "$BACKUP_TOOL_COMMIT"
(cd "$work/backup-tool" && PATH="$root/usr/local/lib/nodejs/bin:$PATH" npm ci --omit=dev --no-audit --no-fund --loglevel=error)
# One file each instead of node_modules: 139 MB down to about 3 MB (viem alone
# is 75 MB). Same piece CID and the same chain reads as the unbundled tool.
cp "$here/files/piece-cid.mjs" "$work/backup-tool/piece-cid.mjs"
(cd "$work/backup-tool" && PATH="$root/usr/local/lib/nodejs/bin:$PATH" npx --yes "esbuild@${ESBUILD_VERSION}" \
  backup.mjs piece-cid.mjs --bundle --platform=node --format=esm --target=node22 --outdir=dist \
  --out-extension:.js=.mjs --log-level=warning \
  --banner:js="import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);")
install -d -m 700 "$root/opt/backup-filecoin"
install -m 644 "$work/backup-tool/dist/backup.mjs" "$work/backup-tool/package.json" "$root/opt/backup-filecoin/"
install -m 644 "$work/backup-tool/dist/piece-cid.mjs" "$root/opt/backup-filecoin/piece-cid.mjs"

install -D -m 644 "$here/files/daemon.json" "$root/etc/docker/daemon.json"
install -D -m 644 "$here/files/compose.yml" "$root/opt/paperless/compose.yml"
install -D -m 644 "$here/files/Caddyfile" "$root/etc/caddy/Caddyfile"
install -D -m 644 "$here/files/paperless-stack.service" "$root/etc/systemd/system/paperless-stack.service"
install -D -m 644 "$here/files/docker.service" "$root/etc/systemd/system/docker.service"
install -D -m 644 "$here/files/paperless-restore.service" "$root/etc/systemd/system/paperless-restore.service"
install -D -m 644 "$here/files/paperless-backup.service" "$root/etc/systemd/system/paperless-backup.service"
install -D -m 644 "$here/files/paperless-backup.timer" "$root/etc/systemd/system/paperless-backup.timer"
install -D -m 644 "$here/files/paperless-status.service" "$root/etc/systemd/system/paperless-status.service"
install -D -m 644 "$here/files/paperless-stop.service" "$root/etc/systemd/system/paperless-stop.service"
for script in paperless-secrets paperless-https paperless-anywhere-check paperless-manage paperless-restore paperless-backup paperless-status paperless-stop; do
  install -D -m 755 "$here/files/$script" "$root/usr/local/sbin/$script"
done
install -d -m 700 "$root/etc/paperless-anywhere"

printf 'PermitRootLogin prohibit-password\nPasswordAuthentication no\nUseDNS no\n' \
  > "$root/etc/ssh/sshd_config.d/paperless-anywhere.conf"
echo paperless-anywhere > "$root/etc/hostname"
: > "$root/etc/resolv.conf"
# No socket activation in the confidential rootfs (see files/docker.service).
chroot "$root" systemctl disable docker.socket >/dev/null 2>&1 || true
chroot "$root" systemctl enable docker.service containerd.service caddy.service ssh.service paperless-stack.service paperless-restore.service paperless-backup.timer paperless-status.service paperless-stop.service >/dev/null 2>&1

rm -rf "$root"/var/cache/apt/* "$root"/var/lib/apt/lists/* "$root"/usr/share/doc/* \
  "$root"/usr/share/man/* "$root"/usr/share/info/* "$root"/usr/share/locale/*

# Little room on top: the instance grows the filesystem to its disk at boot,
# and free space costs full upload once the image is encrypted.
size_mib=$(( $(du -sm "$root" | cut -f1) * 108 / 100 + 64 ))
echo "rootfs content: $(du -sh "$root" | cut -f1), image ${size_mib} MiB"
truncate -s "${size_mib}M" "$out"
mkfs.ext4 -q -b 4096 -T default -L paperless -d "$root" "$out"
