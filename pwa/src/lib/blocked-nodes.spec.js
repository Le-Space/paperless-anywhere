// Nodes Le Space blocks, the ones a vault saw refuse a start, and the order a
// start tries nodes in. Node hashes are public; the others are made up.
import { describe, expect, it } from 'vitest';
import { BLOCKED_NODES, REFUSED_PAUSE_MS, avoidedNodes, nodeBlockedReason, noteProven, noteUnsuitable, provenNodes, rankNodes } from './blocked-nodes.js';
import { teeNodes } from './landing/tee-nodes.js';

const LEVIATHAN_CRN11 = '6f3d9f424fa8d9362a0584097a02b864638451c7acad7badccf657850477039b';
const BUILDER_NODE = '01a3143b384ca43a3af338031b03ae86c0a4e139a24b848475d3ddb9bfbce8fa';
const A = 'a'.repeat(64);
const B = 'b'.repeat(64);
const C = 'c'.repeat(64);

describe('blocked nodes', () => {
	it('blocks Leviathan CRN11: it reports SEV-SNP but cannot run it', () => {
		expect(nodeBlockedReason(LEVIATHAN_CRN11)).toBe('noSevSnp');
		expect(nodeBlockedReason(LEVIATHAN_CRN11.toUpperCase())).toBe('noSevSnp');
		expect(BLOCKED_NODES[LEVIATHAN_CRN11]).toBe('noSevSnp');
		expect(nodeBlockedReason(A)).toBeNull();
		expect(nodeBlockedReason(null)).toBeNull();
	});

	it('leaves a blocked node out of the confidential nodes, though the list claims support', () => {
		const usage = { cpu: { count: 16, load_average: { load1: 0 } }, mem: { available_kB: 64 * 1024 ** 2 }, disk: { available_kB: 500 * 1024 ** 2 }, active: true };
		const body = { crns: [{ hash: LEVIATHAN_CRN11, name: 'Leviathan CRN11', score: 0.99, confidential_support: true, system_usage: usage }, { hash: A, name: 'Other', score: 0.5, confidential_support: true, system_usage: usage }] };
		expect(teeNodes(body).map((n) => n.hash)).toEqual([A]);
	});
});

describe('nodes a vault saw refuse a start', () => {
	it('notes a node with its reason and time, once', () => {
		let p = noteUnsuitable({}, A, 'refused', 1000);
		p = noteUnsuitable(p, A.toUpperCase(), 'noSevSnp', 2000);
		expect(p.unsuitableNodes).toEqual([{ hash: A, reason: 'noSevSnp', at: 2000 }]);
	});

	it('avoids a node without SEV-SNP for good, a refusing one for a day', () => {
		const now = 10 * REFUSED_PAUSE_MS;
		const p = { unsuitableNodes: [{ hash: A, reason: 'noSevSnp', at: 0 }, { hash: B, reason: 'refused', at: now - 1000 }, { hash: C, reason: 'refused', at: now - REFUSED_PAUSE_MS - 1 }] };
		expect([...avoidedNodes(p, now)].sort()).toEqual([A, B]);
		expect(avoidedNodes({}).size).toBe(0);
	});
});

describe('proven nodes', () => {
	it('are the attested running node, the noted ones and the builder’s node', () => {
		const p = { running: { crnHash: A, attestation: { measurement: 'm' } }, provenNodes: [B] };
		expect([...provenNodes(p, { builder: { crn: BUILDER_NODE } })].sort()).toEqual([A, B, BUILDER_NODE].sort());
	});

	it('do not include a running node that was never attested', () => {
		expect(provenNodes({ running: { crnHash: A } }).has(A)).toBe(false);
	});

	it('are noted once, and only real node hashes', () => {
		const p = noteProven(noteProven({}, A), A);
		expect(p.provenNodes).toEqual([A]);
		expect(noteProven(p, 'not-a-hash')).toBe(p);
	});
});

describe('rankNodes', () => {
	const nodes = [{ hash: LEVIATHAN_CRN11 }, { hash: A }, { hash: B }, { hash: BUILDER_NODE }, { hash: C }];

	it('puts proven nodes first, keeps the list order otherwise, and leaves blocked and avoided ones out', () => {
		const ranked = rankNodes(nodes, { avoid: new Set([C]), proven: new Set([BUILDER_NODE, B]) });
		expect(ranked.map((n) => n.hash)).toEqual([B, BUILDER_NODE, A]);
	});

	it('never offers the blocked node, even as the only one', () => {
		expect(rankNodes([{ hash: LEVIATHAN_CRN11 }], { proven: new Set([LEVIATHAN_CRN11]) })).toEqual([]);
	});
});
