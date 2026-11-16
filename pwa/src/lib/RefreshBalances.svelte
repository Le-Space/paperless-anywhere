<script>
	// "Kontostand neu laden": every balance and what depends on it, read again (balance-refresh.js).
	import { refreshBalances } from '$lib/balance-refresh.js';
	import { t } from '$lib/i18n/index.js';

	/** @type {{ label?: string, testid?: string }} */
	let { label = '', testid = 'refresh-balances' } = $props();
</script>

<button type="button" class="refresh" onclick={() => refreshBalances()} data-testid={testid}>{label || $t.funds.refresh}</button>

<style>
	.refresh { background: none; border: none; color: inherit; text-decoration: underline; padding: 0; font: inherit; font-size: 0.9rem; cursor: pointer; }
</style>
