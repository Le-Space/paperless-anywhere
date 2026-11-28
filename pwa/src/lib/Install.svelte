<script>
	// "App installieren": a button where the browser offers its own prompt
	// (Chromium), a short dismissible hint where it does not (Safari, Firefox),
	// nothing in the installed app (install-prompt.js). Nothing shows before the
	// page runs in the browser, so the prerendered landing page has none.
	import { onMount } from 'svelte';
	import { browserKind, dismissHint, hintDismissed, installed, offer, promptEvent, showPrompt, standalone } from '$lib/install-prompt.js';

	/**
	 * `button` and `hints` choose what this place offers: the app has the
	 * button in its header and the hints further down.
	 * @type {{ t: typeof import('$lib/i18n/install.js').install.de, place: string, compact?: boolean, button?: boolean, hints?: boolean }}
	 */
	let { t, place, compact = false, button = true, hints = true } = $props();

	let ready = $state(false);
	let kind = $state(/** @type {ReturnType<typeof browserKind>} */ ('other'));
	let dismissed = $state(false);
	let alone = $state(false);

	onMount(() => {
		kind = browserKind(navigator.userAgent, navigator.maxTouchPoints);
		dismissed = hintDismissed();
		alone = standalone();
		ready = true;
	});

	const shown = $derived(ready ? offer({ standalone: alone, installed: $installed, prompt: Boolean($promptEvent), kind, dismissed }) : 'none');

	function dismiss() {
		dismissHint();
		dismissed = true;
	}
</script>

{#if shown === 'button' && button}
	<span class="install" class:compact>
		<button class="install-btn" onclick={showPrompt} title={compact ? t.buttonHint : undefined} data-testid={`install-app-${place}`}>
			<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11" /><path d="m7 10 5 5 5-5" /><path d="M5 20h14" /></svg>
			{t.button}
		</button>
		{#if !compact}<span class="hint">{t.buttonHint}</span>{/if}
	</span>
{:else if shown !== 'none' && shown !== 'button' && hints}
	<p class="install-hint" data-testid={`install-hint-${place}`} data-kind={shown}>
		<span>
			{#if shown === 'ios'}
				{t.hint.ios.before}<strong>{t.hint.ios.share}</strong>
				<svg class="share" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12" /><path d="m8 7 4-4 4 4" /><path d="M6 11H5v10h14V11h-1" /></svg>{t.hint.ios.after}
			{:else if shown === 'mac'}
				{t.hint.mac.before}<strong>{t.hint.mac.menu}</strong>{t.hint.mac.after}
			{:else}
				{t.hint.firefox}
			{/if}
		</span>
		<button class="close" onclick={dismiss} aria-label={t.hint.dismiss} title={t.hint.dismiss} data-testid={`install-hint-dismiss-${place}`}>×</button>
	</p>
{/if}

<style>
	.install { display: inline-flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
	.install-btn {
		display: inline-flex; align-items: center; gap: 0.45rem; margin: 0;
		padding: 0.7rem 1.2rem; border-radius: 999px; font: inherit; font-weight: 600; cursor: pointer; white-space: nowrap;
		background: var(--surface); color: var(--text); border: 1px solid var(--line); box-shadow: var(--shadow);
	}
	.install-btn:hover { border-color: var(--text-2); }
	.install-btn:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
	.compact .install-btn { padding: 0.3rem 0.75rem; font-size: 0.8rem; box-shadow: none; background: transparent; }
	.compact .install-btn svg { width: 15px; height: 15px; }
	.hint { color: var(--text-2); font-size: 0.9rem; }
	.install-hint {
		display: flex; align-items: flex-start; gap: 0.5rem; margin: 0.75rem 0 0; max-width: 38rem;
		padding: 0.6rem 0.6rem 0.6rem 0.9rem; border-radius: var(--radius-sm);
		background: var(--surface-2); border: 1px solid var(--line); color: var(--text-2); font-size: 0.9rem; line-height: 1.5;
	}
	.install-hint span { flex: 1; }
	.install-hint strong { color: var(--text); font-weight: 600; }
	.share { vertical-align: -3px; margin: 0 0.15rem; }
	.close { margin: 0; padding: 0 0.4rem; border: 0; background: transparent; color: var(--text-2); font-size: 1.2rem; line-height: 1.2; cursor: pointer; border-radius: 6px; }
	.close:hover { color: var(--text); }
	.close:focus-visible { outline: 2px solid var(--focus); }
</style>
