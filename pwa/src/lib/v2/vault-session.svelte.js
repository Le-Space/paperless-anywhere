// The way into the vault for the v0.2 interface: creating one, opening it
// with a passkey or the 24 words, showing the words once and checking them,
// locking, and forgetting this browser. It uses the same vault module as
// v0.1 (keys/vault.js), so both interfaces read and write the same record.
//
// What v0.1's page did not do: while the 24 words are on screen the vault
// does not lock and the page asks before it is left, and the check says which
// word is wrong. The master secret lives in memory only.
// Call it while a component is set up (it uses effects).
import { privateKeyToAccount } from 'viem/accounts';
import { alephPrivateKey } from '$lib/keys/derive.js';
import { addPasskey, confirmationPositions, createVault, forgetVault, loadVault, unlockWithPasskey, unlockWithSeedPhrase } from '$lib/keys/vault.js';
import { forgetCopies } from '$lib/backup-status.js';
import { noteError } from '$lib/diagnosis.js';
import { tr } from '$lib/i18n/index.js';
import { framed, sharedOrigin } from '$lib/shared-origin.js';

export function createVaultSession() {
	// On a path-style gateway the origin is shared, and inside another page's
	// frame nothing is shown: no vault is opened there.
	const shared = sharedOrigin();
	const inFrame = framed();
	let vault = $state(shared || inFrame ? null : loadVault());
	/** @type {Uint8Array | null} the master secret, in memory only */
	let master = $state(null);
	let busy = $state(false);
	let passkeyWaiting = $state(false);
	let error = $state('');
	$effect(() => {
		if (error) noteError({ action: 'app', message: error });
	});

	// The 24 words, shown once after the vault is made, then three asked back.
	let shownPhrase = $state('');
	let confirming = $state(false);
	/** @type {number[]} */
	let askPositions = $state([]);
	/** @type {string[]} */
	let answers = $state([]);
	const words = $derived(shownPhrase ? shownPhrase.split(' ') : []);
	/** Per asked word: null while empty, else whether it matches. */
	const checks = $derived(askPositions.map((p, i) => ((answers[i] ?? '').trim() ? (answers[i] ?? '').trim().toLowerCase() === words[p] : null)));
	const answered = $derived(askPositions.length > 0 && checks.every((c) => c === true));
	// Leaving while the words are on screen loses them: the browser asks first.
	$effect(() => {
		if (!shownPhrase) return;
		const ask = (/** @type {BeforeUnloadEvent} */ e) => {
			e.preventDefault();
			e.returnValue = tr().v2.phrase.leave;
		};
		window.addEventListener('beforeunload', ask);
		return () => window.removeEventListener('beforeunload', ask);
	});

	const state = $derived(inFrame ? 'framed' : shared ? 'shared' : !vault ? 'new' : master ? (shownPhrase ? 'phrase' : 'unlocked') : 'locked');
	const address = $derived(master ? privateKeyToAccount(alephPrivateKey(master)).address : '');

	/** @param {() => Promise<void>} fn */
	async function run(fn) {
		error = '';
		busy = true;
		try {
			await fn();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}
	/** @param {string} name the passkey's name */
	const create = (name) =>
		run(async () => {
			const result = await createVault(name.trim() || 'Paperless anywhere');
			vault = loadVault();
			master = result.master;
			shownPhrase = result.phrase;
		});
	// A passkey prompt may never answer: it blocks only the passkey button, never the 24 words.
	async function unlockPasskey() {
		error = '';
		passkeyWaiting = true;
		try {
			const opened = await unlockWithPasskey(vault);
			if (!master) {
				master = opened;
				vault = loadVault();
			} else opened.fill(0);
		} catch (e) {
			if (!master) error = e instanceof Error ? e.message : String(e);
		} finally {
			passkeyWaiting = false;
		}
	}
	/** @param {string} phrase */
	const unlockPhrase = (phrase) =>
		run(async () => {
			master = await unlockWithSeedPhrase(vault, phrase);
			vault = loadVault();
		});
	function startConfirm() {
		askPositions = confirmationPositions();
		answers = askPositions.map(() => '');
		confirming = true;
	}
	function doneConfirm() {
		if (!answered) return;
		shownPhrase = '';
		confirming = false;
		askPositions = [];
		answers = [];
	}
	/** Locks, unless the 24 words are still on screen. @returns {boolean} whether it locked */
	function lock() {
		if (shownPhrase) return false;
		master?.fill(0);
		master = null;
		return true;
	}
	/** Forgets this browser's way in; the vault itself stays. */
	function forget() {
		if (shownPhrase) return;
		master?.fill(0);
		master = null;
		forgetVault();
		forgetCopies();
		vault = null;
	}
	/** @param {string} name */
	const newPasskey = (name) =>
		run(async () => {
			await addPasskey(/** @type {Uint8Array} */ (master), `${name.trim() || 'Paperless anywhere'} (${location.host})`);
			vault = loadVault();
		});

	return {
		get state() { return state; },
		get master() { return master; },
		get address() { return address; },
		get busy() { return busy; },
		get passkeyWaiting() { return passkeyWaiting; },
		get error() { return error; },
		set error(v) { error = v; },
		get words() { return words; },
		get confirming() { return confirming; },
		set confirming(v) { confirming = v; },
		get askPositions() { return askPositions; },
		get answers() { return answers; },
		get checks() { return checks; },
		get answered() { return answered; },
		create,
		unlockPasskey,
		unlockPhrase,
		startConfirm,
		doneConfirm,
		lock,
		forget,
		newPasskey
	};
}
