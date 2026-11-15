// The first start of a Paperless with its own image, as one journey in six
// stations (FirstStart.svelte): the build's steps (own-image.js) and the
// start's (lifecycle.js) mapped onto them, with the typical durations measured
// on Aleph (2026-11-14: builder about 4 min, fetch of 868 MiB about 9 min) and
// the time left from what is known. Only the fetch and the start's steps
// report real progress; everything else is an estimate and said so ("ca.").

/** The stations, in order, with their typical seconds. */
export const STATIONS = Object.freeze([
	{ key: 'wake', typical: 240 },
	{ key: 'check', typical: 20 },
	{ key: 'seal', typical: 100 },
	{ key: 'fetch', typical: 540 },
	{ key: 'store', typical: 60 },
	{ key: 'paperless', typical: 600 }
]);

/** The build's step (own-image.js onProgress) as a station. @param {string} step */
export function stationOfBuildStep(step) {
	if (step === 'start') return 'wake';
	if (step === 'attest') return 'check';
	if (step === 'build') return 'seal';
	if (step === 'fetch') return 'fetch';
	if (step === 'sign' || step === 'upload' || step === 'confirm') return 'store';
	return null;
}

/** The percent in a fetch line ("… (42 %)"), or null. @param {string | undefined} detail */
export function fetchPercent(detail) {
	const m = /(\d{1,3})\s?%/.exec(String(detail ?? ''));
	return m ? Math.min(100, Number(m[1])) : null;
}

/**
 * Where the journey stands: the station, the share done, the seconds left
 * and the time it is expected to end.
 * `hereLeft`: seconds left in this station when they are measured (the
 * fetch at its current speed), instead of the typical time.
 * @param {{ station: string, since: number, now: number, fetchPct?: number | null, startTypical?: number, done?: boolean, hereLeft?: number | null }} a
 */
export function journey({ station, since, now, fetchPct = null, startTypical = STATIONS[5].typical, done = false, hereLeft = null }) {
	const stations = STATIONS.map((s) => (s.key === 'paperless' ? { ...s, typical: startTypical } : s));
	const total = stations.reduce((a, s) => a + s.typical, 0);
	if (done) return { index: stations.length, share: 1, left: 0, ends: now, total };
	const index = Math.max(0, stations.findIndex((s) => s.key === station));
	const here = stations[index];
	const inStation = Math.max(0, (now - since) / 1000);
	// The fetch knows how far it is; the others count their typical time down,
	// and an overrun keeps a minute in hand instead of saying "0".
	const doneHere = station === 'fetch' && fetchPct != null ? (here.typical * fetchPct) / 100 : Math.min(inStation, here.typical * 0.95);
	const before = stations.slice(0, index).reduce((a, s) => a + s.typical, 0);
	const after = stations.slice(index + 1).reduce((a, s) => a + s.typical, 0);
	const left = Math.max(60, (hereLeft != null && Number.isFinite(hereLeft) ? hereLeft : here.typical - doneHere) + after);
	return { index, share: Math.min(0.99, (before + doneHere) / total), left, ends: now + left * 1000, total };
}

// --- What the full screen shows besides the stations -----------------------
//
// `facts` collects what the build and the start report on the way (all
// optional; the view works without them): the builder's V-PROGRAM and node,
// the relay, the measurement the hardware reported, the sealed image's CID
// and size, bytes fetched, connections attested, the STORE, the upload host,
// and for the start the VM's INSTANCE, its step, its attestation.

/** @typedef {{ vprogram?: string, node?: string, relay?: string, measurement?: string, plainSha256?: string, cid?: string, size?: number, got?: number, lanes?: number, attested?: number, fetchSince?: number, storeHash?: string, host?: string, attempt?: number, processed?: boolean, instanceHash?: string, vmStep?: string, vmMeasurement?: string, vmTimeline?: Record<string, any> }} Facts */

const HEX64 = /^[0-9a-f]{64}$/;
const HEXISH = /^[0-9a-f]{32,128}$/i;
const CIDISH = /^[A-Za-z0-9]{40,64}$/;
const HOST = /^[a-z0-9.-]{1,253}(:\d{1,5})?$/i;

/** Which station comes before which. @param {string} a @param {string} b */
const beyond = (a, b) => STATIONS.findIndex((s) => s.key === a) > STATIONS.findIndex((s) => s.key === b);

/** How often the build tries the upload (own-image.js: api2, then api3, then api2). */
export const UPLOAD_TRIES = 3;

/** The start's steps (lifecycle.js), in order. */
export const START_STEPS = Object.freeze(['measure', 'instance', 'network', 'unlock', 'ready']);

/**
 * The small steps of a station, each with its state: 'done', 'active'
 * (blinking) or 'next'. A step is done when a report says so or the station
 * is behind; the first step not done is the active one.
 * @param {string} station the station shown @param {string} current the station the journey is at
 * @param {Facts} f @param {boolean} [done] the whole journey is done
 * @returns {{ key: string, state: 'done' | 'active' | 'next' }[]}
 */
export function substeps(station, current, f, done = false) {
	const past = done || beyond(current, station);
	/** @type {[string, boolean][]} */
	const rows =
		station === 'wake' ? [['ask', Boolean(f.vprogram)], ['boot', false], ['answer', false]]
		: station === 'check' ? [['relay', Boolean(f.relay)], ['report', Boolean(f.measurement)], ['match', Boolean(f.measurement)]]
		: station === 'seal' ? [['send', Boolean(f.cid)], ['verify', Boolean(f.cid)], ['luks', Boolean(f.cid)]]
		: station === 'fetch' ? [['lanes', Boolean(f.attested)], ['bytes', Boolean(f.size && f.got != null && f.got >= f.size)]]
		: station === 'store' ? [['sign', Boolean(f.storeHash)], ['upload', Boolean(f.processed)], ['confirm', Boolean(f.processed)]]
		: START_STEPS.map((s) => [s, Boolean(f.vmStep && START_STEPS.indexOf(f.vmStep) > START_STEPS.indexOf(s))]);
	let activeSet = false;
	return rows.map(([key, ok]) => {
		if (past || ok) return { key, state: /** @type {const} */ ('done') };
		if (station === current && !activeSet) {
			activeSet = true;
			return { key, state: /** @type {const} */ ('active') };
		}
		return { key, state: /** @type {const} */ ('next') };
	});
}

/**
 * What flows where right now, for the animated picture: the path (node keys
 * in order), what it carries, and how far it is (0–1) when that is known.
 * @param {string} current @param {Facts} f @param {number | null} fetchPct
 * @returns {{ path: string[], what: string, share: number | null }}
 */
export function flowNow(current, f, fetchPct) {
	if (current === 'wake') return { path: ['browser', 'aleph', 'node'], what: 'program', share: null };
	if (current === 'check') return { path: ['node', 'relay', 'browser'], what: 'report', share: null };
	if (current === 'seal') return { path: ['browser', 'relay', 'node'], what: 'passphrase', share: null };
	if (current === 'fetch') return { path: ['node', 'relay', 'browser'], what: 'pieces', share: f.size && f.got != null ? Math.min(1, f.got / f.size) : fetchPct != null ? fetchPct / 100 : null };
	if (current === 'store') return { path: ['browser', 'aleph'], what: 'image', share: f.processed ? 1 : null };
	if (f.vmStep === 'unlock') return { path: ['node', 'relay', 'browser'], what: 'vmReport', share: null };
	if (f.vmStep === 'ready') return { path: ['filecoin', 'node'], what: 'backup', share: null };
	return { path: ['browser', 'aleph', 'node'], what: 'instance', share: null };
}

/** MiB/s since the fetch began, or null. @param {Facts} f @param {number} now */
export function fetchRate(f, now) {
	if (!f.fetchSince || !f.got) return null;
	const s = (now - f.fetchSince) / 1000;
	return s > 2 ? f.got / 1048576 / s : null;
}

/**
 * The evidence gathered so far, each with the value and a link to where it
 * can be checked. Only values that look like what they claim become links.
 * @param {Facts} f
 * @param {{ plain?: { sha256: string, store?: string, commit?: string }, measurements?: string[], crn?: string } | null} builder
 * @param {{ aleph: string, repo: string }} at where messages and the source are
 * @returns {{ key: string, value: string, href: string | null, ok?: boolean }[]}
 */
export function evidence(f, builder, at) {
	/** @type {{ key: string, value: string, href: string | null, ok?: boolean }[]} */
	const rows = [];
	const msg = (/** @type {string | undefined} */ h) => (h && HEX64.test(h) ? `${at.aleph}/${h}` : null);
	if (builder?.plain?.commit && /^[0-9a-f]{7,40}$/.test(builder.plain.commit)) rows.push({ key: 'commit', value: builder.plain.commit, href: `${at.repo}/commit/${builder.plain.commit}` });
	if (builder?.plain?.sha256) rows.push({ key: 'plain', value: builder.plain.sha256, href: msg(builder.plain.store) });
	if (builder?.measurements?.[0]) rows.push({ key: 'expected', value: builder.measurements[0], href: `${at.repo}/blob/main/pwa/src/lib/own-image.js` });
	if (f.vprogram) rows.push({ key: 'vprogram', value: f.vprogram, href: msg(f.vprogram) });
	const node = f.node ?? builder?.crn;
	if (node && HEX64.test(node)) rows.push({ key: 'node', value: node, href: null });
	if (f.relay && HOST.test(f.relay)) rows.push({ key: 'relay', value: f.relay, href: null });
	if (f.measurement && HEXISH.test(f.measurement)) rows.push({ key: 'measured', value: f.measurement, href: null, ok: !builder?.measurements?.length || builder.measurements.includes(f.measurement) });
	if (f.cid && CIDISH.test(f.cid)) rows.push({ key: 'cid', value: f.cid, href: null });
	if (f.storeHash) rows.push({ key: 'store', value: f.storeHash, href: msg(f.storeHash), ok: f.processed || undefined });
	if (f.instanceHash) rows.push({ key: 'instance', value: f.instanceHash, href: msg(f.instanceHash) });
	if (f.vmMeasurement && HEXISH.test(f.vmMeasurement)) rows.push({ key: 'vmMeasured', value: f.vmMeasurement, href: null, ok: true });
	return rows;
}

/** The hardware the checks rest on, with the makers' pages. */
export const HARDWARE = Object.freeze([
	{ key: 'sev', href: 'https://www.amd.com/en/developer/sev.html' },
	{ key: 'epyc', href: 'https://www.amd.com/en/products/processors/server/epyc.html' }
]);
