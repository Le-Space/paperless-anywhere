// The backup loop waits for a restore (rootfs/files/paperless-backup-loop):
// while one runs, or the unlock named one that has not begun, there is no
// look, no scheduled backup and no requested one. The loop's own function
// runs here with sh.
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const loop = readFileSync(
  new URL("../../../rootfs/files/paperless-backup-loop", import.meta.url),
  "utf8",
);

/** restoring() with a made-up state folder: true while the loop has to wait. */
function restoring({
  restore = /** @type {object | null} */ (null),
  entry = false,
}) {
  const dir = mkdtempSync(join(tmpdir(), "backup-restore-"));
  mkdirSync(join(dir, "secrets"));
  if (restore)
    writeFileSync(join(dir, "restore.json"), `${JSON.stringify(restore)}\n`);
  if (entry) writeFileSync(join(dir, "secrets/restore_ledger_entry"), "{}");
  const fn = loop.match(/^restoring\(\) \{[\s\S]*?^\}/m)?.[0];
  expect(fn).toBeTruthy();
  const sh = `dir='${dir}'\n${String(fn).replaceAll("/tmp/secrets", join(dir, "secrets"))}\nrestoring`;
  return spawnSync("sh", ["-c", sh]).status === 0;
}

describe("the backup loop and a restore", { timeout: 30_000 }, () => {
  it("waits while the restore runs, in its download and in its import", () => {
    expect(restoring({ restore: { status: "running" }, entry: true })).toBe(
      true,
    );
    expect(restoring({ restore: { status: "running", stage: "import" } })).toBe(
      true,
    );
  });

  it("waits when the unlock named a backup and the restore has not begun", () => {
    expect(restoring({ entry: true })).toBe(true);
  });

  it("goes on without a restore, and after one that is done, skipped or failed", () => {
    expect(restoring({})).toBe(false);
    for (const status of ["done", "skipped", "failed"])
      expect(restoring({ restore: { status } })).toBe(false);
  });

  it("looks at nothing and runs no backup while it waits: the check comes first in the loop", () => {
    const body = loop.slice(loop.indexOf("\nwhile :; do"));
    const wait = body.indexOf("if restoring; then");
    expect(wait).toBeGreaterThan(0);
    expect(wait).toBeLessThan(body.indexOf("backup_request ]"));
    expect(wait).toBeLessThan(body.indexOf("paperless-backup fingerprint"));
    expect(body.slice(wait, body.indexOf("backup_request ]"))).toMatch(
      /sleep 5\n\s+continue\n\s+fi\n/,
    );
  });

  it("takes its next look a full interval after the restore", () => {
    expect(loop).toMatch(
      /if \[ \$\(\( next - \$\(date \+%s\) \)\) -lt \$\(\( CHECK - 60 \)\) \]; then\n\s+next=\$\(\( \$\(date \+%s\) \+ CHECK \)\)\n\s+schedule\n/,
    );
  });
});
