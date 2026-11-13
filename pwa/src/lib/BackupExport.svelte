<script>
	// "Sicherung selbst holen": what a person needs to fetch a backup without a
	// VM and decrypt it on their own machine. Where the pieces lie is public
	// and shown at once. The backup key is shown only after the person has said
	// that they want it, stays in this component's memory for that long, and is
	// never written to storage, a URL or the console by the app.
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

	/** @param {string} filename @param {string} text @param {string} [type] */
	function save(filename, text, type = 'text/plain;charset=utf-8') {
		const url = URL.createObjectURL(new Blob([text], { type }));
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
	.key { margin-top: 0.75rem; padding: 0.75rem 0.9rem; border-radius: var(--radius-sm); background: var(--warn-bg); }
	.check { display: flex; gap: 0.5rem; align-items: flex-start; }
	.secret { display: block; padding: 0.5rem 0.6rem; background: var(--surface); border: 1px solid var(--line); border-radius: 6px; overflow-wrap: anywhere; font-size: 0.8rem; user-select: all; }
	.link { background: none; border: none; color: var(--text-2); text-decoration: underline; padding: 0; font-size: 0.9rem; }
	.hint { color: var(--text-2); }
	.warn { color: var(--warn); }
</style>
