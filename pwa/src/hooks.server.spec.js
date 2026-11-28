import { describe, expect, it } from 'vitest';
import { pageChunk } from './hooks.server.js';

const shell = (/** @type {string} */ assets) => `<html lang="de">\n\t<head>\n\t\t<link rel="icon" href="${assets}/favicon.svg" type="image/svg+xml" />\n\t</head>`;

describe('what the build writes into a delivered page', () => {
	it('gives the v0.2 preview the early theme script beside the icon, and keeps it out of search engines', () => {
		const html = pageChunk(shell('..'), '/v0.2/');
		expect(html).toContain('<script src="../theme.js"></script>');
		expect(html).toContain('<meta name="robots" content="noindex" />');
		// Last in the head: behind the policy SvelteKit writes there.
		expect(html.indexOf('theme.js')).toBeGreaterThan(html.indexOf('favicon.svg'));
		expect(html).toMatch(/theme\.js"><\/script>\s*<\/head>/);
	});
	it('leaves the app and the landing pages without that script', () => {
		expect(pageChunk(shell('..'), '/app/')).not.toContain('theme.js');
		expect(pageChunk(shell('..'), '/app/')).toContain('noindex');
		expect(pageChunk(shell('.'), '/')).toBe(shell('.'));
		expect(pageChunk(shell('..'), '/en/')).toContain('<html lang="en">');
	});
	it('links the English web app manifest from the English pages, the German one elsewhere', () => {
		const head = (/** @type {string} */ assets) => `<html lang="de">\n\t<head>\n\t\t<link rel="manifest" href="${assets}/manifest.webmanifest" />\n\t</head>`;
		expect(pageChunk(head('..'), '/en/')).toContain('href="../manifest.en.webmanifest"');
		expect(pageChunk(head('.'), '/')).toContain('href="./manifest.webmanifest"');
		expect(pageChunk(head('..'), '/app/')).toContain('href="../manifest.webmanifest"');
	});
});
