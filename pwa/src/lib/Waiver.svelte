<script>
	// The declaration on withdrawal before a payment (§ 356 Abs. 4 and 5 BGB):
	// the service's own text, verbatim and as text, next to a checkbox that
	// starts unticked. Its own box, apart from the terms (AGB). Nothing at all
	// while the service sends no declaration (an older service).
	import { withdrawalText } from '$lib/credits.js';
	import { lang } from '$lib/i18n/index.js';

	/** @type {{ withdrawal: { version: string, de: string, en: string } | null, checked?: boolean, testid?: string }} */
	let { withdrawal, checked = $bindable(false), testid = 'waiver' } = $props();
</script>

{#if withdrawal}
	<label class="check" data-testid={testid}>
		<input type="checkbox" bind:checked data-testid={`${testid}-box`} />
		<span>{withdrawalText(withdrawal, $lang)}</span>
	</label>
{/if}

<style>
	.check { display: flex; gap: 0.5rem; align-items: flex-start; margin: 0.5rem 0; font-size: 0.85rem; color: var(--text-2); flex-basis: 100%; }
	.check input { width: auto; margin-top: 0.2rem; flex: none; }
</style>
