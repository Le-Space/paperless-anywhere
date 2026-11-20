// Which certificate a fixed address takes (rootfs/files/paperless-fixed-address):
// the VM's own, then the backup's, and a new one only when there is none.
// 2026-11-19: every start ordered a new one for the same name first, and the
// sixth start within a week was refused by Let's Encrypt (five per name and
// week). The script's own lines run here with sh and stand-ins for lego
// (order), the restore and openssl.
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const script = readFileSync(
  new URL("../../../rootfs/files/paperless-fixed-address", import.meta.url),
  "utf8",
);
const block = script.slice(
  script.indexOf('\nif ! { [ -s "$crt" ] && [ -s "$key" ]; } &&'),
  script.indexOf('\nrm -f "$state/cf-token"\n\n# Caddy runs as its own user'),
);

/**
 * @param {{ own?: boolean, restore?: boolean, inBackup?: boolean, renew?: boolean, run?: boolean, valid?: boolean }} o
 * own: the VM has a certificate; restore: the unlock named a backup; inBackup:
 * that backup carries one; renew/run: lego succeeds; valid: openssl says so.
 */
function take({
  own = false,
  restore = false,
  inBackup = false,
  renew = true,
  run = true,
  valid = true,
}) {
  const dir = mkdtempSync(join(tmpdir(), "certificate-first-"));
  for (const d of ["secrets", "state", "tls", "bin"]) mkdirSync(join(dir, d));
  const crt = join(dir, "tls/h.crt");
  const key = join(dir, "tls/h.key");
  if (own) for (const f of [crt, key]) writeFileSync(f, "pem");
  if (restore) writeFileSync(join(dir, "secrets/restore_ledger_entry"), "{}");
  const log = join(dir, "calls.log");
  writeFileSync(
    join(dir, "bin/paperless-restore"),
    `#!/bin/sh\necho "restore $*" >> '${log}'\n${inBackup ? `echo pem > '${crt}'; echo pem > '${key}'` : "exit 1"}\n`,
  );
  writeFileSync(join(dir, "bin/openssl"), `#!/bin/sh\nexit ${valid ? 0 : 1}\n`);
  for (const f of ["paperless-restore", "openssl"])
    chmodSync(join(dir, "bin", f), 0o755);
  const sh = [
    `PATH='${join(dir, "bin")}':$PATH; s='${join(dir, "secrets")}'; state='${join(dir, "state")}'; crt='${crt}'; key='${key}'`,
    `: > "$state/lego.log"`,
    `report() { echo "report $1" >> '${log}'; }`,
    `order() { echo "order $1" >> '${log}'; case "$1" in run) ${run ? `echo pem > "$crt"; echo pem > "$key"; return 0` : "return 1"} ;; *) return ${renew ? 0 : 1} ;; esac; }`,
    `attempt() {${block}\n}`,
    "attempt",
  ].join("\n");
  const r = spawnSync("sh", ["-c", sh], { encoding: "utf8" });
  const calls = readFileSync(log, "utf8")
    .trim()
    .split("\n")
    .map((l) => l.replace(" --days 30 --no-random-sleep", ""));
  return { ok: r.status === 0, calls, has: existsSync(crt), stderr: r.stderr };
}

describe("the certificate of a fixed address", { timeout: 30_000 }, () => {
  it("with a restore: waits for the backup, takes its certificate and orders none", () => {
    const r = take({ restore: true, inBackup: true });
    expect(r).toMatchObject({
      ok: true,
      calls: [
        "report restore",
        "restore fetch",
        "report certificate",
        "order renew",
      ],
    });
  });

  it("with a restore whose backup carries none: orders one, after the backup", () => {
    const r = take({ restore: true });
    expect(r).toMatchObject({
      ok: true,
      has: true,
      calls: [
        "report restore",
        "restore fetch",
        "report certificate",
        "order run",
      ],
    });
  });

  it("without a restore: orders one right away", () => {
    expect(take({})).toMatchObject({
      ok: true,
      calls: ["report certificate", "order run"],
    });
  });

  it("a VM that has its certificate asks neither the backup nor for a new one", () => {
    expect(take({ own: true, restore: true, inBackup: true })).toMatchObject({
      ok: true,
      calls: ["report certificate", "order renew"],
    });
  });

  it("uses a valid certificate as it is when its renewal is refused", () => {
    const r = take({ restore: true, inBackup: true, renew: false });
    expect(r.ok).toBe(true);
    expect(r.calls).not.toContain("order run");
    expect(r.stderr).toContain("the certificate is used as it is");
  });

  it("fails the try when the renewal is refused and the certificate has run out", () => {
    const r = take({ own: true, renew: false, valid: false });
    expect(r).toMatchObject({
      ok: false,
      calls: ["report certificate", "order renew", "report failed"],
    });
  });

  it("fails the try when there is none and the order is refused", () => {
    expect(take({ run: false })).toMatchObject({
      ok: false,
      calls: ["report certificate", "order run", "report failed"],
    });
  });

  it("gives the wait for the backup a time limit", () => {
    expect(block).toMatch(/timeout \d+ paperless-restore fetch \|\|/);
  });
});
