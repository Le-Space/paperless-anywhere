import { describe, expect, it } from 'vitest';
import { buildLine } from './build-line.js';
import { texts } from './i18n.js';

const build = { version: 'v1.4.0', commit: 'abc1234', time: '2026-11-13T07:05:09.000Z' };

describe('the build line of the landing page', () => {
	it('names release, build time in UTC and commit, each with its place on GitHub', () => {
		expect(buildLine(build, 'de')).toEqual({
			version: 'v1.4.0',
			releaseHref: 'https://github.com/Le-Space/paperless-anywhere/releases/tag/v1.4.0',
			time: '2026-11-13T07:05:09.000Z',
			timeText: '13.11.2026, 07:05 UTC',
			commit: 'abc1234',
			commitHref: 'https://github.com/Le-Space/paperless-anywhere/commit/abc1234'
		});
	});

	it('writes the date in the page’s language, always in UTC', () => {
		expect(buildLine(build, 'en').timeText).toBe('13/11/2026, 07:05 UTC');
		// Late in the evening in UTC stays that day, whatever the machine's zone.
		expect(buildLine({ ...build, time: '2026-12-31T23:59:00Z' }, 'de').timeText).toBe('31.12.2026, 23:59 UTC');
		expect(buildLine({ ...build, time: '2026-01-01T00:00:00Z' }, 'en').timeText).toBe('01/01/2026, 00:00 UTC');
	});

	it('says "dev" for a build without a release, and links no release then', () => {
		expect(buildLine({ ...build, version: 'dev' }, 'de')).toMatchObject({ version: 'dev', releaseHref: null });
		expect(buildLine({ ...build, version: '' }, 'de')).toMatchObject({ version: 'dev', releaseHref: null });
	});

	it('builds no link from a version or a commit that is not one', () => {
		expect(buildLine({ ...build, version: 'v1"><x' }, 'de').releaseHref).toBeNull();
		expect(buildLine({ ...build, commit: '' }, 'de')).toMatchObject({ commit: '', commitHref: null });
		expect(buildLine({ ...build, commit: 'not-a-sha' }, 'de').commitHref).toBeNull();
		expect(buildLine({ ...build, time: 'never' }, 'de')).toMatchObject({ time: '', timeText: '' });
	});

	it('has its texts in German and English with the same keys', () => {
		expect(Object.keys(texts.en.footer.build)).toEqual(Object.keys(texts.de.footer.build));
		for (const l of /** @type {const} */ (['de', 'en'])) for (const v of Object.values(texts[l].footer.build)) expect(v).toBeTruthy();
	});
});
