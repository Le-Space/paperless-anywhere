// The status page does not depend on Caddy's setup, the fixed address or a
// restore (rootfs/files). 2026-11-19 and -20: two starts had a VM that ran and
// a Caddy that answered, but no status.json for over 20 minutes, so the app
// gave up. Whatever may block now runs beside the status loop and has a time
// limit. The scripts' own lines run here with sh and stand-ins.
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

const files = new URL("../../../rootfs/files/", import.meta.url).pathname;
const source = (/** @type {string} */ name) =>
  readFileSync(join(files, name), "utf8");
const code = (/** @type {string} */ name) =>
  source(name)
    .split("\n")
    .filter((l) => !/^\s*#/.test(l))
    .join("\n");

describe("paperless-status", { timeout: 30_000 }, () => {
  const script = source("paperless-status");

  it("reaches its loop while the Caddy setup still hangs", () => {
    const dir = mkdtempSync(join(tmpdir(), "status-independent-"));
    mkdirSync(join(dir, "secrets"));
    writeFileSync(join(dir, "secrets/https_hostname"), "abc.vm.example.org\n");
    // A paperless-https that never comes back within the test.
    writeFileSync(
      join(dir, "https"),
      `#!/bin/sh\necho "$*" > '${dir}/https.called'\nsleep 60\n`,
    );
    chmodSync(join(dir, "https"), 0o755);
    const head = script
      .slice(0, script.indexOf("\nwhile :; do"))
      .replaceAll("/usr/local/sbin/paperless-https", join(dir, "https"))
      .replaceAll("/run/paperless-anywhere", join(dir, "run"))
      .replaceAll("/tmp/secrets", join(dir, "secrets"));
    const started = Date.now();
    const r = spawnSync(
      "sh",
      [
        "-c",
        `${head}\n: > '${dir}/loop.reached'\ni=0; while [ ! -e '${dir}/https.called' ] && [ $i -lt 100 ]; do sleep 0.1; i=$((i + 1)); done\n`,
      ],
      { stdio: "ignore" },
    );
    expect(r.status).toBe(0);
    expect(Date.now() - started).toBeLessThan(20_000);
    expect(existsSync(join(dir, "loop.reached"))).toBe(true);
    expect(readFileSync(join(dir, "https.called"), "utf8").trim()).toBe(
      "--status abc.vm.example.org",
    );
  });

  it("runs the Caddy setup in the background, with a time limit, and nowhere else", () => {
    const calls = code("paperless-status")
      .split("\n")
      .filter((l) => l.includes("paperless-https"));
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatch(
      /^\s*\( timeout \d+ \/usr\/local\/sbin\/paperless-https --status "\$host" \\$/,
    );
    expect(script).toMatch(
      /\|\| echo "paperless-status: Caddy could not be set up for the status page" >&2 \) &\n/,
    );
  });

  it("sets Caddy up again when it still has no route for the page, but never twice at once", () => {
    expect(script).toMatch(
      /! grep -q '\/anywhere\/status\.json' \/etc\/caddy\/Caddyfile 2>\/dev\/null; then https_setup; fi/,
    );
    expect(script).toMatch(
      /\[ -z "\$https_pid" \] \|\| ! kill -0 "\$https_pid" 2>\/dev\/null \|\| return 0/,
    );
  });

  it("asks Docker and Paperless only with a time limit", () => {
    const loop = code("paperless-status");
    for (const line of loop
      .split("\n")
      .filter((l) => /\bdocker (info|image)|\$compose (config|ps)/.test(l)))
      expect(line).toMatch(/timeout 10 (docker|\$compose)/);
    expect(loop).toMatch(
      /curl -s -o \/dev\/null -w '%\{http_code\}' --max-time 5/,
    );
  });
});

describe("paperless-fixed-address", () => {
  it("is no oneshot: the init waits for a oneshot before it starts the next unit", () => {
    const unit = code("paperless-fixed-address.service");
    expect(unit).toMatch(/^Type=simple$/m);
    expect(unit).not.toMatch(/oneshot/);
    expect(unit).not.toMatch(/^Restart=(always|on-failure)$/m);
  });

  it("no other unit of the image is a oneshot either", () => {
    const build = readFileSync(
      new URL("../../../rootfs/build-image.sh", import.meta.url),
      "utf8",
    );
    const enabled =
      build
        .match(/systemctl enable ([^>\n]*)/g)
        ?.join(" ")
        .match(/paperless-[a-z0-9-]+\.service/g) ?? [];
    expect(enabled.length).toBeGreaterThan(5);
    for (const name of enabled)
      expect(code(name), name).not.toMatch(/^Type=oneshot$/m);
  });

  it("gives every step that asks the network a time limit", () => {
    const script = code("paperless-fixed-address");
    expect(script).toMatch(
      /timeout \d+ paperless-dns-records "\$host" "\$ipv4"/,
    );
    expect(script).toMatch(
      /CLOUDFLARE_DNS_API_TOKEN_FILE="\$state\/cf-token" timeout \d+ lego /,
    );
    expect(script).toMatch(/timeout \d+ paperless-restore fetch \|\|/);
  });
});

describe("paperless-restore", { timeout: 30_000 }, () => {
  const script = source("paperless-restore");

  it("waits for its lock only so long", () => {
    expect(code("paperless-restore")).toMatch(
      /\nflock -w \d+ 8 \|\| \{ [^\n]* exit 1; \}\n/,
    );
    expect(code("paperless-restore")).not.toMatch(/\nflock 8\n/);
  });

  it("leaves a finished restore as it is when a fetch is asked for afterwards", () => {
    const fetch = script.slice(script.indexOf("\nfetch() {"));
    const done = fetch.indexOf(
      `grep -q '"status":"done"' "$state" 2>/dev/null && exit 0`,
    );
    expect(done).toBeGreaterThan(0);
    expect(done).toBeLessThan(fetch.indexOf("status skipped"));
  });

  /** own_certificate in a made-up tls folder: 0 when this VM has a certificate. */
  function own(/** @type {Record<string, string> | null} */ certificates) {
    const tls = mkdtempSync(join(tmpdir(), "restore-tls-"));
    if (certificates) {
      mkdirSync(join(tls, "certificates"));
      for (const [name, content] of Object.entries(certificates))
        writeFileSync(join(tls, "certificates", name), content);
    }
    const fn = script.match(/^own_certificate\(\) \{[\s\S]*?^\}/m)?.[0];
    expect(fn).toBeTruthy();
    return spawnSync("sh", ["-c", `${fn}\nown_certificate`], {
      env: { ...process.env, PAPERLESS_TLS: tls },
    }).status;
  }

  it("takes the backup's certificate when lego only left its empty folder (a refused order)", () => {
    expect(own(null)).toBe(1);
    expect(own({})).toBe(1);
    expect(own({ "abc.vm.example.org.crt": "" })).toBe(1);
    expect(script).toMatch(
      /if \[ -d "\$work\/extra" \] && ! own_certificate; then\n\s+install -d -m 700 \/etc\/paperless-anywhere\/tls\n\s+cp -a "\$work\/extra\/\." \/etc\/paperless-anywhere\/tls\/\n/,
    );
  });

  it("keeps a certificate this VM already has", () => {
    expect(own({ "abc.vm.example.org.crt": "pem" })).toBe(0);
  });
});
