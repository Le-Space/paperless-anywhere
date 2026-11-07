<script>
	// Whether the storage providers answer right now: a dot per provider from
	// its public ping, with a link to it in the explorer. Reachable is not the
	// same as accepting an upload; the VM's own lines say that.
	import { providerHealth } from '$lib/providers.js';

	/** @type {{ network: string, ids: number[] }} */
	let { network, ids } = $props();
	/** @type {Awaited<ReturnType<typeof providerHealth>> | null} */
	let health = $state(null);
	let failed = $state(false);
	const key = $derived(`${network}:${[...ids].sort((a, b) => a - b).join(',')}`);
	function check() {
		failed = false;
		health = null;
		providerHealth(network, ids)
			.then((h) => (health = h))
			.catch(() => (failed = true));
	}
	$effect(() => {
		key;
		check();
	});
</script>

{#if ids.length}
	<div class="health" data-testid="provider-health">
		<p class="title">Speicheranbieter jetzt <button class="link" onclick={check}>neu prüfen</button></p>
		{#if failed}<p class="hint">Die Anbieterliste ließ sich gerade nicht lesen.</p>
		{:else if !health}<p class="hint">Anbieter werden gefragt …</p>
		{:else}
			<ul>
				{#each health as h (h.id)}
					<li data-testid={`provider-${h.id}`}>
						<span class="dot" class:ok={h.ok} aria-hidden="true"></span>
						Anbieter {h.id} · {h.name}{h.place ? ` (${h.place})` : ''}:
						{h.ok ? `antwortet (${h.ms} ms)` : h.status ? `antwortet mit Fehler ${h.status}` : 'antwortet nicht'}
						· <a href={h.explorer} target="_blank" rel="noopener noreferrer">im Explorer</a>
					</li>
				{/each}
			</ul>
			<p class="hint">„Antwortet“ heißt erreichbar; ob ein Anbieter Daten annimmt, zeigt erst die nächste Sicherung.</p>
		{/if}
	</div>
{/if}

<style>
	.health { margin: 0.5rem 0; }
	.title { margin: 0 0 0.25rem; color: var(--text-2); }
	ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.2rem; font-size: 0.9rem; }
	.dot { display: inline-block; width: 0.6rem; height: 0.6rem; border-radius: 999px; background: var(--danger); margin-right: 0.35rem; }
	.dot.ok { background: var(--ok); }
	.hint { color: var(--text-2); font-size: 0.85rem; margin: 0.25rem 0 0; }
	.link { background: none; border: none; padding: 0; color: var(--accent-text); text-decoration: underline; cursor: pointer; font-size: 0.85rem; }
</style>
