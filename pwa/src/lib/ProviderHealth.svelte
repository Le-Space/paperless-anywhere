<script>
	// Whether the storage providers answer right now: a dot per provider from
	// its public ping, with a link to it in the explorer. Reachable is not the
	// same as accepting an upload; the VM's own lines say that.
	import { t } from '$lib/i18n/index.js';
	import { providerHealth } from '$lib/providers.js';

	/** @type {{ network: string, ids: number[] }} */
	let { network, ids } = $props();
	/** @type {Awaited<ReturnType<typeof providerHealth>> | null} */
	let health = $state(null);
	let failed = $state(false);
	const h = $derived($t.backup.health);
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
		<p class="title">{h.title} <button class="link" onclick={check}>{h.again}</button></p>
		{#if failed}<p class="hint">{h.listUnreadable}</p>
		{:else if !health}<p class="hint">{h.asking}</p>
		{:else}
			<ul>
				{#each health as p (p.id)}
					<li data-testid={`provider-${p.id}`}>
						<span class="dot" class:ok={p.ok} aria-hidden="true"></span>
						{h.provider(p.id)} · {p.name}{p.place ? ` (${p.place})` : ''}:
						{p.ok ? h.answers(p.ms) : p.status ? h.answersError(p.status) : h.silent}
						· <a href={p.explorer} target="_blank" rel="noopener noreferrer">{h.explorer}</a>
					</li>
				{/each}
			</ul>
			<p class="hint">{h.hint}</p>
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
