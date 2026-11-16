// How fast a loss shows under Proof of Data Possession: 1 − (1 − f)^(k·n).
import { describe, expect, it } from 'vitest';
import { detected, DETECTION_ROWS, PDP } from './pdp.js';

describe('the chance a loss shows', () => {
	it('uses the warm storage service’s parameters', () => {
		expect(PDP).toMatchObject({ leafBytes: 32, challenges: 5, periodEpochs: 2880, windowEpochs: 60, epochSeconds: 30 });
		expect((PDP.periodEpochs * PDP.epochSeconds) / 3600).toBe(24);
		expect((PDP.windowEpochs * PDP.epochSeconds) / 60).toBe(30);
	});
	it('is certain for a lost copy, and grows with time for small damage', () => {
		expect(detected(1, 1)).toBe(1);
		expect(detected(0.1, 1)).toBeCloseTo(0.40951, 5);
		expect(detected(0.01, 30)).toBeCloseTo(0.778548, 5);
		expect(detected(0.001, 7)).toBeCloseTo(0.034411, 5);
		expect(DETECTION_ROWS.map((r) => r.f)).toEqual([1, 0.1, 0.01, 0.001]);
	});
});
