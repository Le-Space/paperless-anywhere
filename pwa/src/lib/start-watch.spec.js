// Following a start after the unlock (start-watch.js): the 2n6 name while the
// fixed one does not answer, the time limits per step, and what is said.
import { describe, expect, it } from 'vitest';
import { AddressFailedError, DataAreaFailedError, FIRST_LOOK_FIXED_MS, SAY_NO_ANSWER_AFTER_MS, SILENT_LIMIT_MS, SILENT_RUNNING_LIMIT_MS, STEP_LIMIT_MS, StartStuckError, waitingStep, watchStart } from './start-watch.js';
import { setLang } from './i18n/index.js';
import { startPanel } from './start-panel.js';

const FIXED = 'abc.vm.example.org:24005';
const TWO_N6 = 'alpha-beta-gamma-delta.2n6.me';
const MIN = 60_000;

/**
 * A start against a script of answers: `answer(host, t)` is what the status
 * page of `host` says at `t` ms after the unlock (null: no answer).
 * @param {(host: string, t: number) => any} answer
 * @param {{ fixed?: boolean, unlockAgain?: () => Promise<void>, running?: (t: number) => Promise<boolean> }} [o]
 */
function watch(answer, { fixed = true, unlockAgain, running } = {}) {
	let t = 0;
	/** @type {{ host: string, t: number }[]} */
	const asked = [];
	/** @type {string[]} */
	const said = [];
	let lookups = 0;
	const done = watchStart({
		host: FIXED,
		alternate: fixed
			? async () => {
					lookups++;
					return TWO_N6;
				}
			: null,
		read: async (host) => {
			asked.push({ host, t });
			return answer(host, t);
		},
		onProgress: (p) => p.detail && said.push(p.detail),
		unlockAgain,
		running: running ? () => running(t) : null,
		firstLookMs: fixed ? FIRST_LOOK_FIXED_MS : 0,
		now: () => t,
		sleep: async (ms) => {
			t += ms;
		}
	});
	return { done, asked, said, lookups: () => lookups, at: () => t };
}

describe('watchStart', () => {
	setLang('de');
	it('returns once the fixed name says ready, and asks it only after the first look', async () => {
		const w = watch((host, t) => (host === FIXED && t >= 3 * MIN ? { phase: 'ready', paperless: true } : null));
		expect((await w.done).phase).toBe('ready');
		expect(w.asked.filter((a) => a.host === FIXED && a.t < FIRST_LOOK_FIXED_MS)).toEqual([]);
	});
	it('hands the last page to the panel too: a failed restore is seen, not the page before it', async () => {
		/** @type {any[]} */
		const pages = [];
		const failed = { phase: 'restore-failed', paperless: true, restore: { status: 'failed', reason: 'made-up reason' } };
		const done = await watchStart({
			host: FIXED,
			read: async () => (pages.length < 2 ? { phase: 'restoring', waiting: 'restore-download', restore: { status: 'running' } } : failed),
			onProgress: (p) => p.status && pages.push(p.status),
			now: () => 0,
			sleep: async () => {}
		});
		expect(done).toBe(failed);
		expect(pages.at(-1)).toBe(failed);
		// What the start's panel then shows (start-panel.js): the restore row red, Paperless running.
		const rows = startPanel({ step: 'ready', status: pages.at(-1), restore: true, finished: true });
		expect(rows.find((r) => r.id === 'restore')?.state).toBe('failed');
		expect(rows.find((r) => r.id === 'ready')?.lights.find((l) => l.id === 'paperless')?.state).toBe('reported');
	});
	it('follows the start over the 2n6 name while the fixed name has no certificate, and says so', async () => {
		const w = watch((host, t) => {
			if (host === TWO_N6) return { phase: t < 10 * MIN ? 'starting' : 'restoring', waiting: t < 10 * MIN ? 'certificate' : 'restore-download' };
			return t >= 25 * MIN ? { phase: 'ready', paperless: true } : null;
		});
		expect((await w.done).phase).toBe('ready');
		expect(w.said).toContain('Feste Adresse wartet auf das Zertifikat (Stand über den 2n6-Namen der VM, die feste Adresse antwortet noch nicht)');
		expect(w.said).toContain('Die Sicherung wird geladen und entschlüsselt (Stand über den 2n6-Namen der VM, die feste Adresse antwortet noch nicht)');
		// Beyond the 20 minutes an old start waited: the steps moved on.
		expect(w.at()).toBeGreaterThan(20 * MIN);
		expect(w.lookups()).toBe(1);
	});
	it('does not take "ready" over the 2n6 name: the fixed name is what the app opens', async () => {
		const w = watch((host, t) => (host === TWO_N6 ? { phase: 'ready', paperless: true } : t > 6 * MIN ? { phase: 'ready', paperless: true } : null));
		expect((await w.done).phase).toBe('ready');
		expect(w.at()).toBeGreaterThan(6 * MIN);
		expect(w.said).toContain('Paperless-ngx läuft; die feste Adresse antwortet noch nicht (Stand über den 2n6-Namen der VM, die feste Adresse antwortet noch nicht)');
	});
	it('says plainly when the certificate waits too long', async () => {
		const w = watch((host) => (host === TWO_N6 ? { phase: 'starting', waiting: 'certificate' } : null));
		const e = await w.done.catch((x) => x);
		expect(e).toBeInstanceOf(StartStuckError);
		expect(e.step).toBe('certificate');
		expect(e.retryable).toBe(true);
		expect(e.message).toMatch(/^Die feste Adresse wartet seit 1[56] Minuten auf das Zertifikat\. Die App wartet nicht länger/);
		expect(w.at()).toBeLessThanOrEqual(STEP_LIMIT_MS.certificate + 20_000);
	});
	it('gives a large backup its time, but not without end', async () => {
		const w = watch((host) => (host === TWO_N6 ? { phase: 'restoring', waiting: 'restore-download' } : null));
		const e = await w.done.catch((x) => x);
		expect(e.step).toBe('restore-download');
		expect(w.at()).toBeGreaterThan(60 * MIN);
		expect(w.at()).toBeLessThanOrEqual(STEP_LIMIT_MS['restore-download'] + 20_000);
	});
	it('measures each step from when it began', async () => {
		// Images for 25 minutes, then containers: neither over its own limit.
		const w = watch((host, t) => {
			if (host !== FIXED) return null;
			if (t < 25 * MIN) return { phase: 'starting', waiting: 'images' };
			if (t < 35 * MIN) return { phase: 'starting', waiting: 'containers' };
			return { phase: 'ready', paperless: true };
		});
		expect((await w.done).phase).toBe('ready');
	});
	it('stops when the sealed data area failed, with the reason', async () => {
		const w = watch((host) => (host === TWO_N6 ? { phase: 'data-disk-failed', dataDisk: { status: 'plain', reason: 'no spare disk, and only 300 MiB free on the rootfs' } } : null));
		const e = await w.done.catch((x) => x);
		expect(e).toBeInstanceOf(DataAreaFailedError);
		expect(e.reason).toBe('no spare disk, and only 300 MiB free on the rootfs');
		expect(e.message).toBe('Der versiegelte Datenbereich ist auf diesem Knoten gescheitert (no spare disk, and only 300 MiB free on the rootfs); Paperless-ngx startet dort nicht.');
	});
	it('stops when the VM gave up the fixed address', async () => {
		const w = watch((host) => (host === TWO_N6 ? { phase: 'address-failed', fixedAddress: { status: 'failed', step: 'dns', final: true } } : null));
		const e = await w.done.catch((x) => x);
		expect(e).toBeInstanceOf(AddressFailedError);
		expect(e.message).toMatch(/Cloudflare eintragen/);
	});
	it('says when neither name answers, after handing the secrets over again twice', async () => {
		let again = 0;
		const w = watch(() => null, {
			unlockAgain: async () => {
				again++;
			}
		});
		const e = await w.done.catch((x) => x);
		expect(e).toBeInstanceOf(StartStuckError);
		expect(e.step).toBe('silent');
		expect(e.message).toMatch(/^Die VM antwortet seit 2\d Minuten nicht, weder unter der festen Adresse noch unter ihrem 2n6-Namen\./);
		expect(again).toBe(2);
		expect(w.at()).toBeLessThanOrEqual(SILENT_LIMIT_MS + 20_000);
	});
	it('waits on past 20 minutes of silence when the node says the VM runs, and says what for', async () => {
		// 2026-11-20: a VM whose 2n6 name got its certificate only after more than 15 minutes.
		let asked = 0;
		const w = watch((host, t) => (host === TWO_N6 && t >= 31 * MIN ? { phase: 'ready', paperless: true } : host === FIXED && t >= 32 * MIN ? { phase: 'ready', paperless: true } : null), {
			running: async () => {
				asked++;
				return true;
			}
		});
		expect((await w.done).phase).toBe('ready');
		expect(w.at()).toBeGreaterThan(SILENT_LIMIT_MS);
		expect(asked).toBeGreaterThan(0);
		expect(w.said.some((d) => /^Die VM antwortet seit \d+ Minuten noch nicht\. Ihr 2n6-Name braucht zuerst ein Zertifikat/.test(d))).toBe(true);
		expect(w.said.some((d) => /^Der Knoten meldet, dass die VM läuft; sie antwortet seit 2\d Minuten noch nicht\./.test(d))).toBe(true);
	});
	it('does not ask the node before 20 minutes of silence', async () => {
		/** @type {number[]} */
		const at = [];
		const w = watch((host, t) => (t >= 25 * MIN && host === FIXED ? { phase: 'ready', paperless: true } : null), {
			running: async (t) => {
				at.push(t);
				return true;
			}
		});
		await w.done;
		expect(Math.min(...at)).toBeGreaterThan(SILENT_LIMIT_MS);
		expect(w.said.filter((d) => /noch nicht/.test(d)).length).toBeGreaterThan(0);
		expect(SAY_NO_ANSWER_AFTER_MS).toBeLessThan(SILENT_LIMIT_MS);
	});
	it('gives up after 45 minutes even then, and says the node runs the VM', async () => {
		const w = watch(() => null, { running: async () => true });
		const e = await w.done.catch((x) => x);
		expect(e).toBeInstanceOf(StartStuckError);
		expect(e.step).toBe('silentRunning');
		expect(e.message).toMatch(/^Der Knoten meldet, dass die VM läuft, aber sie antwortet seit 4\d Minuten nicht über ihren 2n6-Namen; vermutlich hat dieser Name noch kein Zertifikat\./);
		expect(w.at()).toBeLessThanOrEqual(SILENT_RUNNING_LIMIT_MS + 20_000);
	});
	it('gives up at 20 minutes when the node does not run the VM, cannot be read, or the VM has no 2n6 name', async () => {
		for (const running of [async () => false, async () => Promise.reject(new Error('no answer'))]) {
			const w = watch(() => null, { running });
			const e = await w.done.catch((x) => x);
			expect(e.step).toBe('silent');
			expect(w.at()).toBeLessThanOrEqual(SILENT_LIMIT_MS + 20_000);
		}
		const w = watch(() => null, { fixed: false, running: async () => true });
		const e = await w.done.catch((x) => x);
		expect(e.step).toBe('silentOne');
		expect(w.at()).toBeLessThanOrEqual(SILENT_LIMIT_MS + 20_000);
	});
	it('a VM that answered once and then fell silent is not waited for longer', async () => {
		const w = watch((host, t) => (host === TWO_N6 && t < 5 * MIN ? { phase: 'starting', waiting: 'images' } : null), { running: async () => true });
		const e = await w.done.catch((x) => x);
		expect(e.step).toBe('silent');
		expect(w.at()).toBeLessThanOrEqual(5 * MIN + SILENT_LIMIT_MS + 20_000);
	});
	it('asks 2n6 for the name again while it has none', async () => {
		let n = 0;
		let t = 0;
		const done = watchStart({
			host: FIXED,
			alternate: async () => (++n < 3 ? null : TWO_N6),
			read: async (host) => (host === TWO_N6 ? { phase: 'ready' } : t > 5 * MIN ? { phase: 'ready' } : null),
			onProgress: () => {},
			now: () => t,
			sleep: async (ms) => {
				t += ms;
			}
		});
		await done;
		expect(n).toBe(3);
	});
	it('keeps the old behaviour without a fixed address: one name, no 2n6 lookup', async () => {
		const w = watch((_host, t) => (t >= 4 * MIN ? { phase: 'ready', paperless: true } : { phase: 'starting' }), { fixed: false });
		expect((await w.done).phase).toBe('ready');
		expect(w.lookups()).toBe(0);
		expect(new Set(w.asked.map((a) => a.host))).toEqual(new Set([FIXED]));
	});
	it('takes a failed restore with Paperless running as the end of the start', async () => {
		const w = watch((host) => (host === FIXED ? { phase: 'restore-failed', paperless: true, restore: { status: 'failed' } } : null));
		expect((await w.done).phase).toBe('restore-failed');
	});
	it('says it in English too', async () => {
		setLang('en');
		const w = watch((host) => (host === TWO_N6 ? { phase: 'starting', waiting: 'certificate' } : null));
		const e = await w.done.catch((x) => x);
		expect(e.message).toMatch(/^The fixed address has been waiting for its certificate for 1[56] minutes\. The app waits no longer/);
		expect(w.said[0]).toBe("The fixed address is waiting for its certificate (as the VM's 2n6 name reports; the fixed address does not answer yet)");
		setLang('de');
	});
});

describe('waitingStep', () => {
	it('takes the step the page names, and one from the phase of an older image', () => {
		expect(waitingStep({ phase: 'starting', waiting: 'dns' })).toBe('dns');
		expect(waitingStep({ phase: 'starting', waiting: 'something-new' })).toBe('paperless');
		expect(waitingStep({ phase: 'restoring' })).toBe('restore-download');
		expect(waitingStep({ phase: 'starting' })).toBe('paperless');
		expect(waitingStep({ phase: 'ready' })).toBeNull();
	});
	it('has a limit and a text for every step', async () => {
		const { life } = await import('./i18n/lifecycle.js');
		for (const lang of /** @type {const} */ (['de', 'en'])) {
			for (const step of Object.keys(STEP_LIMIT_MS)) {
				expect(life[lang].progress.waiting[/** @type {keyof typeof STEP_LIMIT_MS} */ (step)], `${lang} ${step}`).toBeTruthy();
				expect(life[lang].errors.startStuck(step, 3), `${lang} ${step}`).not.toMatch(/^(Der Start wartet|The start has been waiting)/);
			}
		}
	});
});
