import { describe, expect, it } from 'vitest';
import { framed, sharedOrigin } from './shared-origin.js';

describe('sharedOrigin', () => {
	it('is true under a path-style gateway only', () => {
		expect(sharedOrigin('/ipfs/bafyexample/')).toBe(true);
		expect(sharedOrigin('/ipns/paperless.example.com/')).toBe(true);
		expect(sharedOrigin('/')).toBe(false);
		expect(sharedOrigin('/ipfsx/')).toBe(false);
	});
});

describe('framed', () => {
	it('is false for a page on its own', () => {
		const win = {};
		win.top = win;
		win.self = win;
		expect(framed(win)).toBe(false);
	});
	it('is true inside another page', () => {
		const win = { top: {} };
		win.self = win;
		expect(framed(win)).toBe(true);
	});
	it('is true when the browser will not say', () => {
		const win = { self: {} };
		Object.defineProperty(win, 'top', { get: () => { throw new Error('blocked'); } });
		expect(framed(win)).toBe(true);
	});
});
