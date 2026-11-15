import { describe, expect, it, beforeEach, vi } from 'vitest';
import { isNetworkError, loadAttestWasm, resetAttestWasm } from './attest-wasm-load.js';

const wait = () => Promise.resolve();

describe('isNetworkError', () => {
	it('knows the browsers’ words for a broken connection', () => {
		expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true);
		expect(isNetworkError(new Error('WebAssembly compilation aborted: Network error: Response body loading was aborted'))).toBe(true);
		expect(isNetworkError(new TypeError('NetworkError when attempting to fetch resource.'))).toBe(true);
		expect(isNetworkError(new TypeError('Load failed'))).toBe(true);
		expect(isNetworkError(new Error('net::ERR_NETWORK_CHANGED'))).toBe(true);
		expect(isNetworkError(new Error('api2.aleph.im nicht erreichbar (VM lesen, 3 Versuche: Failed to fetch). Verbindung prüfen und erneut versuchen.'))).toBe(true);
	});
	it('leaves answers alone', () => {
		expect(isNetworkError(new Error('Aleph refused the INSTANCE (422): {}'))).toBe(false);
		expect(isNetworkError(new Error('the node did not take the instance: no room'))).toBe(false);
		expect(isNetworkError(null)).toBe(false);
	});
});

describe('loadAttestWasm', () => {
	beforeEach(() => resetAttestWasm());

	it('tries again after a broken connection', async () => {
		const load = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce('wasm');
		await expect(loadAttestWasm({ load, wait })).resolves.toBe('wasm');
		expect(load).toHaveBeenCalledTimes(2);
	});
	it('loads once per page', async () => {
		const load = vi.fn().mockResolvedValue('wasm');
		await loadAttestWasm({ load, wait });
		await loadAttestWasm({ load, wait });
		expect(load).toHaveBeenCalledTimes(1);
	});
	it('gives up after its tries and loads anew on the next call', async () => {
		const load = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
		await expect(loadAttestWasm({ load, wait, tries: 3 })).rejects.toThrow('Failed to fetch');
		expect(load).toHaveBeenCalledTimes(3);
		load.mockResolvedValueOnce('wasm');
		await expect(loadAttestWasm({ load, wait })).resolves.toBe('wasm');
	});
	it('does not repeat an error that is not the network', async () => {
		const load = vi.fn().mockRejectedValue(new Error('CompileError: bad magic'));
		await expect(loadAttestWasm({ load, wait })).rejects.toThrow('bad magic');
		expect(load).toHaveBeenCalledTimes(1);
	});
});
