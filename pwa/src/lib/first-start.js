// The first start of a Paperless with its own image, as one journey in six
// stations (FirstStart.svelte): the build's five from @le-space/build-journey,
// shared with the Belege bridge, and Paperless's start after them. Typical
// durations measured on Aleph (2026-11-14: builder about 4 min, fetch of
// 868 MiB about 9 min). What is Paperless's own stays here: the stations with
// its start, and reading a fetch's percent from the build's progress line.

import { buildStations, startStation } from '@le-space/build-journey';

export { evidence, fetchRate, flowNow, HARDWARE, journey, START_STEPS, stationOfBuildStep, substeps, withFacts } from '@le-space/build-journey';

/** The start's typical seconds when the card does not say (about 10 min). */
export const START_TYPICAL = 600;

/**
 * The stations: the build's (the store of an 868 MiB image about a minute),
 * then Paperless's start (the restore comes from Filecoin). A rebuild of the
 * image ends with the build.
 * @param {{ startTypical?: number, rebuild?: boolean }} [o]
 */
export function stationsOf({ startTypical = START_TYPICAL, rebuild = false } = {}) {
	const build = buildStations({ store: 60 });
	return rebuild ? build : [...build, startStation({ key: 'paperless', typical: startTypical, restoreFrom: 'filecoin' })];
}

/** The stations of a first start at their typical times. */
export const STATIONS = Object.freeze(stationsOf());

/** The percent in a fetch line ("… (42 %)"), or null. @param {string | undefined} detail */
export function fetchPercent(detail) {
	const m = /(\d{1,3})\s?%/.exec(String(detail ?? ''));
	return m ? Math.min(100, Number(m[1])) : null;
}
