// The VM's compose stack (rootfs/files): Valkey asks for a password that
// Paperless gets, and the stack's unit stays in the foreground without
// attaching to the containers' logs.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const file = (name) =>
  readFileSync(
    new URL(`../../../rootfs/files/${name}`, import.meta.url),
    "utf8",
  );

describe("Valkey", () => {
  const compose = file("compose.yml");
  const secrets = file("paperless-secrets");

  it("starts from a config file the VM writes, not with a password on its command line", () => {
    expect(compose).toMatch(
      /command: \["valkey-server", "\/usr\/local\/etc\/valkey\/valkey\.conf"\]/,
    );
    expect(compose).toContain(
      "/etc/paperless-anywhere/valkey.conf:/usr/local/etc/valkey/valkey.conf:ro",
    );
    expect(compose).not.toMatch(/requirepass/);
  });
  it("gets a password made on the VM, and Paperless the same one", () => {
    expect(secrets).toMatch(/valkey="\$\(secret valkey_password\)"/);
    expect(secrets).toMatch(
      /requirepass %s\\n' "\$valkey" > "\$dir\/valkey\.conf"/,
    );
    expect(secrets).toMatch(
      /PAPERLESS_REDIS=redis:\/\/:%s@127\.0\.0\.1:6379\\n' "\$valkey"/,
    );
  });
  it("leaves PAPERLESS_REDIS to paperless.env (compose would let its own value win)", () => {
    expect(compose).not.toMatch(/^\s+PAPERLESS_REDIS:/m);
  });
});

describe("paperless-stack-up", () => {
  const up = file("paperless-stack-up");
  const code = up
    .split("\n")
    .filter((l) => !/^\s*#/.test(l))
    .join("\n");

  it("starts every container detached and never follows their output", () => {
    const ups = code.match(/\$compose up\b[^\n]*/g) ?? [];
    expect(ups.length).toBeGreaterThan(0);
    for (const line of ups) expect(line).toMatch(/up -d\b/);
    expect(code).not.toMatch(/\blogs\b|\battach\b/);
  });
  it("then waits in the foreground and fails once dockerd stays gone", () => {
    expect(code).toMatch(/while sleep 30; do/);
    expect(code).toMatch(/exit 1/);
  });
});
