// The status page from the first moments of a start (rootfs/files): Caddy's
// configuration from paperless-https (also over the instance's 2n6 name while
// a fixed address waits for its certificate), paperless-2n6-ask's check of
// that name, which step paperless-status says the start waits for, and the
// order of paperless-fixed-address. Each case starts sh or python3 anew.
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const files = new URL('../../../rootfs/files/', import.meta.url).pathname;
const source = (/** @type {string} */ name) => readFileSync(join(files, name), 'utf8');

/**
 * paperless-https in a directory standing in for /, with systemctl replaced.
 * @param {{ mode?: string, host?: string, fixed?: boolean, cert?: boolean }} o
 */
function https({ mode = '--status', host = 'abc.vm.example.org', fixed = true, cert = false }) {
	const root = mkdtempSync(join(tmpdir(), 'https-'));
	for (const d of ['tmp/secrets', 'etc/caddy', 'etc/paperless-anywhere', 'var/lib/caddy/fixed', 'bin']) mkdirSync(join(root, d), { recursive: true });
	if (fixed) {
		writeFileSync(join(root, 'tmp/secrets/dns_cloudflare_token'), 'x');
		writeFileSync(join(root, 'tmp/secrets/https_port'), '24005');
	}
	if (cert) writeFileSync(join(root, 'var/lib/caddy/fixed/cert.pem'), 'pem');
	// Records whether it got the lock's fd 9: a Caddy it starts would keep it.
	writeFileSync(join(root, 'bin/systemctl'), `#!/bin/sh\necho "$@" >> "${root}/systemctl.log"\nif (: >&9) 2>/dev/null; then echo "$1" >> "${root}/inherited.log"; fi\nexit 0\n`);
	chmodSync(join(root, 'bin/systemctl'), 0o755);
	const r = spawnSync('sh', [join(files, 'paperless-https'), ...(mode ? [mode] : []), host], {
		encoding: 'utf8',
		env: { PATH: `${join(root, 'bin')}:${process.env.PATH}`, PAPERLESS_ROOT: root }
	});
	expect(r.status, r.stderr).toBe(0);
	return {
		caddy: readFileSync(join(root, 'etc/caddy/Caddyfile'), 'utf8'),
		hostnameWritten: existsSync(join(root, 'etc/paperless-anywhere/hostname')),
		restarts: readFileSync(join(root, 'systemctl.log'), 'utf8').split('\n').filter((l) => l.startsWith('restart')).length,
		inherited: existsSync(join(root, 'inherited.log')) ? readFileSync(join(root, 'inherited.log'), 'utf8').trim() : ''
	};
}

describe('paperless-https', { timeout: 30_000 }, () => {
	it('serves the status page over the 2n6 name while the fixed name has no certificate, and nothing else', () => {
		const { caddy, hostnameWritten, restarts } = https({});
		expect(caddy).toMatch(/on_demand_tls \{\n\s+ask http:\/\/127\.0\.0\.1:9180\/\n/);
		expect(caddy).toMatch(/https:\/\/ \{\n\s+tls \{\n\s+on_demand\n/);
		expect(caddy).toContain('handle /anywhere/status.json {');
		expect(caddy).toContain('@detail path_regexp detail ^/anywhere/s/([0-9a-f]{32})\\.json$');
		expect(caddy).toMatch(/handle \{\n\s+respond 404\n/);
		expect(caddy).not.toContain('reverse_proxy');
		expect(caddy).not.toContain('abc.vm.example.org');
		expect(caddy).not.toContain('auto_https off');
		// --status writes nothing outside memory: the sealed area may not be there.
		expect(hostnameWritten).toBe(false);
		expect(restarts).toBe(1);
	});
	it('serves Paperless on the fixed name once its certificate is there, and still the status over 2n6', () => {
		const { caddy, hostnameWritten } = https({ mode: '--early', cert: true });
		expect(caddy).toMatch(/https:\/\/abc\.vm\.example\.org, https:\/\/abc\.vm\.example\.org:24005 \{\n\s+tls \/var\/lib\/caddy\/fixed\/cert\.pem/);
		expect(caddy.match(/reverse_proxy 127\.0\.0\.1:8000/g)).toHaveLength(1);
		// Paperless only on the fixed name's site, which comes first.
		expect(caddy.indexOf('reverse_proxy')).toBeLessThan(caddy.indexOf('https:// {'));
		expect(caddy.match(/handle \/anywhere\/status\.json/g)).toHaveLength(2);
		expect(hostnameWritten).toBe(true);
	});
	it('keeps the 2n6 start as it was: one site, no on-demand certificates', () => {
		const { caddy } = https({ mode: '--early', host: 'a-b-c-d.2n6.me', fixed: false });
		expect(caddy).toMatch(/https:\/\/a-b-c-d\.2n6\.me \{/);
		expect(caddy).not.toContain('on_demand');
		expect(caddy).not.toContain('https:// {');
		expect(caddy).toContain('reverse_proxy 127.0.0.1:8000');
	});
	it('never hands its lock to systemctl: a Caddy started from there would hold it, and the next call (paperless-secrets, then sshd) would wait for good', () => {
		for (const o of [{}, { mode: '--early', cert: true }, { mode: '--early', host: 'a-b-c-d.2n6.me', fixed: false }]) expect(https(o).inherited).toBe('');
		const script = source('paperless-https');
		expect(script).toMatch(/flock -w 60 9/);
		expect(script).toMatch(/\nexec 9>&-\n/);
		for (const line of script.split('\n').filter((l) => /^\s*[^#]*\bsystemctl (restart|is-active)/.test(l))) expect(line).toMatch(/9>&-/);
	});
	it('keeps what Caddy orders in memory', () => {
		for (const o of [{}, { fixed: false }]) expect(https(o).caddy).toMatch(/storage file_system \{\n\s+root \/run\/caddy\n/);
	});
	it('is set up by paperless-status before its loop, with --status', () => {
		const status = source('paperless-status');
		expect(status.indexOf('paperless-https --status')).toBeGreaterThan(0);
		expect(status.indexOf('paperless-https --status')).toBeLessThan(status.indexOf('while :; do'));
	});
});

/**
 * paperless-2n6-ask check, with 2n6's answer from a file.
 * @param {string} name @param {object | null} answer @param {string} own
 */
function ask(name, answer, own) {
	const dir = mkdtempSync(join(tmpdir(), 'ask-')) + '/';
	const label = name.split('.')[0];
	if (answer) writeFileSync(dir + label, JSON.stringify(answer));
	const r = spawnSync('python3', ['-I', join(files, 'paperless-2n6-ask'), 'check', name], {
		encoding: 'utf8',
		env: { PATH: process.env.PATH, PAPERLESS_2N6_LOOKUP: `file://${dir}`, PAPERLESS_OWN_IPV6: own }
	});
	return r.status;
}

describe('paperless-2n6-ask', { timeout: 30_000 }, () => {
	const label = 'alpha-beta-gamma-delta';
	const answer = (/** @type {string|null} */ ipv6) => ({ subdomain: label, url: `${label}.2n6.me`, instance_hash: 'f'.repeat(64), ipv6, active: true });
	it('allows the 2n6 name routed to this VM', () => {
		expect(ask(`${label}.2n6.me`, answer('2001:db8:1:2:3:aaaa:bbbb:ccc1'), '2001:db8:1:2:3:aaaa:bbbb:ccc1')).toBe(0);
	});
	it('allows it when 2n6 kept another prefix for the same interface ID', () => {
		expect(ask(`${label}.2n6.me`, answer('2001:db8:9:9:3:aaaa:bbbb:ccc1'), '2001:db8:1:2:3:aaaa:bbbb:ccc1')).toBe(0);
	});
	it('refuses a name routed elsewhere, unknown to 2n6, or not under 2n6.me', () => {
		expect(ask(`${label}.2n6.me`, answer('2001:db8:1:2:3:aaaa:bbbb:ddd1'), '2001:db8:1:2:3:aaaa:bbbb:ccc1')).toBe(1);
		expect(ask(`${label}.2n6.me`, answer(null), '2001:db8:1:2:3:aaaa:bbbb:ccc1')).toBe(1);
		expect(ask(`${label}.2n6.me`, null, '2001:db8:1:2:3:aaaa:bbbb:ccc1')).toBe(1);
		expect(ask(`${label}.example.org`, answer('2001:db8:1:2:3:aaaa:bbbb:ccc1'), '2001:db8:1:2:3:aaaa:bbbb:ccc1')).toBe(1);
		expect(ask(`x.${label}.2n6.me`, answer('2001:db8:1:2:3:aaaa:bbbb:ccc1'), '2001:db8:1:2:3:aaaa:bbbb:ccc1')).toBe(1);
	});
	it('refuses an answer for another label', () => {
		expect(ask(`${label}.2n6.me`, { ...answer('2001:db8:1:2:3:aaaa:bbbb:ccc1'), subdomain: 'other' }, '2001:db8:1:2:3:aaaa:bbbb:ccc1')).toBe(1);
	});
});

describe('paperless-status: what the start waits for', { timeout: 30_000 }, () => {
	const py = /<<'PY' && mv[^\n]*\n([\s\S]*?)\nPY\n/.exec(source('paperless-status'))?.[1] ?? '';
	/**
	 * @param {Record<string, object | string>} state files in the state directory
	 * @param {{ up?: boolean, images?: number, total?: number, running?: number }} [o]
	 */
	function page(state, { up = false, images = 0, total = 5, running = 0 } = {}) {
		const dir = mkdtempSync(join(tmpdir(), 'status-wait-'));
		for (const [name, v] of Object.entries(state)) writeFileSync(join(dir, name), typeof v === 'string' ? v : JSON.stringify(v));
		writeFileSync(join(dir, 'token'), 'b'.repeat(32));
		const code = py
			.replace('/tmp/secrets/status_token', join(dir, 'token'))
			.replace('/tmp/secrets/period_end', join(dir, 'period_end'))
			.replace('/var/lib/paperless-anywhere/last-backup.json', join(dir, 'last.json'))
			.replace('/var/lib/paperless-anywhere/backup-marks.json', join(dir, 'marks.json'));
		const r = spawnSync('python3', ['-I', '-', dir, String(up), 'true', String(images), String(total), String(running), 'false'], { input: code, encoding: 'utf8' });
		expect(r.status, r.stderr).toBe(0);
		return { open: JSON.parse(r.stdout), full: JSON.parse(readFileSync(join(dir, 'public', 's', `${'b'.repeat(32)}.json`), 'utf8')) };
	}
	const sealed = { 'data-disk.json': { status: 'encrypted' } };
	const fixed = (/** @type {object} */ f) => ({ ...sealed, 'fixed-address.wanted': '', 'fixed-address.json': { host: 'h', port: 1, seconds: 3, ...f } });
	it('names the data area until it is known', () => {
		expect(page({}).open).toMatchObject({ phase: 'starting', waiting: 'data-area' });
	});
	it('says the data area failed, before anything about the address', () => {
		const p = page({ 'data-disk.json': { status: 'plain', reason: 'no dm-crypt' }, 'fixed-address.wanted': '', 'fixed-address.json': { status: 'failed', step: 'data-area', final: true } });
		expect(p.open.phase).toBe('data-disk-failed');
		expect(p.open.waiting).toBeUndefined();
		expect(p.full.dataDisk).toMatchObject({ reason: 'no dm-crypt' });
	});
	it('names the fixed address\'s steps: records, certificate, the backup\'s download', () => {
		expect(page(fixed({ status: 'dns' })).open.waiting).toBe('dns');
		expect(page(fixed({ status: 'certificate' })).open.waiting).toBe('certificate');
		expect(page(fixed({ status: 'restore' })).open.waiting).toBe('restore-download');
		// Between two tries: still the certificate, not yet given up.
		expect(page(fixed({ status: 'failed', step: 'certificate' })).open).toMatchObject({ phase: 'starting', waiting: 'certificate' });
	});
	it('says the address was given up only when paperless-fixed-address says so', () => {
		const p = page(fixed({ status: 'failed', step: 'certificate', final: true }), { up: true, images: 5, running: 5 });
		expect(p.open.phase).toBe('address-failed');
		expect(p.full.fixedAddress).toMatchObject({ step: 'certificate', final: true });
	});
	it('names the restore\'s download and its import', () => {
		const ready = fixed({ status: 'ready' });
		expect(page({ ...ready, 'restore.json': { status: 'running' } }).open).toMatchObject({ phase: 'restoring', waiting: 'restore-download' });
		expect(page({ ...ready, 'restore.json': { status: 'running', stage: 'import' } }).open).toMatchObject({ phase: 'restoring', waiting: 'restore-import' });
	});
	it('then the images, the containers and Paperless; nothing once ready', () => {
		const ready = fixed({ status: 'ready' });
		expect(page(ready, { images: 2 }).open.waiting).toBe('images');
		expect(page(ready, { images: 5, running: 3 }).open.waiting).toBe('containers');
		expect(page(ready, { images: 5, running: 5 }).open.waiting).toBe('paperless');
		const p = page(ready, { up: true, images: 5, running: 5 });
		expect(p.open.phase).toBe('ready');
		expect(p.open.waiting).toBeUndefined();
		expect(p.full.waiting).toBeNull();
	});
});

describe('paperless-fixed-address', () => {
	const script = source('paperless-fixed-address');
	it('reports the data area before it requires it, and gives up for good when it failed', () => {
		expect(script.indexOf('report waiting')).toBeLessThan(script.indexOf('paperless-require-sealed'));
		expect(script).toMatch(/paperless-require-sealed paperless-fixed-address \|\| \{ report failed ',"step":"data-area","final":true'; exit 1; \}/);
	});
	it('waits for the backup before it would order a certificate (rootfs-certificate-first.spec.js runs the cases)', () => {
		const order = script.indexOf('elif ! order run; then');
		expect(order).toBeGreaterThan(0);
		expect(script.indexOf('paperless-restore fetch')).toBeLessThan(order);
		expect(script.indexOf('report restore')).toBeLessThan(script.indexOf('paperless-restore fetch'));
	});
	it('marks the last failure final', () => {
		expect(script).toMatch(/report failed ",\\"step\\":\\"\$\{step:-certificate\}\\",\\"final\\":true"\nexit 1\n$/);
	});
});

describe('paperless-restore', () => {
	it('says when the download is done and the import waits', () => {
		expect(source('paperless-restore')).toMatch(/\[ "\$cmd" = fetch \] && exit 0\n\. "\$entry_env"\n[^\n]*\nstatus running ',"stage":"import"'\n/);
	});
});

describe('the image', () => {
	it('installs and enables paperless-2n6-ask', () => {
		const build = readFileSync(new URL('../../../rootfs/build-image.sh', import.meta.url), 'utf8');
		expect(build).toMatch(/paperless-dedup-key paperless-2n6-ask; do/);
		expect(build).toContain('files/paperless-2n6-ask.service');
		expect(build).toMatch(/systemctl enable [^\n]*paperless-2n6-ask\.service/);
	});
});
