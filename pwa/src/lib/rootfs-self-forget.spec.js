// The VM forgets itself after a stop of its own (rootfs/files,
// docs/auto-stop.md phase 3): when paperless-self-forget sends the FORGET the
// app signed for it, what it does with Aleph's answers, how paperless-stop
// calls it, and what the status pages say. Each case starts sh anew; Aleph is
// a local stand-in.
import { describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const files = new URL('../../../rootfs/files/', import.meta.url).pathname;
const source = (/** @type {string} */ name) => readFileSync(join(files, name), 'utf8');

const NOW = 1_800_000_000;
const ITEM = 'f'.repeat(64);
const FORGET = { api: 'https://api2.aleph.im', message: { type: 'FORGET', item_hash: ITEM, sender: '0xapp', signature: '0xsig', item_content: '{}', item_type: 'inline', chain: 'ETH', channel: 'x', time: 1 } };
const READY = { status: 'ready', request: `idle-${NOW}`, reason: 'idle', at: 'x', backup: { status: 'done', backup: { pieceCid: 'bafk' } } };

/**
 * @param {{ stop?: any, setting?: any, restore?: any, state?: any, now?: number, api?: string, dry?: boolean }} o
 * @returns {Promise<{ out: string, state: any }>}
 */
async function run({ stop = READY, setting = { v: 1, idleMinutes: 60, dailyAt: null, forget: FORGET }, restore = null, state = null, now = NOW, api = '', dry = true }) {
	const base = mkdtempSync(join(tmpdir(), 'self-forget-'));
	const dirs = { run: join(base, 'run'), secrets: join(base, 'secrets') };
	for (const d of Object.values(dirs)) mkdirSync(d);
	if (setting) writeFileSync(join(dirs.secrets, 'auto_stop'), JSON.stringify(setting));
	if (stop) writeFileSync(join(dirs.run, 'stop.json'), JSON.stringify(stop));
	if (restore) writeFileSync(join(dirs.run, 'restore.json'), JSON.stringify(restore));
	if (state) writeFileSync(join(dirs.run, 'self-forget.json'), JSON.stringify(state));
	/** @type {Record<string, string>} */
	const env = { PATH: process.env.PATH ?? '', PAPERLESS_RUN_DIR: dirs.run, PAPERLESS_SECRETS_DIR: dirs.secrets };
	if (dry) env.PAPERLESS_SELF_FORGET_DRY = '1';
	if (api) env.PAPERLESS_SELF_FORGET_TEST_API = api;
	const child = spawn('sh', [join(files, 'paperless-self-forget'), String(now)], { env });
	let out = '';
	let err = '';
	child.stdout.on('data', (d) => (out += d));
	child.stderr.on('data', (d) => (err += d));
	const code = await new Promise((resolve) => child.on('close', resolve));
	expect(code, err).toBe(0);
	let written = null;
	try {
		written = JSON.parse(readFileSync(join(dirs.run, 'self-forget.json'), 'utf8'));
	} catch {
		/* none */
	}
	return { out: out.trim(), state: written };
}
const sends = async (/** @type {Parameters<typeof run>[0]} */ o) => (await run(o)).out === ITEM;

/** A stand-in for Aleph's API: answers by method; records what it got. */
async function aleph(/** @type {{ post?: number, get?: [number, any] }} */ answers) {
	/** @type {{ method: string, url: string, body: any }[]} */
	const seen = [];
	const server = createServer((req, res) => {
		let body = '';
		req.on('data', (d) => (body += d));
		req.on('end', () => {
			seen.push({ method: req.method ?? '', url: req.url ?? '', body: body ? JSON.parse(body) : null });
			const [code, json] = req.method === 'POST' ? [answers.post ?? 202, { publication_status: { status: 'success' } }] : (answers.get ?? [404, null]);
			res.writeHead(code, { 'content-type': 'application/json' });
			res.end(JSON.stringify(json));
		});
	});
	await new Promise((r) => server.listen(0, '127.0.0.1', () => r(null)));
	const address = /** @type {import('node:net').AddressInfo} */ (server.address());
	return { url: `http://127.0.0.1:${address.port}`, seen, close: () => server.close() };
}

describe('paperless-self-forget: when it sends', { timeout: 60_000 }, () => {
	it('after a stop of its own with a complete or an unchanged backup, also at the period end', async () => {
		expect(await sends({})).toBe(true);
		expect(await sends({ stop: { ...READY, reason: 'schedule' } })).toBe(true);
		expect(await sends({ stop: { ...READY, reason: 'period-end' } })).toBe(true);
		expect(await sends({ stop: { ...READY, backup: { status: 'unchanged' } } })).toBe(true);
		// The "off" setting still carries it, for the period end.
		expect(await sends({ setting: { v: 1, idleMinutes: null, dailyAt: null, forget: FORGET }, stop: { ...READY, reason: 'period-end' } })).toBe(true);
	});
	it('never after the app’s own stop, before the stop is ready, or without a complete backup', async () => {
		expect(await sends({ stop: { ...READY, reason: 'app' } })).toBe(false);
		for (const status of ['running', 'partial', 'failed', 'resumed']) expect(await sends({ stop: { ...READY, status } }), status).toBe(false);
		for (const status of ['partial', 'failed', 'skipped', 'empty', 'refused', 'running']) expect(await sends({ stop: { ...READY, backup: { status } } }), status).toBe(false);
		expect(await sends({ stop: { ...READY, backup: null } })).toBe(false);
		expect(await sends({ stop: null })).toBe(false);
	});
	it('never while a restore runs or after one failed', async () => {
		expect(await sends({ restore: { status: 'running' } })).toBe(false);
		expect(await sends({ restore: { status: 'failed' } })).toBe(false);
		expect(await sends({ restore: { status: 'done' } })).toBe(true);
	});
	it('only a FORGET with an item hash, to an https API', async () => {
		expect(await sends({ setting: null })).toBe(false);
		expect(await sends({ setting: { v: 1, idleMinutes: 60 } })).toBe(false);
		expect(await sends({ setting: { v: 1, forget: { ...FORGET, message: { ...FORGET.message, type: 'INSTANCE' } } } })).toBe(false);
		expect(await sends({ setting: { v: 1, forget: { ...FORGET, message: { ...FORGET.message, item_hash: 'nothex' } } } })).toBe(false);
		expect(await sends({ setting: { v: 1, forget: { ...FORGET, api: 'http://api2.aleph.im' } } })).toBe(false);
		expect(await sends({ setting: { v: 1, forget: { ...FORGET, api: 'https://api2.aleph.im/x?y' } } })).toBe(false);
	});
	it('not again once Aleph took or refused it; a failed send again after five minutes', async () => {
		expect(await sends({ state: { status: 'done', itemHash: ITEM, at: NOW - 10 } })).toBe(false);
		expect(await sends({ state: { status: 'refused', itemHash: ITEM, at: NOW - 10 } })).toBe(false);
		expect(await sends({ state: { status: 'failed', itemHash: ITEM, at: NOW - 299 } })).toBe(false);
		expect(await sends({ state: { status: 'failed', itemHash: ITEM, at: NOW - 300 } })).toBe(true);
		// Another FORGET (a new hand-over) starts anew.
		expect(await sends({ state: { status: 'done', itemHash: 'e'.repeat(64), at: NOW } })).toBe(true);
	});
});

describe('paperless-self-forget: Aleph’s answers', { timeout: 60_000 }, () => {
	it('sends the signed message unchanged, then asks until Aleph processed it', async () => {
		const a = await aleph({ get: [200, { status: 'pending' }] });
		try {
			const first = await run({ api: a.url, dry: false });
			expect(first.state).toMatchObject({ status: 'sent', itemHash: ITEM, at: NOW });
			expect(a.seen[0]).toEqual({ method: 'POST', url: '/api/v0/messages', body: { sync: false, message: FORGET.message } });
			// Asked again only after 30 seconds.
			await run({ api: a.url, dry: false, state: first.state, now: NOW + 29 });
			expect(a.seen).toHaveLength(1);
			const pending = await run({ api: a.url, dry: false, state: first.state, now: NOW + 30 });
			expect(pending.state.status).toBe('sent');
			expect(a.seen[1]).toMatchObject({ method: 'GET', url: `/api/v0/messages/${ITEM}` });
		} finally {
			a.close();
		}
		const b = await aleph({ get: [200, { status: 'processed' }] });
		try {
			const done = await run({ api: b.url, dry: false, state: { status: 'sent', itemHash: ITEM, at: NOW - 60 } });
			expect(done.state.status).toBe('done');
		} finally {
			b.close();
		}
	});
	it('stops at a refusal (a revoked delegation) and tries again after a failure', async () => {
		const refused = await aleph({ post: 403 });
		try {
			expect((await run({ api: refused.url, dry: false })).state).toMatchObject({ status: 'refused' });
		} finally {
			refused.close();
		}
		const rejected = await aleph({ get: [200, { status: 'rejected' }] });
		try {
			expect((await run({ api: rejected.url, dry: false, state: { status: 'sent', itemHash: ITEM, at: NOW - 60 } })).state.status).toBe('refused');
		} finally {
			rejected.close();
		}
		const down = await aleph({ post: 503 });
		try {
			expect((await run({ api: down.url, dry: false })).state).toMatchObject({ status: 'failed' });
		} finally {
			down.close();
		}
		const unknown = await aleph({ get: [404, null] });
		try {
			expect((await run({ api: unknown.url, dry: false, state: { status: 'sent', itemHash: ITEM, at: NOW - 60 } })).state.status).toBe('failed');
		} finally {
			unknown.close();
		}
		// Nothing listens: failed, not a crash.
		expect((await run({ api: 'http://127.0.0.1:9', dry: false })).state.status).toBe('failed');
	});
});

describe('paperless-stop, the status pages and the image', () => {
	it('paperless-stop asks it after every ready stop while the secret is there', () => {
		const stop = source('paperless-stop');
		expect(stop).toMatch(/if \[ -s \/tmp\/secrets\/auto_stop \] && grep -q '"status":"ready"' "\$dir\/stop\.json" 2>\/dev\/null; then\n\s+paperless-self-forget/);
	});
	it('the private page shows it', () => {
		const status = source('paperless-status');
		expect(status).toContain('self_forget = read("self-forget.json")');
		expect(status).toContain('"selfForget": self_forget');
	});
	it('is installed, and the image says so', () => {
		expect(source('../build-image.sh')).toMatch(/\bpaperless-self-forget\b/);
		expect(JSON.parse(source('capabilities.json')).selfForget).toBe(1);
	});
});
