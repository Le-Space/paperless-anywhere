import { describe, expect, it } from 'vitest';
import { currentVersion, ownImageVersions } from './own-image-versions.js';
import { BUILDER } from './own-image.js';

describe('own-image versions', () => {
	it('lists the builder fixed in the app first, by its plain image and workload', () => {
		const v = ownImageVersions();
		expect(v.versions[0]).toEqual(currentVersion());
		expect(v.versions[0].plainSha256).toBe(BUILDER.plain.sha256);
		expect(v.versions[0].builder).toMatch(/^[0-9a-f]{64}$/);
	});
	it('keeps earlier versions after it, once each', () => {
		const builder = { plain: { sha256: 'b'.repeat(64) }, program: { workload: { roothash: 'c'.repeat(64) } } };
		const previous = [{ plainSha256: 'a'.repeat(64), builder: 'd'.repeat(64), since: '2026-11-01' }, { plainSha256: 'b'.repeat(64), builder: 'c'.repeat(64), since: '2026-11-13' }];
		expect(ownImageVersions(builder, previous).versions.map((v) => v.plainSha256)).toEqual(['b'.repeat(64), 'a'.repeat(64)]);
	});
	it('lists nothing without a builder', () => {
		expect(ownImageVersions(null, []).versions).toEqual([]);
	});
});
