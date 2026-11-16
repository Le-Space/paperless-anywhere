import { describe, expect, it } from 'vitest';
import { blockedAmong, blockedReason } from './blocked-providers.js';

describe('the blocked providers', () => {
	it('are 36 and 37 (FIDL) on mainnet, and nothing on Calibration', () => {
		expect(blockedReason('mainnet', 36)).toBe('fidl');
		expect(blockedReason('mainnet', 37)).toBe('fidl');
		expect(blockedReason('mainnet', 43)).toBeNull();
		expect(blockedReason('calibration', 36)).toBeNull();
		expect(blockedAmong('mainnet', [36, 43, 1, 37])).toEqual([36, 37]);
	});
});
