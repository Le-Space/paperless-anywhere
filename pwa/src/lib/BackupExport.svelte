<script>
	// "Sicherung selbst holen": what a person needs to fetch a backup without a
	// VM and decrypt it on their own machine. Where the pieces lie is public
	// and shown at once. The backup key is shown only after the person has said
	// that they want it, stays in this component's memory for that long, and is
	// never written to storage, a URL or the console by the app.
	import { BackupFetchError, fetchBackup, MEMORY_LIMIT_BYTES, openSink, storedBytes } from '$lib/backup-fetch.js';
	import { ageSecretKey, restoreEntry, selfRestoreGuide } from '$lib/backups.js';

	/** @type {{ backup: any, identity: string | null | undefined }} */
	let { backup, identity } = $props();

	let open = $state(false);
	let wanted = $state(false);
	let shown = $state(false);
	let copied = $state(false);
	const guide = $derived(selfRestoreGuide(backup));
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
	/** @type {{ state: 'idle' | 'running' | 'done' | 'failed', fetched: number, written: number, message: string }} */
	let run = $state({ state: 'idle', fetched: 0, written: 0, message: '' });
	/** @type {AbortController | null} */
	let stop = null;
	const mb = (/** @type {number} */ n) => (n >= 1024 ** 3 ? `${(n / 1024 ** 3).toFixed(2).replace('.', ',')} GB` : `${Math.round(n / 1024 ** 2)} MB`);
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
			run = { state: 'failed', fetched: 0, written: 0, message: e instanceof BackupFetchError ? e.message : 'Die Datei ließ sich nicht anlegen.' };
			return;
		}
		stop = new AbortController();
		run = { state: 'running', fetched: 0, written: 0, message: '' };
		try {
			const result = await fetchBackup({ backup: wanted, identity: key, sink: target.sink, signal: stop.signal, onProgress: (p) => ((run.fetched = p.fetched), (run.written = p.written)) });
			const blob = target.finish();
			if (blob) saveBlob(zipName, blob);
			run = { state: 'done', ...result, message: target.kind === 'file' ? 'Gespeichert in der gewählten Datei.' : 'Als Download übergeben.' };
		} catch (e) {
			run = { state: 'failed', fetched: run.fetched, written: 0, message: e instanceof BackupFetchError ? e.message : 'Das Holen ist fehlgeschlagen.' };
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
	const saveKey = () => key && save('schluessel.txt', `${key}\n`);
	async function copyKey() {
		if (!key) return;
		await navigator.clipboard.writeText(key);
		copied = true;
	}
</script>

<details class="export" bind:open data-testid="backup-export">
	<summary>Sicherung selbst holen (ohne laufende Instanz)</summary>
	<p class="hint">Die gewählte Sicherung (<code>{backup.pieceCid.slice(-12)}</code>) liegt verschlüsselt bei den Speicheranbietern und lässt sich dort ohne Paperless anywhere abrufen. Entschlüsseln kannst du sie auf deinem eigenen Rechner, mit <code>curl</code> und <code>age</code>. Heraus kommt ein Zip mit deinen Dokumenten.</p>
	<p class="row">
		<button type="button" class="small" onclick={saveGuide} data-testid="export-guide">Anleitung mit den Adressen speichern</button>
		<button type="button" class="small" onclick={saveEntry} data-testid="export-entry">Eintrag für das Werkzeug (ledger.json)</button>
	</p>
	{#if !guide.complete}<p class="warn" role="status">Für mindestens ein Stück kennt die App gerade keine Adresse; die Anleitung nennt es.</p>{/if}

	{#if key}
		<div class="fetch" data-testid="backup-fetch">
			<p><strong>Gleich hier holen:</strong> Dieser Browser lädt die Sicherung von den Speicheranbietern, entschlüsselt sie auf diesem Gerät und speichert das Zip{canPickFile ? ' in eine Datei deiner Wahl' : ''}. Der Schlüssel bleibt dabei im Browser.{#if total != null} Größe: etwa {mb(total)}.{/if}</p>
			{#if !guide.complete}
				<p class="hint">Dafür fehlt gerade die Adresse eines Stücks.</p>
			{:else if !fits}
				<p class="hint" data-testid="fetch-too-large">Dieser Browser kann nicht direkt in eine Datei schreiben, und die Sicherung ist zu groß für den Arbeitsspeicher (Grenze {mb(MEMORY_LIMIT_BYTES)}). Nimm Chrome oder Edge, oder die Anleitung oben.</p>
			{:else if run.state === 'running'}
				<p role="status" data-testid="fetch-progress">Geholt: {mb(run.fetched)}{#if total != null} von {mb(total)}{/if} · entschlüsselt: {mb(run.written)}</p>
				{#if total != null}<progress max={total} value={run.fetched}></progress>{/if}
				<p class="row"><button type="button" class="small" onclick={() => stop?.abort()} data-testid="fetch-stop">Abbrechen</button> <span class="hint">Lass dieses Fenster so lange offen.</span></p>
			{:else}
				<p class="row"><button type="button" class="small" onclick={fetchHere} data-testid="fetch-start">Holen und entschlüsseln</button></p>
			{/if}
			{#if run.state === 'done'}<p role="status" data-testid="fetch-done">Fertig: {mb(run.written)} entschlüsselt. {run.message}</p>{/if}
			{#if run.state === 'failed'}<p class="warn" role="alert" data-testid="fetch-failed">{run.message}</p>{/if}
		</div>
		<div class="key">
			<p><strong>Der Sicherungsschlüssel</strong> öffnet alle deine Sicherungen. Wer ihn hat, kann sie lesen. Die App zeigt ihn nur hier und nur, wenn du es verlangst; sie schickt ihn nirgendwohin.</p>
			<label class="check"><input type="checkbox" bind:checked={wanted} data-testid="export-key-wanted" /> Ich will den Schlüssel sehen und passe selbst auf ihn auf.</label>
			{#if wanted && !shown}<p class="row"><button type="button" class="small" onclick={() => (shown = true)} data-testid="export-key-show">Schlüssel anzeigen</button></p>{/if}
			{#if wanted && shown}
				<p><code class="secret" data-testid="export-key">{key}</code></p>
				<p class="row">
					<button type="button" class="small" onclick={copyKey} data-testid="export-key-copy">{copied ? 'Kopiert' : 'Kopieren'}</button>
					<button type="button" class="small" onclick={saveKey} data-testid="export-key-save">Als schluessel.txt speichern</button>
					<button type="button" class="link" onclick={() => ((shown = false), (wanted = false))}>Wieder verbergen</button>
				</p>
				<p class="hint">Lösche die Datei, wenn du fertig bist, und leere die Zwischenablage.</p>
			{/if}
		</div>
	{:else}
		<p class="hint">Der Sicherungsschlüssel dieses Tresors ist hier nicht hinterlegt.</p>
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
