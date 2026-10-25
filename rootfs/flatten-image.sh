#!/usr/bin/env bash
# flatten-image.sh <upstream@digest> <target:tag>: a one-layer copy of an
# image, with its configuration (entrypoint, command, environment, working
# directory, user, ports, volumes, labels) carried over, pushed to <target>.
# Prints the pushed reference with its digest. A health check and a stop
# signal are not carried over (docker import cannot set them).
set -euo pipefail
src="$1" dst="$2"
docker pull -q --platform linux/amd64 "$src" >/dev/null
config="$(docker image inspect --format '{{json .Config}}' "$src")"
changes_text="$(python3 -c '
import json, sys
c = json.loads(sys.argv[1]) or {}
q = json.dumps
out = []
for e in c.get("Env") or []:
    k, _, v = e.partition("=")
    out.append("ENV " + k + "=" + q(v))
for key, word in (("Entrypoint", "ENTRYPOINT"), ("Cmd", "CMD")):
    if c.get(key):
        out.append(word + " " + q(c[key]))
if c.get("WorkingDir"):
    out.append("WORKDIR " + c["WorkingDir"])
if c.get("User"):
    out.append("USER " + c["User"])
for port in c.get("ExposedPorts") or {}:
    out.append("EXPOSE " + port)
if c.get("Volumes"):
    out.append("VOLUME " + q(sorted(c["Volumes"])))
for k, v in (c.get("Labels") or {}).items():
    out.append("LABEL " + q(k) + "=" + q(v))
print("\n".join(out))
' "$config")"
mapfile -t changes <<< "$changes_text"
args=()
for change in "${changes[@]}"; do args+=(--change "$change"); done
cid="$(docker create --platform linux/amd64 "$src")"
trap 'docker rm -f "$cid" >/dev/null 2>&1 || true' EXIT
docker export "$cid" | docker import "${args[@]}" --platform linux/amd64 - "$dst" >/dev/null
docker push -q "$dst" >/dev/null
docker image inspect --format '{{index .RepoDigests 0}}' "$dst"
