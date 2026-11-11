import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseImages, stackInfo } from './stack.js';

const read = (p) => readFileSync(new URL(`../../../../rootfs/${p}`, import.meta.url), 'utf8');

describe('stack', () => {
	it('reads name, tag and digest from images.txt', () => {
		expect(parseImages('# c\nx docker.io/a/b:1.2@sha256:ab\n')).toEqual([{ name: 'x', image: 'docker.io/a/b', tag: '1.2', digest: 'sha256:ab' }]);
	});

	it('names the Paperless-ngx this repository ships, with the source of exactly that tag and its copy', () => {
		const info = stackInfo({ images: read('images.txt'), compose: read('files/compose.yml'), build: read('build-image.sh') });
		const ngx = info.images.find((i) => i.name === 'paperless');
		expect(ngx.tag).toMatch(/^\d+\.\d+\.\d+$/);
		expect(ngx.source).toBe(`https://github.com/paperless-ngx/paperless-ngx/tree/v${ngx.tag}`);
		expect(ngx.licence).toBe('GPL-3.0');
		expect(ngx.flat).toMatch(/^ghcr\.io\/le-space\/paperless-anywhere\/paperless@sha256:[0-9a-f]{64}$/);
		for (const i of info.images) expect(i.flat, i.name).toBeTruthy();
		for (const t of info.tools) expect(t.source, t.title).not.toMatch(/undefined/);
	});
});
