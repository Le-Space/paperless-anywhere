<script>
	// A long address or key: shortened on screen (the whole value stays in the
	// text, for reading aloud and searching), with a button to copy it.
	import { t } from '$lib/i18n/index.js';

	/** @type {{ value: string, testid?: string }} */
	let { value, testid } = $props();
	let copied = $state(false);
	async function copy() {
		try {
			await navigator.clipboard.writeText(value);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			// No clipboard here: the value can still be selected.
		}
	}
</script>

<span class="addr"><code title={value} data-testid={testid}>{value}</code><button type="button" class="copy" onclick={copy} aria-label={$t.setup.copy}>{copied ? $t.setup.copied : $t.setup.copy}</button></span>

<style>
	.addr { display: inline-flex; align-items: baseline; gap: 0.4rem; max-width: 100%; vertical-align: bottom; }
	code { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; max-width: 22ch; display: inline-block; vertical-align: bottom; }
	.copy { display: inline; margin: 0; padding: 0; background: none; border: none; color: var(--text-2); text-decoration: underline; font-size: 0.85rem; cursor: pointer; }
</style>
