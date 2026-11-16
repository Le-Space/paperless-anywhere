import { afterEach, describe, expect, it } from 'vitest';
import { browserOf, diagnosisText, noteError, noteState, resetDiagnosis, scrub, shortAddress } from './diagnosis.js';

// Made-up values only.
const HASH = 'c'.repeat(64);
const NODE = 'd'.repeat(64);
const WALLET = '0x1234567890abcdef1234567890abcdef12345678';
const AGE = 'AGE-SECRET-KEY-1QQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQ';
const WORDS = 'abandon ability able about above absent absorb abstract absurd abuse access accident';
const TOKEN = 'eyJhbGciOiJIUzI1NiJ9eyJzdWIiOiJ0ZXN0In0abcdefghijklmnopqrstuvwxyz0123456789';
const build = { version: 'v0.1.99', commit: 'abc1234', time: '2026-01-02T03:04:05Z' };
const CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

afterEach(() => resetDiagnosis());

describe('scrub', () => {
	it('removes keys, tokens, phrases, mail addresses, queries and file names', () => {
		const dirty = `failed: ${AGE} with token=${TOKEN} for ${WORDS}; mail post@example.com; https://api.example.com/v1/x?token=abc&dns=1 at Wolkenfabrik-Rechnung-2026.pdf, Bearer abc.def.ghi, passphrase: "hunter2 x"`;
		const clean = scrub(dirty);
		for (const secret of [AGE, TOKEN, WORDS, 'post@example.com', 'token=abc', 'dns=1', 'Wolkenfabrik-Rechnung-2026.pdf', 'abc.def.ghi', 'hunter2']) expect(clean).not.toContain(secret);
		expect(clean).toContain('https://api.example.com/v1/x');
		expect(clean).toContain('[file]');
	});
	it('keeps an ordinary message, a 64-digit hash and a CID, and shortens a wallet', () => {
		expect(scrub('The VM does not answer.')).toBe('The VM does not answer.');
		expect(scrub(`the backup key does not open ${HASH}`)).toBe(`the backup key does not open ${HASH}`);
		expect(scrub(`paid by ${WALLET}`)).toBe('paid by 0x1234…5678');
		expect(shortAddress('nope')).toBeNull();
	});
});

describe('the diagnosis', () => {
	it('names version, state, VM, node, relay and the last error, and nothing secret', () => {
		noteState({ phase: 'running', instanceHash: HASH, node: NODE, host: 'vm.example.test', relay: 'relay.example.test', image: 'own', network: 'mainnet', pays: 'wallet', payer: WALLET });
		noteError({ action: 'start', step: 'Checking the VM (AMD) and unlocking', message: `unlock refused, key=${TOKEN} ${AGE}`, at: Date.UTC(2026, 0, 2, 3, 4, 5) });
		const text = diagnosisText({ build, cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi', unlocked: true, userAgent: CHROME, now: Date.UTC(2026, 0, 2, 3, 5, 0), lang: 'en' });
		expect(text).toContain('app: v0.1.99 · abc1234');
		expect(text).toContain('ipfs: bafybei');
		expect(text).toContain('phase: running');
		expect(text).toContain('image: own');
		expect(text).toContain(`vm: ${HASH}`);
		expect(text).toContain(`node: ${NODE}`);
		expect(text).toContain('relay: relay.example.test');
		expect(text).toContain('payer: 0x1234…5678');
		expect(text).toContain('error at: 2026-01-02T03:04:05.000Z');
		expect(text).toContain('error action: start');
		expect(text).toContain('error step: Checking the VM (AMD) and unlocking');
		expect(text).toContain('browser: Chrome 130 · macOS');
		for (const secret of [TOKEN, AGE, WALLET]) expect(text).not.toContain(secret);
	});
	it('says nothing about the vault’s content while it is locked', () => {
		noteState({ phase: 'running', instanceHash: HASH, host: 'vm.example.test' });
		const text = diagnosisText({ build, unlocked: false, userAgent: CHROME });
		expect(text).toContain('vault: locked');
		expect(text).not.toContain(HASH);
		expect(text).not.toContain('vm.example.test');
		expect(text).toContain('error: none noted in this tab');
	});
	it('takes only values that look like what they claim', () => {
		noteState({ phase: 'running; rm', instanceHash: 'not-a-hash', node: AGE, host: 'a b', relay: 'https://x/?t=1', image: /** @type {any} */ ('secret') });
		const text = diagnosisText({ build: { version: 'v1', commit: 'zz' }, cid: 'nope', unlocked: true, userAgent: '' });
		expect(text).not.toMatch(/phase:|vm:|node:|host:|relay:|image:|ipfs:/);
		expect(text).not.toContain(AGE);
		expect(text).toContain('app: v1');
	});
});

describe('the browser', () => {
	it('is named short', () => {
		expect(browserOf(CHROME)).toBe('Chrome 130 · macOS');
		expect(browserOf('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')).toBe('Safari 17 · iOS');
		expect(browserOf('Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0')).toBe('Firefox 128 · Linux');
		expect(browserOf('')).toBe('unknown · unknown');
	});
});
