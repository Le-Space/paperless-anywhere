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
	// Plain image of main 57456e7 (#324), the builder with backups bound to
	// the vault, current in v0.1.88 to v0.1.100.
	{ plainSha256: 'f08aeec9d1d37bb9a79e4cbe8d7614d58dadca0b527fb4027503313a02610753', builder: 'a86558ef9da93c51770bf3b8198310e01c0921f0b816eb4e532a87f81286bab1', since: '2026-11-16' },
	// Plain image of main 4c68659 (#317), the builder with the signed claim,
	// current in v0.1.86 and v0.1.87.
	{ plainSha256: 'd64a18e73a704e603a7aa8dd6cf0f55423627d90a25e9b60b8ecc62df415dd0e', builder: '775b7c70d0a510a761babe2a3dcf63220b16a20e3e83177c90c0e47e9c86f452', since: '2026-11-16' },
	// Plain image of main d824eb4 (#309), builder of the morning of 2026-11-16,
	// current for about an hour before the builder with the signed claim.
	{ plainSha256: '78025bceb6385d577cfe745603fb2f5c9a0f37d4116d75fe57491a454994cff8', builder: '4b471fe610a5ffe6f4cf39ff171024e72bfd980b5f58b5122c10b6acffbf49a9', since: '2026-11-16' },
	// Release e85b9c9a…, builder of 2026-11-14: apps still on the release before
	// 2026-11-16 build this one. Its builder's volumes stay until those apps are gone.
	{ plainSha256: 'ea56e682870cbb1f0972c60c13b13a6d80ec941f09d39332130fef165f6e8518', builder: 'ac72e745bca84a1644dc0379d43e282e3b36ed07281807a87b04c0c15ca815b6', since: '2026-11-13' }
];

/** The current version, from the builder fixed in the app. */
export function currentVersion(builder = BUILDER, since = '2026-11-17') {
	if (!builder?.plain?.sha256) return null;
	const root = builder.program?.workload?.verification?.roothash ?? builder.program?.workload?.roothash ?? '';
	return { plainSha256: builder.plain.sha256, builder: String(root), since };
}

/** The published list: the current version first. */
export function ownImageVersions(builder = BUILDER, previous = PREVIOUS_VERSIONS) {
	const now = currentVersion(builder);
	return { versions: [...(now ? [now] : []), ...previous.filter((v) => v.plainSha256 !== now?.plainSha256)] };
}
