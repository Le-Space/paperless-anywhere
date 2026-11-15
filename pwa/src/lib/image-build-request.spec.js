// The setup's build goes through the Paperless card's full screen.
import { describe, expect, it } from 'vitest';
import { onImageBuild, requestImageBuild } from './image-build-request.js';

describe('a build asked for outside the Paperless card', () => {
	it('is refused in words while no card listens', async () => {
		await expect(requestImageBuild()).rejects.toThrow('Die Paperless-Karte ist gerade nicht bereit');
	});
	it('goes to the card while it listens, and not after it left', async () => {
		let asked = 0;
		const off = onImageBuild(async () => (asked++, true));
		expect(await requestImageBuild()).toBe(true);
		expect(asked).toBe(1);
		off();
		await expect(requestImageBuild()).rejects.toThrow();
	});
});
