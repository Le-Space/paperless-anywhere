<script>
	import ProviderHealth from '$lib/ProviderHealth.svelte';
	import { providerIdsIn } from '$lib/providers.js';
	// The backups of a running Paperless, in the overview: the last one, the
	// next check, and "back up now" without stopping the VM.
	import { onDestroy, onMount } from 'svelte';
	import { vmStatus } from '$lib/vm.js';
	import { statusToken } from '$lib/keys/derive.js';
	import { BackupFailedError, requestBackup } from '$lib/lifecycle.js';
	import { BACKUP_TEXTS, backupOverview, retentionView, when } from '$lib/backup-overview.js';
	import { backupSize, listBackups, protectedPieces, removalBatches } from '$lib/backups.js';
	import { backupListing } from '$lib/profile.js';
	import { filecoinChain, removeWithWallet } from '$lib/permissions.js';
	import { createPublicClient, http } from 'viem';
	import { getScheduledRemovals } from '@filoz/synapse-core/pdp-verifier';
	import { lang as appLang } from '$lib/i18n/index.js';

	/** @type {{ master: Uint8Array, profile: Record<string, any>, known?: { at: string, copies?: number | null } | null, disabled?: boolean, guard?: ((then: () => unknown) => unknown) | null, onbusy?: (busy: boolean) => void, ongood?: (good: { at: string, copies: number, requested: number, providerIds: number[] }) => void }} */
	let { master, profile, known = null, disabled = false, guard = null, onbusy = () => {}, ongood = () => {}, texts = null, simple = false } = $props();

	// Follows the language switch in the header.
	const lang = $derived($appLang);
	// `texts`: other words (v0.2's "Standard"); `simple`: without the retention list and the log.
	const t = $derived(texts ?? BACKUP_TEXTS[lang]);
	/** @type {any} */
	let status = $state(null);
	let answered = $state(false);
	let busy = $state(false);
	/** @type {string} '' | 'sending' | 'running' */
	let stage = $state('');
	let result = $state('');
	let resultOk = $state(true);
	// A backup with fewer copies than requested: not a failure, a warning.
	let resultWarn = $state(false);
	/** @type {string[]} */
	let details = $state([]);
	const view = $derived(backupOverview(status));
	const kept = $derived(retentionView(status));
	const rt = $derived(t.retention);
	// No backup in this VM yet: the last one the app knows (an earlier VM's, or
	// the backup this one was restored from), said as such, so the overview's
	// first line and this box never disagree.
	const earlier = $derived(!view.last && known?.at ? { at: new Date(known.at), copies: known.copies ?? null } : null);
	// A backup that reached providers is handed up, so the overview keeps it.
	$effect(() => {
		const last = view.last;
		if (last?.ok && last.at) ongood({ at: last.at.toISOString(), copies: last.copies, requested: last.requested, providerIds: last.providerIds });
	});

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

	// The wallet path: the VM only plans (needsWallet); the person removes what
	// it planned with the wallet, checked again against the chain first
	// (removalBatches): never the newest, a protected one, or what a kept
	// snapshot builds on. One signed call per data set.
	let removing = $state(false);
	let removeNote = $state('');
	/** @type {Array<{ pieceCid: string, why: string }>} */
	let removeSkipped = $state([]);
	/** @type {string[]} */
	let removeErrors = $state([]);
	const canRemove = $derived(Boolean(kept && !kept.failed && kept.needsWallet && !kept.sent && kept.remove > 0 && profile.payer && !profile.backupsByCredits));
	const removeOld = async () => {
		removing = true;
		removeNote = rt.removing;
		removeSkipped = [];
		removeErrors = [];
		try {
			const network = profile.network ?? 'calibration';
			const all = await listBackups({ network, ...backupListing(profile, null) });
			const marked = (/** @type {any} */ b) => (profile.vaultBackups ?? []).includes(b.pieceCid);
			const protect = [...protectedPieces(profile.restoreEntry), ...protectedPieces(profile.starting?.restoreEntry)];
			// Pieces already scheduled for removal are still listed until the provider's next proof.
			const client = createPublicClient({ chain: filecoinChain(network), transport: http(undefined, { retryCount: 1, timeout: 20_000 }) });
			const sets = [...new Set(all.flatMap((b) => (b.copies ?? []).map((c) => c.dataSetId)).filter(Boolean))];
			const scheduled = new Map(await Promise.all(sets.map(async (id) => /** @type {[string, Set<string>]} */ ([String(id), new Set((await getScheduledRemovals(client, { dataSetId: BigInt(id) })).map(String))]))));
			const plan = removalBatches({ remove: status?.retention?.remove ?? [] }, all, { protect, marked, scheduled });
			removeSkipped = plan.skipped;
			if (!plan.batches.length) {
				removeNote = rt.nothingSafe;
				return;
			}
			const out = await removeWithWallet(profile.payer, network, plan.batches);
			removeErrors = out.filter((o) => !o.ok).map((o) => `${o.dataSetId}: ${o.error}`);
			removeNote = rt.removed(out.filter((o) => o.ok).length, out.length);
		} catch (e) {
			removeNote = String(/** @type {any} */ (e)?.message ?? e).slice(0, 200);
		} finally {
			removing = false;
		}
	};

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
			const entry = done.backupRequest?.backup?.backup;
			resultOk = outcome !== 'partial' && outcome !== 'empty';
			resultWarn = outcome === 'partial' || outcome === 'empty';
			result = outcome === 'partial' ? t.donePartial(entry?.copies?.length ?? 0, entry?.requestedCopies ?? 0) : outcome === 'unchanged' ? t.doneUnchanged : outcome === 'empty' ? t.doneEmpty : t.doneNow;
		} catch (e) {
			resultOk = false;
			resultWarn = false;
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
			{#if view.check?.at}<span data-testid="backup-check">{t.checked} {when(view.check.at, lang)}, {t.checkOutcome(view.check.status)}</span>{#if view.last?.at || view.next}{' · '}{/if}{/if}
			{#if view.last?.at}<span>{t.lastShort} {when(view.last.at, lang)}</span>{#if view.next}{' · '}{/if}{:else if earlier}<span>{t.lastShort} {when(earlier.at, lang)}</span>{#if view.next}{' · '}{/if}{/if}
			{#if view.next?.kind === 'backup' && view.next.at}<span data-testid="backup-next">{t.nextBackup} {when(view.next.at, lang)}</span>
			{:else if view.next?.kind === 'onChange'}<span data-testid="backup-next">{t.nextOnChange}</span>
			{:else if view.next?.at}<span data-testid="backup-next">{t.nextShort} {when(view.next.at, lang)}</span>{/if}
		</p>
		<p class="hint">{view.minHours ? t.nextHintQuiet(view.minHours) : t.nextHint}</p>
		<p data-testid="backup-last">
			{t.last}:
			{#if view.last}
				{#if view.last.at}<strong>{when(view.last.at, lang)}</strong>{/if}
				{#if view.last.ok && view.last.copies >= view.last.requested}<span class="ok"> · {t.ok(view.last.copies, view.last.requested)}</span>
				{:else if view.last.ok}<span class="warn" data-testid="backup-short"> · {t.short(view.last.copies, view.last.requested)}</span>
				{:else}<span class="bad"> · {t.failed}{view.last.reason ? ` (${view.last.reason})` : ''}</span>{/if}
			{:else if earlier}<strong>{when(earlier.at, lang)}</strong>{earlier.copies ? ` · ${t.copies(earlier.copies)}` : ''}<span class="quiet" data-testid="backup-before-start">{' · '}{t.beforeStart}</span>
			{:else}{t.none}{/if}
		</p>
		{#if busy || view.running}
			<p class="progress" role="status" data-testid="backup-progress">{stage === 'sending' ? t.sending : t.running}{view.log ? ` ${view.log}` : ''}</p>
		{/if}
		{#if kept && !simple}
			<details class="retention" data-testid="backup-retention">
				<summary>{rt.title}{kept.failed ? '' : `: ${rt.summary(kept.keep, kept.remove)}`}</summary>
				{#if kept.failed}<p class="warn">{rt.failed}</p>
				{:else}
					{#if kept.policy}<p class="hint">{rt.policy(kept.policy)}</p>{/if}
					<ul>
						{#each kept.rows as r (r.pieceCid)}
							<li class:gone={!r.keep && kept.sent} data-testid={r.keep ? 'retention-keep' : 'retention-remove'}>
								<span>{r.at ? when(r.at, lang) : rt.undated}</span>
								{#if r.size != null}<span class="quiet"> · {backupSize(r.size)}</span>{/if}
								{#if !r.complete}<span class="warn"> · {rt.partial}</span>{/if}
								<span> · {r.keep ? `${rt.keep} (${r.reasons.map((x) => rt.reasons[x]).join(', ')})` : kept.sent ? rt.remove : rt.toRemove}</span>
							</li>
						{/each}
					</ul>
					{#if kept.remove}<p class="hint" data-testid="retention-note">{kept.sent ? rt.queued : kept.needsWallet ? rt.needsWallet : rt.planned}</p>{/if}
					{#if kept.overBudget}<p class="warn">{rt.overBudget}</p>{/if}
				{/if}
			</details>
		{/if}
		{#if canRemove}
			<button type="button" class="small" onclick={removeOld} disabled={removing || busy} data-testid="retention-remove-wallet">{rt.removeButton(kept.remove)}</button>
		{/if}
		{#if removeNote}<p class="hint" role="status" data-testid="retention-remove-result">{removeNote}</p>{/if}
		{#if removeSkipped.length}<ul class="hint" data-testid="retention-remove-skipped">{#each removeSkipped as x (x.pieceCid)}<li>…{x.pieceCid.slice(-12)}: {rt.skippedWhy[x.why]}</li>{/each}</ul>{/if}
		{#if removeErrors.length}<ul class="warn">{#each removeErrors as err (err)}<li>{err}</li>{/each}</ul>{/if}
		{#if kept && simple && (kept.failed || kept.overBudget)}<p class="warn" data-testid="backup-retention-warning">{kept.failed ? rt.failed : rt.overBudget}</p>{/if}
		<button type="button" class="small" onclick={() => (guard ? guard(backUpNow) : backUpNow())} disabled={disabled || busy || view.running} data-testid="backup-now">{t.now}</button>
	{:else if answered}
		<p class="hint" data-testid="backup-unreachable">{t.unreachable}</p>
	{/if}
	{#if result}<p class={resultOk ? 'ok' : resultWarn ? 'warn' : 'bad'} role="status" data-testid="backup-result">{result}</p>{/if}
	{#if details.length && !simple}<details class="log"><summary>{t.reason}</summary><pre>{details.join('\n')}</pre><ProviderHealth network={profile.network ?? 'calibration'} ids={[...new Set([...providerIdsIn(details), ...(profile.backupConfig?.providerIds ?? [])])]} /></details>{/if}
</div>

<style>
	.backup { margin: 0.75rem 0 0; padding: 0.9rem 1rem; background: var(--surface-2); border-radius: var(--radius-sm); }
	.backup p { margin: 0.15rem 0; }
	.label { color: var(--text-2); font-size: 0.85rem; margin-bottom: 0.35rem; }
	.hint { color: var(--text-2); font-size: 0.875rem; }
	.summary::first-letter { text-transform: uppercase; }
	.ok { color: var(--ok); }
	.bad { color: var(--danger); }
	.warn { color: var(--warn); }
	.quiet { color: var(--text-2); }
	.progress { color: var(--text-2); font-size: 0.9rem; word-break: break-word; }
	.small { margin-top: 0.6rem; padding: 0.35rem 0.85rem; font-size: 0.875rem; background: var(--surface); color: var(--text); border-color: var(--line); }
	.log pre { white-space: pre-wrap; font-size: 0.8rem; }
	.retention { margin-top: 0.5rem; font-size: 0.9rem; }
	.retention ul { margin: 0.35rem 0; padding-left: 1.1rem; }
	.retention li.gone { color: var(--text-2); text-decoration: line-through; }
</style>
