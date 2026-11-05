import { describe, expect, it } from 'vitest';
import { teeNodes } from './tee-nodes.js';

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
});
