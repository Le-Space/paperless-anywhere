import { describe, expect, it } from 'vitest';
import { flag, teeNodes, operatorCount } from './tee-nodes.js';

const GiB = 1024 ** 2; // in kB
const node = (over = {}) => ({
	hash: 'a'.repeat(64),
	name: 'Wolkenfabrik Node',
	score: 0.9,
	confidential_support: true,
	system_usage: { active: true, cpu: { count: 8, load_average: { load1: 1.5 } }, mem: { available_kB: 16 * GiB }, disk: { available_kB: 500 * GiB } },
	...over
});

describe('teeNodes', () => {
	it('keeps only confidential-capable, active nodes', () => {
		const list = teeNodes({ crns: [node(), node({ confidential_support: false }), node({ system_usage: { active: false } })] });
		expect(list).toHaveLength(1);
		expect(list[0]).toMatchObject({ name: 'Wolkenfabrik Node', freeVcpus: 6, freeMemoryGiB: 16, freeDiskGiB: 500, fits: true });
	});

	it('says whether the Paperless VM (2 vCPU, 4 GiB, 40 GiB) fits', () => {
		const small = node({ system_usage: { cpu: { count: 4, load_average: { load1: 1 } }, mem: { available_kB: 3 * GiB }, disk: { available_kB: 100 * GiB } } });
		expect(teeNodes({ crns: [small] })[0].fits).toBe(false);
	});

	it('sorts by score and names a nameless node by its hash', () => {
		const list = teeNodes({ crns: [node({ score: 0.2, name: '', hash: 'b'.repeat(64) }), node({ score: 0.8 })] });
		expect(list.map((n) => n.name)).toEqual(['Wolkenfabrik Node', 'bbbbbbbb']);
	});

	it('copes with an empty or odd answer', () => {
		expect(teeNodes(null)).toEqual([]);
		expect(teeNodes({ crns: [{ confidential_support: true }] })[0]).toMatchObject({ freeVcpus: 0, fits: false });
	});

	it('adds where a node stands, when known', () => {
		const list = teeNodes({ crns: [node(), node({ hash: 'c'.repeat(64) })] }, { ['a'.repeat(64)]: { country: 'FR', city: 'Exampleville' } });
		expect(list.map((n) => n.place)).toEqual([{ country: 'FR', city: 'Exampleville' }, null]);
	});
});

describe('flag', () => {
	it('turns a country code into its flag, anything else into nothing', () => {
		expect(flag('FR')).toBe('🇫🇷');
		expect(flag('de')).toBe('');
		expect(flag(null)).toBe('');
	});
});

describe('operatorCount', () => {
	const node = (hash, owner) => ({ hash, owner });
	it('counts the accounts that run the nodes, whatever their spelling', () => {
		expect(operatorCount(/** @type {any} */ ([node('a', '0xaa'), node('b', '0xaa'), node('c', '0xbb')]))).toBe(2);
		expect(teeNodes({ crns: [{ hash: 'a', owner: '0xAbC', confidential_support: true }, { hash: 'b', owner: '0xabc', confidential_support: true }] }).map((n) => n.owner)).toEqual(['0xabc', '0xabc']);
	});
	it('takes a node without a named operator as one of its own', () => {
		expect(operatorCount(/** @type {any} */ ([node('a', ''), node('b', ''), node('c', '0xbb')]))).toBe(3);
		expect(operatorCount([])).toBe(0);
	});
});
