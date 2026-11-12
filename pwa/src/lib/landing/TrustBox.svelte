<svelte:options namespace="svg" />

<script>
	// One box of the trust diagram (Trust.svelte): a kicker, a title, a line
	// under it and short lines of text, each from the catalogue; `key` puts a
	// coloured dot in the corner for the key that belongs to this place.
	/** @type {{ x: number, y: number, w: number, h: number, kicker?: string, title: string, sub?: string, lines?: string[], tone?: '' | 'ok' | 'warn' | 'outer', key?: '' | 'image' | 'data' | 'vault' }} */
	let { x, y, w, h, kicker = '', title, sub = '', lines = [], tone = '', key = '' } = $props();
	const top = $derived(y + (kicker ? 40 : 21));
	const first = $derived(top + (sub ? 36 : 19));
</script>

<g class="box {tone}">
	<rect {x} {y} width={w} height={h} rx="12" />
	{#if key}<circle class="dot {key}" cx={x + w - 16} cy={y + 16} r="6" />{/if}
	{#if kicker}<text class="kicker" x={x + 14} y={y + 20}>{kicker}</text>{/if}
	<text class="title" x={x + 14} y={top}>{title}</text>
	{#if sub}<text class="sub" x={x + 14} y={top + 18}>{sub}</text>{/if}
	{#each lines as line, i}<text class="line" x={x + 14} y={first + i * 17}>{line}</text>{/each}
</g>

<style>
	rect { fill: var(--surface); stroke: var(--line); stroke-width: 1.5; }
	.outer rect { fill: var(--surface-2); stroke: var(--text-2); stroke-dasharray: 5 4; }
	.ok rect { fill: var(--ok-bg); stroke: var(--ok); }
	.warn rect { fill: var(--warn-bg); stroke: var(--warn); }
	text { fill: var(--text-2); font-family: var(--font); font-size: 12.5px; }
	.kicker { fill: var(--accent-text); font-family: var(--mono); font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; }
	.title { fill: var(--text); font-size: 14.5px; font-weight: 600; }
	.ok .title { fill: var(--ok); }
	.warn .title { fill: var(--warn); }
	.sub { font-size: 12px; }
	.dot { stroke: var(--surface); stroke-width: 2; }
	.dot.image { fill: var(--warn); }
	.dot.data { fill: var(--ok); }
	.dot.vault { fill: var(--accent-2-text); }
</style>
