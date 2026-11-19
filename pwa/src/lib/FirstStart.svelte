<script>
	// The first start with an image of one's own, as an event of its own: a
	// full-screen view with six stations (the build, then the start), the
	// time left and when it ends, from the click until Paperless runs, about
	// 25 minutes. It can shrink to a slim bar above the app. While it runs the
	// screen stays on (Wake Lock), leaving the page asks first, and the tab's
	// title carries the progress. At the end: "Geschafft" and the certificate.
	//
	// The view is @le-space/build-journey's, shared with the Belege bridge;
	// here: Paperless's stations, words (i18n/first-start.js), pins
	// (own-image.js) and the certificate.
	import BuildJourney from '@le-space/build-journey/BuildJourney.svelte';
	import ImageCertificate from '$lib/ImageCertificate.svelte';
	import { stationsOf } from '$lib/first-start.js';
	import { ALEPH_MESSAGE, BUILDER, REPOSITORY, UPLOAD_HOSTS } from '$lib/own-image.js';
	import { lang, t } from '$lib/i18n/index.js';

	/**
	 * @type {{
	 *   view: { station: string, since: number, fetchPct: number | null, done: boolean, failed: boolean, minimized: boolean, certificate: boolean, rebuild?: boolean, facts?: import('@le-space/build-journey').Facts },
	 *   startTypical: number,
	 *   host?: string | null,
	 *   ownImage?: any,
	 *   imageHash?: string | null,
	 *   plain?: any,
	 *   texts?: typeof import('$lib/i18n/first-start.js').first.de | null,
	 *   simple?: boolean,
	 *   onminimize: () => void,
	 *   onexpand: () => void,
	 *   oncertificate: (show: boolean) => void,
	 *   onclose: () => void
	 * }}
	 */
	let { view, startTypical, host = null, ownImage = null, imageHash = null, plain = null, texts = null, simple = false, onminimize, onexpand, oncertificate, onclose } = $props();

	// `texts`: other words for the same journey (v0.2's "Standard" speaks plainly);
	// `simple`: without the small steps and the evidence, which stay in the technical view.
	const x = $derived(texts ?? $t.first);
	// A rebuild of the image ends with the build: no Paperless station.
	const stations = $derived(stationsOf({ startTypical, rebuild: Boolean(view.rebuild) }));

	// Where the evidence can be checked: Aleph's messages, the source, and the pin in this app.
	const links = { aleph: ALEPH_MESSAGE, repo: REPOSITORY, expected: `${REPOSITORY}/blob/main/pwa/src/lib/own-image.js` };
	// The picture with Filecoin, where a start restores the backup from.
	/** @type {Record<string, [number, number]>} */
	const places = { browser: [90, 120], relay: [360, 44], node: [630, 120], aleph: [360, 196], filecoin: [630, 210] };
	const lines = [['browser', 'relay'], ['relay', 'node'], ['browser', 'aleph'], ['aleph', 'node'], ['filecoin', 'node']];

	/**
	 * The view's words from Paperless's catalogue, whose texts with values are
	 * functions; a note Paperless has no words for stays out (an empty text).
	 * @param {string} key @param {Record<string, any>} [v]
	 */
	function text(key, v = {}) {
		const r = Boolean(view.rebuild);
		const here = /** @type {any} */ (x.stations)[view.station] ?? x.stations.wake;
		switch (key) {
			case 'kicker': return r ? x.rebuildKicker : x.kicker;
			case 'title': return r ? x.rebuildTitle : x.title;
			case 'doneTitle': return r ? x.rebuildDoneTitle : x.doneTitle;
			case 'doneText': return r ? x.rebuildDoneText : x.doneText;
			case 'failedTitle': return x.pausedTitle;
			case 'failedText': return x.pausedText;
			case 'step': return x.step(v.n, v.of);
			case 'stoppedAt': return `${x.step(v.n, stations.length)} · ${here.duration}`;
			case 'attested': return x.attestedCount(v.count);
			case 'mib': return x.mib(v.got, v.size);
			case 'rate': return x.rate(String(v.rate));
			case 'attempt': return x.attempt(v.n, v.of);
			case 'fetched': return x.fetched(v.pct);
			case 'share': return x.share(v.pct);
			case 'left': return x.left(v.minutes * 60);
			case 'endsAt': return x.endsAt(v.time);
			case 'tab': return x.tab(v.pct);
			case 'marks.lanes': return x.marks?.lanes ? x.marks.lanes(v.count) : '';
			case 'evidenceNone':
			case 'evidenceNoneStopped':
			case 'cameBack':
				return '';
		}
		const [head, ...rest] = key.split('.');
		const root = head === 'places' ? x.nodes : /** @type {any} */ (x)[head];
		const found = rest.reduce((/** @type {any} */ o, k) => o?.[k], root);
		// A note on the picture Paperless has no words for stays out.
		if (head === 'marks') return typeof found === 'string' ? found : '';
		return typeof found === 'string' ? found : key;
	}
</script>

<BuildJourney
	{view}
	{text}
	{stations}
	{simple}
	{places}
	{lines}
	{links}
	locale={$lang === 'de' ? 'de-DE' : 'en-GB'}
	builder={BUILDER}
	uploadHosts={UPLOAD_HOSTS.length}
	miniAt="top"
	testid="first-start"
	finaleEvidence={false}
	openHref={host && !view.rebuild ? `https://${host}` : null}
	oncertificate={ownImage && imageHash ? () => oncertificate(true) : null}
	cover={view.certificate && ownImage && imageHash ? certificate : undefined}
	{onminimize}
	{onexpand}
	{onclose}
/>

{#snippet certificate()}
	<ImageCertificate {ownImage} imageHash={/** @type {string} */ (imageHash)} {plain} onDark onback={() => oncertificate(false)} />
{/snippet}
