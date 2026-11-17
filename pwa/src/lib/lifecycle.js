// Start and stop, end to end, as the app's key on behalf of the payer:
//   start: measurements for the app's key, INSTANCE, node notified, 443
//   mapped, hostname, attest + unlock with every secret over the attested
//   channel, then the VM's status page until Paperless is ready.
//   stop:  a stop request over the attested channel, the VM's last backup,
//   then FORGET (the node stops and drops it).
// What a running VM needs to be stopped from another device goes into the
// sealed profile.
import { loadTeeNodes } from './landing/tee-nodes.js';
import { noteProven, rankNodes } from './blocked-nodes.js';
import { privateKeyToAccount } from 'viem/accounts';
import { unlockInstance, pinsOf } from '@le-space/attest-wasm/instance';
import { attestGuest, injectSecrets } from '@le-space/attest-wasm/ratls';
import { loadAttestWasm } from './attest-wasm-load.js';
import { ownImageVerified, runsOwnImage } from './own-image-check.js';
import { answeringCopies } from './restore-reach.js';
import { DataAreaFailedError, FIRST_LOOK_FIXED_MS, watchStart } from './start-watch.js';
import { placedConfig } from './providers.js';
import { pinnedTrustedExecution } from './runtime-pin.js';
import { alephPrivateKey, backupMarkKey, backupPrivateKey, pieceMark, filecoinSessionPrivateKey, fixedHostLabel, paperlessSecrets, statusToken } from './keys/derive.js';
import { backupAuthorize, backupKeyAddress, backupRevoke, creditsAccount, creditsBalance, CREDITS_PRODUCT, CREDITS_URL } from './credits.js';
import { paidUntil, periodEndChanged, periodEndPiece, periodEndSecret } from './period-end.js';
import { confidentialCreditsPerHour, RESERVE_HOURS, runningCreditsPerHour } from './balances.js';
import { relayTransports } from './attest-p2p.js';
import { backupFacts, pieceCidOfStop, reportedMarks, restoreFitsImage, vaultBound, vmBackupSecrets, withVaultBackups } from './backups.js';
import { attestRelaysFor, relayUsed } from './relays.js';
import { updateProfile, vmPayer } from './profile.js';
import { ALEPH_API, readFetch } from './aleph.js';
import { format, tr } from './i18n/index.js';
import { crnAddress, credits, estimateCreditsPerHour, FIXED_HOST_DOMAIN, forgetInstance, forward443, hostname, instanceMessage, mapped443, notifyNode, PAPERLESS_VM, publicAddress, sendInstance, vmStatus, eraseOnNode } from './vm.js';

/** Aleph would refuse the start: the payer holds less than a day of reserve. */
export class AlephShortError extends Error {
	/** @param {string} message @param {{ balance: number, reserve: number, vmPerHour: number }} amounts */
	constructor(message, { balance, reserve, vmPerHour }) {
		super(message);
		this.name = 'AlephShortError';
		this.balance = balance;
		this.reserve = reserve;
		this.vmPerHour = vmPerHour;
	}
}

/** The last backup failed; the VM stays. Carries the VM's reason, what it saw (memory, space, exit code) and its tool's last log lines. */
export class BackupFailedError extends Error {
	/** @param {string} reason @param {string[]} log @param {string[]} [facts] */
	constructor(reason, log, facts = []) {
		super(tr().life.errors.backupFailed(reason));
		this.name = 'BackupFailedError';
		this.reason = reason;
		this.log = log;
		this.facts = facts;
	}
}

/**
 * A stop whose backup reached fewer providers than requested (one refused the
 * piece; the others hold their copies). Paperless is paused and the VM waits
 * for the person: erase it anyway (eraseStopped) or keep it (resumeAfterPartial).
 */
/**
 * An interrupted start Aleph rejected or forgot (or never got): nothing to
 * carry on with. The app drops it and offers a new start. `missing` names
 * what Aleph found missing, such as an image that was forgotten.
 */
export class StartGoneError extends Error {
	/** @param {string} instanceHash @param {string | number} status @param {string[]} missing */
	constructor(instanceHash, status, missing = []) {
		super(tr().life.errors.startGone(String(status), missing.map((h) => h.slice(0, 12))));
		this.name = 'StartGoneError';
		this.instanceHash = instanceHash;
		this.status = status;
		this.missing = missing;
	}
}

/** The hashes Aleph names as missing in a rejected message's details. @param {any} answer */
export function missingOf(answer) {
	const errors = answer?.details?.errors ?? answer?.message?.details?.errors ?? [];
	return (Array.isArray(errors) ? errors : []).map((e) => (typeof e === 'string' ? e : e?.hash ?? e?.item_hash ?? '')).filter((h) => /^[0-9a-f]{64}$/.test(h));
}

export class BackupPartialError extends Error {
	/** @param {any} status the VM's status page in phase "stop-partial" */
	constructor(status) {
		const b = status?.stop?.backup ?? status?.backup;
		const have = b?.backup?.copies?.length ?? 0;
		const want = b?.backup?.requestedCopies ?? have;
		super(tr().life.errors.backupPartial(have, want));
		this.name = 'BackupPartialError';
		this.status = status;
		this.copies = have;
		this.requested = want;
		this.log = b?.log ?? [];
		this.facts = [];
		/** @type {string[] | null} the backups the chain listed before the stop */
		this.before = null;
	}
}

/** The backup a stop reports could not be found on the chain: the VM is kept. */
export class BackupUnconfirmedError extends Error {
	/** @param {any} status the VM's status page at the end of the stop */
	constructor(status) {
		super(tr().life.errors.backupUnconfirmed);
		this.name = 'BackupUnconfirmedError';
		this.status = status;
	}
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Before a VM is erased after a stop: the backup the stop reports must be on
 * the chain, read by the app itself, and must be new: not one of `before`,
 * the backups the chain listed before the stop was asked for (or, when that
 * list could not be read, not one of `known`, this vault's own). A stop that
 * reports no new piece ("unchanged": a backup ran just before it) counts only
 * when the chain lists a backup that was not there before the stop. What the
 * VM's status page says alone is never enough. Throws BackupUnconfirmedError.
 * @param {any} status the VM's status page at the end of the stop
 * @param {{ onChain: () => Promise<string[]>, before?: string[] | null, known?: string[], tries?: number, delayMs?: number }} o
 *   `onChain`: the piece CIDs of the backups the chain lists now
 * @returns {Promise<string>} the confirmed piece CID
 */
export async function confirmStopBackup(status, { onChain, before = null, known = [], tries = 12, delayMs = 10_000 }) {
	const piece = pieceCidOfStop(status);
	if (piece ? (before ?? known).includes(piece) : !before) throw new BackupUnconfirmedError(status);
	for (let i = 0; i < tries; i++) {
		const listed = await onChain().catch(() => null);
		const found = !listed ? null : piece ? (listed.includes(piece) ? piece : null) : (listed.find((p) => !before?.includes(p)) ?? null);
		if (found) return found;
		if (i + 1 < tries) await sleep(delayMs);
	}
	throw new BackupUnconfirmedError(status);
}

// Loaded once per page, again on a broken connection (attest-wasm-load.js).
const loadWasm = () => loadAttestWasm();


async function until(what, fn, { tries = 60, delayMs = 5000 } = {}) {
	for (let i = 0; i < tries; i++) {
		const value = await fn().catch(() => null);
		if (value) return value;
		await sleep(delayMs);
	}
	throw new Error(`${what}: no answer in time`);
}

/**
 * With backups paid through Le Space Credits: authorize the VM's backup key
 * again and keep the service's answer (payer, signer, tag, label, network)
 * in the profile when it changed. Without an answer, the recorded one.
 * @param {Uint8Array} master @param {Record<string, any>} profile
 * @param {{ authorize?: (master: Uint8Array) => Promise<{ payer: string, signer: string, tag: string, label: string, network: string }>, update?: typeof updateProfile }} [deps]
 */
export async function refreshBackupSigner(master, profile, { authorize = (m) => backupAuthorize(m, backupKeyAddress(m)), update = updateProfile } = {}) {
	if (!profile.backupsByCredits) return null;
	let s;
	try {
		s = await authorize(master);
	} catch {
		return profile.backupSigner ?? null;
	}
	const fresh = { payer: s.payer, signer: s.signer, tag: s.tag, label: s.label, network: s.network };
	const old = profile.backupSigner;
	// Authorized again: a revoke still pending from a deleted VM is moot.
	if (!old || profile.backupRevokePending || Object.keys(fresh).some((k) => old[k] !== fresh[k]))
		await update(master, ({ backupRevokePending, ...p }) => ({ ...p, backupSigner: fresh })).catch(() => {});
	return fresh;
}

/**
 * Whether the backup key may be revoked once the VM `deletedHash` is gone:
 * only with backups paid through Le Space Credits, and only when no other VM
 * of this vault still uses the key. Production and trial share it (slot 0),
 * so a running, starting or trial VM other than the deleted one keeps it.
 * A trial's end never calls this.
 * @param {Record<string, any>} profile @param {string | null} deletedHash
 */
export function shouldRevokeBackupKey(profile, deletedHash) {
	if (!profile?.backupsByCredits) return false;
	return ![profile.running, profile.starting, profile.trial].some((vm) => vm && vm.instanceHash !== deletedHash);
}

/**
 * Revoke the VM's backup key after the production VM `deletedHash` is
 * deleted, when no other VM uses it. A failure never blocks the deletion:
 * it is said in the progress line and kept as `backupRevokePending` in the
 * sealed profile, for the start screen to try again.
 * @param {Uint8Array} master @param {Record<string, any>} profile @param {string | null} deletedHash
 * @param {{ revoke?: (master: Uint8Array) => Promise<{ revoked: boolean }>, update?: typeof updateProfile, onProgress?: (p: { step: string, detail?: string }) => void }} [deps]
 * @returns {Promise<'skipped' | 'revoked' | 'pending'>}
 */
export async function revokeBackupKey(master, profile, deletedHash, { revoke = (m) => backupRevoke(m, backupKeyAddress(m)), update = updateProfile, onProgress = () => {} } = {}) {
	if (!shouldRevokeBackupKey(profile, deletedHash)) return 'skipped';
	try {
		await revoke(master);
	} catch (e) {
		onProgress({ step: 'forget', detail: tr().life.progress.revokeLater(e instanceof Error ? e.message : String(e)) });
		await update(master, (p) => ({ ...p, backupRevokePending: true })).catch(() => {});
		return 'pending';
	}
	if (profile.backupRevokePending) await update(master, ({ backupRevokePending, ...p }) => p).catch(() => {});
	return 'revoked';
}

/**
 * On the start screen: try a revoke that failed when the VM was deleted, as
 * long as no VM of this vault uses the key again.
 * @param {Uint8Array} master @param {Record<string, any>} profile
 * @param {Parameters<typeof revokeBackupKey>[3]} [deps]
 */
export async function retryBackupRevoke(master, profile, deps) {
	if (!profile?.backupRevokePending) return null;
	return revokeBackupKey(master, profile, null, deps);
}

/**
 * The public key a test may send with the unlock, so that it can look into
 * the VM (the confidential init adds it to root's authorized_keys, and sshd
 * starts only then). The app's UI never sets it, the image carries no key of
 * its own, and a productive instance gets none: nobody logs in where the
 * real documents are. The VM, on its side, starts sshd on a productive
 * instance only when the unlock asks for it explicitly, which this app
 * never does.
 * @param {Record<string, any>} profile
 * @returns {string | null}
 */
export const debugKeysFor = (profile) => (profile?.debugAuthorizedKeys && profile.role !== 'primary' ? String(profile.debugAuthorizedKeys) : null);

/**
 * Whether the stored passphrase belongs to the stored image. Every image has
 * a passphrase of its own, and the setup records which image a passphrase
 * was entered for (`luksFor`); a profile from before that has no record and
 * passes.
 * @param {Record<string, any>} profile
 */
export const passphraseFitsImage = (profile) => !profile?.luksFor || profile.luksFor === profile.rootfsItemHash;

/**
 * A confidential node with room for a Paperless VM, for a start without a
 * node fixed in the setup: one of Aleph's live list that reports enough free
 * CPU, memory and disk (the list the landing page shows). Nodes Le Space
 * blocked and those this profile saw refuse a start are left out; a node
 * where a start was attested already (`proven`, blocked-nodes.js) comes
 * before a new one, then the best score.
 * Not kept in the profile: the next start asks again.
 * @param {{ load?: () => Promise<import('./landing/tee-nodes.js').TeeNode[]>, avoid?: Set<string>, proven?: Set<string> }} [deps]
 * @returns {Promise<string>}
 */
export async function pickNode({ load = () => loadTeeNodes(), avoid = new Set(), proven = new Set() } = {}) {
	const nodes = await load().catch(() => []);
	const node = rankNodes(nodes.filter((n) => n.fits && /^[0-9a-f]{64}$/.test(n.hash)), { avoid, proven })[0];
	if (!node) throw new Error(tr().card.errors.noNode);
	return node.hash;
}

/**
 * The node took the INSTANCE but refused to run it: it cannot run SEV-SNP
 * (`kind` "noSevSnp") or refused the allocation otherwise ("refused"). The VM
 * never ran; the start forgets it and asks another node (startElsewhere).
 */
export class NodeRefusedError extends Error {
	/** @param {{ crnHash: string, instanceHash: string, payer: string, kind: 'noSevSnp' | 'refused', reason: string }} a */
	constructor({ crnHash, instanceHash, payer, kind, reason }) {
		super(`the node did not take the instance: ${reason}`);
		this.name = 'NodeRefusedError';
		this.crnHash = crnHash;
		this.instanceHash = instanceHash;
		this.payer = payer;
		this.kind = kind;
		this.reason = reason;
	}
}

/**
 * Whether a node's answer to the allocation is a refusal to run the VM at
 * all, and which: "noSevSnp" when it says it cannot run SEV-SNP (whatever the
 * node list claims), "refused" when it answered the allocation with an HTTP
 * error after the retries; null for anything else (no answer, a timeout),
 * which is not retried elsewhere.
 * @param {unknown} reason the error or its message
 * @returns {'noSevSnp' | 'refused' | null}
 */
export function nodeRefusal(reason) {
	const text = String(/** @type {any} */ (reason)?.message ?? reason ?? '');
	if (/does not support SEV-?SNP|SEV-?SNP (is )?not supported/i.test(text)) return 'noSevSnp';
	if (/did not take the instance/i.test(text) && /allocation notify returned [45]\d\d/i.test(text)) return 'refused';
	return null;
}

/**
 * A start that moves on when a node refuses the VM: `start(crnHash)` runs on
 * the node given (fixed in the setup, or picked); when it throws
 * NodeRefusedError, `onRefused` forgets that INSTANCE and notes the node, and
 * a node is picked anew, at most `tries` times. A node fixed in the setup is
 * not replaced: its refusal is passed on. No image is built again.
 * @template T
 * @param {{ fixed?: string | null, pick: () => Promise<string>, start: (crnHash: string) => Promise<T>, onRefused: (e: NodeRefusedError) => Promise<void> | void, tries?: number }} a
 * @returns {Promise<T>}
 */
export async function startElsewhere({ fixed = null, pick, start, onRefused, tries = 3 }) {
	for (let i = 0; ; i++) {
		const crnHash = fixed || (await pick());
		try {
			return await start(crnHash);
		} catch (e) {
			if (!(e instanceof NodeRefusedError)) throw e;
			await onRefused(e);
			if (fixed || i >= tries - 1) throw e;
		}
	}
}

/**
 * Whether the start builds this vault's own image first: a builder is fixed
 * in the app, Le Space pays (a package or a voucher, which pays or includes
 * the build) and the profile has no image at all (a new Paperless; Nico's
 * decision of 2026-11-15). An image entered by hand is never replaced, and a
 * wallet or the app's address paying is left to the setup's own button.
 * @param {Record<string, any>} profile @param {unknown} builder
 */
export const buildsImageFirst = (profile, builder) =>
	Boolean(builder) && ((Boolean(profile?.leSpacePays) && !profile?.rootfsItemHash && !profile?.luksPassphrase) || (profile?.role === 'primary' && !runsOwnImage(profile)));

/**
 * What a start needs from the profile; throws with a reason a person can act on.
 * @param {Record<string, any>} profile
 * @param {{ buildsImage?: boolean }} [o] the start builds the own image first, so image and passphrase come from it
 */
export function startRequirements(profile, { buildsImage = false } = {}) {
	const m = tr().life.missing;
	const missing = [];
	// The wallet pays the VM, or only the backups when the app pays (appPays).
	if (!profile.payer && !profile.appPays && !profile.leSpacePays) missing.push(m.payer);
	// Backups paid through Le Space Credits need no wallet: Le Space's payer
	// pays them, once the service has the VM's backup key.
	if (!profile.payer && profile.backupConfig && !profile.backupsByCredits) missing.push(m.backupWallet);
	const signerNetwork = profile.network === 'mainnet' ? 'mainnet' : 'calibration';
	if (profile.backupConfig && profile.backupsByCredits && (!profile.backupSigner?.payer || profile.backupSigner.network !== signerNetwork)) missing.push(m.backupSigner);
	if (!profile.rootfsItemHash && !buildsImage) missing.push(m.image);
	if (!profile.luksPassphrase && !buildsImage) missing.push(m.passphrase);
	else if (!passphraseFitsImage(profile)) missing.push(m.passphraseOther);
	// No node fixed: the start picks one with room (pickNode).
	// The guest backs up a primary to mainnet only and refuses any other network.
	if (profile.role === 'primary' && profile.network !== 'mainnet') missing.push(m.mainnetForPrimary);
	// …and backs up to mainnet only as a primary: a test there runs without backups.
	if (profile.backupConfig && profile.network === 'mainnet' && profile.role !== 'primary') missing.push(m.primaryForMainnet);
	return missing;
}

/**
 * @typedef {{ instanceHash: string, crnHash: string, payer: string, trustedExecution: any, restoreEntry: any, at: number }} Starting
 * A VM that was requested and is still being brought up: kept in the profile
 * as soon as Aleph has it, so a reload of the app can carry on with it.
 */

/**
 * @param {Uint8Array} master
 * @param {Record<string, any>} profile
 * @param {(p: { step: string, detail?: string, instanceHash?: string }) => void} onProgress
 * @param {{ onRequested?: (starting: Starting) => Promise<void> | void }} [options] told once Aleph has the VM
 * @returns {Promise<{ instanceHash: string, crnHash: string, host: string, trustedExecution: any }>}
 */
export async function startPaperless(master, profile, onProgress, { onRequested, reach = answeringCopies } = {}) {
	const missing = startRequirements(profile);
	if (missing.length) throw new Error(tr().life.errors.startMissing(missing.join(', ')));
	// A backup is restored only into this vault's own image: the age identity
	// that opens it goes to no VM on the public image. Said before any VM is asked for.
	if (profile.restoreEntry && !ownImageVerified(master, profile)) throw new Error(tr().life.errors.restoreNeedsOwnImage);
	// A part larger than an older image downloads: said now, before a VM is paid for.
	if (profile.restoreEntry && !restoreFitsImage(profile, profile.restoreEntry)) throw new Error(tr().life.errors.partTooLargeForImage);
	// …and only when a copy of it can be fetched: otherwise the VM would start
	// empty and cost for nothing. Asked before any VM is requested.
	if (profile.restoreEntry) {
		// Before the start's steps: a copy that does not answer fails no step of the panel.
		onProgress({ step: 'preparing', detail: tr().life.progress.checkCopies });
		const { answering, total } = await reach(profile.restoreEntry);
		if (total > 0 && answering === 0) throw Object.assign(new Error(tr().life.errors.copiesUnreachable(total)), { retryable: true });
	}
	const app = privateKeyToAccount(alephPrivateKey(master));
	onProgress({ step: 'measure', detail: tr().life.progress.measure });
	const wasm = await loadWasm();
	const trustedExecution = await pinnedTrustedExecution({ wasm, owner: app.address, vcpus: PAPERLESS_VM.vcpus });

	onProgress({ step: 'instance', detail: tr().life.progress.request });
	const payer = vmPayer(profile, app.address);
	if (!payer) throw new Error(tr().life.errors.noPayer);
	const message = await instanceMessage({ app, payer, rootfsItemHash: profile.rootfsItemHash, crnHash: profile.crnHash, trustedExecution, name: `paperless-${new Date().toISOString().slice(0, 16)}` });
	// Aleph takes the VM only when the account holds a day of the VM's price
	// plus a day of what it already pays for; checked here so an account short
	// of that hears it before Aleph refuses.
	const [balance, vmPerHour, runningPerHour] = await Promise.all([
		credits(payer),
		estimateCreditsPerHour(message).then((p) => p ?? confidentialCreditsPerHour(PAPERLESS_VM)),
		runningCreditsPerHour(payer).catch(() => 0)
	]);
	const reserve = profile.minCredits ?? RESERVE_HOURS * (vmPerHour + runningPerHour);
	if (balance < reserve) {
		const e = tr().life.errors;
		const n = (/** @type {number} */ value) => format.number(value);
		const running = runningPerHour ? e.alephShortRunning(n(runningPerHour)) : '';
		throw new AlephShortError(
			e.alephShort({ missing: n(reserve - balance), where: e.payerAccount[profile.leSpacePays ? 'lespace' : profile.appPays ? 'app' : 'wallet'], reserve: n(reserve), vmPerHour: n(vmPerHour), running, balance: n(balance) }),
			{ balance, reserve, vmPerHour }
		);
	}
	/** @type {Starting} */
	const starting = { instanceHash: message.item_hash, crnHash: profile.crnHash, payer, trustedExecution, restoreEntry: profile.restoreEntry ?? null, at: Date.now() };
	try {
		await sendInstance(message);
	} catch (e) {
		// Not refused, but no answer (the connection broke): Aleph may have the
		// VM. Kept as an interrupted start, so trying again carries on with this
		// one (resumeStart looks it up) instead of asking Aleph for a second VM.
		if (!(/** @type {any} */ (e)?.refused)) await onRequested?.(starting);
		throw e;
	}
	const instanceHash = starting.instanceHash;
	await onRequested?.(starting);
	try {
		await notifyNode(await crnAddress(profile.crnHash), instanceHash);
	} catch (e) {
		// The node refused the VM (it cannot run SEV-SNP, or would not allocate
		// it): said as such, so the start forgets it and tries another node.
		const kind = nodeRefusal(e);
		if (kind) throw new NodeRefusedError({ crnHash: profile.crnHash, instanceHash, payer, kind, reason: String(/** @type {any} */ (e)?.message ?? e).replace(/^the node did not take the instance: /, '') });
		throw e;
	}
	return bringUp(master, profile, starting, wasm, onProgress);
}

/**
 * Carry on with a start that was interrupted (the app was reloaded or closed
 * after Aleph took the VM): the steps after the request, each skipped when
 * the VM is already past it.
 * @param {Uint8Array} master
 * @param {Record<string, any>} profile with `starting`
 * @param {(p: { step: string, detail?: string, instanceHash?: string }) => void} onProgress
 * @param {{ lookUpTries?: number, lookUpPauseMs?: number }} [options] how long an unknown or pending request is waited for
 */
export async function resumeStart(master, profile, onProgress, { lookUpTries = 24, lookUpPauseMs = 5000 } = {}) {
	/** @type {Starting} */
	const starting = profile.starting;
	if (!starting?.instanceHash) throw new Error(tr().life.errors.noInterruptedStart);
	onProgress({ step: 'instance', detail: tr().life.progress.lookUp, instanceHash: starting.instanceHash });
	// A start whose request lost its answer may still be on its way to Aleph:
	// waited for a little while it is unknown or pending.
	let res, status, answer;
	for (let i = 0; ; i++) {
		res = await readFetch(`${ALEPH_API}/api/v0/messages/${starting.instanceHash}`, tr().life.vm.lookUp);
		answer = res.ok ? await res.json() : null;
		status = answer?.status ?? null;
		if (status === 'processed' || i >= lookUpTries - 1 || !(res.status === 404 || status === 'pending')) break;
		await sleep(lookUpPauseMs);
	}
	// Rejected, forgotten or never arrived: nothing left to carry on with.
	if (['rejected', 'forgotten', 'removed', 'removing'].includes(status) || res.status === 404) throw new StartGoneError(starting.instanceHash, status ?? res.status, missingOf(answer));
	if (status !== 'processed') throw new Error(tr().life.errors.vmGone(starting.instanceHash.slice(0, 12), status ?? res.status));
	return bringUp(master, { ...profile, restoreEntry: starting.restoreEntry }, starting, await loadWasm(), onProgress, { resumed: true });
}

/** What the guest's agent takes at most in one hand-over (relay-button's attest agent). */
export const MAX_GUEST_SECRETS = 16;
/** Left out first when a hand-over would be too large: neither is needed to start and run. */
const OPTIONAL_SECRETS = ['period_end', 'authorized_keys'];

/**
 * The secrets of one hand-over, within what the guest takes: optional ones
 * are left out first; if it is still too many, a plain error instead of the
 * guest's refusal.
 * @param {Record<string, string>} secrets @param {number} [max]
 * @returns {Record<string, string>}
 */
export function fitSecrets(secrets, max = MAX_GUEST_SECRETS) {
	const out = { ...secrets };
	for (const name of OPTIONAL_SECRETS) if (Object.keys(out).length > max) delete out[name];
	const n = Object.keys(out).length;
	if (n > max) throw new Error(tr().life.errors.tooManySecrets(n, max));
	return out;
}

/** How long the start waits for a service it only asks for a better answer (credits, providers): then the recorded one. */
export const ASK_MS = 30_000;

/**
 * A promise that settles within `ms`, or is rejected then.
 * @template T @param {Promise<T>} promise @param {number} ms
 * @returns {Promise<T>}
 */
function within(promise, ms) {
	/** @type {ReturnType<typeof setTimeout> | undefined} */
	let timer;
	const late = new Promise((_, reject) => (timer = setTimeout(() => reject(new Error(`no answer within ${ms} ms`)), ms)));
	return /** @type {Promise<T>} */ (Promise.race([promise, late]).finally(() => clearTimeout(timer)));
}

/**
 * Whether the VM of a resumed start is up already: its status page answers
 * on the instance's 2n6 name or, with a fixed address, on `name:port`. The
 * fixed name is asked only once the start is older than FIRST_LOOK_FIXED_MS,
 * as at a new start (a wildcard answers it before the VM set its records).
 * @param {{ instanceHash: string, crnUrl: string, fixedName: string | null, startedAt: number, read: (host: string) => Promise<any>, now?: number }} a
 * @returns {Promise<{ host: string, status: any } | null>}
 */
export async function findRunning({ instanceHash, crnUrl, fixedName, startedAt, read, now = Date.now() }) {
	const at = async (/** @type {string | null} */ host) => {
		const status = host ? await read(host).catch(() => null) : null;
		return status?.phase ? { host: /** @type {string} */ (host), status } : null;
	};
	const viaTwoN6 = hostname(instanceHash).catch(() => null).then(at);
	const fixedLater = !fixedName || now - (Number(startedAt) || 0) < FIRST_LOOK_FIXED_MS;
	const viaFixed = fixedLater ? Promise.resolve(null) : publicAddress(crnUrl, instanceHash).catch(() => null).then((addr) => at(addr ? `${fixedName}:${addr.port}` : null));
	const [twoN6, fixed] = await Promise.all([viaTwoN6, viaFixed]);
	return fixed ?? twoN6;
}

/**
 * From a requested VM to a ready Paperless: port 443, address, unlock, ready.
 * A resumed start first looks whether the VM is up already; then nothing is
 * set up or handed over again, and it goes straight to watching the start.
 * @param {Uint8Array} master @param {Record<string, any>} profile @param {Starting} starting @param {any} wasm
 * @param {(p: { step: string, detail?: string, instanceHash?: string }) => void} onProgress
 * @param {{ resumed?: boolean }} [options]
 */
async function bringUp(master, profile, starting, wasm, onProgress, { resumed = false } = {}) {
	const app = privateKeyToAccount(alephPrivateKey(master));
	const { instanceHash, payer, trustedExecution } = starting;
	const crnUrl = await crnAddress(starting.crnHash);
	// Only a VM on this vault's own image gets the DNS token, the backups'
	// keys and the age identity (own-image-check.js).
	const own = ownImageVerified(master, profile);
	const fixed = Boolean(profile.dnsToken && own);
	const fixedName = fixed ? `${fixedHostLabel(master)}.${FIXED_HOST_DOMAIN}` : null;
	const readStatus = (/** @type {string} */ h) => vmStatus(h, statusToken(master));
	// With a fixed address, the 2n6 name while the fixed one does not answer (start-watch.js).
	const twoN6 = fixed ? () => hostname(instanceHash) : null;

	onProgress({ step: 'network', detail: tr().life.progress.network, instanceHash });
	const found = resumed ? await findRunning({ instanceHash, crnUrl, fixedName, startedAt: starting.at, read: readStatus }) : null;
	// A node that does not answer is asked again, never sent a second mapping:
	// that restarts a running VM.
	const listed = () => mapped443(crnUrl, instanceHash).then((port) => ({ port }));
	if (!found && !(await until('port 443', listed, { tries: 12 })).port) {
		await forward443(app, payer, instanceHash);
		await until('port 443', () => mapped443(crnUrl, instanceHash), { tries: 60 });
		// The node restarts the VM to apply a mapping; give it a moment before the unlock.
		await sleep(15_000);
	}
	// With a DNS token, the fixed address: the VM points the name at itself and
	// gets its certificate over DNS, and Caddy answers on 443 (IPv6) and on the
	// node's port (IPv4), so `name:port` reaches it from either. Without one,
	// the instance's 2n6 name, new at every start.
	/** @type {string} */
	let host;
	/** @type {string} */
	let name;
	const dns = {};
	if (profile.dnsToken && !own) onProgress({ step: 'network', detail: tr().life.progress.publicNoFixed });
	if (fixedName) {
		const addr = await until('IPv4-Adresse', () => publicAddress(crnUrl, instanceHash), { tries: 30 });
		name = fixedName;
		host = `${name}:${addr.port}`;
		Object.assign(dns, { dns_cloudflare_token: String(profile.dnsToken), https_ipv4: addr.ipv4, https_port: String(addr.port) });
	} else {
		host = name = found?.host ?? (await until('hostname', () => hostname(instanceHash), { tries: 30, delayMs: 10_000 }));
	}

	// The secrets, put together only when they are handed over: a VM that is
	// up already needs none, and no slow service holds its start.
	const gather = async () => {
		const p = paperlessSecrets(master);
		/** @type {Record<string, string>} */
		const secrets = {
			...dns,
			https_hostname: name,
			paperless_role: profile.role === 'primary' ? 'primary' : 'test',
			paperless_admin_password: p.adminPassword,
			paperless_db_password: p.dbPassword,
			paperless_secret_key: p.secretKey,
			status_token: statusToken(master)
		};
		// Binds backups to this vault: the VM marks each one it makes, and a
		// restore takes only a backup with this vault's mark. Like the backups'
		// other keys, only for a VM on this vault's own image.
		if (own) {
			secrets.backup_mark_key = backupMarkKey(master);
			// The key that names incremental backups' files is not sent: the VM
			// derives it from the mark key (paperless-dedup-key), as backupDedupKey does.
		}
		if (profile.backupConfig && !own) onProgress({ step: 'unlock', detail: tr().life.progress.publicNoBackups });
		// An empty start while backups exist, not confirmed as a new beginning:
		// this VM makes no backups, so an empty Paperless never becomes the newest.
		if (profile.backupConfig && own && profile.holdBackups) onProgress({ step: 'unlock', detail: tr().life.progress.backupsHeld });
		if (profile.backupConfig && own && !profile.holdBackups) {
			// Through Le Space Credits: ask the service again (it may have a new
			// payer or signer, which the profile then keeps); without an answer
			// in time, what the setup recorded.
			const signer = await within(refreshBackupSigner(master, profile), ASK_MS).catch(() => profile.backupSigner ?? null);
			// A region becomes named providers: one per operator, none blocked (providers.js).
			const network = profile.network === 'mainnet' ? 'mainnet' : 'calibration';
			const backupConfig = await within(placedConfig(network, profile.backupConfig), ASK_MS).catch(() => profile.backupConfig);
			try {
				Object.assign(
					secrets,
					vmBackupSecrets({ ...profile, backupConfig }, {
						...(profile.backupsByCredits
							? { backupKey: backupPrivateKey(master), signer, creditsUrl: CREDITS_URL, product: CREDITS_PRODUCT, account: creditsAccount(master).address }
							: { sessionKey: filecoinSessionPrivateKey(master) })
					})
				);
			} catch (e) {
				// Paperless starts anyway; the VM reports "no backup_config".
				onProgress({ step: 'unlock', detail: tr().life.progress.withoutBackups(e instanceof Error ? e.message : String(e)) });
			}
		}
		// When the paid time ends: the VM backs up and stops an hour before (period-end.js).
		const periodEnd = await within(periodEndFor(master, profile), ASK_MS).catch(() => null);
		// "0" (it renews, or nothing to stop for) is what a missing one means too.
		if (periodEnd != null && periodEnd !== '0') secrets.period_end = periodEnd;
		const keys = debugKeysFor(profile);
		if (keys) secrets.authorized_keys = keys;
		if (profile.restoreEntry && profile.ageIdentity && own) {
			const { unmarked, ...entry } = profile.restoreEntry;
			secrets.restore_ledger_entry = JSON.stringify(entry);
			secrets.age_identity = profile.ageIdentity;
			// A backup without this vault's mark, restored because the person chose
			// it as such: the VM takes it only when this names its piece.
			if (unmarked === true) secrets.restore_unmarked = String(entry.pieceCid);
		}
		return fitSecrets(secrets);
	};

	// The attestation with the relay that carried it (not attested itself; it forwards encrypted bytes).
	/** @type {any} */
	let transports = null;
	const kept = (/** @type {any} */ unlocked) => {
		const a = attestationOf(unlocked);
		const relay = a ? relayUsed(transports.last(), profile) : null;
		return a && relay ? { ...a, relay } : a;
	};
	const unlock = async () => {
		const secrets = await gather();
		onProgress({ step: 'unlock', detail: tr().life.progress.unlock });
		const relays = await attestRelaysFor(profile);
		transports = relayTransports(relays);
		return unlockInstance({
			wasm,
			relayUrl: relays[0],
			transport: transports,
			crnHash: starting.crnHash,
			instanceItemHash: instanceHash,
			trustedExecution,
			passphrase: profile.luksPassphrase,
			secrets,
			sign: (payload) => app.signMessage({ message: payload }),
			onProgress: ({ detail, phase }) => onProgress({ step: 'unlock', detail, phase })
		});
	};
	// A resumed start may find the VM unlocked already: its status page answers
	// (with a fixed address perhaps only over the 2n6 name, start-watch.js).
	let already = found?.status ?? (await readStatus(host).catch(() => null));
	if (!already?.phase && twoN6) already = await twoN6().then((h) => (h ? readStatus(h) : null)).catch(() => null);
	// What the attestation of this start confirmed, for the evidence view; a
	// resumed start that finds the VM unlocked has checked nothing itself.
	/** @type {import('./evidence.js').Attestation | null} */
	let attestation = null;
	if (already?.phase) {
		onProgress({ step: 'unlock', detail: tr().life.progress.alreadyUnlocked, already: true });
	} else {
		const unlocked = await unlock();
		attestation = kept(unlocked);
		// Which secrets the guest's agent says it stored (names only).
		onProgress({ step: 'unlock', detail: tr().life.progress.unlocked, injected: unlocked?.injected ?? [], attestation });
	}

	// Sometimes the guest's init never sees the passphrase the agent stored and
	// waits for it forever (seen on 2026-10-26/27 while Aleph was slow): the
	// VM then has no status page, no certificate and no SSH. The agent stays
	// reachable, so when the status page has not answered after a while, the
	// app attests and hands the secrets over again. A VM that is already up
	// is not affected by that.
	onProgress({ step: 'ready', detail: tr().life.progress.starting });
	// With a fixed address, the 2n6 name while the fixed one does not answer
	// (start-watch.js); the fixed name is asked only after FIRST_LOOK_FIXED_MS.
	const ready = await watchStart({
		host,
		alternate: twoN6,
		read: readStatus,
		onProgress,
		firstLookMs: fixed ? FIRST_LOOK_FIXED_MS : 0,
		unlockAgain: () => unlock().then((unlocked) => {
			attestation = kept(unlocked) ?? attestation;
		})
	}).catch((e) => {
		// The node could not seal the data area: said with the node, so the
		// card notes it and offers a start on another one.
		if (e instanceof DataAreaFailedError) throw Object.assign(e, { crnHash: starting.crnHash, instanceHash, payer });
		throw e;
	});
	// Whether the VM sealed its data area with a key of its own (image paperless-data-disk).
	const dataDisk = ready.dataDisk?.status === 'encrypted' ? 'encrypted' : ready.dataDisk ? 'plain' : 'unknown';
	return { instanceHash, crnHash: starting.crnHash, payer, host, trustedExecution, dataDisk, ...(attestation ? { attestation } : {}), ...(ready.phase === 'restore-failed' ? { restore: ready.restore } : Number(ready.restore?.superusers) > 0 ? { restore: { status: 'done', superusers: Number(ready.restore.superusers) } } : {}) };
}

/**
 * Hand the profile's backup places to the running VM, as the start does
 * (the VM reads them at every backup): the config, and the key or signer
 * that pays and signs. Only to a VM on this vault's own image.
 * @param {Uint8Array} master @param {Record<string, any>} profile with `running` and `backupConfig`
 * @param {{ send?: typeof sendToGuest, place?: typeof placedConfig }} [deps]
 */
export async function pushBackupPlaces(master, profile, { send = sendToGuest, place = placedConfig } = {}) {
	if (!profile.running?.instanceHash) throw new Error(tr().life.errors.noVm);
	if (!profile.backupConfig) throw new Error(tr().life.errors.noBackupConfig);
	if (!ownImageVerified(master, profile)) throw new Error(tr().life.errors.placesNeedOwnImage);
	const signer = profile.backupsByCredits ? await refreshBackupSigner(master, profile) : null;
	// A region becomes named providers, as at the start.
	const backupConfig = await place(profile.network === 'mainnet' ? 'mainnet' : 'calibration', profile.backupConfig);
	const secrets = vmBackupSecrets({ ...profile, backupConfig }, {
		...(profile.backupsByCredits
			? { backupKey: backupPrivateKey(master), signer, creditsUrl: CREDITS_URL, product: CREDITS_PRODUCT, account: creditsAccount(master).address }
			: { sessionKey: filecoinSessionPrivateKey(master) })
	});
	// The end of the paid time with every hand-over, as at the start.
	const periodEnd = await periodEndFor(master, profile);
	if (periodEnd != null) secrets.period_end = periodEnd;
	await send(master, profile, secrets);
	return Object.keys(secrets);
}

/**
 * The `period_end` secret for this Paperless (period-end.js): Unix seconds
 * when the package that pays the VM ends without renewing, "0" when it
 * renews, when something else pays the VM, or when there are no backups (a
 * stop at the end would save nothing). Null when Le Space Credits did not
 * answer: then the VM is not told anything new.
 * @param {Uint8Array} master @param {Record<string, any>} profile
 * @param {{ read?: typeof creditsBalance, now?: number }} [deps]
 * @returns {Promise<string | null>}
 */
export async function periodEndFor(master, profile, { read = creditsBalance, now = Date.now() } = {}) {
	if (!profile.leSpacePays || !profile.backupConfig) return '0';
	try {
		return periodEndSecret(paidUntil(await read(master), { pays: 'lespace', now }));
	} catch {
		return null;
	}
}

/**
 * At an opening, with the VM's status page read: when the end of the paid
 * time changed (a new voucher, a package renewed or cancelled, hours bought),
 * the running VM is told. Returns the secret sent, or null when nothing was.
 * @param {Uint8Array} master @param {Record<string, any>} profile with `running` @param {any} status
 * @param {{ send?: typeof sendToGuest, read?: typeof creditsBalance, now?: number }} [deps]
 */
export async function syncPeriodEnd(master, profile, status, { send = sendToGuest, read = creditsBalance, now = Date.now() } = {}) {
	if (!profile.running?.instanceHash || !status || ['stopping', 'stopped', 'stop-partial'].includes(status.phase)) return null;
	const wanted = await periodEndFor(master, profile, { read, now });
	if (wanted == null) return null;
	if (!periodEndChanged(status, wanted === '0' ? null : Number(wanted) * 1000)) return null;
	await send(master, profile, { period_end: wanted });
	return wanted;
}

/**
 * Before a VM that stopped itself at the end of the paid time is erased:
 * its last backup (periodEndPiece) must be on the chain, read by the app,
 * and not one this vault knew from an earlier stop. Throws BackupUnconfirmedError.
 * @param {any} status the VM's status page
 * @param {{ onChain: () => Promise<string[]>, known?: string[], tries?: number, delayMs?: number }} o
 */
export async function confirmPeriodEndBackup(status, { onChain, known = [], tries = 12, delayMs = 10_000 }) {
	const piece = periodEndPiece(status);
	if (!piece) throw new BackupUnconfirmedError(status);
	return confirmStopBackup({ stop: { backup: { pieceCid: piece } } }, { onChain, before: null, known, tries, delayMs });
}

/**
 * A request to the running VM, the way the unlock reaches it: attest the
 * guest against the pins of this start, then hand over `secrets` over the
 * attested channel, signed by the app's key (the guest's agent accepts only
 * the key that started the VM). The guest writes each to /tmp/secrets.
 * @param {Uint8Array} master @param {Record<string, any>} profile with `running` @param {Record<string, string>} secrets
 */
async function sendToGuest(master, profile, secrets) {
	const app = privateKeyToAccount(alephPrivateKey(master));
	const wasm = await loadWasm();
	const attested = await attestRunningGuest(profile, wasm);
	try {
		await injectSecrets({ wasm, attested, secrets, sign: (payload) => app.signMessage({ message: payload }) });
	} finally {
		attested.channel.close();
	}
}

/**
 * What a verified report says, as the evidence view keeps it: the launch
 * measurement, the policy, the firmware levels, and when it was checked.
 * @param {any} verified `freshVerified` of an attestation, or an unlock's result
 * @returns {import('./evidence.js').Attestation | null}
 */
export function attestationOf(verified, at = Date.now()) {
	if (!verified?.measurement) return null;
	return { measurement: String(verified.measurement), policy: verified.policy == null ? null : String(verified.policy), launchTcb: verified.launchTcb ?? null, at };
}

/**
 * Attest the running VM again, now: a fresh report, checked against AMD's
 * keys and the measurements of this VM's start. Hands nothing over. The
 * result is kept in the sealed profile.
 * @param {Uint8Array} master @param {Record<string, any>} profile with `running`
 * @param {{ attest?: typeof attestRunningGuest, update?: typeof updateProfile }} [deps]
 */
export async function attestRunning(master, profile, { attest = attestRunningGuest, update = updateProfile } = {}) {
	const instanceHash = profile.running?.instanceHash;
	if (!instanceHash) throw new Error(tr().life.errors.noVm);
	const attested = await attest(profile);
	let attestation;
	try {
		attestation = attestationOf(attested.freshVerified);
		if (attestation && attested.relay) attestation = { ...attestation, relay: attested.relay };
	} finally {
		attested.channel.close();
	}
	if (!attestation) throw new Error(tr().life.errors.noAttestation);
	// Only for the VM that was checked: it may have been stopped meanwhile.
	// …and its node noted as one where a start was attested (preferred by pickNode).
	await update(master, (now) => (now.running?.instanceHash === instanceHash ? noteProven({ ...now, running: { ...now.running, attestation } }, now.running.crnHash) : now));
	return attestation;
}

/**
 * An attested channel to the running VM, against the pins of its start.
 * @param {Record<string, any>} profile with `running` @param {any} [wasm]
 */
async function attestRunningGuest(profile, wasm) {
	wasm ??= await loadWasm();
	const run = profile.running;
	const { expectedMeasurements, expectedPolicy } = pinsOf(run.trustedExecution);
	// Each relay once, until one carries the attestation.
	const relays = await attestRelaysFor(profile);
	const transports = relayTransports(relays);
	let attested = null;
	for (let i = 0; !attested; i++) {
		try {
			attested = await attestGuest({ wasm, transport: transports(`?crn=${run.crnHash}&vm=${run.instanceHash}`), expectedMeasurements, expectedPolicy });
		} catch (error) {
			if (i + 1 >= relays.length || /rejected|measurement|policy|signature/i.test(String(error))) throw error;
		}
	}
	return Object.assign(attested, { relay: relayUsed(transports.last(), profile) });
}

/**
 * Keep the backups a VM's status page reports with this vault's mark in the
 * sealed profile (`vaultBackups`): the ones a restore is offered from without
 * asking. Returns the new profile, or null when nothing was new.
 * @param {Uint8Array} master @param {Record<string, any>} profile as loaded @param {any} status
 * @param {{ update?: typeof updateProfile }} [deps]
 */
export async function noteVaultBackups(master, profile, status, { update = updateProfile } = {}) {
	const found = vaultBound(reportedMarks(status), (cid) => pieceMark(master, cid));
	const known = profile.vaultBackups ?? [];
	if (found.every((c) => known.includes(c))) return null;
	return update(master, (now) => ({ ...now, vaultBackups: withVaultBackups(now.vaultBackups, found) }));
}

/**
 * Back up now, while Paperless keeps running (paperless-backup-loop answers
 * backup_request with "paperless-backup run", or "check" when a backup just
 * ran or holds the lock). Follows the VM's status page until the request is
 * done ("partial" when a provider refused the piece; the others hold their
 * copies); throws BackupFailedError when it failed.
 * @param {Uint8Array} master
 * @param {Record<string, any>} profile with `running`
 * @param {(p: { detail: string, status?: any }) => void} onProgress
 * @param {{ send?: typeof sendToGuest, status?: typeof vmStatus, delayMs?: number, tries?: number }} [deps] for the tests
 * @returns {Promise<any>} the status page with the finished request
 */
export async function requestBackup(master, profile, onProgress, { send = sendToGuest, status: read = vmStatus, delayMs = 5000, tries = 360 } = {}) {
	const run = profile.running;
	if (!run?.instanceHash) throw new Error(tr().life.errors.noVm);
	const token = statusToken(master);
	const before = await read(run.host, token).catch(() => null);
	// An image without the request would take it and never answer.
	if (before && !('backupSchedule' in before)) throw new Error(tr().life.errors.noBackupNow);
	const earlier = before?.backupRequest?.at ?? null;
	await send(master, profile, { backup_request: String(Date.now()) });
	onProgress({ detail: 'requested' });
	const done = await until('backup', async () => {
		const s = await read(run.host, token);
		const req = s?.backupRequest;
		if (!req || req.at === earlier) return null;
		onProgress({ detail: req.status, status: s });
		return ['done', 'partial', 'failed'].includes(req.status) ? s : null;
	}, { tries, delayMs });
	if (!['done', 'partial'].includes(done.backupRequest.status)) {
		const b = done.backupRequest.backup ?? done.backup;
		throw new BackupFailedError(b?.reason ?? (/** @type {Record<string, string>} */ (tr().life.errors.backupModes)[done.backupRequest.mode] ?? tr().life.errors.noReason), b?.log ?? [], backupFacts(b));
	}
	return done;
}

/**
 * @param {Uint8Array} master
 * @param {Record<string, any>} profile with `running` from startPaperless
 * @param {(p: { step: string, detail?: string }) => void} onProgress
 * @param {{ send?: typeof sendToGuest, status?: typeof vmStatus, delayMs?: number, tries?: number, erase?: typeof eraseStopped, onChain?: (() => Promise<string[]>) | null, confirmTries?: number }} [deps]
 *   `onChain`: with backups on, the piece CIDs the chain lists; the VM is
 *   erased only once the stop's backup is among them (confirmStopBackup)
 */
export async function stopPaperless(master, profile, onProgress, { send = sendToGuest, status: read = vmStatus, delayMs = 10_000, tries = 180, erase = eraseStopped, onChain = null, confirmTries = 12 } = {}) {
	const run = profile.running;
	if (!run?.instanceHash) throw new Error(tr().life.errors.noVm);
	const token = statusToken(master);
	// With backups on: what the chain lists before the stop, so that only a
	// backup made by this stop counts (null when it could not be read).
	const before = onChain ? await onChain().catch(() => null) : null;

	onProgress({ step: 'stop', detail: tr().life.progress.stop });
	// Only the answer to this request counts: the status page may still show an
	// earlier stop's outcome until the VM picks the new one up (within seconds).
	// An image that names no request in stop.json is told apart by the time.
	const earlier = (await read(run.host, token).catch(() => null))?.stop?.at ?? null;
	const request = String(Date.now());
	await send(master, profile, { stop_request: request });
	onProgress({ step: 'stop', detail: tr().life.progress.stop, sent: true });
	const status = await until('stop', async () => {
		const s = await read(run.host, token);
		if (!s?.stop) return null;
		if ('request' in s.stop ? s.stop.request !== request : s.stop.at === earlier) return null;
		// Every answer to this request goes to the panel; the backup's latest
		// log line, while it runs (status page: backup.log), to the progress line.
		const line = s.backup?.status === 'running' ? s.backup.log?.at(-1) : null;
		onProgress({ step: 'stop', ...(line ? { detail: line.replace(/^\S+Z /, '') } : {}), status: s });
		return ['stopped', 'stop-failed', 'stop-partial'].includes(s.phase) ? s : null;
	}, { tries, delayMs });
	if (status.phase === 'stop-partial') throw Object.assign(new BackupPartialError(status), { before });
	if (status.phase !== 'stopped') {
		const b = status.stop?.backup ?? status.backup;
		throw new BackupFailedError(b?.reason ?? tr().life.errors.noReason, b?.log ?? [], backupFacts(b));
	}
	if (onChain) {
		onProgress({ step: 'stop', detail: tr().life.progress.confirmBackup });
		await confirmStopBackup(status, { onChain, before, known: profile.ownBackups ?? [], tries: confirmTries, delayMs });
	}
	return erase(master, profile, status, onProgress);
}

/**
 * Erase the VM after its last backup: at once after a full one, or when the
 * person chose to after a partial one.
 * @param {Uint8Array} master
 * @param {Record<string, any>} profile with `running`
 * @param {any} status the VM's status page at the end of the stop
 * @param {(p: { step: string, detail?: string, erase?: { node: string | null, forgot?: string, revoke?: string } }) => void} onProgress
 * @param {{ forget?: typeof forgetInstance }} [deps] for the tests
 */
export async function eraseStopped(master, profile, status, onProgress, { forget = forgetInstance } = {}) {
	const run = profile.running;
	const app = privateKeyToAccount(alephPrivateKey(master));
	onProgress({ step: 'forget', detail: tr().life.progress.forget });
	const crnUrl = await crnAddress(run.crnHash).catch(() => null);
	// What the node answered ('erased', 'missing'), else null: the FORGET stops it later.
	const node = crnUrl ? ((await eraseOnNode(app, run.instanceHash, crnUrl))?.status ?? null) : null;
	onProgress({ step: 'forget', erase: { node } });
	// Who paid at the start, also when the profile changed since.
	const forgot = await forget(app, run.payer ?? vmPayer(profile, app.address), run.instanceHash);
	onProgress({ step: 'forget', erase: { node, forgot: forgot?.itemHash ?? '' } });
	const revoke = await revokeBackupKey(master, profile, run.instanceHash, { onProgress });
	onProgress({ step: 'forget', erase: { node, forgot: forgot?.itemHash ?? '', revoke } });
	return status;
}

/**
 * Keep the VM after a partial backup: Paperless starts again (paperless-stop
 * answers stop_resume, naming the partial stop's request, with "resumed"). The two-hourly check then backs up to
 * every provider again.
 * @param {Uint8Array} master
 * @param {Record<string, any>} profile with `running`
 * @param {{ send?: typeof sendToGuest, status?: typeof vmStatus, delayMs?: number, tries?: number }} [deps] for the tests
 */
export async function resumeAfterPartial(master, profile, { send = sendToGuest, status: read = vmStatus, delayMs = 5000, tries = 36 } = {}) {
	const run = profile.running;
	if (!run?.instanceHash) throw new Error(tr().life.errors.noVm);
	// The resume names the stop it answers: an old one never restarts
	// Paperless after a later stop.
	const page = await read(run.host, statusToken(master)).catch(() => null);
	const request = page?.stop?.status === 'partial' ? page.stop.request : null;
	if (!request) throw new Error(tr().life.errors.noPendingAnswer);
	await send(master, profile, { stop_resume: String(request) });
	return until('Paperless wieder starten', async () => {
		const s = await read(run.host, statusToken(master));
		return s?.stop?.status === 'resumed' ? s : null;
	}, { tries, delayMs });
}

/**
 * A trial: a second Paperless beside the running one, restored from a backup
 * to check that the backup is whole. It runs as a test (mail rules off), makes
 * no backups of its own and takes no fixed address (that belongs to the
 * production one): the instance's own name. It ends without a backup.
 * @param {Record<string, any>} profile
 * @param {any} entry the restore entry of the backup to try (restoreEntry())
 */
export function trialProfile(profile, entry) {
	const { running, starting, trial, dnsToken, backupConfig, ...rest } = profile;
	return { ...rest, role: 'test', restoreEntry: entry };
}

/**
 * Start a trial (see trialProfile); `onRequested` gets the VM as soon as Aleph
 * has it, so it can be kept in the profile and ended after a reload.
 * @param {Uint8Array} master @param {Record<string, any>} profile @param {any} entry
 * @param {(p: { step: string, detail?: string, instanceHash?: string }) => void} onProgress
 * @param {{ onRequested?: (starting: Starting) => Promise<void> | void }} [options]
 */
export async function startTrial(master, profile, entry, onProgress, options) {
	if (!profile.ageIdentity) throw new Error(tr().life.errors.noBackupKey);
	const run = await startPaperless(master, trialProfile(profile, entry), onProgress, options);
	// How the restore went: the status page's restore.json (documents, seconds).
	const status = await vmStatus(run.host, statusToken(master)).catch(() => null);
	return { ...run, restore: status?.restore ?? run.restore ?? null };
}

/**
 * End a trial: the VM goes without a backup (it never makes one).
 * @param {Uint8Array} master @param {Record<string, any>} trial `profile.trial`
 * @param {Record<string, any>} profile
 */
export async function endTrial(master, trial, profile) {
	if (!trial?.instanceHash) return;
	const app = privateKeyToAccount(alephPrivateKey(master));
	const crnUrl = await crnAddress(trial.crnHash).catch(() => null);
	if (crnUrl) await eraseOnNode(app, trial.instanceHash, crnUrl).catch(() => {});
	await forgetInstance(app, trial.payer ?? vmPayer(profile, app.address), trial.instanceHash);
}
