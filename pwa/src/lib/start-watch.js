// After the unlock: the VM's status page until Paperless is ready, and a plain
// word when a step waits too long or failed, instead of waiting without end.
//
// With a fixed address the VM serves nothing on the fixed name until it has
// that name's certificate (rootfs/files/paperless-fixed-address). Images that
// know it serve the status page over the instance's 2n6 name meanwhile
// (paperless-https --status), so the app asks there while the fixed name does
// not answer. The page says which step the start waits for (`waiting`):
// data-area, dns, certificate, restore-download, restore-import, images,
// containers, paperless. Older images say only the phase.
import { tr } from './i18n/index.js';

/** How long each step may take before the app says what waits. */
export const STEP_LIMIT_MS = Object.freeze({
	'data-area': 5 * 60_000,
	dns: 10 * 60_000,
	certificate: 15 * 60_000,
	// A large backup: 1.1 GB took over 20 minutes to download on 2026-11-17.
	'restore-download': 120 * 60_000,
	'restore-import': 120 * 60_000,
	images: 30 * 60_000,
	containers: 15 * 60_000,
	paperless: 20 * 60_000,
	// Paperless is ready (seen over the 2n6 name), the fixed name does not answer this browser.
	address: 10 * 60_000
});
/** No answer at all, from neither name, this long after the unlock or the last answer. */
export const SILENT_LIMIT_MS = 20 * 60_000;
/**
 * No answer at all yet, but 2n6 names the VM and the node says it runs: then
 * the VM's Caddy still orders the 2n6 name's certificate (on the first
 * request for it), and a browser cannot tell that from silence. Round trips
 * of 2026-11-20 and -21 had the page after 1 to 6 minutes, one not within 15.
 * The app waits this long instead of giving up on a VM that is starting.
 */
export const SILENT_RUNNING_LIMIT_MS = 45 * 60_000;
/** Without any answer for this long, the app says what it is waiting for. */
export const SAY_NO_ANSWER_AFTER_MS = 3 * 60_000;
/** When to hand the secrets over again while nothing answered (the guest's init sometimes misses the first). */
export const UNLOCK_AGAIN_AFTER_MS = Object.freeze([5 * 60_000, 12 * 60_000]);
/**
 * The fixed name exists only once the VM has set its records; asked earlier,
 * a wildcard in the zone answers with another address, and the browser keeps
 * that for minutes (2026-10-31: the first answer after 529 s). The 2n6 name
 * has no such wildcard and is asked from the start.
 */
export const FIRST_LOOK_FIXED_MS = 90_000;

/**
 * The step a status names, or the one its phase implies (older images).
 * @param {any} status @returns {string | null}
 */
export function waitingStep(status) {
	if (typeof status?.waiting === 'string' && status.waiting in STEP_LIMIT_MS) return status.waiting;
	if (status?.phase === 'restoring') return 'restore-download';
	if (status?.phase === 'starting') return 'paperless';
	return null;
}

/**
 * The start waited too long for one step, or got no answer at all
 * (`step` "silent"). The VM runs on; the start can be continued.
 */
export class StartStuckError extends Error {
	/** @param {string} step @param {number} waitedMs */
	constructor(step, waitedMs) {
		super(tr().life.errors.startStuck(step, Math.max(1, Math.round(waitedMs / 60_000))));
		this.name = 'StartStuckError';
		this.step = step;
		this.waitedMs = waitedMs;
		this.retryable = true;
	}
}

/** The VM could not seal its data area on this node: Paperless does not start there. */
export class DataAreaFailedError extends Error {
	/** @param {string} reason as the VM reports it (data-disk.json) */
	constructor(reason) {
		super(tr().life.errors.dataDiskFailed(reason));
		this.name = 'DataAreaFailedError';
		this.reason = reason;
		/** @type {string | null} the node, the VM and its payer (set by the start) */
		this.crnHash = null;
		/** @type {string | null} */
		this.instanceHash = null;
		/** @type {string | null} */
		this.payer = null;
	}
}

/** The VM gave up the fixed address on this start (no records or no certificate). */
export class AddressFailedError extends Error {
	/** @param {string} step "dns", "certificate" or "data-area" */
	constructor(step) {
		super(tr().life.errors.addressFailed(step));
		this.name = 'AddressFailedError';
		this.step = step;
	}
}

/**
 * Follow the start until Paperless is ready on `host`.
 * @param {{
 *   host: string,
 *   alternate?: (() => Promise<string | null>) | null,
 *   read: (host: string) => Promise<any>,
 *   onProgress: (p: { step: string, detail?: string, status?: any }) => void,
 *   unlockAgain?: (() => Promise<void>) | null,
 *   running?: (() => Promise<boolean>) | null,
 *   firstLookMs?: number,
 *   pollMs?: number,
 *   now?: () => number,
 *   sleep?: (ms: number) => Promise<void>
 * }} a `alternate` gives the 2n6 name (for a fixed address), `read` the status page of a host or null,
 *   `running` whether the node says the VM runs (asked only when nothing answered for SILENT_LIMIT_MS)
 * @returns {Promise<any>} the ready status
 */
export async function watchStart({ host, alternate = null, read, onProgress, unlockAgain = null, running = null, firstLookMs = 0, pollMs = 10_000, now = Date.now, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
	const t = tr().life.progress;
	const start = now();
	const again = [...UNLOCK_AGAIN_AFTER_MS];
	/** @type {string | null | undefined} undefined: not asked yet */
	let other;
	let answered = false;
	let lastAnswer = start;
	/** @type {string | null} */
	let step = null;
	let stepSince = start;
	// Past SILENT_LIMIT_MS because the node says the VM runs.
	let waitingOn = false;
	for (;;) {
		const elapsed = now() - start;
		const direct = elapsed >= firstLookMs ? await read(host).catch(() => null) : null;
		let status = direct?.phase ? direct : null;
		let viaOther = false;
		if (!status && alternate) {
			if (other === undefined) other = await alternate().catch(() => null);
			else if (other === null && !answered) other = await alternate().catch(() => null);
			const s = other ? await read(other).catch(() => null) : null;
			if (s?.phase) {
				status = s;
				viaOther = true;
			}
		}
		if (status) {
			answered = true;
			lastAnswer = now();
			// The image refuses to run Paperless without its sealed data area.
			if (status.phase === 'data-disk-failed') throw new DataAreaFailedError(String(status.dataDisk?.reason ?? tr().life.errors.noReason));
			if (status.phase === 'address-failed') throw new AddressFailedError(String(status.fixedAddress?.step ?? 'certificate'));
			const done = status.phase === 'ready' || (status.phase === 'restore-failed' && status.paperless);
			// Ready, or a failed restore (Paperless runs, empty, and says why), on the name the app will use.
			if (done && !viaOther) {
				// The last page goes to the start's panel too: without it the panel
				// kept the one before (a restore still under way), and after a
				// failed restore its row stayed open instead of red (2026-11-18).
				onProgress({ step: 'ready', detail: t.starting, status });
				return status;
			}
			const current = done ? 'address' : waitingStep(status);
			if (current !== step) {
				step = current;
				stepSince = now();
			}
			const what = current ? t.waiting[current] : t.startingPhase(status.phase);
			onProgress({ step: 'ready', detail: viaOther ? t.viaOther(what) : what, status });
			if (current && now() - stepSince > STEP_LIMIT_MS[/** @type {keyof typeof STEP_LIMIT_MS} */ (current)]) throw new StartStuckError(current, now() - stepSince);
		} else {
			const silentFor = now() - lastAnswer;
			if (silentFor > SILENT_LIMIT_MS) {
				// Never an answer, but 2n6 names the VM: ask the node before giving up.
				const mayRun = !answered && Boolean(other) && Boolean(running) && silentFor <= SILENT_RUNNING_LIMIT_MS;
				const runs = mayRun && running ? await running().catch(() => false) : false;
				if (!runs) throw new StartStuckError(waitingOn ? 'silentRunning' : alternate ? 'silent' : 'silentOne', silentFor);
				waitingOn = true;
			}
			if (!answered && again.length && now() - start > again[0]) {
				again.shift();
				if (unlockAgain) {
					onProgress({ step: 'ready', detail: t.passphraseAgain });
					await unlockAgain().catch((e) => onProgress({ step: 'ready', detail: t.passphraseAgainFailed(e instanceof Error ? e.message : String(e)) }));
				}
			} else if (!answered && other && silentFor > SAY_NO_ANSWER_AFTER_MS) {
				const minutes = Math.round(silentFor / 60_000);
				onProgress({ step: 'ready', detail: waitingOn ? t.runningNoAnswer(minutes) : t.noAnswerYet(minutes) });
			}
		}
		await sleep(pollMs);
	}
}
