// The content security policy every page carries (svelte.config.js): present
// in the HTML itself, without the loopholes that would undo it, and nothing on
// the pages runs into it.
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const PAGES = ['/', '/en/', '/lizenzen/', '/app/'];

test('every page carries the policy in its HTML, and it allows no inline script, eval or foreign source', async ({ request }) => {
	// The fallback page for unknown paths is checked as the file the build wrote.
	const sources = [...PAGES.map((path) => ({ path, html: request.get(path).then((r) => r.text()) })), { path: 'build/200.html', html: readFile(new URL('../build/200.html', import.meta.url), 'utf8') }];
	for (const { path, html: loading } of sources) {
		const html = await loading;
		const policy = /<meta http-equiv="content-security-policy" content="([^"]+)"/.exec(html)?.[1] ?? '';
		expect(policy, path).not.toBe('');
		const directive = (name) => (policy.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${name} `)) ?? '').slice(name.length + 1);
		expect(directive('default-src'), path).toBe("'self'");
		// Scripts: this build's files, WebAssembly, and the one start-up script by its hash.
		expect(directive('script-src'), path).toMatch(/^'self' 'wasm-unsafe-eval' 'sha256-[A-Za-z0-9+/=]+'$/);
		expect(directive('object-src'), path).toBe("'none'");
		expect(directive('base-uri'), path).toBe("'self'");
		expect(directive('form-action'), path).toBe("'self'");
		// Connections only over TLS; nothing framed in a build without a credits service.
		expect(directive('connect-src'), path).toBe("'self' https: wss:");
		expect(directive('frame-src'), path).toBe("'none'");
		expect(policy, path).not.toMatch(/script-src[^;]*('unsafe-inline'|'unsafe-eval'|\*|https:|data:)/);
		// The policy stands before the first script.
		expect(html.indexOf('content-security-policy'), path).toBeLessThan(html.indexOf('<script'));
	}
});

for (const path of PAGES) {
	test(`${path} runs without a violation of its policy`, async ({ page }) => {
		const violations = [];
		await page.addInitScript(() => document.addEventListener('securitypolicyviolation', (e) => console.error(`CSP-VIOLATION ${e.violatedDirective} ${e.blockedURI}`)));
		page.on('console', (m) => /^CSP-VIOLATION/.test(m.text()) && violations.push(m.text()));
		// Nothing leaves the test; a blocked request is not a violation of the policy.
		await page.context().route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
		await page.goto(path);
		await expect(page.locator('body')).not.toBeEmpty();
		await page.waitForTimeout(1500);
		// One refusal is expected and is the policy at work: a bundled library
		// (zod) probes once with `new Function("")` whether it may compile, is
		// refused, and takes its slower path. Anything else fails the test.
		expect(violations.filter((v) => v !== 'CSP-VIOLATION script-src eval')).toEqual([]);
		expect(violations.length).toBeLessThanOrEqual(1);
	});
}

test('the policy stops an injected inline script and a script from elsewhere', async ({ page }) => {
	await page.context().route('https://evil.example.com/**', (route) => route.fulfill({ contentType: 'text/javascript', body: 'window.__foreign = true' }));
	await page.goto('/app/');
	const result = await page.evaluate(async () => {
		const blocked = [];
		document.addEventListener('securitypolicyviolation', (e) => blocked.push(e.violatedDirective));
		const inline = document.createElement('script');
		inline.textContent = 'window.__inline = true';
		document.head.append(inline);
		const foreign = document.createElement('script');
		foreign.src = 'https://evil.example.com/x.js';
		document.head.append(foreign);
		await new Promise((r) => setTimeout(r, 800));
		let evaluated = false;
		try {
			evaluated = new Function('return true')();
		} catch {
			/* refused */
		}
		return { inline: Boolean(window.__inline), foreign: Boolean(window.__foreign), evaluated, blocked };
	});
	expect(result.inline).toBe(false);
	expect(result.foreign).toBe(false);
	expect(result.evaluated).toBe(false);
	expect(result.blocked.length).toBeGreaterThanOrEqual(2);
});
