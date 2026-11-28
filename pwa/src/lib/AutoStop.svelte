<script>
	// The automatic stop (auto-stop.js, docs/auto-stop.md): the setting in the
	// sealed profile, handed to a running VM at once; while the VM runs, when
	// it will stop itself, a warning shortly before, and "1 hour later".
	import { onDestroy, onMount } from 'svelte';
	import { vmStatus } from '$lib/vm.js';
	import { statusToken } from '$lib/keys/derive.js';
	import { format, t } from '$lib/i18n/index.js';
	import { IDLE_CHOICES, MAX_IDLE, MIN_IDLE, autoStopSetting, autoStopWarning, imageKnowsAutoStop, nextAutoStop, ownZone } from '$lib/auto-stop.js';

	/** @type {{ master: Uint8Array, profile: Record<string, any>, status?: any, disabled?: boolean, compact?: boolean, save: (setting: import('$lib/auto-stop.js').AutoStop | null) => Promise<boolean>, postpone: (status: any) => Promise<unknown> }} */
	// `compact`: only when it stops and the warning (the start area); the form is in the backup area.
	let { master, profile, status: opened = null, disabled = false, compact = false, save, postpone } = $props();

	const s = $derived($t.autoStop);
	const held = $derived(autoStopSetting(profile.autoStop));
	// The form: "" never, a choice, or "other" with its own minutes.
	let idle = $state('');
	let custom = $state(45);
	let dailyOn = $state(false);
	let dailyAt = $state('18:00');
	let busy = $state(false);
	let note = $state('');
	let bad = $state(false);
	/** @type {any} */
	let status = $state(null);
	let now = $state(Date.now());
	let timer = 0;

	// The form starts from the profile, and again when it changes elsewhere.
	$effect(() => {
		const h = held;
		idle = h?.idleMinutes == null ? '' : IDLE_CHOICES.includes(h.idleMinutes) ? String(h.idleMinutes) : 'other';
		if (h?.idleMinutes != null && !IDLE_CHOICES.includes(h.idleMinutes)) custom = h.idleMinutes;
		dailyOn = Boolean(h?.dailyAt);
		if (h?.dailyAt) dailyAt = h.dailyAt;
	});
	$effect(() => {
		if (opened) status = opened;
	});

	const running = $derived(Boolean(profile.running?.host));
	const knows = $derived(status ? imageKnowsAutoStop(status) : null);
	const next = $derived(running ? nextAutoStop(status) : null);
	const warning = $derived(running ? autoStopWarning(status, now) : null);
	const zone = ownZone();
	const at = (/** @type {number} */ ms) => format.dateTime(ms, { weekday: 'short', hour: '2-digit', minute: '2-digit' });

	async function read() {
		if (!profile.running?.host) return;
		const page = await vmStatus(profile.running.host, statusToken(master)).catch(() => null);
		if (page) status = page;
	}
	onMount(() => {
		timer = setInterval(() => {
			now = Date.now();
			if (held && !busy) read();
		}, 60_000);
	});
	onDestroy(() => clearInterval(timer));

	/** The form as a setting, or undefined when the minutes are out of range. */
	function wanted() {
		const minutes = idle === '' ? null : idle === 'other' ? Number(custom) : Number(idle);
		if (minutes != null && !(Number.isInteger(minutes) && minutes >= MIN_IDLE && minutes <= MAX_IDLE)) return undefined;
		if (minutes == null && !dailyOn) return null;
		return { idleMinutes: minutes, dailyAt: dailyOn ? dailyAt : null, tz: zone, postponeUntil: 0 };
	}
	async function submit() {
		const setting = wanted();
		bad = setting === undefined;
		if (setting === undefined) return void (note = s.invalid);
		busy = true;
		note = s.saving;
		try {
			const told = await save(setting);
			note = told ? s.savedRunning : s.saved;
			await read();
		} catch (e) {
			bad = true;
			note = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}
	async function later() {
		busy = true;
		try {
			const moved = /** @type {any} */ (await postpone(status));
			note = moved?.postponeUntil ? s.postponed(at(moved.postponeUntil * 1000)) : '';
			bad = false;
			await read();
		} catch (e) {
			bad = true;
			note = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}
</script>

{#if compact}
	{#if warning}
		<p class="warn" role="alert" data-testid="auto-stop-warning">
			{s.warn(at(warning.at))}
			<button class="small" onclick={later} disabled={busy || disabled} data-testid="auto-stop-later">{s.later}</button>
		</p>
	{:else if next}
		<p class="hint" data-testid="auto-stop-next">{s.next(at(next.at))}</p>
	{/if}
	{#if note}<p class={bad ? 'bad' : 'ok'} role="status">{note}</p>{/if}
{:else}
<section class="auto" data-testid="auto-stop">
	<h3>{s.title}</h3>
	{#if warning}
		<p class="warn" role="alert" data-testid="auto-stop-warning">
			{s.warn(at(warning.at))}
			<button class="small" onclick={later} disabled={busy || disabled} data-testid="auto-stop-later">{s.later}</button>
		</p>
	{:else if next}
		<p class="hint" data-testid="auto-stop-next">{s.next(at(next.at))}</p>
	{/if}
	{#if running && held && knows === false}<p class="hint" data-testid="auto-stop-old-image">{s.oldImage}</p>{/if}
	<p class="hint">{s.lede}</p>
	<div class="row">
		<label>
			{s.idle}
			<select bind:value={idle} disabled={busy || disabled} data-testid="auto-stop-idle">
				<option value="">{s.idleOff}</option>
				{#each IDLE_CHOICES as m (m)}<option value={String(m)}>{s.minutes(m)}</option>{/each}
				<option value="other">{s.other}</option>
			</select>
		</label>
		{#if idle === 'other'}
			<label>{s.otherLabel}<input type="number" min={MIN_IDLE} max={MAX_IDLE} step="1" bind:value={custom} disabled={busy || disabled} data-testid="auto-stop-minutes" /></label>
		{/if}
	</div>
	<div class="row">
		<label class="check"><input type="checkbox" bind:checked={dailyOn} disabled={busy || disabled} data-testid="auto-stop-daily-on" />{s.daily}</label>
		<input type="time" bind:value={dailyAt} disabled={busy || disabled || !dailyOn} data-testid="auto-stop-daily" />
		{#if zone}<span class="hint">{s.zone(zone)}</span>{/if}
	</div>
	<p class="hint">{s.quiet}</p>
	<p class="hint">{s.honest}</p>
	<button class="small" onclick={submit} disabled={busy || disabled} data-testid="auto-stop-save">{busy ? s.saving : s.save}</button>
	{#if note}<p class={bad ? 'bad' : 'ok'} role="status" data-testid="auto-stop-note">{note}</p>{/if}
</section>
{/if}

<style>
	.auto { margin: 0.75rem 0 0; padding: 0.9rem 1rem; background: var(--surface-2); border-radius: var(--radius-sm); }
	.auto h3 { margin: 0 0 0.4rem; font-size: 1rem; }
	.auto p { margin: 0.25rem 0; }
	.row { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; align-items: center; margin: 0.4rem 0; }
	.row label { display: flex; gap: 0.4rem; align-items: center; }
	.row input[type='number'] { width: 6rem; }
	.hint { color: var(--text-2); font-size: 0.875rem; }
	.ok { color: var(--ok); }
	.bad { color: var(--danger); }
	.warn { color: var(--warn); }
	.small { margin-top: 0.4rem; padding: 0.35rem 0.85rem; font-size: 0.875rem; background: var(--surface); color: var(--text); border-color: var(--line); }
</style>
