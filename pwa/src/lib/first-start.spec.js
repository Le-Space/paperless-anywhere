// The first start's journey: stations, share done, time left.
import { describe, expect, it } from 'vitest';
import { fetchPercent, journey, STATIONS, stationOfBuildStep } from './first-start.js';
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
		const begin = journey({ station: 'wake', since: at, now: at });
		expect(Math.round(begin.total / 60)).toBe(26);
		expect(begin.index).toBe(0);
		expect(begin.share).toBe(0);
		expect(Math.round(begin.left / 60)).toBe(26);
		// Halfway through the fetch: its own share is real, the rest is typical time.
		const fetch = journey({ station: 'fetch', since: at, now: at + 60_000, fetchPct: 50 });
		expect(fetch.index).toBe(3);
		expect(Math.round(fetch.left / 60)).toBe(16);
		expect(fetch.ends).toBe(at + 60_000 + fetch.left * 1000);
	});

	it('never says zero while running, and is complete when done', () => {
		const late = journey({ station: 'paperless', since: 0, now: 3_600_000 });
		expect(late.left).toBeGreaterThanOrEqual(60);
		expect(late.share).toBeLessThan(1);
		expect(journey({ station: 'paperless', since: 0, now: 1, done: true })).toMatchObject({ index: STATIONS.length, share: 1, left: 0 });
	});

	it('has a title, a text and a duration for every station, in German and English', () => {
		for (const l of /** @type {const} */ (['de', 'en'])) for (const s of STATIONS) expect(Object.keys(/** @type {any} */ (catalogue[l].first.stations)[s.key]).sort()).toEqual(['duration', 'label', 'mini', 'text', 'title']);
	});
});
