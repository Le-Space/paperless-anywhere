<script>
	// Fetching a backup yourself: what a person needs to fetch a backup without a
	// VM and decrypt it on their own machine. Where the pieces lie is public
	// and shown at once. The backup key is shown only after the person has said
	// that they want it, stays in this component's memory for that long, and is
	// never written to storage, a URL or the console by the app.
	import { BackupFetchError, fetchBackup, MEMORY_LIMIT_BYTES, openSink, storedBytes } from '$lib/backup-fetch.js';
	import { ageSecretKey, restoreEntry, selfRestoreGuide } from '$lib/backups.js';
	import { format, lang, t } from '$lib/i18n/index.js';

	/** @type {{ backup: any, identity: string | null | undefined }} */
	let { backup, identity } = $props();

	let open = $state(false);
	let wanted = $state(false);
	let shown = $state(false);
	let copied = $state(false);
	const x = $derived($t.backup.export);
	const f = $derived($t.backup.fetch);
	const keyFile = $derived($t.backup.guide.keyFile);
	// Written again when the language changes.
	const guide = $derived(($lang, selfRestoreGuide(backup)));
	const key = $derived(ageSecretKey(identity));

	// Another backup, or the panel closed: the key is hidden again.
	$effect(() => {
		backup.pieceCid;
		if (!open) wanted = false;
		shown = false;
		copied = false;
	});

	// Fetching in the browser: the pieces come from the providers, age opens
	// them here, and the zip goes into a file the person picks (or, where the
	// browser cannot do that, into memory up to a limit and then a download).
	const total = $derived(storedBytes(backup));
	const canPickFile = typeof globalThis.showSaveFilePicker === 'function';
	const fits = $derived(canPickFile || (total != null && total <= MEMORY_LIMIT_BYTES));
	// What went wrong or where the zip went is kept as a kind, so the sentence follows the language.
	/** @type {{ state: 'idle' | 'running' | 'done' | 'failed', fetched: number, written: number, reason?: string, where?: 'file' | 'memory' }} */
	let run = $state({ state: 'idle', fetched: 0, written: 0 });
	const failure = $derived(run.state !== 'failed' ? '' : run.reason === 'file' ? f.fileFailed : (/** @type {Record<string, string>} */ (f.errors)[run.reason ?? ''] ?? f.failed));
	/** @type {AbortController | null} */
	let stop = null;
	const mb = (/** @type {number} */ n) => (n >= 1024 ** 3 ? `${format.number(n / 1024 ** 3, { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false }, $lang)} GB` : `${Math.round(n / 1024 ** 2)} MB`);
	const zipName = $derived(`paperless-export-${backup.pieceCid.slice(-12)}.zip`);

	$effect(() => {
		backup.pieceCid;
		return () => stop?.abort();
	});

	async function fetchHere() {
		if (!key || run.state === 'running') return;
		const wanted = backup;
		let target;
		try {
			// Asked first, while the click still counts as the person's own.
			target = await openSink({ suggestedName: zipName, total });
		} catch (e) {
			if (/** @type {any} */ (e)?.name === 'AbortError') return;
			run = { state: 'failed', fetched: 0, written: 0, reason: e instanceof BackupFetchError ? e.reason : 'file' };
			return;
		}
		stop = new AbortController();
		run = { state: 'running', fetched: 0, written: 0 };
		try {
			const result = await fetchBackup({ backup: wanted, identity: key, sink: target.sink, signal: stop.signal, onProgress: (p) => ((run.fetched = p.fetched), (run.written = p.written)) });
			const blob = target.finish();
			if (blob) saveBlob(zipName, blob);
			run = { state: 'done', ...result, where: target.kind };
		} catch (e) {
			run = { state: 'failed', fetched: run.fetched, written: 0, reason: e instanceof BackupFetchError ? e.reason : '' };
		} finally {
			stop = null;
		}
	}

	/** @type {(filename: string, text: string, type?: string) => void} */
	const save = (filename, text, type = 'text/plain;charset=utf-8') => saveBlob(filename, new Blob([text], { type }));
	/** @param {string} filename @param {Blob} blob */
	function saveBlob(filename, blob) {
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		document.body.append(a);
		a.click();
		a.remove();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}
	const saveGuide = () => save(guide.filename, guide.text);
	const saveEntry = () => save('ledger.json', `${JSON.stringify([restoreEntry(backup)], null, 2)}\n`, 'application/json');
	const saveKey = () => key && save(keyFile, `${key}\n`);
	async function copyKey() {
		if (!key) return;
		await navigator.clipboard.writeText(key);
		copied = true;
	}
</script>

<details class="export" bind:open data-testid="backup-export">
	<summary>{x.summary}</summary>
	<p class="hint">{x.intro.before}<code>{backup.pieceCid.slice(-12)}</code>{x.intro.afterId}<code>curl</code>{x.intro.and}<code>age</code>{x.intro.after}</p>
	<p class="row">
		<button type="button" class="small" onclick={saveGuide} data-testid="export-guide">{x.saveGuide}</button>
		<button type="button" class="small" onclick={saveEntry} data-testid="export-entry">{x.saveEntry}</button>
	</p>
	{#if !guide.complete}<p class="warn" role="status">{x.incomplete}</p>{/if}

	{#if key}
		<div class="fetch" data-testid="backup-fetch">
			<p><strong>{x.hereStrong}</strong> {x.here(canPickFile)}{#if total != null} {x.size(mb(total))}{/if}</p>
			{#if !guide.complete}
				<p class="hint">{x.missingAddress}</p>
			{:else if !fits}
				<p class="hint" data-testid="fetch-too-large">{x.tooLarge(mb(MEMORY_LIMIT_BYTES))}</p>
			{:else if run.state === 'running'}
				<p role="status" data-testid="fetch-progress">{x.progress(mb(run.fetched), total != null ? mb(total) : null, mb(run.written))}</p>
				{#if total != null}<progress max={total} value={run.fetched}></progress>{/if}
				<p class="row"><button type="button" class="small" onclick={() => stop?.abort()} data-testid="fetch-stop">{x.stop}</button> <span class="hint">{x.keepOpen}</span></p>
			{:else}
				<p class="row"><button type="button" class="small" onclick={fetchHere} data-testid="fetch-start">{x.start}</button></p>
			{/if}
			{#if run.state === 'done'}<p role="status" data-testid="fetch-done">{x.done(mb(run.written), run.where === 'file' ? f.savedToFile : f.handedOver)}</p>{/if}
			{#if run.state === 'failed'}<p class="warn" role="alert" data-testid="fetch-failed">{failure}</p>{/if}
		</div>
		<div class="key">
			<p><strong>{x.keyStrong}</strong>{x.key}</p>
			<label class="check"><input type="checkbox" bind:checked={wanted} data-testid="export-key-wanted" /> {x.keyWanted}</label>
			{#if wanted && !shown}<p class="row"><button type="button" class="small" onclick={() => (shown = true)} data-testid="export-key-show">{x.keyShow}</button></p>{/if}
			{#if wanted && shown}
				<p><code class="secret" data-testid="export-key">{key}</code></p>
				<p class="row">
					<button type="button" class="small" onclick={copyKey} data-testid="export-key-copy">{copied ? x.copied : x.copy}</button>
					<button type="button" class="small" onclick={saveKey} data-testid="export-key-save">{x.saveKey(keyFile)}</button>
					<button type="button" class="link" onclick={() => ((shown = false), (wanted = false))}>{x.hide}</button>
				</p>
				<p class="hint">{x.cleanUp}</p>
			{/if}
		</div>
	{:else}
		<p class="hint">{x.noKey}</p>
	{/if}
</details>

<style>
	.export { margin: 0.75rem 0; font-size: 0.95rem; }
	.export summary { cursor: pointer; }
	.export p { margin: 0.5rem 0; }
	.row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 0.9rem; }
	.fetch { margin-top: 0.75rem; padding: 0.75rem 0.9rem; border-radius: var(--radius-sm); border: 1px solid var(--line); }
	.fetch progress { width: 100%; }
	.key { margin-top: 0.75rem; padding: 0.75rem 0.9rem; border-radius: var(--radius-sm); background: var(--warn-bg); }
	.check { display: flex; gap: 0.5rem; align-items: flex-start; }
	.secret { display: block; padding: 0.5rem 0.6rem; background: var(--surface); border: 1px solid var(--line); border-radius: 6px; overflow-wrap: anywhere; font-size: 0.8rem; user-select: all; }
	.link { background: none; border: none; color: var(--text-2); text-decoration: underline; padding: 0; font-size: 0.9rem; }
	.hint { color: var(--text-2); }
	.warn { color: var(--warn); }
</style>
