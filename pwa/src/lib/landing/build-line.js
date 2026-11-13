// Which build a page is, for the footers of the landing page and the licence
// page: the release, when it was built (UTC, in the page's language) and the
// commit, each with its place on GitHub. From the same `__BUILD__` the app's
// footer shows (vite.config.js), so both name the same build. Pure, and with
// a fixed time zone and numeric parts, so the prerendered HTML and the
// browser write the same text.
//
// The IPFS CID is not here: it is the hash of the built site, this page
// included, so it cannot be known while the page is built. The app's footer
// asks the gateway for it at run time; the release on GitHub names it.

const REPO = 'https://github.com/Le-Space/paperless-anywhere';
const LOCALES = { de: 'de-DE', en: 'en-GB' };

/**
 * @param {{ version: string, commit: string, time: string }} build
 * @param {'de' | 'en'} lang
 */
export function buildLine(build, lang) {
	const version = build.version || 'dev';
	// A release has a tag of its name; a build without a release is "dev".
	const release = version !== 'dev' && /^[\w.+-]+$/.test(version);
	const commit = /^[0-9a-f]{7,40}$/.test(build.commit ?? '') ? build.commit : '';
	const at = new Date(build.time);
	const valid = !Number.isNaN(at.getTime());
	const timeText = valid
		? `${new Intl.DateTimeFormat(LOCALES[lang] ?? LOCALES.de, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' }).format(at)} UTC`
		: '';
	return {
		version,
		releaseHref: release ? `${REPO}/releases/tag/${encodeURIComponent(version)}` : null,
		time: valid ? at.toISOString() : '',
		timeText,
		commit,
		commitHref: commit ? `${REPO}/commit/${commit}` : null
	};
}
