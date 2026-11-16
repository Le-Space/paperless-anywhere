// The flat images (rootfs/images.txt, rootfs/flatten-image.sh): Paperless's
// extra OCR languages are installed into its flat copy, not at each start.
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const rootfs = new URL("../../../rootfs/", import.meta.url).pathname;
const images = readFileSync(`${rootfs}images.txt`, "utf8");
const compose = readFileSync(`${rootfs}files/compose.yml`, "utf8");

/** The OCR languages the upstream Paperless image brings (its Dockerfile). */
const UPSTREAM_LANGS = ["eng", "deu", "fra", "ita", "spa"];

describe("the flat Paperless image", () => {
  const line = images.split("\n").find((l) => l.startsWith("paperless "));
  const packages = line.trim().split(/\s+/).slice(2);

  it("carries every OCR language Paperless is set to use", () => {
    const langs = /PAPERLESS_OCR_LANGUAGE: ([a-z_+]+)/
      .exec(compose)[1]
      .split("+");
    for (const lang of langs) {
      expect(
        UPSTREAM_LANGS.includes(lang) ||
          packages.includes(`tesseract-ocr-${lang}`),
        lang,
      ).toBe(true);
    }
  });
  it("names only Debian package names after the digest", () => {
    for (const pkg of packages) expect(pkg).toMatch(/^[a-z0-9][a-z0-9.+-]+$/);
  });
});

describe("flatten-image.sh", () => {
  it("refuses a package name that is not one, before it pulls anything", () => {
    const r = spawnSync(
      "bash",
      [`${rootfs}flatten-image.sh`, "x@sha256:0", "y:z", "ok-pkg", "$(id)"],
      {
        encoding: "utf8",
        env: { ...process.env, PATH: "/nonexistent:/usr/bin:/bin" },
      },
    );
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("flatten-image.sh: not a package name: $(id)");
  });
});
