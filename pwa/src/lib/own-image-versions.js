// The image versions whose own-image build Le Space includes (with a running
// package or a voucher: until one build succeeds, at most 3 tries, again for
// each new version). Published at /own-image.json; Le Space Credits reads it
// and charges for a version not listed, so a made-up version builds nothing
// for free. A version is the plain image's SHA-256; the builder's workload
// root hash is listed for reference. Keep the previous version for a while,
// so a customer still on the last release keeps their included build.
import { BUILDER } from './own-image.js';

/** @type {{ plainSha256: string, builder: string, since: string }[]} versions before the current one, newest first */
export const PREVIOUS_VERSIONS = [
	// Release e85b9c9a…, builder of 2026-11-14: apps still on the release before
	// 2026-11-16 build this one. Its builder's volumes stay until those apps are gone.
	{ plainSha256: 'ea56e682870cbb1f0972c60c13b13a6d80ec941f09d39332130fef165f6e8518', builder: 'ac72e745bca84a1644dc0379d43e282e3b36ed07281807a87b04c0c15ca815b6', since: '2026-11-13' }
];

/** The current version, from the builder fixed in the app. */
export function currentVersion(builder = BUILDER, since = '2026-11-16') {
	if (!builder?.plain?.sha256) return null;
	const root = builder.program?.workload?.verification?.roothash ?? builder.program?.workload?.roothash ?? '';
	return { plainSha256: builder.plain.sha256, builder: String(root), since };
}

/** The published list: the current version first. */
export function ownImageVersions(builder = BUILDER, previous = PREVIOUS_VERSIONS) {
	const now = currentVersion(builder);
	return { versions: [...(now ? [now] : []), ...previous.filter((v) => v.plainSha256 !== now?.plainSha256)] };
}
