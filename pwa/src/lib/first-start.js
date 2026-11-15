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
 * @param {{ station: string, since: number, now: number, fetchPct?: number | null, startTypical?: number, done?: boolean }} a
 */
export function journey({ station, since, now, fetchPct = null, startTypical = STATIONS[5].typical, done = false }) {
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
	const left = Math.max(60, here.typical - doneHere + after);
	return { index, share: Math.min(0.99, (before + doneHere) / total), left, ends: now + left * 1000, total };
}
