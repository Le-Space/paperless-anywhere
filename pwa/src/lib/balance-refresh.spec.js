import { describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { AUTO_MIN_MS, balancesRound, onceThisRound, refreshBalances, refreshBalancesSoon } from './balance-refresh.js';

describe('balance rounds', () => {
	it('a refresh starts a new round; an automatic one at most every 30 s', () => {
		const start = get(balancesRound);
		refreshBalances(1_000_000);
		expect(get(balancesRound)).toBe(start + 1);
		expect(refreshBalancesSoon(1_000_000 + AUTO_MIN_MS - 1)).toBe(false);
		expect(refreshBalancesSoon(1_000_000 + AUTO_MIN_MS)).toBe(true);
		expect(get(balancesRound)).toBe(start + 2);
	});
	it('reads once per round and again in the next', async () => {
		const read = vi.fn(async () => 42);
		await onceThisRound('credits', read);
		await onceThisRound('credits', read);
		expect(read).toHaveBeenCalledTimes(1);
		refreshBalances();
		await onceThisRound('credits', read);
		expect(read).toHaveBeenCalledTimes(2);
	});
	it('keeps no failure', async () => {
		const read = vi.fn().mockImplementationOnce(async () => {
			throw new Error('down');
		});
		read.mockImplementation(async () => 1);
		await expect(onceThisRound('x', read)).rejects.toThrow('down');
		await expect(onceThisRound('x', read)).resolves.toBe(1);
	});
});
