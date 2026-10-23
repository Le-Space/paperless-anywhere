import { describe, expect, it } from 'vitest';
import { sharedOrigin } from './shared-origin.js';

describe('sharedOrigin', () => {
	it('is true under a path-style gateway only', () => {
		expect(sharedOrigin('/ipfs/bafyexample/')).toBe(true);
		expect(sharedOrigin('/ipns/paperless.example.com/')).toBe(true);
		expect(sharedOrigin('/')).toBe(false);
		expect(sharedOrigin('/ipfsx/')).toBe(false);
	});
});
