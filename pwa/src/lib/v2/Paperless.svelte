<script>
	// The areas "Start" and "Sicherung" of the v0.2 interface, drawn from one
	// card (lifecycle-card.svelte.js, the same flow control as v0.1's
	// Lifecycle.svelte). One template for both views: "Standard" shows the
	// state, one sentence and one action in plain words; "Technisch" shows the
	// same in the same place and adds what a developer wants to see (hashes,
	// the choice of backup, the evidence, the raw progress and logs).
	//
	// What v0.1 spread over two templates is in one place each: the backup
	// tools (back up now, try a backup, download, storage, the chain) are under
	// "Sicherung" in both views, whatever Paperless is doing. Both areas stay
	// mounted, so a running start or backup is never torn down.
	import BackupChain from '$lib/BackupChain.svelte';
	import BackupExport from '$lib/BackupExport.svelte';
	import BackupNow from '$lib/BackupNow.svelte';
	import Evidence from '$lib/Evidence.svelte';
	import FirstStart from '$lib/FirstStart.svelte';
	import HourQuote from '$lib/HourQuote.svelte';
	import ProviderHealth from '$lib/ProviderHealth.svelte';
	import RefreshBalances from '$lib/RefreshBalances.svelte';
	import StartPanel from '$lib/StartPanel.svelte';
	import Storage from '$lib/Storage.svelte';
	import TrialRestore from '$lib/TrialRestore.svelte';
	import { backupSize, place } from '$lib/backups.js';
	import { CREDITS_URL } from '$lib/credits.js';
	import { httpsUrl } from '$lib/evidence.js';
	import { format, lang, t } from '$lib/i18n/index.js';
	import { createLifecycleCard } from '$lib/lifecycle-card.svelte.js';
	import { BUILDER, hasOwnImage } from '$lib/own-image.js';
	import { backupListing, loadProfile } from '$lib/profile.js';
	import { purchaseLocked } from '$lib/purchase.js';
	import { BACKUP_TEXTS } from '$lib/backup-overview.js';
	import { overlay } from '$lib/v2/plain.js';

	/**
	 * @type {{
	 *   master: Uint8Array, technical: boolean, area: string, version?: number, reach?: import('$lib/backup-status.js').Level,
	 *   onchange?: () => void, onsetup?: () => void, ontechnical?: () => void, onpackage?: () => void, onmissing?: (missing: string[]) => void,
	 *   onglance?: (g: any) => void, onbusy?: (busy: boolean) => void, oncopies?: (c: any) => void,
	 *   confirm: (q: { title: string, text: string, yes: string, no: string, danger?: boolean }) => Promise<boolean>,
	 *   lights?: import('svelte').Snippet
	 * }}
	 * ontechnical: switches to the technical view (where a backup can be chosen); confirm: the shell's dialog; lights: the two backup lights, drawn at the top of "Sicherung".
	 */
	let { master, technical, area, version = 0, reach = 'unknown', onchange = () => {}, onsetup = () => {}, ontechnical = () => {}, onpackage = () => {}, onmissing = () => {}, onglance = () => {}, onbusy = () => {}, oncopies = () => {}, confirm, lights } = $props();

	const x = $derived($t.v2);
	const s = $derived($t.v2.start);
	const k = createLifecycleCard({
		get master() { return master; },
		get version() { return version; },
		onchange: () => onchange(),
		onmissing: (/** @type {string[]} */ m) => onmissing(m),
		onglance: (/** @type {any} */ g) => onglance(g),
		onbusy: (/** @type {boolean} */ b) => onbusy(b),
		oncopies: (/** @type {any} */ c) => oncopies(c),
		onpackage: () => onpackage(),
		// The card's own questions (the price of a build, deleting without a backup) in the shell's dialog.
		confirm: (/** @type {string} */ question) => confirm({ title: $t.v2.confirmTitle, text: question, yes: $t.v2.confirmYes, no: $t.v2.confirmNo })
	});
	const c = $derived(k.c);
	const profile = $derived(k.profile);
	const phase = $derived(k.phase);
	const moving = $derived(phase === 'starting' || phase === 'stopping' || phase === 'discarding');
	const startTime = $derived(k.minutes(k.STEPS.start.reduce((/** @type {number} */ a, /** @type {any} */ st) => a + k.typicalOf(st), 0)));
	// The date of a backup in plain words ("vom 16.11.2026, 21:14"), where the profile knows it.
	const dateOf = (/** @type {any} */ b) => k.whenOf(b).replace(/^[,\s]+/, '');
	const tail = (/** @type {string} */ cid) => cid.slice(-12);
	const attested = $derived(Boolean(profile.running?.attestation));
	const reloadProfile = async () => {
		k.profile = await loadProfile(master);
		onchange();
	};

	let copied = $state('');
	async function copyPassword() {
		try {
			await navigator.clipboard.writeText(k.adminPassword);
			copied = s.copied;
		} catch {
			copied = s.copyFailed;
		}
	}
	const abandon = async () => {
		if (await confirm({ title: s.abandonTitle, text: s.abandonText, yes: s.abandonYes, no: s.abandonNo, danger: true })) k.abandonStart();
	};
	// The backup "Dokumente herunterladen" fetches: the one chosen for the start, else this vault's newest.
	const downloadable = $derived(k.chosenBackup ?? k.chainBackup);

	// "Standard" speaks plainly in the parts it shares with v0.1: their texts with the plain ones laid over (plain.js).
	const plain = $derived($t.v2.plain);
	const startPanelT = $derived(technical ? k.panelT : overlay(k.panelT, { ...plain.panel, stop: undefined }));
	const stopPanelT = $derived.by(() => {
		if (technical) return k.panelShownT;
		const discard = k.panelShownT.title === k.panelT.stop.titleDiscard;
		const p = plain.panel;
		return overlay(k.panelShownT, { title: discard ? p.stop.titleDiscard : p.stop.title, rows: p.stop.rows, legend: p.legend, after: discard ? p.stop.afterDiscard : p.stop.after, details: p.details, hide: p.hide });
	});
	const firstT = $derived(technical ? null : overlay($t.first, plain.first));
	const backupNowT = $derived(technical ? null : overlay(BACKUP_TEXTS[$lang], plain.backupNow));
</script>

{#snippet tech(/** @type {string} */ title, /** @type {import('svelte').Snippet} */ body)}
	{#if technical}
		<div class="tech" data-testid="v2-tech">
			<p class="tk">{x.view.technical} · {title}</p>
			{@render body()}
		</div>
	{/if}
{/snippet}

{#snippet placesBox()}
	{#if k.placesAsk}
		{@const ask = k.placesAsk}
		<div class="alert" role="alert" data-testid="places-ask">
			{#if technical}
				{#if ask.blocked}<p data-testid="places-blocked">{c.places.blocked(ask.blocked.names.join(', '), ask.blocked.why)}</p>{/if}
				{#if ask.names.length}<p>{c.places.down(ask.names.join(', '))}</p>{/if}
				{#if ask.plan}
					<ul>{#each ask.plan.replaced as r (r.from.id)}<li>{r.to ? c.places.instead(`${r.from.id} ${r.from.name ?? ''}`.trim(), `${r.to.id} ${r.to.name}${r.to.place ? `, ${r.to.place}` : ''}`) : c.places.none(`${r.from.id} ${r.from.name ?? ''}`.trim())}</li>{/each}</ul>
					<p class="hint">{ask.blocked && !ask.names.length ? c.places.blockedHint : c.places.hint}</p>
				{:else}
					<p class="hint">{c.places.noReplacement}</p>
				{/if}
			{:else}
				<!-- Standard: what it means and what can be done, without provider numbers. -->
				{#if ask.blocked}<p data-testid="places-blocked">{plain.places.blocked(ask.blocked.names.length)}</p>{/if}
				{#if ask.names.length}<p>{plain.places.down(ask.names.length)}</p>{/if}
				<p>{ask.plan ? plain.places.replace : plain.places.noReplacement}</p>
			{/if}
			{#if ask.blocked && !ask.names.length}
				{#if ask.plan}<button class="sec" onclick={k.acceptPlaces} disabled={k.busy} data-testid="places-accept">{c.places.acceptOnly}</button>{/if}
				<button class="lnk" onclick={() => (k.placesAsk = null)} data-testid="places-cancel">{c.places.later}</button>
			{:else}
				{#if ask.plan}<button class="sec" onclick={k.acceptPlaces} disabled={k.busy} data-testid="places-accept">{c.places.accept}</button>{/if}
				<button class="sec" onclick={k.placesAnyway} disabled={k.busy} data-testid="places-anyway">{ask.allDown ? c.places.tryAnyway : c.places.goOn}</button>
				<button class="lnk" onclick={() => (k.placesAsk = null)} data-testid="places-cancel">{c.places.cancel}</button>
			{/if}
		</div>
	{/if}
{/snippet}

{#snippet fundOffer()}
	{@const locked = k.busy || purchaseLocked(k.buying)}
	<div class="card" data-testid="v2-fund">
		<p class="hint"><RefreshBalances label={$t.funds.toppedUp} testid="short-refresh" /></p>
		{#if k.fromPackage}
			<p>{c.fund.inPackage(k.packageHours ?? 0)}</p>
			<button class="cta" onclick={k.startFromPackage} disabled={locked} data-testid="start-from-package">{c.fund.startFromPackage(k.packageHours ?? 0)}</button>
		{:else}
			<label class="field" for="v2-fund-hours">{c.fund.buyLabel}</label>
			<select id="v2-fund-hours" bind:value={k.fundHours} disabled={locked} data-testid="fund-hours">{#each [5, 10, 30] as h (h)}<option value={h}>{h} h</option>{/each}</select>
			<button class="cta" onclick={k.askToBuy} disabled={locked} data-testid="fund-start">{k.buying.phase === 'quoting' ? c.fund.quoting : c.fund.buyAndStart}</button>
			<HourQuote quote={k.buying.phase === 'open' ? k.buying.quote : null} short={k.buying.phase === 'short'} hoursAsked={k.buying.hours} topUpHint={c.fund.topUpHint} confirmLabel={c.fund.buyAndStart} disabled={k.busy || k.buying.phase === 'buying'} onconfirm={() => k.purchase.confirm()} oncancel={() => k.purchase.cancel()} />
			{#if k.buying.error}<p class="error" role="alert" data-testid="fund-error">{k.buying.error}</p>{/if}
		{/if}
	</div>
{/snippet}

<!-- The first start with an image of one's own: the full-screen journey, in both views. -->
{#if k.ceremony}
	{@const ceremony = k.ceremony}
	<FirstStart
		view={ceremony}
		startTypical={k.STEPS.start.reduce((/** @type {number} */ a, /** @type {any} */ st) => a + k.typicalOf(st), 0)}
		host={profile.running?.host ?? null}
		ownImage={profile.ownImage ?? null}
		imageHash={profile.rootfsItemHash ?? null}
		plain={BUILDER?.plain ?? null}
		texts={firstT}
		simple={!technical}
		onminimize={() => (k.ceremony = { ...ceremony, minimized: true })}
		onexpand={() => (k.ceremony = { ...ceremony, minimized: false })}
		oncertificate={(show) => (k.ceremony = !show && ceremony.only ? null : { ...ceremony, certificate: show })}
		onclose={() => (k.ceremony = null)}
	/>
{/if}

<section id="area-start" hidden={area !== 'start'} aria-labelledby="h-start" data-testid="v2-start">
	<div class="card status is-{phase}" data-testid="v2-status">
		<h1 id="h-start" tabindex="-1">{s.titles[/** @type {keyof typeof s.titles} */ (phase)] ?? phase}</h1>
		{#if phase === 'off'}<p class="sub">{s.offSub(startTime)}</p>
		{:else if phase === 'starting'}<p class="sub">{s.keepOpen}</p>
		{:else if phase === 'stopping'}<p class="sub">{s.stoppingSub} {s.keepOpen}</p>
		{:else if phase === 'discarding'}<p class="sub">{s.discardingSub} {s.keepOpen}</p>
		{:else if phase === 'interrupted'}<p class="sub">{s.interruptedSub}</p>{/if}

		{#if moving}
			<div class="meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(k.share * 100)} aria-label={s.titles[/** @type {keyof typeof s.titles} */ (phase)]}><span style="width: {Math.round(k.share * 100)}%"></span></div>
			<p class="left" role="status" data-testid="v2-progress"><strong>{s.left(k.leftMinutes)}</strong></p>
		{:else if phase === 'running'}
			{#if technical}<p class="tline" data-testid="v2-host">{s.host}: {profile.running.host}</p>{/if}
			<a class="cta" href={`https://${profile.running.host}/`} target="_blank" rel="noopener" data-testid="v2-open">{s.open}</a>
			{#if Number(profile.running?.restore?.superusers) > 0}<p class="warn" data-testid="restore-superusers">{c.superusers(Number(profile.running?.restore?.superusers))}</p>{/if}
			{#if k.restoreFailed}
				<p class="error" role="alert" data-testid="v2-restore-failed">{c.simple.restoreFailed}{#if technical} {c.advanced.restoreFailed(`${profile.running.restore.reason ?? c.advanced.noReason}${profile.running.restore.error ? `: ${profile.running.restore.error}` : ''}`)}{/if}</p>
			{/if}
			<div class="login" data-testid="v2-login">
				<h2>{s.login}</h2>
				<p>{s.user} <code>admin</code></p>
				<p>{s.password} {#if k.showPassword}<code data-testid="v2-password">{k.adminPassword}</code>{:else}<code>••••••••</code>{/if}</p>
				<div class="row">
					<button type="button" class="small" aria-pressed={k.showPassword} onclick={() => (k.showPassword = !k.showPassword)}>{k.showPassword ? c.simple.hide : c.simple.show}</button>
					<button type="button" class="small" onclick={copyPassword} data-testid="v2-copy-password">{c.simple.copy}</button>
					{#if copied}<span class="said" role="status">{copied}</span>{/if}
				</div>
			</div>
		{:else if phase === 'interrupted'}
			<button class="cta" onclick={k.resume} disabled={k.busy} data-testid="v2-resume">{s.resume}</button>
			<button class="sec" onclick={abandon} disabled={k.busy} data-testid="v2-abandon">{s.abandon}</button>
			{#if technical}
				<p class="tline" data-testid="start-interrupted">{c.advanced.interrupted.before} {profile.starting.instanceHash.slice(0, 12)}{c.advanced.interrupted.requested(format.dateTime(profile.starting.at, { dateStyle: 'short', timeStyle: 'short' }, $lang))}</p>
				<button class="lnk" onclick={k.discard} disabled={k.busy} data-testid="v2-only-forget">{s.onlyForget}</button>
			{/if}
		{:else if phase === 'off'}
			{#if k.missing.length}
				<p>{s.notSetUp}</p>
				{#if technical}<p class="tline" data-testid="v2-missing">{s.stillMissing(k.missing.join(', '))}</p>{/if}
				<button class="sec" onclick={onsetup} data-testid="v2-open-setup">{technical ? s.openSetup : s.openSetupTechnical}</button>
			{:else}
				<!-- Disabled as the safer of v0.1's two templates: also while the backups are unread or unreadable. -->
				<button class="cta" onclick={k.start} disabled={k.busy || k.backupsPending || Boolean(k.backupsError) || k.gapOpen || k.unmarkedOpen} data-testid="v2-start-button">{s.start}</button>
				{#if k.backupsPending}<p class="hint" role="status">{s.readingBackups}</p>
				{:else if k.backupsError}
					<p class="warn" role="alert" data-testid="v2-backups-error">{k.backupsError}</p>
					<button class="sec" onclick={k.readBackupsAgain} data-testid="v2-backups-again">{s.again}</button>
				{:else if profile.ageIdentity}
					<p class="with" data-testid="v2-starts-with">{k.chosenBackup ? s.withBackup(dateOf(k.chosenBackup)) : s.empty}</p>
					{#if technical && k.chosenBackup}<p class="tline" data-testid="v2-starts-with-tech">Piece …{tail(k.chosenBackup.pieceCid)}{k.sizePart(k.chosenBackup)}, {c.advanced.copiesAt(k.chosenBackup.copies.length, k.wherePlaces(k.chosenBackup))}</p>{/if}
				{/if}
			{/if}
			{#if BUILDER && k.image.buildsAtStart}<p class="hint" data-testid="first-build">{s.firstBuild}</p>{/if}
			{#if BUILDER && k.image.own && k.image.newer}
				<p class="hint" data-testid="image-newer">{s.newer} <button class="lnk inline" onclick={k.rebuildImage} disabled={k.busy} data-testid="image-rebuild">{s.rebuild}</button></p>
			{/if}
		{/if}
		{#if BUILDER && k.image.own && k.image.newer && phase !== 'off' && phase !== 'loading'}<p class="hint">{s.newer} {s.rebuildWhenOff}</p>{/if}
	</div>

	<!-- A question before the start: asked once, with its own buttons. -->
	{#if k.unpaidBackup}
		<div class="alert" role="alertdialog" aria-label={c.unpaid.label} data-testid="start-unpaid-backup">
			<p><strong>{c.unpaid.strong}</strong> {c.unpaid.text}</p>
			<button class="sec" onclick={k.toPackage} data-testid="start-book-backup">{c.unpaid.book}</button>
			<button class="sec" onclick={k.startWithoutBackup} disabled={k.busy} data-testid="start-without-backup">{c.unpaid.without}</button>
			<button class="lnk" onclick={() => (k.unpaidBackup = false)}>{c.unpaid.cancel}</button>
		</div>
	{/if}
	{#if phase === 'off' && k.gap}
		<div class="alert" data-testid="restore-gap">
			<p>
				{#if !technical}{k.gap === 'missing' ? plain.restore.gapMissing(Boolean(k.chosenBackup)) : plain.restore.gapOlder}
				{:else if k.gap === 'missing'}{c.gap.missing(k.known?.slice(-12) ?? '', k.lastGood?.pieceCid === k.known && k.lastGood?.at ? c.dated(format.dateTime(k.lastGood.at, undefined, $lang)) : '', Boolean(k.chosenBackup))}
				{:else}{c.gap.older(k.known?.slice(-12) ?? '')}{/if}
				{c.gap.later}
			</p>
			<label class="check"><input type="checkbox" data-testid="restore-gap-accept" checked={!k.gapOpen} onchange={(e) => (k.gapAccepted = e.currentTarget.checked ? k.gapKey : '')} /> <span>{c.gap.accept}</span></label>
		</div>
	{/if}
	<!-- From v0.1 (#368), in both views: the newest backup may be an empty Paperless's, and an empty start must not bury the real ones. -->
	{#if phase === 'off' && k.tinyNewest && (k.choice === 'latest' || k.choice === 'own')}
		<div class="alert" data-testid="tiny-newest">
			{#if technical}<p>{c.advanced.tinyNewest(backupSize(k.tinyNewest.newest.size), backupSize(k.tinyNewest.before.size), k.tinyNewest.before.pieceCid.slice(-12))}</p>
			{:else}
				<p>{s.tinyNewest(backupSize(k.tinyNewest.newest.size), backupSize(k.tinyNewest.before.size))}</p>
				<button class="sec" onclick={ontechnical} data-testid="v2-choose-backup">{s.chooseInTechnical}</button>
			{/if}
		</div>
	{/if}
	{#if phase === 'off' && !k.missing.length && k.choice === 'empty' && k.backups?.length}
		<div class="alert" data-testid="empty-over-backups">
			<p>{c.advanced.emptyOverBackups(k.backups.length)}</p>
			<label class="check"><input type="checkbox" bind:checked={k.freshConfirmed} data-testid="empty-fresh-confirm" /> <span>{c.advanced.emptyFresh}</span></label>
			{#if !technical}<button class="sec" onclick={ontechnical} data-testid="v2-choose-backup-empty">{s.chooseInTechnical}</button>{/if}
		</div>
	{/if}
	{#if phase === 'off' && k.choice === 'any' && k.chosenBackup}
		<div class="alert" data-testid="restore-unmarked">
			<p>{technical ? c.unmarked.text(tail(k.chosenBackup.pieceCid), k.whenOf(k.chosenBackup)) : plain.restore.unmarked(dateOf(k.chosenBackup))}</p>
			<label class="check"><input type="checkbox" data-testid="restore-unmarked-accept" checked={!k.unmarkedOpen} onchange={(e) => (k.unmarkedAccepted = e.currentTarget.checked ? (k.chosenBackup?.pieceCid ?? '') : '')} /> <span>{c.unmarked.accept}</span></label>
		</div>
	{/if}

	<!-- The panel of lights for a start, a stop and an erase, in both views; it stays once a stop is over. -->
	{#if k.startShown}<StartPanel rows={k.panel} t={startPanelT} times={technical ? k.panelTook : {}} total={technical ? k.panelTotal : ''} compact={!technical} />{/if}
	{#if k.stopShown}<StartPanel rows={k.panel} t={stopPanelT} times={technical ? k.panelTook : {}} total={technical ? k.panelTotal : ''} compact={!technical} testid="stop-panel" />{/if}
	{#if technical && k.progress}<p class="tline" data-testid="progress">{k.progress} …</p>{/if}

	{#if phase === 'running'}
		{#if attested}
			<details class="proof" data-testid="v2-proof">
				<summary><strong>{s.proofStrong}</strong> {s.proof} <span class="more">{s.proofWhat}</span></summary>
				<ul>{#each s.proofPoints as point (point)}<li>{point}</li>{/each}</ul>
			</details>
		{:else}
			<p class="hint" data-testid="v2-no-proof">{s.noProof}</p>
		{/if}
		{#if profile.running.dataDisk === 'plain'}<p class="warn" data-testid="data-disk">{s.diskPlain}{#if technical} {c.advanced.diskPlain}{/if}</p>
		{:else if technical && profile.running.dataDisk === 'encrypted'}<p class="tline" data-testid="data-disk">{c.advanced.diskEncrypted}</p>{/if}
		{#if technical}<Evidence rows={k.evidence} t={k.evidenceT} onagain={k.busy ? null : k.checkAgain} />{/if}

		<div class="card" data-testid="v2-stop-card">
			<h2>{s.doneTitle}</h2>
			{#if k.restoreFailed}
				<button class="sec" onclick={k.discardFailed} disabled={k.busy} data-testid="v2-discard">{c.simple.discard}</button>
			{:else}
				<p>{profile.backupConfig ? s.doneText : s.stopNoBackups}</p>
				{#if reach === 'bad'}<p class="warn" role="status" data-testid="stop-reach-bad">{c.simple.stopReachBad}</p>{/if}
				<!-- Off while a backup runs or the places are checked, as the safer of v0.1's two templates. -->
				<button class="sec" onclick={k.stop} disabled={k.busy || k.backingUp || k.stopChecking} data-testid="v2-stop">{c.simple.stop}</button>
				{#if k.stopChecking}<p class="hint" role="status" data-testid="stop-checking">{c.simple.stopChecking}</p>{/if}
			{/if}
		</div>
	{/if}
	{#if k.stopEvidence.length}<Evidence rows={k.stopEvidence} t={{ ...k.evidenceT, title: k.evidenceT.stopTitle }} />{/if}

	{#if k.partial}
		<div class="alert" role="alert" data-testid="stop-partial">
			<p><strong>{k.partial.message}</strong></p>
			<p>{c.partial.hint(k.partial.requested - k.partial.copies)}</p>
			<button class="sec" onclick={k.keepVm} disabled={k.busy} data-testid="stop-partial-keep">{c.partial.keep}</button>
			<button class="sec" onclick={k.eraseAnyway} disabled={k.busy} data-testid="stop-partial-erase">{c.partial.erase}</button>
		</div>
	{/if}
	{@render placesBox()}

	{#if k.error}
		<div class="error" role="alert" data-testid="start-error">
			<p>{k.error}</p>
			{#if k.errorRaw}<details><summary>{$t.net.details}</summary><pre>{k.errorRaw}</pre></details>{/if}
			{#if k.again}<button class="sec" onclick={() => k.again?.()} disabled={k.busy} data-testid="error-again">{$t.net.again}</button>{/if}
		</div>
	{/if}
	{#if k.error && !k.busy && !profile.running && profile.ownImage?.previous}
		<div class="card" data-testid="previous-image"><p>{$t.ownImage.previousHint}</p><button class="sec" onclick={k.startPrevious} disabled={k.busy} data-testid="start-previous">{$t.ownImage.previousStart}</button></div>
	{/if}
	{#if k.short && CREDITS_URL && (profile.appPays || profile.leSpacePays)}{@render fundOffer()}{/if}
	{#if k.bought}<p class="ok" role="status" data-testid="fund-bought">{k.bought}</p>{/if}
	{#if k.errorLog.length}
		<details class="log" open={technical} data-testid="v2-log"><summary>{technical ? c.advanced.vmSays : s.details}</summary><pre data-testid="backup-log">{k.errorLog.join('\n')}</pre><ProviderHealth network={profile.network ?? 'calibration'} ids={k.healthIds} /></details>
	{/if}

	{#if k.goneNote}<p class="note" role="status" data-testid="start-gone">{k.goneNote}</p>{/if}
	{#if k.nodeNote}<p class="note" role="status" data-testid="node-refused">{k.nodeNote}</p>{/if}
	{#if k.periodEnded}<p class="note" role="status" data-testid="period-end-stopped">{c.periodEnd.stopped}</p>{/if}
	{#if profile.backupRevokePending && !profile.running && technical}<p class="note" data-testid="revoke-pending">{c.revokePending}</p>{/if}

	{#if BUILDER && hasOwnImage(profile, BUILDER.plain.sha256) && !moving}<button class="lnk" onclick={k.showCertificate} data-testid="open-certificate">{s.certificate}</button>{/if}

	<!-- What the technical view adds to a start that has not begun: the choice of backup, the role, the image. -->
	{#snippet startFacts()}
		<p class="role" data-testid="role-line">{profile.role === 'primary' ? c.advanced.rolePrimary : c.advanced.roleTest}</p>
		{#if BUILDER}
			<p data-testid="image-line">{#if k.image.own}{$t.ownImage.overview.built(format.date(k.image.builtAt ?? Date.now(), undefined, $lang))}{:else if k.image.buildsAtStart}{c.simple.firstBuild}{:else}{$t.ownImage.overview.publicImage}{/if}</p>
		{/if}
		{#if profile.ageIdentity}
			<fieldset class="restore">
				<legend>{s.chooseBackup}</legend>
				{#if k.production && k.split.own.length}
					<label><input type="radio" bind:group={k.choice} value="latest" data-testid="restore-latest" /> <span>{c.advanced.restoreLatest} <small data-testid="latest-backup">({tail(k.pick(k.split.own).pieceCid)}{k.whenOf(k.pick(k.split.own))}{k.sizePart(k.pick(k.split.own))}, {c.advanced.copiesAt(k.pick(k.split.own).copies.length, k.wherePlaces(k.pick(k.split.own)))})</small></span></label>
				{/if}
				<label><input type="radio" bind:group={k.choice} value="own" disabled={!k.split.own.length} /> <span>{c.advanced.restoreOwn}
					{#if k.split.own.length}<small data-testid="newest-backup">({tail(k.pick(k.split.own).pieceCid)}{k.whenOf(k.pick(k.split.own))}{k.sizePart(k.pick(k.split.own))}, {c.advanced.copiesAt(k.pick(k.split.own).copies.length, k.wherePlaces(k.pick(k.split.own)))})</small>
					{:else if k.backups}<small>{c.advanced.noneOwn}</small>{:else}<small>{c.advanced.reading}</small>{/if}</span></label>
				{#if k.split.other.length}
					<label><input type="radio" bind:group={k.choice} value="any" /> <span>{c.advanced.restoreOther} ({tail(k.unmarkedPick(k.split.other).pieceCid)}{k.sizePart(k.unmarkedPick(k.split.other))}, {k.wherePlaces(k.unmarkedPick(k.split.other))}) <small>{c.advanced.otherHint(k.split.other.length)}</small></span></label>
				{/if}
				<label><input type="radio" bind:group={k.choice} value="empty" /> <span>{c.advanced.empty}</span></label>
			</fieldset>
		{/if}
	{/snippet}
	{#if phase === 'off' || phase === 'interrupted'}{@render tech(s.techStart, startFacts)}{/if}
</section>

<section id="area-backup" hidden={area !== 'backup'} aria-labelledby="h-backup" data-testid="v2-backup">
	<h1 id="h-backup" tabindex="-1">{x.areas.backup}</h1>
	{#if lights}<div class="card">{@render lights()}</div>{/if}

	{#if profile.backupConfig}
		<div class="card">
			<!-- The answer people look for first: when the documents were last safe. -->
			<p class="good" class:stale={k.goodStale} data-testid="last-good-backup">{#if k.lastGood}{k.fromStop ? c.simple.lastAtStop : c.simple.lastGood}: <strong>{k.goodWhen(k.lastGood.at)}</strong>{k.lastGood.copies ? ` · ${c.simple.copies(k.lastGood.copies)}` : ''}{#if k.newerOnChain}<br /><span data-testid="newer-on-chain">{c.simple.newerOnChain(c.simple.copies(k.backups?.[0]?.copies.length ?? 0))}</span>{/if}{:else}{c.simple.noneKnown}{/if}</p>
			{#if phase === 'running' && !k.restoreFailed}
				<BackupNow {master} {profile} known={k.lastGood} disabled={k.busy || k.stopChecking} guard={k.checkPlacesThen} onbusy={(b) => (k.backingUp = b)} ongood={k.rememberGood} texts={backupNowT} simple={!technical} />
			{:else if phase !== 'running'}
				<p class="hint" data-testid="v2-backup-only-running">{x.backupArea.onlyRunning}</p>
			{/if}
		</div>
	{:else if phase !== 'loading'}
		<div class="alert" data-testid="v2-backups-off"><p><strong>{x.backupArea.off}</strong>{#if technical} {x.backupArea.offTechnical}{/if}</p></div>
	{/if}
	{#if area === 'backup'}{@render placesBox()}{/if}

	<h2>{x.backupArea.tools}</h2>
	{#if profile.ageIdentity && backupListing(profile) && (phase === 'running' || profile.trial)}
		<TrialRestore {master} {profile} listing={backupListing(profile)} onchange={reloadProfile} />
	{/if}
	<div class="card" data-testid="v2-download">
		<h3>{x.backupArea.download}</h3>
		<p>{x.backupArea.downloadText}</p>
		{#if downloadable && profile.ageIdentity}<BackupExport backup={downloadable} identity={profile.ageIdentity} />
		{:else}<p class="hint">{x.backupArea.noBackupYet}</p>{/if}
	</div>
	<Storage {master} {profile} />

	{#if technical && k.chainBackup}<BackupChain network={profile.network ?? 'calibration'} backup={k.chainBackup} />{/if}
	{#if technical && profile.lastBackup}
		{@const b = profile.lastBackup}
		<details class="part" data-testid="last-backup">
			<summary>{c.last.title(b.date ? format.dateTime(b.date, undefined, $lang) : b.name, b.copies?.length ?? 0, b.requestedCopies ?? b.copies?.length, Boolean(b.complete))}</summary>
			<dl>
				<dt>{c.last.network}</dt><dd>Filecoin {b.network === 'mainnet' ? 'Mainnet' : c.last.testnet}</dd>
				<dt>{c.last.paidBy}</dt><dd><code>{b.payer}</code></dd>
				<dt>Piece CID</dt><dd><code>{b.pieceCid}</code></dd>
				{#if b.size}<dt>{c.last.size}</dt><dd>{format.number(b.size / 1048576, { minimumFractionDigits: 1, maximumFractionDigits: 1 }, $lang)} MiB {c.last.encrypted}{b.parts?.length > 1 ? c.last.inParts(b.parts.length) : ''}</dd>{/if}
				{#if b.seconds}<dt>{c.last.duration}</dt><dd>{b.seconds} s</dd>{/if}
			</dl>
			<ul>
				{#each b.copies ?? [] as copy (copy.providerId + copy.dataSetId)}
					<li>{c.last.copy({ provider: copy.providerId, place: copy.location ? place(copy.location) : '', dataSet: copy.dataSetId, piece: copy.pieceId, isNew: Boolean(copy.isNewDataSet) })}
						{#if httpsUrl(copy.retrievalUrl)}<br /><a href={httpsUrl(copy.retrievalUrl)} target="_blank" rel="noopener">{c.last.fetch}</a> <small>{c.last.fetchHint}</small>{/if}</li>
				{/each}
			</ul>
			{#if b.failedAttempts}<p class="hint">{c.last.failed(b.failedAttempts)}</p>{/if}
		</details>
	{/if}
</section>

<style>
	h1 { font-size: 1.6rem; font-weight: 700; margin: 0 0 0.4rem; }
	h1:focus { outline: none; }
	h2 { font-size: 1.15rem; margin: 1.2rem 0 0.5rem; }
	.card h2, .login h2 { margin: 0 0 0.4rem; }
	h3 { margin: 0 0 0.3rem; }
	.card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 1.1rem; margin: 0 0 0.9rem; box-shadow: var(--shadow); }
	.card p { margin: 0 0 0.6rem; }
	.status.is-running { border-color: var(--ok); }
	.sub { color: var(--text-2); }
	.with { margin: 0.75rem 0 0; }
	button { font: inherit; }
	.cta, .sec { display: flex; align-items: center; justify-content: center; width: 100%; min-height: 3.25rem; padding: 0.6rem 1.1rem; margin: 0.6rem 0 0; font-size: 1.05rem; font-weight: 600; text-align: center; text-decoration: none; }
	.cta { background: var(--cta-bg); color: var(--cta-text); border: 1px solid var(--cta-bg); border-radius: 999px; }
	.sec { background: transparent; color: var(--text); border-color: var(--text-2); }
	.lnk { background: none; border: 0; border-radius: 0; color: var(--accent-2-text); text-decoration: underline; text-underline-offset: 3px; padding: 0.6rem 0; min-height: 2.75rem; text-align: left; display: block; }
	.lnk.inline { display: inline; padding: 0; min-height: 0; }
	.small { background: transparent; color: var(--text); border-color: var(--line); padding: 0.4rem 0.9rem; min-height: 2.75rem; font-size: 0.95rem; }
	.row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
	.said { color: var(--ok); font-size: 0.95rem; }
	.login { background: var(--surface-2); border-radius: var(--radius-sm); padding: 0.8rem 0.9rem; margin: 0.9rem 0 0; }
	.login p { margin: 0 0 0.3rem; }
	.meter { height: 0.6rem; border-radius: 999px; background: var(--surface-2); overflow: hidden; margin: 0.75rem 0 0.4rem; }
	.meter span { display: block; height: 100%; background: var(--accent); border-radius: 999px; }
	.left { margin: 0; }
	.hint { color: var(--text-2); font-size: 0.95rem; margin: 0.5rem 0 0; }
	.note { color: var(--text-2); margin: 0 0 0.9rem; }
	.alert { background: var(--warn-bg); color: var(--warn); border: 1px solid currentColor; border-radius: var(--radius-sm); padding: 0.8rem 0.9rem; margin: 0 0 0.9rem; }
	.alert p { margin: 0 0 0.6rem; }
	.alert .sec { color: inherit; border-color: currentColor; }
	.warn { color: var(--warn); background: var(--warn-bg); padding: 0.6rem 0.8rem; border-radius: var(--radius-sm); margin: 0.6rem 0 0.9rem; }
	.error { color: var(--danger); background: var(--danger-bg); padding: 0.6rem 0.8rem; border-radius: var(--radius-sm); margin: 0.6rem 0 0.9rem; }
	.error p { margin: 0 0 0.4rem; }
	.error .sec { color: inherit; border-color: currentColor; }
	.ok { color: var(--ok); background: var(--ok-bg); padding: 0.6rem 0.8rem; border-radius: var(--radius-sm); margin: 0 0 0.9rem; }
	.check { display: flex; gap: 0.6rem; align-items: flex-start; }
	.check input { width: 1.4rem; height: 1.4rem; flex: none; margin-top: 0.2rem; }
	.field { display: block; margin: 0.6rem 0 0.3rem; color: var(--text-2); font-size: 0.95rem; }
	select { min-height: 2.75rem; font-size: 1.05rem; }
	.proof { background: var(--ok-bg); color: var(--ok); border-radius: var(--radius-sm); padding: 0.7rem 0.9rem; margin: 0 0 0.9rem; }
	.proof summary { min-height: 2.75rem; }
	.proof .more { text-decoration: underline; text-underline-offset: 3px; white-space: nowrap; }
	.proof ul { margin: 0.5rem 0 0; padding-left: 1.2rem; color: var(--text); }
	.good { margin: 0 0 0.6rem; }
	.good.stale { color: var(--warn); }
	.tech { background: var(--surface-2); border: 1px dashed var(--text-2); border-radius: var(--radius-sm); padding: 0.75rem; margin: 0 0 0.9rem; font-size: 0.9rem; }
	.tech p { margin: 0 0 0.4rem; }
	.tk { font-family: var(--mono); font-size: 0.72rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--text-2); }
	.tline { font-family: var(--mono); font-size: 0.85rem; color: var(--text-2); overflow-wrap: anywhere; margin: 0.4rem 0 0.6rem; }
	.restore { border: 1px solid var(--line); border-radius: var(--radius-sm); margin: 0.5rem 0 0; padding: 0.5rem 0.75rem; }
	.restore label { display: flex; gap: 0.5rem; align-items: flex-start; padding: 0.4rem 0; min-height: 2.75rem; }
	.restore small { color: var(--text-2); font-family: var(--mono); overflow-wrap: anywhere; }
	.log pre { overflow-x: auto; font-size: 0.8rem; }
	.log, .part { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 0.8rem 1rem; margin: 0 0 0.9rem; }
	.part summary, .log summary { min-height: 2.75rem; font-weight: 600; }
	.part dl { display: grid; grid-template-columns: auto 1fr; gap: 0.2rem 0.75rem; margin: 0.5rem 0; }
	.part dd { margin: 0; overflow-wrap: anywhere; }
	code { word-break: break-all; }
</style>
