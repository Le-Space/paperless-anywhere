<script>
	// The Belege signet (coin and receipt, style guide 02) with "LE SPACE" and the
	// product's name beside it. Colours come from the tokens; never tinted apart.
	// The name is always "Paperless anywhere", never "paperless" alone: that is
	// the Paperless-ngx project's word, not ours. `sub` is an optional line below.
	/** @type {{ size?: number, name?: string, sub?: import('svelte').Snippet }} */
	let { size = 36, name = 'Paperless anywhere', sub } = $props();
</script>

<span class="logo" style="--size: {size}px">
	<svg class="mark" viewBox="0 0 100 100" aria-hidden="true">
		<circle class="coin" cx="36" cy="38" r="27" fill="none" stroke-width="17" />
		<path
			class="receipt"
			fill-rule="evenodd"
			d="M43 47 h50 a9 9 0 0 1 9 9 v37 a9 9 0 0 1 -9 9 h-50 a9 9 0 0 1 -9 -9 v-37 a9 9 0 0 1 9 -9 z
			   M58 60 h20 a6 6 0 0 1 6 6 v17 a6 6 0 0 1 -6 6 h-20 a6 6 0 0 1 -6 -6 v-17 a6 6 0 0 1 6 -6 z"
		/>
	</svg>
	<span class="words">
		<span class="prefix">LE SPACE</span>
		<span class="name">{name}</span>
		{#if sub}<span class="sub">{@render sub()}</span>{/if}
	</span>
</span>

<style>
	.logo { display: inline-flex; align-items: center; gap: calc(var(--size) * 0.3); }
	.mark { display: block; flex: none; width: var(--size); height: var(--size); }
	.coin { stroke: var(--mark-coin); }
	.receipt { fill: var(--mark-receipt); }
	.words { display: flex; flex-direction: column; line-height: 1; }
	.prefix { font-family: var(--mono); font-size: calc(var(--size) * 0.24); letter-spacing: 0.32em; color: var(--text-2); margin-bottom: calc(var(--size) * 0.1); }
	.name { font-weight: 700; font-size: calc(var(--size) * 0.62); letter-spacing: -0.03em; color: var(--text); }
	.sub { font-size: calc(var(--size) * 0.3); color: var(--text-2); margin-top: calc(var(--size) * 0.12); line-height: 1.3; }
</style>
