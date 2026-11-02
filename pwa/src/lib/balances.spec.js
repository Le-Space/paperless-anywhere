import { describe, expect, it } from 'vitest';
import { hoursOf, priceFromList } from './balances.js';

// The `instance_confidential` entry of Aleph's price list as of 2026-11-02.
const entry = {
	price: { storage: { credit: '0.17967489030626108' }, compute_unit: { credit: '28500' } },
	tiers: [1, 2, 4, 6, 8, 12].map((n) => ({ id: `tier-${n}`, compute_units: n })),
	compute_unit: { vcpus: 1, disk_mib: 20480, memory_mib: 2048 }
};

describe('priceFromList', () => {
	it('prices Paperless as Aleph does: two units, 40 GiB included', () => {
		expect(priceFromList(entry, { vcpus: 2, memoryMiB: 4096, rootfsSizeMiB: 40 * 1024 })).toBe(57_000);
	});
	it('adds the rootfs beyond what the units include', () => {
		expect(priceFromList(entry, { vcpus: 2, memoryMiB: 4096, rootfsSizeMiB: 80 * 1024 })).toBe(64_359);
	});
	it('rounds up to the next tier', () => {
		expect(priceFromList(entry, { vcpus: 3, memoryMiB: 4096, rootfsSizeMiB: 20 * 1024 })).toBe(4 * 28_500);
	});
	it('refuses a list without a confidential price', () => {
		expect(() => priceFromList(undefined, { vcpus: 2, memoryMiB: 4096, rootfsSizeMiB: 1 })).toThrow();
	});
});

describe('hoursOf', () => {
	it('counts the hours at the given spend', () => {
		expect(hoursOf(1_368_000, 57_000)).toBe(24);
		expect(hoursOf(100, 0)).toBe(0);
	});
});
