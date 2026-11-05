<script>
	// The live TEE nodes on Aleph, drawn the way local-first.le-space.de draws
	// its network (NetworkViz): glowing nodes on a ring, packets travelling,
	// a tooltip on hover. Here the ring is the confidential-capable nodes and
	// the centre is "your VM". No libp2p, nothing is dialled: one GET.
	import { onMount } from 'svelte';
	import { loadTeeNodes } from './tee-nodes.js';

	let { t } = $props();

	/** @type {import('./tee-nodes.js').TeeNode[]} */
	let nodes = $state([]);
	let status = $state('loading');
	let canvas = $state();
	const fitting = $derived(nodes.filter((n) => n.fits).length);

	onMount(() => {
		loadTeeNodes()
			.then((list) => {
				nodes = list;
				status = 'ok';
			})
			.catch(() => (status = 'error'));

		const ctx = canvas.getContext('2d');
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		const dark = window.matchMedia('(prefers-color-scheme: dark)');
		const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
		let w = 0, h = 0, raf = 0, colors = {};
		/** @type {{ x: number, y: number, r: number, node: any }[]} */
		let placed = [];
		/** @type {{ to: number, t: number, back: boolean }[]} */
		let packets = [];
		const mouse = { x: -1, y: -1 };

		const readColors = () => {
			colors = {
				fit: css('--accent'),
				full: css('--text-2'),
				line: css('--line'),
				text: css('--text-2'),
				self: css('--accent-2-text'),
				tipBg: css('--surface'),
				tipText: css('--text'),
				glow: dark.matches ? 1 : 0
			};
		};
		readColors();
		dark.addEventListener('change', readColors);

		const resize = () => {
			const rect = canvas.getBoundingClientRect();
			w = rect.width;
			h = rect.height;
			canvas.width = w * dpr;
			canvas.height = h * dpr;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		};
		resize();
		const ro = new ResizeObserver(resize);
		ro.observe(canvas);

		const layout = () => {
			const cx = w / 2, cy = h / 2;
			const R = Math.min(w, h) * 0.38;
			placed = nodes.map((node, i) => {
				const a = (i / Math.max(nodes.length, 1)) * Math.PI * 2 - Math.PI / 2;
				// Free memory sets the size, within reason.
				const r = 4 + Math.min(8, Math.sqrt(node.freeMemoryGiB) / 3);
				return { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R, r, node };
			});
			return { cx, cy };
		};

		let last = 0;
		const frame = (now) => {
			const dt = Math.min(64, now - (last || now)) / 1000;
			last = now;
			const { cx, cy } = layout();
			ctx.clearRect(0, 0, w, h);

			// Spokes from your VM to every node.
			ctx.lineWidth = 1;
			for (const p of placed) {
				ctx.strokeStyle = colors.line;
				ctx.globalAlpha = p.node.fits ? 0.9 : 0.4;
				ctx.beginPath();
				ctx.moveTo(cx, cy);
				ctx.lineTo(p.x, p.y);
				ctx.stroke();
			}
			ctx.globalAlpha = 1;

			// Packets: the app asking a node, the node answering with its attestation.
			if (!still && placed.length) {
				if (Math.random() < dt * 2.5 && packets.length < 8) {
					const fits = placed.map((p, i) => (p.node.fits ? i : -1)).filter((i) => i >= 0);
					const pool = fits.length ? fits : placed.map((_, i) => i);
					packets.push({ to: pool[Math.floor(Math.random() * pool.length)], t: 0, back: false });
				}
				for (const pk of packets) pk.t += dt * 0.7;
				for (const pk of packets) if (pk.t >= 1 && !pk.back) Object.assign(pk, { t: 0, back: true });
				packets = packets.filter((pk) => !(pk.back && pk.t >= 1) && placed[pk.to]);
				for (const pk of packets) {
					const p = placed[pk.to];
					const f = pk.back ? 1 - pk.t : pk.t;
					ctx.beginPath();
					ctx.arc(cx + (p.x - cx) * f, cy + (p.y - cy) * f, 2.6, 0, Math.PI * 2);
					ctx.fillStyle = pk.back ? colors.fit : colors.self;
					ctx.shadowColor = ctx.fillStyle;
					ctx.shadowBlur = 8 * colors.glow;
					ctx.fill();
					ctx.shadowBlur = 0;
				}
			}

			// The nodes.
			let hover = null;
			for (const p of placed) {
				const color = p.node.fits ? colors.fit : colors.full;
				ctx.beginPath();
				ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
				ctx.fillStyle = color;
				ctx.globalAlpha = p.node.fits ? 0.25 : 0.15;
				ctx.fill();
				ctx.globalAlpha = 1;
				ctx.beginPath();
				ctx.arc(p.x, p.y, p.r * 0.55, 0, Math.PI * 2);
				ctx.shadowColor = color;
				ctx.shadowBlur = (p.node.fits ? 12 : 3) * colors.glow;
				ctx.fill();
				ctx.shadowBlur = 0;
				if (Math.hypot(mouse.x - p.x, mouse.y - p.y) < p.r + 6) hover = p;
			}

			// Your VM in the middle.
			const pulse = still ? 0 : (Math.sin(now / 600) + 1) / 2;
			ctx.beginPath();
			ctx.arc(cx, cy, 14 + pulse * 4, 0, Math.PI * 2);
			ctx.strokeStyle = colors.self;
			ctx.globalAlpha = 0.5;
			ctx.stroke();
			ctx.globalAlpha = 1;
			ctx.beginPath();
			ctx.arc(cx, cy, 8, 0, Math.PI * 2);
			ctx.fillStyle = colors.self;
			ctx.shadowColor = colors.self;
			ctx.shadowBlur = 14 * colors.glow;
			ctx.fill();
			ctx.shadowBlur = 0;
			ctx.font = '500 11px "IBM Plex Mono", monospace';
			ctx.textAlign = 'center';
			ctx.fillStyle = colors.text;
			ctx.fillText(t.you, cx, cy + 30);

			if (hover) {
				const lines = [hover.node.name, `${t.free(hover.node)}`, hover.node.fits ? t.fits : t.full];
				ctx.font = '500 12px "IBM Plex Mono", monospace';
				const bw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 20;
				const bh = lines.length * 17 + 12;
				const bx = Math.min(Math.max(8, hover.x - bw / 2), w - bw - 8);
				const by = hover.y > h / 2 ? hover.y - bh - 14 : hover.y + 14;
				ctx.fillStyle = colors.tipBg;
				ctx.strokeStyle = colors.line;
				ctx.beginPath();
				ctx.roundRect(bx, by, bw, bh, 8);
				ctx.fill();
				ctx.stroke();
				ctx.textAlign = 'left';
				lines.forEach((l, i) => {
					ctx.fillStyle = i === 0 ? colors.tipText : colors.text;
					ctx.fillText(l, bx + 10, by + 20 + i * 17);
				});
			}
			raf = requestAnimationFrame(frame);
		};
		raf = requestAnimationFrame(frame);

		const move = (e) => {
			const rect = canvas.getBoundingClientRect();
			mouse.x = e.clientX - rect.left;
			mouse.y = e.clientY - rect.top;
		};
		const leave = () => (mouse.x = mouse.y = -1);
		canvas.addEventListener('pointermove', move);
		canvas.addEventListener('pointerleave', leave);
		return () => {
			cancelAnimationFrame(raf);
			ro.disconnect();
			dark.removeEventListener('change', readColors);
			canvas.removeEventListener('pointermove', move);
			canvas.removeEventListener('pointerleave', leave);
		};
	});
</script>

<div class="viz">
	<canvas bind:this={canvas} aria-hidden="true"></canvas>
	<p class="caption">
		{#if status === 'loading'}{t.loading}
		{:else if status === 'error'}{t.error}
		{:else}<strong>{t.count(nodes.length, fitting)}</strong>{/if}
		<span class="legend"><i class="dot fit"></i>{t.fits} <i class="dot full"></i>{t.full}</span>
	</p>
	{#if nodes.length}
		<details>
			<summary>{t.list}</summary>
			<ul class="list">
				{#each nodes as n (n.hash)}
					<li><i class="dot" class:fit={n.fits} class:full={!n.fits}></i><span class="name">{n.name}</span><span class="data">{t.free(n)}</span></li>
				{/each}
			</ul>
		</details>
	{/if}
</div>

<style>
	.viz { margin: 0; }
	canvas { display: block; width: 100%; height: 380px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); }
	.caption { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0.5rem 1rem; margin-top: 0.75rem; font-size: 0.9rem; }
	.legend { color: var(--text-2); display: inline-flex; align-items: center; gap: 0.4rem; }
	.dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-left: 0.4rem; }
	.dot.fit { background: var(--accent); }
	.dot.full { background: var(--text-2); opacity: 0.6; }
	details { margin-top: 0.75rem; font-size: 0.9rem; }
	summary { color: var(--text-2); }
	.list { list-style: none; padding: 0; margin: 0.5rem 0 0; display: grid; gap: 0.25rem; }
	.list li { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
	.list .dot { margin-left: 0; }
	.name { font-weight: 600; overflow-wrap: anywhere; }
	.list .data { color: var(--text-2); }
	@media (max-width: 720px) { canvas { height: 300px; } }
</style>
