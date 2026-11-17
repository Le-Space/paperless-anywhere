// Aleph compute nodes (CRNs) Le Space takes out of the choice of a node, with
// the reason, and the order in which the start tries the others. Aleph's node
// list says what each node reports about itself (`confidential_support`); a
// node can claim it and still refuse every confidential VM. Such a node costs
// a customer the start (and, at a first start, waits after a 25-minute image
// build), so it is listed here and never picked, nor shown as free on the
// landing page.
//
// Node hashes are public (Aleph's node list). Like blocked-providers.js.

// No imports: the landing page uses it too (tee-nodes.js).

/** @typedef {'noSevSnp'} NodeBlockReason the key of the reason's text (card.nodeRefused): "noSevSnp", in Nico's words "meldet SEV-SNP, kann es nicht" */

/** @type {Readonly<Record<string, NodeBlockReason>>} */
export const BLOCKED_NODES = Object.freeze({
	// "Leviathan CRN11" (crn11.leviathan.so): listed with confidential_support
	// true, but refused a start on 2026-11-16 with VmSetupError('this host does
	// not support SEV-SNP').
	'6f3d9f424fa8d9362a0584097a02b864638451c7acad7badccf657850477039b': 'noSevSnp'
});

/** Why a node is blocked, or null. @param {string | null | undefined} hash @returns {NodeBlockReason | null} */
export const nodeBlockedReason = (hash) => BLOCKED_NODES[String(hash ?? '').toLowerCase()] ?? null;

/**
 * How long a node that refused a start for another reason (the allocation
 * refused, not "no SEV-SNP") is left out: it may have been full or restarting.
 * The same for a node where the VM could not seal its data area (`dataArea`,
 * paperless-data-disk): its disk may have been short of room.
 */
export const REFUSED_PAUSE_MS = 24 * 60 * 60 * 1000;

/**
 * @typedef {{ hash: string, reason: 'noSevSnp' | 'refused' | 'dataArea', at: number }} UnsuitableNode
 * A node this vault saw refuse a start, kept in the profile (`unsuitableNodes`).
 */

/**
 * The nodes this profile leaves out: those it saw refuse SEV-SNP, and for a
 * day those that refused the allocation otherwise or failed the data area.
 * @param {Record<string, any> | null | undefined} profile @param {number} [now]
 * @returns {Set<string>}
 */
export function avoidedNodes(profile, now = Date.now()) {
	/** @type {UnsuitableNode[]} */
	const list = Array.isArray(profile?.unsuitableNodes) ? profile.unsuitableNodes : [];
	return new Set(list.filter((n) => n?.hash && ((n.reason !== 'refused' && n.reason !== 'dataArea') || now - Number(n.at ?? 0) < REFUSED_PAUSE_MS)).map((n) => String(n.hash).toLowerCase()));
}

/**
 * The profile with `hash` noted as unsuitable (replacing an earlier note of it).
 * @param {Record<string, any>} profile @param {string} hash @param {'noSevSnp' | 'refused' | 'dataArea'} reason @param {number} [at]
 */
export function noteUnsuitable(profile, hash, reason, at = Date.now()) {
	const h = String(hash).toLowerCase();
	const earlier = (Array.isArray(profile?.unsuitableNodes) ? profile.unsuitableNodes : []).filter((n) => String(n?.hash ?? '').toLowerCase() !== h);
	return { ...profile, unsuitableNodes: [...earlier, { hash: h, reason, at }] };
}

/**
 * Nodes where a start was attested already: the node of the running VM once
 * it was attested, the nodes noted after earlier attested starts
 * (`provenNodes`), and the builder's node, which runs SEV-SNP for every build.
 * @param {Record<string, any> | null | undefined} profile @param {{ builder?: { crn?: string } | null }} [o] the builder (own-image.js BUILDER)
 * @returns {Set<string>}
 */
export function provenNodes(profile, { builder = null } = {}) {
	const out = new Set((Array.isArray(profile?.provenNodes) ? profile.provenNodes : []).map((h) => String(h).toLowerCase()));
	if (profile?.running?.crnHash && profile.running.attestation) out.add(String(profile.running.crnHash).toLowerCase());
	if (builder?.crn) out.add(String(builder.crn).toLowerCase());
	return out;
}

/** The profile with `hash` noted as proven (once). @param {Record<string, any>} profile @param {string | null | undefined} hash */
export function noteProven(profile, hash) {
	const h = String(hash ?? '').toLowerCase();
	const list = Array.isArray(profile?.provenNodes) ? profile.provenNodes : [];
	if (!/^[0-9a-f]{64}$/.test(h) || list.includes(h)) return profile;
	return { ...profile, provenNodes: [...list, h] };
}

/**
 * The order a start tries nodes in: those blocked by Le Space or avoided by
 * this profile left out, proven nodes first, each group in the list's order
 * (best score first).
 * @template {{ hash: string }} N
 * @param {N[]} nodes @param {{ avoid?: Set<string>, proven?: Set<string> }} [o]
 * @returns {N[]}
 */
export function rankNodes(nodes, { avoid = new Set(), proven = new Set() } = {}) {
	const usable = nodes.filter((n) => !nodeBlockedReason(n.hash) && !avoid.has(String(n.hash).toLowerCase()));
	const isProven = (/** @type {N} */ n) => proven.has(String(n.hash).toLowerCase());
	return [...usable.filter(isProven), ...usable.filter((n) => !isProven(n))];
}
