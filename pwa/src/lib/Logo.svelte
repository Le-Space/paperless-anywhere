<script>
	// The Belege signet (coin and receipt, style guide 02) with "LE SPACE" and the
	// product's name beside it. Colours come from the tokens; never tinted apart.
	// The name is always "Paperless anywhere", never "paperless" alone: that is
	// the Paperless-ngx project's word, not ours. `sub` is an optional line below.
	//
	// With `href` the signet and the name are a link (the app's way home); the
	// line below stays outside it, since it may hold a link of its own.
	// `label` is what the link is called and shows on hover; `onnavigate` gets
	// the click and may prevent it.
	/** @type {{ size?: number, name?: string, sub?: import('svelte').Snippet, href?: string, label?: string, onnavigate?: (event: MouseEvent) => void }} */
	let { size = 36, name = 'Paperless anywhere', sub, href = '', label = '', onnavigate = () => {} } = $props();
</script>

{#snippet mark()}
	<svg class="mark" viewBox="0 0 100 100" aria-hidden="true">
		<circle class="coin" cx="36" cy="38" r="27" fill="none" stroke-width="17" />
		<path
			class="receipt"
			fill-rule="evenodd"
			d="M43 47 h50 a9 9 0 0 1 9 9 v37 a9 9 0 0 1 -9 9 h-50 a9 9 0 0 1 -9 -9 v-37 a9 9 0 0 1 9 -9 z
			   M58 60 h20 a6 6 0 0 1 6 6 v17 a6 6 0 0 1 -6 6 h-20 a6 6 0 0 1 -6 -6 v-17 a6 6 0 0 1 6 -6 z"
		/>
	</svg>
{/snippet}
{#snippet title()}
	<span class="prefix">LE SPACE</span>
	<span class="name">{name}</span>
{/snippet}

<span class="logo" style="--size: {size}px">
	{#if href}
		<!-- The same target as the name beside it: one link is enough for a keyboard and a screen reader. -->
		<a class="home" {href} tabindex="-1" aria-hidden="true" onclick={onnavigate}>{@render mark()}</a>
	{:else}
		{@render mark()}
	{/if}
	<span class="words">
		{#if href}
			<a class="home title" {href} title={label || undefined} aria-label={label || undefined} data-testid="logo-home" onclick={onnavigate}>{@render title()}</a>
		{:else}
			{@render title()}
		{/if}
		{#if sub}<span class="sub">{@render sub()}</span>{/if}
	</span>
</span>

<style>
	.logo { display: inline-flex; align-items: center; gap: calc(var(--size) * 0.3); }
	.mark { display: block; flex: none; width: var(--size); height: var(--size); }
	.coin { stroke: var(--mark-coin); }
	.receipt { fill: var(--mark-receipt); }
	.words { display: flex; flex-direction: column; line-height: 1; }
	.home { color: inherit; text-decoration: none; border-radius: 6px; }
	.home.title { display: flex; flex-direction: column; }
	.home:focus-visible { outline: 2px solid var(--focus); outline-offset: 3px; }
	.prefix { font-family: var(--mono); font-size: calc(var(--size) * 0.24); letter-spacing: 0.32em; color: var(--text-2); margin-bottom: calc(var(--size) * 0.1); }
	.name { font-weight: 700; font-size: calc(var(--size) * 0.62); letter-spacing: -0.03em; color: var(--text); }
	.sub { font-size: calc(var(--size) * 0.3); color: var(--text-2); margin-top: calc(var(--size) * 0.12); line-height: 1.3; }
</style>
