<script>
	// The backups of a running Paperless, in the overview: the last one, the
	// next check, and "back up now" without stopping the VM.
	import { onDestroy, onMount } from 'svelte';
	import { vmStatus } from '$lib/vm.js';
	import { statusToken } from '$lib/keys/derive.js';
	import { BackupFailedError, requestBackup } from '$lib/lifecycle.js';
	import { BACKUP_TEXTS, backupLang, backupOverview, when } from '$lib/backup-overview.js';

	/** @type {{ master: Uint8Array, profile: Record<string, any>, disabled?: boolean, onbusy?: (busy: boolean) => void }} */
	let { master, profile, disabled = false, onbusy = () => {} } = $props();

	const lang = backupLang();
	const t = BACKUP_TEXTS[lang];
	/** @type {any} */
	let status = $state(null);
	let answered = $state(false);
	let busy = $state(false);
	/** @type {string} '' | 'sending' | 'running' */
	let stage = $state('');
	let result = $state('');
	let resultOk = $state(true);
	/** @type {string[]} */
	let details = $state([]);
	const view = $derived(backupOverview(status));

	const read = async () => {
		const host = profile.running?.host;
		if (!host) return;
		const s = await vmStatus(host, statusToken(master)).catch(() => null);
		answered = true;
		if (s) status = s;
	};
	// Every minute while it runs; a request follows the page more often itself.
	let timer = 0;
	onMount(() => {
		read();
		timer = setInterval(() => busy || read(), 60_000);
	});
	onDestroy(() => clearInterval(timer));

	async function backUpNow() {
		busy = true;
		onbusy(true);
		stage = 'sending';
		result = '';
		details = [];
		try {
			const done = await requestBackup(master, $state.snapshot(profile), ({ detail, status: s }) => {
				if (s) status = s;
				if (detail !== 'requested') stage = 'running';
			});
			status = done;
			const outcome = done.backupRequest?.backup?.status;
			resultOk = true;
			result = outcome === 'unchanged' ? t.doneUnchanged : t.doneNow;
		} catch (e) {
			resultOk = false;
			result = e instanceof BackupFailedError ? `${t.failedNow} ${t.reason}: ${e.reason}` : e instanceof Error ? e.message : String(e);
			details = [.../** @type {any} */ ((e)?.facts ?? []), .../** @type {any} */ ((e)?.log ?? [])];
		} finally {
			busy = false;
			stage = '';
			onbusy(false);
			read();
		}
	}
</script>

<div class="backup" data-testid="simple-backup">
	<p class="label">{t.title}</p>
	{#if status && !view.supported}
		<p class="hint" data-testid="backup-old-image">{t.oldImage}</p>
	{:else if status}
		<!-- The check and the backup apart: most checks find nothing new and back up nothing. -->
		<p class="summary" data-testid="backup-summary">
			{#if view.check?.at}<span data-testid="backup-check">{t.checked} {when(view.check.at, lang)}, {t.checkOutcome(view.check.status)}</span>{#if view.last?.at || view.nextCheck}{' · '}{/if}{/if}
			{#if view.last?.at}<span>{t.lastShort} {when(view.last.at, lang)}</span>{#if view.nextCheck}{' · '}{/if}{/if}
			{#if view.nextCheck}<span data-testid="backup-next">{t.nextShort} {when(view.nextCheck, lang)}</span>{/if}
		</p>
		<p class="hint">{t.nextHint}</p>
		<p data-testid="backup-last">
			{t.last}:
			{#if view.last}
				{#if view.last.at}<strong>{when(view.last.at, lang)}</strong>{/if}
				{#if view.last.ok}<span class="ok"> · {view.last.copies >= view.last.requested ? t.ok(view.last.copies, view.last.requested) : t.short(view.last.copies, view.last.requested)}</span>
				{:else}<span class="bad"> · {t.failed}{view.last.reason ? ` (${view.last.reason})` : ''}</span>{/if}
			{:else}{t.none}{/if}
		</p>
		{#if busy || view.running}
			<p class="progress" role="status" data-testid="backup-progress">{stage === 'sending' ? t.sending : t.running}{view.log ? ` ${view.log}` : ''}</p>
		{/if}
		<button type="button" class="small" onclick={backUpNow} disabled={disabled || busy || view.running} data-testid="backup-now">{t.now}</button>
	{:else if answered}
		<p class="hint" data-testid="backup-unreachable">{t.unreachable}</p>
	{/if}
	{#if result}<p class={resultOk ? 'ok' : 'bad'} role="status" data-testid="backup-result">{result}</p>{/if}
	{#if details.length}<details class="log"><summary>{t.reason}</summary><pre>{details.join('\n')}</pre></details>{/if}
</div>

<style>
	.backup { margin: 0.75rem 0 0; padding: 0.9rem 1rem; background: var(--surface-2); border-radius: var(--radius-sm); }
	.backup p { margin: 0.15rem 0; }
	.label { color: var(--text-2); font-size: 0.85rem; margin-bottom: 0.35rem; }
	.hint { color: var(--text-2); font-size: 0.875rem; }
	.summary::first-letter { text-transform: uppercase; }
	.ok { color: var(--ok); }
	.bad { color: var(--danger); }
	.progress { color: var(--text-2); font-size: 0.9rem; word-break: break-word; }
	.small { margin-top: 0.6rem; padding: 0.35rem 0.85rem; font-size: 0.875rem; background: var(--surface); color: var(--text); border-color: var(--line); }
	.log pre { white-space: pre-wrap; font-size: 0.8rem; }
</style>
