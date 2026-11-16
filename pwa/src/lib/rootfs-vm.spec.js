// Small parts of the VM's scripts (rootfs/files), run here: which hosts a
// restore downloads from, when sshd may start, what the public status page
// says, and that a failed step of the fixed address does not end in "ready".
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const files = new URL("../../../rootfs/files/", import.meta.url).pathname;
const source = (name) => readFileSync(join(files, name), "utf8");
const temp = (prefix) => mkdtempSync(join(tmpdir(), prefix));

describe("paperless-public-url", () => {
  const check = (url) =>
    spawnSync("python3", ["-I", join(files, "paperless-public-url"), url], {
      encoding: "utf8",
    });

  it("takes https URLs on public addresses", () => {
    for (const url of [
      "https://1.1.1.1/piece/bafk",
      "https://[2606:4700:4700::1111]:8443/piece/x",
    ]) {
      const r = check(url);
      expect(r.status, url).toBe(0);
    }
  });
  it("refuses anything else", () => {
    for (const url of [
      "http://1.1.1.1/x",
      "ftp://1.1.1.1/x",
      "https://user:pw@1.1.1.1/x",
      "https://127.0.0.1/x",
      "https://10.1.2.3/x",
      "https://192.168.0.1/x",
      "https://169.254.169.254/x",
      "https://100.64.0.1/x",
      "https://[::1]/x",
      "https://[fd00::1]/x",
      "https://[fe80::1]/x",
      "https://[::ffff:10.0.0.1]/x",
      "https://localhost/x",
      "https://node.internal/x",
      "not a url",
    ]) {
      const r = check(url);
      expect(r.status, url).toBe(1);
      expect(r.stderr).toMatch(/^paperless-public-url: /);
    }
  });
});

describe("paperless-restore's downloads", () => {
  const restore = source("paperless-restore");
  const downloadFn = /\ndownload\(\) \{\n[\s\S]*?\n\}\n/.exec(restore)?.[0];

  it("go through download(), with https only and a size limit", () => {
    expect(downloadFn).toBeTruthy();
    expect(downloadFn).toMatch(
      /curl -fsS --proto =https --proto-redir =https --max-filesize 1000000000 /,
    );
    expect(downloadFn).not.toMatch(/curl[^\n]* -[a-zA-Z]*L/);
    const curls = restore
      .split("\n")
      .filter((l) => /\bcurl\b/.test(l) && !/^\s*#/.test(l));
    // download()'s own, and the local probe of Paperless.
    expect(curls).toHaveLength(2);
    expect(curls[1]).toContain("http://127.0.0.1:8000/api/");
  });

  /** Runs download() against a stand-in curl whose answers are given in order. */
  function run(url, answers) {
    const dir = temp("fetch-");
    const calls = join(dir, "calls");
    writeFileSync(join(dir, "answers"), answers.join("\n") + "\n");
    writeFileSync(
      join(dir, "curl"),
      `#!/bin/sh\necho "$@" >> ${calls}\nn=$(wc -l < ${calls} | tr -d ' ')\nsed -n "\${n}p" ${join(dir, "answers")}\n`,
    );
    chmodSync(join(dir, "curl"), 0o755);
    const fn = downloadFn.replace(
      "/usr/local/sbin/paperless-public-url",
      `python3 -I ${join(files, "paperless-public-url")}`,
    );
    const script = `log=${join(dir, "log")}\n${fn}\ndownload "$1" ${join(dir, "out")}\n`;
    const r = spawnSync("sh", ["-c", script, "sh", url], {
      env: { ...process.env, PATH: `${dir}:${process.env.PATH}` },
      encoding: "utf8",
    });
    let made = [];
    try {
      made = readFileSync(calls, "utf8").trim().split("\n");
    } catch {
      /* no call */
    }
    return { status: r.status, calls: made };
  }

  it("come from a public https host", () => {
    const r = run("https://1.1.1.1/piece/x", ["200 "]);
    expect(r.status).toBe(0);
    expect(r.calls).toHaveLength(1);
  });
  it("never ask curl for a private or plain-http host", () => {
    for (const url of ["https://10.0.0.1/piece/x", "http://1.1.1.1/piece/x"]) {
      const r = run(url, ["200 "]);
      expect(r.status, url).toBe(1);
      expect(r.calls, url).toHaveLength(0);
    }
  });
  it("follow a redirect only to a public https host, three at most", () => {
    expect(
      run("https://1.1.1.1/a", ["302 https://8.8.8.8/b", "200 "]),
    ).toMatchObject({ status: 0 });
    expect(
      run("https://1.1.1.1/a", ["302 https://127.0.0.1/b", "200 "]),
    ).toMatchObject({ status: 1, calls: [expect.any(String)] });
    expect(
      run("https://1.1.1.1/a", ["302 http://8.8.8.8/b", "200 "]),
    ).toMatchObject({ status: 1 });
    const loop = run(
      "https://1.1.1.1/a",
      Array(6).fill("302 https://1.1.1.1/a"),
    );
    expect(loop.status).toBe(1);
    expect(loop.calls).toHaveLength(4);
  });
  it("fail on anything but a success", () => {
    expect(run("https://1.1.1.1/a", ["404 "]).status).toBe(1);
  });
});

describe("paperless-ssh-allowed", () => {
  function run({ key, role, debug } = {}) {
    const dir = temp("ssh-");
    const keys = join(dir, "authorized_keys");
    if (key !== undefined) writeFileSync(keys, key);
    if (role) writeFileSync(join(dir, "paperless_role"), role);
    if (debug) writeFileSync(join(dir, "paperless_debug_ssh"), debug);
    return spawnSync("sh", [join(files, "paperless-ssh-allowed")], {
      env: { ...process.env, PAPERLESS_SSH_KEYS: keys, PAPERLESS_SECRETS: dir },
      encoding: "utf8",
    }).status;
  }
  const key =
    "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIExampleKeyExampleKeyExampleKeyExample test\n";

  it("keeps sshd off without a key", () => {
    expect(run()).toBe(1);
    expect(run({ key: "" })).toBe(1);
    expect(run({ key: "# no key\nnot-a-key AAAA\n" })).toBe(1);
  });
  it("lets it start on a test instance with a key", () => {
    expect(run({ key })).toBe(0);
    expect(run({ key, role: "test" })).toBe(0);
  });
  it("keeps it off on a productive instance unless the unlock asks for it", () => {
    expect(run({ key, role: "primary" })).toBe(1);
    expect(run({ key, role: "primary", debug: "no" })).toBe(1);
    expect(run({ key, role: "primary", debug: "yes" })).toBe(0);
    expect(run({ role: "primary", debug: "yes" })).toBe(1);
  });
});

describe("the public status page", () => {
  it("says only the phase without a status token", () => {
    const py = /<<'PY' && mv[^\n]*\n([\s\S]*?)\nPY\n/.exec(
      source("paperless-status"),
    )?.[1];
    expect(py).toBeTruthy();
    const dir = temp("status-");
    writeFileSync(
      join(dir, "restore.json"),
      JSON.stringify({ status: "done", at: "x", documents: 3 }),
    );
    writeFileSync(join(dir, "stop.json"), JSON.stringify({ status: "ready" }));
    writeFileSync(
      join(dir, "fixed-address.json"),
      JSON.stringify({ status: "ready", host: "x.example" }),
    );
    // The script reads the token at /tmp/secrets/status_token; point that elsewhere.
    const code = py
      .replace("/tmp/secrets/status_token", join(dir, "no-token"))
      .replace(
        "/var/lib/paperless-anywhere/last-backup.json",
        join(dir, "last.json"),
      );
    const r = spawnSync(
      "python3",
      ["-I", "-", dir, "true", "true", "5", "5", "5", "true"],
      { input: code, encoding: "utf8" },
    );
    expect(r.status, r.stderr).toBe(0);
    const page = JSON.parse(r.stdout);
    expect(Object.keys(page).sort()).toEqual(["at", "paperless", "phase", "v"]);
    expect(page.phase).toBe("stopped");
  });
});

describe("paperless-fixed-address", () => {
  it("runs each try with set -e in force", () => {
    const code = source("paperless-fixed-address")
      .split("\n")
      .filter((l) => !/^\s*#/.test(l))
      .join("\n");
    expect(code).toMatch(/\(set -e; attempt\)/);
    expect(code).not.toMatch(/attempt &&|attempt \|\||if attempt/);
  });
  it("the shell leaves set -e in force in such a subshell (it would not in `attempt && …`)", () => {
    const script =
      'set -eu\nf() { false; echo continued; }\nf && echo ready\nset +e\n(set -e; f)\necho "rc=$?"\n';
    const r = spawnSync("sh", ["-c", script], { encoding: "utf8" });
    expect(r.stdout).toBe("continued\nready\nrc=1\n");
  });
});
