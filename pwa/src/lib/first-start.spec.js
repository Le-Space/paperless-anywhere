// The first start's journey: Paperless's stations on @le-space/build-journey, share done, time left.
import { describe, expect, it } from 'vitest';
import { fetchPercent, journey, STATIONS, stationOfBuildStep, stationsOf } from './first-start.js';
import { catalogue } from './i18n/index.js';

describe('the first start as a journey', () => {
	it('maps the build’s steps onto the stations', () => {
		expect(['start', 'attest', 'build', 'fetch', 'sign', 'upload', 'confirm', 'other'].map(stationOfBuildStep)).toEqual(['wake', 'check', 'seal', 'fetch', 'store', 'store', 'store', null]);
		expect(fetchPercent('Versiegeltes Image holen (42 %)')).toBe(42);
		expect(fetchPercent('Fetching the sealed image (7 %)')).toBe(7);
		expect(fetchPercent('Image wird versiegelt')).toBeNull();
	});

	it('takes about 25 minutes in all, and counts down from there', () => {
		const at = 1_000_000;
		const begin = journey({ stations: STATIONS, station: 'wake', since: at, now: at });
		expect(Math.round(begin.total / 60)).toBe(26);
		expect(begin.index).toBe(0);
		expect(begin.share).toBe(0);
		expect(Math.round(begin.left / 60)).toBe(26);
		// Halfway through the fetch: its own share is real, the rest is typical time.
		const fetch = journey({ stations: STATIONS, station: 'fetch', since: at, now: at + 60_000, fetchPct: 50 });
		expect(fetch.index).toBe(3);
		expect(Math.round(fetch.left / 60)).toBe(16);
		expect(fetch.ends).toBe(at + 60_000 + fetch.left * 1000);
	});

	it('never says zero while running, and is complete when done', () => {
		const late = journey({ stations: STATIONS, station: 'paperless', since: 0, now: 3_600_000 });
		expect(late.left).toBeGreaterThanOrEqual(60);
		expect(late.share).toBeLessThan(1);
		expect(journey({ stations: STATIONS, station: 'paperless', since: 0, now: 1, done: true })).toMatchObject({ index: STATIONS.length, share: 1, left: 0 });
	});

	it('ends a rebuild with the build, and takes the start’s time from the card', () => {
		expect(stationsOf({ rebuild: true }).map((s) => s.key)).toEqual(['wake', 'check', 'seal', 'fetch', 'store']);
		expect(stationsOf({ startTypical: 300 }).at(-1)).toMatchObject({ key: 'paperless', typical: 300 });
	});

	it('has a title, a text and a duration for every station, in German and English', () => {
		for (const l of /** @type {const} */ (['de', 'en'])) for (const s of STATIONS) expect(Object.keys(/** @type {any} */ (catalogue[l].first.stations)[s.key]).sort()).toEqual(['duration', 'label', 'mini', 'text', 'title']);
	});
});

import { evidence, fetchRate, flowNow, substeps } from './first-start.js';

describe('what the full screen shows besides the stations', () => {
	it('lights the small steps: done from reports or behind, the next one blinking', () => {
		const at = (/** @type {string} */ station, /** @type {string} */ current, /** @type {any} */ facts) => substeps({ stations: STATIONS, station, current, facts });
		expect(at('check', 'check', { relay: 'relay.example.com' })).toEqual([
			{ key: 'relay', state: 'done' },
			{ key: 'report', state: 'active' },
			{ key: 'match', state: 'next' }
		]);
		expect(at('wake', 'fetch', {}).every((s) => s.state === 'done')).toBe(true);
		expect(at('paperless', 'paperless', { vmStep: 'unlock' }).map((s) => s.state)).toEqual(['done', 'done', 'done', 'active', 'next']);
	});

	it('says what flows where, with how far the fetch is', () => {
		const now = (/** @type {string} */ station, /** @type {any} */ facts) => flowNow({ stations: STATIONS, station, facts });
		expect(now('fetch', { got: 434 * 1048576, size: 868 * 1048576 })).toEqual({ path: ['node', 'relay', 'browser'], what: 'pieces', share: 0.5 });
		expect(now('seal', {}).path).toEqual(['browser', 'relay', 'node']);
		expect(now('paperless', { vmStep: 'ready' }).what).toBe('backup');
	});

	it('measures the fetch’s speed and counts the time left from it', () => {
		const at = 1_000_000;
		const f = { got: 100 * 1048576, size: 868 * 1048576, fetchSince: at };
		expect(fetchRate(f, at + 50_000)).toBeCloseTo(2, 5);
		expect(fetchRate(f, at + 1000)).toBeNull();
		// 768 MiB at 2 MiB/s is 384 s, plus the typical store and start.
		expect(journey({ stations: STATIONS, station: 'fetch', since: at, now: at + 50_000, facts: f }).left).toBe(384 + 60 + 600);
	});

	it('links only what looks like what it claims, and says when a measurement matches', () => {
		const builder = { plain: { sha256: 'a'.repeat(64), store: 'b'.repeat(64), commit: 'c'.repeat(40) }, measurements: ['d'.repeat(96)], crn: 'e'.repeat(64) };
		const rows = evidence({ measurement: 'd'.repeat(96), storeHash: 'f'.repeat(64), processed: true, vprogram: 'not a hash' }, builder, { aleph: 'https://api.example.com/messages', repo: 'https://github.com/example/repo' });
		const by = Object.fromEntries(rows.map((r) => [r.key, r]));
		expect(by.commit.href).toBe(`https://github.com/example/repo/commit/${'c'.repeat(40)}`);
		expect(by.plain.href).toBe(`https://api.example.com/messages/${'b'.repeat(64)}`);
		expect(by.measured.ok).toBe(true);
		expect(by.store).toMatchObject({ href: `https://api.example.com/messages/${'f'.repeat(64)}`, ok: true });
		expect(by.vprogram.href).toBeNull();
		expect(by.node.href).toBeNull();
		expect(evidence({ measurement: '0'.repeat(96) }, builder, { aleph: 'a', repo: 'r' }).find((r) => r.key === 'measured')?.ok).toBe(false);
	});
});
