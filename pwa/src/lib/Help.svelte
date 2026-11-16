<script>
	// "Hilfe & Support", in the app (with "Diagnose kopieren") and on the
	// landing page (without; it points to the app's button). The texts come
	// from i18n/help.js; the diagnosis from diagnosis.js, shown before it is
	// copied so a person sees what leaves.
	const REPO = 'https://github.com/Le-Space/paperless-anywhere';

	/** @type {{ t: typeof import('$lib/i18n/help.js').help.de, lang: 'de' | 'en', faq: string, diagnosis?: (() => Promise<string>) | null, open?: boolean }} */
	let { t, lang, faq, diagnosis = null, open = $bindable(false) } = $props();
	const id = $derived(lang === 'de' ? 'hilfe' : 'help');
	// A link to #hilfe / #help (the footer's) opens it.
	$effect(() => {
		const follow = () => {
			if (['#hilfe', '#help'].includes(location.hash)) open = true;
		};
		follow();
		window.addEventListener('hashchange', follow);
		return () => window.removeEventListener('hashchange', follow);
	});

	const restore = $derived(`${REPO}/blob/main/docs/restore-yourself${lang === 'de' ? '.de' : ''}.md`);
	const mailto = $derived(`mailto:${t.mail}?subject=${encodeURIComponent(t.mailSubject)}`);
	let text = $state('');
	let said = $state('');
	let showText = $state(false);
	async function copy() {
		if (!diagnosis) return;
		said = '';
		text = await diagnosis();
		try {
			await navigator.clipboard.writeText(text);
			said = t.diagnosis.copied;
		} catch {
			said = t.diagnosis.failed;
			showText = true;
		}
	}
</script>

<details class="help" {id} bind:open data-testid="help">
	<summary><strong>{t.title}</strong></summary>
	<p>{t.lead} <a href={mailto} data-testid="help-mail">{t.mail}</a></p>
	<p class="hint">{t.payment} <a href={`mailto:${t.paymentMail}`} data-testid="help-payment-mail">{t.paymentMail}</a></p>

	<div class="never" role="note" data-testid="help-never">
		<strong>{t.neverTitle}</strong>
		<p>{t.never}</p>
	</div>

	<h3>{t.sendTitle}</h3>
	<p>{diagnosis ? t.send : t.sendLanding}</p>
	{#if diagnosis}
		<p class="row">
			<button type="button" class="secondary" onclick={copy} data-testid="help-diagnosis">{t.diagnosis.copy}</button>
			{#if said}<span role="status" data-testid="help-diagnosis-said">{said}</span>{/if}
		</p>
		<details class="fold" bind:open={showText} ontoggle={async (e) => { if (/** @type {HTMLDetailsElement} */ (e.currentTarget).open && !text && diagnosis) text = await diagnosis(); }}>
			<summary>{t.diagnosis.show}</summary>
			<p class="hint">{t.diagnosis.locked}</p>
			<pre data-testid="help-diagnosis-text">{text}</pre>
		</details>
	{/if}

	<h3>{t.readTitle}</h3>
	<ul>
		<li><a href={faq} data-testid="help-faq">{t.faq}</a></li>
		<li><a href={restore} target="_blank" rel="noopener noreferrer" data-testid="help-restore">{t.restore}</a></li>
	</ul>

	<h3 id={lang === 'de' ? 'sicherheit' : 'security'}>{t.securityTitle}</h3>
	<p>{t.security}</p>
	<ul>
		<li><a href={`mailto:${t.securityMail}`} data-testid="help-security-mail">{t.securityMail}</a></li>
		<li><a href={`${REPO}/security/advisories/new`} target="_blank" rel="noopener noreferrer" data-testid="help-security-github">{t.securityGithub}</a></li>
		<li><a href={`${REPO}/blob/main/SECURITY.md`} target="_blank" rel="noopener noreferrer" data-testid="help-security-policy">{t.securityPolicy}</a></li>
	</ul>
</details>

<style>
	.help { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 1rem 1.25rem; margin: 1.5rem 0; scroll-margin-top: 6rem; }
	.help > summary { cursor: pointer; font-size: 1.05rem; }
	h3 { font-size: 0.95rem; margin: 1.25rem 0 0.4rem; }
	p { line-height: 1.55; }
	.hint { color: var(--text-2); font-size: 0.9rem; }
	.never { border-left: 4px solid var(--warn); background: var(--warn-bg); padding: 0.75rem 1rem; border-radius: var(--radius-sm, 6px); margin: 1rem 0; }
	.never p { margin: 0.35rem 0 0; }
	.row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; }
	.fold summary { cursor: pointer; color: var(--text-2); font-size: 0.9rem; }
	pre { white-space: pre-wrap; overflow-wrap: anywhere; font-family: var(--mono); font-size: 0.8rem; background: var(--surface-2); padding: 0.75rem; border-radius: var(--radius-sm, 6px); }
	ul { margin: 0; padding-left: 1.2rem; }
	li { margin: 0.2rem 0; }
</style>
